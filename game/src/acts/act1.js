// ACT 1 — LIVE. Four scenes (Band, Thaw, Roots, Fire and Clay), every beat
// from design doc §4. Player actions write ObjectRecords the later acts read.
import * as THREE from '../../vendor/three.module.js';
import { YEARS } from '../constants.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { B } from '../world/blocks.js';
import { SITES, buildSceneA, buildSceneB, buildSceneC, buildSceneD, buildFields } from '../world/states.js';
import { placeTree, riverX } from '../world/terrain.js';
import { FX } from '../fx/fx.js';
import { Npc, Animal } from '../npc/npc.js';
import { AmbientLife, jobHunt, jobFish, jobGather, jobWood, jobTend } from '../npc/ambient.js';
import * as P from '../world/props.js';
import { timingGame } from '../ui/minigames.js';
import { paintingGame } from '../ui/paint.js';
import { potGame } from '../ui/pot.js';
import { runBeats } from './beats.js';
import { skyGlimpse } from '../sky/interstitial.js';
import { wait } from '../ui/hud.js';
import { SFX } from '../audio.js';

export async function runAct1(G, resumeScene = null) {
  const scenes = [
    { id: 'a1.sceneA', run: () => sceneA(G) },
    { id: 'a1.sceneB', run: () => sceneB(G) },
    { id: 'a1.sceneC', run: () => sceneC(G) },
    { id: 'a1.sceneD', run: () => sceneD(G) },
  ];
  await runBeats(1, scenes, resumeScene);
}

// ---------- shared helpers ----------
import { clearStage } from '../main.js';
const resetStage = clearStage;

function addProp(G, prop, x, y, z) {
  if (x !== undefined) prop.group.position.set(x, y, z);
  G.renderer.scene.add(prop.group);
  G.props.push(prop);
  return prop;
}

function groundY(G, x, z) { return G.world.topAt(Math.round(x), Math.round(z)) + 1; }

// standing height on the rock-shelter floor (terrain carves the floor at y=9)
const CAVE_FLOOR_Y = 10;

// ---------- FX helpers (visual polish only — never gameplay) ----------

// ground-level fx anchor at a world column (outdoor columns only; the cave
// interior must pass explicit y — topAt sees the cliff above it)
function fxAt(G, x, z, dy = 0) { return { x, y: groundY(G, x, z) + dy, z }; }

// lit fires: every campfire/hearth gets a live FX flame + smoke column so it
// reads as burning from across the camp. Handles are stored here and retired
// by douseFires() at every scene clear (FX.clear() also retires them; the
// explicit removeHandle keeps this file honest about ownership).
let fireFx = [];
function lightFire(G, x, z, o = {}) {
  const base = fxAt(G, x, z, o.dy ?? 0.1);
  fireFx.push(
    FX.flames(base, { size: o.size ?? 0.34, rate: o.rate }),
    FX.smoke({ x: base.x, y: base.y + 0.55, z: base.z }, { rate: o.smokeRate }),
  );
  return fireFx.slice(-2);
}
function douseFires() {
  for (const h of fireFx) FX.removeHandle(h);
  fireFx = [];
}

// ---------- wayfinding beacon ----------
// ONE persistent pulsing pillar marks the current objective site (the FX
// pillar pool has 6 slots — this module owns AT MOST one at a time). Planting
// a new beacon retires the old; objectiveCue with no site (or no text) sweeps
// it, and every scene sweeps on setup/teardown so a beacon can never outlive
// its beat. `at` may carry an explicit y for cave interiors (topAt would read
// the cliff above the shelter). Always sweep via setBeacon BEFORE FX.clear()
// so this handle never goes stale against a recycled pillar slot.
let beaconH = null;
function setBeacon(G, at, color = 0xffd28a) {
  if (beaconH) { FX.removeHandle(beaconH); beaconH = null; }
  if (!at) return;
  const p = at.y !== undefined ? { x: at.x, y: at.y, z: at.z } : fxAt(G, at.x, at.z);
  // 0.22: at 0.45 the additive column saturates to a blinding white wall when
  // the player stands near it — distant visibility is still fine
  beaconH = FX.pillar(p, { color, height: 10, life: 0, opacity: 0.22, pulse: true });
}

// nearest of several candidate sites — multi-target beats (berries, shells)
// keep the single beacon on the closest remaining target
function nearestSite(G, sites) {
  let best = null, bd = Infinity;
  for (const s of sites) {
    const d = Math.hypot(G.player.pos.x - s.x, G.player.pos.z - s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// objective handoff cue: objective text, a subtle ring at the marker (when
// the target site is known) or under the player, plus the persistent beacon
// pillar at the site. Passing no site (or no text) retires the beacon.
function objectiveCue(G, text, at = null, color = 0xffe9a8) {
  G.hud.setObjective(text);
  setBeacon(G, text ? at : null, color === 0xffe9a8 ? 0xffd28a : color);
  if (!text) return;
  const p = at
    ? (at.y !== undefined ? { x: at.x, y: at.y, z: at.z } : fxAt(G, at.x, at.z))
    : { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z };
  FX.ring(p, { color, radius: 2.0, life: 0.55 });
}

// The store box, set beside the Community Chest. Everything the player brings
// home is PLACED in it: walking back to camp is not enough, the deposit is the
// act that completes a task.
//
// That is the whole point of the beat. The chapter's lesson is that the tribe's
// food and tools belong to everyone, and reading that in a narrator box is much
// weaker than being made to hand your catch over before you are allowed to do
// anything else. Set by sceneA before the first gather.
let STORE_BOX = null;
let STORE_BOX_AT = null;

async function depositAtStore(G, objectiveText, doneText) {
  if (!STORE_BOX_AT) return; // scene jumped straight past the camp setup
  objectiveCue(G, objectiveText, STORE_BOX_AT);
  await interactOnce(G, {
    id: 'store-box', x: STORE_BOX_AT.x, z: STORE_BOX_AT.z, r: 2.6, prompt: '📦',
  });
  STORE_BOX?.setFill(Math.min(1, (STORE_BOX.level || 0) + 0.34));
  G.player.equip(null); // it is in the box now, not in your hands
  const at = fxAt(G, STORE_BOX_AT.x, STORE_BOX_AT.z, 0.7);
  FX.puff(at, { count: 10, size: 0.22, life: 0.5, color: 0xd8c9a4 });
  FX.ring(at, { color: 0xffd28a, radius: 1.5, life: 0.6 });
  G.audio?.success?.();
  setBeacon(G, null);
  if (doneText) await G.hud.narrator(doneText);
}

// Make characters talkable. Registers one follow-interactable per character,
// so the 💬 prompt tracks them around their errands instead of hanging where
// they spawned.
//
// What they SAY is npc.talk, which lives on the character as plain data. The
// world editor edits it live under "when talked to", so writing tribe dialogue
// never means editing an act script.
//
// The reply is pictograms, never words. Act 1's whole language beat is that
// their speech was rich and is completely lost, and a tribe member answering
// in English would quietly undo it. The optional `note` is the player's own
// thought about the exchange, which is allowed to be words.
function makeTalkable(G, characters) {
  for (const c of characters) {
    if (!c || c.kind === 'deer' || c.kind === 'goat' || c.kind === 'cattle' || c.kind === 'predator') continue;
    G.interactables.push({
      id: `talk-${c.name}`, follow: c, r: 2.5, enabled: true, prompt: S.act1.talkPrompt,
      async onInteract() {
        if (!c.talk?.enabled) return;
        c.faceToward?.(G.player.pos.x, G.player.pos.z);
        c.say(c.talk.icons || S.act1.talkIcons[0], 3000);
        G.audio?.blip?.();
        if (c.talk.note) await G.hud.narrator(c.talk.note);
      },
    });
  }
}

// "this will matter later" — marks the creation of a source record that
// Act 3 digs up (painting, beads, arrowheads, pot…). Brief, warm, additive.
function recordTell(pos) {
  FX.flash(pos, { size: 0.9, life: 0.14 });
  FX.floaties(pos, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.7, rise: 1.1 });
}

// Scene A block dressing: the cold has to read intentional, not unfinished.
// Denser snow tufts / dead bushes around the camp basin (all walk-through
// cross flora — safe on paths), plus a few LIVE trees so the band's home
// ground feels chosen. Everything stays far west of the river strip.
function dressSceneACold(world) {
  const keepClear = [SITES.fire, SITES.knap, SITES.grave, ...SITES.berries, ...SITES.shells];
  for (let x = 26; x <= 56; x++) {
    for (let z = 16; z <= 40; z++) {
      if (keepClear.some((s) => Math.abs(x - s.x) <= 2 && Math.abs(z - s.z) <= 2)) continue;
      const h = world.topAt(x, z);
      const top = world.get(x, h, z);
      if (top !== B.GRASS && top !== B.SNOWGRASS) continue;
      if (world.get(x, h + 1, z) !== B.AIR) continue;
      // well-mixed hash (the old xor-of-products ran in rows along terrace
      // lips) + total cover ~7% so terrain's own drift-gated scatter stays
      // the dominant texture
      let hh = (x * 374761393 + z * 668265263) | 0;
      hh = Math.imul(hh ^ (hh >>> 13), 1274126177);
      const v = (((hh ^ (hh >>> 16)) >>> 0) % 1000) / 1000;
      if (v < 0.025) world.set(x, h + 1, z, B.DEADBUSH);
      else if (v < 0.07) world.set(x, h + 1, z, B.SNOWTUFT);
    }
  }
  // live trees near the camp (grass only, off the walk lines to every beat
  // site, > 20 blocks from the river centre at these z)
  for (const [tx, tz] of [[31, 26], [28, 28], [47, 33], [52, 22], [44, 37]]) {
    const h = world.topAt(tx, tz);
    if (world.get(tx, h, tz) === B.GRASS && world.get(tx, h + 1, tz) === B.AIR) {
      placeTree(world, tx, h + 1, tz, 3);
    }
  }
}

// wait until the player interacts with a named point
function interactOnce(G, { id, x, z, r = 2.6, prompt }) {
  return new Promise((resolve) => {
    G.interactables.push({
      id, x, z, r, prompt, enabled: true,
      onInteract: (self) => {
        G.interactables = G.interactables.filter((o) => o !== self);
        resolve();
      },
    });
  });
}

// wait until player is within radius of a point
function reach(G, x, z, r = 3) {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  });
}

