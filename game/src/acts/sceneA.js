// SCENE A: the band camp, about 38,000 years ago (Act 1, LIVE).
//
// 2026-10-31: "i want it to be tasks. players should be able to do any task
// and not have to compulsorily do berry task first." The camp's work is now a
// task board (a painted hide by the store box, ui/taskboard.js) run by the scheduler at the bottom of this
// file; the tasks themselves are acts/campTasks.js. Doing a thing starts its
// task: taking the bow starts the hunt, the rod the fishing, a berry bush with
// the basket the gathering, the knapping stone, the cave wall, a shell, the
// visitors and the fire circle start theirs. One task runs at a time. When
// every task is done the food runs out, the band moves on, and the elder is
// buried, as before.
import * as THREE from '../../vendor/three.module.js';
import { YEARS, WORLD } from '../constants.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { B } from '../world/blocks.js';
import { SITES, buildSceneA } from '../world/states.js';
import { placeTree, riverX } from '../world/terrain.js';
import { FX } from '../fx/fx.js';
import { Npc, Animal } from '../npc/npc.js';
import { AmbientLife, jobHunt, jobFish, jobGather, jobWood } from '../npc/ambient.js';
import * as P from '../world/props.js';
import { tween } from '../sky/interstitial.js';
import { wait } from '../ui/hud.js';
import { SFX } from '../audio.js';
import { Sound } from '../sound.js';
import { Inv } from '../inventory.js';
import { openContainer } from '../ui/container.js';
import { objectiveCue, setBeacon, nearestSite, propAnchor } from '../ui/objective.js';
import { teach, refreshCodexBadge } from '../codex.js';
import { needsOnboarding, runOnboarding, tutorialCheckpoint, dressTrainingShelter } from './onboarding.js';
import { addTrainingPost } from '../games/range.js';
import { installTaskBoard } from '../ui/taskboard.js';
import {
  resetStage, addProp, groundY, CAVE_FLOOR_Y, lightFire, douseFires, setStations, addStations,
  syncEquip, refreshStoreFill, makeTalkable, interactOnce,
} from './act1kit.js';
import {
  runGather, runHunt, runFish, runFireCircle, runKnap, runPaint, runBeads, runTrade,
  addShells, placePaintingMesh, MEET,
} from './campTasks.js';

// the task that is running, read by the wild berries so a pick moves the
// gather objective only while gathering is what you are doing
let activeTask = null;

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
// SHRUB_BERRY blocks are placement seeds. addWildBerryPicks replaces them
// with the same model as the task bushes, instanced in two draw calls.
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
  const sites = [], picked = new Set(Save.activity('wildBerries').sites ?? []);
  for (let x = 0; x < WORLD.SIZE_X; x++) {
    for (let z = 14; z < WORLD.SIZE_Z; z++) {
      const gy = G.world.topAt(x, z) + 1;
      if (G.world.get(x, gy, z) !== B.SHRUB_BERRY) continue;
      G.world.set(x,gy,z,B.AIR);
      sites.push({cellX:x,cellZ:z,x:x+.5,y:gy,z:z+.5,hasBerries:!picked.has(`${x},${z}`)});
    }
  }
  const patch = addProp(G,P.makeBerryPatch(sites));
  for (let i=0;i<sites.length;i++) {
      const site=sites[i], plant=patch.plants[i], x=site.cellX,z=site.cellZ;
      if (!plant.hasBerries) continue;
      G.interactables.push({
        id: `wild-${x}-${z}`, x:site.x, z:site.z, r: 2.4, prompt: '🫐', label: S.act1.pickBerry, enabled: true,
        onInteract(self) {
          if (!Inv.has('player', 'basket')) { G.hud.toast(S.revision.needBasket); return; }
          if (Inv.equippedTool() !== 'basket') { G.hud.toast(G.input.isTouch ? S.onboarding.equipNeededTouch : S.onboarding.equipNeeded); return; }
          self.enabled = false;
          Save.setActivity('wildBerries', { sites: [...(Save.activity('wildBerries').sites ?? []), `${x},${z}`] });
          G.interactables = G.interactables.filter((o) => o !== self);
          plant.setBerries(false);
          const bp = { x:site.x, y:site.y+0.65, z:site.z };
          FX.puff(bp, { count: 4, size: 0.24, life: 0.5 });
          FX.floaties(bp, { color: 0xd8503c, count: 5, size: 0.09, life: 1.1, rise: 0.9 });
          Inv.add('player', 'berry', 2);
          if (!Save.getRecord('gathered')) {
            Save.setActivity('gather', { picked: (Save.activity('gather').picked ?? 0) + 2 });
            if (activeTask === 'gather') G.hud.setObjective(S.revision.gatherPick(Save.activity('gather').picked));
          }
          syncEquip(G);
          G.audio?.blip?.();
        },
      });
  }
  return patch;
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
  await G.hud.fadeIn(900);
  await G.hud.card([S.act1.sceneA_card]);
  const restY = cam.position.y;
  await tween(700, (t) => {
    cam.position.y = restY + Math.sin(t * Math.PI * 2) * 0.035; // two slow breaths
  });
  G.hud.toast(needsOnboarding() ? S.onboarding.wake : S.act1.wake_ceiling, 3600);

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
  if (!needsOnboarding()) {
    G.hud.hint(G.input.isTouch ? S.ui.joystickHint : S.ui.desktopHint, 8000);
    await G.hud.narrator(S.act1.wake_stand);
  }
}

