// ACT 2 — PASS. The full SKY mode: time dial, era markers, the erosion
// window (P1), the no-year-zero trick (P2), the earned gap formula (P3),
// step locks (P4), calendar faces (P5), arrival at today (P6), and the
// deep-time prologue (Fig 4.1).
import * as THREE from '../../vendor/three.module.js';
import { YEARS, UNITS, WORLD, QUALITY, gapYears, fmtYear, fmtNum } from '../constants.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { buildStage, applyBandDrift, SITES } from '../world/states.js';
import { Dial, yearToT } from '../sky/dial.js';
import { ErosionPanel } from '../sky/erosion.js';
import { tween } from '../sky/interstitial.js';
import { countdownChallenge, numberPrompt } from '../ui/minigames.js';
import { runBeats } from './beats.js';
import { wait } from '../ui/hud.js';
import * as P from '../world/props.js';
import { FX } from '../fx/fx.js';

function stageFor(year) {
  if (year < YEARS.ICE_AGE_END_BCE) return 0;
  if (year < YEARS.SETTLEMENTS_BCE) return 1;
  if (year < YEARS.POTTERY_BCE) return 2;
  if (year < -4500) return 3;
  if (year < -3000) return 4;
  if (year < -1500) return 5;
  if (year < 1500) return 6;
  return 7;
}