function bandIcons() {
  return ['🔥🍖', '🦌➡️', '🌿✋', '☀️🌙', '💧🐟', '🏔️👣'][Math.floor(Math.random() * 6)];
}

// ---------- bow hunting (real arrows — replaces the old timing minigame) ----------
const ARROW_SPEED = 22;   // blocks/s along the camera ray
const ARROW_UPBIAS = 1.5; // blocks/s added to vy at launch
const ARROW_GRAV = 12;    // blocks/s² downward
const ARROW_LIFE = 3;     // seconds in flight before despawn
const ARROW_HIT_R = 0.9;  // hit radius against a deer's body centre
// One kill fed nobody. The tribe is six people, so the hunt asks for three
// animals: enough that the player has to re-stalk a spooked herd rather than
// land one lucky shot, and it makes the store box beat below carry real weight.
const HUNT_TARGET = 3;
const _arrowDir = new THREE.Vector3(); // scratch — synchronous use only
const _ARROW_Z = new THREE.Vector3(0, 0, 1);

// is any enabled interactable in range? main.js gives interactables first
// claim on the one-frame interact edge — the bow only looses when none is.
function interactableNear(G) {
  for (const o of G.interactables) {
    if (!o.enabled) continue;
    if (Math.hypot(G.player.pos.x - o.x, G.player.pos.z - o.z) < (o.r ?? 2.6)) return true;
  }
  return false;
}

// thin arrow: dark shaft + pale fletch, oriented along its velocity. Fresh
// geometries (disposeGroup disposes them per arrow); materials come from the
// shared prop pool, which disposeGroup deliberately skips.
function spawnArrow(G, arrows) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), P.PROP_MATS.woodDark));
  const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.12), P.PROP_MATS.bone);
  fletch.position.z = -0.24; // pale tail end
  g.add(fletch);
  g.position.set(G.player.pos.x, G.player.pos.y + 1.4, G.player.pos.z);
  G.renderer.camera.getWorldDirection(_arrowDir);
  const vel = _arrowDir.clone().multiplyScalar(ARROW_SPEED);
  vel.y += ARROW_UPBIAS;
  g.quaternion.setFromUnitVectors(_ARROW_Z, _arrowDir.copy(vel).normalize());
  const arrow = { group: g, vel, life: 0, stuck: 0 };
  G.renderer.scene.add(g);
  G.props.push(arrow); // stage teardown disposes any leftovers
  arrows.push(arrow);
  return arrow;
}

function removeArrow(G, arrows, i) {
  const a = arrows[i];
  arrows.splice(i, 1);
  G.props = G.props.filter((p) => p !== a);
  P.disposeGroup(G.renderer.scene, a.group);
}

// ---------- SCENE A — Band ----------

