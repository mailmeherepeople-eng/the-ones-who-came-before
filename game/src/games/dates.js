// Oldest first: the training post's timeline round (2026-10-31, the user's
// pick of "Date targets" from the playground proposal). Three targets carry
// dates; shoot them in order, oldest first. A right hit knocks the target
// down; a target shot out of turn shakes and stays up, and the hint says
// which date is older and why, in Act 2's own words (strings.js S.act2).
//
// Sets get harder as they are cleared: CE only, then BCE only (a bigger BCE
// number is older), then both sides of the line, then dates close to 1 BCE
// and 1 CE. Twelve arrows clear all four with no misses. No timer (CL 23).
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { fmtYear } from '../constants.js';
import { Bow } from './bow.js';
import { standTarget, dropTarget } from './targets.js';
import { PROP_MATS } from '../world/props.js';
import { FX } from '../fx/fx.js';
import { SFX } from '../audio.js';
import { wait } from '../ui/hud.js';

// Near, middle, far; the dates are shuffled across them, so distance says
// nothing about age. Closer than the still round: the dates must be readable
// on a phone held upright.
const SLOTS = [{ d: 8, dz: 2.3 }, { d: 12, dz: -2.3 }, { d: 16, dz: 0.3 }];
const MULT = [1, 2, 2, 3]; // per level
const STREAK_FROM = 3, STREAK_BONUS = 5, CLEAN_BONUS = 10;
const NEXT_SET = 1.1; // seconds between a cleared set and the next

// Years are plain numbers here, negative for BCE; fmtYear writes them out.
const between = (a, b, s) => (Math.ceil(a / s) + Math.floor(Math.random() * (Math.floor(b / s) - Math.ceil(a / s) + 1))) * s;
const side = () => (Math.random() < 0.5 ? -1 : 1);
const LEVELS = [
  () => between(100, 2000, 100),          // CE
  () => -between(100, 3000, 100),         // BCE
  () => side() * between(100, 2000, 100), // both sides
  () => side() * between(10, 300, 10),    // close to the crossing
];
export function makeSet(level) {
  const L = Math.min(level, LEVELS.length - 1);
  for (;;) {
    const ys = new Set();
    while (ys.size < 3) ys.add(LEVELS[L]());
    const arr = [...ys];
    if (L < 2 || (arr.some((y) => y < 0) && arr.some((y) => y > 0))) return arr;
  }
}

// Why the oldest standing date comes before the one that was shot.
export function why(older, shot) {
  const a = fmtYear(older), b = fmtYear(shot);
  if (older < 0 && shot > 0) return S.range.dates.whyCross(a, b);
  return older < 0 ? S.range.dates.whyBCE(a, b) : S.range.dates.whyCE(a, b);
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// A clay plaque with the date in charcoal, on a dark board over the target.
// Unlit, so it reads the same in any light.
function dateBoard(label) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#ece2cb';
  c.fillRect(0, 0, 256, 96);
  c.strokeStyle = '#8a5a32';
  c.lineWidth = 8;
  c.strokeRect(4, 4, 248, 88);
  c.fillStyle = '#2b231d';
  c.font = '700 54px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, 128, 52, 232);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), mat);
  plate.rotation.y = -Math.PI / 2; // faces -x, the archer
  group.add(plate);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 1.8), PROP_MATS.woodDark);
  back.position.x = 0.05;
  group.add(back);
  return { group, dispose() { tex.dispose(); mat.dispose(); } };
}

function datedTarget(G, at, year, archer, groundY) {
  const t = standTarget(at.x, groundY(G, at.x, at.z), at.z, archer);
  const board = dateBoard(fmtYear(year));
  board.group.position.set(0.2, 2.34, 0);
  t.root.add(board.group);
  t.root.scale.y = 0.01; // it rises out of the ground
  Object.assign(t, { year, board, down: false, tip: 0, shake: 0, rise: 0 });
  t.update = (dt) => {
    t.rise = Math.min(1, t.rise + dt * 4);
    t.root.scale.y = 0.01 + 0.99 * (1 - (1 - t.rise) ** 3);
    if (t.down) t.tip = Math.min(1, t.tip + dt / 0.35);
    t.root.rotation.z = -1.35 * t.tip * t.tip; // falls back, away from you
    t.shake = Math.max(0, t.shake - dt);
    t.root.rotation.x = Math.sin(t.shake * 44) * 0.08 * (t.shake / 0.5);
  };
  return t;
}

