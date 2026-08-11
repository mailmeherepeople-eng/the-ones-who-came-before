// ACT 3 — DIG. The five-specialist excavation of the player's own past.
// Wrong-specialist attempts fail gently — that IS the who-does-what lesson.
// Mapping is exam content (spec §1.1): anthropologist talks; archaeologist
// digs (including bones, teeth, burnt grain); palaeontologist reads only
// deep-time fossils; epigraphist reads signs; geologist reads the ground.
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { WORLD } from '../constants.js';
import { B } from '../world/blocks.js';
import { SITES, buildStage } from '../world/states.js';
import { Npc } from '../npc/npc.js';
import * as P from '../world/props.js';
import { runBeats } from './beats.js';
import { wait } from '../ui/hud.js';
import { collectCard, showSourceCard, claimBoard, labTray, siteReport, satchelPanel, potPortrait } from '../ui/report.js';
import { SFX } from '../audio.js';
import { FX } from '../fx/fx.js';

export async function runAct3(G, resumeBeat = null) {
  const { clearStage } = await import('../main.js');
  clearStage(G);
  G.tick = null;

  buildStage(G.world, 7);
  // wayfinding fix: the camp used to spawn you nose-first into a wall of
  // tufts — clear walk-through cross flora around the spawn (never solids)
  clearCrossFlora(G.world, SITES.digCamp.x, SITES.digCamp.z, 6);
  G.mesher.remeshAll();
  G.renderer.setSky(0x9ec8e8, 0xcfe0ee);
  G.player.teleport(SITES.digCamp.x, SITES.digCamp.z + 2, Math.PI * 1.1);
  G.mode = 'ground';
  G.input.setEnabled(true);
  // safety sweep, same spirit as the setEnabled above: act 2 hides the body for
  // its overhead diorama, and act 3 is where it walks again. Covers the paths
  // that never reach act 2's own restore (a jump straight here, or act 2
  // throwing part way through).
  G.player.setModelHidden(false);
  await G.hud.fadeIn(600);
  await G.hud.card([S.act3.title, S.act3.card]);

  const ctx = { G, spec: 'geologist', bar: null, visionProps: [], zonePillars: [], way: null, ambients: null };
  buildSpecialistBar(ctx);
  // beacon over the survey mound from the first second of the act — the
  // objective says "survey the mound"; this says WHERE the mound is
  const effResume = resumeBeat?.startsWith('a3.') ? resumeBeat : null;
  if (!effResume || effResume === 'a3.survey') {
    ctx.way = plantWayfinder(ctx, SITES.village, {
      color: SPEC_FX.geologist.color, crumbsFrom: SITES.digCamp, flag: true,
    });
  }
  G.hud.setSatchel(Save.data.cards.length, true);
  // basket button toggles: opens the satchel, and closes it when already open
  // (satchelPanel also self-closes via its ✕ / Escape / backdrop)
  let satchelClose = null;
  G.hud.onSatchel = async () => {
    if (satchelClose) { satchelClose(); return; }
    const panel = satchelPanel(G);
    satchelClose = panel.close;
    await panel;
    satchelClose = null;
  };

  // ambient life: the modern village must not stand empty until the interview
  // beat — two background villagers potter about from the first minute. They
  // are disposed when interviews() spawns its interviewees, so they can never
  // collide with the talk interactables or the dialog flow (their names also
  // differ from every interviewee key).
  const mv = SITES.modernVillage;
  ctx.ambients = [
    new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: mv.x + 6, z: mv.z - 2, world: G.world, wander: 2, wrap: 0x8a6a3d, name: 'ambient-a',
    }),
    new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: mv.x - 6, z: mv.z + 4, world: G.world, wander: 2, wrap: 0x6d5a70, name: 'ambient-b',
    }),
  ];
  G.npcs.push(...ctx.ambients);

  const beats = [
    { id: 'a3.survey', run: () => survey(ctx) },
    { id: 'a3.dig', run: () => digs(ctx) },
    { id: 'a3.fossil', run: () => fossils(ctx) },
    { id: 'a3.epi', run: () => epigraphist(ctx) },
    { id: 'a3.talk', run: () => interviews(ctx) },
    { id: 'a3.claims', run: () => claims(ctx) },
    { id: 'a3.lab', run: () => lab(ctx) },
    { id: 'a3.report', run: () => finale(ctx) },
  ];
  await runBeats(3, beats, resumeBeat?.startsWith('a3.') ? resumeBeat : null);

  for (const p of ctx.zonePillars) FX.removeHandle(p.h); // safety sweep
  ctx.zonePillars.length = 0;
  retireWayfinder(ctx); // safety sweep: no beacon outlives the act
  disposeAmbients(ctx); // safety sweep: resumed sessions may never hit interviews()
  ctx.bar?.remove();
  document.body.classList.remove('has-specialists');
  G.hud.onSatchel = null;
  G.hud.setSatchel(Save.data.cards.length, false);
}

