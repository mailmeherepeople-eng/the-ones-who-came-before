// World-state builders. Acts swap whole states; Act 2's dial scrubs through
// growth keyframes (design doc §7.3). All structures are voxel; small props
// (fires, shelves) are added by act scripts.
import { WORLD } from '../constants.js';
import { B, isCross } from './blocks.js';
import { buildBase, SITES, placeTree, riverX } from './terrain.js';

function ground(world, x, z) { return world.topAt(x, z); }

// strip walk-through flora hovering above a column — used after a build
// converts the ground under it (pads, paths, farmland). Visual only.
function clearFlora(world, x, z) {
  const h = world.topAt(x, z);
  for (let y = h + 1; y <= Math.min(WORLD.SIZE_Y - 1, h + 8); y++) {
    if (isCross(world.get(x, y, z))) world.setRaw(x, y, z, B.AIR);
  }
}

// era dressing: clustered flowers ringing a structure (walk-through deco only)
function scatterFlowers(world, cx, cz, r0 = 3, r1 = 6, chance = 0.3) {
  for (let x = cx - r1; x <= cx + r1; x++)
    for (let z = cz - r1; z <= cz + r1; z++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
      if (d < r0 || d > r1) continue;
      const h = world.topAt(x, z);
      if (world.get(x, h, z) !== B.GRASS || world.get(x, h + 1, z) !== B.AIR) continue;
      const rr = ((x * 374761 + z * 668265) % 97) / 97;
      if (rr > chance) continue;
      const f = rr < chance * 0.4 ? B.FLOWER_YELLOW : rr < chance * 0.75 ? B.FLOWER_WHITE : B.FLOWER_RED;
      world.setRaw(x, h + 1, z, f);
    }
}

function clearBox(world, x0, z0, x1, z1, yTop = WORLD.SIZE_Y - 1) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const h = world.topAt(x, z);
      for (let y = h + 1; y <= yTop; y++) world.setRaw(x, y, z, B.AIR);
    }
}

// small round hut: wattle ring + thatch roof
export function buildHut(world, cx, cz, r = 2, door = 0 /*0:+z 1:-z 2:+x 3:-x*/) {
  const h = ground(world, cx, cz);
  // flatten pad
  for (let x = cx - r - 1; x <= cx + r + 1; x++)
    for (let z = cz - r - 1; z <= cz + r + 1; z++) {
      const th = world.topAt(x, z);
      for (let y = h + 1; y <= th; y++) world.setRaw(x, y, z, B.AIR);
      for (let y = th + 1; y <= h; y++) world.setRaw(x, y, z, B.DIRT);
      if (world.get(x, h, z) !== B.AIR) world.setRaw(x, h, z, B.PATH);
      clearFlora(world, x, z);
    }
  for (let x = cx - r; x <= cx + r; x++)
    for (let z = cz - r; z <= cz + r; z++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
      if (d === r) {
        const isDoor =
          (door === 0 && z === cz + r && x === cx) ||
          (door === 1 && z === cz - r && x === cx) ||
          (door === 2 && x === cx + r && z === cz) ||
          (door === 3 && x === cx - r && z === cz);
        if (!isDoor) {
          world.setRaw(x, h + 1, z, B.WATTLE);
          world.setRaw(x, h + 2, z, B.WATTLE);
        }
      }
    }
  // roof
  for (let rr = r; rr >= 0; rr--) {
    const y = h + 3 + (r - rr);
    for (let x = cx - rr; x <= cx + rr; x++)
      for (let z = cz - rr; z <= cz + rr; z++) {
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) === rr) world.setRaw(x, y, z, B.THATCH);
      }
  }
  return h;
}

export function buildTent(world, cx, cz) {
  const h = ground(world, cx, cz);
  for (let dz = -1; dz <= 1; dz++) {
    world.setRaw(cx - 1, h + 1, cz + dz, B.WATTLE);
    world.setRaw(cx + 1, h + 1, cz + dz, B.WATTLE);
    world.setRaw(cx, h + 2, cz + dz, B.THATCH);
  }
  return h;
}

export function buildPen(world, cx, cz, r = 3) {
  const h = ground(world, cx, cz);
  for (let x = cx - r; x <= cx + r; x++)
    for (let z = cz - r; z <= cz + r; z++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
      const th = world.topAt(x, z);
      if (d === r && !(z === cz + r && (x === cx || x === cx + 1))) {
        world.setRaw(x, th + 1, z, B.WOOD);
      }
    }
  return h;
}