export async function runAct2(G) {
  const { clearStage } = await import('../main.js');
  clearStage(G);
  FX.clear(); // hard cut from act 1 — no lingering ground fx under the sky camera

  G.mode = 'sky';
  G.input.setEnabled(false);
  G.hud.setObjective(null);
  G.hud.fadeIn(600); // act 1 ends faded out — the sky must be visible

  await G.hud.card([S.act2.title, S.act2.card]);

  // overhead camera above the village site
  const cam = G.renderer.camera;
  const centre = SITES.village;
  cam.position.set(centre.x, 74, centre.z + 26);
  cam.lookAt(centre.x, 6, centre.z - 6);

  const ctx = {
    G, dial: null, stage: -1, pendingStage: null, eraCard: null,
    year: YEARS.SCENE_D_YEAR, band: 0, pendingBand: null,
    skirt: null, skirtMat: null,
  };

  // markers (verified Fig 4.3 pairings — spec addendum §2)
  const markers = [
    { year: YEARS.ROCK_ART_BCE, icon: '🖐️', label: S.act2.eras.rockArt },
    { year: YEARS.ICE_AGE_END_BCE, icon: '🧊', label: S.act2.eras.iceAgeEnd, note: S.act2.eraNote_iceAge },
    { year: YEARS.SETTLEMENTS_BCE, icon: '🌾', label: S.act2.eras.settlements, note: yearsAgo(YEARS.SETTLEMENTS_BCE) },
    { year: YEARS.POTTERY_BCE, icon: '🏺', label: S.act2.eras.pottery },
    { year: YEARS.MESOPOTAMIA_BCE, icon: '🏙️', label: S.act2.eras.mesopotamia },
    { year: YEARS.COPPER_BCE, icon: '🔶', label: S.act2.eras.copper },
    { year: YEARS.INDUS_SARASVATI_BCE, icon: '🐂', label: S.act2.eras.indus },
    { year: YEARS.SCENE_D_YEAR, icon: '👣', label: S.act2.youMarker },
    { year: YEARS.BUDDHA_BCE, icon: '☸️', label: S.act2.eras.buddha, note: S.act2.eraNote_era },
    { year: YEARS.ASHOKA_BCE, icon: '🦁', label: S.act2.eras.ashoka },
    { year: YEARS.JESUS_CE, icon: '✶', label: S.act2.eras.jesus },
    { year: YEARS.TODAY_CE, icon: '📍', label: S.act2.eras.today },
  ];

  const dial = new Dial(G.hud.root, {
    minYear: YEARS.ROCK_ART_BCE - 4000,
    maxYear: YEARS.TODAY_CE,
    year: YEARS.SCENE_D_YEAR,
    yearsPerPx: 4,
    markers,
    onYear: (y) => onYear(ctx, y),
    onMarker: (m) => showEraCard(ctx, m),
  });
  ctx.dial = dial;
  ctx.year = dial.year;
  ctx.band = bandFor(dial.year);
  for (const m of dial.markers) m.suppressed = true;

  // rebuild world stages at a throttle while scrubbing; BETWEEN stages, seeded
  // per-band flora drift keeps the centuries visibly moving (defect fix: the
  // valley used to be pixel-identical across multi-millennium scrubs)
  // An era flip rewrites the whole valley: buildBase() wipes the voxel array
  // and regenerates every column, so there is no smaller set of chunks to
  // remesh. What CAN change is when the work happens and how much of it lands
  // on one frame. Two guards, both aimed at the phone:
  //
  //  SETTLE_MS — the dial is a drag, and a drag that sweeps four eras used to
  //    fire four full rebuilds, one per frame it crossed a boundary. Wait for
  //    the year to hold still, then build once.
  //  DRAIN     — remesh a few chunks per frame instead of all 64 in one call.
  //    Measured on a fast desktop a full remesh is ~34 ms, so on a budget
  //    Android it is a few hundred; spread out, no single frame carries it.
  //    This is the same gradual path band drift already uses.
  const SETTLE_MS = 120;
  const DRAIN = QUALITY.drainBudget;
  let firstBuild = true;
  let lastEraWave = 0;
  let lastBandSwap = 0;
  let askedStage = null, askedAt = 0;

  G.tick = () => {
    const now = performance.now();

    // finish the rebuild in flight before considering another
    if (ctx.rebuilding) {
      if (G.mesher.flush(DRAIN) === 0) {
        ctx.rebuilding = false;
        refreshSkirt(ctx);
      }
      return;
    }

    if (ctx.pendingStage !== null) {
      const s = ctx.pendingStage;
      if (s !== askedStage) { askedStage = s; askedAt = now; }
      if (!firstBuild && now - askedAt < SETTLE_MS) return; // still scrubbing
      ctx.pendingStage = null;
      askedStage = null;
      ctx.rebuilding = true;
      buildStage(G.world, s, true); // true: strata-dress the diorama's cut edges
      ctx.stage = s;
      // re-dress the fresh keyframe with the current band's drift so the world
      // doesn't snap back to pristine on every stage flip
      ctx.band = bandFor(ctx.year);
      ctx.pendingBand = null;
      applyBandDrift(G.world, ctx.band, s, moundAge(ctx));

      // Sky and fog switch immediately, so the era reads as changed on the
      // frame you cross the boundary even though the terrain is still catching
      // up over the next few frames.
      G.renderer.setSky(s === 0 ? 0xbcd3e6 : 0x9ec8e8, s === 0 ? 0xd4e2ec : 0xcfe0ee);
      // sky-mode fog: setSky just rebuilt scene.fog for a GROUND camera; from
      // 70+ units up those defaults wash the whole far half of the valley to
      // milky beige. Pull the fog band out so the diorama stays crisp and only
      // the extreme corners soften.
      const fog = G.renderer.scene.fog;
      if (fog) { fog.near = 95; fog.far = 175; }

      G.world.markAllDirty();
      if (firstBuild) {
        // the opening build sits behind the intro card, so take it in one go
        // rather than letting the act open on a half-built valley
        G.mesher.flush(Infinity);
        ctx.rebuilding = false;
        refreshSkirt(ctx);
      } else {
        if (G.mesher.flush(DRAIN) === 0) { ctx.rebuilding = false; refreshSkirt(ctx); }
        // time-sweep over the village when the era flips (throttled; none on
        // the initial build so the intro card isn't upstaged)
        if (now - lastEraWave > 600) { lastEraWave = now; eraSweep(G, 30); }
      }
      firstBuild = false;
    } else if (ctx.pendingBand !== null && ctx.pendingBand !== ctx.band &&
               now - lastBandSwap > 250) {
      // band drift: at most one swap per 250ms; a fast scrub jumps straight
      // to the newest band (intermediates are skipped, never queued)
      lastBandSwap = now;
      ctx.band = ctx.pendingBand;
      ctx.pendingBand = null;
      applyBandDrift(G.world, ctx.band, ctx.stage, moundAge(ctx));
      if (!firstBuild && now - lastEraWave > 600) {
        lastEraWave = now;
        eraSweep(G, 20);
      }
    }
  };
  onYear(ctx, dial.year); // initial world

  const phases = [
    { id: 'a2.p1', run: () => p1_erosion(ctx) },
    { id: 'a2.deeptime', run: () => deepTime(ctx) },
    { id: 'a2.scrub', run: () => freeScrub(ctx) },
    { id: 'a2.p2', run: () => p2_zero(ctx) },
    { id: 'a2.p3', run: () => p3_gap(ctx) },
    { id: 'a2.p4', run: () => p4_steps(ctx) },
    { id: 'a2.p5', run: () => p5_faces(ctx) },
    { id: 'a2.p6', run: () => p6_arrival(ctx) },
  ];
  const resume = Save.data.act === 2 && Save.data.beat?.startsWith('a2.') ? Save.data.beat : null;
  // resuming past the free scrub must not leave era markers muted forever
  const preScrub = ['a2.p1', 'a2.deeptime', 'a2.scrub'];
  if (resume && !preScrub.includes(resume)) {
    for (const m of dial.markers) m.suppressed = false;
  }
  await runBeats(2, phases, resume);

  dial.dispose();
  disposeSkirt(ctx);
  G.tick = null;
}