// The round. `kit` lends the post's mark, ground height and score panel
// (games/range.js), which owns the menu and the results card.
export async function playDatesRound(G, R, kit) {
  const scene = G.renderer.scene, m = kit.mark();
  const st = { left: R.arrows, flying: 0, score: 0, streak: 0, hits: 0, bulls: 0 };
  const hud = kit.roundHud(G, R, st);
  const lineEl = document.createElement('div');
  lineEl.className = 'rh-line';
  hud.el.appendChild(lineEl);
  let level = 0, set = [], order = [], wrongInSet = 0, nextSet = 0;

  const live = () => set.filter((t) => !t.down);
  const oldest = () => live().reduce((a, b) => (b.year < a.year ? b : a));
  const renderLine = () => { lineEl.textContent = order.length ? S.range.dates.line(order.map(fmtYear)) : ''; };
  const newSet = () => {
    const years = makeSet(level), slots = shuffle(SLOTS);
    set = years.map((y, i) => datedTarget(G, { x: m.x + slots[i].d, z: m.z + slots[i].dz }, y, m, kit.groundY));
    for (const t of set) scene.add(t.root);
    order = [];
    wrongInSet = 0;
    renderLine();
    hud.flash(S.range.dates.setUp(S.range.dates.levels[Math.min(level, 3)]));
  };
  const dropSet = () => {
    for (const t of set) { dropTarget(scene, t); t.board.dispose(); }
    set = [];
  };

  const bow = new Bow(G, {
    targets: () => live(),
    canShoot: () => st.left > 0 && nextSet <= 0,
    onLoose: () => { st.left--; st.flying++; hud.render(); },
    onHit: (h) => {
      st.flying--;
      const t = h.target, o = live().length ? oldest() : null;
      if (t && t === o) {
        st.streak++;
        st.hits++;
        if (h.tier === 2) st.bulls++;
        const bonus = st.streak >= STREAK_FROM ? STREAK_BONUS : 0;
        const pts = (h.straw ? 1 : h.base) * MULT[Math.min(level, 3)] + bonus;
        st.score += pts;
        bow.popup(S.range.plus(pts), Math.max(0, h.tier));
        if (bonus) hud.flash(S.range.streak(st.streak));
        t.down = true;
        order.push(t.year);
        renderLine();
        if (!live().length) {
          if (!wrongInSet) { st.score += CLEAN_BONUS; hud.flash(S.range.dates.clean); SFX.success(); }
          else hud.flash(S.range.dates.inOrder);
          FX.confetti({ x: t.root.position.x, y: t.root.position.y + 2, z: t.root.position.z }, { count: wrongInSet ? 8 : 18 });
          level++;
          nextSet = st.left > 0 ? NEXT_SET : 0; // the last arrow: leave them lying there
        }
      } else if (t && o) {
        st.streak = 0;
        wrongInSet++;
        t.shake = 0.5;
        bow.popup(S.range.dates.notYet, -1);
        G.hud.hint(why(o.year, t.year), 6000);
      }
      hud.render();
    },
    onMiss: () => { st.flying--; st.streak = 0; bow.popup(S.range.miss, -1); hud.render(); },
  });

  newSet();
  bow.raise();
  G.hud.hint(S.range.dates.start, 7000);
  await new Promise((res) => {
    G.tick = (dt) => {
      bow.update(dt);
      for (const t of set) t.update(dt);
      if (nextSet > 0) {
        nextSet -= dt;
        if (nextSet <= 0) { dropSet(); if (st.left > 0) newSet(); }
      }
      if (st.left === 0 && st.flying === 0 && nextSet <= 0) res();
    };
  });
  await wait(800);
  bow.rest();
  G.hud.hideHint();
  G.tick = (dt) => { for (const t of set) t.update(dt); };
  return {
    result: { round: R, score: st.score, hits: st.hits, bulls: st.bulls },
    cleanup() {
      G.tick = null;
      bow.stop();
      dropSet();
      hud.remove();
    },
  };
}