// ---------- specialist toolbar ----------

const SPEC_ICONS = {
  geologist: '⛰️', palaeontologist: '🦴', archaeologist: '⛏️',
  anthropologist: '🗣️', epigraphist: '📜',
};

// signature power colors — kids learn who-does-what by FEEL (color + shape)
const SPEC_FX = {
  geologist: { color: 0x49b89a },      // earth-teal: waves, ground vision
  palaeontologist: { color: 0x9a7be8 }, // deep-time violet: drifting motes
  archaeologist: { color: 0xe0a458 },   // ember-amber: dirt, warm reveals
  anthropologist: { color: 0xe8879c },  // warm-rose: listening rings
  epigraphist: { color: 0x5b8fd6 },     // ink-blue: reading flashes
};
const FIZZLE_GREY = 0x9aa0a6; // wrong-tool dud puff

function buildSpecialistBar(ctx) {
  const { G } = ctx;
  const bar = document.createElement('div');
  bar.id = 'specialist-bar';
  for (const key of Object.keys(SPEC_ICONS)) {
    const b = document.createElement('button');
    b.className = 'spec-btn' + (key === ctx.spec ? ' sel' : '');
    b.dataset.spec = key;
    b.innerHTML = `${SPEC_ICONS[key]}<small>${S.act3.specialists[key]}</small>`;
    b.addEventListener('click', () => {
      ctx.spec = key;
      bar.querySelectorAll('.spec-btn').forEach((x) => x.classList.toggle('sel', x === b));
      // power-up tell: a big thick ring in the specialist's signature color,
      // seated on the CURRENT ground column (never a stale/buried y), plus
      // motes at chest height so the tell reads even in first person
      const pp = G.player.pos;
      const ringY = G.world.topAt(Math.round(pp.x), Math.round(pp.z)) + 1.05;
      // both effects carry the specialist color explicitly; floaties stay
      // small (0.09) — at 0.14 the additive motes bloomed into big white orbs
      FX.ring({ x: pp.x, y: ringY, z: pp.z }, { color: SPEC_FX[key].color, radius: 3.2, life: 0.9, width: 0.45 });
      FX.floaties({ x: pp.x, y: pp.y + 1.1, z: pp.z }, { color: SPEC_FX[key].color, count: 12, size: 0.09, life: 1.5, rise: 1.0 });
      G.hud.toast(`${SPEC_ICONS[key]} ${S.act3.specialists[key]}, ${S.act3.specialistBlurbs[key]}`, 4200);
    });
    bar.appendChild(b);
  }
  G.hud.root.appendChild(bar);
  document.body.classList.add('has-specialists');
  ctx.bar = bar;
}

// gate an interactable on the active specialist
function gated(ctx, spec, hintKey, onOk) {
  return (self) => {
    if (ctx.spec !== spec) {
      // fizzle: a grey dud puff — failure gets feedback too, but clearly reads
      // as "wrong tool", never as a power. The toast stays: that's the lesson.
      FX.puff(
        { x: self.x, y: groundY(ctx.G, self.x, self.z), z: self.z },
        { color: FIZZLE_GREY, count: 6, size: 0.3, life: 0.5, alpha: 0.35 },
      );
      ctx.G.hud.toast(S.act3.wrongSpecialist[hintKey], 3600);
      return;
    }
    return onOk(self);
  };
}

function groundY(G, x, z) { return G.world.topAt(Math.round(x), Math.round(z)) + 1; }

// ---------- wayfinding (defect fix: reviewers never found the mound) ----------

// Clear decorative cross flora (walk-through ids TALLGRASS..SNOWTUFT only —
// NEVER solid blocks, so heights/terrain are untouched) in a square radius.
function clearCrossFlora(world, cx, cz, radius = 6) {
  for (let x = cx - radius; x <= cx + radius; x++) {
    for (let z = cz - radius; z <= cz + radius; z++) {
      for (let y = 0; y < WORLD.SIZE_Y; y++) {
        const id = world.get(x, y, z);
        if (id >= B.TALLGRASS && id <= B.SNOWTUFT) world.set(x, y, z, B.AIR);
      }
    }
  }
}