// ---------- year bands (visible time-morph between era stages) ----------
// The dial's timeline units (t) are contiguous across the missing year zero,
// so bands are cut in t-space. Crossing a band boundary churns seeded decor
// via applyBandDrift — one swap per 250ms max, intermediates skipped.
const BAND_YEARS = 400;
function bandFor(y) { return Math.floor(yearToT(y) / BAND_YEARS); }

// post-abandonment mound greening 0..1 (bare earth → grassed dome). The
// grassed-mound stage begins where stageFor() flips to 6; spans ~3 millennia.
const MOUND_T0 = -1500, MOUND_GREEN_SPAN = 3000;
function moundAge(ctx) {
  return Math.max(0, Math.min(1, (yearToT(ctx.year) - MOUND_T0) / MOUND_GREEN_SPAN));
}

// The era sweep. The sky camera sits ~70 units up and the erosion panel covers
// the village during P1, so a ground-hugging dome at low alpha was invisible
// (review: "pulse wave never observed"). Fix: lift the emitter, widen the
// radius past the panel's screen footprint, and pair the volume dome with a
// flat expanding ring — the ring is the crisp read from directly overhead.
function eraSweep(G, radius, color = 0xbfe4ff) {
  const p = villageTop(G, 3);
  // lives ~2s: at 1.1s the sweep was gone before a scrubbing player's eye
  // ever left the dial (review: "era pulse never observed")
  FX.pulseWave(p, { color, maxRadius: radius, life: 2.1 });
  FX.ring({ x: p.x, y: p.y - 1.5, z: p.z }, { color, radius: radius * 0.95, life: 1.8, width: 0.4 });
}

// ---------- fx helpers (sky camera sits ~70 units up: mesh emitters — rings,
// waves, flashes — read well from overhead; particle sizes are bumped up) ----
function villageTop(G, lift = 0.4) {
  const v = SITES.village;
  return { x: v.x, y: G.world.topAt(v.x, v.z) + lift, z: v.z };
}

