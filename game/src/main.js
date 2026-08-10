// Boot + game orchestration. Owns the ground-mode frame loop; hands control
// to act scripts (acts/act1..3) which drive beats through shared systems.
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { VoxelWorld } from './world/voxel.js';
import { ChunkMesher } from './world/mesher.js';
import { Player } from './player/player.js';
import { HUD } from './ui/hud.js';
import { S } from './strings.js';
import { Save } from './save.js';
import { runAct1 } from './acts/act1.js';
import { SFX } from './audio.js';
import { FX } from './fx/fx.js';
import { Settings } from './settings.js';

const canvas = document.getElementById('gl');
const uiRoot = document.getElementById('ui-root');

export const G = {
  renderer: new Renderer(canvas),
  input: new Input(canvas, uiRoot),
  world: new VoxelWorld(),
  hud: new HUD(uiRoot),
  player: null,
  mesher: null,
  interactables: [], // {id, x, z, r, prompt, onInteract, enabled}
  npcs: [],
  props: [],
  mode: 'boot', // boot | ground | sky | ui
  tick: null, // per-act extra tick
};

// dev-only (?dev): expose the game object for review tooling; no-op otherwise
if (new URLSearchParams(location.search).has('dev')) window.G = G;

// ---------- world editor (dev tool) ----------
// Loaded lazily: `?edit` opens it at boot, F2 opens it any time. Nothing of it
// is in the shipped graph until one of those happens.
async function openEditor() {
  window.G = G; // the editor and the console both want the handle
  const [{ initEditor }, { makeHost }] = await Promise.all([
    import('./dev/editor.js'), import('./dev/host.js'),
  ]);
  G.host ??= makeHost(G); // one adapter per session — it wraps the frame loop
  return initEditor(G.host);
}
if (new URLSearchParams(location.search).has('edit')) addEventListener('load', openEditor);
addEventListener('keydown', (e) => {
  if (e.code !== 'F2' || window.__editor) return;
  e.preventDefault();
  openEditor();
});

G.player = new Player(G.world, G.renderer.camera, G.renderer.scene); // scene → visible TPS character
G.mesher = new ChunkMesher(G.world, G.renderer.scene);
G.renderer.onContextRestored = () => G.mesher.remeshAll();
G.hud.input = G.input;
G.audio = SFX;

// settings -> live game state. subscribe() fires once immediately, so the
// saved preference is applied at boot without duplicating the logic here.
Settings.subscribe(() => {
  G.player.lockCamera = Settings.get('lockCamera');
});

// visual FX layer: init once on the persistent scene; wire player juice hooks
FX.init(G.renderer.scene);
G.player.onFootstep = (p) => FX.puff(p, { count: 3, size: 0.2, life: 0.45, alpha: 0.3, color: 0xb9a77e });
G.player.onLand = (p) => FX.puff(p, { count: 12, size: 0.32, life: 0.6, color: 0xb9a77e });
G.player.onSplash = (p) => FX.burst(p, { count: 24, size: 0.13, speed: 3, life: 0.6, gravity: 9, additive: false, color: 0xbfe4f5 });

// character collision: NPCs/animals treat the player as a solid body (npc.js),
// and the player is pushed out of them each frame (see the ground loop below)
import { setPlayerBody } from './npc/npc.js';
import { PLAYER, QUALITY, QUALITY_TIER } from './constants.js';
setPlayerBody({ pos: G.player.pos, r: PLAYER.RADIUS });

// ---------- stage clearing (interactables, NPCs, props) ----------
import { disposeGroup, foldIfStatic } from './world/props.js';

export function clearStage(G) {
  G.interactables.length = 0;
  for (const n of G.npcs) n.dispose();
  G.npcs.length = 0;
  for (const p of G.props) {
    if (p.group) disposeGroup(G.renderer.scene, p.group);
  }
  G.props.length = 0;
}

// ---------- interactables ----------
export function addInteract(obj) {
  G.interactables.push({ enabled: true, r: 2.6, ...obj });
  return obj;
}
export function removeInteract(id) {
  G.interactables = G.interactables.filter((o) => o.id !== id);
}
export function clearInteracts() { G.interactables = []; }