async function sceneA(G) {
  await G.hud.fadeOut(400);
  resetStage(G);
  setBeacon(G, null); // sweep: no beacon crosses a scene boundary
  G.player.equip(null);
  G.player.setAim(false);
  FX.clear();
  douseFires();
  buildSceneA(G.world);
  dressSceneACold(G.world);
  G.mesher.remeshAll();
  G.renderer.setSky(0xbcd3e6, 0xd4e2ec); // colder light
  // wake INSIDE the rock shelter, facing the mouth. The cave floor is y=9 so
  // the feet sit at 10 — an explicit y is required, because topAt at these
  // columns reads the cliff ABOVE the shelter and would drop us on the roof.
  G.player.teleport(SITES.shelter.x, SITES.shelter.z - 2, Math.PI, CAVE_FLOOR_Y + 0.02);
  G.mode = 'ground';

  // band of 6 (player + 5 NPCs) + elder
  const camp = SITES.campA;
  const band = [];
  const elder = new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
    x: camp.x, z: camp.z + 1, world: G.world, elder: true, name: 'elder', wander: 2,
  });
  band.push(elder);
  for (let i = 0; i < 4; i++) {
    band.push(new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: camp.x - 2 + i * 1.5, z: camp.z - 1 + (i % 2) * 2, world: G.world,
      wander: 3, child: i === 3, name: `band${i}`,
    }));
  }
  G.npcs.push(...band);
  makeTalkable(G, band); // 💬 on every tribe member, editable in the world editor

  // idle purposes: one tends the fire, one works the knap station, the child
  // stays by the warmth. Scripted goTo calls still override these freely.
  band[1].home = { x: SITES.fire.x + 1.5, z: SITES.fire.z + 1.5 }; band[1].wanderR = 2;
  band[2].home = { x: SITES.knap.x + 1, z: SITES.knap.z + 2 }; band[2].wanderR = 2;
  band[4].home = { x: SITES.fire.x - 1.5, z: SITES.fire.z + 1 }; band[4].wanderR = 1.6;

  // campfire sits ON the surface (groundY, not -1: the group's own geometry
  // starts at local y≈0, so an offset origin buries logs and flame in the
  // top ground block — that bug made the fire invisible) + live flame/smoke
  const fire = addProp(G, P.makeCampfire(SITES.fire.x, groundY(G, SITES.fire.x, SITES.fire.z), SITES.fire.z));
  lightFire(G, SITES.fire.x, SITES.fire.z);
  addProp(G, P.makeKnapStation(SITES.knap.x, groundY(G, SITES.knap.x, SITES.knap.z) - 1, SITES.knap.z));
  void fire;

  // the band's shared store: one lidded chest of tools by the camp. Front face
  // is +z, so it looks toward the camp; the spot is clear of the fire/knap/tent
  // footprints and the walk lines to the beat sites.
  const STORE_A = { x: 44, z: 22 };
  const chest = addProp(G, P.makeCommunityChest(STORE_A.x, groundY(G, STORE_A.x, STORE_A.z), STORE_A.z));
  // the open store box, two blocks along the same line so both read as one
  // station: take tools out of the chest, put food into the box
  STORE_BOX_AT = { x: STORE_A.x + 2, z: STORE_A.z };
  STORE_BOX = addProp(G, P.makeStoreBox(STORE_BOX_AT.x, groundY(G, STORE_BOX_AT.x, STORE_BOX_AT.z), STORE_BOX_AT.z));

  // REAL berry bushes: swap the BUSH blocks at the gather sites for leafy
  // props with pickable berries (world.set marks the chunks dirty; the mesher
  // flushes them over the next frames, still behind the fade)
  const berryProps = new Map();
  for (const b of SITES.berries) {
    const h = G.world.topAt(b.x, b.z);
    if (G.world.get(b.x, h, b.z) === B.BUSH) G.world.set(b.x, h, b.z, B.AIR);
    berryProps.set(b, addProp(G, P.makeBerryBush(b.x + 0.5, groundY(G, b.x, b.z), b.z + 0.5)));
  }

  // set dressing: rockfall boulders under the cliff, spoil by the knap
  // station, life over the berry meadow, cattails + driftwood back from the
  // fishing bank (≥ ~8 blocks off the river centre — exit strips stay clear),
  // dust motes hanging in the shelter mouth (cave floor is y=9, feet y=10).
  addProp(G, P.makeBoulder(33, groundY(G, 33, 21), 21, 1));
  addProp(G, P.makeBoulder(35, groundY(G, 35, 18), 18, 0.7));
  addProp(G, P.makeBoulder(54, groundY(G, 54, 26), 26, 0.8));
  addProp(G, P.makeRubblePile(34, groundY(G, 34, 23), 23));
  addProp(G, P.makeButterflies(27, groundY(G, 27, 50), 50));
  addProp(G, P.makeButterflies(31, groundY(G, 31, 58), 58));
  for (const cz of [42, 46, 50]) {
    const cx = Math.round(riverX(cz)) - 8;
    addProp(G, P.makeCattail(cx, groundY(G, cx, cz), cz));
  }
  const dwx = Math.round(riverX(48)) - 9;
  addProp(G, P.makeDriftwood(dwx, groundY(G, dwx, 48), 48, 0.6));
  addProp(G, P.makeDustMotes(SITES.shelter.x, 10, 16));

  // deer herd on the plains + shells by the river
  // Six, for a hunt that asks for three. Spooked deer scatter and drift back
  // to their own home, so the margin is what stops a bad volley from leaving
  // the player with nothing left to stalk.
  const deer = [];
  for (let i = 0; i < 6; i++) {
    deer.push(new Animal(G.renderer.scene, {
      kind: 'deer', x: SITES.plains.x - 6 + i * 2.6, z: SITES.plains.z + (i % 3) * 4, world: G.world, wander: 6,
    }));
  }
  G.npcs.push(...deer);

  // --- the band's own working day (npc/ambient.js) ---
  // A second, small herd on the meadow west of camp: this is the band
  // hunters' ground, kept well away from SITES.plains so ambient shots never
  // scatter the herd the PLAYER is stalking during the hunt beat.
  const HUNT_GROUND = { x: 31, z: 35 };
  const meadowDeer = [
    new Animal(G.renderer.scene, { kind: 'deer', x: HUNT_GROUND.x - 3, z: HUNT_GROUND.z + 4, world: G.world, wander: 5 }),
    new Animal(G.renderer.scene, { kind: 'deer', x: HUNT_GROUND.x + 4, z: HUNT_GROUND.z + 6, world: G.world, wander: 5 }),
  ];
  G.npcs.push(...meadowDeer);

  const FISH_Z = 41;
  const fishRiverX = Math.round(riverX(FISH_Z));
  const ambient = new AmbientLife(G, {
    chest, chestAt: STORE_A,
    jobs: {
      hunt: jobHunt(G, { at: HUNT_GROUND, herd: meadowDeer }),
      fish: jobFish(G, { at: { x: fishRiverX - 4, z: FISH_Z }, water: { x: fishRiverX, z: FISH_Z } }),
      gather: jobGather(G, { at: SITES.berries[5] }), // (34,48) — the near patch
      gather2: jobGather(G, { at: SITES.berries[0] }), // a second patch: no queueing
      wood: jobWood(G, { at: { x: 46, z: 32 } }),     // the stand of trees south of camp
    },
  });
  // seeded MID-CYCLE, so the valley is already busy the moment it fades in:
  // one hunter is out on the meadow, one is walking the rod home, one is
  // heading out with a basket. Nobody starts queued at the chest.
  ambient.assign(band[1], ['hunt', 'wood'], 'work');
  ambient.assign(band[2], ['fish', 'gather'], 'return');
  ambient.assign(band[3], ['gather2', 'wood'], 'outbound');
  G.props.push(ambient); // ticks with the props; clearStage drops it

  await G.hud.fadeIn(500);
  await G.hud.card([S.act1.sceneA_card, S.act1.sceneA_card2]);
  G.hud.hint(G.input.isTouch ? S.ui.joystickHint : S.ui.desktopHint, 8000);
  await G.hud.narrator(S.act1.wake);
  await G.hud.narrator(S.act1.tribeNote); // 4.32 groups help each other

  // --- gather berries (4.33) — but first, a basket from the band's store ---
  if (!Save.getRecord('gathered')) {
    objectiveCue(G, S.act1.obj_store_basket, STORE_A);
    await interactOnce(G, { id: 'store-basket', x: STORE_A.x, z: STORE_A.z, r: 2.8, prompt: '🧺' });
    chest.openFor(2000); // the lid comes up for you exactly as it does for them
    G.player.equip('basket');
    FX.flash(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { size: 0.6, life: 0.13 });
    FX.floaties(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { color: 0xffd9a0, count: 8, size: 0.1, life: 1.4 });
    await G.hud.narrator(S.act1.storeLesson); // shared tools — the one teaching line

    let got = 0;
    const berrySites = SITES.berries.slice(0, 5);
    const remaining = new Set(berrySites);
    objectiveCue(G, S.act1.obj_gather);
    setBeacon(G, nearestSite(G, [...remaining]));
    await new Promise((resolve) => {
      for (const b of berrySites) {
        G.interactables.push({
          id: `berry-${b.x}`, x: b.x, z: b.z, r: 2.4, prompt: '🫐', enabled: true,
          onInteract(self) {
            self.enabled = false;
            remaining.delete(b);
            berryProps.get(b)?.setBerries(false);
            const bp = { x: b.x + 0.5, y: groundY(G, b.x, b.z) + 0.7, z: b.z + 0.5 };
            FX.puff(bp, { count: 5, size: 0.28, life: 0.55 });
            FX.floaties(bp, { color: 0xaef0c8, count: 7, size: 0.1, life: 1.3 });
            FX.floaties(bp, { color: 0xd8503c, count: 4, size: 0.09, life: 1.1, rise: 0.9 });
            got++;
            G.hud.setObjective(S.act1.obj_gather_n(got));
            if (got >= 4) {
              // basket full!
              setBeacon(G, null);
              FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 24 });
              resolve();
            } else {
              setBeacon(G, nearestSite(G, [...remaining])); // guide to the next bush
            }
          },
        });
      }
    });
    G.interactables = G.interactables.filter((o) => !String(o.id).startsWith('berry-'));
    await G.hud.narrator(S.act1.gatherDone);
    await depositAtStore(G, S.act1.obj_depositBerries, S.act1.depositBerriesDone);
    await G.hud.narrator(S.act1.huntersGatherers);
    Save.addRecord({ id: 'gathered', type: 'camp', pos: { ...camp }, made: YEARS.SCENE_A_YEAR, data: { label: 'gather' } });
  }

  // --- hunt (real bow: fetch the bow, stalk the plains, loose arrows) ---
  if (!Save.getRecord('hunted')) {
    objectiveCue(G, S.act1.obj_store_bow, STORE_A);
    await interactOnce(G, { id: 'store-bow', x: STORE_A.x, z: STORE_A.z, r: 2.8, prompt: '🏹' });
    chest.openFor(2000);
    G.player.equip('bow'); // swap: the basket goes back for the next hands
    FX.flash(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { size: 0.6, life: 0.13 });

    objectiveCue(G, S.act1.obj_hunt, SITES.plains);
    await reach(G, SITES.plains.x, SITES.plains.z, 8);
    setBeacon(G, null); // you are here, clear the sightline for aiming
    G.hud.hint(S.act1.aimHint, 7000);

    // Sighting is an explicit mode now, not "press E and hope". Take Aim drops
    // to first person with a crosshair and swaps the rail to Fire / Lower bow,
    // so on a phone the whole hunt is two big thumb targets instead of a tap
    // that competes with tap-to-interact.
    let aiming = false;
    const rail = () => {
      if (!aiming) {
        G.hud.setActions([{ label: S.ui.takeAim, primary: true, onClick: enterAim }]);
      } else {
        G.hud.setActions([
          { label: S.ui.fire, primary: true, onClick: () => { fireRequested = true; } },
          { label: S.ui.lowerBow, onClick: exitAim },
        ]);
      }
    };
    let fireRequested = false;
    const enterAim = () => { aiming = true; G.player.setFirstPerson(true); rail(); };
    const exitAim = () => { aiming = false; G.player.setFirstPerson(false); G.player.setAim(true); rail(); };
    G.player.setAim(true);
    rail();

    // arrows simulated in the act tick; resolves once HUNT_TARGET deer are down
    const arrows = [];
    const downedList = await new Promise((resolve) => {
      const bag = [];
      let hit = null; // set for one frame per kill, so a shot never double-counts
      G.tick = (dt, inp) => {
        // E / Enter still fires while aiming, for players on a keyboard
        const wantShot = fireRequested || (aiming && inp.interact && !interactableNear(G));
        fireRequested = false;
        if (bag.length < HUNT_TARGET && wantShot) spawnArrow(G, arrows);
        for (let i = arrows.length - 1; i >= 0; i--) {
          const a = arrows[i];
          if (a.stuck > 0) {
            a.stuck -= dt;
            if (a.stuck <= 0) removeArrow(G, arrows, i);
            continue;
          }
          a.vel.y -= ARROW_GRAV * dt;
          a.group.position.addScaledVector(a.vel, dt);
          a.group.quaternion.setFromUnitVectors(_ARROW_Z, _arrowDir.copy(a.vel).normalize());
          a.life += dt;
          const p = a.group.position;
          hit = null;
          for (const d of deer) {
            if (d.downed) continue;
            if (Math.hypot(p.x - d.pos.x, p.y - (d.pos.y + 0.55), p.z - d.pos.z) < ARROW_HIT_R) {
              hit = d;
              d.down();
              bag.push(d);
              FX.puff(d.pos, { count: 10, size: 0.32, life: 0.6, color: 0xb9a77e });
              for (const o of deer) {
                if (o !== d && !o.downed && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 8) {
                  o.fleeFrom(p.x, p.z); // their home stays the plains, they drift back
                }
              }
              removeArrow(G, arrows, i);
              // the tribe needs more than one animal: keep hunting until the
              // bag is full, and keep the count on screen so the goal is plain
              if (bag.length >= HUNT_TARGET) { resolve(bag); return; }
              G.hud.setObjective(S.act1.obj_huntN(bag.length, HUNT_TARGET));
              G.audio?.blip?.();
              break;
            }
          }
          if (hit) continue;
          // miss: stick in the ground for a beat, spook nearby deer
          const gy2 = G.world.topAt(Math.floor(p.x), Math.floor(p.z)) + 1 + 0.15;
          if (p.y <= gy2) {
            p.y = gy2;
            a.stuck = 0.7;
            for (const d of deer) {
              if (!d.downed && Math.hypot(d.pos.x - p.x, d.pos.z - p.z) < 5) d.fleeFrom(p.x, p.z);
            }
          } else if (a.life > ARROW_LIFE) {
            removeArrow(G, arrows, i);
          }
        }
      };
    });

    await wait(700); // the fall animation plays out
    G.tick = null;
    G.hud.clearActions();
    G.player.setFirstPerson(false);
    G.player.setAim(false);
    while (arrows.length) removeArrow(G, arrows, arrows.length - 1);

    // one carcass becomes one meat pickup; collect them all before carrying
    // the haul home, so the walk back happens once rather than three times
    const meats = [];
    for (const d of downedList) {
      const at = { x: d.pos.x, y: d.pos.y, z: d.pos.z };
      d.dispose();
      G.npcs = G.npcs.filter((n) => n !== d);
      const k = deer.indexOf(d);
      if (k >= 0) deer.splice(k, 1);
      meats.push({ at, prop: addProp(G, P.makeMeat(at.x, at.y, at.z)) });
    }
    for (let i = 0; i < meats.length; i++) {
      const m = meats[i];
      objectiveCue(G, S.act1.obj_meatN(i + 1, meats.length), m.at);
      await interactOnce(G, { id: `meat${i}`, x: m.at.x, z: m.at.z, r: 2.6, prompt: '🍖' });
      P.disposeGroup(G.renderer.scene, m.prop.group);
      G.props = G.props.filter((pp) => pp !== m.prop);
      FX.floaties({ x: m.at.x, y: m.at.y + 0.5, z: m.at.z }, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.6, rise: 1.0 });
    }
    G.player.equip('meat');
    await G.hud.narrator(S.act1.huntSuccess);
    await depositAtStore(G, S.act1.obj_depositMeat, S.act1.depositMeatDone);
    FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 18 });
    Save.addRecord({ id: 'hunted', type: 'camp', pos: { ...SITES.plains }, made: YEARS.SCENE_A_YEAR, data: { label: 'hunt', count: HUNT_TARGET } });
  }

  // --- predator tension → run to fire ---
  await G.hud.narrator(S.act1.predatorNear);
  // A bear, and it takes its time. Spawned further out than the old prowler
  // (14 blocks rather than 10) so the player gets a good look at the size
  // before it starts closing, and slow enough that walking away always works.
  const predator = new Animal(G.renderer.scene, {
    kind: 'predator', x: G.player.pos.x + 11, z: G.player.pos.z + 9, world: G.world, wander: 2, speed: 1.7,
  });
  G.npcs.push(predator);
  // fast red-tinted danger flash where it appears + dust as it breaks cover
  FX.flash(fxAt(G, predator.pos.x, predator.pos.z, 1.0), { color: 0xff5a4a, size: 1.7, life: 0.2 });
  FX.puff(predator.pos, { count: 10, size: 0.32, life: 0.6, color: 0xb0a184 });
  predator.followTarget = G.player.pos;
  objectiveCue(G, S.act1.predatorChase, SITES.fire, 0xff8a6a); // safety marker: the fire
  await reach(G, SITES.fire.x, SITES.fire.z, 5);
  setBeacon(G, null); // safe — the fire beacon has done its job
  predator.followTarget = null;
  predator.fleeFrom(SITES.fire.x, SITES.fire.z);
  FX.puff(predator.pos, { count: 12, size: 0.34, life: 0.7, color: 0xb0a184 });
  FX.ring(fxAt(G, SITES.fire.x, SITES.fire.z), { color: 0xffc98a, radius: 3.2, life: 0.8 });
  await G.hud.narrator(S.act1.predatorSafe);

  // --- fish the river (rod from the store first; the float minigame stays) ---
  if (!Save.getRecord('fished')) {
    objectiveCue(G, S.act1.obj_store_rod, STORE_A);
    await interactOnce(G, { id: 'store-rod', x: STORE_A.x, z: STORE_A.z, r: 2.8, prompt: '🎣' });
    chest.openFor(2000);
    G.player.equip('rod'); // swap: the bow goes back into the chest
    FX.flash(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { size: 0.6, life: 0.13 });
    objectiveCue(G, S.act1.obj_fish, SITES.fishSpot);
    await interactOnce(G, { id: 'fish', x: SITES.fishSpot.x, z: SITES.fishSpot.z, r: 3.4, prompt: '🎣' });
    await timingGame(G.hud.root, {
      title: S.act1.obj_fish, rounds: 1, speed: 1.5, zone: 0.65,
      failText: S.act1.fishMissed, mode: 'react',
    });
    // the catch breaks the surface: matte droplets + a couple of glints
    const splash = { x: SITES.fishSpot.x, y: G.player.pos.y + 0.25, z: SITES.fishSpot.z };
    FX.burst(splash, { color: 0xbfe4f5, count: 26, size: 0.13, speed: 3.4, life: 0.6, gravity: 9, additive: false });
    FX.burst(splash, { color: 0x9fd8ff, count: 8, size: 0.1, speed: 2.4, life: 0.45 });
    await G.hud.narrator(S.act1.fishCaught);
    await depositAtStore(G, S.act1.obj_depositFish, S.act1.depositFishDone);
    Save.addRecord({ id: 'fished', type: 'camp', pos: { ...SITES.fishSpot }, made: YEARS.SCENE_A_YEAR, data: { label: 'fish' } });
    G.player.equip(null); // the rod's task chain is done, back to the tribe
  }

  // --- fire circle: lost language (4.35) ---
  objectiveCue(G, S.act1.obj_fire, SITES.fire);
  await reach(G, SITES.fire.x, SITES.fire.z, 3.4);
  setBeacon(G, null); // seated — no beacon over the fire circle
  elder.goTo(SITES.fire.x + 1, SITES.fire.z);
  await wait(600);
  elder.faceToward(G.player.pos.x, G.player.pos.z);
  await G.hud.narrator(S.act1.elderSpeaks);
  for (const icons of ['◈ ﬦ ◇ ᨏ', 'ᨐ ◈◈ ﬦ', '◇ᨏ ﬦ ◈']) {
    elder.say(icons, 1900);
    await wait(1400);
  }
  await G.hud.narrator(S.act1.languageNote);

  // --- knapping: fire + improved tools (4.36) ---
  if (!Save.getRecord('arrowheads')) {
    objectiveCue(G, S.act1.obj_knap, SITES.knap);
    await interactOnce(G, { id: 'knap', x: SITES.knap.x, z: SITES.knap.z, prompt: '🪨' });
    await timingGame(G.hud.root, {
      title: S.act1.knapIntro, rounds: 3, speed: 1.35, zone: 0.62,
      stepText: (n) => {
        // each successful strike sparks and throws stone chips at the station
        const kp = fxAt(G, SITES.knap.x, SITES.knap.z, 0.7);
        FX.flash(kp, { size: 0.7, life: 0.12 });
        FX.burst(kp, { color: 0xd8d2c4, count: 12, size: 0.09, speed: 3.2, life: 0.45, gravity: 8 });
        return S.act1.knapStep(n);
      },
    });
    recordTell(fxAt(G, SITES.knap.x, SITES.knap.z, 0.8));
    await G.hud.narrator(S.act1.knapDone);
    Save.addRecord({ id: 'arrowheads', type: 'arrowheads', pos: { x: SITES.knap.x, z: SITES.knap.z }, made: YEARS.SCENE_A_YEAR, data: {} });
    Save.addRecord({ id: 'hearthA', type: 'hearth', pos: { ...SITES.fire }, made: YEARS.SCENE_A_YEAR, data: {} });
  }

  // --- cave painting (4.38) — SAVED VERBATIM ---
  if (!Save.getRecord('painting')) {
    // explicit y: the wall is inside the shelter — topAt would read the cliff
    objectiveCue(G, S.act1.obj_paint, { x: SITES.shelterWall.x, y: 10, z: SITES.shelterWall.z + 2 });
    await interactOnce(G, { id: 'paint', x: SITES.shelterWall.x, z: SITES.shelterWall.z + 2, r: 3, prompt: '🎨' });
    setBeacon(G, null); // at the wall — the painting UI takes over
    const { png } = await paintingGame(G.hud.root);
    Save.addRecord({
      id: 'painting', type: 'painting',
      pos: { x: SITES.shelterWall.x, z: SITES.shelterWall.z },
      made: YEARS.SCENE_A_YEAR, data: { png },
    });
    placePaintingMesh(G, png, 1);
    // warm motes drift off the finished wall + a soft ring on the cave floor
    // (fixed cave y — topAt would read the cliff above the shelter)
    const w = SITES.shelterWall;
    recordTell({ x: w.x, y: 11, z: w.z + 0.5 });
    FX.floaties({ x: w.x, y: 10.6, z: w.z + 0.4 }, { color: 0xffc98a, count: 14, size: 0.12, life: 2.2, rise: 0.8 });
    FX.ring({ x: w.x, y: 10, z: w.z + 2 }, { color: 0xffc98a, radius: 2.6, life: 0.9 });
    await G.hud.narrator(S.act1.paintDone);
    await G.hud.narrator(S.act1.paintNote);
  } else {
    placePaintingMesh(G, Save.getRecord('painting').data.png, 1);
  }

  // --- ornaments + exchange (4.39) ---
  // NOTE: beads and obsidian are guarded separately so a quit between the
  // drilling and the trade cannot permanently lose the obsidian record
  if (!Save.getRecord('beads')) {
    let shells = 0;
    const shellsLeft = new Set(SITES.shells);
    objectiveCue(G, S.act1.obj_shells);
    setBeacon(G, nearestSite(G, [...shellsLeft]));
    await new Promise((resolve) => {
      for (const s of SITES.shells) {
        const prop = addProp(G, P.makeShellPickup(s.x, groundY(G, s.x, s.z), s.z));
        G.interactables.push({
          id: `shell-${s.x}`, x: s.x, z: s.z, r: 2.4, prompt: '🐚', enabled: true,
          onInteract(self) {
            self.enabled = false;
            shellsLeft.delete(s);
            const sp = { x: s.x, y: groundY(G, s.x, s.z) + 0.3, z: s.z };
            FX.flash(sp, { size: 0.6, life: 0.13 });
            FX.floaties(sp, { color: 0xf2e3c9, count: 8, size: 0.1, life: 1.3 });
            G.renderer.scene.remove(prop.group);
            shells++;
            G.hud.setObjective(S.act1.obj_shells_n(shells));
            if (shells >= 3) { setBeacon(G, null); resolve(); }
            else setBeacon(G, nearestSite(G, [...shellsLeft]));
          },
        });
      }
    });
    objectiveCue(G, S.act1.obj_drill, SITES.knap);
    await interactOnce(G, { id: 'drill', x: SITES.knap.x, z: SITES.knap.z, prompt: '📿' });
    await timingGame(G.hud.root, {
      title: S.act1.drillIntro, rounds: 2, speed: 1.1, zone: 0.7,
      stepText: () => {
        const kp = fxAt(G, SITES.knap.x, SITES.knap.z, 0.7);
        FX.flash(kp, { size: 0.55, life: 0.12 });
        FX.burst(kp, { color: 0xf2e3c9, count: 8, size: 0.08, speed: 2.2, life: 0.4, gravity: 6 });
        return '✓';
      },
    });
    setBeacon(G, null); // beads drilled — the objective is met
    recordTell(fxAt(G, SITES.knap.x, SITES.knap.z, 0.8));
    await G.hud.narrator(S.act1.drillDone);
    Save.addRecord({ id: 'beads', type: 'beads', pos: { ...SITES.grave }, made: YEARS.SCENE_A_YEAR, data: { count: 7 } });
  }

  if (!Save.getRecord('obsidian')) {
    // visiting band + gesture exchange
    objectiveCue(G, S.act1.obj_trade, { x: camp.x + 4, z: camp.z + 3 });
    const visitors = [];
    for (let i = 0; i < 3; i++) {
      visitors.push(new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
        x: camp.x + 10 + i, z: camp.z + 8 + i, world: G.world, wander: 1.5,
        wrap: 0x3d5a66, name: `visitor${i}`,
      }));
    }
    G.npcs.push(...visitors);
    visitors[0].goTo(camp.x + 4, camp.z + 3);
    await interactOnce(G, { id: 'trade', x: camp.x + 4, z: camp.z + 3, r: 3.2, prompt: '🤝' });
    setBeacon(G, null); // met them — the exchange dialogue takes over
    visitors[0].say('▲? ◉◉', 2600);
    await G.hud.narrator(S.act1.tradeIntro);
    let traded = false;
    while (!traded) {
      const pick = await G.hud.choice(S.act1.tradeChoiceTitle, [S.act1.tradeOffer, S.act1.tradeRefuse]);
      if (pick === 0) traded = true;
      else await G.hud.narrator(S.act1.tradeRefused);
    }
    visitors[0].say('◉◉ ✔', 2400);
    Save.addRecord({ id: 'obsidian', type: 'obsidian', pos: { ...SITES.playerHut }, made: YEARS.SCENE_A_YEAR, data: {} });
    recordTell(fxAt(G, camp.x + 4, camp.z + 3, 0.8));
    await G.hud.narrator(S.act1.tradeDone);
    for (const v of visitors) v.goTo(v.pos.x + 14, v.pos.z + 10);
  }

  // --- depletion beat: why hunter-gatherers move ---
  // the working day stops here: no more errands out of the chest while the
  // band faces an empty valley, and every worker is handed back to the script
  ambient.stop();
  // every bush empties: the gather sites are berry-bush props now
  for (const bp of berryProps.values()) bp.setBerries(false);
  for (const d of deer) {
    // herds wander beyond the ridge — clamped inside world bounds
    d.home = { x: Math.min(120, d.home.x + 22), z: Math.max(8, d.home.z - 24) };
    d.wanderR = 3;
    d.goTo(d.home.x, d.home.z);
  }
  for (const d of meadowDeer) {
    // the meadow pair drifts the other way, off down the valley
    d.home = { x: Math.max(8, d.home.x - 16), z: Math.min(120, d.home.z + 26) };
    d.wanderR = 3;
    d.goTo(d.home.x, d.home.z);
  }
  await G.hud.narrator(S.act1.depletion1);
  elder.say('🏔️👣 ➡️', 3000);
  await G.hud.narrator(S.act1.depletion2);
  await G.hud.narrator(S.act1.campMoves);

  // --- burial (4.37) ---
  SFX.hush();
  await G.hud.card([S.act1.burial_card]);
  await G.hud.narrator(S.act1.burial1);
  const gy = groundY(G, SITES.grave.x, SITES.grave.z);
  addProp(G, P.makeGraveMound(SITES.grave.x, gy - 0.6, SITES.grave.z));
  for (const n of band) {
    if (n === elder) continue;
    // the band gathers and STAYS at the graveside (home moves with them,
    // so idle wandering keeps them in the circle instead of drifting off)
    const gx = SITES.grave.x - 2 + Math.random() * 4;
    const gz = SITES.grave.z - 2 + Math.random() * 2;
    n.home = { x: gx, z: gz };
    n.wanderR = 1.1;
    n.goTo(gx, gz);
  }
  elder.dispose();
  G.npcs = G.npcs.filter((n) => n !== elder);
  band.splice(band.indexOf(elder), 1);

  // muted cue: the beacon still guides, but in the burial's quiet palette
  objectiveCue(G, S.act1.obj_burial_beads, SITES.grave, 0xb9c4cc);
  await interactOnce(G, { id: 'grave1', x: SITES.grave.x, z: SITES.grave.z, r: 3, prompt: '📿' });
  const beadsProp = addProp(G, P.makeBeads(0.8), SITES.grave.x - 0.3, gy - 0.45, SITES.grave.z + 0.2);
  void beadsProp;
  FX.floaties({ x: SITES.grave.x, y: gy + 0.2, z: SITES.grave.z }, { color: 0xd9d2c0, count: 5, size: 0.09, life: 2.2, rise: 0.5 });
  objectiveCue(G, S.act1.obj_burial_tool, SITES.grave, 0xb9c4cc);
  await interactOnce(G, { id: 'grave2', x: SITES.grave.x, z: SITES.grave.z, r: 3, prompt: '🔪' });
  setBeacon(G, null); // grave goods placed — stillness for the farewell
  addProp(G, P.makeStoneTool('blade'), SITES.grave.x + 0.4, gy - 0.5, SITES.grave.z - 0.2);
  Save.addRecord({
    id: 'burial', type: 'burial', pos: { ...SITES.grave }, made: YEARS.SCENE_A_YEAR,
    data: { goods: ['beads', 'blade'] },
  });
  // one slow, muted ring — deliberate, quiet; no celebration here
  FX.ring({ x: SITES.grave.x, y: gy, z: SITES.grave.z }, { color: 0xb9c4cc, radius: 4.6, life: 2.6, width: 0.12 });
  FX.floaties({ x: SITES.grave.x, y: gy + 0.3, z: SITES.grave.z }, { color: 0xd9d2c0, count: 8, size: 0.1, life: 2.6, rise: 0.45 });
  await G.hud.narrator(S.act1.burialNote); // "Perhaps…" — protected hedge
  await G.hud.narrator(S.act1.burialDone);
  objectiveCue(G, null); // objective + beacon both down
  G.player.equip(null);
}

