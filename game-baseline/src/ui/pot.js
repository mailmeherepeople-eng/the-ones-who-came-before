// Pot shaping: 3 preset silhouettes + freeform tweak (drag the profile), then
// the player's own mark (design doc A1-D2). Returns { shape, profile, mark }.
import { S } from '../strings.js';
import { markEditor } from './paint.js';

const PRESETS = [
  [0.34, 0.52, 0.64, 0.66, 0.6, 0.46, 0.34, 0.4], // round-belly
  [0.4, 0.5, 0.54, 0.5, 0.42, 0.34, 0.3, 0.34], // tall-neck
  [0.3, 0.42, 0.52, 0.6, 0.66, 0.68, 0.62, 0.7], // wide-mouth
];

export async function potGame(uiRoot) {
  const shaped = await shapeStep(uiRoot);
  const { mark } = await markEditor(uiRoot);
  return { ...shaped, mark };
}

function shapeStep(uiRoot) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'minigame';
    el.innerHTML = `
      <h3></h3>
      <div class="palette" id="pot-presets"></div>
      <div class="pot-frame">
        <canvas class="craft-canvas" width="240" height="240" style="width:min(70vw,300px);height:auto;background:#241a10"></canvas>
        <div class="wheel-hint"></div>
      </div>
      <div class="mg-hint">drag the sides to pull the clay</div>
      <button class="btn primary mg-confirm fx-pop" id="pot-done">${S.ui.done}</button>`;
    el.querySelector('h3').textContent = S.act1.potIntro;
    uiRoot.appendChild(el);

    let shape = 0;
    let profile = [...PRESETS[0]];
    const cv = el.querySelector('canvas');
    const ctx = cv.getContext('2d');

    const presetsEl = el.querySelector('#pot-presets');
    S.act1.potShapes.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'btn small chip-btn' + (i === 0 ? ' primary' : '');
      b.textContent = name;
      b.addEventListener('click', () => {
        shape = i;
        profile = [...PRESETS[i]];
        presetsEl.querySelectorAll('.btn').forEach((x, j) => x.classList.toggle('primary', j === i));
        draw();
      });
      presetsEl.appendChild(b);
    });

    const CX = 120, TOP = 22, BOT = 218, ROWS = profile.length;
    function rowY(i) { return BOT - (i / (ROWS - 1)) * (BOT - TOP); }

    function draw() {
      ctx.clearRect(0, 0, 240, 240);
      // wheel
      ctx.fillStyle = '#3a2c19';
      ctx.fillRect(40, 224, 160, 8);
      // clay silhouette
      ctx.fillStyle = '#b4633e';
      ctx.beginPath();
      ctx.moveTo(CX - profile[0] * 130, rowY(0));
      for (let i = 1; i < ROWS; i++) ctx.lineTo(CX - profile[i] * 130, rowY(i));
      for (let i = ROWS - 1; i >= 0; i--) ctx.lineTo(CX + profile[i] * 130, rowY(i));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8d4c30';
      ctx.lineWidth = 3;
      ctx.stroke();
      // throwing lines
      ctx.strokeStyle = 'rgba(141,76,48,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(CX - profile[i] * 130 + 4, rowY(i));
        ctx.lineTo(CX + profile[i] * 130 - 4, rowY(i));
        ctx.stroke();
      }
      // chunky drag handles on each rim row (visual invitation to pull)
      for (let i = 0; i < ROWS; i++) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(CX + s * profile[i] * 130, rowY(i), 5, 0, Math.PI * 2);
          ctx.fillStyle = '#d98a52';
          ctx.fill();
          ctx.strokeStyle = '#3a2115';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    draw();

    let dragging = false;
    function apply(e) {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      const x = ((p.clientX - r.left) / r.width) * 240;
      const y = ((p.clientY - r.top) / r.height) * 240;
      const fi = (BOT - y) / (BOT - TOP) * (ROWS - 1);
      const i = Math.round(Math.max(0, Math.min(ROWS - 1, fi)));
      const radius = Math.max(0.14, Math.min(0.72, Math.abs(x - CX) / 130));
      profile[i] = radius;
      // smooth neighbours a touch so the pot stays potty
      if (i > 0) profile[i - 1] = profile[i - 1] * 0.7 + radius * 0.3;
      if (i < ROWS - 1) profile[i + 1] = profile[i + 1] * 0.7 + radius * 0.3;
      draw();
    }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); dragging = true; apply(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) apply(e); });
    const stop = () => { dragging = false; };
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);

    el.querySelector('#pot-done').addEventListener('click', () => {
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
      el.remove();
      resolve({ shape, profile: profile.map((v) => Math.round(v * 100) / 100) });
    });
  });
}