// An interactable may FOLLOW a moving thing (`follow` is anything with a
// `pos`), which is what lets a talk prompt track a tribe member walking their
// errand instead of hanging in the air where they were standing at spawn.
export function interactAt(o) {
  return o.follow ? o.follow.pos : o;
}

function nearestInteract() {
  let best = null, bestD = 1e9;
  for (const o of G.interactables) {
    if (!o.enabled) continue;
    if (o.follow && (o.follow.downed || o.follow.dead)) continue;
    const at = interactAt(o);
    const d = Math.hypot(G.player.pos.x - at.x, G.player.pos.z - at.z);
    if (d < (o.r ?? 2.6) && d < bestD) { best = o; bestD = d; }
  }
  return best;
}

// ---------- ground frame loop ----------
let interactBusy = false;
// dev-only (?tp=x,z): one-shot teleport once boot reaches ground mode
let devTp = new URLSearchParams(location.search).get('tp');
G.renderer.onFrame = (dt) => {
  const inp = G.input.poll();
  if (G.mode === 'ground') {
    if (devTp !== null) {
      const [tx, tz] = devTp.split(',').map(Number);
      devTp = null;
      if (Number.isFinite(tx) && Number.isFinite(tz)) G.player.teleport(tx, tz, 0);
    }
    G.player.update(dt, inp);
    G.player.resolveCharacters(G.npcs); // people and animals are solid bodies
    const target = nearestInteract();
    if (target && !interactBusy) {
      G.hud.showPrompt(target.prompt ?? (G.input.isTouch ? S.ui.interact : S.ui.interactKey));
      if (inp.interact) {
        interactBusy = true;
        Promise.resolve()
          .then(() => target.onInteract(target))
          .catch((e) => console.error('interact failed', e))
          .finally(() => { interactBusy = false; });
      }
    } else {
      G.hud.hidePrompt();
    }
    for (const n of G.npcs) n.update?.(dt);
    // foldIfStatic is a no-op after the first sighting of a prop (it sets its
    // own flag). Doing it here rather than at each push site is deliberate:
    // acts add props through several paths and the editor spawns them at
    // runtime, and this is the one place every prop is guaranteed to pass.
    for (const p of G.props) { if (!p._folded) foldIfStatic(p); p.update?.(dt); }
  }
  if (G.tick) G.tick(dt, inp);
  FX.update(dt);
  G.mesher.flush(QUALITY.meshBudget);
};

// ---------- act flow ----------
async function playFrom(act, beat) {
  if (act <= 1) {
    const resumeScene = act === 1 && beat?.startsWith('a1.') ? beat : null;
    await runAct1(G, resumeScene);
  }
  const { runAct2 } = await import('./acts/act2.js');
  if (act <= 2) await runAct2(G);
  const { runAct3 } = await import('./acts/act3.js');
  await runAct3(G, act === 3 ? beat : null);
}

// ---------- debug: ?act=N jumps straight to an act with seeded records ----------
function seedDebugRecords() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#4c3a26'; c.fillRect(0, 0, 256, 128);
  c.strokeStyle = '#c0603a'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(60, 90); c.lineTo(120, 40); c.lineTo(180, 90); c.stroke();
  const png = cv.toDataURL('image/png');
  const mk = document.createElement('canvas');
  mk.width = 96; mk.height = 96;
  const m2 = mk.getContext('2d');
  m2.strokeStyle = '#4a2416'; m2.lineWidth = 6;
  m2.beginPath(); m2.arc(48, 48, 26, 0, Math.PI * 1.5); m2.stroke();
  const mark = mk.toDataURL('image/png');
  const Y = { a: -36000, d: -5400 };
  const seeds = [
    { id: 'painting', type: 'painting', pos: { x: 42, z: 9 }, made: Y.a, data: { png } },
    { id: 'beads', type: 'beads', pos: { x: 52, z: 30 }, made: Y.a, data: { count: 7 } },
    { id: 'arrowheads', type: 'arrowheads', pos: { x: 36, z: 25 }, made: Y.a, data: {} },
    { id: 'hearthA', type: 'hearth', pos: { x: 40, z: 26 }, made: Y.a, data: {} },
    { id: 'burial', type: 'burial', pos: { x: 52, z: 30 }, made: Y.a, data: { goods: ['beads', 'blade'] } },
    { id: 'obsidian', type: 'obsidian', pos: { x: 72, z: 76 }, made: Y.a, data: {} },
    { id: 'crops', type: 'crop', pos: { x: 66, z: 86 }, made: -7000, data: { plots: 4 } },
    { id: 'grain', type: 'grain', pos: { x: 78, z: 74 }, made: -7000, data: {} },
    { id: 'pot', type: 'pot', pos: { x: 72, z: 76 }, made: Y.d, data: { shape: 0, profile: [0.34, 0.52, 0.64, 0.66, 0.6, 0.46, 0.34, 0.4], mark } },
    { id: 'basket', type: 'basket', pos: { x: 72, z: 76 }, made: Y.d, data: {} },
  ];
  for (const s of seeds) if (!Save.getRecord(s.id)) Save.addRecord(s);
}

