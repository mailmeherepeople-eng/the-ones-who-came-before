// The band camp's tasks (Scene A), one function each. acts/sceneA.js runs
// them from the task board in whatever order the player picks (2026-10-31:
// "players should be able to do any task and not have to compulsorily do
// berry task first"). Each task is the beat it always was, moved here intact;
// what changed is that none of them waits for another to finish first.
//
// Every task is resumable: progress lives in Save activities and a task's
// record is written only when it is done, so a reload mid-task picks up
// where it stopped.
//
// `ctx` is the scene: { G, chest, deer, postTargets, berryProps, elder,
// visitors, shells }.
import * as THREE from '../../vendor/three.module.js';
import { YEARS } from '../constants.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { SITES, riverX } from '../world/terrain.js';
import { FX } from '../fx/fx.js';
import { Animal } from '../npc/npc.js';
import * as P from '../world/props.js';
import { timingGame } from '../ui/minigames.js';
import { paintingGame } from '../ui/paint.js';
import { wait } from '../ui/hud.js';
import { Sound } from '../sound.js';
import { Inv } from '../inventory.js';
import { objectiveCue, setBeacon, nearestSite } from '../ui/objective.js';
import { teach } from '../codex.js';
import { recallBeat } from '../recall.js';
import { gatherWithBasket } from './gathering.js';
import { huntWithBow } from '../games/hunt.js';
import { practiceAtPost } from '../games/range.js';
import {
  addProp, groundY, fxAt, recordTell, interactOnce, reach, until, syncEquip,
  takeFromChest, putInStore, returnToChest,
} from './act1kit.js';

// One kill fed nobody. The tribe is six people, so the hunt asks for three
// animals: enough that the player has to re-stalk a spooked herd rather than
// land one lucky shot, and it makes the store box beat carry real weight.
const HUNT_TARGET = 3;

export const MEET = (camp) => ({ x: camp.x + 4, z: camp.z + 3 }); // where the visitors stand

// ---------- gather ----------
export function runGather(ctx) {
  return gatherWithBasket(ctx.G, {
    berryProps: ctx.berryProps, chestAt: ctx.chestAt, takeFromChest, putInStore, returnToChest, syncEquip, until,
  });
}

// ---------- hunt, then the bear ----------
export async function runHunt(ctx) {
  const { G, chest, deer } = ctx;
  if (!Save.getRecord('hunted')) {
    if (!Inv.has('player', 'bow')) await takeFromChest(G, 'bow', S.act1.obj_store_bow);
    chest.openFor(1200);

    // the training post on the way out: three hits on the painted targets,
    // which is where the bow is taught (games/range.js)
    if (!Save.activity('hunt').practised) {
      objectiveCue(G, S.range.obj_practice, SITES.trainingPost);
      await reach(G, SITES.trainingPost.x, SITES.trainingPost.z, 3);
      setBeacon(G, null);
      await practiceAtPost(G, ctx.postTargets);
      Save.setActivity('hunt', { practised: true });
    }

    objectiveCue(G, S.act1.obj_hunt, SITES.plains);
    await reach(G, SITES.plains.x, SITES.plains.z, 8);
    setBeacon(G, null); // you are here, clear the sightline for aiming
    const downedList = await huntWithBow(G, deer, HUNT_TARGET);

    // one carcass becomes one meat pickup; collect them all before carrying
    // the haul home, so the walk back happens once rather than three times
    const meats = [];
    const deerIds = new Map(deer.map((animal, index) => [animal, index]));
    for (const d of downedList) {
      const at = { x: d.pos.x, y: d.pos.y, z: d.pos.z };
      d.dispose();
      G.npcs = G.npcs.filter((n) => n !== d);
      const k = deer.indexOf(d);
      if (k >= 0) deer.splice(k, 1);
      const id = deerIds.get(d);
      if (!(Save.activity('hunt').collected ?? []).includes(id)) meats.push({ id, at, prop: addProp(G, P.makeMeat(at.x, at.y, at.z)) });
    }
    for (let i = 0; i < meats.length; i++) {
      const m = meats[i];
      objectiveCue(G, S.act1.obj_meatN(i + 1, meats.length), m.at);
      await interactOnce(G, { id: `meat${i}`, x: m.at.x, z: m.at.z, r: 2.6, prompt: '🍖', label: S.act1.takeMeat });
      P.disposeGroup(G.renderer.scene, m.prop.group);
      G.props = G.props.filter((pp) => pp !== m.prop);
      Inv.add('player', 'meat', 1);
      Save.setActivity('hunt', { collected: [...(Save.activity('hunt').collected ?? []), m.id] });
      syncEquip(G); // the bow is still the tool, so the bow is still what shows
      FX.floaties({ x: m.at.x, y: m.at.y + 0.5, z: m.at.z }, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.6, rise: 1.0 });
    }
    await G.hud.narrator(S.act1.huntSuccess);
    // The meat goes in the box. The BOW DOES NOT go back yet, and that is the
    // hinge the bear turns on.
    await putInStore(G, 'meat', S.act1.obj_depositMeat, S.act1.depositMeatDone);
    FX.confetti({ x: G.player.pos.x, y: G.player.pos.y + 1.2, z: G.player.pos.z }, { count: 18 });
    Save.addRecord({ id: 'hunted', type: 'camp', pos: { ...SITES.plains }, made: YEARS.SCENE_A_YEAR, data: { label: 'hunt', count: HUNT_TARGET } });
  }

  // The second hunt is a ruse (CL 15.2). The band asks for more meat, so you
  // walk back out to the plains still carrying the bow. There is no second
  // hunt: reaching the plains is what spawns the bear, far from camp, which is
  // the only way the run home is a run at all. It stays part of the hunt task
  // so the bow is still in your hands when it comes.
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
    G.player.addTrauma(0.6); // the roar lands in the camera too
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
}