// subtle "new objective" tell — a quiet ring over the village mound
function beatRing(G, opts = {}) {
  FX.ring(villageTop(G), { color: 0xcfe0ee, radius: 3.2, life: 0.8, width: 0.12, ...opts });
}

// ---------- diorama skirt (defect fix: raw chunk cliffs at the world edge) --
// A vertex-coloured curtain hugging the world border: its top edge follows
// the terrain rim column by column, its base flares outward and down, so from
// the sky camera the valley sits on a dark-parchment display-base bevel
// instead of ending in sheer white chunk walls. One mesh, one draw call, no
// lighting. Rebuilt (cheap, ~1k verts) after each stage rebuild because the
// rim profile changes with the ice sheet; removed on act exit.
const SKIRT = { BEVEL: 12, BOTTOM: -7, TOP_COL: 0x6f5c40, BOTTOM_COL: 0x33291b };

function makeSkirtGeometry(world) {
  const SX = WORLD.SIZE_X, SZ = WORLD.SIZE_Z;
  const cTop = new THREE.Color(SKIRT.TOP_COL), cBot = new THREE.Color(SKIRT.BOTTOM_COL);
  const pos = [], col = [], idx = [];
  // px/pz: world position of grid line j along the side; cx/cz: the border
  // column at index k (for rim-height sampling); ox/oz: outward normal
  const sides = [
    { n: SX, ox: 0, oz: -1, px: (j) => j, pz: () => 0, cx: (k) => k, cz: () => 0 },
    { n: SX, ox: 0, oz: 1, px: (j) => j, pz: () => SZ, cx: (k) => k, cz: () => SZ - 1 },
    { n: SZ, ox: -1, oz: 0, px: () => 0, pz: (j) => j, cx: () => 0, cz: (k) => k },
    { n: SZ, ox: 1, oz: 0, px: () => SX, pz: (j) => j, cx: () => SX - 1, cz: (k) => k },
  ];
  const starts = [];
  for (const s of sides) {
    starts.push(pos.length / 3);
    for (let j = 0; j <= s.n; j++) {
      // rim height at the grid line: cover the taller of the two columns
      // meeting there so no wall face peeks over the skirt
      const ka = Math.max(0, j - 1), kb = Math.min(s.n - 1, j);
      const h = Math.max(world.topAt(s.cx(ka), s.cz(ka)), world.topAt(s.cx(kb), s.cz(kb))) + 1;
      const x = s.px(j) + s.ox * 0.03, z = s.pz(j) + s.oz * 0.03;
      pos.push(x, h, z); // top vertex hugs the rim
      col.push(cTop.r, cTop.g, cTop.b);
      pos.push(x + s.ox * SKIRT.BEVEL, SKIRT.BOTTOM, z + s.oz * SKIRT.BEVEL); // flared base
      col.push(cBot.r, cBot.g, cBot.b);
    }
    const base = starts[starts.length - 1];
    for (let j = 0; j < s.n; j++) {
      const a = base + j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  // corner gussets: close the wedge between adjacent sides' flared bases
  const corner = (sa, ja, sb, jb) => {
    const a = starts[sa] + ja * 2, b = starts[sb] + jb * 2;
    idx.push(a, a + 1, b + 1, a, b + 1, b);
  };
  corner(0, 0, 2, 0); // NW
  corner(0, SX, 3, 0); // NE
  corner(1, 0, 2, SZ); // SW
  corner(1, SX, 3, SZ); // SE
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function refreshSkirt(ctx) {
  const { G } = ctx;
  if (ctx.skirt) {
    ctx.skirt.geometry.dispose();
    ctx.skirt.geometry = makeSkirtGeometry(G.world);
    return;
  }
  // fog:false — the skirt is the display-case bevel; fogged it washed to the
  // same pale beige as the raw chunk walls it exists to replace
  ctx.skirtMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  ctx.skirt = new THREE.Mesh(makeSkirtGeometry(G.world), ctx.skirtMat);
  ctx.skirt.frustumCulled = false;
  G.renderer.scene.add(ctx.skirt);
}

function disposeSkirt(ctx) {
  if (!ctx.skirt) return;
  ctx.G.renderer.scene.remove(ctx.skirt);
  ctx.skirt.geometry.dispose();
  ctx.skirtMat.dispose();
  ctx.skirt = null;
  ctx.skirtMat = null;
}

function yearsAgo(bceYear) {
  const ya = Math.round(gapYears(bceYear, YEARS.TODAY_CE) / 1000) * 1000;
  return S.act2.yearsAgoNote(fmtNum(ya), fmtYear(bceYear));
}

function onYear(ctx, year) {
  ctx.year = year;
  const s = stageFor(year);
  if (s !== ctx.stage) ctx.pendingStage = s;
  ctx.pendingBand = bandFor(year);
  if (ctx.erosion) {
    const elapsed = Math.max(0, yearSpan(YEARS.SCENE_D_YEAR, year));
    ctx.erosion.draw(elapsed);
  }
}

// span in years across the missing year zero
function yearSpan(a, b) {
  if (a < 0 && b >= 1) return -a + b - 1;
  return b - a;
}

function showEraCard(ctx, m) {
  ctx.eraCard?.remove();
  const el = document.createElement('div');
  el.className = 'era-card';
  el.innerHTML = `<div class="era-date">${fmtYear(m.year)}</div><div class="era-label"></div>${m.note ? '<div class="era-note" style="font-size:12.5px;color:var(--ink-dim);margin-top:6px"></div>' : ''}`;
  el.querySelector('.era-label').textContent = m.label;
  if (m.note) el.querySelector('.era-note').textContent = m.note;
  ctx.G.hud.root.appendChild(el);
  ctx.eraCard = el;
  clearTimeout(ctx.eraTimer);
  ctx.eraTimer = setTimeout(() => { el.remove(); if (ctx.eraCard === el) ctx.eraCard = null; }, 3400);
}

// ---------- P1 — the erosion window ----------
async function p1_erosion(ctx) {
  const { G, dial } = ctx;
  await G.hud.card([S.act2.p1_card]);
  beatRing(G);
  dial.setZoom(3);
  dial.setYear(YEARS.SCENE_D_YEAR, false);
  ctx.erosion = new ErosionPanel(G.hud.root, {
    potRecord: Save.getRecord('pot'),
    burialRecord: Save.getRecord('burial'),
  });
  ctx.erosion.setCaption(S.act2.p1_intro);
  G.hud.hint(S.act2.dialHint, 5000);

  // wait until scrubbed ~5,500 years forward (basket long gone)
  await waitFor(() => yearSpan(YEARS.SCENE_D_YEAR, dial.year) > 5200);
  // the basket crumbles to dust — muted matte puff, kept serious (no sparkle)
  FX.puff(villageTop(G, 1), { color: 0xcfc4a8, count: 14, size: 0.9, life: 1.3, alpha: 0.35 });
  await G.hud.narrator(S.act2.p1_basketGone);
  if (Save.getRecord('burial')) await G.hud.narrator(S.act2.p1_grave);
  await G.hud.narrator(S.act2.p1_note); // 4.26 — flagship line
  ctx.erosion.dispose();
  ctx.erosion = null;
}

// ---------- deep-time prologue (Fig 4.1) ----------
async function deepTime(ctx) {
  const { G } = ctx;
  await G.hud.card([S.act2.deepTime_card]);
  await showDeepTimeStrip(G);
}

function showDeepTimeStrip(G) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'deeptime';
    el.innerHTML = `
      <canvas width="900" height="240"></canvas>
      <div style="font-family:var(--font);font-size:14.5px;max-width:640px;text-align:center;line-height:1.55"></div>
      <button class="btn primary">${S.ui.continue}</button>`;
    el.querySelector('div').textContent = S.act2.deepTime_note;
    G.hud.root.appendChild(el);
    drawDeepTime(el.querySelector('canvas'));
    el.querySelector('button').addEventListener('click', () => { el.remove(); resolve(); });
  });
}