export function buildGranary(world, cx, cz) {
  const h = ground(world, cx, cz);
  // raised store: stilts + box
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    world.setRaw(cx + dx, h + 1, cz + dz, B.WOOD);
  }
  for (let x = cx - 1; x <= cx + 1; x++)
    for (let z = cz - 1; z <= cz + 1; z++) {
      world.setRaw(x, h + 2, z, B.WOOD);
      if (Math.abs(x - cx) === 1 || Math.abs(z - cz) === 1) world.setRaw(x, h + 3, z, B.WATTLE);
      world.setRaw(x, h + 4, z, B.THATCH);
    }
  return h;
}

export function buildKiln(world, cx, cz) {
  const h = ground(world, cx, cz);
  for (let x = cx - 1; x <= cx + 1; x++)
    for (let z = cz - 1; z <= cz + 1; z++) {
      world.setRaw(x, h + 1, z, B.MUDBRICK);
      if (Math.abs(x - cx) + Math.abs(z - cz) <= 1) world.setRaw(x, h + 2, z, B.MUDBRICK);
    }
  world.setRaw(cx, h + 2, cz, B.CHARCOAL);
  world.setRaw(cx, h + 1, cz + 1, B.AIR); // mouth
  return h;
}

export function buildFields(world, cx, cz, planted = true, w = 5, d = 4) {
  const plots = [];
  for (let x = cx - w; x <= cx + w; x++)
    for (let z = cz - d; z <= cz + d; z++) {
      const h = world.topAt(x, z);
      if (world.get(x, h, z) === B.GRASS || world.get(x, h, z) === B.SAND) {
        world.setRaw(x, h, z, B.FARMLAND);
        if (isCross(world.get(x, h + 1, z))) world.setRaw(x, h + 1, z, B.AIR);
        // plant in ROWS (furrows), not a 1×1 checker — from the sky camera a
        // strict checkerboard of pale crop tops on dark farmland read as a
        // missing-texture patch. Every other column, with a seeded gap or two,
        // reads as deliberate crop rows.
        if (planted && x % 2 === 0 && (x * 7 + z * 13) % 11 !== 0) {
          world.setRaw(x, h + 1, z, B.CROP);
          plots.push({ x, z });
        }
      }
    }
  return plots;
}

export function buildPath(world, from, to) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + ((to.x - from.x) * i) / steps);
    const z = Math.round(from.z + ((to.z - from.z) * i) / steps);
    for (const [dx, dz] of [[0, 0], [1, 0]]) {
      const h = world.topAt(x + dx, z + dz);
      if (h > WORLD.WATER_LEVEL - 1 && world.get(x + dx, h, z + dz) === B.GRASS) {
        world.setRaw(x + dx, h, z + dz, B.PATH);
        if (isCross(world.get(x + dx, h + 1, z + dz))) world.setRaw(x + dx, h + 1, z + dz, B.AIR);
      }
    }
  }
}

// ---------- the old log crossing ----------
// Three trunks laid across the river at bank height, at the ford the band has
// always used: the valley's one dry way over, and a plain sign that people
// have crossed here long before today. Deck sits at WATER_LEVEL + 1, which is
// exactly the height buildBase caps the near banks to, so both ends are flush
// — no step, no jump. Laid outward from the river centre and stopped at the
// first dry column on each side, so it can never leave planks floating over
// open ground. Middle trunk is pale birch so three separate logs read at a
// glance instead of one plank floor.
export const CROSSING_Z = 37; // on the walk line from the camp to the plains
export function buildLogCrossing(world, z0 = CROSSING_Z) {
  const deckY = WORLD.WATER_LEVEL + 1;
  for (let dz = -1; dz <= 1; dz++) {
    const z = z0 + dz;
    if (z < 0 || z >= WORLD.SIZE_Z) continue;
    const rx = Math.round(riverX(z));
    const log = dz === 0 ? B.WOOD_BIRCH : B.WOOD;
    for (const dir of [-1, 1]) {
      for (let i = dir < 0 ? 0 : 1; i <= 10; i++) {
        const x = rx + dir * i;
        if (x < 0 || x >= WORLD.SIZE_X) break;
        if (world.topAt(x, z) >= deckY) break; // reached the dry bank
        world.setRaw(x, deckY, z, log);
        // keep the walkway clear of reeds / stray flora
        for (let y = deckY + 1; y <= deckY + 2; y++) world.setRaw(x, y, z, B.AIR);
      }
    }
  }
}

