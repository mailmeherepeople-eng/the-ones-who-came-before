// Deterministic valley terrain. One valley, one river, a north cliff with a
// rock shelter, plains east, meadow west (design doc §4).
import { WORLD } from '../constants.js';
import { B } from './blocks.js';

const { SIZE_X: SX, SIZE_Z: SZ, SIZE_Y: SY, WATER_LEVEL } = WORLD;

// ---- named sites (single source of truth for act scripts) ----
export const SITES = {
  shelter: { x: 42, z: 14 }, // rock shelter mouth (cave floor inside cliff)
  shelterWall: { x: 42, z: 9 }, // painting wall inside
  campA: { x: 40, z: 24 },
  fire: { x: 40, z: 26 },
  knap: { x: 36, z: 25 },
  grave: { x: 52, z: 30 }, // by the river, near first camp
  berries: [
    { x: 24, z: 44 }, { x: 28, z: 52 }, { x: 22, z: 58 }, { x: 32, z: 62 },
    { x: 26, z: 68 }, { x: 34, z: 48 },
  ],
  shells: [{ x: 56, z: 40 }, { x: 58, z: 52 }, { x: 54, z: 63 }],
  plains: { x: 96, z: 48 }, // herds
  fishSpot: { x: 60, z: 46 },
  village: { x: 76, z: 80 }, // scenes C/D village → act 3 mound
  fields: { x: 66, z: 86 }, // river-side plots
  pen: { x: 84, z: 76 },
  granary: { x: 78, z: 74 },
  kiln: { x: 82, z: 84 },
  playerHut: { x: 72, z: 76 },
  farField: { x: 64, z: 94 }, // chieftain water task
  neighbour: { x: 108, z: 112 }, // delivery village
  camp2: { x: 36, z: 96 }, // band's second camp after the move
  modernVillage: { x: 24, z: 106 }, // act 3 present-day village
  fossilCliff: { x: 102, z: 12 }, // exposed rock face — well east of the river (riverX max ≈ 77)
  digCamp: { x: 66, z: 92 }, // act 3 excavation base camp
};

// ---- tiny deterministic value noise ----
function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 1024) / 1024;
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// river centre x for a given z
export function riverX(z) {
  return 60 + 14 * Math.sin(z / SZ * Math.PI * 1.35 + 0.9) + 3 * noise2(z * 0.07, 3.7);
}

export function groundHeight(x, z) {
  const n = noise2(x * 0.06, z * 0.06) * 2.2 + noise2(x * 0.16, z * 0.16) * 1.1;
  let h = 7.5 + n;
  // valley dip toward the river
  const dr = Math.abs(x - riverX(z));
  h -= Math.max(0, 3.2 - dr * 0.35);
  // edge hills
  const ex = Math.min(x, SX - 1 - x), ez = SZ - 1 - z;
  if (ex < 10) h += (10 - ex) * 0.55;
  if (ez < 10) h += (10 - ez) * 0.5;
  // north cliff
  if (z < 18) h += (18 - z) * 1.15;
  return Math.max(2, Math.min(SY - 4, Math.round(h)));
}

/**
 * Build the base valley into `world`.
 * opts: { ice: bool, riverWidth: number (blocks half-width), lush: 0..1 }
 */
export function buildBase(world, opts = {}) {
  const { ice = false, riverWidth = 2.4, lush = 0.5 } = opts;
  world.data.fill(B.AIR);

  for (let z = 0; z < SZ; z++) {
    const rx = riverX(z);
    for (let x = 0; x < SX; x++) {
      const dr = Math.abs(x - rx);
      const inRiver = dr < riverWidth + noise2(x * 0.2, z * 0.2) * 0.8;
      let h = groundHeight(x, z);
      if (inRiver) h = Math.min(h, WATER_LEVEL - 2 + (dr > riverWidth * 0.6 ? 1 : 0));
      // banks stay climbable: ≤1 block above water at the edge, ≤2 one step
      // back — the whole river stretch must be exitable (except the north
      // cliff gorge, which is fenced by the cliff itself)
      if (!inRiver && z >= 13) {
        if (dr < riverWidth + 2.5) h = Math.min(h, WATER_LEVEL + 1);
        else if (dr < riverWidth + 4.5) h = Math.min(h, WATER_LEVEL + 2);
      }

      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y === h) {
          if (inRiver) id = B.SAND;
          else if (h >= 15) id = B.ROCK;
          else if (ice && z < 22) id = B.SNOWGRASS;
          else if (dr < riverWidth + 2.5) id = B.SAND;
          else id = B.GRASS;
        } else if (y >= h - 2) {
          id = h >= 15 ? B.ROCK : B.DIRT;
        }
        world.setRaw(x, y, z, id);
      }
      // water fill
      if (inRiver) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) world.setRaw(x, y, z, B.WATER);
        if (ice && z < 26) world.setRaw(x, WATER_LEVEL, z, B.ICE);
      }
      // ice sheet at the far north during the cold scenes
      if (ice && z < 7) {
        const hh = inRiver ? WATER_LEVEL : groundHeight(x, z);
        const thick = 2 + Math.round((7 - z) * 0.8);
        for (let y = hh + 1; y <= Math.min(SY - 2, hh + thick); y++) world.setRaw(x, y, z, B.ICE);
      }
    }
  }

  carveShelter(world);
  carveFossilCliff(world);
  scatterVegetation(world, lush, ice);
}