function drawDeepTime(cv) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  c.fillStyle = '#0a0806';
  c.fillRect(0, 0, W, H);
  // log scale: 4.54 bya … now. x = position of log10(years ago)
  const L = (ya) => {
    const lo = Math.log10(1000), hi = Math.log10(4.54e9);
    return W - 40 - ((Math.log10(Math.max(1000, ya)) - lo) / (hi - lo)) * (W - 80);
  };
  const events = [
    [4.54e9, 'Earth', '#4d7dd8'],
    [2.33e9, 'Atmospheric oxygen', '#4da8d8'],
    [1.5e9, 'First cells · bacteria', '#4dd8c4'],
    [7e8, 'Sponges · corals', '#66d88a'],
    [5e8, 'Fish · vertebrates', '#8ad866'],
    [3e8, 'Insects · amphibians', '#b8d84d'],
    [2e8, 'Reptiles · dinosaurs', '#d8c44d'],
    [1e8, 'Birds · mammals · flowers', '#d8964d'],
    [YEARS.PRIMATES_YA, 'Primates', '#d8724d'],
    [YEARS.FIRE_YA, 'Fire', '#e0533a'],
    [YEARS.HOMO_SAPIENS_YA, 'HOMO SAPIENS', '#ff4d2e'],
    [YEARS.WRITING_YA, 'Writing', '#ffd28a'],
  ];
  // bar
  const barY = H / 2;
  const grad = c.createLinearGradient(40, 0, W - 40, 0);
  grad.addColorStop(0, '#20304d');
  grad.addColorStop(0.8, '#41597d');
  grad.addColorStop(1, '#ffd28a');
  c.fillStyle = grad;
  c.fillRect(40, barY - 16, W - 80, 32);
  // human sliver highlight
  const hx = L(YEARS.HOMO_SAPIENS_YA);
  c.fillStyle = '#ff4d2e';
  c.fillRect(hx, barY - 22, W - 40 - hx, 44);
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.font = '11px sans-serif';
  c.textAlign = 'center';
  events.forEach(([ya, label, col], i) => {
    const x = L(ya);
    const up = i % 2 === 0;
    c.strokeStyle = col;
    c.beginPath();
    c.moveTo(x, barY + (up ? -16 : 16));
    c.lineTo(x, barY + (up ? -44 - (i % 4) * 14 : 44 + (i % 4) * 14));
    c.stroke();
    c.fillStyle = col;
    c.fillText(label, Math.max(60, Math.min(W - 60, x)), barY + (up ? -50 - (i % 4) * 14 : 58 + (i % 4) * 14));
  });
}

