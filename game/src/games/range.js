// The training post (2026-10-30: "there should also be a training post where
// kids can practise archery. and some mini games where they can try to hit
// targets that are stationary, moving and stuff. so that they can play and
// try to get high scores among themselves.")
//
// Two ways in:
//  - the story: on the way to the hunt, Act 1 stops here for three hits
//    (practiceAtPost), which is also where the bow is taught;
//  - the title screen's Training post button (runRange): three scored rounds
//    of ten arrows, medals, and a board of the best scores on this device.
//
// The post stands just east of the river crossing, on flat ground beside the
// path to the plains (SITES.trainingPost); its lanes run east.
import { S } from '../strings.js';
import { SITES, groundHeight } from '../world/terrain.js';
import { buildSceneB } from '../world/states.js';
import { B, isSolid } from '../world/blocks.js';
import { WORLD } from '../constants.js';
import { Bow, bowHint } from './bow.js';
import { standTarget, swingTarget, runningTarget, dropTarget } from './targets.js';
import { Scores } from './scores.js';
import { activity } from '../ui/activity.js';
import { wait } from '../ui/hud.js';
import { SFX } from '../audio.js';
import { FX } from '../fx/fx.js';

// Medal lines from scripted archers (2026-10-30, docs/CHANGELOG.md 33): on the
// moving rounds an archer who aims where the target IS scores under bronze; one
// who leads it well reaches silver; gold needs the centre rings too. The
// running deer's lines dropped when it began to run erratically (CL 34):
// the same archers averaged 13, 59 and 96 against it (no lead, a good lead
// read with a human's 0.2 s lag, a perfect lead).
export const ROUNDS = [
  { id: 'still', arrows: 10, medals: [50, 110, 170] },
  { id: 'swing', arrows: 10, medals: [30, 65, 110] },
  { id: 'run', arrows: 10, medals: [30, 60, 110] },
];
const STREAK_FROM = 3, STREAK_BONUS = 5; // the third hit in a row on earns a bonus
// near on the right, middle on the left, far in the centre: none of them
// stands behind the bow in view, which is held low on the left
const STILL = [{ d: 10, dz: 2.2, mult: 1 }, { d: 20, dz: -1.6, mult: 2 }, { d: 30, dz: 0.4, mult: 3 }];

// where the archer stands: the middle of the post's block
const mark = () => ({ x: SITES.trainingPost.x + 0.5, z: SITES.trainingPost.z + 0.5 });
const groundY = (G, x, z) => groundHeight(Math.floor(x), Math.floor(z)) + 1;

// Clear the lanes: flowers and grass in the box, and any whole tree whose
// trunk stands in it (cut whole, never left floating). Only what stands on the
// ground goes; the ground itself is frozen (AGENTS.md) and is not touched.
// Wild berry bushes stay: each is a block with a shared bush model and a pick
// prompt over it (CL 15.2, 26), so taking the block would orphan both. They
// stand one block tall, under the target faces.
const LANES = { x0: 1, x1: 34, dz: 7 };
const TREE = new Set([B.WOOD, B.WOOD_BIRCH, B.LEAVES, B.LEAVES_BRIGHT, B.LEAVES_DARK, B.ROOTS]);
const KEEP = new Set([B.AIR, B.WATER, B.SHRUB_BERRY]);
function clearLanes(G) {
  const w = G.world, m = mark();
  const x0 = Math.floor(m.x) + LANES.x0, x1 = Math.floor(m.x) + LANES.x1;
  const z0 = Math.floor(m.z) - LANES.dz, z1 = Math.floor(m.z) + LANES.dz;
  const trunks = [];
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const g = groundHeight(x, z);
      const base = w.get(x, g + 1, z);
      if (base === B.WOOD || base === B.WOOD_BIRCH) trunks.push({ x, z, g });
      for (let y = g + 1; y < WORLD.SIZE_Y; y++) {
        const id = w.get(x, y, z);
        if (!KEEP.has(id) && !isSolid(id)) w.set(x, y, z, B.AIR);
      }
    }
  }
  for (const t of trunks) {
    for (let x = t.x - 4; x <= t.x + 4; x++) {
      for (let z = t.z - 4; z <= t.z + 4; z++) {
        for (let y = t.g + 1; y < WORLD.SIZE_Y; y++) if (TREE.has(w.get(x, y, z))) w.set(x, y, z, B.AIR);
      }
    }
  }
}