// set a column's surface to exactly h: clear above, fill below
function setSurface(world, x, z, h, topBlock = B.GRASS, fillBlock = B.DIRT) {
  for (let y = h + 1; y < SY; y++) world.setRaw(x, y, z, B.AIR);
  for (let y = Math.max(0, h - 3); y < h; y++) {
    if (world.get(x, y, z) === B.AIR) world.setRaw(x, y, z, fillBlock);
  }
  world.setRaw(x, h, z, topBlock);
}

function carveShelter(world) {
  const { x: sx } = SITES.shelter;
  const floorY = 9;
  // graded approach from the camp (z=24, natural h≈8–11) up to the mouth
  // (z=17) — every step ≤1 block so it is walkable both ways
  for (let z = 17; z <= 24; z++) {
    const h = Math.round(floorY + Math.max(0, (z - 19)) * 0.35) - (z >= 22 ? 1 : 0);
    for (let x = sx - 3; x <= sx + 3; x++) {
      setSurface(world, x, z, Math.max(8, Math.min(h, floorY)), z <= 18 ? B.ROCK : B.PATH, B.DIRT);
    }
  }
  // interior: flat rock floor, headroom carved into the cliff
  const ceilAt = (xx, zz) => {
    const w = Math.abs(xx - sx);
    const depth = 16 - zz;
    return floorY + 4 - Math.floor(depth * 0.2) - Math.floor(w * 0.3);
  };
  for (let z = 8; z <= 16; z++) {
    for (let x = sx - 4; x <= sx + 4; x++) {
      const ceil = ceilAt(x, z);
      for (let y = floorY + 1; y <= ceil; y++) world.setRaw(x, y, z, B.AIR);
      world.setRaw(x, floorY, z, B.ROCK);
      for (let y = floorY - 2; y < floorY; y++) world.setRaw(x, y, z, B.ROCK);
    }
  }

  // ---- cave dressing (visual only; the corridor x∈[sx-3,sx+3] stays clear) ----
  // dim rock shell: replace existing rock in place around the cavity so the
  // interior reads dark. Walls / ceiling / back wall only, never new volume.
  const darken = (x, y, z) => {
    if (world.get(x, y, z) === B.ROCK) world.setRaw(x, y, z, B.ROCK_DARK);
  };
  for (let z = 8; z <= 15; z++) {
    const ceil = ceilAt(sx, z);
    // ceiling above the cavity (deeper in → darker rim kept off the mouth)
    for (let x = sx - 4; x <= sx + 4; x++) darken(x, ceilAt(x, z) + 1, z);
    // side walls flanking the cavity
    for (let y = floorY; y <= ceil + 1; y++) {
      darken(sx - 5, y, z);
      darken(sx + 5, y, z);
    }
  }
  // back wall (behind the painting wall at z=9 — carve stops at z=8)
  for (let x = sx - 4; x <= sx + 4; x++) {
    for (let y = floorY; y <= ceilAt(x, 8) + 1; y++) darken(x, y, 7);
  }
  // dim rock floor deep inside so the cave darkens toward the back
  for (let z = 8; z <= 12; z++) {
    for (let x = sx - 4; x <= sx + 4; x++) {
      if (world.get(x, floorY, z) === B.ROCK) world.setRaw(x, floorY, z, B.ROCK_DARK);
    }
  }
  // mouth teeth: stalactite stubs on the ceiling edge and 1-block stalagmites
  // at the flanks — strictly at |x-sx| = 4, outside the walkable corridor
  for (const tx of [sx - 4, sx + 4]) {
    const mz = 16;
    const ceil = ceilAt(tx, mz);
    if (world.get(tx, ceil, mz) === B.AIR) world.setRaw(tx, ceil, mz, B.ROCK); // stalactite stub
    if (hash2(tx, mz) > 0.4 && world.get(tx, floorY + 1, mz) === B.AIR) {
      world.setRaw(tx, floorY + 1, mz, B.ROCK); // stalagmite at the jamb
    }
  }
  // a couple more hanging stubs one step in, still on the flanks
  for (const [tx, tz] of [[sx - 4, 14], [sx + 4, 13]]) {
    const ceil = ceilAt(tx, tz);
    if (world.get(tx, ceil, tz) === B.AIR) world.setRaw(tx, ceil, tz, B.ROCK_DARK);
  }
  // rubble along the interior walls (1-block, flanks only)
  for (const [tx, tz] of [[sx - 4, 11], [sx + 4, 12], [sx - 4, 9]]) {
    if (world.get(tx, floorY + 1, tz) === B.AIR) world.setRaw(tx, floorY + 1, tz, B.ROCK_DARK);
  }
  // ceiling roughening: hang 1-block ROCK_DARK noses at hashed spots — CEILING
  // only, and only where ≥3 air blocks remain underneath, so the walkable
  // floor and the corridor x∈[sx-3,sx+3] are never pinched below headroom
  for (let z = 9; z <= 15; z++) {
    for (let x = sx - 4; x <= sx + 4; x++) {
      const ceil = ceilAt(x, z);
      if (ceil - floorY < 4) continue; // keep ≥3 blocks of headroom under the nose
      if (hash2(x * 7 + 3, z * 11 + 5) < 0.72) continue;
      if (world.get(x, ceil, z) === B.AIR) world.setRaw(x, ceil, z, B.ROCK_DARK);
    }
  }
}