// ---------- free scrub with era markers ----------
async function freeScrub(ctx) {
  const { G, dial } = ctx;
  for (const m of dial.markers) m.suppressed = false;
  dial.setZoom(55);
  dial.setYear(YEARS.SCENE_D_YEAR, false);
  beatRing(G); // new objective: scrub to today
  G.hud.setObjective(S.act2.dialHint);
  await waitFor(() => dial.year >= YEARS.TODAY_CE - 200);
  G.hud.setObjective(null);
}

// ---------- P2 — CE/BCE and the missing zero ----------
async function p2_zero(ctx) {
  const { G, dial } = ctx;
  await G.hud.card([S.act2.p2_card]);
  beatRing(G);
  await dial.animateTo(-30, 900);
  dial.setZoom(0.45);
  await G.hud.narrator(S.act2.p2_ce);
  await G.hud.narrator(S.act2.p2_bce);
  const res = await countdownChallenge(G.hud.root, { text: S.act2.p2_challenge, seconds: 30 });
  void res;
  const { SFX } = await import('../audio.js');
  SFX.trick();
  // the missing-year-zero reveal — one bright flash + golden ring, no confetti
  FX.flash(villageTop(G, 3), { color: 0xfff0c8, size: 3, life: 0.22 });
  FX.ring(villageTop(G), { color: 0xffe9a8, radius: 5, life: 0.9 });
  await G.hud.card([{ text: S.act2.p2_trick, big: true }]);
  await G.hud.narrator(S.act2.p2_trickNote);
}

