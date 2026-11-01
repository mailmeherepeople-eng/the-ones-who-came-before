// The band's task hide: a painted hide on a frame beside the store box
// (SITES.taskHide). 2026-10-31: "the board should be an object in the game.
// like a message board." The band has no writing (their language is the one
// thing Act 1 says is lost), so the hide carries pictures, one per task, with
// a ring of red ochre round each one done. Walking up to it opens the list in
// words, which is the player's own view of it, like every other panel.
//
// The hide only shows and points. Doing a thing is what starts a task
// (acts/sceneA.js). "Show me" on an open task points the guide light at it.
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { iconFor } from './icons.js';
import { activity } from './activity.js';
import { enhance } from '../world/shade.js';
import { PROP_MATS } from '../world/props.js';

const W = 256, H = 256, COLS = 2, ROWS = 4;
const INK = '#2b231d', OCHRE = '#a8432a';

// The task icons as images, drawn once in charcoal.
const glyphs = new Map();
function glyph(icon) {
  if (glyphs.has(icon)) return glyphs.get(icon);
  const svg = iconFor(icon);
  const img = new Image();
  const ready = new Promise((res) => { img.onload = () => res(img); img.onerror = () => res(null); });
  if (svg) img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ').replace('stroke="currentColor"', `stroke="${INK}"`).replace('stroke-width="1.8"', 'stroke-width="2.2"'));
  const g = { img, ready: svg ? ready : Promise.resolve(null), icon };
  glyphs.set(icon, g);
  return g;
}

function paintHide(c, rows) {
  c.clearRect(0, 0, W, H);
  // the hide: a stretched skin, darker at the rim
  c.fillStyle = '#b48a5a';
  c.beginPath();
  c.moveTo(18, 10); c.quadraticCurveTo(128, -2, 238, 10); c.quadraticCurveTo(252, 128, 238, 246);
  c.quadraticCurveTo(128, 258, 18, 246); c.quadraticCurveTo(4, 128, 18, 10); c.fill();
  c.fillStyle = '#d2b07e';
  c.beginPath();
  c.moveTo(30, 22); c.quadraticCurveTo(128, 12, 226, 22); c.quadraticCurveTo(238, 128, 226, 234);
  c.quadraticCurveTo(128, 244, 30, 234); c.quadraticCurveTo(18, 128, 30, 22); c.fill();
  const cw = (W - 60) / COLS, ch = (H - 44) / ROWS;
  rows.forEach((r, i) => {
    const cx = 30 + cw * (i % COLS) + cw / 2, cy = 22 + ch * Math.floor(i / COLS) + ch / 2;
    const g = glyph(r.icon);
    c.globalAlpha = r.state === 'locked' ? 0.3 : r.state === 'next' ? 0.75 : 1;
    if (g.img.complete && g.img.naturalWidth) c.drawImage(g.img, cx - 22, cy - 22, 44, 44);
    else { c.font = '32px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(r.icon, cx, cy); }
    c.globalAlpha = 1;
    if (r.state === 'done') {
      c.strokeStyle = OCHRE; c.lineWidth = 5;
      c.beginPath(); c.ellipse(cx, cy, 30, 25, -0.15, 0.2, Math.PI * 2 - 0.1); c.stroke();
    } else if (r.state === 'active') {
      c.fillStyle = OCHRE;
      for (const dx of [-12, 0, 12]) { c.beginPath(); c.arc(cx + dx, cy + 27, 3, 0, Math.PI * 2); c.fill(); }
    }
  });
}

// The hide on its frame, facing +z (the camp). Returns the prop and a repaint.
function makeHide(at, y) {
  const group = new THREE.Group();
  group.position.set(at.x + 0.5, y, at.z + 0.5);
  const box = (w, h, d, mat, x, yy, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, yy, z);
    group.add(m);
  };
  box(0.13, 2.3, 0.13, PROP_MATS.woodDark, -0.85, 1.15, 0);
  box(0.13, 2.3, 0.13, PROP_MATS.woodDark, 0.85, 1.15, 0);
  box(1.95, 0.1, 0.1, PROP_MATS.wood, 0, 2.2, 0);
  box(1.75, 0.08, 0.08, PROP_MATS.wood, 0, 0.62, 0);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = enhance(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
  const skin = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), mat);
  skin.position.set(0, 1.42, 0.04);
  group.add(skin);
  // the back is bare skin: no mirrored pictures from behind
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), enhance(new THREE.MeshLambertMaterial({ color: 0x9a7448 })));
  back.position.set(0, 1.42, 0.03);
  back.rotation.y = Math.PI;
  group.add(back);
  const ctx = cv.getContext('2d');
  return {
    group,
    paint(rows) { paintHide(ctx, rows); tex.needsUpdate = true; },
  };
}

// at: SITES.taskHide; y: the ground height there; onShow(id): point at a task.
export function installTaskBoard(G, { at, y, onShow }) {
  const hide = makeHide(at, y);
  G.renderer.scene.add(hide.group);
  G.props.push(hide); // the scene's teardown takes it
  let rows = [], panel = null;

  const close = () => { panel?.close(); panel = null; };
  const open = () => {
    if (panel || G.hud.root.dataset.modal) return;
    const el = document.createElement('div');
    el.className = 'range-panel tasks-panel';
    el.innerHTML = '<h2></h2><p class="rp-sub"></p><ul class="tp-list"></ul><button class="btn tp-close"></button>';
    el.querySelector('h2').textContent = S.tasks.title;
    const done = rows.filter((r) => r.state === 'done').length;
    el.querySelector('.rp-sub').textContent = S.tasks.sub(done, rows.length);
    const list = el.querySelector('.tp-list');
    for (const r of rows) {
      const li = document.createElement('li');
      li.className = `tp-row ${r.state}`;
      li.innerHTML = '<span class="tp-icon" aria-hidden="true"></span><span class="tp-text"><b></b><small></small></span>';
      li.querySelector('.tp-icon').innerHTML = iconFor(r.icon) ?? r.icon;
      li.querySelector('b').textContent = r.name;
      li.querySelector('small').textContent = r.note;
      if (r.state === 'open') {
        const go = document.createElement('button');
        go.className = 'btn tp-go';
        go.textContent = S.tasks.show;
        go.addEventListener('click', () => { close(); onShow(r.id); });
        li.appendChild(go);
      }
      list.appendChild(li);
    }
    const shut = el.querySelector('.tp-close');
    shut.textContent = S.tasks.close;
    shut.addEventListener('click', close);
    G.hud.root.appendChild(el);
    const scope = activity(G.hud.root, el, G.input);
    panel = { close() { scope.close(); el.remove(); } };
  };
  const spot = { id: 'task-hide', x: at.x + 0.5, z: at.z + 1.2, r: 2.6, prompt: '🔍', label: S.tasks.hideLabel, enabled: true, onInteract: open };
  G.interactables.push(spot);

  return {
    // rows: [{ id, icon, name, state: 'done'|'active'|'open'|'next'|'locked', note }]
    render(next) {
      rows = next;
      hide.paint(rows);
      // the pictures load once; paint again when they arrive
      Promise.all(rows.map((r) => glyph(r.icon).ready)).then(() => { if (rows === next) hide.paint(rows); });
    },
    spot: { x: at.x + 2.2, z: at.z + 1 }, // the guide light stands beside it, not through it
    remove() {
      close();
      G.interactables = G.interactables.filter((o) => o !== spot);
    },
  };
}
