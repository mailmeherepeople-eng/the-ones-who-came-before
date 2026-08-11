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
import { skyGlimpse, tween } from '../sky/interstitial.js';
import { wait } from '../ui/hud.js';
import { SFX } from '../audio.js';
import { Sound } from '../sound.js';
import { Inv, ITEMS } from '../inventory.js';
import { openContainer } from '../ui/container.js';
import { groundAnchor, objectiveCue, setBeacon, nearestSite } from '../ui/objective.js';
import { teach, refreshCodexBadge } from '../codex.js';
import { recallBeat, flushRecall } from '../recall.js';

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
const fxAt = groundAnchor;

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

// Wayfinding (objectiveCue / setBeacon / nearestSite) now lives in
// ui/objective.js so acts 2 and 3 can point a player at something too. Same
// behaviour, same numbers; see that file for the pillar-pool contract.

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

let STORE_A = null;

// The player model has one visual slot but the inventory has many, so this
// decides what the hands show: the borrowed tool if there is one, otherwise
// whatever is being carried. Call it after every transfer.
function syncEquip(G) {
  const tool = Inv.heldTool();
  const show = tool ?? Inv.contents('player')[0]?.id ?? null;
  G.player.equip(show ? (ITEMS[show]?.equip ?? null) : null);
  G.hud.setSatchel(Inv.totalOfKind('player', 'harvest'), Inv.total('player') > 0);
}

// The crate visibly fills as the band's food piles up. Twelve is "full" and it
// clamps, so a generous gatherer cannot overflow the mesh.
function refreshStoreFill() {
  STORE_BOX?.setFill(Math.min(1, Inv.total('store') / 12));
}

// Poll until a condition on the inventory holds. Beats wait on THIS rather than
// on one scripted tap, which is what lets the player open a box, look through
// it, change their mind and come back, with the beat advancing the moment the
// condition is actually true.
function until(test, ms = 200) {
  return new Promise((resolve) => {
    if (test()) { resolve(); return; }
    const iv = setInterval(() => { if (test()) { clearInterval(iv); resolve(); } }, ms);
  });
}

// Register the two stations once for the whole scene. Before this, taking a
// tool was a one-shot scripted tap that handed you an item you never saw; now
// both are real containers you can open whenever you like.
function addStations(G, chest) {
  G.interactables.push({
    id: 'chest', x: STORE_A.x, z: STORE_A.z, r: 2.8, enabled: true,
    prompt: '🧰', label: S.act1.openChest,
    async onInteract() {
      chest.hold(); // lid stays up while you are looking inside
      await openContainer(G, 'chest');
      chest.releaseHold();
      syncEquip(G);
    },
  });
  G.interactables.push({
    id: 'store', x: STORE_BOX_AT.x, z: STORE_BOX_AT.z, r: 2.6, enabled: true,
    prompt: '📦', label: S.act1.openStore,
    async onInteract() {
      await openContainer(G, 'store');
      syncEquip(G);
      refreshStoreFill();
    },
  });
}

// Beat helpers. Each sets an objective, points the beacon at the right station
// and waits for the inventory to say the job is done.
async function takeFromChest(G, itemId, objectiveText) {
  objectiveCue(G, objectiveText, STORE_A);
  await until(() => Inv.has('player', itemId));
  setBeacon(G, null);
  FX.flash(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { size: 0.6, life: 0.13 });
  G.audio?.blip?.();
}

async function putInStore(G, itemId, objectiveText, doneText) {
  if (!STORE_BOX_AT) return;
  objectiveCue(G, objectiveText, STORE_BOX_AT);
  await until(() => !Inv.has('player', itemId));
  refreshStoreFill();
  const at = fxAt(G, STORE_BOX_AT.x, STORE_BOX_AT.z, 0.7);
  FX.puff(at, { count: 10, size: 0.22, life: 0.5, color: 0xd8c9a4 });
  FX.ring(at, { color: 0xffd28a, radius: 1.5, life: 0.6 });
  G.audio?.success?.();
  setBeacon(G, null);
  if (doneText) await G.hud.narrator(doneText);
}

