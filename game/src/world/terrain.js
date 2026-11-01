// Deterministic valley terrain. One valley, one river, a north cliff with a
// rock shelter, plains east, meadow west (design doc §4).
import { WORLD } from '../constants.js';
import { B, isOpaque, isSolid, isCross } from './blocks.js';

const { SIZE_X: SX, SIZE_Z: SZ, SIZE_Y: SY, WATER_LEVEL } = WORLD;

// ---- named sites (single source of truth for act scripts) ----
export const SITES = {
  trainingStart: { x: 12, z: 8, y: 10.02 },
  trainingLight: { x: 14, z: 14, y: 10.04 },
  trainingJump: { x: 22, z: 14, y: 10.04 },
  trainingBasket: { x: 27, z: 17, y: 10.04 },
  trainingExit: { x: 27, z: 27 },
  eastGrove: { x: 143, z: 76 },
  southMeadow: { x: 97, z: 143 },
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
  // three shells along the river, near, middle and far (2026-11-01: "spread
  // things out ... same with the deer, the shells")
  shells: [{ x: 67, z: 44 }, { x: 52, z: 112 }, { x: 64, z: 178 }],
  plains: { x: 96, z: 48 }, // herds
  // the archer's mark at the training post (games/range.js). Its lanes run
  // east over flat ground (height 10 from x 84 to 116, z 34 to 39)
  trainingPost: { x: 84, z: 36 },
  // the band's task hide, beside the store box (acts/sceneA.js, ui/taskboard.js)
  taskHide: { x: 48, z: 21 },
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
  timelineHomes: { x: 89, z: 49 }, // visible in the portrait sky camera, away from the old mound
  timelineMarket: { x: 86, z: 65 },
  timelineFields: { x: 95, z: 83 },
  // the land beyond the old valley (2026-11-01: "more to explore + room to hunt.
  // give some place for kids to roam around"). Shapes in NEW_LAND below.
  grassland: { x: 176, z: 70 },     // open, gently rolling: room to stalk a herd
  lookoutHill: { x: 204, z: 38 },   // the high point, a view over the whole valley
  paintedRocks: { x: 202, z: 98 },  // before the big west shelter of the Painted Rocks (ROCK_SHELTERS)
  lake: { x: 190, z: 192 },
  salForest: { x: 80, z: 192 },
};

// The new land's shapes. None of it reaches the old valley (x and z under
// WORLD.CORE_SIZE), whose heights regression.mjs locks.
export const NEW_LAND = {
  grass: { x0: 150, x1: 198, z0: 26, z1: 150 },
  lookout: { x: 204, z: 38, r: 19, rise: 11 },
  rocks: { x0: 186, x1: 219, z0: 74, z1: 124 },
  lake: { x: 190, z: 192, rx: 23, rz: 17 },
  // the sal stand: an ellipse with a ragged edge (forestCore), thinning to
  // scattered young trees outside it
  forest: { x: 78, z: 193, rx: 62, rz: 25 },
};

// The bear's den (carveBearDen): a standable cell in the chamber, and the
// standable cell just outside the mouth, which looks south-west at the trail
// from the plains to the grassland. y is the standing height inside.
SITES.bearCave = { x: 151, z: 41, y: groundHeight(151, 41) + 1 };
SITES.bearCaveMouth = { x: 146, z: 46 };

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
  return 60 + 14 * Math.sin(z / WORLD.CORE_SIZE * Math.PI * 1.35 + 0.9) + 3 * noise2(z * 0.07, 3.7);
}

export function groundHeight(x, z) {
  const n = noise2(x * 0.06, z * 0.06) * 2.2 + noise2(x * 0.16, z * 0.16) * 1.1;
  let h = 7.5 + n;
  // valley dip toward the river
  const dr = Math.abs(x - riverX(z));
  h -= Math.max(0, 3.2 - dr * 0.35);
  // edge hills, at the world's outer edge only (west, east, south; the north
  // is the cliff). The old valley's own east and south ridges, where the world
  // used to end at 128, are gone (2026-11-01: "there is an unnecessary ridge
  // where the old boundary used to be. that needs to go"), so the valley runs
  // straight on into the new land.
  const core = WORLD.CORE_SIZE;
  const ex = Math.min(x, SX - 1 - x), ez = SZ - 1 - z;
  if (ex < 10) h += (10 - ex) * 0.55;
  if (ez < 10) h += (10 - ez) * 0.5;
  // north cliff
  if (z < 18) h += (18 - z) * 1.15;
  if (x >= core || z >= core) h += newLandRise(x, z, n);
  // the two southern corners: the edge ridges meet as the taller of the two,
  // not their sum, which stood up as a stepped pyramid
  if (ex < 10 && ez < 10) h -= Math.min((10 - ex) * 0.55, (10 - ez) * 0.5);
  return Math.max(2, Math.min(SY - 4, Math.round(h)));
}

// soft membership in a rectangle: 1 inside, easing to 0 over `edge` blocks
function inRect(x, z, r, edge = 8) {
  const d = Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1);
  return d <= 0 ? 1 : d >= edge ? 0 : 1 - smooth(d / edge);
}
// what the new land adds to the base height (never the old valley)
function newLandRise(x, z, n) {
  let dh = 0;
  // the grassland rolls gently: most of the noise taken out
  dh -= (n - 1.6) * 0.75 * inRect(x, z, NEW_LAND.grass);
  // Lookout Hill: a broad cone, about one block of rise per block or less
  const L = NEW_LAND.lookout, dl = Math.hypot(x - L.x, z - L.z);
  if (dl < L.r) dh += L.rise * smooth(1 - dl / L.r);
  // the Painted Rocks stand on a low sandstone shelf
  dh += 1.6 * inRect(x, z, NEW_LAND.rocks, 6);
  return dh;
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
        // the cold scenes: thin shelves of shore ice along the edges, never
        // the whole river (2026-10-28: "even though it is ice age, there is
        // still water in the river"). The middle runs from Act 1 on.
        if (ice && z < 26 && dr > riverWidth * 0.55 && hash2(x * 3 + 1, z * 7 + 2) < 0.6) world.setRaw(x, WATER_LEVEL, z, B.ICE);
      }
      // ice sheet at the far north during the cold scenes
      if (ice && z < 7) {
        const hh = inRiver ? WATER_LEVEL : groundHeight(x, z);
        const thick = 2 + Math.round((7 - z) * 0.8);
        for (let y = hh + 1; y <= Math.min(SY - 2, hh + thick); y++) world.setRaw(x, y, z, B.ICE);
      }
    }
  }

  carveLake(world, ice);
  carveShelter(world);
  carveFossilCliff(world);
  carveWaterfall(world);
  scatterVegetation(world, lush, ice);
  carveTrainingCave(world, ice);
  raisePaintedRocks(world, ice);
  carveBearDen(world, ice);
  layTrails(world);
  plantSalForest(world, ice);
  dressOutlands(world, lush, ice);
  collectWaterEdges(world);
}

// ---- the lake (south-east) -----------------------------------------------------
// A wide, shallow lake with sand shores that step up one block at a time, so
// every edge can be walked in and out of. In the ice age a shelf of ice rims
// it and the middle stays open, like the river.
function carveLake(world, ice) {
  const K = NEW_LAND.lake;
  for (let z = K.z - K.rz * 2; z <= K.z + K.rz * 2; z++) {
    for (let x = K.x - K.rx * 2; x <= K.x + K.rx * 2; x++) {
      if (x < 0 || x >= SX || z < 0 || z >= SZ) continue;
      const wob = (noise2(x * 0.15 + 3.1, z * 0.15 + 8.4) - 0.5) * 0.25;
      const e = ((x - K.x) / K.rx) ** 2 + ((z - K.z) / K.rz) ** 2 + wob;
      const h0 = world.topAt(x, z);
      if (e < 1) {
        const bed = WATER_LEVEL - (e < 0.55 ? 3 : 2);
        for (let y = 0; y < SY; y++) {
          world.setRaw(x, y, z, y < bed - 2 ? B.STONE : y < bed ? B.DIRT : y === bed ? B.SAND : y <= WATER_LEVEL ? B.WATER : B.AIR);
        }
        if (ice && e > 0.5 && hash2(x * 5 + 3, z * 3 + 1) < 0.85) world.setRaw(x, WATER_LEVEL, z, B.ICE);
      } else if (e < 1.9) {
        // the shore: at most one block above the water at the edge, then one
        // more block per step outward, never above the land around it
        const cap = WATER_LEVEL + 1 + Math.floor((e - 1) * 5);
        if (h0 > cap) setSurface(world, x, z, cap, e < 1.35 ? B.SAND : B.GRASS, B.DIRT);
      }
    }
  }
}