// ---------- the scene ----------

export async function sceneA(G) {
  const training = needsOnboarding();
  if (training) Save.setActivity('onboarding', { started:true });
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
  G.renderer.setSky(0xbcd3e6, 0xd4e2ec, 0xdbe6f2); // colder light
  // the ice-age basin: a thin cold mist on the low ground, snow in the air
  G.renderer.setMist(0.45, 10, 5);
  FX.setMotes('snow');
  dressTrainingShelter(G);
  // wake INSIDE the rock shelter, facing the mouth. The cave floor is y=9 so
  // the feet sit at 10 — an explicit y is required, because topAt at these
  // columns reads the cliff ABOVE the shelter and would drop us on the roof.
  if (training) {
    const at = tutorialCheckpoint(Save.activity('onboarding').step ?? 0);
    G.player.teleport(at.x, at.z, at.yaw, at.y);
    FX.setMotes(null);
  } else G.player.teleport(SITES.shelter.x, SITES.shelter.z - 2, Math.PI, CAVE_FLOOR_Y + 0.02);
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
  const STORE_A = { x: 44, z: 22 };
  const chest = addProp(G, P.makeCommunityChest(STORE_A.x, groundY(G, STORE_A.x, STORE_A.z), STORE_A.z));
  // the open store box, two blocks along the same line so both read as one
  // station: take tools out of the chest, put food into the box
  const STORE_BOX_AT = { x: STORE_A.x + 2, z: STORE_A.z };
  const STORE_BOX = addProp(G, P.makeStoreBox(STORE_BOX_AT.x, groundY(G, STORE_BOX_AT.x, STORE_BOX_AT.z), STORE_BOX_AT.z));
  setStations({ chestAt: STORE_A, boxAt: STORE_BOX_AT, box: STORE_BOX });

  // The band's stock. Stocked (not added) so re-entering the scene cannot
  // breed duplicate bows. More than one of each on purpose: the chest has to
  // read as the band's supply, not as a puzzle box holding exactly your quest
  // item. Anything already sitting in the player's hands from a previous run
  // is dropped back, so a resumed scene never starts you holding the tribe's
  // only bow.
  if (!Save.activity('campStock').ready) {
    Inv.stock('chest', { basket: 4, bow: 2, rod: 2, spear: 2, waterskin: 1 });
    Save.setActivity('campStock', { ready: true });
  }
  addStations(G, chest);
  const wildBerryPatch = addWildBerryPicks(G);
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
  const postTargets = addTrainingPost(G); // by the crossing, on the way to the plains
  const shells = addShells(G); // on the bank from the start; picking one starts the beads
  if (Save.getRecord('painting')) placePaintingMesh(G, Save.getRecord('painting').data.png, 1);

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
    await G.hud.card([S.act1.sceneA_card]);
    G.mode = 'ground';
    G.input.setEnabled(true);
    if (!training) G.hud.hint(G.input.isTouch ? S.ui.joystickHint : S.ui.desktopHint, 8000);
  }
  refreshCodexBadge(G); // the 📖 pill reappears with whatever is already in it

  if (training) await runOnboarding(G);

  await runCampTasks({
    G, chest, chestAt: STORE_A, deer, postTargets, berryProps, elder, shells, visitors: null,
  });

  // --- depletion beat: why hunter-gatherers move ---
  // the working day stops here: no more errands out of the chest while the
  // band faces an empty valley, and every worker is handed back to the script
  ambient.stop();
  // every bush empties: the gather sites are berry-bush props now
  for (const bp of berryProps.values()) bp.setBerries(false);
  wildBerryPatch.setBerries(false);
  G.interactables = G.interactables.filter(o => !String(o.id).startsWith('wild-'));
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

