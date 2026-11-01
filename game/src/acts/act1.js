// ACT 1 — LIVE. Four scenes (Band, Thaw, Roots, Fire and Clay), every beat
// from design doc §4. Player actions write ObjectRecords the later acts read.
// Scene A, the band camp, is acts/sceneA.js (a task board, campTasks.js); the
// helpers every scene shares are acts/act1kit.js. Scenes B to D are here.
import { YEARS } from '../constants.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { B } from '../world/blocks.js';
import { SITES, buildSceneB, buildSceneC, buildSceneD } from '../world/states.js';
import { riverX } from '../world/terrain.js';
import { FX } from '../fx/fx.js';
import { Npc, Animal } from '../npc/npc.js';
import { AmbientLife, jobWood, jobTend } from '../npc/ambient.js';
import * as P from '../world/props.js';
import { potGame } from '../ui/pot.js';
import { runBeats } from './beats.js';
import { skyGlimpse } from '../sky/interstitial.js';
import { wait } from '../ui/hud.js';
import { objectiveCue, setBeacon } from '../ui/objective.js';
import { teach } from '../codex.js';
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

import { sceneA } from './sceneA.js';
import {
  resetStage, addProp, groundY, fxAt, lightFire, douseFires, forgetFire, interactOnce, reach,
  makeTalkable, recordTell,
} from './act1kit.js';

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
      G.renderer.setMist(0);
      FX.setMotes('pollen');
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
  G.renderer.setMist(0);
  FX.setMotes('pollen');
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
    forgetFire([kilnFlame, kilnSmoke]);
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