function carveFossilCliff(world) {
  const { x: fx, z: fz } = SITES.fossilCliff;
  // banded reading face at z=fz, approach plateau to the south with graded steps
  for (let x = fx - 5; x <= fx + 5; x++) {
    for (let y = 6; y <= 16; y++) {
      world.setRaw(x, y, fz - 1, B.ROCK);
      // sedimentary strata — distinct bands with a gentle per-column wobble
      // so "layers = time" reads at a glance
      const wob = Math.round(noise2(x * 0.35, 4.2) * 1.4 - 0.7);
      const yb = y + wob;
      let band;
      if (yb <= 8) band = B.STRATA_A;
      else if (yb <= 11) band = B.STRATA_B;
      else if (yb <= 13) band = B.STRATA_C;
      else band = B.STRATA_D;
      world.setRaw(x, y, fz, band);
    }
    for (let y = 17; y < SY; y++) world.setRaw(x, y, fz, B.AIR);
    // approach: viewing floor y=9 at the face, blending ≤1-block steps into
    // the natural terrain south of the cliff band (z ≥ 18 has no cliff term)
    const natural = groundHeight(x, fz + 8);
    for (let z = fz + 1; z <= fz + 7; z++) {
      const t = Math.max(0, (z - (fz + 3)) / 4);
      const floor = Math.round(9 + (natural - 9) * Math.min(1, t));
      setSurface(world, x, z, floor, B.GRASS, B.DIRT);
    }
  }
}

// ---- vegetation ----------------------------------------------------------

// solid flora (trees, logs, bush blobs) keeps well clear of the river so the
// hand-verified bank walkability is untouched; deco flora may go anywhere.
const SOLID_RIVER_CLEARANCE = 10;

// keep deco flora out of interaction / dig spots so prompts and pits stay clean
function nearPropSpot(x, z) {
  for (const s of [SITES.fire, SITES.knap, SITES.grave, SITES.shelterWall, ...SITES.shells]) {
    if (Math.abs(x - s.x) <= 2 && Math.abs(z - s.z) <= 2) return true;
  }
  return false;
}

// drop a cover tuft NEAR (x, z): a hash jitter shifts it up to 1 cell so
// cover never lines up in rows along terrace lips or hash-aligned cells
// (1-block bank ledges otherwise collect tufts along their constant-z lip).
// Falls back to the original cell when the jittered one is unsuitable; the
// jittered cell must carry the same top block so zone edges stay clean.
function placeCoverJittered(world, x, z, id) {
  const jx = Math.floor(hash2(x * 5 + 113, z * 9 + 67) * 3) - 1;
  const jz = Math.floor(hash2(x * 9 + 59, z * 5 + 131) * 3) - 1;
  const wantTop = world.get(x, world.topAt(x, z), z);
  for (const [tx, tz] of [[x + jx, z + jz], [x, z]]) {
    if (tx < 0 || tx >= SX || tz < 0 || tz >= SZ) continue;
    const h = world.topAt(tx, tz);
    if (h < WATER_LEVEL) continue;
    if (world.get(tx, h, tz) !== wantTop) continue;
    if (world.get(tx, h + 1, tz) !== B.AIR) continue;
    if (nearPropSpot(tx, tz)) continue;
    world.setRaw(tx, h + 1, tz, id);
    return;
  }
}