function buildTargets(G, id) {
  const m = mark();
  const at = (d, dz) => ({ x: m.x + d, z: m.z + dz });
  if (id === 'still') {
    return STILL.map((s) => {
      const p = at(s.d, s.dz);
      return standTarget(p.x, groundY(G, p.x, p.z), p.z, m, { mult: s.mult });
    });
  }
  const p = id === 'swing' ? at(16, 0) : at(18, 0);
  const make = id === 'swing' ? swingTarget : runningTarget;
  return [make(p.x, groundY(G, p.x, p.z), p.z, m)];
}

// ---------- the story's stop ----------

// The three still targets, standing at the post for the whole of Scene A.
// Their static wood folds into one mesh; the painted faces stay their own.
export function addTrainingPost(G) {
  clearLanes(G);
  const targets = buildTargets(G, 'still');
  for (const t of targets) {
    G.renderer.scene.add(t.root);
    G.props.push({ group: t.root }); // the scene's teardown takes them
  }
  return targets;
}

// Three hits on the painted faces, as many arrows as it takes.
export async function practiceAtPost(G, targets, need = 3) {
  let hits = 0;
  G.hud.setObjective(S.range.obj_practiceN(0, need));
  G.player.yaw = Math.PI / 2; // east, down the lanes
  G.player.pitch = 0;
  G.player.moveLock = true;
  document.body.classList.add('move-locked');
  const bow = new Bow(G, {
    targets: () => targets,
    onHit: (h) => {
      if (h.points <= 0) { bow.popup(S.range.straw, -1); return; }
      hits++;
      bow.popup(h.tier === 2 ? S.range.bull : S.range.hit, h.tier);
      G.hud.setObjective(S.range.obj_practiceN(Math.min(hits, need), need));
    },
    onMiss: () => bow.popup(S.range.miss, -1),
  });
  bow.raise();
  G.hud.hint(bowHint(G), 9000);
  await new Promise((res) => {
    G.tick = (dt) => {
      bow.update(dt);
      if (hits >= need && !bow.inFlight()) res();
    };
  });
  await wait(450);
  G.tick = null;
  bow.stop();
  G.player.moveLock = false;
  document.body.classList.remove('move-locked');
  G.hud.hideHint();
  await G.hud.narrator(S.range.practiceDone);
}

// ---------- the title screen's training post ----------

export async function runRange(G) {
  G.mode = 'boot';
  G.tick = null;
  G.hud.setObjective(null);
  buildSceneB(G.world);
  clearLanes(G);
  G.mesher.remeshAll();
  G.renderer.setSky(0x9ec8e8, 0xcfe0ee);
  G.renderer.setMist(0);
  FX.setMotes('pollen');
  const m = mark();
  G.player.teleport(m.x, m.z, Math.PI / 2);
  G.player.pitch = 0;
  G.player.setModelHidden(false);
  G.player.equip('bow');
  G.player.moveLock = true;
  document.body.classList.add('move-locked');
  G.input.setEnabled(true);
  G.mode = 'ground';
  let round = await roundMenu(G);
  while (round) {
    const played = await playRound(G, round);
    const next = await resultsCard(G, played.result);
    played.cleanup();
    if (next === 'menu') round = await roundMenu(G);
    else if (next === 'leave') round = null;
  }
  location.reload(); // back to the title, clean
}

