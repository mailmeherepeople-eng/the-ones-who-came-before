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

const { CHUNK, SIZE_Y: SY } = WORLD;

// face: d = normal, c = 4 corners (CCW from outside), ax = the two tangent
// axes (indices into [x,y,z]) used for AO corner sampling.
// uv: [axis for U, axis for V] into the corner triple, so a painted face is
// upright on the sides and reads left-to-right on the top/bottom.
const FACES = [
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, part: 'top', ax: [0, 2], uv: [0, 2] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, part: 'bottom', ax: [0, 2], uv: [0, 2] },
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, part: 'side', ax: [1, 2], uv: [2, 1] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, part: 'side', ax: [1, 2], uv: [2, 1] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.72, part: 'side', ax: [0, 1], uv: [0, 1] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9, part: 'side', ax: [0, 1], uv: [0, 1] },
];

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
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMat = new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false,
    });
    this.crossMat = new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide,
    });
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
      this.texMat = new THREE.MeshLambertMaterial({ map: atlasTexture(), vertexColors: true });
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

    const pos = [], col = [], idxArr = [];
    const wpos = [], wcol = [], widx = [];
    const xpos = [], xcol = [], xidx = [];
    const tpos = [], tcol = [], tuv = [], tidx = []; // painted blocks (atlas)

    // occupancy sample for AO: 1 if the cell shadows a corner
    const occ = (x, y, z) => (isOpaque(w.get(x, y, z)) ? 1 : 0);

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
            this.emitCross(x, y, z, def, tn, xpos, xcol, xidx);
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
                Cc.push(
                  Math.min(1, base[0] * f.shade * wj * 0.9),
                  Math.min(1, base[1] * f.shade * wj),
                  Math.min(1, base[2] * f.shade * (0.95 + wj * 0.1))
                );
              } else {
                const a = AO_LUT[ao[ci]];
                Cc.push(Math.min(1, r0 * a), Math.min(1, g0 * a), Math.min(1, b0 * a));
              }
            }

            // flip the quad diagonal so AO interpolates without banding
            // (anisotropy fix: keep the single dark corner off the diagonal)
            if (!water && ao[0] + ao[2] < ao[1] + ao[3]) {
              I.push(vi + 1, vi + 2, vi + 3, vi + 3, vi, vi + 1);
            } else {
              I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            }
          }
        }
      }
    }

    const entry = { solid: null, water: null, cross: null, tex: null };
    if (pos.length) entry.solid = this.makeMesh(pos, col, idxArr, this.solidMat);
    if (wpos.length) entry.water = this.makeMesh(wpos, wcol, widx, this.waterMat);
    if (xpos.length) entry.cross = this.makeMesh(xpos, xcol, xidx, this.crossMat);
    if (tpos.length) entry.tex = this.makeMesh(tpos, tcol, tidx, this._texMaterial(), tuv);
    this.chunks.set(key, entry);
  }

  // two crossed quads with a hash-driven rotation/offset — reads as a tuft,
  // flower or reed instead of a cube. Never occludes neighbours.
  // Quads are TAPERED trapezoids: top verts pull toward the centre by
  // def.crossTaper (default 0.5) so cover reads as tufts, not slabs.
  emitCross(x, y, z, def, tn, P, Cc, I) {
    const h1 = hash3(x, 1, z), h2 = hash3(x, 2, z), h3 = hash3(x, 3, z);
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
      // DoubleSide material — one winding is enough
      I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }
  }

  makeMesh(pos, col, idx, mat, uv = null) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    return mesh;
  }
}