// A tall persistent light-pillar over a far-away target, optionally with a
// survey flag at its base and a breadcrumb line of short pillar stubs from
// the player's side. Budget: 1 beacon + ≤4 crumbs = 5 of the 6 pillar slots.
function plantWayfinder(ctx, site, { color = 0x49b89a, height = 14, crumbsFrom = null, flag = false } = {}) {
  const { G } = ctx;
  const way = { pillars: [] };
  // the main beacon must be unmissable from across the map: solid-ish alpha
  // and the breathing pulse (the old 0.22 base read as invisible in daylight)
  way.pillars.push(FX.pillar(
    { x: site.x, y: groundY(G, site.x, site.z), z: site.z },
    { color, height, life: 0, opacity: 0.5, pulse: true },
  ));
  if (flag) {
    const f = P.makeSurveyFlag(site.x + 1, groundY(G, site.x + 1, site.z), site.z);
    G.renderer.scene.add(f.group);
    G.props.push(f); // flag stays after the beacon retires — a mark of work done
  }
  if (crumbsFrom) {
    const steps = 4; // short stubs marching along the straight line to the target
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const x = Math.round(crumbsFrom.x + (site.x - crumbsFrom.x) * t);
      const z = Math.round(crumbsFrom.z + (site.z - crumbsFrom.z) * t);
      way.pillars.push(FX.pillar({ x, y: groundY(G, x, z), z }, { color, height: 2, life: 0, opacity: 0.4 }));
    }
  }
  return way;
}

// retire beacon + crumbs (first interaction of the beat, and act-end sweep)
function retireWayfinder(ctx) {
  if (!ctx.way) return;
  for (const h of ctx.way.pillars) FX.removeHandle(h);
  ctx.way = null;
}

function interactOnceGated(ctx, { id, x, z, r = 3, prompt, spec, hintKey }) {
  return new Promise((resolve) => {
    ctx.G.interactables.push({
      id, x, z, r, prompt, enabled: true,
      onInteract: gated(ctx, spec, hintKey, (self) => {
        ctx.G.interactables = ctx.G.interactables.filter((o) => o !== self);
        resolve();
      }),
    });
  });
}

// ---------- beats ----------

async function survey(ctx) {
  const { G } = ctx;
  G.hud.setObjective(S.act3.obj_survey);
  const v = SITES.village;
  // re-plant the mound beacon if this beat started without one (odd resume path)
  if (!ctx.way) {
    ctx.way = plantWayfinder(ctx, v, {
      color: SPEC_FX.geologist.color, crumbsFrom: SITES.digCamp, flag: true,
    });
  }
  await interactOnceGated(ctx, {
    id: 'survey', x: v.x, z: v.z, r: 14, prompt: '🔍', spec: 'geologist', hintKey: 'needGeo',
  });
  retireWayfinder(ctx); // found it — the beacon and breadcrumbs stand down
  G.hud.setObjective(null); // surveyed — never show a stale goal through the reveal
  // POWER: strata-scan. A teal ring snaps out at your feet, then two radar
  // pulses wash over the whole mound while the ground vision fades in.
  const pp = G.player.pos;
  FX.ring({ x: pp.x, y: pp.y + 0.05, z: pp.z }, { color: SPEC_FX.geologist.color, radius: 3.2, life: 0.8, width: 0.35 });
  const waveAt = { x: v.x, y: groundY(G, v.x, v.z) - 1, z: v.z };
  FX.pulseWave(waveAt, { color: SPEC_FX.geologist.color, maxRadius: 30, life: 1.7 });
  // ground vision: translucent overlays — green dig zones, pale sterile, blue old river
  const mkOverlay = (x, z, w, d, color, opacity = 0.4) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, groundY(G, x, z) + 0.15, z);
    G.renderer.scene.add(m);
    let t = 0; // vision materialises: opacity 0 → target over ~1s
    G.props.push({ group: m, update(dt) { if (t < 1) { t = Math.min(1, t + dt); m.material.opacity = opacity * t; } } });
    ctx.visionProps.push(m);
  };
  // each green dig zone also gets a soft persistent light-pillar — the
  // geologist's "dig here" beacons, retired one by one as the digs finish
  const digZone = (x, z, w, d) => {
    mkOverlay(x, z, w, d, 0x7fb069);
    ctx.zonePillars.push({ x, z, h: FX.pillar({ x, y: groundY(G, x, z), z }, { color: 0x8fe0a8, height: 7, life: 0 }) });
  };
  digZone(SITES.playerHut.x, SITES.playerHut.z, 7, 7);
  digZone(SITES.granary.x, SITES.granary.z, 5, 5);
  digZone(SITES.grave.x, SITES.grave.z, 4, 4);
  digZone(SITES.shelter.x, SITES.shelter.z + 4, 6, 6);
  mkOverlay(v.x - 9, v.z + 9, 5, 5, 0xc4b394, 0.5); // sterile
  for (let i = 0; i < 8; i++) {
    const z = 20 + i * 12;
    mkOverlay(62 + Math.sin(z * 0.1) * 8, z, 3, 10, 0x3d6d9e, 0.28); // old river ghost
  }
  await wait(420);
  FX.pulseWave(waveAt, { color: SPEC_FX.geologist.color, maxRadius: 30, life: 1.7 }); // second, staggered pulse
  await G.hud.narrator(S.act3.groundVision);
  await G.hud.narrator(S.act3.geoNote);
  await showSourceCard(G, collectCard(G, 'soil', { photo: { emoji: '⛰️' } }));
}