// ---------- act-select menu (Tab): jump to any act without replaying ----------
// Uses the same debug-jump path as ?act=N (records seeded, clean stage via a
// full reload), so a jump can never leave a half-torn-down act behind.
let actMenuOpen = false;
async function openActMenu() {
  if (actMenuOpen) return;
  actMenuOpen = true;
  try {
    const pick = await G.hud.choice(
      `${S.actMenu.title} ${S.actMenu.note}`,
      [S.actMenu.act1, S.actMenu.act2, S.actMenu.act3, S.actMenu.cancel],
    );
    if (pick >= 0 && pick <= 2) {
      // Second confirm, but only when there is something to lose. Until now a
      // written warning was the only thing between a curious Tab press and a
      // wiped save, and this ships to kids. With no progress the jump destroys
      // nothing, so the extra tap would just be noise.
      if (Save.hasProgress) {
        const ok = await G.hud.choice(S.actMenu.confirmTitle,
          [S.actMenu.confirmYes, S.actMenu.confirmNo]);
        if (ok !== 0) return;
      }
      Save.reset();
      const p = new URLSearchParams(location.search);
      p.delete('tp'); // stale one-shot teleports must not fire in the new act
      p.set('act', String(pick + 1));
      location.search = p.toString();
    }
  } finally {
    actMenuOpen = false;
  }
}
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault(); // keep focus from cycling through HUD buttons
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  openActMenu();
});

// ---------- boot ----------
async function boot() {
  // act jump (Tab menu / ?act=N); never allowed to clobber a real player's
  // save position — with progress present the normal title flow runs instead
  const dbgAct = Number(new URLSearchParams(location.search).get('act') || 0);
  if (dbgAct >= 1 && !Save.hasProgress) {
    if (dbgAct >= 2) seedDebugRecords();
    await playFrom(dbgAct, null);
    return;
  }
  const title = document.createElement('div');
  title.className = 'screen';
  title.innerHTML = `
    <h1></h1><h2></h2>
    <button class="btn primary" id="t-start"></button>
    <button class="btn" id="t-new" style="display:none"></button>
    <div class="studio"></div>`;
  title.querySelector('h1').textContent = S.title;
  title.querySelector('h2').textContent = S.subtitle;
  title.querySelector('.studio').textContent = S.studio;
  const startBtn = title.querySelector('#t-start');
  const newBtn = title.querySelector('#t-new');

  let resume = false;
  if (Save.hasProgress) {
    startBtn.textContent = S.resume;
    newBtn.textContent = S.startNew;
    newBtn.style.display = '';
    resume = true;
  } else {
    startBtn.textContent = S.startNew;
  }
  uiRoot.appendChild(title);

  const mode = await new Promise((res) => {
    startBtn.addEventListener('click', () => res(resume ? 'resume' : 'new'), { once: true });
    newBtn.addEventListener('click', async () => {
      const pick = await G.hud.choice(S.newGameConfirm, [S.newGameNo, S.newGameYes]);
      if (pick === 1) { Save.reset(); res('new'); }
      else location.reload();
    }, { once: true });
  });
  title.remove();

  if (mode === 'new') {
    await G.hud.card([{ text: S.openingCard }, S.openingCard2]);
    await playFrom(1, null);
  } else {
    await playFrom(Math.max(1, Save.data.act), Save.data.beat);
  }
}

boot().catch((e) => {
  console.error('fatal', e);
});