// ---- bedded sandstone: the Painted Rocks, outcrops, the bear's knoll ----------
// Sandstone weathers along its beds: horizontal layers one to three blocks
// thick, each a little offset from the one below. Where a soft bed wears back
// under a hard one the upper bed juts out, and that is an overhang, a mushroom
// rock or a rock shelter (Bhimbetka). A tor is a stack of such beds; T.prof(h,
// H) is a bed's width (1 = full) at h blocks over the base. Every cell it lays
// goes into `cells` (index -> bed number) so paintBeds can colour it after the
// shelters are cut.
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function raiseTor(world, T, cells) {
  const top = Math.min(22, T.base + T.H);
  for (let y = T.base, k = 0; y <= top; k++) {
    const y1 = Math.min(top, y + Math.floor(hash2(T.seed + k * 7, 31) * 3));
    const f = T.prof((y + y1) / 2 - T.base, top - T.base) * (0.92 + hash2(T.seed + k * 5, 37) * 0.16);
    const ox = k ? (hash2(T.seed + k * 11, 41) - 0.5) * 3.2 : 0, oz = k ? (hash2(T.seed + k * 13, 43) - 0.5) * 3.2 : 0;
    const ax = T.rx * f, az = T.rz * f;
    for (let dz = -Math.ceil(az + 2); dz <= az + 2; dz++) for (let dx = -Math.ceil(ax + 2); dx <= ax + 2; dx++) {
      const u = Math.abs(dx - ox) / ax, v = Math.abs(dz - oz) / az;
      const X = T.x + dx, Z = T.z + dz;
      if ((u ** 2.6 + v ** 2.6) ** (1 / 2.6) + (noise2(X * 0.4 + T.seed, Z * 0.4 + y * 0.9) - 0.5) * 0.35 >= 1) continue;
      // the lowest bed is seated on the ground wherever the ground is lower
      const from = k ? y : Math.min(y, world.topAt(X, Z) + 1);
      for (let yy = from; yy <= y1; yy++) { world.setRaw(X, yy, Z, B.ROCK); cells.set(world.idx(X, yy, Z), k); }
    }
    y = y1 + 1;
  }
}
// colour by orientation: pale weathered tops, beds alternating rose and buff
// on the faces (so the layers read), dark undersides and the odd dark streak
// where water runs down a face
function paintBeds(world, cells, P) {
  for (const [i, k] of cells) {
    const x = i % SX, z = Math.floor(i / SX) % SZ, y = Math.floor(i / (SX * SZ));
    if (!isOpaque(world.get(x, y, z))) continue;
    let id;
    if (!isOpaque(world.get(x, y + 1, z))) id = P.top;
    else if (!isOpaque(world.get(x, y - 1, z))) id = P.under;
    else id = hash2(x * 7 + z * 3, 17) < 0.07 ? P.under : P.faces[k % 2];
    world.setRaw(x, y, z, id);
  }
}
// a walk-in shelter cut into a tor's side under its jutting upper beds: a flat
// floor at ground level, `h` of headroom, `d` deep, a flat roof two beds thick
// out to the tor's widest bed, side walls only at the back so the front reads
// as an overhang. Returns its ROCK_SHELTERS entry.
function cutShelter(world, T, S, cells) {
  const [dx, dz] = DIRS[S.face], px = -dz, pz = dx, hw = S.w >> 1, b = T.base;
  const ax = T.x + px * S.off, az = T.z + pz * S.off;
  let E = 0; // the roof's reach: the tor's last cell out over the shelter
  const over = (t) => [0, 1, 2, 3].some((k) => cells.has(world.idx(ax + dx * t, b + S.h + k, az + dz * t)));
  while (E < 20 && over(E + 1)) E++;
  const back = E - S.d, ov = S.ov;
  // a solid cell keeps its own bed's colour; a new one takes a bed by height
  const put = (X, y, Z, id) => {
    const i = world.idx(X, y, Z);
    world.setRaw(X, y, Z, id);
    if (id === B.AIR) cells.delete(i); else if (!cells.has(i)) cells.set(i, (y >> 1) & 1);
  };
  for (let q = -hw - 1; q <= hw + 1; q++) {
    // the back wall curves: deepest on the centre line, shallower to the sides
    const side = Math.abs(q) > hw, bq = back + Math.round((Math.abs(q) / (hw + 0.5)) ** 2 * 2);
    for (let t = back; t <= E + 3; t++) {
      const X = ax + dx * t + px * q, Z = az + dz * t + pz * q, k = hash2(X * 5 + t, Z * 3 + q);
      if (t <= E) for (let y = b + S.h; y <= b + S.h + 1; y++) put(X, y, Z, B.ROCK); // the roof
      const wallEnd = E - ov + (k < 0.4 ? 1 : 0);
      if ((!side && t <= bq) || (side && t <= wallEnd)) { for (let y = b - 1; y < b + S.h; y++) put(X, y, Z, B.ROCK); continue; }
      if (side) continue;
      for (let y = b; y < b + S.h; y++) put(X, y, Z, B.AIR);
      // the ceiling worn a block higher here and there (never on the centre line)
      if (q && t < E - 1 && t > bq + 1 && k < 0.3) put(X, b + S.h, Z, B.AIR);
      for (let y = b + S.h; t > E && y <= b + S.h + 2; y++) put(X, y, Z, B.AIR);
      // a dusty floor, smoke-dark toward the back
      world.setRaw(X, b - 1, Z, t <= bq + 2 && k < 0.6 ? B.ROCK_DARK : k < 0.35 ? B.SAND : B.STONE);
      for (let y = b - 3; y < b - 1; y++) if (!isSolid(world.get(X, y, Z))) world.setRaw(X, y, Z, B.STONE);
    }
  }
  const mid = back + Math.ceil(S.d / 2) + 1;
  return {
    x: ax + dx * mid, z: az + dz * mid, y: b, face: S.face,
    wall: { x: ax + dx * back, z: az + dz * back }, w: 2 * hw + 1, depth: S.d, h: S.h,
    mouth: { x: ax + dx * (E + 1), z: az + dz * (E + 1) },
  };
}