async function playRound(G, R) {
  const targets = buildTargets(G, R.id);
  for (const t of targets) G.renderer.scene.add(t.root);
  G.player.yaw = Math.PI / 2;
  G.player.pitch = 0;
  const st = { left: R.arrows, flying: 0, score: 0, streak: 0, hits: 0, bulls: 0 };
  const hud = roundHud(G, R, st);
  const bow = new Bow(G, {
    targets: () => targets,
    canShoot: () => st.left > 0,
    onLoose: () => { st.left--; st.flying++; hud.render(); },
    onHit: (h) => {
      st.flying--;
      if (h.points > 0) {
        st.streak++;
        st.hits++;
        if (h.tier === 2) st.bulls++;
        const bonus = st.streak >= STREAK_FROM ? STREAK_BONUS : 0;
        st.score += h.points + bonus;
        bow.popup(S.range.plus(h.points + bonus), h.tier);
        if (bonus) hud.flash(S.range.streak(st.streak));
        h.target?.faster?.();
      } else {
        st.streak = 0;
        bow.popup(S.range.straw, -1);
      }
      hud.render();
    },
    onMiss: () => { st.flying--; st.streak = 0; bow.popup(S.range.miss, -1); hud.render(); },
  });
  bow.raise();
  G.hud.hint(bowHint(G), 6000);
  await new Promise((res) => {
    G.tick = (dt) => {
      bow.update(dt);
      if (bow.hitStop <= 0) for (const t of targets) t.update?.(dt);
      if (st.left === 0 && st.flying === 0) res();
    };
  });
  await wait(800);
  bow.rest(); // still at the eye: your arrows stay in view behind the card
  G.hud.hideHint();
  // the targets keep moving behind the card, which is nicer than a freeze
  G.tick = (dt) => { for (const t of targets) t.update?.(dt); };
  return {
    result: { round: R, score: st.score, hits: st.hits, bulls: st.bulls },
    cleanup() {
      G.tick = null;
      bow.stop();
      for (const t of targets) dropTarget(G.renderer.scene, t);
      hud.remove();
    },
  };
}

function roundHud(G, R, st) {
  const el = document.createElement('div');
  el.className = 'range-hud';
  el.innerHTML = '<div class="rh-name"></div><div class="rh-score"></div><div class="rh-quiver" aria-hidden="true"></div>' +
    '<div class="rh-left"></div><div class="rh-flash" role="status"></div>';
  el.querySelector('.rh-name').textContent = S.range.rounds[R.id].name;
  const quiver = el.querySelector('.rh-quiver');
  for (let i = 0; i < R.arrows; i++) quiver.appendChild(document.createElement('i'));
  G.hud.root.appendChild(el);
  let flashT = null;
  const api = {
    render() {
      el.querySelector('.rh-score').textContent = S.range.scoreLabel(st.score);
      el.querySelector('.rh-left').textContent = S.range.arrowsLeft(st.left);
      [...quiver.children].forEach((n, i) => n.classList.toggle('spent', i >= st.left));
    },
    flash(text) {
      const f = el.querySelector('.rh-flash');
      f.textContent = text;
      f.classList.add('on');
      clearTimeout(flashT);
      flashT = setTimeout(() => f.classList.remove('on'), 1300);
    },
    remove() { clearTimeout(flashT); el.remove(); },
  };
  api.render();
  return api;
}

function medalBadge(i) {
  const b = document.createElement('span');
  b.className = `medal m${i}`;
  b.textContent = S.range.medals[i];
  return b;
}

// Pick a round, or leave. Resolves to a round from ROUNDS, or null.
function roundMenu(G) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'range-panel';
    el.innerHTML = '<h2></h2><p class="rp-sub"></p><div class="rp-rounds"></div><button class="btn rp-leave"></button>';
    el.querySelector('h2').textContent = S.range.menuTitle;
    el.querySelector('.rp-sub').textContent = S.range.menuSub;
    const list = el.querySelector('.rp-rounds');
    const scope = activity(G.hud.root, el, G.input);
    const done = (r) => { SFX.click(); scope.close(); el.remove(); resolve(r); };
    for (const R of ROUNDS) {
      const rec = Scores.get(R.id);
      const b = document.createElement('button');
      b.className = 'rp-round';
      b.innerHTML = '<span class="rp-name"></span><span class="rp-desc"></span><span class="rp-best"></span>';
      b.querySelector('.rp-name').textContent = S.range.rounds[R.id].name;
      b.querySelector('.rp-desc').textContent = S.range.rounds[R.id].desc;
      const best = b.querySelector('.rp-best');
      best.textContent = rec.plays ? S.range.best(rec.best) : S.range.notPlayed;
      if (rec.medal >= 0) best.appendChild(medalBadge(rec.medal));
      b.addEventListener('click', () => done(R));
      list.appendChild(b);
    }
    const leave = el.querySelector('.rp-leave');
    leave.textContent = S.range.leave;
    leave.addEventListener('click', () => done(null));
    G.hud.root.appendChild(el);
  });
}

