// Act 1's shared kit: props, ground height, fire FX, the camp's two stations
// (the Community Chest and the store box) and the small waits every scene
// uses. Split out of acts/act1.js (2026-10-31) when Scene A became a task
// board (acts/sceneA.js, acts/campTasks.js); scenes B to D still live there.
import { S } from '../strings.js';
import { FX } from '../fx/fx.js';
import { Sound } from '../sound.js';
import { Inv } from '../inventory.js';
import { openContainer } from '../ui/container.js';
import { groundAnchor, objectiveCue, setBeacon } from '../ui/objective.js';
import { syncEquipment } from '../ui/equipment.js';
import { clearStage } from '../main.js';

export const resetStage = clearStage;

export function addProp(G, prop, x, y, z) {
  if (x !== undefined) prop.group.position.set(x, y, z);
  G.renderer.scene.add(prop.group);
  G.props.push(prop);
  return prop;
}

export function groundY(G, x, z) { return G.world.topAt(Math.round(x), Math.round(z)) + 1; }

// standing height on the rock-shelter floor (terrain carves the floor at y=9)
export const CAVE_FLOOR_Y = 10;

// ---------- FX helpers (visual polish only — never gameplay) ----------

// ground-level fx anchor at a world column (outdoor columns only; the cave
// interior must pass explicit y — topAt sees the cliff above it)
export const fxAt = groundAnchor;

// lit fires: every campfire/hearth gets a live FX flame + smoke column so it
// reads as burning from across the camp. Handles are stored here and retired
// by douseFires() at every scene clear (FX.clear() also retires them; the
// explicit removeHandle keeps this file honest about ownership).
let fireFx = [];
export function lightFire(G, x, z, o = {}) {
  const base = fxAt(G, x, z, o.dy ?? 0.1);
  fireFx.push(
    FX.flames(base, { size: o.size ?? 0.34, rate: o.rate }),
    FX.smoke({ x: base.x, y: base.y + 0.55, z: base.z }, { rate: o.smokeRate }),
  );
  return fireFx.slice(-2);
}
// a fire a scene puts out itself (Scene D's kiln) leaves the douse list
export function forgetFire(handles) {
  fireFx = fireFx.filter((h) => !handles.includes(h));
}
export function douseFires() {
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
// anything else. Set by Scene A (setStations) before any task.
let STORE_BOX = null;
let STORE_BOX_AT = null;
export const storeBoxAt = () => STORE_BOX_AT;

let STORE_A = null;
export function setStations({ chestAt, boxAt, box }) {
  STORE_A = chestAt; STORE_BOX_AT = boxAt; STORE_BOX = box;
}

// The player model has one visual slot but the inventory has many, so this
// respects the selected tool's saved equip/put-away state. Call it after transfers.
export function syncEquip(G) {
  syncEquipment(G);
}

// The crate visibly fills as the band's food piles up. Twelve is "full" and it
// clamps, so a generous gatherer cannot overflow the mesh.
export function refreshStoreFill() {
  STORE_BOX?.setFill(Math.min(1, Inv.total('store') / 12));
}

// Poll until a condition on the inventory holds. Beats wait on THIS rather than
// on one scripted tap, which is what lets the player open a box, look through
// it, change their mind and come back, with the beat advancing the moment the
// condition is actually true.
export function until(test, ms = 200) {
  return new Promise((resolve) => {
    if (test()) { resolve(); return; }
    const iv = setInterval(() => { if (test()) { clearInterval(iv); resolve(); } }, ms);
  });
}

// Register the two stations once for the whole scene. Before this, taking a
// tool was a one-shot scripted tap that handed you an item you never saw; now
// both are real containers you can open whenever you like.
export function addStations(G, chest) {
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
export async function takeFromChest(G, itemId, objectiveText) {
  objectiveCue(G, objectiveText, STORE_A);
  await until(() => Inv.has('player', itemId));
  setBeacon(G, null);
  FX.flash(fxAt(G, STORE_A.x, STORE_A.z, 0.6), { size: 0.6, life: 0.13 });
  G.audio?.blip?.();
}

export async function putInStore(G, itemId, objectiveText, doneText) {
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
export async function returnToChest(G, itemId, objectiveText, doneText) {
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
export function makeTalkable(G, characters) {
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
export function recordTell(pos) {
  FX.flash(pos, { size: 0.9, life: 0.14 });
  FX.floaties(pos, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.7, rise: 1.1 });
}


// wait until the player interacts with a named point
export function interactOnce(G, { id, x, z, r = 2.6, prompt }) {
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
export function reach(G, x, z, r = 3) {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  });
}