// retire the geologist beacon nearest a finished dig (no-op if none placed,
// e.g. on a resumed session that skipped the survey beat)
function dropZonePillar(ctx, x, z) {
  let best = null, bd = Infinity;
  for (const p of ctx.zonePillars) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  if (best && bd <= 225) {
    FX.removeHandle(best.h);
    ctx.zonePillars.splice(ctx.zonePillars.indexOf(best), 1);
  }
}

// layered dig spot: taps 1..3 deepen the pit; the final tap reveals the find
function digSpot(ctx, { id, x, z, prompt = '⛏️', layers = 3, onFind }) {
  const { G } = ctx;
  let depth = 0;
  return new Promise((resolve) => {
    G.interactables.push({
      id, x, z, r: 2.8, prompt, enabled: true,
      onInteract: gated(ctx, 'archaeologist', 'needArch', async (self) => {
        depth++;
        const top = G.world.topAt(Math.round(x), Math.round(z));
        // carve one layer of a 2x2 pit
        for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          G.world.set(Math.round(x) + dx, top, Math.round(z) + dz, B.AIR);
        }
        // POWER: every trowel-stroke kicks up matte dirt, dust and a warm
        // spark. Emit at RIM height and biased toward the player — strokes at
        // the carved layer's depth sit inside the pit, invisible from a
        // standing first-person view (round-3 review finding).
        const rim = G.world.topAt(Math.round(x) - 1, Math.round(z)) + 1;
        const pit = { x: Math.round(x) + 1, y: Math.max(top + 1, rim) + 0.35, z: Math.round(z) + 1 };
        const pp = G.player.pos;
        const pd = Math.hypot(pp.x - pit.x, pp.z - pit.z) || 1;
        const stroke = {
          x: pit.x + ((pp.x - pit.x) / pd) * 0.9,
          y: pit.y + 0.3,
          z: pit.z + ((pp.z - pit.z) / pd) * 0.9,
        };
        FX.burst(stroke, { color: 0x8a6a42, count: 26, size: 0.22, speed: 4, life: 0.65, gravity: 8, additive: false });
        FX.puff(stroke, { color: 0xb9a77e, count: 10, size: 0.55, life: 0.85 });
        FX.flash(stroke, { color: 0xffd9a0, size: 0.8, life: 0.14 });
        if (depth < layers) {
          G.hud.toast(`${S.act3.digLocked} (${depth}/${layers})`, 2200);
          return;
        }
        self.enabled = false;
        G.interactables = G.interactables.filter((o) => o !== self);
        // the reveal: warm light rises out of the opened earth
        FX.flash(pit, { color: 0xffe2b0, size: 1.5, life: 0.22 });
        FX.floaties(pit, { color: 0xffcf8a, count: 14, size: 0.13, life: 1.9, rise: 1.3 });
        dropZonePillar(ctx, x, z);
        await onFind({ x, z, y: top });
        // the source card is in the satchel — celebrate IN FRONT of the player
        // (the pit itself may be behind them once the card closes)
        const fp = G.player.pos;
        const fd = Math.hypot(pit.x - fp.x, pit.z - fp.z) || 1;
        FX.confetti({
          x: fp.x + ((pit.x - fp.x) / fd) * 1.2,
          y: fp.y + 1.5,
          z: fp.z + ((pit.z - fp.z) / fd) * 1.2,
        }, { count: 26 });
        resolve();
      }),
    });
  });
}