// ---------- fish ----------

// Fishing spots ON the bank, derived from the river's own centre line rather
// than hand-placed. SITES.fishSpot sits ~11 blocks inland, which is why the
// splash used to land on dry grass; it is kept as the first, signposted spot
// for continuity with the saved record, but nudged to the water like the rest.
export function FISH_SPOTS(G) {
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

export async function runFish(ctx) {
  const { G, chest } = ctx;
  if (!Save.activity('fish').caught) await takeFromChest(G, 'rod', S.act1.obj_store_rod);
  chest.openFor(1200);
  if (!Save.activity('fish').caught) {
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
    Save.setActivity('fish', { caught: true });
  }
  syncEquip(G);
  await G.hud.narrator(S.act1.fishCaught);
  await putInStore(G, 'fish', S.act1.obj_depositFish, S.act1.depositFishDone);
  await returnToChest(G, 'rod', S.act1.obj_returnRod, S.act1.returnRodDone);
  Save.addRecord({ id: 'fished', type: 'camp', pos: { ...SITES.fishSpot }, made: YEARS.SCENE_A_YEAR, data: { label: 'fish' } });
}

// ---------- the fire circle: lost language (4.35) ----------
// Opens once berries are gathered and a few tasks are done: its recall asks
// about `band`, taught at the gather, and asked any sooner it would test the
// last sentence the player read rather than anything they know.
export async function runFireCircle(ctx, { started = false } = {}) {
  const { G, elder } = ctx;
  if (!started) {
    objectiveCue(G, S.act1.obj_fire, SITES.fire);
    await reach(G, SITES.fire.x, SITES.fire.z, 3.4);
  }
  setBeacon(G, null); // seated — no beacon over the fire circle
  elder.goTo(SITES.fire.x + 1, SITES.fire.z);
  await wait(600);
  elder.faceToward(G.player.pos.x, G.player.pos.z);
  await G.hud.narrator(S.act1.elderSpeaks);
  for (const icons of ['◈ ﬦ ◇ ᨏ', 'ᨐ ◈◈ ﬦ', '◇ᨏ ﬦ ◈']) {
    elder.say(icons, 1900);
    await wait(1400);
  }
  // all six of them are sitting around this fire while it plays
  await G.hud.narrator(S.act1.tribeNote);
  await G.hud.narrator(S.act1.languageNote);
  teach(G, 'lostTongues'); // 4.35
  await recallBeat(G, { id: 'band', ...S.recall.q.band });
  Save.setActivity('fireCircle', { done: true });
}

// ---------- knapping: fire + improved tools (4.36) ----------
export async function runKnap(ctx, { started = false } = {}) {
  const { G } = ctx;
  if (!started) {
    objectiveCue(G, S.act1.obj_knap, SITES.knap);
    await interactOnce(G, { id: 'knap', x: SITES.knap.x, z: SITES.knap.z, prompt: '🪨', label: S.act1.lbl_knap });
  }
  setBeacon(G, null);
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

// ---------- cave painting (4.38), saved verbatim ----------
export function placePaintingMesh(G, png, brightness = 1) {
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

export async function runPaint(ctx, { started = false } = {}) {
  const { G } = ctx;
  if (!started) {
    // explicit y: the wall is inside the shelter — topAt would read the cliff
    objectiveCue(G, S.act1.obj_paint, { x: SITES.shelterWall.x, y: 10, z: SITES.shelterWall.z + 2 });
    await interactOnce(G, { id: 'paint', x: SITES.shelterWall.x, z: SITES.shelterWall.z + 2, r: 3, prompt: '🎨', label: S.act1.lbl_paint });
  }
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
}

// ---------- shells and beads (4.39, the ornaments half) ----------

// The shells lie on the bank from the start and can be picked up at any time,
// so a player who finds them first has started the beads task by picking one.
// `onPick` lets the running beads task move its objective along.
export function addShells(G) {
  const collected = new Set(Save.activity('shells').sites ?? []);
  const left = new Set(SITES.shells.filter((s) => !collected.has(`${s.x},${s.z}`)));
  const api = {
    count: () => collected.size,
    left: () => [...left],
    onPick: null,
  };
  if (Save.getRecord('beads')) return api;
  for (const s of [...left]) {
    const prop = addProp(G, P.makeShellPickup(s.x, groundY(G, s.x, s.z), s.z));
    G.interactables.push({
      id: `shell-${s.x}`, x: s.x, z: s.z, r: 2.4, prompt: '🐚', label: S.act1.lbl_shell, enabled: true,
      onInteract(self) {
        self.enabled = false;
        G.interactables = G.interactables.filter((o) => o !== self);
        left.delete(s);
        const sp = { x: s.x, y: groundY(G, s.x, s.z) + 0.3, z: s.z };
        FX.flash(sp, { size: 0.6, life: 0.13 });
        FX.floaties(sp, { color: 0xf2e3c9, count: 8, size: 0.1, life: 1.3 });
        G.renderer.scene.remove(prop.group);
        collected.add(`${s.x},${s.z}`);
        Save.setActivity('shells', { sites: [...collected] });
        api.onPick?.(collected.size);
      },
    });
  }
  return api;
}

export async function runBeads(ctx) {
  const { G, shells } = ctx;
  if (shells.count() < 3) {
    objectiveCue(G, S.act1.obj_shells_n(shells.count()), nearestSite(G, shells.left()));
    shells.onPick = (n) => {
      G.hud.setObjective(S.act1.obj_shells_n(n));
      setBeacon(G, n >= 3 ? null : nearestSite(G, shells.left()));
    };
    await until(() => shells.count() >= 3);
    shells.onPick = null;
  }
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
  teach(G, 'exchange'); // 4.39, ornaments half; the trade is the other
  Save.addRecord({ id: 'beads', type: 'beads', pos: { ...SITES.grave }, made: YEARS.SCENE_A_YEAR, data: { count: 7 } });
}

// ---------- the visitors' trade (4.39, the exchange half) ----------
// Opens once beads are made (something to trade) and berries gathered (its
// recall asks about `huntGather`, taught at the end of the gather). The
// visitors are already standing at MEET when this starts (sceneA.js).
export async function runTrade(ctx, { started = false } = {}) {
  const { G, visitors } = ctx;
  const at = MEET(SITES.campA);
  if (!started) {
    objectiveCue(G, S.act1.obj_trade, at);
    await interactOnce(G, { id: 'trade', x: at.x, z: at.z, r: 3.2, prompt: '🤝', label: S.act1.lbl_trade });
  }
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
  recordTell(fxAt(G, at.x, at.z, 0.8));
  await G.hud.narrator(S.act1.tradeDone);
  // the visitors asking how your people eat is the most natural question in
  // the scene; nobody has to be told it is a test, because it isn't one
  await recallBeat(G, { id: 'huntGather', ...S.recall.q.huntGather });
  for (const v of visitors) v.goTo(v.pos.x + 14, v.pos.z + 10);
}