function placePaintingMesh(G, png, brightness = 1) {
  const tex = new THREE.TextureLoader().load(png);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
  mat.color.setScalar(brightness);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), mat);
  const w = SITES.shelterWall;
  const y = 11;
  plane.position.set(w.x, y, w.z + 0.06);
  G.renderer.scene.add(plane);
  G.props.push({ group: plane, isPainting: true, mat });
  return plane;
}

// ---------- SCENE B — Thaw ----------

async function sceneB(G) {
  resetStage(G); // the band, herds and camp props do not survive the millennia
  setBeacon(G, null); // sweep: no beacon crosses a scene boundary
  G.player.equip(null);
  G.player.setAim(false);
  FX.clear();
  douseFires();
  await G.hud.card([S.act1.interstitial_generations]);
  await skyGlimpse(G, {
    fromYear: YEARS.SCENE_A_YEAR,
    toYear: YEARS.SCENE_B_YEAR,
    caption: S.act1.thawNote, // verbatim 4.41
    rebuild: () => {
      buildSceneB(G.world);
      G.renderer.setSky(0x9ec8e8, 0xcfe0ee);
      G.player.teleport(SITES.camp2.x, SITES.camp2.z + 3, 0);
    },
    overXZ: { x: 60, z: 40 },
    holdMs: 2000,
  });
  // arrival at the second camp: a lit fire and a warm welcome pulse —
  // deliberately no confetti, this is home-finding, not victory
  const c2 = SITES.camp2;
  addProp(G, P.makeCampfire(c2.x, groundY(G, c2.x, c2.z), c2.z)); // on the surface, not buried
  lightFire(G, c2.x, c2.z);
  addProp(G, P.makeButterflies(c2.x - 3, groundY(G, c2.x - 3, c2.z + 4), c2.z + 4));
  for (const cz of [94, 99]) {
    const cx = Math.round(riverX(cz)) - 8;
    addProp(G, P.makeCattail(cx, groundY(G, cx, cz), cz));
  }
  const dwx2 = Math.round(riverX(101)) - 9;
  addProp(G, P.makeDriftwood(dwx2, groundY(G, dwx2, 101), 101, 2.1));
  FX.ring(fxAt(G, c2.x, c2.z), { color: 0xffc98a, radius: 3.0, life: 0.8 });
  await wait(400);
  FX.ring(fxAt(G, c2.x, c2.z), { color: 0xffe9a8, radius: 4.6, life: 1.0, width: 0.12 });
  await G.hud.narrator(S.act1.thawNote2); // 4.42 melt → rivers → oceans
  await G.hud.narrator(S.act1.sceneB_ground);
}

