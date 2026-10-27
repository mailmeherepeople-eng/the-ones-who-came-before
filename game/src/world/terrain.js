// Deterministic valley terrain. One valley, one river, a north cliff with a
// rock shelter, plains east, meadow west (design doc §4).
import { WORLD } from '../constants.js';
import { B, isOpaque } from './blocks.js';

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
  timelineHomes: { x: 89, z: 49 }, // visible in the portrait sky camera, away from the old mound
  timelineMarket: { x: 86, z: 65 },
  timelineFields: { x: 95, z: 83 },
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
  return 60 + 14 * Math.sin(z / WORLD.CORE_SIZE * Math.PI * 1.35 + 0.9) + 3 * noise2(z * 0.07, 3.7);
}

export function groundHeight(x, z) {
  const n = noise2(x * 0.06, z * 0.06) * 2.2 + noise2(x * 0.16, z * 0.16) * 1.1;
  let h = 7.5 + n;
  // valley dip toward the river
  const dr = Math.abs(x - riverX(z));
  h -= Math.max(0, 3.2 - dr * 0.35);
  // edge hills
  // Old boundary ridges stay in place; their far slopes lead to the new land.
  const core = WORLD.CORE_SIZE;
  const ex = x < core ? Math.min(x, core - 1 - x) : Math.min(SX - 1 - x, x - core);
  const ez = z < core ? core - 1 - z : Math.min(SZ - 1 - z, z - core);
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
  carveWaterfall(world, ice);
  scatterVegetation(world, lush, ice);
  carveTrainingCave(world, ice);
  dressOutlands(world, lush, ice);
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
// river runs on the gorge floor raised to y 14, below the slot walls on both
// sides, back to the world's edge.
const FALLS_Z = 11; // the last row of the raised gorge floor
const FALLS_RX = Math.round(riverX(FALLS_Z));
const FALLS_POOL = 14; // the upper river's water cell height
export const WATERFALL = {
  x0: FALLS_RX - 3, x1: FALLS_RX + 4,      // the sheet spans these x (cells x0..x1-1)
  face: FALLS_Z + 1,                       // the lip's south face, where the water leaves it
  top: FALLS_POOL + 0.85, bottom: WATER_LEVEL + 0.85, // water surface on the lip, and in the pool
  lip: { x: FALLS_RX, y: FALLS_POOL, z: FALLS_Z }, // main.js shows the sheet while this cell is water
};
function carveWaterfall(world, ice) {
  for (let z = 0; z <= FALLS_Z; z++) {
    for (let x = FALLS_RX - 7; x <= FALLS_RX + 7; x++) {
      if (world.topAt(x, z) > FALLS_POOL) continue; // slot wall: already higher
      const channel = x >= WATERFALL.x0 && x < WATERFALL.x1;
      const top = channel ? FALLS_POOL - 1 : FALLS_POOL + 1; // banks stand above the water
      for (let y = 0; y <= top; y++) world.setRaw(x, y, z, y >= top - 1 ? B.ROCK : B.STONE);
      for (let y = top + 1; y < SY; y++) world.setRaw(x, y, z, B.AIR);
      if (channel) world.setRaw(x, FALLS_POOL, z, ice ? B.ICE : B.WATER);
    }
  }
  if (ice) {
    // the frozen curtain, one block proud of the lip
    for (let x = WATERFALL.x0 + 1; x < WATERFALL.x1 - 1; x++) {
      for (let y = WATER_LEVEL; y <= FALLS_POOL; y++) world.setRaw(x, y, WATERFALL.face, B.ICE);
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

function dressOutlands(world, lush, ice) {
  // New trees do not re-seed vegetation in the original valley.
  for (let i=0;i<55;i++) {
    const x=Math.floor(hash2(i+711,91)*(SX-12))+6;
    const z=Math.floor(hash2(i+941,73)*(SZ-30))+24;
    if (x<WORLD.CORE_SIZE+4 && z<WORLD.CORE_SIZE+4) continue;
    if (Math.abs(x-riverX(z))<SOLID_RIVER_CLEARANCE || nearSite(x,z,5)) continue;
    const h=grassTopAt(world,x,z);
    if(h<0) continue;
    if(ice) placeSnag(world,x,h+1,z,3);
    else placeTree(world,x,h+1,z,3+Math.floor(lush*2));
  }
  // A readable grove and a forageable meadow reward leaving the main route.
  for (const [dx,dz] of [[-7,-4],[0,-7],[7,-3],[-6,5],[6,6]]) {
    const x=SITES.eastGrove.x+dx,z=SITES.eastGrove.z+dz,h=grassTopAt(world,x,z);
    if(h>=0) { if(ice)placeSnag(world,x,h+1,z,4); else placeTree(world,x,h+1,z,4); }
  }
  for(let i=0;i<16;i++) {
    const x=SITES.southMeadow.x-9+(i*7)%19,z=SITES.southMeadow.z-7+(i*11)%15;
    const h=grassTopAt(world,x,z);
    if(h>=0)world.setRaw(x,h+1,z,i%3===0?B.SHRUB_BERRY:ice?B.SNOWTUFT:B.FLOWER_YELLOW);
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