// ---------- P3 — the gap formula, earned ----------
async function p3_gap(ctx) {
  const { G, dial } = ctx;
  await G.hud.card([S.act2.p3_card]);
  beatRing(G);
  dial.setZoom(6);
  await dial.animateTo(YEARS.BUDDHA_BCE, 900);
  const challenge = countdownChallenge(G.hud.root, {
    text: S.act2.p3_challenge(fmtYear(YEARS.BUDDHA_BCE), fmtYear(YEARS.BOOK_EXAMPLE_CE)),
    seconds: 30,
    giveUpLabel: S.ui.skip,
  });
  await challenge;
  await G.hud.narrator(S.act2.p3_slow);
  await G.hud.card([S.act2.p3_formula, S.act2.p3_bookExample]); // verbatim 4.15
  // instantly-rewarding practice reps
  const pairs = [
    [YEARS.ASHOKA_BCE, YEARS.TODAY_CE],
    [YEARS.SETTLEMENTS_BCE, YEARS.TODAY_CE],
  ];
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const expect = gapYears(a, b);
    const got = await numberPrompt(G.hud.root, { title: S.act2.p3_practice(fmtYear(a), fmtYear(b)) });
    if (got === expect) {
      // earned it — celebratory sprinkle over the village (sized for the sky cam)
      FX.confetti(villageTop(G, 6), { count: 24, size: 0.5, life: 1.4, speed: 3 });
      await G.hud.narrator(S.act2.p3_correct);
      break;
    }
    await G.hud.narrator(S.act2.p3_wrong(fmtNum(expect)));
  }
}

// ---------- P4 — step locks ----------
async function p4_steps(ctx) {
  const { G, dial } = ctx;
  await G.hud.card([S.act2.p4_card]);
  beatRing(G);
  dial.setZoom(1.2);
  await dial.animateTo(YEARS.JESUS_CE, 800);

  // decade
  dial.lock(UNITS.DECADE, { label: 'DECADE' });
  await G.hud.narrator(S.act2.p4_decade);
  await waitFor(() => dial.stepCount >= 3);

  // century (cricket beat — generic batsman)
  await G.hud.card([{ text: '🏏' }, S.act2.p4_century_cricket]);
  dial.setZoom(3.2);
  dial.setYear(YEARS.JESUS_CE, false);
  dial.lock(UNITS.CENTURY, { label: 'CENTURY' });
  G.hud.setObjective(S.act2.p4_centuryTask);
  await waitFor(() => dial.year <= YEARS.ASHOKA_BCE);
  G.hud.setObjective(null);
  beatRing(G, { color: 0xffd28a, radius: 4 }); // century objective done — golden
  await G.hud.narrator(S.act2.p4_centuryNote);

  // millennium
  dial.setZoom(12);
  dial.lock(UNITS.MILLENNIUM, { label: 'MILLENNIUM' });
  await waitFor(() => dial.stepCount >= 5);
  await G.hud.narrator(S.act2.p4_millennium);
  dial.lock(null);

  // order without dates: two unlabeled flags
  const { yearToT } = await import('../sky/dial.js');
  for (const f of [{ year: -3300, icon: '🚩' }, { year: -1300, icon: '🎏' }]) {
    dial.markers.push({ ...f, label: '?', suppressed: true, t: yearToT(f.year), fired: false });
  }
  dial.setZoom(20);
  await dial.animateTo(-2300, 900);
  const pick = await G.hud.choice(S.act2.p4_orderTask, ['🚩', '🎏']);
  if (pick === 0) {
    beatRing(G, { color: 0xaef0c8, radius: 3.6 }); // right first try
    await G.hud.narrator(S.act2.p4_orderNote);
  } else {
    await G.hud.narrator(S.act3.orderHintWrong ?? S.act2.p4_orderNote);
    await G.hud.narrator(S.act2.p4_orderNote);
  }
  dial.markers = dial.markers.filter((m) => m.icon !== '🚩' && m.icon !== '🎏');
  dial.render();
}