// The score, the medal, the board. Resolves to 'again' | 'menu' | 'leave'.
function resultsCard(G, res) {
  const R = res.round;
  const out = Scores.finish(R.id, res.score, R.medals);
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'range-panel results';
    // The actions come first in the DOM (CSS shows them last) so the dialog's
    // first focus lands on Shoot again, not the name box: focusing a text box
    // on a phone throws the keyboard up over the card.
    el.innerHTML = '<h2></h2><div class="rp-score"></div><div class="rp-medal"></div><div class="rp-note"></div>' +
      '<div class="rp-stats"></div><div class="rp-actions"><button class="btn primary" data-go="again"></button>' +
      '<button class="btn" data-go="menu"></button><button class="btn" data-go="leave"></button></div>' +
      '<form class="rp-form"><label></label><div class="rp-row"><input type="text" maxlength="12"' +
      ' autocomplete="off"><button class="btn primary" type="submit"></button></div></form><h3 class="rp-board-h"></h3>' +
      '<ol class="rp-board"></ol>';
    el.querySelector('h2').textContent = S.range.rounds[R.id].name;
    el.querySelector('.rp-score').textContent = String(res.score);
    const medal = el.querySelector('.rp-medal');
    if (out.medal >= 0) medal.appendChild(medalBadge(out.medal));
    const next = R.medals.findIndex((t) => res.score < t);
    medal.appendChild(document.createTextNode(next < 0 ? S.range.allMedals
      : out.medal < 0 ? S.range.noMedal(R.medals[0]) : S.range.nextMedal(S.range.medals[next], R.medals[next])));
    el.querySelector('.rp-note').textContent = out.newBest && res.score > 0 ? S.range.newBest : S.range.best(out.best);
    el.querySelector('.rp-stats').textContent = S.range.stats(res.hits, R.arrows, res.bulls);
    const form = el.querySelector('.rp-form');
    const input = form.querySelector('input');
    form.querySelector('label').textContent = S.range.nameLabel;
    input.placeholder = S.range.namePlaceholder;
    input.value = Scores.lastName();
    input.setAttribute('aria-label', S.range.nameLabel);
    form.querySelector('button').textContent = S.range.nameSave;
    el.querySelector('.rp-board-h').textContent = S.range.boardTitle;
    let added = !out.onBoard;
    form.hidden = added;
    const board = el.querySelector('.rp-board');
    const showBoard = (top, mine) => {
      board.innerHTML = '';
      const rows = top.slice(0, 5);
      if (!rows.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = S.range.boardEmpty;
        board.appendChild(li);
      }
      rows.forEach((e) => {
        const li = document.createElement('li');
        if (e === mine) li.className = 'mine';
        const n = document.createElement('span'); n.textContent = e.name || S.range.anon;
        const s = document.createElement('b'); s.textContent = String(e.score);
        li.append(n, s);
        board.appendChild(li);
      });
    };
    showBoard(Scores.get(R.id).top, null);
    const addName = () => {
      if (added) return;
      added = true;
      const top = Scores.addToBoard(R.id, res.score, input.value);
      showBoard(top, top.find((e) => e.score === res.score && e.at >= Date.now() - 2000) ?? null);
      form.hidden = true;
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); SFX.click(); addName(); });
    const scope = activity(G.hud.root, el, G.input);
    for (const b of el.querySelectorAll('[data-go]')) {
      b.textContent = S.range[b.dataset.go === 'again' ? 'again' : b.dataset.go === 'menu' ? 'other' : 'leave'];
      b.addEventListener('click', () => {
        SFX.click();
        addName(); // a score that made the board goes on it, named or not
        scope.close();
        el.remove();
        resolve(b.dataset.go);
      });
    }
    G.hud.root.appendChild(el);
    if (out.newMedal || out.newBest) {
      SFX.success();
      const p = G.player.pos;
      FX.confetti({ x: p.x + 2, y: p.y + 1.6, z: p.z }, { count: out.newMedal ? 30 : 14 });
    }
  });
}