// ---- the Painted Rocks (east) --------------------------------------------------
// After Bhimbetka: a sandstone ridge running north to south, worn into four
// tors that are plainly one mass (low saddles of the same beds join them).
// Their upper beds jut out over softer ones, and seven walk-in shelters sit
// under the overhangs. The middle tor is the tallest, and stands over the
// scrub and trees crowding the ridge's foot. SITES.paintedRocks is the ground
// just outside the big west shelter.
// ROCK_SHELTERS entries (for whatever paints them later), all cell coordinates:
//   x, z, y   a floor cell in the middle of the shelter; y is the standing
//             height (the first air block over the floor)
//   face      'n' | 's' | 'e' | 'w': the way the back wall's face looks, which
//             is out through the mouth
//   wall      { x, z } the back wall's column on the centre line (solid from
//             y to y + h - 1); the ceiling is y + h, solid over the whole floor
//   w, depth, h   inside width, depth from the roof's edge on the centre
//             line (the back wall curves forward toward the sides), headroom
//   mouth     { x, z } the first cell outside the roof's edge, on the centre line
export const ROCK_SHELTERS = [];
const TORS = [
  { x: 199, z: 81, rx: 6, rz: 8, H: 10, seed: 401, sh: [{ face: 'w', off: 0, w: 5, d: 6, h: 3, ov: 3 }, { face: 'n', off: 0, w: 5, d: 5, h: 3, ov: 3 }] },
  { x: 210, z: 98, rx: 7.5, rz: 9, H: 12, seed: 433, sh: [{ face: 'w', off: 0, w: 7, d: 7, h: 4, ov: 4 }, { face: 's', off: -1, w: 5, d: 6, h: 3, ov: 3 }] },
  { x: 201, z: 112, rx: 6, rz: 7, H: 10, seed: 467, sh: [{ face: 'w', off: 1, w: 5, d: 6, h: 3, ov: 3 }, { face: 'e', off: 2, w: 5, d: 5, h: 3, ov: 3 }] },
  { x: 207, z: 122, rx: 5, rz: 4.5, H: 8, seed: 491, sh: [{ face: 'w', off: 0, w: 5, d: 5, h: 3, ov: 3 }] },
];
// plinth, a soft waist the shelters are cut into, the hard jutting cap, a
// smaller crown
const torProfile = (h, H) => (h < 1.5 ? 0.82 : h < 4.5 ? 0.6 : h < H - 1.5 ? (h > H * 0.62 && h < H * 0.78 ? 0.86 : 1.02) : 0.7);
function raisePaintedRocks(world, ice) {
  ROCK_SHELTERS.length = 0;
  const cells = new Map();
  for (const T of TORS) T.base = groundHeight(T.x, T.z) + 1;
  // the saddles first, so the tors' own beds sit over them
  for (let i = 1; i < TORS.length; i++) {
    const a = TORS[i - 1], c = TORS[i], L = Math.hypot(c.x - a.x, c.z - a.z);
    for (let s = 0; s <= L; s += 0.5) {
      const mx = a.x + (c.x - a.x) * s / L, mz = a.z + (c.z - a.z) * s / L;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dz), X = Math.round(mx + dx), Z = Math.round(mz + dz);
        if (d > 3) continue;
        const g = world.topAt(X, Z), top = Math.min(a.base, c.base) + (d < 1.5 ? 1 : 0);
        for (let y = g + 1; y <= top; y++) { world.setRaw(X, y, Z, B.ROCK); cells.set(world.idx(X, y, Z), y & 1); }
      }
    }
  }
  for (const T of TORS) raiseTor(world, { ...T, prof: torProfile }, cells);
  for (const T of TORS) for (const S of T.sh) ROCK_SHELTERS.push(cutShelter(world, T, S, cells));
  paintBeds(world, cells, { top: B.STRATA_D, under: B.ROCK_DARK, faces: [B.ROCK, B.STONE] });
  // the ground in front of each mouth is graded to its floor, a block a step
  for (const s of ROCK_SHELTERS) {
    const [dx, dz] = DIRS[s.face], px = -dz, pz = dx;
    for (let t = 1; t <= 5; t++) for (let q = -3; q <= 3; q++) {
      const X = s.mouth.x + dx * t + px * q, Z = s.mouth.z + dz * t + pz * q;
      if (cells.has(world.idx(X, world.topAt(X, Z), Z))) continue;
      const g = world.topAt(X, Z), want = Math.max(s.y - 1 - t, Math.min(s.y - 1 + t, g));
      if (g !== want) setSurface(world, X, Z, want, B.GRASS, B.DIRT);
    }
  }
  // scrub crowding the foot of the ridge: babul, young sal, the odd peepal,
  // fallen blocks; never in front of a shelter
  const mouthClear = (x, z) => ROCK_SHELTERS.some((s) => Math.abs(x - s.mouth.x) < 5 && Math.abs(z - s.mouth.z) < 5);
  const trunks = [];
  for (const T of TORS) for (let i = 0; i < 16; i++) {
    const a = hash2(T.seed + i * 3, 61) * Math.PI * 2, r = Math.max(T.rx, T.rz) + 2 + hash2(T.seed + i * 5, 67) * 6;
    const x = Math.round(T.x + Math.cos(a) * r), z = Math.round(T.z + Math.sin(a) * r);
    if (mouthClear(x, z) || trunks.some((t) => Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3)) continue;
    const h = plantableAt(world, x, z);
    if (h < 0) continue;
    const k = hash2(T.seed + i * 7, 71);
    trunks.push({ x, z });
    if (k < 0.25) boulder(world, x, h, z, 1 + Math.floor(hash2(x, z) * 2), B.ROCK);
    else if (ice) { if (k < 0.75) placeSnag(world, x, h + 1, z, 3 + Math.floor(k * 3)); }
    else if (k < 0.6) placeAcacia(world, x, h + 1, z, 3 + Math.floor(k * 3));
    else if (k < 0.85) placeSalTall(world, x, h + 1, z, false, false);
    else placePeepal(world, x, h + 1, z, 4);
    if (hash2(x * 3, z * 5) < 0.5) shrub(world, x + 2, z + 1, ice);
  }
}

// ---- the bear's den -----------------------------------------------------------
// A dark knoll of the same sandstone on the walk from the plains east to the
// grassland, its south-west face cut flat with a den in it: a mouth three wide
// and three tall, a passage and a round chamber the bear stands up in. The
// murram trail passes the mouth. SITES.bearCave (inside) and bearCaveMouth.
function carveBearDen(world, ice) {
  const C = SITES.bearCave, b = C.y, ox = -Math.SQRT1_2, oz = Math.SQRT1_2; // out of the mouth: south-west
  const cells = new Map();
  raiseTor(world, { x: C.x + 1, z: C.z - 1, rx: 8, rz: 8, base: b, H: 7, seed: 977, prof: (h, H) => (h < 1 ? 1 : h < H - 1.5 ? 0.9 : 0.62) }, cells);
  for (let z = C.z - 12; z <= C.z + 12; z++) for (let x = C.x - 12; x <= C.x + 12; x++) {
    const vx = x - C.x, vz = z - C.z, along = vx * ox + vz * oz, perp = Math.abs(vx * -oz + vz * ox);
    if (along > 4.6) { // the cut face: the knoll ends here, and the ground runs on
      for (let y = b; y < SY; y++) if (cells.has(world.idx(x, y, z))) { world.setRaw(x, y, z, B.AIR); cells.delete(world.idx(x, y, z)); }
      continue;
    }
    if (Math.hypot(vx, vz) < 2.9 || (along > 0 && perp < 1.6)) {
      for (let y = b; y <= b + 2; y++) { world.setRaw(x, y, z, B.AIR); cells.delete(world.idx(x, y, z)); }
      world.setRaw(x, b - 1, z, B.ROCK_DARK);
      for (let y = b + 3; y <= b + 4; y++) if (!cells.has(world.idx(x, y, z))) { world.setRaw(x, y, z, B.ROCK); cells.set(world.idx(x, y, z), 0); }
    }
  }
  paintBeds(world, cells, { top: B.STONE, under: B.ROCK_DARK, faces: [B.ROCK_DARK, B.STONE] });
  // inside, every wall is dark
  for (let z = C.z - 6; z <= C.z + 6; z++) for (let x = C.x - 6; x <= C.x + 6; x++) {
    for (let y = b; y <= b + 3; y++) if (cells.has(world.idx(x, y, z)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => world.get(x + dx, y, z + dz) === B.AIR && Math.hypot(x + dx - C.x, z + dz - C.z) < 6)) world.setRaw(x, y, z, B.ROCK_DARK);
  }
  // the apron: the ground before the face graded to the den floor
  for (let t = 5; t <= 10; t++) for (let q = -3; q <= 3; q++) {
    const X = Math.round(C.x + ox * t - oz * q), Z = Math.round(C.z + oz * t + ox * q);
    const g = world.topAt(X, Z), want = Math.max(b - 1 - (t - 5), Math.min(b - 1 + (t - 5), g));
    if (g !== want || cells.has(world.idx(X, g, Z))) setSurface(world, X, Z, want, ice ? B.SNOWGRASS : B.GRASS, B.DIRT);
    if (t < 7) world.setRaw(X, want, Z, B.PATH);
  }
  // a babul on the knoll and brush round its shoulders, so it reads as a place
  const ky = world.topAt(C.x + 3, C.z - 3);
  if (!ice) placeAcacia(world, C.x + 3, ky + 1, C.z - 3, 3);
  for (const [dx, dz] of [[-5, -5], [6, 2], [2, 6], [-6, 1]]) shrub(world, C.x + dx, C.z + dz, ice);
}