function grassTopAt(world, x, z) {
  const h = world.topAt(x, z);
  if (h < WATER_LEVEL) return -1;
  if (world.get(x, h, z) !== B.GRASS) return -1;
  if (world.get(x, h + 1, z) !== B.AIR) return -1;
  return h;
}

function scatterVegetation(world, lush, ice) {
  // ---- tunables (review round: cover density / clustering / tree spacing) ----
  const COVER_FREQ = 0.09;     // low-freq drift-noise frequency for ground cover
  const COVER_GATE = 0.56;     // noise2 above this = inside a drift (~40% of ground)
  const SNOWTUFT_IN = 0.10;    // in-drift densities; overall ≈ density × drift area
  const DEADBUSH_IN = 0.04;    //   → all ground cover lands at ~4–6% of cells
  //   (cold-scene budget is deliberately lean: act1's dressSceneACold adds
  //    its own un-gated scatter over the camp basin on top of this)
  const TALLGRASS_IN = 0.13;
  const FERN_KEEP = 0.42;      // fraction of under-canopy cells that get a fern
  const TREE_SPACING = 3;      // min blocks between any two trunks (trees AND snags)

  const trees = [];
  const trunks = []; // every placed trunk (incl. snags) for the spacing check

  // trees (solid — keep off the banks and away from sites)
  for (let i = 0; i < 90 * (0.5 + lush); i++) {
    // hash-jittered placement so failed spacing checks don't leave rows
    let x = Math.floor(hash2(i, 11) * SX) + Math.floor(hash2(i, 71) * 3) - 1;
    let z = Math.floor(hash2(i, 29) * SZ) + Math.floor(hash2(i, 83) * 3) - 1;
    x = Math.max(0, Math.min(SX - 1, x));
    z = Math.max(0, Math.min(SZ - 1, z));
    if (z < 24 && ice) continue;
    if (z < 20) continue;
    if (Math.abs(x - riverX(z)) < SOLID_RIVER_CLEARANCE) continue;
    if (nearSite(x, z, 8)) continue;
    // never let two trunks (oak/birch/snag) spawn flush against each other
    if (trunks.some((t) => Math.abs(t.x - x) < TREE_SPACING && Math.abs(t.z - z) < TREE_SPACING)) continue;
    const h = world.topAt(x, z);
    if (h < WATER_LEVEL || world.get(x, h, z) !== B.GRASS) continue;
    if (ice && hash2(i, 61) < 0.8) {
      placeSnag(world, x, h + 1, z, 3 + Math.floor(hash2(i, 47) * 2));
    } else {
      placeTree(world, x, h + 1, z, 3 + Math.floor(hash2(i, 47) * 2));
      trees.push({ x, z });
    }
    trunks.push({ x, z });
  }

  // stumps and fallen logs (solid — same clearances as trees)
  if (!ice) {
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(hash2(i * 3 + 501, 17) * SX), z = Math.floor(hash2(i * 5 + 503, 37) * SZ);
      if (z < 22) continue;
      if (nearSite(x, z, 8)) continue;
      const h = grassTopAt(world, x, z);
      if (h < 0) continue;
      const r = hash2(x, z * 3 + 7);
      if (r < 0.55) {
        // stump
        if (Math.abs(x - riverX(z)) < SOLID_RIVER_CLEARANCE) continue;
        world.setRaw(x, h + 1, z, B.WOOD);
      } else {
        // fallen log, 3 long, on level grass only
        const alongX = r > 0.77;
        let ok = true;
        for (let k = 0; k < 3; k++) {
          const lx = x + (alongX ? k : 0), lz = z + (alongX ? 0 : k);
          if (Math.abs(lx - riverX(lz)) < SOLID_RIVER_CLEARANCE) { ok = false; break; }
          if (grassTopAt(world, lx, lz) !== h) { ok = false; break; }
        }
        if (!ok) continue;
        for (let k = 0; k < 3; k++) {
          const lx = x + (alongX ? k : 0), lz = z + (alongX ? 0 : k);
          world.setRaw(lx, h + 1, lz, B.WOOD);
        }
      }
    }

    // leafy bush blobs: rounded BUSH clusters + berry cross-tufts at the skirt
    for (let i = 0; i < 14 * (0.5 + lush); i++) {
      const x = Math.floor(hash2(i * 7 + 901, 23) * SX), z = Math.floor(hash2(i * 11 + 907, 41) * SZ);
      if (z < 22) continue;
      if (Math.abs(x - riverX(z)) < SOLID_RIVER_CLEARANCE) continue;
      if (nearSite(x, z, 8)) continue;
      const h = grassTopAt(world, x, z);
      if (h < 0) continue;
      world.setRaw(x, h + 1, z, B.BUSH);
      // 1–2 side lobes on level ground, one cap on top
      const side = hash2(x, z * 7) > 0.5 ? 1 : -1;
      if (grassTopAt(world, x + side, z) === h &&
        Math.abs(x + side - riverX(z)) >= SOLID_RIVER_CLEARANCE) {
        world.setRaw(x + side, h + 1, z, B.BUSH);
      }
      if (hash2(x * 3, z) > 0.45) world.setRaw(x, h + 2, z, B.BUSH);
      // berry tufts lean against the blob (walk-through)
      for (const [dx, dz] of [[0, 1], [0, -1], [-side, 0]]) {
        if (hash2(x + dx * 5, z + dz * 9) > 0.5 && grassTopAt(world, x + dx, z + dz) === h) {
          world.setRaw(x + dx, h + 1, z + dz, B.SHRUB_BERRY);
        }
      }
    }
  }

  // ground cover (all walk-through cross flora — safe anywhere on grass)
  for (let z = 0; z < SZ; z++) {
    for (let x = 0; x < SX; x++) {
      const h = world.topAt(x, z);
      if (h < WATER_LEVEL) continue;
      const top = world.get(x, h, z);
      if (world.get(x, h + 1, z) !== B.AIR) continue;
      if (nearPropSpot(x, z)) continue;
      const rnd = hash2(x * 3 + 17, z * 5 + 31);
      // low-frequency drift gate: cover clumps into natural drifts with open
      // ground between them instead of even confetti everywhere
      const drift = noise2(x * COVER_FREQ + 40.2, z * COVER_FREQ + 13.6) > COVER_GATE;
      if (top === B.SNOWGRASS) {
        if (!drift) continue;
        if (rnd < SNOWTUFT_IN) placeCoverJittered(world, x, z, B.SNOWTUFT);
        else if (rnd < SNOWTUFT_IN + 0.03) placeCoverJittered(world, x, z, B.DEADBUSH);
        continue;
      }
      if (top !== B.GRASS) continue;
      if (ice) {
        // cold, thin cover: dead bushes and sparse dry tufts, drifts only
        if (!drift) continue;
        if (rnd < DEADBUSH_IN) placeCoverJittered(world, x, z, B.DEADBUSH);
        else if (rnd < DEADBUSH_IN + 0.06) placeCoverJittered(world, x, z, B.TALLGRASS);
        else if (z < 30 && rnd < DEADBUSH_IN + 0.10) placeCoverJittered(world, x, z, B.SNOWTUFT);
        continue;
      }
      // clustered flower patches, then drift-gated meadow grass
      const fp = noise2(x * 0.085 + 21.3, z * 0.085 + 7.7);
      if (fp > 0.72 && rnd < 0.4) {
        const pick = noise2(x * 0.03 + 55.1, z * 0.03 + 9.4);
        const f = pick < 0.36 ? B.FLOWER_RED : pick < 0.66 ? B.FLOWER_YELLOW : B.FLOWER_WHITE;
        placeCoverJittered(world, x, z, f);
      } else if (drift && rnd < TALLGRASS_IN * (0.7 + lush * 0.6)) {
        placeCoverJittered(world, x, z, B.TALLGRASS);
      }
    }
  }

  // ferns pool in the shade under and around trees
  for (const t of trees) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (hash2(t.x + dx * 13, t.z + dz * 17) > FERN_KEEP) continue;
        const h = grassTopAt(world, t.x + dx, t.z + dz);
        if (h >= 0) world.setRaw(t.x + dx, h + 1, t.z + dz, B.FERN);
      }
    }
  }

  // reeds along banks: 1–2 tall clusters (walk-through — never wall the bank)
  for (let z = 20; z < SZ; z++) {
    const rx = riverX(z);
    for (const dx of [-5, -4, -3, 3, 4, 5]) {
      const x = Math.round(rx + dx + noise2(z * 0.3, 1) * 2);
      if (hash2(x, z) < 0.62) continue;
      const h = world.topAt(x, z);
      if (h < WATER_LEVEL - 1 || h > WATER_LEVEL + 1) continue;
      const top = world.get(x, h, z);
      if (top !== B.SAND && top !== B.GRASS) continue;
      if (world.get(x, h + 1, z) !== B.AIR) continue;
      world.setRaw(x, h + 1, z, B.REED);
      if (hash2(x * 3, z * 5) > 0.5 && world.get(x, h + 2, z) === B.AIR) {
        world.setRaw(x, h + 2, z, B.REED);
      }
    }
  }
}