function buildBerries(world, bare = false) {
  for (const b of SITES.berries) {
    const h = world.topAt(b.x, b.z);
    world.setRaw(b.x, h + 1, b.z, bare ? B.BUSH_BARE : B.BUSH);
  }
}

// ---------- full scene states ----------

export function buildSceneA(world, { depleted = false } = {}) {
  buildBase(world, { ice: true, riverWidth: 1.8, lush: 0.3 });
  buildBerries(world, depleted);
  buildLogCrossing(world);
  buildTent(world, SITES.campA.x - 3, SITES.campA.z + 1);
  buildTent(world, SITES.campA.x + 3, SITES.campA.z + 2);
}

export function buildSceneB(world) {
  buildBase(world, { ice: false, riverWidth: 3.2, lush: 0.75 });
  buildBerries(world, false);
  buildLogCrossing(world);
  buildTent(world, SITES.camp2.x - 2, SITES.camp2.z);
  buildTent(world, SITES.camp2.x + 2, SITES.camp2.z + 1);
}

export function buildSceneC(world) {
  buildBase(world, { ice: false, riverWidth: 3.2, lush: 0.8 });
  buildBerries(world, false);
  buildLogCrossing(world);
  const v = SITES.village;
  buildHut(world, v.x - 4, v.z - 2, 2, 0);
  buildHut(world, v.x + 3, v.z - 4, 2, 0);
  buildHut(world, SITES.playerHut.x, SITES.playerHut.z, 2, 0);
  buildGranary(world, SITES.granary.x, SITES.granary.z);
  buildPen(world, SITES.pen.x, SITES.pen.z, 3);
  buildFields(world, SITES.fields.x, SITES.fields.z, false);
  buildPath(world, { x: v.x - 4, z: v.z - 2 }, SITES.granary);
  // settled-life dressing: flower patches around the young village
  scatterFlowers(world, v.x - 4, v.z - 2);
  scatterFlowers(world, v.x + 3, v.z - 4);
  scatterFlowers(world, SITES.playerHut.x, SITES.playerHut.z);
}

export function buildSceneD(world) {
  buildBase(world, { ice: false, riverWidth: 3.2, lush: 0.85 });
  buildLogCrossing(world);
  const v = SITES.village;
  buildHut(world, v.x - 4, v.z - 2, 2, 0);
  buildHut(world, v.x + 3, v.z - 4, 2, 0);
  buildHut(world, v.x + 6, v.z + 2, 2, 3);
  buildHut(world, v.x - 7, v.z + 4, 2, 2);
  buildHut(world, v.x + 1, v.z + 7, 2, 1);
  buildHut(world, SITES.playerHut.x, SITES.playerHut.z, 2, 0);
  buildGranary(world, SITES.granary.x, SITES.granary.z);
  buildPen(world, SITES.pen.x, SITES.pen.z, 4);
  buildKiln(world, SITES.kiln.x, SITES.kiln.z);
  buildFields(world, SITES.fields.x, SITES.fields.z, true);
  buildFields(world, SITES.farField.x, SITES.farField.z, true, 3, 3);
  buildPath(world, SITES.village, SITES.neighbour);
  // neighbour village
  const n = SITES.neighbour;
  buildHut(world, n.x - 3, n.z - 2, 2, 1);
  buildHut(world, n.x + 3, n.z - 1, 2, 1);
  buildHut(world, n.x, n.z + 3, 2, 1);
  // mature-village dressing: flowers between the huts and by the granary
  scatterFlowers(world, v.x - 4, v.z - 2);
  scatterFlowers(world, v.x + 6, v.z + 2);
  scatterFlowers(world, v.x + 1, v.z + 7);
  scatterFlowers(world, SITES.playerHut.x, SITES.playerHut.z);
  scatterFlowers(world, SITES.granary.x, SITES.granary.z, 2, 5, 0.25);
  scatterFlowers(world, n.x, n.z, 4, 8, 0.22);
}