// ---------- SCENE C — Roots ----------

async function sceneC(G) {
  await G.hud.fadeOut(400);
  resetStage(G);
  setBeacon(G, null); // sweep: no beacon crosses a scene boundary
  G.player.equip(null);
  G.player.setAim(false);
  FX.clear();
  douseFires();
  await G.hud.card([S.act1.interstitial_generations]);
  buildSceneC(G.world);
  G.mesher.remeshAll();
  G.renderer.setSky(0x9ec8e8, 0xcfe0ee);
  G.player.teleport(SITES.village.x - 2, SITES.village.z + 4, Math.PI * 0.9);
  G.mode = 'ground';

  const camp = SITES.village;
  const chief = new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
    x: camp.x, z: camp.z, world: G.world, elder: true, name: 'chief', wander: 3, wrap: 0x764a62,
  });
  const villagers = [chief];
  for (let i = 0; i < 4; i++) {
    villagers.push(new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: camp.x - 4 + i * 2.4, z: camp.z + 2 + (i % 2) * 3, world: G.world, wander: 4, child: i === 2,
    }));
  }
  G.npcs.push(...villagers);
  makeTalkable(G, villagers);

  const goats = [];
  for (let i = 0; i < 2; i++) {
    goats.push(new Animal(G.renderer.scene, {
      kind: 'goat', x: SITES.pen.x + 8 + i * 2, z: SITES.pen.z + 7, world: G.world, wander: 3, speed: 1.5,
    }));
  }
  const cattle = new Animal(G.renderer.scene, { kind: 'cattle', x: SITES.pen.x - 2, z: SITES.pen.z + 9, world: G.world, wander: 3 });
  G.npcs.push(...goats, cattle);

  // village hearth + idle purposes: helper works near the granary, the two
  // future disputants keep to the fields, the child stays by the fire.
  // Scripted goTo calls later in the scene override these freely.
  const hearthC = { x: SITES.village.x, z: SITES.village.z + 1 };
  addProp(G, P.makeCampfire(hearthC.x, groundY(G, hearthC.x, hearthC.z), hearthC.z)); // on the surface, not buried
  lightFire(G, hearthC.x, hearthC.z);
  // the village's shared store: the same lidded chest, now at the granary front
  const storeC = { x: SITES.granary.x, z: SITES.granary.z + 2 };
  const chestC = addProp(G, P.makeCommunityChest(storeC.x, groundY(G, storeC.x, storeC.z), storeC.z));
  villagers[1].home = { x: SITES.granary.x - 2, z: SITES.granary.z + 1 }; villagers[1].wanderR = 2.5;
  villagers[2].home = { x: SITES.fields.x + 6, z: SITES.fields.z - 3 }; villagers[2].wanderR = 3;
  villagers[3].home = { x: hearthC.x - 1.5, z: hearthC.z + 1.5 }; villagers[3].wanderR = 1.8;

  // settled-life errands out of the same shared chest. Only the villager the
  // scene never scripts takes a job — the helper, the chieftain and the two
  // disputants must stay free for their beats.
  const ambientC = new AmbientLife(G, {
    chest: chestC, chestAt: storeC,
    jobs: {
      field: jobTend(G, { at: { x: SITES.fields.x + 2, z: SITES.fields.z + 3 }, item: 'basket', icon: '🌾', doneIcon: '🌾' }),
      herd: jobTend(G, { at: { x: SITES.pen.x + 3, z: SITES.pen.z + 3 }, item: 'spear', icon: '🐐', doneIcon: '🐐', color: 0xe8dfc4 }),
    },
  });
  ambientC.assign(villagers[4], ['field', 'herd'], 'work');
  G.props.push(ambientC);

  // young-village dressing: boulders at the outskirts, butterflies over the
  // plots, cattails + driftwood on the near bank (≥ ~8 blocks off the river
  // centre so every exit strip stays clear)
  addProp(G, P.makeBoulder(82, groundY(G, 82, 88), 88, 0.9));
  addProp(G, P.makeBoulder(70, groundY(G, 70, 70), 70, 1.1));
  addProp(G, P.makeButterflies(63, groundY(G, 63, 82), 82));
  addProp(G, P.makeButterflies(69, groundY(G, 69, 90), 90));
  for (const cz of [86, 90]) {
    const cx = Math.round(riverX(cz)) + 8;
    addProp(G, P.makeCattail(cx, groundY(G, cx, cz), cz));
  }
  const dwx3 = Math.round(riverX(88)) + 9;
  addProp(G, P.makeDriftwood(dwx3, groundY(G, dwx3, 88), 88, 1.2));

  await G.hud.fadeIn(400);
  await G.hud.card([S.act1.sceneC_card]);

  // --- plant the first plot (4.43, 4.44) ---
  if (!Save.getRecord('crops')) {
    await G.hud.narrator(S.act1.plantIntro);
    objectiveCue(G, S.act1.obj_plant, SITES.fields);
    let planted = 0;
    const spots = [
      { x: SITES.fields.x - 2, z: SITES.fields.z - 1 }, { x: SITES.fields.x, z: SITES.fields.z },
      { x: SITES.fields.x + 2, z: SITES.fields.z + 1 }, { x: SITES.fields.x + 4, z: SITES.fields.z - 1 },
    ];
    await new Promise((resolve) => {
      for (const s of spots) {
        G.interactables.push({
          id: `plant-${s.x}-${s.z}`, x: s.x, z: s.z, r: 2.2, prompt: '🌾', enabled: true,
          onInteract(self) {
            self.enabled = false;
            const h = G.world.topAt(s.x, s.z);
            G.world.set(s.x, h, s.z, B.FARMLAND);
            G.world.set(s.x, h + 1, s.z, B.CROP);
            const pp = { x: s.x + 0.5, y: h + 1.2, z: s.z + 0.5 };
            FX.puff(pp, { count: 6, size: 0.3, life: 0.6, color: 0x8a6440 });
            FX.floaties(pp, { color: 0xaef0c8, count: 6, size: 0.1, life: 1.3 });
            planted++;
            G.hud.setObjective(S.act1.obj_plant_n(planted));
            if (planted >= 4) { setBeacon(G, null); resolve(); }
          },
        });
      }
    });
    recordTell(fxAt(G, SITES.fields.x, SITES.fields.z, 0.6));
    await G.hud.narrator(S.act1.plantDone);
    await G.hud.narrator(S.act1.riverNote); // 4.44 water + fertile soil
    Save.addRecord({ id: 'crops', type: 'crop', pos: { ...SITES.fields }, made: YEARS.SCENE_C_YEAR, data: { plots: 4 } });
    // grain into the store → burnt grain find later
    Save.addRecord({ id: 'grain', type: 'grain', pos: { ...SITES.granary }, made: YEARS.SCENE_C_YEAR, data: {} });
  }

  // --- pen the goats (4.43 domestication) ---
  objectiveCue(G, S.act1.obj_pen, SITES.pen);
  G.hud.hint(S.act1.penHint, 6000);
  await new Promise((resolve) => {
    const iv = setInterval(() => {
      let inside = 0;
      for (const g of goats) {
        const near = Math.hypot(g.pos.x - G.player.pos.x, g.pos.z - G.player.pos.z) < 3.4;
        const inPen = Math.abs(g.pos.x - SITES.pen.x) <= 2.4 && Math.abs(g.pos.z - SITES.pen.z) <= 2.4;
        if (inPen) {
          g.followTarget = null;
          g.home = { ...SITES.pen };
          g.wanderR = 1.6;
          inside++;
        } else {
          g.followTarget = near ? G.player.pos : null;
        }
      }
      if (inside >= 2) { clearInterval(iv); setBeacon(G, null); resolve(); }
    }, 250);
  });
  cattle.home = { x: SITES.pen.x, z: SITES.pen.z + 4 };
  cattle.goTo(SITES.pen.x, SITES.pen.z + 4);
  FX.ring(fxAt(G, SITES.pen.x, SITES.pen.z), { color: 0xffc98a, radius: 3.4, life: 0.8 });
  for (const g2 of goats) FX.puff(g2.pos, { count: 6, size: 0.28, life: 0.55, color: 0xb9a77e });
  await G.hud.narrator(S.act1.penDone);
  await G.hud.narrator(S.act1.settleNote);

  // --- community store: no personal inventory (4.46) ---
  await G.hud.narrator(S.act1.granaryIntro);
  const helper = villagers[1];
  helper.goTo(G.player.pos.x + 1, G.player.pos.z + 1);
  await wait(900);
  helper.say('🧺➡️🏠', 2600);
  await G.hud.narrator(S.act1.granaryTake);
  const pick = await G.hud.choice(S.act1.granaryQTitle, [
    S.act1.granaryQa, S.act1.granaryQb, S.act1.granaryQc, S.act1.granaryQd,
  ]);
  // both "all" and "none" readings are right; the combined option is best
  if (pick === 3 || pick === 1 || pick === 2) await G.hud.narrator(S.act1.granaryRight);
  else await G.hud.narrator(S.act1.granaryWrong);
  Save.setChoice('granary', pick);

  // --- chieftain: task, dispute, lean week (4.45) ---
  chief.say('💧🌾?', 2600);
  await G.hud.narrator(S.act1.chiefIntro);
  objectiveCue(G, S.act1.obj_chief_task, { x: SITES.granary.x, z: SITES.granary.z + 2 });
  await interactOnce(G, { id: 'waterskin', x: SITES.granary.x, z: SITES.granary.z + 2, prompt: '💧' });
  chestC.openFor(2000);
  G.player.equip('waterskin'); // taken from the shared store at the granary
  FX.burst(fxAt(G, SITES.granary.x, SITES.granary.z + 2, 0.5), { color: 0xbfe4f5, count: 12, size: 0.1, speed: 2.2, life: 0.5, gravity: 8, additive: false });
  setBeacon(G, SITES.farField); // second leg: carry it out to the far field
  await interactOnce(G, { id: 'farfield', x: SITES.farField.x, z: SITES.farField.z, r: 3.4, prompt: '🌾' });
  G.player.equip(null); // delivered — the skin goes back with the next runner
  setBeacon(G, null);
  FX.floaties(fxAt(G, SITES.farField.x, SITES.farField.z, 0.4), { color: 0xaef0c8, count: 10, size: 0.1, life: 1.5 });
  await G.hud.narrator(S.act1.chiefTaskDone);

  ambientC.stop(); // the village stops work and gathers for the quarrel
  await G.hud.card([S.act1.dispute_card]);
  const [fa, fb] = [villagers[2], villagers[3]];
  fa.goTo(SITES.fields.x + 6, SITES.fields.z + 2);
  fb.goTo(SITES.fields.x + 7.4, SITES.fields.z + 2);
  await wait(1200);
  fa.say('🌾⬅️❗', 2400); fb.say('❗➡️🌾', 2400);
  await G.hud.narrator(S.act1.dispute1);
  chief.goTo(SITES.fields.x + 6.7, SITES.fields.z + 3.4);
  await wait(1600);
  chief.say('🪨🪨🪨', 2600);
  await G.hud.narrator(S.act1.dispute2);
  await G.hud.narrator(S.act1.disputeNote);
  await G.hud.narrator(S.act1.leanWeek);
  objectiveCue(G, null); // objective + beacon both down
}