// The other half of borrowing, and the reason the whole system exists: the tool
// is not yours, so the beat does not end until it is back in the chest.
async function returnToChest(G, itemId, objectiveText, doneText) {
  objectiveCue(G, objectiveText, STORE_A);
  await until(() => !Inv.has('player', itemId));
  const at = fxAt(G, STORE_A.x, STORE_A.z, 0.7);
  FX.puff(at, { count: 8, size: 0.2, life: 0.45, color: 0xd8c9a4 });
  FX.ring(at, { color: 0xffd28a, radius: 1.4, life: 0.55 });
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
        // Their voice: one random noise from this character's folder, never
        // words (see sound.js). Not awaited, so the bubble is not held back by
        // a first-play decode. The elder falls back to the tribe's noises until
        // her own are recorded, and with nothing recorded at all the synth blip
        // is still there, which is exactly what this used to be.
        Sound.playFromPool(c.voice ?? 'npc/tribe', { fallback: 'npc/tribe' })
          .then((played) => { if (!played) G.audio?.blip?.(); });
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

// ---------- wild berries, everywhere ----------
//
// The scripted gather uses six hand-placed bush PROPS at SITES.berries. Those
// stay. This is the rest of the valley: berries you can wander into and pick
// on your own terms, so foraging is a thing you do rather than a checklist at
// one location.
//
// They are B.SHRUB_BERRY blocks, not props, and that is the whole trick.
// SHRUB_BERRY is cross flora, and every cross-flora block in a chunk merges
// into ONE mesh, so a hundred of these cost nothing. A hundred prop bushes
// would have cost ~200 draw calls, about +70% on Act 1.
//
// Scene A needs the explicit scatter because terrain's bush-blob pass (the only
// generator of SHRUB_BERRY) is skipped entirely when the world is iced, so the
// cold valley ships with none at all.
const WILD_BERRY_CLEAR = 5; // blocks kept free around any named site

function scatterWildBerries(world, target = 110) {
  const sites = Object.values(SITES).flatMap((s) => (Array.isArray(s) ? s : [s]));
  let placed = 0;
  // deterministic walk so a reload puts the same bushes in the same places
  for (let i = 0; i < 6000 && placed < target; i++) {
    let h = Math.imul(i ^ 0x9e3779b9, 2654435761);
    h = (h ^ (h >>> 15)) >>> 0;
    const x = h % 128;
    const z = (h >>> 7) % 128;
    if (z < 14) continue;                       // behind the shelter cliff
    if (Math.abs(x - riverX(z)) < 7) continue;  // leave the banks to the reeds
    if (sites.some((s) => Math.abs(x - s.x) <= WILD_BERRY_CLEAR && Math.abs(z - s.z) <= WILD_BERRY_CLEAR)) continue;
    const gy = world.topAt(x, z);
    const top = world.get(x, gy, z);
    if (top !== B.GRASS && top !== B.SNOWGRASS) continue;
    if (world.get(x, gy + 1, z) !== B.AIR) continue;
    world.setRaw(x, gy + 1, z, B.SHRUB_BERRY);  // setRaw: pre-mesh, no dirty flag
    placed++;
  }
  return placed;
}

// Register one interactable per wild bush. These are plain distance checks in
// nearestInteract, so ~110 of them is a rounding error next to a frame.
function addWildBerryPicks(G) {
  let found = 0;
  for (let x = 0; x < 128; x++) {
    for (let z = 14; z < 128; z++) {
      const gy = G.world.topAt(x, z) + 1;
      if (G.world.get(x, gy, z) !== B.SHRUB_BERRY) continue;
      found++;
      G.interactables.push({
        id: `wild-${x}-${z}`, x, z, r: 2.0, prompt: '🫐', label: S.act1.pickBerry, enabled: true,
        onInteract(self) {
          self.enabled = false;
          G.interactables = G.interactables.filter((o) => o !== self);
          G.world.set(x, gy, z, B.AIR); // marks the chunk dirty; mesher flushes it
          const bp = { x: x + 0.5, y: gy + 0.4, z: z + 0.5 };
          FX.puff(bp, { count: 4, size: 0.24, life: 0.5 });
          FX.floaties(bp, { color: 0xd8503c, count: 5, size: 0.09, life: 1.1, rise: 0.9 });
          Inv.add('player', 'berry', 2);
          syncEquip(G);
          G.audio?.blip?.();
        },
      });
    }
  }
  return found;
}

// Fishing spots ON the bank, derived from the river's own centre line rather
// than hand-placed. SITES.fishSpot sits ~11 blocks inland, which is why the
// splash used to land on dry grass; it is kept as the first, signposted spot
// for continuity with the saved record, but nudged to the water like the rest.
function FISH_SPOTS(G) {
  const out = [];
  for (const z of [40, 46, 53, 60]) {
    // stand on the west bank, two blocks back from the centre line
    let x = Math.round(riverX(z)) - 3;
    // walk inland until the ground is actually above the waterline
    for (let k = 0; k < 6 && G.world.topAt(x, z) <= 5; k++) x -= 1;
    out.push({ x, z });
  }
  return out;
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

// ---------- the wake ----------
//
// The game used to open by fading in on a standing body and telling it, in a
// narrator box, that it had woken up. Then it asked for a basket. That is a
// menu, not an opening: nothing happened TO the player and nothing was asked
// OF them for the first three minutes.
//
// This is skyGlimpse's contract inverted. Instead of ascending off the rig and
// returning to it, we start off-rig (lying on the shelter floor) and tween ONTO
// it, and the player is the one who decides when to get up.
//
// Deliberately NOT hud.narrator for the rise prompt: narrator paints a box, and
// this moment has no box. Window-bound listeners, so nothing's z-index can
// swallow the tap. Only ever called with the fader OFF, because #fader is
// z-index 50 with pointer-events auto and would eat every tap underneath it.
function tapToRise(G) {
  return new Promise((resolve) => {
    const done = (e) => {
      if (e?.repeat) return; // a held key must not fire twice
      removeEventListener('pointerdown', done);
      removeEventListener('keydown', done);
      G.input?.clearEdges?.(); // the rising press must not also interact
      resolve();
    };
    addEventListener('pointerdown', done);
    addEventListener('keydown', done);
  });
}

// ease-in-out, inlined: interstitial.js keeps its own `ease` module-private.
const rise0 = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function wakeSequence(G) {
  const cam = G.renderer.camera;
  const feet = G.player.pos.clone(); // teleport has already placed us
  const yaw = G.player.yaw;          // Math.PI, facing the shelter mouth

  // 1. Scripted camera owns the view. Same handshake skyGlimpse uses, and while
  //    mode is not 'ground' main.js skips player.update entirely, so nothing
  //    fights us for the camera.
  G.mode = 'ui';
  G.input.setEnabled(false);   // also hides the touch joystick
  G.player.setModelHidden(true);

  // 2. LYING. Camera at pillow height looking at the ceiling, yawed a little
  //    off-axis so the firelight has a direction, and rolled a little so it
  //    reads as a head on the ground rather than a tripod.
  cam.position.set(feet.x, feet.y + 0.4, feet.z);
  cam.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - 0.12, -yaw + 0.25, 0.06, 'YXZ'));

  // 3. SOUND BEFORE SIGHT. The fader is still opaque from the scene setup.
  //    Hold for the length of the line if it has been recorded; otherwise hold
  //    only briefly, because a long hold on a silent black screen does not read
  //    as atmosphere, it reads as a game that failed to load. Lengthen this
  //    once game/audio has a camp bed and a recording of wake_dark.
  const darkClip = Sound.playVoice('act1.wake_dark');
  await (darkClip ? Promise.race([darkClip.ended, wait(6000)]) : wait(900));

  // 4. Eyes open. A genuinely slow fade (hud.fadeIn drives the CSS duration
  //    now), then the era card over firelit stone, then breathing.
  await G.hud.fadeIn(2000);
  await G.hud.card([S.act1.sceneA_card, S.act1.sceneA_card2]);
  const restY = cam.position.y;
  await tween(2600, (t) => {
    cam.position.y = restY + Math.sin(t * Math.PI * 2) * 0.035; // two slow breaths
  });
  G.hud.toast(S.act1.wake_ceiling, 3600); // ambient: costs no tap

  // 5. The player wakes the character. The game does not wake it for them.
  G.hud.hint(G.input.isTouch ? S.act1.wake_riseTap : S.act1.wake_riseKey, 0);
  await tapToRise(G);
  G.hud.hideHint();

  // 6a. Lying to sitting: up, and the view swings from ceiling to horizon.
  const sitPos = new THREE.Vector3(feet.x, feet.y + 1.1, feet.z);
  const sitQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -yaw, 0, 'YXZ'));
  const p0 = cam.position.clone(), q0 = cam.quaternion.clone();
  await tween(900, (t) => {
    const k = rise0(t);
    cam.position.lerpVectors(p0, sitPos, k);
    cam.quaternion.slerpQuaternions(q0, sitQuat, k);
  });
  await wait(250);

  // 6b. Sitting to standing, landing EXACTLY where the rig wants the camera.
  //     Rather than guess at CAM.PIVOT (module-private in player.js), ask the
  //     rig: collapse the boom to the head, let syncCamera compute the
  //     transform, read it, then put the camera back and tween to it. Zero pop,
  //     and it stays correct if the camera constants are ever retuned.
  const p1 = cam.position.clone(), q1 = cam.quaternion.clone();
  const prevDist = G.player.camDist;
  G.player.pitch = 0;
  G.player.camDist = 0.5;
  G.player._snapCam = true;
  G.player.syncCamera();
  const handPos = cam.position.clone(), handQuat = cam.quaternion.clone();
  G.player.camDist = prevDist;      // the boom the player actually wants back
  G.player._camDistSmooth = 0.5;    // ...but starting from the head
  G.player._snapCam = false;        // so the ground loop RELAXES it out, 12%/frame
  cam.position.copy(p1);
  cam.quaternion.copy(q1);
  await tween(700, (t) => {
    const k = rise0(t);
    cam.position.lerpVectors(p1, handPos, k);
    cam.quaternion.slerpQuaternions(q1, handQuat, k);
  });

  // 7. Handover. The model is unhidden but stays invisible under the boom's own
  //    CAM.HIDE_BELOW rule until the camera has pulled back far enough, so the
  //    body fades into being in front of you as the shot widens. That easing
  //    out from your own eyes is the free "coming to your senses" move.
  G.player.setModelHidden(false);
  G.mode = 'ground';
  G.input.setEnabled(true);
  G.hud.hint(G.input.isTouch ? S.ui.joystickHint : S.ui.desktopHint, 8000);
  await G.hud.narrator(S.act1.wake_stand);
}