async function digs(ctx) {
  const { G } = ctx;
  G.hud.setObjective(S.act3.obj_dig);

  // field dressing: a survey flag and a spoil heap beside each marked square
  // (offset 3 blocks — clear of the 2x2 pits and their interact radius)
  for (const s of [SITES.playerHut, SITES.granary, SITES.grave, SITES.knap]) {
    const flag = P.makeSurveyFlag(s.x - 3, groundY(G, s.x - 3, s.z + 2), s.z + 2);
    G.renderer.scene.add(flag.group);
    G.props.push(flag);
    const rubble = P.makeRubblePile(s.x + 3, groundY(G, s.x + 3, s.z - 2), s.z - 2);
    G.renderer.scene.add(rubble.group);
    G.props.push(rubble);
  }
  // slow golden dust drifting at the shelter for the lantern scene
  const motes = P.makeDustMotes(
    SITES.shelterWall.x, groundY(G, SITES.shelterWall.x, SITES.shelterWall.z + 2), SITES.shelterWall.z + 2,
  );
  G.renderer.scene.add(motes.group);
  G.props.push(motes);

  const pot = Save.getRecord('pot');

  const potDig = digSpot(ctx, {
    id: 'dig-pot', x: SITES.playerHut.x, z: SITES.playerHut.z,
    onFind: async (at) => {
      const prop = P.makePot(pot, 0.5);
      prop.group.position.set(at.x + 0.5, at.y - 1.5, at.z + 0.5);
      G.renderer.scene.add(prop.group);
      G.props.push(prop);
      await G.hud.narrator(S.act3.potFound);
      // flashback: the player's own mark, full screen for a beat
      if (pot?.data?.mark) await flashback(G, pot.data.mark, S.act3.flashback);
      // card photo: the whole pot the player shaped (filled silhouette from
      // the saved profile) — the bare mark PNG read as a broken spinner
      await showSourceCard(G, collectCard(G, 'pot', { photo: potPortrait(pot) ?? pot?.data?.mark ?? { emoji: '🏺' } }), { layer: '2' });
      // the empty basket slot — the flagship absence
      await showSourceCard(G, collectCard(G, 'basket', { photo: { emoji: '∅' }, emptySlot: true }), { layer: ', ' });
      await G.hud.narrator(S.act3.basketSlotNote);
      // obsidian kept in the same hut
      collectCard(G, 'obsidian', { photo: { emoji: '🖤' } });
    },
  });

  const grainDig = digSpot(ctx, {
    id: 'dig-grain', x: SITES.granary.x, z: SITES.granary.z,
    onFind: async () => {
      await G.hud.narrator(S.act3.cards.grain.tells);
      await showSourceCard(G, collectCard(G, 'grain', { photo: { emoji: '🌾' } }), { layer: '2' });
    },
  });

  const graveDig = digSpot(ctx, {
    id: 'dig-grave', x: SITES.grave.x, z: SITES.grave.z,
    onFind: async (at) => {
      SFX.hush();
      await G.hud.narrator(S.act3.graveFound);
      const beads = P.makeBeads(0.9);
      beads.group.position.set(at.x, at.y - 1.4, at.z + 0.4);
      G.renderer.scene.add(beads.group);
      G.props.push(beads);
      const blade = P.makeStoneTool('blade');
      blade.group.position.set(at.x + 0.7, at.y - 1.4, at.z);
      G.renderer.scene.add(blade.group);
      G.props.push(blade);
      await G.hud.narrator(S.act3.graveNote); // inference, not fact
      await showSourceCard(G, collectCard(G, 'burial', { photo: { emoji: '⚱️' } }), { layer: '3' });
      collectCard(G, 'beads', { photo: { emoji: '📿' } });
    },
  });

  // shelter: arrowheads spot + painting by lantern
  const shelterDig = digSpot(ctx, {
    id: 'dig-shelter', x: SITES.knap.x, z: SITES.knap.z,
    onFind: async () => {
      await showSourceCard(G, collectCard(G, 'arrowheads', { photo: { emoji: '🏹' } }), { layer: '1' });
      collectCard(G, 'hearth', { photo: { emoji: '🪵' } });
    },
  });

  // the reveal chain runs INSIDE onInteract so the interactBusy guard covers
  // its narrators and cards — no stacking with a concurrently-started dig
  const paintingReveal = new Promise((resolve) => {
    const rec = Save.getRecord('painting');
    const mesh = placeDarkPainting(G, rec?.data?.png);
    G.hud.hint(S.act3.lanternHint, 4200);
    G.interactables.push({
      id: 'lantern', x: SITES.shelterWall.x, z: SITES.shelterWall.z + 2, r: 3.4,
      prompt: '🏮', enabled: true,
      onInteract: gated(ctx, 'archaeologist', 'needArch', async (self) => {
        G.interactables = G.interactables.filter((o) => o !== self);
        const lantern = P.makeLantern(SITES.shelterWall.x, groundY(G, SITES.shelterWall.x, SITES.shelterWall.z + 2) - 1, SITES.shelterWall.z + 2);
        G.renderer.scene.add(lantern.group);
        G.props.push(lantern);
        lantern.light.intensity = 8;
        if (mesh) {
          await wait(500);
          mesh.mat.color.setScalar(1); // revealed
        }
        // lantern reveal: warm light rises in front of the wall, and a slow
        // amber ring spreads across the shelter floor
        const w = SITES.shelterWall;
        FX.floaties({ x: w.x, y: 10.1, z: w.z + 0.5 }, { color: 0xffc878, count: 16, size: 0.12, life: 2.4, rise: 0.8 });
        FX.ring(
          { x: w.x, y: groundY(G, w.x, w.z + 2), z: w.z + 2 },
          { color: SPEC_FX.archaeologist.color, radius: 3, life: 1.5, width: 0.35 },
        );
        await G.hud.narrator(S.act3.paintingFound);
        if (rec?.data?.png) await flashback(G, rec.data.png, S.act3.flashback);
        await showSourceCard(G, collectCard(G, 'painting', { photo: rec?.data?.png ?? { emoji: '🖼️' } }));
        resolve();
      }),
    });
  });

  await Promise.all([potDig, grainDig, graveDig, shelterDig, paintingReveal]);
  for (const p of ctx.zonePillars) FX.removeHandle(p.h); // all zones excavated
  ctx.zonePillars.length = 0;
  G.hud.setObjective(null);
  G.hud.setSatchel(Save.data.cards.length, true);
}