// ---- the trail -------------------------------------------------------------------
// A beaten murram track from the old valley's edge east past the bear's den to
// the grassland, the Painted Rocks and the lake: broken, a block or two wide.
const TRAILS = [
  [[128, 52], [140, 52], [145, 50], [158, 58], [176, 68], [189, 82], [196, 96]],
  [[176, 68], [172, 100], [176, 140], [172, 168]],
];
function layTrails(world) {
  for (const T of TRAILS) for (let i = 1; i < T.length; i++) {
    const [ax, az] = T[i - 1], [cx, cz] = T[i], L = Math.hypot(cx - ax, cz - az);
    for (let s = 0; s <= L; s += 0.5) {
      const w = (noise2(ax + s * 0.12, az * 0.3) - 0.5) * 3;
      const x = Math.round(ax + (cx - ax) * s / L - (cz - az) / L * w), z = Math.round(az + (cz - az) * s / L + (cx - ax) / L * w);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1]]) {
        if ((dx || dz) && hash2(x * 3 + dx, z * 5 + dz) < 0.6) continue;
        if (hash2(x + dx, z * 7 + dz) < 0.18) continue;
        const h = world.topAt(x + dx, z + dz), id = world.get(x + dx, h, z + dz);
        if (id !== B.GRASS && id !== B.SNOWGRASS && id !== B.DIRT) continue;
        world.setRaw(x + dx, h, z + dz, B.PATH);
        if (isCross(world.get(x + dx, h + 1, z + dz))) world.setRaw(x + dx, h + 1, z + dz, B.AIR);
      }
    }
  }
}

// ---- the sal forest (south) ------------------------------------------------------
// A real sal wood: tall straight trunks on a loose grid five to nine apart, so
// the trunks read as a colonnade and the crowns meet in one canopy, with grassy
// clearings left on purpose and the river running through. Leaf litter and a
// little low growth under the trees. In the ice age it is mostly dead poles,
// with the odd dark crown.
const CLEARINGS = [{ x: 84, z: 190, r: 10 }, { x: 36, z: 186, r: 8 }, { x: 122, z: 202, r: 8 }, { x: 58, z: 206, r: 6 }];
function forestCore(x, z) { // above 0 inside the stand, falling off outside
  const F = NEW_LAND.forest;
  return 1 - (((x - F.x) / F.rx) ** 2 + ((z - F.z) / F.rz) ** 2) - (noise2(x * 0.07 + 9.1, z * 0.07 + 2.7) - 0.5) * 0.6;
}
function plantSalForest(world, ice) {
  const F = NEW_LAND.forest, step = 7;
  for (let gz = F.z - F.rz - 6, row = 0; gz <= F.z + F.rz + 6; gz += step, row++) {
    for (let gx = F.x - F.rx - 6 + (row & 1) * 3.5; gx <= F.x + F.rx + 6; gx += step) {
      const x = Math.round(gx + (hash2(gx * 3, gz * 7) - 0.5) * 3), z = Math.round(gz + (hash2(gx * 5, gz * 11) - 0.5) * 3);
      const core = forestCore(x, z), r = hash2(x * 13, z * 17);
      if (core < 0 && (core < -0.6 || r > 0.22)) continue;
      if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      if (Math.abs(x + 0.5 - riverX(z)) < SOLID_RIVER_CLEARANCE + 1) continue;
      const big = core > 0.15 && r < 0.72;
      const y = big ? plantable2(world, x, z) : plantableAt(world, x, z) + 1;
      if (y <= 0) continue;
      placeSalTall(world, x, y, z, big, ice);
      // the forest floor: leaf litter, a fern or two, now and then a low bush
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const X = x + dx, Z = z + dz, k = hash2(X * 7 + 1, Z * 3 + 2), h = world.topAt(X, Z);
        if (Math.hypot(dx, dz) > 3.2 || world.get(X, h, Z) !== B.GRASS) continue;
        const up = world.get(X, h + 1, Z);
        if (up !== B.AIR && !isCross(up)) continue;
        if (k < 0.45) world.setRaw(X, h, Z, B.DIRT);
        if (k > 0.86) world.setRaw(X, h + 1, Z, ice ? B.DEADBUSH : B.FERN);
        else if (k > 0.83 && Math.abs(X - riverX(Z)) > SOLID_RIVER_CLEARANCE) world.setRaw(X, h + 1, Z, ice ? B.BUSH_BARE : B.LEAVES_DARK);
      }
    }
  }
}
// two by two cells of grass at one height, or within a block: the foot of a big trunk
function plantable2(world, x, z) {
  let lo = 99, hi = -1;
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const h = plantableAt(world, x + dx, z + dz);
    if (h < 0) return -1;
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  return hi - lo > 1 ? -1 : hi + 1;
}
// grass with nothing solid on it, above the water
function plantableAt(world, x, z) {
  if (x < 1 || z < 1 || x >= SX - 1 || z >= SZ - 1) return -1;
  const h = world.topAt(x, z), up = world.get(x, h + 1, z);
  if (h < WATER_LEVEL || world.get(x, h, z) !== B.GRASS || (up !== B.AIR && !isCross(up))) return -1;
  return h;
}

// A sal: the lollipop on a pole. A straight clear bole for about three fifths
// of the height (2x2 for a big tree, 1x1 for a young one), then a crown of
// four or five lumpy clusters at different heights on short branch stubs, with
// air between them and flat undersides: dark leaves under, mid green in the
// body, light on top. The world is 24 tall, so a big tree is 12 to 15 blocks
// (real sal 18 to 32 m). y is the first trunk block. In the ice age most are
// dead poles with their stubs; the rest keep a dark crown with frost on top.
function placeSalTall(world, x, y, z, big, ice) {
  const r = (k) => hash2(x * 31 + k * 7, z * 17 + k * 13);
  const H = Math.min(big ? 12 + Math.floor(r(1) * 4) : 8 + Math.floor(r(1) * 3), SY - y);
  if (H < 6) return;
  const bole = Math.round(H * 0.6), w = big ? 2 : 1, px = x + w / 2, pz = z + w / 2;
  const bare = ice && r(2) < 0.72;
  for (let yy = y - 1; yy <= y + H - (bare ? 2 + Math.floor(r(9) * 3) : 3); yy++) {
    for (let dz = 0; dz < w; dz++) for (let dx = 0; dx < w; dx++) {
      if (yy >= y || !isSolid(world.get(x + dx, yy, z + dz))) world.setRaw(x + dx, yy, z + dz, B.WOOD);
    }
  }
  const clusters = [{ a: 0, d: 0, y: y + H - 3, rx: big ? 2.7 : 1.8, L: [0.9, 1, 0.74, 0.4] }];
  const n = big ? 3 + (r(3) > 0.5 ? 1 : 0) : 2, span = Math.max(1, H - 5 - bole);
  for (let i = 0; i < n; i++) {
    clusters.push({
      a: i * Math.PI * 2 / n + r(10 + i) * 1.2, d: big ? 2.4 + r(20 + i) * 1 : 1.5,
      y: y + bole + 1 + Math.floor(((i + r(30 + i)) / n) * span), rx: big ? 2 + r(40 + i) * 0.6 : 1.4, L: [0.9, 1, 0.6],
    });
  }
  for (const c of clusters) {
    const cx = px + Math.cos(c.a) * c.d, cz = pz + Math.sin(c.a) * c.d;
    // the branch stub out of the trunk, rising a block to the cluster
    if (c.d) for (let k = w / 2 + 0.3; k <= c.d; k += 0.7) {
      const bx = Math.floor(px + Math.cos(c.a) * k), bz = Math.floor(pz + Math.sin(c.a) * k);
      leaf(world, bx, c.y - 2 + (k > c.d * 0.6 ? 1 : 0), bz, B.WOOD);
    }
    if (bare) continue;
    for (let j = 0; j < c.L.length; j++) {
      const R = c.rx * c.L[j], yy = c.y - 1 + j;
      for (let Z = Math.floor(cz - R - 1); Z <= cz + R + 1; Z++) for (let X = Math.floor(cx - R - 1); X <= cx + R + 1; X++) {
        const e = hash2(X * 7 + yy * 13, Z * 11 + yy);
        if (Math.hypot(X + 0.5 - cx, Z + 0.5 - cz) > R + (e - 0.5) * 0.8) continue;
        const topLayer = j === c.L.length - 1 || (j === c.L.length - 2 && e > 0.7);
        const id = ice ? (topLayer && e > 0.35 ? B.ICE : B.LEAVES_DARK)
          : j === 0 ? B.LEAVES_DARK : topLayer ? B.LEAVES_BRIGHT : B.LEAVES;
        leaf(world, X, yy, Z, id);
      }
    }
  }
}

