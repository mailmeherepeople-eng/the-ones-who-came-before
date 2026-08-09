// Cave painting minigame: finger/mouse drawing + stamp shapes on a rock-wall
// canvas. Whatever the player paints is saved VERBATIM (256×128 PNG) and
// returns in Act 3 (design doc A1-B4).
import { S } from '../strings.js';

const OCHRES = ['#c0603a', '#8d3b28', '#e0a458', '#2e2620', '#e8ddc4'];

// stamp painters: (ctx, x, y, color)
const STAMPS = {
  deer(ctx, x, y, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x - 14, y - 6, 26, 10); // body
    ctx.fillRect(x + 8, y - 14, 8, 10); // head/neck
    ctx.fillRect(x - 12, y + 4, 4, 10); ctx.fillRect(x + 6, y + 4, 4, 10); // legs
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 12, y - 14); ctx.lineTo(x + 6, y - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, y - 14); ctx.lineTo(x + 20, y - 22); ctx.stroke();
  },
  hand(ctx, x, y, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y + 4, 9, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.85 + i * (Math.PI * 0.7 / 4);
      ctx.save(); ctx.translate(x, y + 2); ctx.rotate(a);
      ctx.fillRect(-2, -16, 4, 14); ctx.restore();
    }
  },
  human(ctx, x, y, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - 12, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, y - 2); ctx.lineTo(x + 8, y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x - 6, y + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 6, y + 16); ctx.stroke();
  },
  sun(ctx, x, y, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
      ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      ctx.stroke();
    }
  },
  zig(ctx, x, y, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(x - 21 + i * 7, y + (i % 2 === 0 ? -7 : 7));
    ctx.stroke();
  },
};
const STAMP_ICONS = { deer: '🦌', hand: '✋', human: '🧍', sun: '☀️', zig: '〰️' };

/**
 * Open the painting UI. `baseImage` (dataURL) restores an existing painting.
 * Resolves { png } — 256×128 dataURL.
 */
export function paintingGame(uiRoot, { title = S.act1.paintIntro, baseImage = null, wallTint = '#4c3a26' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'minigame';
    el.innerHTML = `
      <h3></h3>
      <div class="rock-frame">
        <canvas class="craft-canvas" width="256" height="128" style="width:min(84vw,560px);height:auto;image-rendering:pixelated"></canvas>
      </div>
      <div class="palette" id="pt-colors"></div>
      <div class="palette" id="pt-stamps"></div>
      <div class="craft-tools">
        <button class="btn small chip-btn" id="pt-undo">↩</button>
        <button class="btn primary mg-confirm fx-pop" id="pt-done">${S.ui.done}</button>
      </div>`;
    el.querySelector('h3').textContent = title;
    uiRoot.appendChild(el);

    const cv = el.querySelector('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    // rock wall base
    ctx.fillStyle = wallTint;
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${30 + Math.random() * 40}, ${24 + Math.random() * 30}, ${16 + Math.random() * 22}, 0.25)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    if (baseImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = baseImage;
    }

    let color = OCHRES[0], stamp = null, drawing = false, strokes = 0;
    const undoStack = [];

    const colorsEl = el.querySelector('#pt-colors');
    OCHRES.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'swatch swatch-big' + (i === 0 ? ' sel' : '');
      b.style.background = c;
      b.addEventListener('click', () => {
        color = c; stamp = null;
        el.querySelectorAll('.swatch').forEach((s) => s.classList.remove('sel'));
        el.querySelectorAll('.stamp-btn').forEach((s) => s.classList.remove('sel'));
        b.classList.add('sel');
      });
      colorsEl.appendChild(b);
    });
    const stampsEl = el.querySelector('#pt-stamps');
    Object.keys(STAMPS).forEach((k) => {
      const b = document.createElement('button');
      b.className = 'stamp-btn';
      b.textContent = STAMP_ICONS[k];
      b.addEventListener('click', () => {
        stamp = k;
        el.querySelectorAll('.stamp-btn').forEach((s) => s.classList.remove('sel'));
        b.classList.add('sel');
      });
      stampsEl.appendChild(b);
    });

    function pos(e) {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: ((p.clientX - r.left) / r.width) * 256, y: ((p.clientY - r.top) / r.height) * 128 };
    }
    function snapshot() {
      undoStack.push(ctx.getImageData(0, 0, 256, 128));
      if (undoStack.length > 12) undoStack.shift();
    }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      snapshot();
      const { x, y } = pos(e);
      strokes++;
      if (stamp) { STAMPS[stamp](ctx, x, y, color); return; }
      drawing = true;
      ctx.strokeStyle = color; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); // a tap leaves a dot
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y); ctx.stroke();
    });
    const stop = () => { drawing = false; };
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);

    el.querySelector('#pt-undo').addEventListener('click', () => {
      const im = undoStack.pop();
      if (im) { ctx.putImageData(im, 0, 0); strokes = Math.max(0, strokes - 1); }
    });
    el.querySelector('#pt-done').addEventListener('click', () => {
      if (strokes < 1) return; // paint something first
      const png = cv.toDataURL('image/png');
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
      el.remove();
      resolve({ png });
    });
  });
}

// Small mark editor for the pot stamp (96×96, single colour engraving).
export function markEditor(uiRoot, { title = S.act1.potMarkPrompt } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'minigame';
    el.innerHTML = `
      <h3></h3>
      <div class="pot-frame">
        <canvas class="craft-canvas" width="96" height="96" style="width:min(64vw,280px);height:auto;image-rendering:pixelated;background:#b4633e"></canvas>
      </div>
      <div class="craft-tools">
        <button class="btn small chip-btn" id="mk-clear">✕</button>
        <button class="btn primary mg-confirm fx-pop" id="mk-done">${S.ui.done}</button>
      </div>`;
    el.querySelector('h3').textContent = title;
    uiRoot.appendChild(el);
    const cv = el.querySelector('canvas');
    const ctx = cv.getContext('2d');
    function base() {
      ctx.clearRect(0, 0, 96, 96);
    }
    base();
    let drawing = false, strokes = 0;
    function pos(e) {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: ((p.clientX - r.left) / r.width) * 96, y: ((p.clientY - r.top) / r.height) * 96 };
    }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true; strokes++;
      const { x, y } = pos(e);
      ctx.strokeStyle = '#4a2416'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y); ctx.stroke();
    });
    const stop = () => { drawing = false; };
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);
    el.querySelector('#mk-clear').addEventListener('click', () => { base(); strokes = 0; });
    el.querySelector('#mk-done').addEventListener('click', () => {
      if (strokes < 1) return;
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
      el.remove();
      resolve({ mark: cv.toDataURL('image/png') });
    });
  });
}