function placeDarkPainting(G, png) {
  if (!png) return null;
  const tex = new THREE.TextureLoader().load(png);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  mat.color.setScalar(0.16); // sooted dark until the lantern
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), mat);
  const w = SITES.shelterWall;
  plane.position.set(w.x, 11, w.z + 0.06);
  G.renderer.scene.add(plane);
  const prop = { group: plane, mat };
  G.props.push(prop);
  return prop;
}

function flashback(G, png, caption) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'card-overlay';
    el.innerHTML = `
      <img src="${png}" style="max-width:min(70vw,420px);image-rendering:pixelated;border-radius:8px;box-shadow:0 0 60px rgba(224,164,88,0.4)" alt="">
      <div class="card-text" style="font-size:18px"></div>`;
    el.querySelector('.card-text').textContent = caption;
    G.hud.root.appendChild(el);
    setTimeout(() => { el.remove(); resolve(); }, 2300);
  });
}

async function fossils(ctx) {
  const { G } = ctx;
  G.hud.setObjective(S.act3.obj_fossil);
  const f = SITES.fossilCliff;
  // the cliff is far across the map — beacon it until the first plate is read
  ctx.way = plantWayfinder(ctx, { x: f.x, z: f.z + 4 }, { color: SPEC_FX.palaeontologist.color });
  for (let i = 0; i < 3; i++) {
    const plate = P.makeFossilPlate(f.x - 3 + i * 3, 10, f.z + 0.56, i);
    G.renderer.scene.add(plate.group);
    G.props.push(plate);
  }
  let read = 0;
  await new Promise((resolve) => {
    for (let i = 0; i < 3; i++) {
      G.interactables.push({
        id: `fossil-${i}`, x: f.x - 3 + i * 3, z: f.z + 2, r: 2.8, prompt: '🦴', enabled: true,
        onInteract: gated(ctx, 'palaeontologist', 'needPal', (self) => {
          self.enabled = false;
          read++;
          retireWayfinder(ctx); // arrived — the cliff beacon stands down
          // POWER: deep time drifts off the plate in violet motes + a thin slow ring
          FX.floaties({ x: self.x, y: 9.7, z: f.z + 1 }, { color: SPEC_FX.palaeontologist.color, count: 10, size: 0.12, life: 2, rise: 0.9 });
          const floorAt = { x: self.x, y: groundY(G, self.x, f.z + 2), z: f.z + 2 };
          FX.ring(floorAt, { color: SPEC_FX.palaeontologist.color, radius: 2.2, life: 1.4, width: 0.18 });
          if (read === 1) G.hud.toast(S.act3.fossilNote, 5200);
          if (read >= 3) {
            // the third plate: deep time washes gently over the cliff base
            FX.pulseWave(floorAt, { color: SPEC_FX.palaeontologist.color, maxRadius: 16, life: 2 });
            G.hud.setObjective(null); // goal met — clear before the card shows
            resolve();
          }
        }),
      });
    }
  });
  await showSourceCard(G, collectCard(G, 'fossil', { photo: { emoji: '🐚' } }));
}