// ---------- the task board ----------
//
// Six tasks are open from the start. The trade waits for beads (something to
// trade) and the gathering (its recall asks about `huntGather`, taught there);
// the fire circle waits for the gathering (its recall asks about `band`) and
// three other tasks, so its question comes after a real gap. The hunt
// includes the bear: the ruse needs the bow still in your hands.
const TASKS = [
  { id: 'gather', icon: '🫐', done: () => !!Save.getRecord('gathered') },
  { id: 'hunt', icon: '🏹', done: () => !!Save.getRecord('bear') },
  { id: 'fish', icon: '🎣', done: () => !!Save.getRecord('fished') },
  { id: 'knap', icon: '🪨', done: () => !!Save.getRecord('arrowheads') },
  { id: 'paint', icon: '🎨', done: () => !!Save.getRecord('painting') },
  { id: 'beads', icon: '📿', done: () => !!Save.getRecord('beads') },
  { id: 'trade', icon: '🤝', done: () => !!Save.getRecord('obsidian'), needs: ['beads', 'gather'] },
  { id: 'fire', icon: '🔥', done: () => !!Save.activity('fireCircle').done, needs: ['gather'], after: 3 },
];
const RUN = { gather: runGather, hunt: runHunt, fish: runFish, knap: runKnap, paint: runPaint, beads: runBeads, trade: runTrade, fire: runFireCircle };

// An arm waits for the act that starts a task, and can be called off.
function armPoll(test) {
  let iv;
  const promise = new Promise((res) => { iv = setInterval(() => { if (test()) res(); }, 200); });
  return { promise, cancel: () => clearInterval(iv) };
}
function armSpot(G, spot) {
  let self;
  const promise = new Promise((res) => {
    self = { ...spot, enabled: true, onInteract: () => { G.interactables = G.interactables.filter((o) => o !== self); res(); } };
    G.interactables.push(self);
  });
  return { promise, started: true, cancel: () => { G.interactables = G.interactables.filter((o) => o !== self); } };
}