// ---------- P5 — calendar faces ----------
async function p5_faces(ctx) {
  const { G, dial } = ctx;
  await G.hud.card([S.act2.p5_card]);
  beatRing(G);
  await G.hud.narrator(S.act2.p5_gregorian); // 4.10 incl. the 400 rule
  dial.setFace('indian');
  // warm sweep as the calendar face changes — same world, another way to count
  eraSweep(G, 22, 0xffd28a);
  await G.hud.narrator(S.act2.p5_indian); // 4.22, 4.23 pañchānga, sun & moon
  await G.hud.narrator(S.act2.p5_worldSame);
  dial.setFace('gregorian');
}

// ---------- P6 — arrival at today ----------
async function p6_arrival(ctx) {
  const { G, dial } = ctx;
  dial.setZoom(30);
  await dial.animateTo(YEARS.TODAY_CE, 2200);
  await G.hud.card([S.act2.p6_card]);
  await G.hud.narrator(S.act2.p6_note);

  // camera descends toward the mound; survey flag plants
  const cam = G.renderer.camera;
  const v = SITES.village;
  const from = cam.position.clone();
  const fromQ = cam.quaternion.clone();
  const toPos = new THREE.Vector3(v.x + 6, G.world.topAt(v.x + 6, v.z + 10) + 3, v.z + 10);
  const look = new THREE.Matrix4().lookAt(toPos, new THREE.Vector3(v.x, G.world.topAt(v.x, v.z) + 1, v.z), new THREE.Vector3(0, 1, 0));
  const toQ = new THREE.Quaternion().setFromRotationMatrix(look);
  await tween(1600, (t) => {
    const e = t * t * (3 - 2 * t);
    cam.position.lerpVectors(from, toPos, e);
    cam.quaternion.slerpQuaternions(fromQ, toQ, e);
  });
  const fy = G.world.topAt(v.x, v.z);
  const flag = P.makeSurveyFlag(v.x, fy + 1, v.z);
  G.renderer.scene.add(flag.group);
  G.props.push(flag);
  // the flag plants: golden ring + rising motes + a modest celebratory burst
  FX.ring({ x: v.x, y: fy + 1.05, z: v.z }, { color: 0xffe9a8, radius: 2.4, life: 0.8 });
  FX.floaties({ x: v.x, y: fy + 1.3, z: v.z }, { color: 0xaef0c8, count: 12, life: 1.8, rise: 1.4 });
  FX.confetti({ x: v.x, y: fy + 2, z: v.z }, { count: 20, life: 1.1 });
  // present-day mound dressing, visible only in this grounded shot: butterflies
  // over the old fields' side, dust motes hanging above the buried village
  for (const d of [
    P.makeButterflies(v.x + 2.5, fy + 2.4, v.z + 2),
    P.makeDustMotes(v.x - 2, fy + 1.8, v.z - 1.5),
  ]) {
    G.renderer.scene.add(d.group);
    G.props.push(d);
  }
  await G.hud.narrator(S.act2.p6_flag);
  await G.hud.fadeOut(900);
  FX.clear(); // hard cut into act 3 — retire everything while the screen is dark
}

function waitFor(cond) {
  return new Promise((res) => {
    const iv = setInterval(() => { if (cond()) { clearInterval(iv); res(); } }, 150);
  });
}