// ---- trees ----------------------------------------------------------------

// leaf placement never eats terrain or structures — air cells only
function leaf(world, x, y, z, id) {
  if (world.get(x, y, z) === B.AIR) world.setRaw(x, y, z, id);
}

function pickLeafTint(x, z) {
  const t = hash2(x * 9 + 3, z * 9 + 5);
  return t < 0.33 ? B.LEAVES_DARK : t < 0.72 ? B.LEAVES : B.LEAVES_BRIGHT;
}

/**
 * Place a tree at (x, y, z) — y is the first trunk block. Signature is stable;
 * the variant (oak / birch / acacia / rare snag) is a deterministic hash of
 * position, so saved worlds rebuild identically.
 */
export function placeTree(world, x, y, z, trunk = 3) {
  const v = hash2(x * 5 + 1, z * 7 + 2);
  if (v < 0.5) placeOak(world, x, y, z, trunk);
  else if (v < 0.72) placeBirch(world, x, y, z, trunk);
  else if (v < 0.94) placeAcacia(world, x, y, z, trunk);
  else placeSnag(world, x, y, z, trunk);
}

// rounded canopy: 5x5 skirt with corners knocked out, 3x3 above, capped
function placeOak(world, x, y, z, trunk) {
  const tint = pickLeafTint(x, z);
  for (let i = 0; i < trunk; i++) world.setRaw(x, y + i, z, B.WOOD);
  const ty = y + trunk;
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // knock corners
        // ragged rim: drop a few edge leaves on the lower skirt
        if (dy === 0 && Math.abs(dx) + Math.abs(dz) >= 3 && hash2(x + dx * 3, z + dz * 5) > 0.72) continue;
        leaf(world, x + dx, ty - 1 + dy, z + dz, tint);
      }
    }
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && hash2(x + dx, z + dz * 3) > 0.6) continue;
      leaf(world, x + dx, ty + 1, z + dz, tint);
    }
  }
  leaf(world, x, ty + 2, z, tint);
  world.setRaw(x, ty - 1, z, B.WOOD); // trunk continues into the canopy
}