// ---------- diorama edge dressing (SKY mode only) ----------
// The sky camera sees the world's cut edges: sheer 10–20 block cross-section
// walls at the boundary that read as raw beige chunk cliffs (the parchment
// skirt hangs OUTSIDE the world, so it can never cover these interior-facing
// faces). Retone the outer two rings of columns into warm sedimentary strata
// bands — the diorama's cut edge becomes a deliberate geological section,
// matching the fossil-cliff "layers = time" read of this act. Only natural
// underground blocks are touched; every column's top block (grass/snow/sand)
// is left alone, so silhouettes and collision never change.
const EDGE_NATURAL = new Set([B.DIRT, B.STONE, B.ROCK, B.ROCK_DARK, B.SAND, B.STERILE, B.MOUND]);
function dressEdgeStrata(world) {
  const SX = WORLD.SIZE_X, SZ = WORLD.SIZE_Z;
  const bandAt = (y) => (y >= 13 ? B.STRATA_D : y >= 9 ? B.STRATA_C : y >= 5 ? B.STRATA_B : B.STRATA_A);
  const dress = (x, z) => {
    const top = world.topAt(x, z);
    for (let y = 1; y < top; y++) {
      if (EDGE_NATURAL.has(world.get(x, y, z))) world.setRaw(x, y, z, bandAt(y));
    }
  };
  for (let x = 0; x < SX; x++) { dress(x, 0); dress(x, 1); dress(x, SZ - 1); dress(x, SZ - 2); }
  for (let z = 2; z < SZ - 2; z++) { dress(0, z); dress(1, z); dress(SX - 1, z); dress(SX - 2, z); }
}

// Act 2 keyframes, oldest → newest. Each is a full world build.
// stage: 0 campA · 1 camp2 (moved) · 2 hamlet · 3 village · 4 larger village
//        5 abandoned/decaying · 6 grassed low mound · 7 present day
// edgeStrata: act 2 passes true (sky camera sees the cut edges); act 3's
// ground-mode rebuild keeps the plain look.
export function buildStage(world, stage, edgeStrata = false) {
  switch (stage) {
    case 0: buildSceneA(world); break;
    case 1: buildSceneB(world); break;
    case 2: buildSceneC(world); break;
    case 3: buildSceneD(world); break;
    case 4: {
      buildSceneD(world);
      const v = SITES.village;
      buildHut(world, v.x - 10, v.z - 1, 2, 2);
      buildHut(world, v.x + 9, v.z + 6, 2, 3);
      buildHut(world, v.x - 2, v.z + 10, 2, 1);
      const n = SITES.neighbour;
      buildHut(world, n.x - 6, n.z + 2, 2, 1);
      buildHut(world, n.x + 5, n.z + 4, 2, 1);
      break;
    }
    case 5: {
      buildBase(world, { ice: false, riverWidth: 3.4, lush: 0.9 });
      const v = SITES.village;
      // ruins: wattle stumps, collapsed thatch
      for (const [hx, hz] of [[v.x - 4, v.z - 2], [v.x + 3, v.z - 4], [SITES.playerHut.x, SITES.playerHut.z]]) {
        const h = ground(world, hx, hz);
        for (let x = hx - 2; x <= hx + 2; x++)
          for (let z = hz - 2; z <= hz + 2; z++) {
            if (Math.max(Math.abs(x - hx), Math.abs(z - hz)) === 2 && (x + z) % 2 === 0) {
              world.setRaw(x, h + 1, z, B.WATTLE);
            }
          }
      }
      break;
    }
    case 6:
    case 7:
      buildBase(world, { ice: false, riverWidth: 3.4, lush: 0.9 });
      buildMoundOn(world);
      if (stage === 7) buildPresentDay(world);
      break;
    default: buildSceneA(world);
  }
  if (edgeStrata) dressEdgeStrata(world);
}

// the grassed mound over the village footprint
export function buildMoundOn(world) {
  const v = SITES.village;
  const R = 14;
  for (let x = v.x - R; x <= v.x + R; x++)
    for (let z = v.z - R; z <= v.z + R; z++) {
      const d = Math.hypot(x - v.x, z - v.z);
      if (d > R) continue;
      const h = world.topAt(x, z);
      const rise = Math.round(Math.max(0, (1 - d / R) * 4));
      for (let y = h + 1; y <= h + rise; y++) {
        world.setRaw(x, y, z, y === h + rise ? B.GRASS : B.MOUND);
      }
    }
}