async function runCampTasks(ctx) {
  const { G } = ctx;
  const byId = Object.fromEntries(TASKS.map((t) => [t.id, t]));
  const doneCount = () => TASKS.filter((t) => t.done()).length;
  const missing = (t) => (t.needs ?? []).filter((n) => !byId[n].done());
  const othersDone = (t) => TASKS.filter((o) => o !== t && o.done()).length;
  const open = (t) => !t.done() && !missing(t).length && othersDone(t) >= (t.after ?? 0);
  const meet = MEET(SITES.campA);
  const wall = { x: SITES.shelterWall.x, y: CAVE_FLOOR_Y, z: SITES.shelterWall.z + 2 };
  const bushes = () => [...ctx.berryProps.values()].map((p) => propAnchor(p));

  // where "Show me" points: the chest while the task's tool is still in it
  const whereOf = (id) => {
    if (id === 'gather') return Inv.has('player', 'basket') ? nearestSite(G, bushes()) : ctx.chestAt;
    if (id === 'hunt') return Inv.has('player', 'bow') ? (Save.activity('hunt').practised ? SITES.plains : SITES.trainingPost) : ctx.chestAt;
    if (id === 'fish') return ctx.chestAt;
    if (id === 'knap') return SITES.knap;
    if (id === 'paint') return wall;
    if (id === 'beads') return nearestSite(G, ctx.shells.left()) ?? SITES.knap;
    if (id === 'trade') return meet;
    return SITES.fire;
  };
  const hideAt = SITES.taskHide;
  const board = installTaskBoard(G, {
    at: hideAt, y: groundY(G, hideAt.x, hideAt.z), onShow: (id) => objectiveCue(G, S.tasks.how[id], whereOf(id)),
  });
  const render = () => board.render(TASKS.map((t) => {
    // one at a time: while a task runs, the open ones wait their turn
    const state = t.done() ? 'done' : activeTask === t.id ? 'active' : !open(t) ? 'locked' : activeTask ? 'next' : 'open';
    const note = state === 'done' ? S.tasks.doneNote : state === 'active' ? S.tasks.activeNote
      : state === 'next' ? S.tasks.nextNote(S.tasks.names[activeTask])
      : state === 'open' ? S.tasks.how[t.id]
      : missing(t).length ? S.tasks.waits(missing(t).map((n) => S.tasks.names[n]))
      : S.tasks.afterN((t.after ?? 0) - othersDone(t));
    return { id: t.id, icon: t.icon, name: S.tasks.names[t.id], state, note };
  }));
  const spawnVisitors = () => {
    const camp = SITES.campA;
    ctx.visitors = [];
    for (let i = 0; i < 3; i++) {
      ctx.visitors.push(new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
        x: camp.x + 10 + i, z: camp.z + 8 + i, world: G.world, wander: 1.5, wrap: 0x3d5a66, name: `visitor${i}`,
      }));
    }
    G.npcs.push(...ctx.visitors);
    ctx.visitors[0].goTo(meet.x, meet.z);
  };
  const armFor = (t) => {
    if (t.id === 'gather') {
      const picked0 = Save.activity('gather').picked ?? 0;
      return armPoll(() => (Save.activity('gather').picked ?? 0) > picked0 ||
        (Inv.equippedTool() === 'basket' && bushes().some((b) => Math.hypot(b.x - G.player.pos.x, b.z - G.player.pos.z) < 6)));
    }
    if (t.id === 'hunt') return armPoll(() => Inv.has('player', 'bow'));
    if (t.id === 'fish') return armPoll(() => Inv.has('player', 'rod'));
    if (t.id === 'beads') { const n0 = ctx.shells.count(); return armPoll(() => ctx.shells.count() > n0); }
    if (t.id === 'knap') return armSpot(G, { id: 'arm-knap', x: SITES.knap.x, z: SITES.knap.z, r: 2.6, prompt: '🪨', label: S.act1.lbl_knap });
    if (t.id === 'paint') return armSpot(G, { id: 'arm-paint', x: wall.x, z: wall.z, r: 3, prompt: '🎨', label: S.act1.lbl_paint });
    if (t.id === 'trade') return armSpot(G, { id: 'arm-trade', x: meet.x, z: meet.z, r: 3.2, prompt: '🤝', label: S.act1.lbl_trade });
    return armSpot(G, { id: 'arm-fire', x: SITES.fire.x, z: SITES.fire.z, r: 3.4, prompt: '🔥', label: S.act1.obj_fire });
  };

  if (!Save.activity('campTasks').intro) {
    render();
    await G.hud.narrator(S.tasks.intro);
    Save.setActivity('campTasks', { intro: true });
  }
  while (TASKS.some((t) => !t.done())) {
    render();
    let id = Save.activity('campTasks').current;
    let started = false;
    if (!id || !byId[id] || byId[id].done()) {
      if (open(byId.trade) && !ctx.visitors) { spawnVisitors(); G.hud.toast(S.tasks.visitors, 4200); }
      objectiveCue(G, S.tasks.choose(doneCount(), TASKS.length), board.spot); // the light on the hide
      const arms = TASKS.filter(open).map((t) => ({ t, arm: armFor(t) }));
      const k = await Promise.race(arms.map((a, i) => a.arm.promise.then(() => i)));
      for (const a of arms) a.arm.cancel();
      id = arms[k].t.id;
      started = !!arms[k].arm.started;
      Save.setActivity('campTasks', { current: id });
    } else if (id === 'trade' && !ctx.visitors) spawnVisitors();
    activeTask = id;
    render();
    if (started) objectiveCue(G, S.tasks.names[id]); // the task's own steps take over from here
    await RUN[id](ctx, { started });
    activeTask = null;
    Save.setActivity('campTasks', { current: null });
    render();
    if (TASKS.some((t) => !t.done())) G.hud.toast(S.tasks.doneToast(S.tasks.names[id], doneCount(), TASKS.length), 3200);
  }
  board.remove();
}