async function epigraphist(ctx) {
  const { G } = ctx;
  G.hud.setObjective(S.act3.obj_epi);
  await interactOnceGated(ctx, {
    id: 'epi-mark', x: SITES.playerHut.x, z: SITES.playerHut.z, r: 3.4,
    prompt: '📜', spec: 'epigraphist', hintKey: 'needEpi',
  });
  G.hud.setObjective(null); // mark read — clear before the narrators/card
  // POWER: ink-blue reading flash + rising motes at the hut where the sherd lay
  const hutAt = { x: SITES.playerHut.x, y: groundY(G, SITES.playerHut.x, SITES.playerHut.z), z: SITES.playerHut.z };
  FX.flash(hutAt, { color: 0x9cc4ff, size: 0.9, life: 0.18 });
  FX.floaties(hutAt, { color: SPEC_FX.epigraphist.color, count: 12, size: 0.12, life: 1.8, rise: 1.1 });
  await G.hud.narrator(S.act3.epiIntro);
  const pot = Save.getRecord('pot');
  if (pot?.data?.mark) await flashback(G, pot.data.mark, S.act3.cards.potsherdMark.title);
  await G.hud.narrator(S.act3.epiNote);
  // The narrator has been a person all along, and this is where she says so.
  // One line, and every "Note" box back to act 1 retroactively stops being
  // textbook voice and becomes her field notes. It sits AFTER epiNote so the
  // reveal lands on the specialist who has just finished reading the player's
  // own mark, which is the only place in the game where it is earned.
  await G.hud.narrator(S.act3.epiReveal);
  await showSourceCard(G, collectCard(G, 'potsherdMark', { photo: pot?.data?.mark ?? { emoji: '📜' } }));
}

// retire the act-start ambient villagers (idempotent; also the act-end sweep)
function disposeAmbients(ctx) {
  if (!ctx.ambients) return;
  for (const a of ctx.ambients) {
    a.dispose();
    const i = ctx.G.npcs.indexOf(a);
    if (i >= 0) ctx.G.npcs.splice(i, 1);
  }
  ctx.ambients = null;
}

// Same job as disposeAmbients, but for the one call that happens while the
// player may be looking. Deleting two villagers mid-frame was a visible pop;
// walking them out of the village first reads as two people stepping aside,
// which is exactly what the beat needs them to do. Fire and forget: the beat
// must not wait on a stroll, and disposeAmbients stays the hard sweep for act
// teardown and resumed sessions.
function retireAmbients(ctx) {
  if (!ctx.ambients) return;
  const leaving = ctx.ambients;
  ctx.ambients = null; // claimed: a later sweep is a no-op, never a double free
  const m = SITES.modernVillage;
  for (const a of leaving) {
    // Straight out along their own bearing from the village centre. `home` has
    // to move with the target: idle wander pulls toward home, and a blocked
    // goTo gives itself up after three failed detours (see navTick), at which
    // point the old home would have walked them right back into the beat they
    // are supposed to be leaving. This is the "systems yield to scripts" rule,
    // applied to the wander system rather than to ambient work.
    const dx = a.pos.x - m.x, dz = a.pos.z - m.z;
    const d = Math.hypot(dx, dz) || 1;
    const tx = m.x + (dx / d) * 16, tz = m.z + (dz / d) * 16;
    a.home = { x: tx, z: tz };
    a.goTo(tx, tz);
  }
  // Retire them once they are genuinely out of SHOT, not on a fixed timer and
  // not on distance alone. The village is dense enough that a walk-off can be
  // blocked, so what actually matters is whether the player can see it happen:
  // gone from the frustum, or far enough away to be a speck. The cap
  // guarantees they always go even if the player stands and stares.
  const cam = ctx.G.renderer.camera;
  const frustum = new THREE.Frustum();
  const mat = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const clear = () => {
    for (const a of leaving) {
      a.dispose(); // idempotent: detaches from the scene, caches are shared
      const i = ctx.G.npcs.indexOf(a);
      if (i >= 0) ctx.G.npcs.splice(i, 1);
    }
  };
  let waited = 0;
  const poll = () => {
    waited += 700;
    cam.updateMatrixWorld();
    frustum.setFromProjectionMatrix(mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const unseen = leaving.every((a) => {
      at.set(a.pos.x, a.pos.y + 0.9, a.pos.z); // chest height, not the feet
      return !frustum.containsPoint(at) ||
        Math.hypot(a.pos.x - cam.position.x, a.pos.z - cam.position.z) > 26;
    });
    if (unseen || waited >= 14000) clear();
    else setTimeout(poll, 700);
  };
  setTimeout(poll, 700);
}

async function interviews(ctx) {
  const { G } = ctx;
  G.hud.setObjective(S.act3.obj_talk);
  // hand the stage to the real interviewees — the ambient wanderers step off
  // so they can never crowd a talk interactable or steal a listening ring
  retireAmbients(ctx);
  const m = SITES.modernVillage;
  // the present-day village is another long walk — beacon until the first chat
  ctx.way = plantWayfinder(ctx, m, { color: SPEC_FX.anthropologist.color });
  const people = [
    {
      key: 'gm', name: S.act3.villagers.grandmother, x: m.x - 3, z: m.z + 1, wrap: 0x764a62,
      lines: [S.act3.talk_gm1, S.act3.talk_gm2], cardKey: 'oralG',
    },
    {
      key: 'farmer', name: S.act3.villagers.farmer, x: m.x + 3, z: m.z + 1, wrap: 0x557080,
      lines: [S.act3.talk_farmer1, S.act3.talk_farmer_probe], cardKey: 'oralF',
    },
    {
      key: 'teacher', name: S.act3.villagers.teacher, x: m.x, z: m.z + 5, wrap: 0x3d5a66,
      lines: [S.act3.talk_teacher1, S.act3.talk_teacher2], cardKey: 'oralT',
    },
    {
      key: 'third', name: S.act3.villagers.farmer.replace('Raju', 'Sita'), x: m.x - 1, z: m.z - 3, wrap: 0x767d4a,
      lines: [S.act3.talk_third1], cardKey: null,
    },
  ];
  const done = [];
  for (const p of people) {
    const npc = new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
      x: p.x, z: p.z, world: G.world, wander: 2, wrap: p.wrap, name: p.key, elder: p.key === 'gm',
    });
    G.npcs.push(npc);
    done.push(new Promise((resolve) => {
      G.interactables.push({
        id: `talk-${p.key}`, x: p.x, z: p.z, r: 3, prompt: '💬', enabled: true,
        onInteract: gated(ctx, 'anthropologist', 'needAnth', async (self) => {
          self.enabled = false;
          retireWayfinder(ctx); // arrived — the village beacon stands down
          npc.frozen = true;
          npc.faceToward(G.player.pos.x, G.player.pos.z);
          // POWER: a soft rose listening-ring opens at the speaker's feet
          FX.ring(
            { x: npc.pos.x, y: npc.pos.y + 0.05, z: npc.pos.z },
            { color: SPEC_FX.anthropologist.color, radius: 1.8, life: 0.8, width: 0.35 },
          );
          for (const line of p.lines) await talkLine(G, p.name, line);
          npc.frozen = false;
          // memory gathered: rose motes rise above the storyteller
          FX.floaties(
            { x: npc.pos.x, y: npc.pos.y + 1.2, z: npc.pos.z },
            { color: 0xf0a8b8, count: 10, size: 0.11, life: 1.6, rise: 0.9 },
          );
          if (p.cardKey) collectCard(G, p.cardKey, { photo: { emoji: '🗣️' } });
          resolve();
        }),
      });
    }));
  }
  await Promise.all(done);
  G.hud.setObjective(null);
  G.hud.setSatchel(Save.data.cards.length, true);
}