// ---- the waterfall -----------------------------------------------------------
// 2026-10-28: "make the start of the river a waterfall". The river used to
// leave the valley through an open slot in the north cliff, straight into
// the sky at the world's edge. Now the slot ends in a rock lip with the upper
// river pooled on top, and the river starts by falling off it. The falling
// sheet, foam and spray are a prop (world/props.js makeWaterfall), made once
// in main.js because the falls are there in every era; in the cold scenes the
// lip freezes and a curtain of ice hangs where the water would fall.
// Nothing here is walkable ground: it is the closed end of a gorge the
// cliffs already fence.
// The lip sits where the gorge opens into the valley (z 12), not deep in the
// slot: from anywhere else the slot walls hid it. Behind the lip the upper
// river runs on the gorge floor raised to y 20, in a headwall of rock that
// stands two blocks over the north cliff (y 22), back to the world's edge,
// where the glacier feeds it in the ice age. The drop is 15 blocks
// (2026-10-28: "make the waterfall higher"). The world is 24 blocks tall, so
// this is about the most the falls can grow without raising WORLD.SIZE_Y,
// which would cost every remesh (the Act 2 era flips) on a phone.
const FALLS_Z = 11; // the last row of the raised gorge floor
const FALLS_RX = Math.round(riverX(FALLS_Z));
const FALLS_POOL = 20; // the upper river's water cell height
export const WATERFALL = {
  x0: FALLS_RX - 3, x1: FALLS_RX + 4,      // the sheet spans these x (cells x0..x1-1)
  face: FALLS_Z + 1,                       // the lip's south face, where the water leaves it
  top: FALLS_POOL + 0.85, bottom: WATER_LEVEL + 0.85, // water surface on the lip, and in the pool
  lip: { x: FALLS_RX, y: FALLS_POOL, z: FALLS_Z }, // main.js shows the sheet while this cell is water
};
function carveWaterfall(world) {
  for (let z = 0; z <= FALLS_Z; z++) {
    for (let x = FALLS_RX - 8; x <= FALLS_RX + 8; x++) {
      const dx = Math.abs(x - (FALLS_RX + 0.5));
      const channel = x >= WATERFALL.x0 && x < WATERFALL.x1;
      // channel bed, a bank either side, then the headwall, its shoulders
      // stepping back down to the natural cliff (20) at the edges
      const top = channel ? FALLS_POOL - 1
        : dx < 5.5 ? FALLS_POOL + 1
          : dx < 7 ? FALLS_POOL + 2
            : FALLS_POOL + 1 - Math.round(hash2(x * 5, z * 3));
      if (!channel && world.topAt(x, z) >= top) continue;
      for (let y = 0; y <= top; y++) world.setRaw(x, y, z, y >= top - 1 ? B.ROCK : B.STONE);
      for (let y = top + 1; y < SY; y++) world.setRaw(x, y, z, B.AIR);
      if (channel) world.setRaw(x, FALLS_POOL, z, B.WATER);
    }
  }
}

// ---- the training cave ------------------------------------------------------
// The band's sleeping chamber deep in the north cliff, and the long way out to
// the light. Slice 1 (2026-10-27): "make the training cave much longer". The
// practice rooms keep every floor coordinate the tutorial and the resume
// checkpoints share (SITES.training*); what changed is the way out. The old
// walk from the basket to the mouth was about ten blocks. Now one winding
// passage of about eighty runs right round the practice rooms before it meets
// daylight, and three cracks cut along the sun's own angle let real sunlight
// fall on its floor, so it reads in both visual styles.
//
//   R1  sleeping chamber and the circle of light    look, move
//   R2  the sill: two blocks, so it takes a jump      jump
//   R3  the basket nook                               basket, equip, stow
//   L1  north up the east side                        exit ...
//   L2  west under the cliff top (two sun cracks)
//   L3  south down the west side
//   L4  east toward the light, then the mouth onto the old approach
//
// One passage, no branches, walls of one or two blocks between runs.
// regression.mjs walks it and fails if the sill can be skipped, if the basket
// nook can reach daylight any other way, or if the mouth stops being reachable.
export const TRAINING_CAVE = {
  // the box vivid treats as dark (world/shade.js setDarkZone); the mouth at
  // z 22 is deliberately outside it
  lo: { x: 1, y: 9.5, z: 1 },
  hi: { x: 36, y: 18, z: 21.6 },
  // both in L2, which runs east-west like the sun's own slant, so the light
  // travels down the passage's air before it ever meets rock
  cracks: [{ x: 19, z: 2 }, { x: 27, z: 2 }],
  // wall torches (acts/onboarding.js dressTrainingShelter): the point where
  // the stick meets the wall face, and the way it points. Inner walls only
  // (the outer ones have alcoves), all at y 12.3, over head height.
  torches: [
    { x: 10.5, z: 7, face: 's' }, { x: 16.5, z: 7, face: 's' },   // R1 north wall
    { x: 8, z: 13.5, face: 'e' }, { x: 13.5, z: 18, face: 'n' },  // R1 west, south
    { x: 24.5, z: 11, face: 's' }, { x: 28.5, z: 18, face: 'n' }, // the sill, the basket nook
    { x: 32, z: 9.5, face: 'e' },                                  // L1
    { x: 8.5, z: 5, face: 'n' }, { x: 14.5, z: 5, face: 'n' },    // L2
    { x: 6, z: 12.5, face: 'w' },                                  // L3
    { x: 10.5, z: 19, face: 's' }, { x: 18.5, z: 19, face: 's' }, // L4
  ],
};
const CAVE_ROOMS = [ // [x0, z0, x1, z1] — air y 10..16, roof y 17
  [8, 7, 18, 17],   // R1
  [17, 11, 29, 17], // R2
  [23, 15, 30, 17], // R3
];
const CAVE_RUNS = [ // [x0, z0, x1, z1] — air from y 10 to a varying ceiling
  [31, 15, 31, 17], // doorway R3 → L1
  [32, 2, 34, 17],  // L1
  [3, 2, 34, 4],    // L2
  [3, 2, 5, 21],    // L3
  [3, 19, 30, 21],  // L4
  [24, 22, 30, 22], // the mouth, cut through the cliff face
];
const SUN_DX = 40 / 60, SUN_DZ = 20 / 60; // world/mesher.js's sun march