// ---------- Act 2 band drift (decor-only, transient) ----------
// While the dial scrubs WITHIN one era stage, act 2 crosses "year bands" and
// calls this so time visibly passes between the coarse buildStage keyframes.
// Strictly decorative: only GRASS-topped open columns are touched (never
// structures, farmland, paths, water), writes go through world.set so dirty
// chunks remesh automatically, and every write is a pure function of the band
// index — re-crossing a band is idempotent, and any buildStage / buildScene
// rebuild wipes all drift. Walkable-era layouts are therefore never altered.
// NOTE: shifts must be UNSIGNED (>>>). With signed >>, bit 31 of h and of
// (h >> 16) are always equal, so `h ^ (h >> 16)` always has a zero top bit and
// the hash never reaches 0.5 — every drift column landed in the x<64/z<64
// quadrant, diagonally opposite the village the sky camera frames (that was
// the "valley is pixel-identical across millennia" defect).
function hashB(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// weighted churn palette: mostly grass/air so the meadow breathes, with
// occasional blooms so a band crossing is unmistakable up close
const DRIFT_PICKS = [
  B.TALLGRASS, B.AIR, B.FLOWER_YELLOW, B.TALLGRASS, B.FERN, B.AIR,
  B.FLOWER_WHITE, B.TALLGRASS, B.FLOWER_RED, B.AIR, B.SHRUB_BERRY, B.AIR,
];

export function applyBandDrift(world, band, stage, moundAge = 0) {
  // 1) meadow churn: seeded open grass columns swap their ground cover.
  // First 48 spread over the whole map; the last 24 are seeded inside a disc
  // around the village so the area the sky camera actually frames always
  // gets a visible share of the churn.
  for (let i = 0; i < 72; i++) {
    let x, z;
    if (i < 48) {
      x = Math.floor(hashB(band * 5 + 11, i * 7 + 3) * WORLD.SIZE_X);
      z = Math.floor(hashB(band * 9 + 29, i * 13 + 17) * WORLD.SIZE_Z);
    } else {
      const a = hashB(band * 11 + 53, i * 7 + 3) * Math.PI * 2;
      const r = 4 + Math.sqrt(hashB(band * 13 + 67, i * 13 + 17)) * 32;
      x = Math.round(SITES.village.x + Math.cos(a) * r);
      z = Math.round(SITES.village.z + Math.sin(a) * r);
    }
    const h = world.topAt(x, z);
    if (h < WORLD.WATER_LEVEL) continue;
    if (world.get(x, h, z) !== B.GRASS) continue;
    const above = world.get(x, h + 1, z);
    if (above !== B.AIR && !isCross(above)) continue;
    const pick = DRIFT_PICKS[Math.floor(hashB(band + i * 3, x * 31 + z) * DRIFT_PICKS.length)];
    world.set(x, h + 1, z, pick);
  }

  // 2) bush blobs pop in and out — small leafy reads that register even from
  // 70 units up (single flowers are subtle at that distance; a 1–2 block bush
  // is not). Retired the same way they were planted, on the band's own spots.
  // Half roam the map, half stay in the village disc the camera frames.
  for (let i = 0; i < 14; i++) {
    let x, z;
    if (i < 7) {
      x = Math.floor(hashB(band * 3 + 71, i * 11 + 5) * WORLD.SIZE_X);
      z = Math.floor(hashB(band * 7 + 43, i * 17 + 9) * WORLD.SIZE_Z);
    } else {
      const a = hashB(band * 17 + 91, i * 11 + 5) * Math.PI * 2;
      const r = 6 + Math.sqrt(hashB(band * 19 + 87, i * 17 + 9)) * 28;
      x = Math.round(SITES.village.x + Math.cos(a) * r);
      z = Math.round(SITES.village.z + Math.sin(a) * r);
    }
    let h = world.topAt(x, z);
    while (h > 0 && world.get(x, h, z) === B.BUSH) { world.set(x, h, z, B.AIR); h--; }
    if (h < WORLD.WATER_LEVEL) continue;
    if (world.get(x, h, z) !== B.GRASS) continue;
    const above = world.get(x, h + 1, z);
    if (above !== B.AIR && !isCross(above)) continue;
    if (hashB(band, i * 29 + 1) < 0.6) {
      world.set(x, h + 1, z, B.BUSH);
      if (hashB(band, i * 31 + 2) < 0.4) world.set(x, h + 2, z, B.BUSH);
    }
  }

  // 3) mound dressing (grassed-mound stages): fixed seeded patches on the
  // dome start as bare MOUND earth and green over as moundAge → 1, with grass
  // tufts creeping up — the mound visibly settles and greens over millennia.
  // Only the TOP block's type flips (GRASS↔MOUND): geometry and the mound
  // footprint acts 1/3 depend on are untouched.
  if (stage >= 6) {
    const v = SITES.village, R = 13;
    for (let i = 0; i < 34; i++) {
      const a = hashB(i * 3 + 1, 97) * Math.PI * 2;
      const r = Math.sqrt(hashB(i * 5 + 2, 131)) * R;
      const x = Math.round(v.x + Math.cos(a) * r);
      const z = Math.round(v.z + Math.sin(a) * r);
      const h = world.topAt(x, z);
      const top = world.get(x, h, z);
      if (top !== B.GRASS && top !== B.MOUND) continue;
      const bare = hashB(i * 7 + 3, 53) > moundAge; // young mound: mostly bare
      world.set(x, h, z, bare ? B.MOUND : B.GRASS);
      const above = world.get(x, h + 1, z);
      if (above === B.AIR || isCross(above)) {
        world.set(x, h + 1, z, !bare && hashB(i * 11 + 7, 59) < 0.55 ? B.TALLGRASS : B.AIR);
      }
    }
  }
}

export function buildPresentDay(world) {
  // modern village SW + dig camp + survey clutter zone (props added by act 3)
  const m = SITES.modernVillage;
  buildHut(world, m.x - 3, m.z - 2, 2, 0);
  buildHut(world, m.x + 3, m.z - 2, 2, 0);
  buildHut(world, m.x, m.z + 3, 2, 1);
  buildPath(world, m, SITES.digCamp);
  buildTent(world, SITES.digCamp.x - 2, SITES.digCamp.z);
  buildTent(world, SITES.digCamp.x + 2, SITES.digCamp.z + 1);

  // ---- village charm (block-level only; prop factories are act-owned) ----
  // lanes between the three huts, and out to the well
  buildPath(world, { x: m.x - 3, z: m.z - 2 }, { x: m.x + 3, z: m.z - 2 });
  buildPath(world, { x: m.x - 3, z: m.z - 2 }, { x: m.x, z: m.z + 3 });
  buildPath(world, { x: m.x + 3, z: m.z - 2 }, { x: m.x, z: m.z + 3 });
  // the village well, WEST of the huts — clear of the walk lines to the dig
  // camp (east) and the mound (north-east). Mudbrick rim, water inside, two
  // posts and a little thatch shade roof.
  const wx = m.x - 8, wz = m.z - 1;
  const wh = world.topAt(wx, wz);
  for (let x = wx - 1; x <= wx + 1; x++)
    for (let z = wz - 1; z <= wz + 1; z++) {
      const th = world.topAt(x, z);
      for (let y = th + 1; y <= wh + 4; y++) world.setRaw(x, y, z, B.AIR);
      if (x === wx && z === wz) {
        world.setRaw(x, wh, z, B.WATER);
      } else {
        world.setRaw(x, wh + 1, z, B.MUDBRICK);
      }
    }
  world.setRaw(wx - 1, wh + 2, wz, B.WOOD);
  world.setRaw(wx + 1, wh + 2, wz, B.WOOD);
  world.setRaw(wx - 1, wh + 3, wz, B.WOOD);
  world.setRaw(wx + 1, wh + 3, wz, B.WOOD);
  for (let x = wx - 1; x <= wx + 1; x++) world.setRaw(x, wh + 4, wz, B.THATCH);
  buildPath(world, { x: m.x - 3, z: m.z - 2 }, { x: wx + 1, z: wz });
  // flower patches between and around the huts, and a couple of shade trees
  // on the safe west/south side
  scatterFlowers(world, m.x - 3, m.z - 2, 3, 6, 0.34);
  scatterFlowers(world, m.x + 3, m.z - 2, 3, 6, 0.3);
  scatterFlowers(world, m.x, m.z + 3, 3, 6, 0.34);
  scatterFlowers(world, wx, wz, 2, 4, 0.4);
  placeTree(world, m.x - 8, world.topAt(m.x - 8, m.z + 6) + 1, m.z + 6, 3);
  placeTree(world, m.x + 1, world.topAt(m.x + 1, m.z + 8) + 1, m.z + 8, 2);

  // a few present-day trees on the mound top
  const v = SITES.village;
  placeTree(world, v.x + 2, world.topAt(v.x + 2, v.z - 3) + 1, v.z - 3, 3);
}

export { SITES, clearBox };