// ---------- hunger before basket ----------
//
// A bush inside the camp bowl, between the shelter mouth (42,14) and the fire
// (40,26), off the walking line so it reads as "right there" rather than as an
// errand. Its own prop, not one of the six SITES.berries: those belong to the
// gather beat and stripping one here would leave a bare bush in it.
const HUNGER_BUSH = { x: 37, z: 19 };

async function bareHandBeat(G) {
  await G.hud.narrator(S.act1.hunger);
  const bush = addProp(G, P.makeBerryBush(
    HUNGER_BUSH.x + 0.5, groundY(G, HUNGER_BUSH.x, HUNGER_BUSH.z), HUNGER_BUSH.z + 0.5));
  objectiveCue(G, S.act1.obj_bare, HUNGER_BUSH);
  G.hud.toast(S.act1.berryBare1, 4200);

  // Two fistfuls succeed and the third spills. The failure IS the tutorial: no
  // line of text explains why a basket is worth walking for, the empty hands do.
  let picked = 0;
  await new Promise((resolve) => {
    G.interactables.push({
      id: 'barehand', x: HUNGER_BUSH.x, z: HUNGER_BUSH.z, r: 2.6, enabled: true,
      prompt: '🫐', label: S.act1.pickBare,
      onInteract(self) {
        picked++;
        const bp = fxAt(G, HUNGER_BUSH.x, HUNGER_BUSH.z, 0.7);
        if (picked <= 2) {
          Inv.add('player', 'berry', 1);
          syncEquip(G);
          FX.floaties(bp, { color: 0xd8503c, count: 4, size: 0.09, life: 1.1 });
          SFX.blip?.();
          return;
        }
        // The spill. FX.burst with gravity, NOT FX.puff: puff pins gravity to 0
        // and always gives its particles a positive vy, so berries dropped with
        // it would rise. Same shape as the fishing splash further down.
        FX.burst(bp, { color: 0xd8503c, count: 16, size: 0.13, speed: 2.6, life: 0.7, gravity: 9, additive: false });
        Inv.take('player', 'berry', Inv.count('player', 'berry')); // back into the thorns
        syncEquip(G);
        bush.setBerries(false);
        SFX.trick?.();
        self.enabled = false;
        resolve();
      },
    });
  });
  G.interactables = G.interactables.filter((o) => o.id !== 'barehand');
  setBeacon(G, null);
  G.hud.toast(S.act1.berrySpill, 4200);   // ambient, costs no tap
  await G.hud.narrator(S.act1.berryWant); // the want the Community Chest answers
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
  scatterWildBerries(G.world); // before remeshAll, so setRaw is enough
  G.mesher.remeshAll();
  G.renderer.setSky(0xbcd3e6, 0xd4e2ec); // colder light
  // wake INSIDE the rock shelter, facing the mouth. The cave floor is y=9 so
  // the feet sit at 10 — an explicit y is required, because topAt at these
  // columns reads the cliff ABOVE the shelter and would drop us on the roof.
  G.player.teleport(SITES.shelter.x, SITES.shelter.z - 2, Math.PI, CAVE_FLOOR_Y + 0.02);
  G.mode = 'ground';
  // ground mode means the frame loop is driving the player again, and the
  // opening card/narration chain below is several seconds long: without this
  // a held key (or a fast tapper on touch) walks out of the shelter mid-card
  // and the scene's own teleport later yanks them back, which reads as a
  // glitch. Control is handed over at the wake line, once there is something
  // to walk toward. setEnabled(false) also hides the touch joystick, so the
  // opening reads as a cutscene on a phone instead of a paused game.
  G.input.setEnabled(false);

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
  STORE_A = { x: 44, z: 22 };
  const chest = addProp(G, P.makeCommunityChest(STORE_A.x, groundY(G, STORE_A.x, STORE_A.z), STORE_A.z));
  // the open store box, two blocks along the same line so both read as one
  // station: take tools out of the chest, put food into the box
  STORE_BOX_AT = { x: STORE_A.x + 2, z: STORE_A.z };
  STORE_BOX = addProp(G, P.makeStoreBox(STORE_BOX_AT.x, groundY(G, STORE_BOX_AT.x, STORE_BOX_AT.z), STORE_BOX_AT.z));

  // The band's stock. Stocked (not added) so re-entering the scene cannot
  // breed duplicate bows. More than one of each on purpose: the chest has to
  // read as the band's supply, not as a puzzle box holding exactly your quest
  // item. Anything already sitting in the player's hands from a previous run
  // is dropped back, so a resumed scene never starts you holding the tribe's
  // only bow.
  Inv.stock('chest', { basket: 4, bow: 2, rod: 2, spear: 2, waterskin: 1 });
  Inv.clear('player');
  if (!Save.getRecord('gathered')) Inv.clear('store');
  addStations(G, chest);
  addWildBerryPicks(G); // the whole valley is forageable, not just the six bushes
  refreshStoreFill();
  syncEquip(G);
  G.hud.onSatchel = () => openContainer(G, 'player');

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
  // Ten now, spread wider, so the plains read as a herd worth crossing the
  // valley for rather than a firing line. Animals beyond ~46 blocks of the
  // camera skip their AI and hide (see Animal.update), and the plains sit 57
  // blocks from camp, so the extra six are free for most of the act.
  const deer = [];
  for (let i = 0; i < 10; i++) {
    deer.push(new Animal(G.renderer.scene, {
      kind: 'deer',
      x: SITES.plains.x - 10 + (i % 5) * 5,
      z: SITES.plains.z - 4 + Math.floor(i / 5) * 7 + (i % 3) * 2,
      world: G.world, wander: 7,
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

  // Scene music, layered over the synth wind bed (which never stops).
  // A missing file is silent, so this is safe before anything is recorded.
  Sound.playMusic('act1.camp');

  // The wake is a one-time cutscene of roughly ninety seconds. A resumed save
  // must never sit through it again, so it is guarded by a marker record like
  // every other beat in this scene. The resume path still shows the era card,
  // because "where and when am I" is exactly what a returning player has lost.
  if (!Save.getRecord('woke')) {
    await wakeSequence(G);
    Save.addRecord({
      id: 'woke', type: 'camp', pos: { x: SITES.shelter.x, z: SITES.shelter.z },
      made: YEARS.SCENE_A_YEAR, data: { label: 'wake' },
    });
  } else {
    await G.hud.fadeIn(500);
    await G.hud.card([S.act1.sceneA_card, S.act1.sceneA_card2]);
    G.mode = 'ground';
    G.input.setEnabled(true);
    G.hud.hint(G.input.isTouch ? S.ui.joystickHint : S.ui.desktopHint, 8000);
  }
  refreshCodexBadge(G); // the 📖 pill reappears with whatever is already in it

  // --- hunger, then the basket, then berries (4.33) ---
  //
  // The order used to be backwards. storeLesson ("the tribe's tools belong to
  // everyone") fired before the player had touched a single berry, which made
  // it the first thing the game TEACHES. Now the hands fail first and it is the
  // first thing the game ANSWERS.
  if (!Save.getRecord('gathered')) {
    await bareHandBeat(G);
    await takeFromChest(G, 'basket', S.act1.obj_store_basket);
    chest.openFor(1200); // the lid drops again behind you
    FX.floaties(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { color: 0xffd9a0, count: 8, size: 0.1, life: 1.4 });
    await G.hud.narrator(S.act1.storeLesson); // shared tools — now an answer, not a lecture
    teach(G, 'band'); // 4.32 groups help each other, learned by borrowing

    // The basket STAYS in your hands through the gather. It used to be
    // replaced the moment you picked anything up, which quietly undid the
    // lesson: you cannot be taught that the tool is borrowed if it vanishes
    // before you can give it back.
    const berrySites = SITES.berries.slice(0, 5);
    const remaining = new Set(berrySites);
    objectiveCue(G, S.act1.obj_gather);
    setBeacon(G, nearestSite(G, [...remaining]));
    await new Promise((resolve) => {
      for (const b of berrySites) {
        G.interactables.push({
          id: `berry-${b.x}`, x: b.x, z: b.z, r: 2.4, prompt: '🫐', label: S.act1.pickBerry, enabled: true,
          onInteract(self) {
            self.enabled = false;
            remaining.delete(b);
            berryProps.get(b)?.setBerries(false);
            const bp = { x: b.x + 0.5, y: groundY(G, b.x, b.z) + 0.7, z: b.z + 0.5 };
            FX.puff(bp, { count: 5, size: 0.28, life: 0.55 });
            FX.floaties(bp, { color: 0xaef0c8, count: 7, size: 0.1, life: 1.3 });
            FX.floaties(bp, { color: 0xd8503c, count: 4, size: 0.09, life: 1.1, rise: 0.9 });
            Inv.add('player', 'berry', 3); // a handful per bush, not a single fruit
            syncEquip(G);
            const got = Inv.count('player', 'berry');
            G.hud.setObjective(S.act1.obj_gather_n(got));
            if (remaining.size === 0 || got >= 12) {
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
    await putInStore(G, 'berry', S.act1.obj_depositBerries, S.act1.depositBerriesDone);
    await returnToChest(G, 'basket', S.act1.obj_returnBasket, S.act1.returnBasketDone);
    await G.hud.narrator(S.act1.huntersGatherers);
    teach(G, 'huntGather'); // 4.33
    Save.addRecord({ id: 'gathered', type: 'camp', pos: { ...camp }, made: YEARS.SCENE_A_YEAR, data: { label: 'gather' } });
  }

  // --- hunt (real bow: fetch the bow, stalk the plains, loose arrows) ---
  if (!Save.getRecord('hunted')) {
    await takeFromChest(G, 'bow', S.act1.obj_store_bow);
    chest.openFor(1200);

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
        if (bag.length < HUNT_TARGET && wantShot) { Sound.playSfx('bow-loose'); spawnArrow(G, arrows); }
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
      await interactOnce(G, { id: `meat${i}`, x: m.at.x, z: m.at.z, r: 2.6, prompt: '🍖', label: S.act1.takeMeat });
      P.disposeGroup(G.renderer.scene, m.prop.group);
      G.props = G.props.filter((pp) => pp !== m.prop);
      Inv.add('player', 'meat', 1);
      syncEquip(G); // the bow is still the tool, so the bow is still what shows
      FX.floaties({ x: m.at.x, y: m.at.y + 0.5, z: m.at.z }, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.6, rise: 1.0 });
    }
    await G.hud.narrator(S.act1.huntSuccess);
    // The meat goes in the box. The BOW DOES NOT go back yet, and that is the
    // hinge the next beat turns on.
    await putInStore(G, 'meat', S.act1.obj_depositMeat, S.act1.depositMeatDone);
    FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 18 });
    Save.addRecord({ id: 'hunted', type: 'camp', pos: { ...SITES.plains }, made: YEARS.SCENE_A_YEAR, data: { label: 'hunt', count: HUNT_TARGET } });
  }

  // --- the second hunt, which is a ruse ---
  //
  // The band asks for more meat, so you walk back out to the plains still
  // carrying the bow. There is no second hunt: reaching the plains is what
  // spawns the bear, far from camp, which is the only way the run home is a
  // run at all. The old version spawned it beside the store box and "flee to
  // camp" was a seven block stroll.
  //
  // Guarded, unlike before. This beat used to replay on every resume into the
  // scene while every neighbour was guarded.
  if (!Save.getRecord('bear')) {
    if (!Inv.has('player', 'bow')) await takeFromChest(G, 'bow', S.act1.obj_store_bow);
    await G.hud.narrator(S.act1.moreMeat);
    objectiveCue(G, S.act1.obj_huntMore, SITES.plains);
    await reach(G, SITES.plains.x, SITES.plains.z, 9);

    // it takes its time: slow enough that walking away always works, spawned
    // far enough out that you get a good look at the size before it closes
    await G.hud.narrator(S.act1.predatorNear);
    const predator = new Animal(G.renderer.scene, {
      kind: 'predator', x: G.player.pos.x + 11, z: G.player.pos.z + 9, world: G.world, wander: 2, speed: 1.7,
    });
    G.npcs.push(predator);
    Sound.playSfx('bear-roar');
    Sound.playMusic('act1.chase', { fade: 0.4 });
    FX.flash(fxAt(G, predator.pos.x, predator.pos.z, 1.0), { color: 0xff5a4a, size: 1.7, life: 0.2 });
    FX.puff(predator.pos, { count: 10, size: 0.32, life: 0.6, color: 0xb0a184 });
    predator.followTarget = G.player.pos;
    // the hunt objective is dropped outright; there is only one thing to do now
    objectiveCue(G, S.act1.predatorChase, SITES.fire, 0xff8a6a); // safety marker: the fire
    await reach(G, SITES.fire.x, SITES.fire.z, 5);
    setBeacon(G, null); // safe — the fire beacon has done its job
    predator.followTarget = null;
    predator.fleeFrom(SITES.fire.x, SITES.fire.z);
    Sound.playMusic('act1.camp', { fade: 2.0 }); // back to safety
    FX.puff(predator.pos, { count: 12, size: 0.34, life: 0.7, color: 0xb0a184 });
    FX.ring(fxAt(G, SITES.fire.x, SITES.fire.z), { color: 0xffc98a, radius: 3.2, life: 0.8 });
    await G.hud.narrator(S.act1.predatorSafe);

    // and only now, out of breath, are you reminded it was never yours
    await returnToChest(G, 'bow', S.act1.obj_returnBow, S.act1.returnBowDone);
    Save.addRecord({ id: 'bear', type: 'camp', pos: { ...SITES.fire }, made: YEARS.SCENE_A_YEAR, data: { label: 'bear' } });
  }

  // --- fish the river (rod from the store first; the float minigame stays) ---
  if (!Save.getRecord('fished')) {
    await takeFromChest(G, 'rod', S.act1.obj_store_rod);
    chest.openFor(1200);
    // Four spots along the bank, not one, and derived from riverX() so they are
    // actually ON the water. SITES.fishSpot is 11 blocks inland from the river
    // centre, which is why the old splash FX fired over dry grass.
    const spots = FISH_SPOTS(G);
    objectiveCue(G, S.act1.obj_fish, spots[0]);
    const picked = await new Promise((resolve) => {
      for (const s of spots) {
        G.interactables.push({
          id: `fish-${s.x}-${s.z}`, x: s.x, z: s.z, r: 3.0, prompt: '🎣', label: S.act1.castLine, enabled: true,
          onInteract() {
            G.interactables = G.interactables.filter((o) => !String(o.id).startsWith('fish-'));
            resolve(s);
          },
        });
      }
    });
    setBeacon(G, null);
    await timingGame(G.hud.root, {
      title: S.act1.obj_fish, rounds: 1, speed: 1.5, zone: 0.65,
      failText: S.act1.fishMissed, mode: 'react',
    });
    // the catch breaks the surface: matte droplets + a couple of glints
    const splash = { x: picked.x, y: G.player.pos.y + 0.25, z: picked.z };
    FX.burst(splash, { color: 0xbfe4f5, count: 26, size: 0.13, speed: 3.4, life: 0.6, gravity: 9, additive: false });
    FX.burst(splash, { color: 0x9fd8ff, count: 8, size: 0.1, speed: 2.4, life: 0.45 });
    Inv.add('player', 'fish', 2);
    syncEquip(G);
    await G.hud.narrator(S.act1.fishCaught);
    await putInStore(G, 'fish', S.act1.obj_depositFish, S.act1.depositFishDone);
    await returnToChest(G, 'rod', S.act1.obj_returnRod, S.act1.returnRodDone);
    Save.addRecord({ id: 'fished', type: 'camp', pos: { ...SITES.fishSpot }, made: YEARS.SCENE_A_YEAR, data: { label: 'fish' } });
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
  // tribeNote MOVED here from the wake. It used to describe a tribe over an
  // empty shelter before the player had met anybody; now all six of them are
  // sitting around this fire while it plays.
  await G.hud.narrator(S.act1.tribeNote);
  await G.hud.narrator(S.act1.languageNote);
  teach(G, 'lostTongues'); // 4.35

  // RECALL 1. `band` was taught at the Community Chest about nine minutes ago,
  // and this is the first time the game asks the player to produce anything.
  // The gap is the point: asked any sooner it would test the last sentence
  // they read rather than anything they know.
  await recallBeat(G, { id: 'band', ...S.recall.q.band });

  // --- knapping: fire + improved tools (4.36) ---
  if (!Save.getRecord('arrowheads')) {
    objectiveCue(G, S.act1.obj_knap, SITES.knap);
    await interactOnce(G, { id: 'knap', x: SITES.knap.x, z: SITES.knap.z, prompt: '🪨', label: S.act1.lbl_knap });
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
    teach(G, 'toolmaking'); // 4.36
    Save.addRecord({ id: 'arrowheads', type: 'arrowheads', pos: { x: SITES.knap.x, z: SITES.knap.z }, made: YEARS.SCENE_A_YEAR, data: {} });
    Save.addRecord({ id: 'hearthA', type: 'hearth', pos: { ...SITES.fire }, made: YEARS.SCENE_A_YEAR, data: {} });
  }

  // --- cave painting (4.38) — SAVED VERBATIM ---
  if (!Save.getRecord('painting')) {
    // explicit y: the wall is inside the shelter — topAt would read the cliff
    objectiveCue(G, S.act1.obj_paint, { x: SITES.shelterWall.x, y: 10, z: SITES.shelterWall.z + 2 });
    await interactOnce(G, { id: 'paint', x: SITES.shelterWall.x, z: SITES.shelterWall.z + 2, r: 3, prompt: '🎨', label: S.act1.lbl_paint });
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
    teach(G, 'rockArt'); // 4.38
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
          id: `shell-${s.x}`, x: s.x, z: s.z, r: 2.4, prompt: '🐚', label: S.act1.lbl_shell, enabled: true,
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
    await interactOnce(G, { id: 'drill', x: SITES.knap.x, z: SITES.knap.z, prompt: '📿', label: S.act1.lbl_drill });
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
    teach(G, 'exchange'); // 4.39, ornaments half; the trade below is the other
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
    await interactOnce(G, { id: 'trade', x: camp.x + 4, z: camp.z + 3, r: 3.2, prompt: '🤝', label: S.act1.lbl_trade });
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

    // RECALL 2. `huntGather` was taught at the end of the gather, and the
    // visitors asking how your people eat is the most natural question in the
    // scene. Nobody has to be told it is a test, because it isn't one.
    await recallBeat(G, { id: 'huntGather', ...S.recall.q.huntGather });
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
  teach(G, 'camp'); // 4.34

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
  await interactOnce(G, { id: 'grave1', x: SITES.grave.x, z: SITES.grave.z, r: 3, prompt: '📿', label: S.act1.lbl_graveBeads });
  const beadsProp = addProp(G, P.makeBeads(0.8), SITES.grave.x - 0.3, gy - 0.45, SITES.grave.z + 0.2);
  void beadsProp;
  FX.floaties({ x: SITES.grave.x, y: gy + 0.2, z: SITES.grave.z }, { color: 0xd9d2c0, count: 5, size: 0.09, life: 2.2, rise: 0.5 });
  objectiveCue(G, S.act1.obj_burial_tool, SITES.grave, 0xb9c4cc);
  await interactOnce(G, { id: 'grave2', x: SITES.grave.x, z: SITES.grave.z, r: 3, prompt: '🔪', label: S.act1.lbl_graveBlade });
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
  teach(G, 'graveGoods'); // 4.37. No recall slot at a funeral, on purpose.
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
  teach(G, 'iceAge'); // 4.41, carried by the thawNote caption on the glimpse
  teach(G, 'thaw');   // 4.42
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
  // The fader has to come off BEFORE this card, not after the rebuild below.
  // `#fader` is z-index 50 and takes pointer events; `.card-overlay` is 30, so
  // a card raised under the fader is invisible AND untappable, and the only way
  // past it is the keyboard fallback (Enter / Space / E). A phone has no
  // keyboard, so Scene B ended on a black screen that never came back: the
  // valley crossed to 10,000 BCE, the two thaw lines played, and the game
  // stopped dead there. sceneD lifts the fader for exactly this reason. The
  // card itself is near opaque, so it covers the rebuild on its own.
  await G.hud.fadeIn(0);
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
          id: `plant-${s.x}-${s.z}`, x: s.x, z: s.z, r: 2.2, prompt: '🌾', label: S.act1.lbl_plant, enabled: true,
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
    teach(G, 'riverside');
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
  teach(G, 'farming'); // 4.43

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
  teach(G, 'shared'); // 4.46, taught either way: a wrong pick is corrected, not withheld
  Save.setChoice('granary', pick);

  // --- chieftain: task, dispute, lean week (4.45) ---
  chief.say('💧🌾?', 2600);
  await G.hud.narrator(S.act1.chiefIntro);
  objectiveCue(G, S.act1.obj_chief_task, { x: SITES.granary.x, z: SITES.granary.z + 2 });
  await interactOnce(G, { id: 'waterskin', x: SITES.granary.x, z: SITES.granary.z + 2, prompt: '💧', label: S.act1.lbl_waterskin });
  chestC.openFor(2000);
  G.player.equip('waterskin'); // taken from the shared store at the granary
  FX.burst(fxAt(G, SITES.granary.x, SITES.granary.z + 2, 0.5), { color: 0xbfe4f5, count: 12, size: 0.1, speed: 2.2, life: 0.5, gravity: 8, additive: false });
  setBeacon(G, SITES.farField); // second leg: carry it out to the far field
  await interactOnce(G, { id: 'farfield', x: SITES.farField.x, z: SITES.farField.z, r: 3.4, prompt: '🌾', label: S.act1.lbl_farfield });
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
  teach(G, 'chieftain'); // 4.45

  // RECALL 3. Crosses a scene boundary and a generation: `lostTongues` was
  // taught at the fire in scene A, and a child in the new hamlet asking what
  // the old ones sounded like is the widest gap the act can offer. Placed
  // AFTER the granary question rather than before it, so the player does not
  // meet two option boxes back to back and start reading them as a quiz.
  await recallBeat(G, { id: 'lostTongues', ...S.recall.q.lostTongues });
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
  teach(G, 'hamlet');

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
    await interactOnce(G, { id: 'kiln', x: SITES.kiln.x, z: SITES.kiln.z, r: 3, prompt: '🏺', label: S.act1.lbl_kiln });
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
    await interactOnce(G, { id: 'reeds', x: reeds.x, z: reeds.z, prompt: '🧺', label: S.act1.lbl_reeds });
    Save.addRecord({ id: 'basket', type: 'basket', pos: { ...SITES.playerHut }, made: YEARS.SCENE_D_YEAR, data: {} });
    recordTell(fxAt(G, reeds.x, reeds.z, 0.6));
    await G.hud.narrator(S.act1.basketDone);
  }

  // --- place both on the shelf ---
  const hut = SITES.playerHut;
  objectiveCue(G, S.act1.obj_shelf, hut);
  const hy = groundY(G, hut.x, hut.z);
  addProp(G, P.makeShelf(hut.x, hy - 1, hut.z - 1));
  await interactOnce(G, { id: 'shelf', x: hut.x, z: hut.z, r: 2.8, prompt: '🏺🧺', label: S.act1.lbl_shelf });
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
  teach(G, 'pottery'); // 4.49

  // RECALL 4. `farming` was taught back in scene C. A trader from a band that
  // still walks is exactly the person who would want to know why yours stopped.
  await recallBeat(G, { id: 'farming', ...S.recall.q.farming });

  // --- delivery run (4.47 exchange: food, clothing, tools) ---
  objectiveCue(G, S.act1.obj_delivery, SITES.granary);
  addProp(G, P.makeCart(SITES.village.x + 4, groundY(G, SITES.village.x + 4, SITES.village.z + 5) - 1, SITES.village.z + 5, 0.4));
  await interactOnce(G, { id: 'sack', x: SITES.granary.x, z: SITES.granary.z, r: 3, prompt: '🌾', label: S.act1.lbl_sack });
  chestD.openFor(2000);
  FX.puff(fxAt(G, SITES.granary.x, SITES.granary.z, 0.5), { count: 8, size: 0.3, life: 0.6, color: 0xd2a95f });
  const sack = P.makeSack();
  sack.update = () => sack.group.position.set(G.player.pos.x, G.player.pos.y + 2.1, G.player.pos.z);
  sack.update();
  addProp(G, sack);
  setBeacon(G, SITES.neighbour); // outbound leg: the neighbour village
  await interactOnce(G, { id: 'neigh', x: SITES.neighbour.x, z: SITES.neighbour.z, r: 4, prompt: '🤝', label: S.act1.lbl_neigh });
  G.renderer.scene.remove(sack.group);
  G.props = G.props.filter((p) => p !== sack);
  // the handoff lands — a little celebration at the neighbour village
  FX.ring(fxAt(G, SITES.neighbour.x, SITES.neighbour.z), { color: 0xffe9a8, radius: 3.0, life: 0.8 });
  FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 20 });
  await G.hud.narrator(S.act1.deliveryThere);
  setBeacon(G, SITES.granary); // return leg: home with the cloth
  await interactOnce(G, { id: 'home', x: SITES.granary.x, z: SITES.granary.z, r: 4, prompt: '🏠', label: S.act1.lbl_home });
  setBeacon(G, null); // round trip complete
  FX.ring(fxAt(G, SITES.granary.x, SITES.granary.z), { color: 0xffe9a8, radius: 2.4, life: 0.7 });
  await G.hud.narrator(S.act1.deliveryDone);
  teach(G, 'village'); // 4.47
  await G.hud.narrator(S.act1.networkNote); // 4.48 networks; villages → towns
  teach(G, 'network');

  // Anything still missed gets its second chance before the act closes, so
  // "asked" and "correct" in the exported data describe a fair test rather than
  // a snapshot of whoever happened to be unlucky on a first guess.
  await flushRecall(G);

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