export function carveTrainingCave(world, ice = false) {
  const FLOOR = 9;
  // 1. a rose sandstone mass over the whole footprint
  for (let x = 1; x <= 36; x++) for (let z = 1; z <= 22; z++) {
    const edge = Math.min(x - 1, 36 - x, z - 1, 22 - z);
    const roof = Math.min(SY - 3, 15 + Math.min(4, edge));
    for (let y = 7; y <= roof; y++) world.setRaw(x, y, z, y === roof && ice ? B.SNOWGRASS : B.ROCK);
  }
  const carved = new Set(), roomAir = new Set();
  const air = (x, y, z) => { world.setRaw(x, y, z, B.AIR); carved.add(`${x},${y},${z}`); };
  // 2. the practice rooms, exactly as the tutorial knows them
  for (const [x0, z0, x1, z1] of CAVE_ROOMS) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (let y = FLOOR + 1; y <= 16; y++) { air(x, y, z); roomAir.add(`${x},${y},${z}`); }
      // continuous roof, even where the natural cliff was low
      world.setRaw(x, 17, z, B.ROCK_DARK);
      world.setRaw(x, 18, z, ice ? B.SNOWGRASS : B.ROCK);
    }
  }
  // 3. the way out: a lower, uneven ceiling (13 to 15) so it feels like a
  //    passage and not a corridor; never under four blocks of headroom. The
  //    last stretch before the mouth opens up to 15 so the low sun, coming
  //    in from the south-east, falls across the floor ahead of the player:
  //    the light at the end of the passage is real light.
  for (const [x0, z0, x1, z1] of CAVE_RUNS) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const nearMouth = z >= 19 && x >= 21;
      const ceil = nearMouth ? 15 : 13 + Math.floor(noise2(x * 0.31 + 5.1, z * 0.29 + 2.3) * 2.99);
      for (let y = FLOOR + 1; y <= ceil; y++) air(x, y, z);
    }
  }
  // 4. alcoves into the OUTER walls only (an inner wall is the only thing
  //    between two runs, so it is never touched): L2's north face, L3's west
  //    face, L1's east face. Head-height bites, so the walls stop being flat.
  const alcove = (x, z) => {
    if (hash2(x * 13 + 7, z * 17 + 3) < 0.55) return;
    const top = FLOOR + 2 + Math.floor(hash2(x * 5, z * 11) * 2);
    for (let y = FLOOR + 1; y <= top; y++) air(x, y, z);
  };
  for (let x = 6; x <= 31; x++) alcove(x, 1);
  for (let z = 6; z <= 17; z++) alcove(2, z);
  for (let z = 5; z <= 14; z++) alcove(35, z);
  // a room wall already lined pale keeps it even where a passage shares it
  const roomWall = (x, y, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => roomAir.has(`${x + dx},${y},${z + dz}`));
  // 5. sun cracks: carve along the exact march the mesher uses to bake
  //    sunlight, from a 2x2 patch of floor up to open sky. Only from y 14 up:
  //    a crack is a staircase one block per step, and below 14 a player could
  //    climb it straight out of the cave (the first version did exactly that).
  //    Below 14 the ray is still inside the passage's own air, so the floor
  //    patch is lit all the same.
  for (const c of TRAINING_CAVE.cracks) {
    for (const ox of [0.02, 0.5, 0.98, 1.02, 1.5, 1.98]) for (const oz of [0.02, 0.5, 0.98, 1.02, 1.5, 1.98]) {
      for (let k = 0; ; k++) {
        const sx = Math.floor(c.x + ox + SUN_DX * k), sy = FLOOR + 1 + k, sz = Math.floor(c.z + oz + SUN_DZ * k);
        if (sy >= SY) break;
        if (sy >= 14 && world.get(sx, sy, sz) !== B.AIR) world.setRaw(sx, sy, sz, B.AIR);
      }
    }
  }
  // 6. line every carved space with dark, smoke-stained stone (the floor
  //    included), with a paler sandstone band at y 12 so the walls show
  //    their layers; the outside of the mass stays rose. The practice rooms
  //    are where people sleep and the torches burn: their WALLS stay pale
  //    rose sandstone (a dark band at y 12 for the layers), so the
  //    torchlight has something to show and the rooms read bright, while the
  //    long passage out stays dark.
  for (const key of carved) {
    const [x, y, z] = key.split(',').map(Number);
    const room = roomAir.has(key);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const id = world.get(nx, ny, nz);
      if (id !== B.ROCK && id !== B.STONE && id !== B.DIRT && id !== B.SNOWGRASS) continue;
      const band = ny === 12 && hash2(nx * 3 + nz, nz * 5) > 0.35;
      const wall = dy === 0;
      if (room && wall) world.setRaw(nx, ny, nz, band ? B.ROCK_DARK : B.ROCK);
      else if (id !== B.ROCK || !roomWall(nx, ny, nz)) world.setRaw(nx, ny, nz, band ? B.ROCK : B.ROCK_DARK);
    }
  }
  // 6b. pools of daylight: any cave floor the sun actually reaches (the
  //     cracks, the last stretch before the mouth) is pale wind-blown sand,
  //     not smoke-stained stone. Same march as the mesher's sun bake, so the
  //     sand is exactly where the light lands, and it reads in both styles.
  for (const key of carved) {
    const [x, y, z] = key.split(',').map(Number);
    if (y !== FLOOR + 1 || !isOpaque(world.get(x, FLOOR, z))) continue;
    let sky = true;
    for (let k = 0; k <= 14; k++) {
      const sx = Math.floor(x + 0.5 + SUN_DX * k), sy = Math.floor(FLOOR + 1.02 + k), sz = Math.floor(z + 0.5 + SUN_DZ * k);
      if (sy >= SY) break;
      if (isOpaque(world.get(sx, sy, sz))) { sky = false; break; }
    }
    if (sky) world.setRaw(x, FLOOR, z, B.SAND);
  }
  // 7. the sill: two blocks, too tall for auto-step, within the real jump
  for (let z = 11; z <= 17; z++) for (let y = 10; y <= 11; y++) world.setRaw(20, y, z, B.ROCK);
  // 8. stalactites where there is room for them: rooms only (ceiling 16),
  //    hanging no lower than y 14, and clear of every place the tutorial
  //    sends the player
  const keepClear = [SITES.trainingStart, SITES.trainingLight, SITES.trainingJump, SITES.trainingBasket];
  for (const [x0, z0, x1, z1] of CAVE_ROOMS) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (keepClear.some((s) => Math.abs(s.x - x) <= 1 && Math.abs(s.z - z) <= 1)) continue;
      const h = hash2(x * 7 + 1, z * 9 + 4);
      if (h < 0.84) continue;
      world.setRaw(x, 16, z, B.ROCK_DARK);
      if (h > 0.95) world.setRaw(x, 15, z, B.ROCK_DARK);
    }
  }
  // 9. walkable approach, with no foliage in the exit sightline (unchanged)
  for (let z = 23; z <= 30; z++) for (let x = 24; x <= 30; x++) {
    const target = groundHeight(x, z);
    const h = Math.round(9 + (target - 9) * Math.min(1, (z - 23) / 7));
    setSurface(world, x, z, h, z < 26 ? B.ROCK : B.PATH);
  }
}

