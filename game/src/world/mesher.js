// Chunk mesher: culled faces, vertex colors, classic 4-level ambient occlusion,
// low-frequency world tinting and position-hash jitter so vertex-colored voxels
// read as hand-textured. Flora flagged `cross: true` renders as two crossed
// quads (walk-through, never occludes).
import * as THREE from '../../vendor/three.module.js';
import { WORLD } from '../constants.js';
import { B, BLOCK_DEFS, isOpaque, isWater } from './blocks.js';
import { atlasTexture, tileUV } from './atlas.js';
import { noise2 } from './terrain.js';
import { CHUNKS_X, CHUNKS_Z } from './voxel.js';
import { enhance } from './shade.js';

const { CHUNK, SIZE_Y: SY } = WORLD;

// face: d = normal, c = 4 corners (CCW from outside), ax = the two tangent
// axes (indices into [x,y,z]) used for AO corner sampling.
// uv: [axis for U, axis for V] into the corner triple, so a painted face is
// upright on the sides and reads left-to-right on the top/bottom.
const FACES = [
  // Face shades are the classic voxel "cube reads as a cube" stylisation on
  // top of the real Lambert term: tops full, sides stepped, bottoms deep.
  // Widened 2026-08-23 (was 1.0 / 0.55 / 0.8 / 0.8 / 0.72 / 0.9): the old
  // spread was narrow enough that a block edge needed the AO corner to show.
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, part: 'top', ax: [0, 2], uv: [0, 2] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.45, part: 'bottom', ax: [0, 2], uv: [0, 2] },
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.78, part: 'side', ax: [1, 2], uv: [2, 1] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.70, part: 'side', ax: [1, 2], uv: [2, 1] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.68, part: 'side', ax: [0, 1], uv: [0, 1] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.84, part: 'side', ax: [0, 1], uv: [0, 1] },
];

// ---- baked sun shadows ----
// The sun sits at (40, 60, 20) (engine/renderer.js); light travels the other
// way, so from any point we march TOWARD the sun and the first opaque cell we
// meet puts the point in shadow. The march steps one block in y at a time
// (the x and z steps below are the sun direction scaled to that), which is
// coarse enough to be cheap and fine enough for anything a tree or a cliff
// casts. A one-block trunk can slip between samples at some corners, and that
// is accepted: its canopy is what throws the shadow that matters.
// Marching stops after SUN_STEPS blocks of rise: nothing in this world is
// taller, and an open march to the top of the volume would triple the cost.
const SUN_DX = 40 / 60, SUN_DZ = 20 / 60;
const SUN_STEPS = 14;
// The sample point starts half a block out along the face normal (inside the
// open cell the face looks into, never inside its own block) and is nudged a
// whisker toward the face centre so a corner that sits exactly on a block
// boundary floors into the cell it belongs to rather than its neighbour.
const SUN_EPS = 0.02;

// AO level (0 = fully cornered … 3 = open) → brightness
const AO_LUT = [0.55, 0.74, 0.87, 1.0];

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000;
}