// ---------- SCENE D — Fire and Clay ----------

async function sceneD(G) {
  await G.hud.fadeOut(400);
  resetStage(G);
  setBeacon(G, null); // sweep: no beacon crosses a scene boundary
  G.player.equip(null);
  G.player.setAim(false);
  FX.clear();
  douseFires();
  G.hud.fadeIn(400); // the glimpse itself must be visible (was hidden by the fader)
  await skyGlimpse(G, {
    fromYear: YEARS.SCENE_C_YEAR,
    toYear: YEARS.SCENE_D_YEAR,
    caption: S.act1.interstitial_generations,
    rebuild: () => {
      buildSceneD(G.world);
      G.player.teleport(SITES.playerHut.x, SITES.playerHut.z + 4, Math.PI);
    },
    overXZ: { x: SITES.village.x, z: SITES.village.z },
    holdMs: 1800,
  });
  await G.hud.fadeIn(200);
  G.mode = 'ground';
  await G.hud.card([S.act1.sceneD_card]);
  await G.hud.narrator(S.act1.hamletGloss); // 4.50 hamlet glossed

  const villagers = [];
  for (let i = 0; i < 5; i++) {
    villagers.push(new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: SITES.village.x - 5 + i * 2.6, z: SITES.village.z + 1 + (i % 3), world: G.world, wander: 5, child: i === 4,
    }));
  }
  G.npcs.push(...villagers);
  makeTalkable(G, villagers);
  const goats = [];
  for (let i = 0; i < 2; i++) {
    goats.push(new Animal(G.renderer.scene, { kind: 'goat', x: SITES.pen.x, z: SITES.pen.z + i, world: G.world, wander: 2 }));
  }
  G.npcs.push(...goats);

  // hamlet hearth + idle purposes (scripted moves still override these)
  const hearthD = { x: SITES.village.x - 1, z: SITES.village.z };
  addProp(G, P.makeCampfire(hearthD.x, groundY(G, hearthD.x, hearthD.z), hearthD.z)); // on the surface, not buried
  lightFire(G, hearthD.x, hearthD.z);
  // the hamlet's shared store still stands at the granary front
  const storeD = { x: SITES.granary.x, z: SITES.granary.z + 2 };
  const chestD = addProp(G, P.makeCommunityChest(storeD.x, groundY(G, storeD.x, storeD.z), storeD.z));
  villagers[0].home = { x: SITES.granary.x - 2, z: SITES.granary.z + 2 }; villagers[0].wanderR = 2.5;
  villagers[1].home = { x: SITES.fields.x + 3, z: SITES.fields.z - 2 }; villagers[1].wanderR = 3;
  villagers[2].home = { x: SITES.kiln.x + 2, z: SITES.kiln.z + 4 }; villagers[2].wanderR = 2;
  villagers[4].home = { x: hearthD.x - 1.5, z: hearthD.z + 1.5 }; villagers[4].wanderR = 1.8;

  // a full working hamlet: three villagers keep the chest busy all scene
  const ambientD = new AmbientLife(G, {
    chest: chestD, chestAt: storeD,
    jobs: {
      field: jobTend(G, { at: { x: SITES.fields.x + 2, z: SITES.fields.z + 2 }, item: 'basket', icon: '🌾', doneIcon: '🌾' }),
      herd: jobTend(G, { at: { x: SITES.pen.x + 3, z: SITES.pen.z + 3 }, item: 'spear', icon: '🐐', doneIcon: '🐐', color: 0xe8dfc4 }),
      wood: jobWood(G, { at: { x: SITES.village.x + 12, z: SITES.village.z + 10 } }),
    },
  });
  ambientD.assign(villagers[1], ['field', 'wood'], 'work');
  ambientD.assign(villagers[2], ['herd', 'field'], 'return');
  ambientD.assign(villagers[3], ['wood', 'field'], 'outbound');
  G.props.push(ambientD);

  // mature-hamlet dressing: spoil heap by the kiln, boulders at the edges,
  // butterflies over the crops, cattails + driftwood held ≥ ~8 blocks off
  // the river centre line (bank exit strips stay clear)
  addProp(G, P.makeRubblePile(85, groundY(G, 85, 87), 87));
  addProp(G, P.makeBoulder(70, groundY(G, 70, 70), 70, 1.1));
  addProp(G, P.makeBoulder(83, groundY(G, 83, 91), 91, 0.8));
  addProp(G, P.makeButterflies(63, groundY(G, 63, 82), 82));
  addProp(G, P.makeButterflies(74, groundY(G, 74, 86), 86));
  for (const cz of [84, 90]) {
    const cx = Math.round(riverX(cz)) + 8;
    addProp(G, P.makeCattail(cx, groundY(G, cx, cz), cz));
  }
  const dwx4 = Math.round(riverX(82)) + 9;
  addProp(G, P.makeDriftwood(dwx4, groundY(G, dwx4, 82), 82, 1.9));

  // --- THE POT (4.49) ---
  let pot = Save.getRecord('pot');
  if (!pot) {
    objectiveCue(G, S.act1.obj_pot, SITES.kiln);
    await interactOnce(G, { id: 'kiln', x: SITES.kiln.x, z: SITES.kiln.z, r: 3, prompt: '🏺' });
    const made = await potGame(G.hud.root);
    // the kiln fires: flame licks off the charcoal cap + a smoke column
    // (fxAt lands on the kiln's top block — topAt sees the mudbrick stack)
    const [kilnFlame, kilnSmoke] = lightFire(G, SITES.kiln.x, SITES.kiln.z, { size: 0.28, rate: 22 });
    await G.hud.fadeOut(500);
    await wait(600); // firing
    await G.hud.fadeIn(500);
    pot = Save.addRecord({
      id: 'pot', type: 'pot', pos: { ...SITES.playerHut }, made: YEARS.SCENE_D_YEAR,
      data: made,
    });
    // the kiln did its work: embers off the mouth, and this pot matters later
    const kp = fxAt(G, SITES.kiln.x, SITES.kiln.z, 1.2);
    FX.burst(kp, { color: 0xff9d3c, count: 20, size: 0.12, speed: 2.8, life: 0.7, gravity: 2 });
    recordTell(kp);
    FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 20 });
    await G.hud.narrator(S.act1.potFired);
    // firing done — the kiln banks down
    FX.removeHandle(kilnFlame);
    FX.removeHandle(kilnSmoke);
    fireFx = fireFx.filter((h) => h !== kilnFlame && h !== kilnSmoke);
  }

  // --- the basket: deliberately effortless ---
  if (!Save.getRecord('basket')) {
    const reeds = { x: SITES.fields.x - 4, z: SITES.fields.z + 3 };
    objectiveCue(G, S.act1.obj_basket, reeds);
    await interactOnce(G, { id: 'reeds', x: reeds.x, z: reeds.z, prompt: '🧺' });
    Save.addRecord({ id: 'basket', type: 'basket', pos: { ...SITES.playerHut }, made: YEARS.SCENE_D_YEAR, data: {} });
    recordTell(fxAt(G, reeds.x, reeds.z, 0.6));
    await G.hud.narrator(S.act1.basketDone);
  }

  // --- place both on the shelf ---
  const hut = SITES.playerHut;
  objectiveCue(G, S.act1.obj_shelf, hut);
  const hy = groundY(G, hut.x, hut.z);
  addProp(G, P.makeShelf(hut.x, hy - 1, hut.z - 1));
  await interactOnce(G, { id: 'shelf', x: hut.x, z: hut.z, r: 2.8, prompt: '🏺🧺' });
  setBeacon(G, null); // home — the keepsake moment plays without a marker
  const potProp = P.makePot(pot, 0.5);
  addProp(G, potProp, hut.x - 0.4, hy - 0.37, hut.z - 1);
  addProp(G, P.makeBasket(0.5), hut.x + 0.4, hy - 0.37, hut.z - 1);
  // the household record Act 3 will excavate — a quiet keepsake shimmer
  FX.ring({ x: hut.x, y: hy, z: hut.z }, { color: 0xffc98a, radius: 2.2, life: 0.8 });
  FX.floaties({ x: hut.x, y: hy + 0.3, z: hut.z - 1 }, { color: 0xffd9a0, count: 10, size: 0.1, life: 1.8, rise: 0.8 });
  await G.hud.narrator(S.act1.shelfDone);

  // --- copper beat (4.49 copper first, iron later) ---
  const trader = new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
    x: SITES.village.x + 12, z: SITES.village.z + 10, world: G.world, wander: 1, wrap: 0x557080, name: 'trader',
  });
  G.npcs.push(trader);
  trader.goTo(SITES.village.x + 2, SITES.village.z + 2);
  await G.hud.narrator(S.act1.copperTrader);
  addProp(G, P.makeCopperBangle(), SITES.village.x + 2, groundY(G, SITES.village.x + 2, SITES.village.z + 2), SITES.village.z + 2);
  // new metal catches the light
  const bp2 = fxAt(G, SITES.village.x + 2, SITES.village.z + 2, 0.4);
  FX.flash(bp2, { color: 0xffc98a, size: 0.7, life: 0.14 });
  FX.floaties(bp2, { color: 0xf0b060, count: 8, size: 0.09, life: 1.4, rise: 0.8 });
  await G.hud.narrator(S.act1.copperNote);

  // --- delivery run (4.47 exchange: food, clothing, tools) ---
  objectiveCue(G, S.act1.obj_delivery, SITES.granary);
  addProp(G, P.makeCart(SITES.village.x + 4, groundY(G, SITES.village.x + 4, SITES.village.z + 5) - 1, SITES.village.z + 5, 0.4));
  await interactOnce(G, { id: 'sack', x: SITES.granary.x, z: SITES.granary.z, r: 3, prompt: '🌾' });
  chestD.openFor(2000);
  FX.puff(fxAt(G, SITES.granary.x, SITES.granary.z, 0.5), { count: 8, size: 0.3, life: 0.6, color: 0xd2a95f });
  const sack = P.makeSack();
  sack.update = () => sack.group.position.set(G.player.pos.x, G.player.pos.y + 2.1, G.player.pos.z);
  sack.update();
  addProp(G, sack);
  setBeacon(G, SITES.neighbour); // outbound leg: the neighbour village
  await interactOnce(G, { id: 'neigh', x: SITES.neighbour.x, z: SITES.neighbour.z, r: 4, prompt: '🤝' });
  G.renderer.scene.remove(sack.group);
  G.props = G.props.filter((p) => p !== sack);
  // the handoff lands — a little celebration at the neighbour village
  FX.ring(fxAt(G, SITES.neighbour.x, SITES.neighbour.z), { color: 0xffe9a8, radius: 3.0, life: 0.8 });
  FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 20 });
  await G.hud.narrator(S.act1.deliveryThere);
  setBeacon(G, SITES.granary); // return leg: home with the cloth
  await interactOnce(G, { id: 'home', x: SITES.granary.x, z: SITES.granary.z, r: 4, prompt: '🏠' });
  setBeacon(G, null); // round trip complete
  FX.ring(fxAt(G, SITES.granary.x, SITES.granary.z), { color: 0xffe9a8, radius: 2.4, life: 0.7 });
  await G.hud.narrator(S.act1.deliveryDone);
  await G.hud.narrator(S.act1.networkNote); // 4.48 networks; villages → towns

  // --- closing: the lingering shot ---
  objectiveCue(G, null); // objective + beacon both down
  ambientD.stop();       // the day's work ends before the last quiet beat
  await reach(G, hut.x, hut.z, 4);
  G.input.setEnabled(false);
  G.mode = 'ui';
  await G.hud.narrator(S.act1.act1End);
  await G.hud.narrator(S.act1.act1End2);
  await G.hud.fadeOut(1400);
  resetStage(G);
  setBeacon(G, null); // final sweep before the beacon handle could go stale
  G.player.equip(null);
  FX.clear(); // hard cut into Act 2 — no lingering sparks
  douseFires();
  G.input.setEnabled(true);
}