// ---- the open country ---------------------------------------------------------
// The new land between the places: savanna, not forest. Small groves and lone
// trees (babul mostly, a peepal or banyan for a landmark, date palms by water),
// boulders and a few low bedded outcrops, brush, fallen logs, and patches of
// dry golden grass in the grassland. Fewer, readable things over dense noise:
// a phone remeshes all of it on every era change.
const OUTCROPS = [[164, 40, 4], [186, 56, 3], [142, 98, 3], [166, 128, 4], [150, 150, 3], [118, 150, 3], [212, 150, 4], [204, 168, 3], [216, 60, 3], [134, 214, 3]];
function openCountry(x, z) {
  if (x < WORLD.CORE_SIZE + 2 && z < WORLD.CORE_SIZE + 2) return false; // the old valley keeps its own
  if (Math.abs(x - riverX(z)) < SOLID_RIVER_CLEARANCE || nearSite(x, z, 6)) return false;
  const R = NEW_LAND.rocks, K = NEW_LAND.lake, D = SITES.bearCave;
  if (x > R.x0 - 4 && x < R.x1 + 4 && z > R.z0 - 4 && z < R.z1 + 6) return false;
  if (((x - K.x) / K.rx) ** 2 + ((z - K.z) / K.rz) ** 2 < 2.1) return false;
  if (Math.hypot(x - D.x, z - D.z) < 12 || forestCore(x, z) > -0.25) return false;
  return Math.hypot(x - NEW_LAND.lookout.x, z - NEW_LAND.lookout.z) > 4;
}
function dressOutlands(world, lush, ice) {
  const trunks = [];
  const tree = (x, z, kind) => {
    if (!openCountry(x, z) || trunks.some((t) => Math.abs(t.x - x) < 4 && Math.abs(t.z - z) < 4)) return;
    const h = plantableAt(world, x, z);
    if (h < 0) return;
    trunks.push({ x, z });
    const s = 3 + Math.floor(hash2(x * 3, z * 7) * 2);
    if (ice) { if (kind !== 'palm' && hash2(x, z * 3) < 0.7) placeSnag(world, x, h + 1, z, s); return; }
    if (kind === 'babul') placeAcacia(world, x, h + 1, z, s);
    else if (kind === 'peepal') placePeepal(world, x, h + 1, z, s);
    else if (kind === 'banyan') placeBanyan(world, x, h + 1, z, s);
    else if (kind === 'palm') placePalm(world, x, h + 1, z, s);
    else placeSalTall(world, x, h + 1, z, false, false);
  };
  const near = (x, z, p, r) => Math.hypot(x - p.x, z - p.z) < r;
  const kindAt = (x, z, k) => (near(x, z, NEW_LAND.lake, 34) || Math.abs(x - riverX(z)) < 16 ? (k < 0.5 ? 'palm' : 'babul')
    : k < 0.6 ? 'babul' : k < 0.78 ? 'peepal' : k < 0.86 ? 'banyan' : 'sal');
  // groves of three to six
  for (let i = 0; i < 70; i++) {
    const gx = Math.floor(8 + hash2(i * 7 + 2001, 13) * (SX - 16)), gz = Math.floor(30 + hash2(i * 11 + 2003, 19) * (SZ - 40));
    if (!openCountry(gx, gz)) continue;
    const kind = kindAt(gx, gz, hash2(i, 2011));
    for (let j = 0; j < 3 + Math.floor(hash2(i, 2017) * 4); j++) {
      tree(gx + Math.round((hash2(i * 5 + j, 2027) - 0.5) * 12), gz + Math.round((hash2(i * 3 + j, 2029) - 0.5) * 12), kind === 'banyan' && j ? 'babul' : kind);
    }
  }
  // lone trees
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(6 + hash2(i * 13 + 2101, 23) * (SX - 12)), z = Math.floor(26 + hash2(i * 17 + 2111, 29) * (SZ - 32));
    tree(x, z, kindAt(x, z, hash2(i, 2131)));
  }
  // low bedded outcrops, and boulders
  for (const [x, z, H] of OUTCROPS) {
    const cells = new Map();
    raiseTor(world, { x, z, rx: H + 0.5, rz: H - 0.5, base: groundHeight(x, z) + 1, H, seed: x * 7 + z, prof: (h, HH) => (h < 1 ? 0.8 : h < HH - 1 ? 1 : 0.6) }, cells);
    paintBeds(world, cells, { top: B.STRATA_D, under: B.ROCK_DARK, faces: [B.ROCK, B.STONE] });
    shrub(world, x - H - 1, z + 1, ice); shrub(world, x + 1, z + H, ice);
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(4 + hash2(i * 19 + 2201, 31) * (SX - 8)), z = Math.floor(24 + hash2(i * 23 + 2203, 37) * (SZ - 28));
    if (!openCountry(x, z) || trunks.some((t) => Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3)) continue;
    const h = plantableAt(world, x, z), k = hash2(i, 2213);
    if (h < 0) continue;
    if (k < 0.4) boulder(world, x, h, z, 1 + Math.floor(hash2(i, 2221) * 3), hash2(i, 2223) < 0.5 ? B.ROCK : B.STONE);
    else if (k < 0.85) shrub(world, x, z, ice);
    else if (!ice) { // a fallen log on level ground
      const ax = k > 0.92;
      let ok = true;
      for (let s = 0; s < 4 && ok; s++) ok = plantableAt(world, x + (ax ? s : 0), z + (ax ? 0 : s)) === h;
      for (let s = 0; ok && s < 4; s++) world.setRaw(x + (ax ? s : 0), h + 1, z + (ax ? 0 : s), B.WOOD);
    }
  }
  // dry golden grass in drifts over the grassland
  const G = NEW_LAND.grass;
  for (let z = G.z0 - 8; z <= G.z1 + 8; z++) for (let x = G.x0 - 12; x <= G.x1 + 8; x++) {
    if (noise2(x * 0.08 + 71.3, z * 0.08 + 5.9) < 0.58 || hash2(x * 5 + 7, z * 3 + 1) > 0.3) continue;
    const h = plantableAt(world, x, z);
    if (h >= 0 && world.get(x, h + 1, z) === B.AIR) world.setRaw(x, h + 1, z, hash2(x, z * 9) < 0.55 ? B.DEADBUSH : B.TALLGRASS);
  }
  // A readable grove and a forageable meadow reward leaving the main route.
  for (const [dx, dz] of [[-7, -4], [0, -7], [7, -3], [-6, 5], [6, 6]]) {
    const x = SITES.eastGrove.x + dx, z = SITES.eastGrove.z + dz, h = grassTopAt(world, x, z);
    if (h >= 0) { if (ice) placeSnag(world, x, h + 1, z, 4); else placeTree(world, x, h + 1, z, 4); }
  }
  for (let i = 0; i < 16; i++) {
    const x = SITES.southMeadow.x - 9 + (i * 7) % 19, z = SITES.southMeadow.z - 7 + (i * 11) % 15;
    const h = grassTopAt(world, x, z);
    if (h >= 0) world.setRaw(x, h + 1, z, i % 3 === 0 ? B.SHRUB_BERRY : ice ? B.SNOWTUFT : B.FLOWER_YELLOW);
  }
}
// a rounded lump of rock sunk a block into the ground, `s` 1 to 3 across
function boulder(world, x, h, z, s, id) {
  for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
    if ((dx === 0 || dx === s - 1) && (dz === 0 || dz === s - 1) && s > 2) continue;
    const tall = s === 1 ? 1 : s === 2 ? 1 + (hash2(x + dx, z + dz) > 0.5 ? 1 : 0) : (dx === 1 && dz === 1 ? 2 : 1);
    const g = world.topAt(x + dx, z + dz);
    if (g < WATER_LEVEL || g > h + 1) continue;
    for (let y = g; y <= g + tall; y++) world.setRaw(x + dx, y, z + dz, y === g ? B.ROCK_DARK : y === g + tall ? B.STRATA_D : id);
  }
}
// brush: a block or two of dark leaves (not BUSH, whose red sides read as
// berries) with a fern or dry tuft at its skirt; bare twigs in the ice age
function shrub(world, x, z, ice) {
  const h = plantableAt(world, x, z);
  if (h < 0 || Math.abs(x - riverX(z)) < SOLID_RIVER_CLEARANCE) return;
  const id = ice ? B.BUSH_BARE : B.LEAVES_DARK;
  world.setRaw(x, h + 1, z, id);
  const side = hash2(x * 3, z) > 0.5 ? 1 : -1;
  if (plantableAt(world, x + side, z) === h) world.setRaw(x + side, h + 1, z, id);
  if (!ice && hash2(x, z * 5) > 0.6) world.setRaw(x, h + 2, z, B.LEAVES);
  if (plantableAt(world, x, z + 1) === h) world.setRaw(x, h + 1, z + 1, ice ? B.DEADBUSH : B.FERN);
}