export class ChunkMesher {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    // every chunk material goes through shade.js: baked sun on all three,
    // wind sway on canopy blocks and cross flora, the wobble + specular on
    // water. See that file for what each costs (nothing per draw call).
    this.solidMat = enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), { sun: true, sway: true });
    this.waterMat = enhance(new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false,
    }), { water: true });
    this.crossMat = enhance(new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide,
    }), { sun: true, sway: true });
    this.texMat = null; // built on first sight of a painted block (see atlas.js)
    this.chunks = new Map(); // key -> {solid, water, cross, tex} (Mesh|null each)
  }

  remeshAll() {
    this.world.markAllDirty();
    this.flush(Infinity);
  }

  // remesh up to `budget` dirty chunks; call per frame
  flush(budget = 2) {
    let n = 0;
    for (const key of this.world.dirty) {
      if (n >= budget) break;
      this.world.dirty.delete(key);
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
      n++;
    }
    return this.world.dirty.size;
  }

  // painted-block material, created only once a block with `tex` is meshed
  _texMaterial() {
    if (!this.texMat) {
      this.texMat = enhance(new THREE.MeshLambertMaterial({ map: atlasTexture(), vertexColors: true }), { sun: true });
    }
    return this.texMat;
  }

  disposeAll() {
    for (const { solid, water, cross, tex } of this.chunks.values()) {
      for (const m of [solid, water, cross, tex]) {
        if (!m) continue;
        this.scene.remove(m);
        m.geometry.dispose();
      }
    }
    this.chunks.clear();
  }

  buildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const prev = this.chunks.get(key);
    if (prev) {
      for (const m of [prev.solid, prev.water, prev.cross, prev.tex]) {
        if (m) { this.scene.remove(m); m.geometry.dispose(); }
      }
    }
    const w = this.world;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;

    const pos = [], col = [], idxArr = [], sunA = [], swayA = [];
    const wpos = [], wcol = [], widx = [];
    const xpos = [], xcol = [], xidx = [], xsun = [], xsway = [];
    const tpos = [], tcol = [], tuv = [], tidx = [], tsun = []; // painted blocks (atlas)

    // occupancy sample for AO: 1 if the cell shadows a corner
    const occ = (x, y, z) => (isOpaque(w.get(x, y, z)) ? 1 : 0);
    // 1 if nothing opaque stands between this point and the sun (see the
    // SUN_* notes above). Bounded by the world volume, so a point under open
    // sky exits in a handful of steps.
    const sunAt = (px, py, pz) => {
      for (let k = 0; k <= SUN_STEPS; k++) {
        const sx = Math.floor(px + SUN_DX * k), sy = Math.floor(py + k), sz = Math.floor(pz + SUN_DZ * k);
        if (sy >= SY) return 1;
        if (isOpaque(w.get(sx, sy, sz))) return 0;
      }
      return 1;
    };

    for (let y = 0; y < SY; y++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          const id = w.get(x, y, z);
          if (id === B.AIR) continue;
          const def = BLOCK_DEFS[id];
          if (!def) continue;

          // low-frequency world tint: light/dark patches across the meadow
          const tn = noise2(x * 0.045, z * 0.045);

          if (def.cross) {
            this.emitCross(x, y, z, def, tn, xpos, xcol, xidx, xsun, xsway, sunAt);
            continue;
          }

          const water = isWater(id);
          // a painted block goes to the atlas pass; everything else is exactly
          // the vertex-coloured path it always was
          const painted = !water && !!def.tex;
          const P = painted ? tpos : water ? wpos : pos;
          const Cc = painted ? tcol : water ? wcol : col;
          const I = painted ? tidx : water ? widx : idxArr;
          // Surface water sits 0.15 below the block top. That drop has to apply
          // to the SIDE faces as well, not just the top face — with sides run
          // to full height the wall stood proud of its own surface and read as
          // a floating lip with a gap under it wherever water met a bank.
          // Submerged water cells keep full height so the column has no seams.
          const wTop = water && !isWater(w.get(x, y + 1, z)) ? 0.85 : 1;

          for (const f of FACES) {
            const nx = x + f.d[0], ny = y + f.d[1], nz = z + f.d[2];
            const nid = w.get(nx, ny, nz);
            if (water) {
              // water: top face under air, side faces against air or
              // walk-through flora (world edge, carved banks, bank reeds) —
              // never between two water cells
              if (f.part === 'bottom') continue;
              if (nid !== B.AIR && !BLOCK_DEFS[nid]?.cross) continue;
            } else if (isOpaque(nid)) {
              continue;
            }
            const base = def[f.part === 'top' ? 'top' : f.part === 'bottom' ? 'bottom' : 'side'] || def.top;
            // cave/cliff rock gets much stronger per-face jitter so big flat
            // walls break up instead of reading as drywall
            const caveRock = id === B.ROCK || id === B.ROCK_DARK;
            let jitter = caveRock
              ? 0.82 + 0.30 * hash3(x, y * 7, z * 13)
              : 0.94 + 0.12 * hash3(x, y * 7, z * 13);
            // birch bark banding: darker rings at hashed heights (same hash on
            // all four sides of a trunk block → a consistent ring)
            if (id === B.WOOD_BIRCH && f.part === 'side') {
              jitter *= hash3(x, y * 3, z) < 0.28 ? 0.78 : 1.0;
            }

            // per-block tint: strong on natural ground/canopy, subtle elsewhere
            let tr = 1, tg = 1, tb = 1;
            if (!water) {
              const strong = id === B.GRASS || id === B.SAND || id === B.SNOWGRASS ||
                id === B.LEAVES || id === B.LEAVES_DARK || id === B.LEAVES_BRIGHT;
              const s = strong ? 0.24 : caveRock ? 0.16 : 0.07;
              const t = 1 + (tn - 0.5) * 2 * s;
              tr = t; tg = t; tb = t;
              if ((id === B.GRASS && f.part === 'top') || id === B.LEAVES ||
                id === B.LEAVES_DARK || id === B.LEAVES_BRIGHT) {
                // warm/dry vs cool/lush hue drift on grass tops and canopies
                tr *= 1 + (tn - 0.5) * 0.22;
                tg *= 1 + (0.5 - tn) * 0.08;
              }
              if (caveRock) {
                // gentle vertical gradient: deeper = darker, so cave interiors
                // shade toward the floor instead of one flat beige
                const vg = 0.72 + 0.28 * Math.min(1, Math.max(0, (y - 4) / 12));
                tr *= vg; tg *= vg; tb *= vg;
              }
              // Wood SIDES barely see the warm sun: what lands on them is the
              // cool hemisphere sky (0xaecdea) and the cool fill (0xbdd2ec),
              // and pale birch bark has too little saturation to survive being
              // multiplied by that — it came out concrete grey at the act 3
              // vista even after the palette itself was warmed. Widening the
              // R over B spread here means the cool light lands on cream
              // rather than on white. Deliberately kept under the point where
              // base × shade × jitter × tint would clip, so nothing blows out.
              // Note B.WOOD is not only trunks: pen fences, granary stilts and
              // box walls, well posts, the log crossing and stumps all use it.
              // That is intended — it is all wood, and it all wants to read
              // warm under the same cold sky.
              if (f.part === 'side' && (id === B.WOOD_BIRCH || id === B.WOOD)) {
                tr *= 1.08; tb *= 0.82;
              }
            }
            // painted faces let the texture carry the hue: the vertex colour
            // is pure light (face shade × jitter × AO), so the same tile reads
            // correctly on every side of the cube
            const r0 = painted ? f.shade * jitter : base[0] * f.shade * jitter * tr;
            const g0 = painted ? f.shade * jitter : base[1] * f.shade * jitter * tg;
            const b0 = painted ? f.shade * jitter : base[2] * f.shade * jitter * tb;
            const uvRect = painted
              ? tileUV(def.tex[f.part] ?? def.tex.side ?? def.tex.top ?? 0)
              : null;

            const vi = P.length / 3;
            let ao = null;
            // wind: canopy blocks breathe a little as a whole; everything else
            // stands still. Per-vertex so the shader needs no block id.
            const leaf = id === B.LEAVES || id === B.LEAVES_DARK || id === B.LEAVES_BRIGHT;
            const swayV = leaf ? 0.35 : 0;
            // foam: a water surface corner hugged by a bank cell at the same
            // level gets a pale rim, so the river meets its shore with an edge
            // instead of a hard colour seam
            let foam = null;
            if (water && f.part === 'top' && wTop < 1) {
              foam = [0, 0, 0, 0];
              for (let ci = 0; ci < 4; ci++) {
                const cnr = f.c[ci];
                const sA = cnr[0] ? 1 : -1, sB = cnr[2] ? 1 : -1;
                foam[ci] = (occ(x + sA, y, z) || occ(x, y, z + sB) || occ(x + sA, y, z + sB)) ? 1 : 0;
              }
            }
            let sun = null;
            if (!water) {
              sun = [0, 0, 0, 0];
              const cxm = x + 0.5, cym = y + 0.5, czm = z + 0.5;
              for (let ci = 0; ci < 4; ci++) {
                const cnr = f.c[ci];
                const px = x + cnr[0], py = y + cnr[1], pz = z + cnr[2];
                sun[ci] = sunAt(
                  px + f.d[0] * 0.5 + (cxm - px) * SUN_EPS,
                  py + f.d[1] * 0.5 + (cym - py) * SUN_EPS,
                  pz + f.d[2] * 0.5 + (czm - pz) * SUN_EPS,
                );
              }
            }
            if (!water) {
              // classic 4-level AO: sample the 3 cells that hug each corner
              // one step out along the face normal
              ao = [0, 0, 0, 0];
              const bx = x + f.d[0], by = y + f.d[1], bz = z + f.d[2];
              const [a1, a2] = f.ax;
              for (let ci = 0; ci < 4; ci++) {
                const cnr = f.c[ci];
                const sA = cnr[a1] ? 1 : -1;
                const sB = cnr[a2] ? 1 : -1;
                const p1 = [bx, by, bz]; p1[a1] += sA;
                const p2 = [bx, by, bz]; p2[a2] += sB;
                const pc = [bx, by, bz]; pc[a1] += sA; pc[a2] += sB;
                const s1 = occ(p1[0], p1[1], p1[2]);
                const s2 = occ(p2[0], p2[1], p2[2]);
                const cc = occ(pc[0], pc[1], pc[2]);
                ao[ci] = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
              }
            }

            for (let ci = 0; ci < 4; ci++) {
              const cnr = f.c[ci];
              const yy = water ? y + cnr[1] * wTop : y + cnr[1];
              P.push(x + cnr[0], yy, z + cnr[2]);
              if (uvRect) {
                const u = cnr[f.uv[0]], v = cnr[f.uv[1]];
                tuv.push(uvRect.u0 + (uvRect.u1 - uvRect.u0) * u,
                  uvRect.v0 + (uvRect.v1 - uvRect.v0) * v);
              }
              if (water) {
                // slight per-vertex shimmer + depth-leaning blue
                const wj = 0.9 + 0.2 * hash3(x * 3 + cnr[0], y, z * 3 + cnr[2]);
                let wr = Math.min(1, base[0] * f.shade * wj * 0.9);
                let wg = Math.min(1, base[1] * f.shade * wj);
                let wb = Math.min(1, base[2] * f.shade * (0.95 + wj * 0.1));
                if (foam && foam[ci]) {
                  wr += (0.78 - wr) * 0.55; wg += (0.86 - wg) * 0.55; wb += (0.86 - wb) * 0.55;
                }
                Cc.push(wr, wg, wb);
              } else {
                const a = AO_LUT[ao[ci]];
                Cc.push(Math.min(1, r0 * a), Math.min(1, g0 * a), Math.min(1, b0 * a));
                if (painted) tsun.push(sun[ci]);
                else { sunA.push(sun[ci]); swayA.push(swayV); }
              }
            }

            // flip the quad diagonal so AO (and the baked shadow edge)
            // interpolates without banding (anisotropy fix: keep the single
            // dark corner off the diagonal)
            if (!water && ao[0] + ao[2] + sun[0] * 2 + sun[2] * 2 < ao[1] + ao[3] + sun[1] * 2 + sun[3] * 2) {
              I.push(vi + 1, vi + 2, vi + 3, vi + 3, vi, vi + 1);
            } else {
              I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            }
          }
        }
      }
    }

    const entry = { solid: null, water: null, cross: null, tex: null };
    if (pos.length) entry.solid = this.makeMesh(pos, col, idxArr, this.solidMat, null, sunA, swayA);
    if (wpos.length) entry.water = this.makeMesh(wpos, wcol, widx, this.waterMat);
    if (xpos.length) entry.cross = this.makeMesh(xpos, xcol, xidx, this.crossMat, null, xsun, xsway);
    if (tpos.length) entry.tex = this.makeMesh(tpos, tcol, tidx, this._texMaterial(), tuv, tsun);
    // the river receives the Rich-tier shadow map but never casts into it
    if (entry.water) entry.water.castShadow = false;
    this.chunks.set(key, entry);
  }

  // two crossed quads with a hash-driven rotation/offset — reads as a tuft,
  // flower or reed instead of a cube. Never occludes neighbours.
  // Quads are TAPERED trapezoids: top verts pull toward the centre by
  // def.crossTaper (default 0.5) so cover reads as tufts, not slabs.
  emitCross(x, y, z, def, tn, P, Cc, I, SunA, SwayA, sunAt) {
    const h1 = hash3(x, 1, z), h2 = hash3(x, 2, z), h3 = hash3(x, 3, z);
    // one sun sample per tuft, from the open cell it stands in: it is under
    // a canopy or it is not
    const sunV = sunAt(x + 0.5, y + 0.5, z + 0.5);
    const cx = x + 0.5 + (h1 - 0.5) * 0.3;
    const cz = z + 0.5 + (h2 - 0.5) * 0.3;
    const ang = h3 * Math.PI;
    const rad = 0.42;
    // stacked flora (2-tall reeds) must join seamlessly: the hash ignores y,
    // so segments share rotation/offset — just run the lower one full-height
    const stacked = this.world.get(x, y + 1, z) !== B.AIR &&
      this.world.get(x, y + 1, z) === this.world.get(x, y, z);
    // nominal height 0.7 (REED overrides via crossH) with hash variance
    // ≈0.5–0.85; a stacked lower segment runs full height with NO taper so
    // its top matches the upper segment's untapered bottom (no seam)
    const baseH = def.crossH ?? 0.7;
    const hgt = stacked ? 1.0 : Math.min(1.0, baseH * (0.72 + h1 * 0.5));
    const topScale = stacked ? 1.0 : 1 - (def.crossTaper ?? 0.5);

    const base = def.top;
    const tint = 1 + (tn - 0.5) * 0.24;
    // stem/base color: darker at the ground so tufts sit into the grass
    const br = Math.min(1, base[0] * 0.72 * tint);
    const bg = Math.min(1, base[1] * 0.72 * tint);
    const bb = Math.min(1, base[2] * 0.72 * tint);
    // plain top color (accent-free flora just brightens toward the tip)
    const pr = Math.min(1, base[0] * 1.06 * tint);
    const pg = Math.min(1, base[1] * 1.06 * tint);
    const pb = Math.min(1, base[2] * 1.06 * tint);

    for (let k = 0; k < 2; k++) {
      const a = ang + k * Math.PI * 0.5;
      const dx = Math.cos(a) * rad, dz = Math.sin(a) * rad;
      const vi = P.length / 3;
      P.push(cx - dx, y, cz - dz);
      P.push(cx + dx, y, cz + dz);
      P.push(cx + dx * topScale, y + hgt, cz + dz * topScale);
      P.push(cx - dx * topScale, y + hgt, cz - dz * topScale);
      // bottom two verts: stem color
      Cc.push(br, bg, bb, br, bg, bb);
      // top two verts: accent gradient (bloom) or flecks (berries); a stacked
      // segment keeps stem color at its top so the joint has no color seam
      for (let t = 0; t < 2; t++) {
        let r = pr, g = pg, b = pb;
        if (stacked) { r = br; g = bg; b = bb; }
        else if (def.accent) {
          const useAccent = def.fleck ? hash3(x + k * 7, 5 + t * 3, z) > 0.55 : true;
          if (useAccent) { r = def.accent[0]; g = def.accent[1]; b = def.accent[2]; }
        }
        Cc.push(Math.min(1, r), Math.min(1, g), Math.min(1, b));
      }
      // roots stay put, tips bend: bottom verts 0, top verts 1 (a stacked
      // lower reed segment keeps its top still so the joint never tears)
      SunA.push(sunV, sunV, sunV, sunV);
      const tip = stacked ? 0 : 1;
      SwayA.push(0, 0, tip, tip);
      // DoubleSide material — one winding is enough
      I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }
  }

  makeMesh(pos, col, idx, mat, uv = null, sun = null, sway = null) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (sun) g.setAttribute('sun', new THREE.Float32BufferAttribute(sun, 1));
    if (sway) g.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = true;
    // flags only; they cost nothing until the renderer turns its shadow map
    // on (engine/renderer.js setRich)
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }
}
