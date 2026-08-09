// The time dial (SKY mode). Internally years live in "timeline units" (t):
// t = year for BCE (negative), t = year − 1 for CE — so 1 BCE and 1 CE are
// ADJACENT integers. There is no year zero on this dial because there is no
// year zero (4.13); stepping across the boundary embodies add-then-subtract-1.
import { fmtYear, fmtNum } from '../constants.js';

export function yearToT(y) { return y < 0 ? y : y - 1; }
export function tToYear(t) { return t < 0 ? t : t + 1; }

export class Dial {
  constructor(uiRoot, {
    minYear, maxYear, year, yearsPerPx = 50,
    markers = [], onYear = null, onMarker = null,
  }) {
    this.minT = yearToT(minYear);
    this.maxT = yearToT(maxYear);
    this.t = yearToT(year);
    this.scale = yearsPerPx;
    this.markers = markers.map((m) => ({ ...m, t: yearToT(m.year), fired: false }));
    this.onYear = onYear;
    this.onMarker = onMarker;
    this.lockStep = null;
    this.face = 'gregorian';
    this.disabled = false;

    this.el = document.createElement('div');
    this.el.id = 'dial-wrap';
    this.el.innerHTML = `
      <div id="dial-year" class="dial-year-skin"></div>
      <div id="dial-face" class="dial-face-chip"></div>
      <div id="dial-track">
        <div id="dial-ticks"></div>
        <div id="dial-cursor"></div>
      </div>
      <div id="dial-lock"></div>`;
    uiRoot.appendChild(this.el);
    this.trackEl = this.el.querySelector('#dial-track');
    this.ticksEl = this.el.querySelector('#dial-ticks');
    this.yearEl = this.el.querySelector('#dial-year');
    this.faceEl = this.el.querySelector('#dial-face');
    this.lockEl = this.el.querySelector('#dial-lock');

    window.__dial = this; // debug handle (harmless in production)
    this._drag = null;
    this.animating = false;
    this.trackEl.addEventListener('pointerdown', (e) => {
      if (this.disabled || this.animating || this.lockStep !== null) return;
      this._drag = { x: e.clientX, t: this.t };
      try { this.trackEl.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    });
    this.trackEl.addEventListener('pointermove', (e) => {
      if (!this._drag || this.animating) return;
      const dx = e.clientX - this._drag.x;
      this.setT(this._drag.t - dx * this.scale);
    });
    const endDrag = () => { this._drag = null; };
    this.trackEl.addEventListener('pointerup', endDrag);
    this.trackEl.addEventListener('pointercancel', endDrag);

    this.render();
  }

  get year() { return tToYear(Math.round(this.t)); }

  setYear(y, fire = true) { this.setT(yearToT(y), fire); }

  setT(t, fire = true) {
    const prev = this.t;
    this.t = Math.max(this.minT, Math.min(this.maxT, t));
    this.render();
    if (fire && this.onYear && Math.round(prev) !== Math.round(this.t)) this.onYear(this.year);
    if (fire && this.onMarker && !this.animating) {
      const a = Math.min(prev, this.t), b = Math.max(prev, this.t);
      for (const m of this.markers) {
        if (m.t >= a && m.t <= b && !m.suppressed) this.onMarker(m);
      }
    }
  }

  setZoom(yearsPerPx) { this.scale = yearsPerPx; this.render(); }
  setRange(minYear, maxYear) {
    this.minT = yearToT(minYear); this.maxT = yearToT(maxYear);
    this.setT(this.t, false);
  }

  // step lock: null to unlock; otherwise {step, onStep} — shows ± buttons
  lock(step, { label = '' } = {}) {
    this.lockStep = step;
    this.lockEl.innerHTML = '';
    if (step === null) return;
    const back = document.createElement('button');
    back.className = 'btn small chip-btn';
    back.textContent = `−${fmtNum(step)}`;
    const fwd = document.createElement('button');
    fwd.className = 'btn small chip-btn';
    fwd.textContent = `+${fmtNum(step)}`;
    const lab = document.createElement('span');
    lab.style.cssText = 'align-self:center;font-size:12px;color:var(--ink-dim);padding:0 8px;';
    lab.textContent = label;
    this.lockEl.append(back, lab, fwd);
    this.stepCount = 0;
    back.addEventListener('click', () => { this.stepCount++; this.setT(this.t - step); });
    fwd.addEventListener('click', () => { this.stepCount++; this.setT(this.t + step); });
  }

  setFace(face) {
    this.face = face;
    this.render();
  }

  // animate to a year over ms; returns promise. Cancels any active drag and
  // mutes marker cards for the ride.
  animateTo(y, ms = 1200) {
    this._drag = null;
    this.animating = true;
    const t0 = this.t, t1 = yearToT(y);
    return new Promise((res) => {
      const start = performance.now();
      let done = false;
      const finish = () => { done = true; clearInterval(iv); this.animating = false; res(); };
      const advance = () => {
        if (done) return;
        const k = Math.min(1, (performance.now() - start) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.setT(t0 + (t1 - t0) * e);
        if (k >= 1) finish();
      };
      (function step() {
        if (done) return;
        advance();
        if (!done) requestAnimationFrame(step);
      })();
      // timer fallback: rAF starves in hidden tabs; beats await this promise
      const iv = setInterval(advance, 250);
    });
  }

  render() {
    const W = this.trackEl.clientWidth || innerWidth - 24;
    const half = W / 2;
    const tickStep = niceStep(this.scale * 28);
    const labelStep = tickStep * 4;
    const tMin = this.t - half * this.scale;
    const tMax = this.t + half * this.scale;

    let html = '';
    const first = Math.ceil(tMin / tickStep) * tickStep;
    for (let tt = first; tt <= tMax; tt += tickStep) {
      const x = half + (tt - this.t) / this.scale;
      const major = Math.round(tt) % labelStep === 0;
      html += `<div class="dial-tick ${major ? 'major' : ''}" style="left:${x.toFixed(1)}px"></div>`;
      if (major) {
        const yy = tToYear(Math.round(tt));
        html += `<div class="dial-tick-label" style="left:${x.toFixed(1)}px">${this.face === 'indian' ? '☾ ' : ''}${fmtYear(yy)}</div>`;
      }
    }
    for (const m of this.markers) {
      if (m.t < tMin - 40 * this.scale || m.t > tMax + 40 * this.scale) continue;
      const x = half + (m.t - this.t) / this.scale;
      html += `<div class="dial-marker ${Math.abs(m.t - this.t) < tickStep ? 'lit' : ''}" style="left:${x.toFixed(1)}px" data-year="${m.year}">
        <span class="flag">${m.icon}</span></div>`;
    }
    this.ticksEl.innerHTML = html;
    this.ticksEl.querySelectorAll('.dial-marker').forEach((el) => {
      el.addEventListener('click', () => {
        const y = Number(el.dataset.year);
        const m = this.markers.find((mm) => mm.year === y);
        if (m && !m.suppressed && this.onMarker) this.onMarker(m);
      });
    });

    this.yearEl.textContent = fmtYear(this.year);
    this.faceEl.textContent = this.face === 'indian'
      ? '☀️☾ INDIAN LUNI-SOLAR FACE — months follow the sun and moon'
      : 'GREGORIAN FACE — 12 months · 365 days';
  }

  show(on = true) { this.el.style.display = on ? '' : 'none'; }
  dispose() { this.el.remove(); }
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * pow) return m * pow;
  }
  return 10 * pow;
}