// ---- where animals drink --------------------------------------------------------
// WATER_EDGES: dry standable cells with open water one block away, round the
// lake and along both river banks, the length of the map. Each is
// { x, z, y, wx, wz }: the cell to stand in (y = the standing height, the
// first air block), and the water cell (wx, WATER_LEVEL, wz) beside it. In the
// ice age the lake's edge is its ice rim, so its points stand on the ice.
export const WATER_EDGES = [];
function collectWaterEdges(world) {
  WATER_EDGES.length = 0;
  const WL = WATER_LEVEL;
  const edge = (x, z) => {
    const h = world.topAt(x, z);
    if (h < WL || h > WL + 1 || world.get(x, h + 1, z) === B.WATER || nearSite(x, z, 7)) return null;
    if (isSolid(world.get(x, h + 1, z)) || isSolid(world.get(x, h + 2, z))) return null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (world.get(x + dx, WL, z + dz) === B.WATER && world.get(x + dx, WL + 1, z + dz) === B.AIR) return { x, z, y: h + 1, wx: x + dx, wz: z + dz };
    }
    return null;
  };
  const K = NEW_LAND.lake;
  for (let i = 0; i < 14; i++) {
    const a = (i + 0.3) / 14 * Math.PI * 2;
    for (let e = 0.6; e < 2.4; e += 0.05) {
      const p = edge(Math.round(K.x + Math.cos(a) * K.rx * e), Math.round(K.z + Math.sin(a) * K.rz * e));
      if (p) { WATER_EDGES.push(p); break; }
    }
  }
  for (let z = 30, i = 0; z < SZ - 4; z += 11, i++) {
    if (Math.abs(z - 37) < 5) continue; // the log crossing
    const side = i & 1 ? 1 : -1, rx = Math.round(riverX(z));
    for (let d = 1; d < 10; d++) {
      const p = edge(rx + side * d, z);
      if (p) { WATER_EDGES.push(p); break; }
    }
  }
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
    let x = Math.floor(hash2(i, 11) * WORLD.CORE_SIZE) + Math.floor(hash2(i, 71) * 3) - 1;
    let z = Math.floor(hash2(i, 29) * WORLD.CORE_SIZE) + Math.floor(hash2(i, 83) * 3) - 1;
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
      const x = Math.floor(hash2(i * 3 + 501, 17) * WORLD.CORE_SIZE), z = Math.floor(hash2(i * 5 + 503, 37) * WORLD.CORE_SIZE);
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
      const x = Math.floor(hash2(i * 7 + 901, 23) * WORLD.CORE_SIZE), z = Math.floor(hash2(i * 11 + 907, 41) * WORLD.CORE_SIZE);
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

  // kans grass along banks (the REED block): 1–2 tall clusters, a little
  // denser since slice 1 so the banks read as tall grass, walk-through as ever
  for (let z = 20; z < SZ; z++) {
    const rx = riverX(z);
    for (const dx of [-5, -4, -3, 3, 4, 5]) {
      const x = Math.round(rx + dx + noise2(z * 0.3, 1) * 2);
      if (hash2(x, z) < 0.5) continue;
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
 * the variant is a deterministic hash of position, so saved worlds rebuild
 * identically.
 *
 * Slice 1 (2026-10-27): the valley's trees are central Indian now. Sal (the
 * tall dry-forest tree), banyan with aerial roots, peepal, date palm and babul
 * (the acacia), plus the odd dead snag. Two rules every variant keeps, because
 * walkability was hand-verified around the old trees: the trunk is one block
 * at exactly (x, z), and nothing solid sits lower than y + 2, so a player can
 * walk under any canopy. Banyan roots are walk-through flora.
 */
export function placeTree(world, x, y, z, trunk = 3) {
  const v = hash2(x * 5 + 1, z * 7 + 2);
  if (v < 0.30) placeSal(world, x, y, z, trunk);
  else if (v < 0.44) placeBanyan(world, x, y, z, trunk);
  else if (v < 0.60) placePeepal(world, x, y, z, trunk);
  else if (v < 0.78) placePalm(world, x, y, z, trunk);
  else if (v < 0.95) placeAcacia(world, x, y, z, trunk);
  else placeSnag(world, x, y, z, trunk);
}

// sal: tall straight trunk, a dense crown taller than it is wide
function placeSal(world, x, y, z, trunk) {
  const h = trunk + 2;
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD);
  const tint = hash2(x * 3, z * 5) < 0.6 ? B.LEAVES : B.LEAVES_DARK;
  const top = y + h;
  for (let dy = -2; dy <= 2; dy++) {
    const r = dy === -2 || dy === 2 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (r === 2 && Math.abs(dx) + Math.abs(dz) === 3 && hash2(x + dx * 7, z + dz * 3 + dy) > 0.7) continue;
        leaf(world, x + dx, top + dy, z + dz, tint);
      }
    }
  }
  leaf(world, x, top + 3, z, tint);
}

// banyan: short thick-looking trunk, a very wide low dome, and aerial roots
// hanging from the rim of the canopy to the ground
function placeBanyan(world, x, y, z, trunk) {
  const h = Math.max(3, trunk);
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD);
  const base = y + h - 1; // canopy underside: never below y + 2
  for (let dy = 0; dy <= 2; dy++) {
    const R = dy === 0 ? 3.6 : dy === 1 ? 3.2 : 2.1;
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > R) continue;
        if (dy === 0 && d > 2.6 && hash2(x + dx * 5, z + dz * 9) > 0.78) continue;
        leaf(world, x + dx, base + dy, z + dz, B.LEAVES_DARK);
      }
    }
  }
  // roots: a few hanging cords from the canopy rim down to the ground. Flora
  // only fills air, and a root never lands on the trunk's own column.
  for (const [dx, dz] of [[3, 1], [-2, 3], [-3, -1], [1, -3], [2, 2]]) {
    if (hash2(x + dx * 11, z + dz * 13) < 0.35) continue;
    const rx = x + dx, rz = z + dz;
    for (let yy = base - 1; yy >= y; yy--) {
      if (world.get(rx, yy, rz) !== B.AIR) break;
      world.setRaw(rx, yy, rz, B.ROOTS);
    }
  }
}

// peepal: a spreading, open, bright crown with a ragged edge
function placePeepal(world, x, y, z, trunk) {
  const h = trunk + 1;
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD);
  const top = y + h;
  for (let dy = -1; dy <= 2; dy++) {
    const R = dy === -1 ? 2.4 : dy === 0 ? 2.9 : dy === 1 ? 2.3 : 1.2;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > R) continue;
        if (d > R - 1 && hash2(x + dx * 3 + dy, z + dz * 7) > 0.66) continue;
        leaf(world, x + dx, top + dy, z + dz, B.LEAVES_BRIGHT);
      }
    }
  }
}

// date palm: a tall ringed trunk (WOOD_BIRCH's banding) with a crown of
// fronds that reach out and droop at the tips
function placePalm(world, x, y, z, trunk) {
  const h = trunk + 3 + Math.floor(hash2(x * 7, z * 3) * 2);
  for (let i = 0; i < h; i++) world.setRaw(x, y + i, z, B.WOOD_BIRCH);
  const top = y + h;
  leaf(world, x, top, z, B.LEAVES);
  leaf(world, x, top + 1, z, B.LEAVES_BRIGHT);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const diag = dx !== 0 && dz !== 0;
    leaf(world, x + dx, top, z + dz, B.LEAVES_BRIGHT);
    if (!diag) {
      leaf(world, x + dx * 2, top, z + dz * 2, B.LEAVES_BRIGHT);
      leaf(world, x + dx * 3, top - 1, z + dz * 3, B.LEAVES); // drooping tip
    } else if (hash2(x + dx * 5, z + dz * 5) > 0.4) {
      leaf(world, x + dx * 2, top - 1, z + dz * 2, B.LEAVES);
    }
  }
}

// babul (acacia): wide, flat-topped canopy on a shortish trunk
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