function talkLine(G, speaker, line) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'talk-box';
    el.innerHTML = `<div class="speaker"></div><div class="line"></div>
      <div class="opts"><button class="btn small">${S.ui.continue}</button></div>`;
    el.querySelector('.speaker').textContent = speaker;
    el.querySelector('.line').textContent = line;
    G.hud.root.appendChild(el);
    el.querySelector('button').addEventListener('click', () => {
      el.remove();
      G.input?.clearEdges?.();
      resolve();
    });
  });
}

async function claims(ctx) {
  const { G } = ctx;
  await G.hud.narrator(S.act3.sourceDef); // 4.24
  await claimBoard(G);
  await G.hud.narrator(S.act3.judgeNote); // 4.27/4.28 verbatim-adjacent
  await G.hud.narrator(S.act3.detectiveNote);
}

async function lab(ctx) {
  await labTray(ctx.G);
}

async function finale(ctx) {
  const { G } = ctx;
  await siteReport(G);
  // the one big celebration: staggered confetti bursts around the player
  const pp = G.player.pos;
  FX.confetti({ x: pp.x, y: pp.y + 1.6, z: pp.z }, { count: 30, speed: 4 });
  await wait(320);
  FX.confetti({ x: pp.x + 1.5, y: pp.y + 1.8, z: pp.z + 1 }, { count: 24 });
  await wait(320);
  FX.confetti({ x: pp.x - 1.5, y: pp.y + 1.8, z: pp.z - 1 }, { count: 24 });
  await G.hud.card([S.act3.reportClosing, S.act3.reportClosing2]);
  await G.hud.fadeOut(1000);
  // end screen
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <h1></h1><h2></h2>
    <button class="btn" id="end-restart"></button>
    <div class="studio"></div>`;
  el.querySelector('h1').textContent = S.title;
  el.querySelector('h2').textContent = S.act3.reportClosing;
  el.querySelector('#end-restart').textContent = S.startNew;
  el.querySelector('.studio').textContent = S.studio;
  G.hud.root.appendChild(el);
  await G.hud.fadeIn(600);
  el.querySelector('#end-restart').addEventListener('click', async () => {
    const pick = await G.hud.choice(S.newGameConfirm, [S.newGameNo, S.newGameYes]);
    if (pick === 1) { Save.reset(); location.reload(); }
  });
}