// taller, pale trunk, slim bright crown
function placeBirch(world, x, y, z, trunk) {
  const h = trunk + 2;
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD_BIRCH);
  const ty = y + h;
  const tint = hash2(x, z * 11) < 0.5 ? B.LEAVES_BRIGHT : B.LEAVES;
  for (let dy = -2; dy <= 0; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && (dy === -2 || hash2(x + dx * 7, z + dz) > 0.55)) continue;
        leaf(world, x + dx, ty + dy, z + dz, tint);
      }
    }
  }
  leaf(world, x, ty + 1, z, tint);
}

// wide, flat-topped canopy on a shortish trunk
function placeAcacia(world, x, y, z, trunk) {
  const h = trunk + 1;
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD);
  const ty = y + h;
  const tint = B.LEAVES_DARK;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      leaf(world, x + dx, ty, z + dz, tint);
    }
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 1) continue;
      leaf(world, x + dx, ty + 1, z + dz, tint);
    }
  }
}

// dead snag: bare weathered trunk, one stub branch, no canopy
function placeSnag(world, x, y, z, trunk) {
  const h = trunk + 1;
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD);
  const side = hash2(x, z) > 0.5 ? 1 : -1;
  leaf(world, x + side, y + h - 2, z, B.WOOD);
}

function nearSite(x, z, r) {
  for (const key of ['shelter', 'campA', 'village', 'fields', 'pen', 'granary', 'kiln', 'playerHut', 'neighbour', 'camp2', 'modernVillage', 'digCamp', 'fossilCliff']) {
    const s = SITES[key];
    if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r) return true;
  }
  return false;
}
