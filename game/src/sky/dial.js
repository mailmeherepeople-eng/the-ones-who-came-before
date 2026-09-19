// The time dial (SKY mode). Internally years live in "timeline units" (t):
// t = year for BCE (negative), t = year − 1 for CE — so 1 BCE and 1 CE are
// ADJACENT integers. There is no year zero on this dial because there is no
// year zero (4.13); stepping across the boundary embodies add-then-subtract-1.
import { S } from '../strings.js';
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
      <div class="dial-date-row">
        <button class="dial-step" id="dial-earlier"><span aria-hidden="true">←</span><small></small></button>
        <button id="dial-year" class="dial-year-skin"></button>
        <button class="dial-step" id="dial-later"><span aria-hidden="true">→</span><small></small></button>
      </div>
      <div id="dial-status" role="status"></div>
      <div id="dial-face" class="dial-face-chip"></div>
      <div id="dial-track">
        <div id="dial-ticks"><div id="dial-ruler"></div><div id="dial-markers"></div></div>
        <div id="dial-cursor"></div>
      </div>
      <div id="dial-lock"></div>`;
    uiRoot.appendChild(this.el);
    this.trackEl = this.el.querySelector('#dial-track');
    this.ticksEl = this.el.querySelector('#dial-ticks');
    this.rulerEl = this.el.querySelector('#dial-ruler');
    this.markerEl = this.el.querySelector('#dial-markers'); this.markerNodes=new Map();
    this.yearEl = this.el.querySelector('#dial-year');
    this.faceEl = this.el.querySelector('#dial-face');
    this.lockEl = this.el.querySelector('#dial-lock');
    this.statusEl = this.el.querySelector('#dial-status');
    this.earlierEl = this.el.querySelector('#dial-earlier');
    this.laterEl = this.el.querySelector('#dial-later');
    this.earlierEl.onclick = () => this.nudge(-1);
    this.laterEl.onclick = () => this.nudge(1);

    window.__dial = this; // debug handle (harmless in production)
    this._drag = null;
    this.animating = false;
    this.trackEl.addEventListener('pointerdown', (e) => {
      if (!this.canInteract() || this.lockStep !== null || e.button !== 0) return;
      this.onInput?.();
      this.ticksEl.getAnimations().forEach(a => a.cancel());
      this._drag = { x: e.clientX, last: e.clientX, travel: 0, marker: e.target.closest('[data-year]')?.dataset.year };
      this.trackEl.classList.add('scrubbing');
      this.engage();
      this.statusEl.textContent = S.skyUI.dragging;
      try { this.trackEl.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    });
    this.trackEl.addEventListener('pointermove', (e) => {
      if (!this._drag || this.animating) return;
      const dx = e.clientX - this._drag.last;
      this._drag.last = e.clientX;
      this._drag.travel += Math.abs(dx);
      const before = this.t;
      this.setT(this.t - dx * this.scale * (e.shiftKey ? 0.08 : 1));
      this.soundYears(before);
    });
    const endDrag = e => {
      if (!this._drag) return;
      const drag = this._drag; this._drag = null;
      this.trackEl.classList.remove('scrubbing');
      if (e.type === 'pointerup' && drag.travel < 4 && drag.marker !== undefined) {
        const m = this.markers.find(m => m.year === Number(drag.marker));
        if (m) this.selectMarker(m);
      }
      this.settle();
    };
    this.trackEl.addEventListener('pointerup', endDrag);
    this.trackEl.addEventListener('pointercancel', endDrag);
    this.trackEl.addEventListener('lostpointercapture', endDrag);
    this.trackEl.addEventListener('click', e => {
      // Keyboard/assistive activation has no preceding pointer gesture.
      if (e.detail !== 0) return;
      const el = e.target.closest('[data-year]');
      const marker = el && this.markers.find(m => m.year === Number(el.dataset.year));
      if (marker) this.selectMarker(marker);
    });
    this.trackEl.addEventListener('wheel', e => {
      if (!this.canInteract() || this.lockStep !== null || e.ctrlKey) return;
      e.preventDefault(); this.onInput?.(); this.engage();
      const before = this.t, delta = (e.deltaX || e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1);
      this.setT(this.t + delta * (e.shiftKey ? .025 : this.scale*.35));
      this.soundYears(before); clearTimeout(this._wheelTimer);
      this._wheelTimer = setTimeout(() => this.settle(),140);
    },{passive:false});

    this.render();
    this._resize = new ResizeObserver(() => this.render());
    this._resize.observe(this.trackEl);
    this.trackEl.tabIndex = 0;
    this.trackEl.setAttribute('role', 'slider');
    this.trackEl.setAttribute('aria-label', S.revision.dialLabel);
    this.trackEl.addEventListener('keydown', e => {
      if (!this.canInteract() || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      this.nudge(e.key === 'ArrowRight' ? 1 : -1);
    });
  }

  canInteract() { return !this.disabled && !this.animating && !this.isBlocked?.(); }
  // A broad overview on a short phone would stack landmarks over the controls.
  // Keep its ruler precise; the date editor, playback and discovery shortcut
  // still reach the entire range. Desktop/tablet retain the requested overview.
  get scale() { return innerWidth <= 480 && innerHeight <= 650 ? Math.min(this.requestedScale,2) : this.requestedScale; }
  set scale(value) { this.requestedScale=value; }
  engage() {
    clearTimeout(this._engageTimer); this.el.classList.add('dial-engaged');
    this._engageTimer = setTimeout(() => { if (!this._drag) this.el.classList.remove('dial-engaged'); },600);
  }
  soundYears(previous,seconds = .04) {
    const crossed = Math.abs(Math.round(this.t)-Math.round(previous));
    if (crossed) this.onYearTick?.(crossed,seconds);
  }
  selectMarker(marker) {
    if (!this.canInteract() || this.lockStep !== null) return;
    this.onInput?.(); this.engage();
    this.setYear(marker.year,false); this.onMarker?.(marker, true); this.onYearTick?.(1,.04); this.settle();
  }
  nudge(direction) {
    if (!this.canInteract()) return;
    this.onInput?.();
    this.engage();
    const target = Math.max(this.minT,Math.min(this.maxT,Math.round(this.t) + direction * (this.lockStep ?? 1)));
    if (target === this.t) return;
    this.stepCount = (this.stepCount ?? 0) + 1;
    const previous = this.t;
    this.setT(target);
    this.soundYears(previous);
    this.settle(previous);
  }
  settle(previous = this.t) {
    this.engage();
    this.setT(Math.round(this.t), false);
    this.statusEl.textContent = this.lockStep === null ? S.skyUI.selected : S.skyUI.stepHint(fmtNum(this.lockStep));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const offset = (this.t - previous) / this.scale;
    this.ticksEl.getAnimations().forEach(a => a.cancel());
    if (Math.abs(offset) < 160) this.ticksEl.animate([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:320,easing:'cubic-bezier(.16,.9,.24,1)'});
    this.yearEl.getAnimations().forEach(a => a.cancel());
    this.yearEl.animate([{transform:'translateY(2px) scale(.985)'},{transform:'translateY(-.5px) scale(1.025)',offset:.55},{transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.25,1)'});
    this.trackEl.querySelector('#dial-cursor').animate([{boxShadow:'0 0 8px #e0a458'},{boxShadow:'0 0 22px 3px #e0a458',offset:.35},{boxShadow:'0 0 8px #e0a458'}],{duration:500});
  }

  get year() { return tToYear(Math.round(this.t)); }

  setYear(y, fire = true) { this.setT(yearToT(y), fire); }

  setT(t, fire = true) {
    const prev = this.t;
    this.t = Math.max(this.minT, Math.min(this.maxT, t));
    this.render();
    // A scripted move may suppress marker popups, but the world must always
    // follow the displayed year (including lesson resets and range clamps).
    if (this.onYear && Math.round(prev) !== Math.round(this.t)) this.onYear(this.year);
    if (fire && this.onMarker && !this.animating) {
      const a = Math.min(prev, this.t), b = Math.max(prev, this.t);
      const crossed = this.markers.filter(m => m.t >= a && m.t <= b && !m.suppressed);
      crossed.sort((m,n) => Math.abs(m.t-this.t)-Math.abs(n.t-this.t));
      if (crossed.length) this.onMarker(crossed[0]);
    }
  }

  setZoom(yearsPerPx) { this.scale = yearsPerPx; this.render(); }
  setRange(minYear, maxYear) {
    this.minT = yearToT(minYear); this.maxT = yearToT(maxYear);
    this.setT(this.t, false);
  }

  // step lock: null to unlock; otherwise {step, onStep} — shows ± buttons
  lock(step, { label = '' } = {}) {
    this.onInput?.();
    this.lockStep = step;
    this.lockEl.textContent = label;
    this.stepCount = 0;
    this.render();
    this.statusEl.textContent = step === null ? S.skyUI.selected : S.skyUI.stepHint(fmtNum(step));
  }

  setFace(face) {
    this.face = face;
    this.render();
  }

  // animate to a year over ms; returns promise. Cancels any active drag and
  // mutes marker cards for the ride.
  animateTo(y, ms = 1200) {
    this.onInput?.();
    this._drag = null;
    this.animating = true;
    const t0 = this.t, t1 = yearToT(y);
    return new Promise((res) => {
      const start = performance.now();
      let done = false;
      const finish = () => { done = true; clearInterval(iv); this.animating = false; this.render(); res(); };
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
    this.rulerEl.innerHTML = html;
    const lanes = [], visible = new Set();
    for (const m of [...this.markers].sort((a,b) => a.t-b.t)) {
      if (m.t < tMin - 44 * this.scale || m.t > tMax + 44 * this.scale) continue;
      const x = half + (m.t - this.t) / this.scale;
      let lane = lanes.findIndex(last => x-last >= 46);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = x; visible.add(m.year);
      let el=this.markerNodes.get(m.year);
      if(!el){
        el=document.createElement('button');el.type='button';el.className='dial-marker';el.dataset.year=m.year;
        if(m.image){const img=document.createElement('img');img.src=m.image;img.alt='';img.draggable=false;el.append(img);}
        else {const flag=document.createElement('span');flag.className='flag';flag.textContent=m.icon;el.append(flag);}
        el.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();this.selectMarker(m);if(!this.isBlocked?.())this.trackEl.focus();});
        this.markerEl.append(el);this.markerNodes.set(m.year,el);
      }
      el.style.left=x.toFixed(1)+'px';el.style.top=(4+lane*44)+'px';
      el.disabled=this.lockStep!==null||this.disabled||this.animating;
      el.classList.toggle('lit',Math.abs(m.t-this.t)<tickStep);
      el.classList.toggle('discovered',!!m.visited);
      el.classList.toggle('illustrated',!!m.image);
      const label=`${fmtYear(m.year)}: ${m.label}`;el.setAttribute('aria-label',label);el.title=label;
    }
    for(const [year,el] of this.markerNodes)if(!visible.has(year)){el.remove();this.markerNodes.delete(year);}
    this.trackEl.style.setProperty('--dial-track-height',Math.max(96,lanes.length*44+48)+'px');
    this.yearEl.textContent = fmtYear(this.year);
    this.yearEl.setAttribute('aria-label', S.skyUI.dateButton(fmtYear(this.year)));
    const step = this.lockStep === null ? S.skyUI.oneYear : S.skyUI.years(fmtNum(this.lockStep));
    this.earlierEl.querySelector('small').textContent = step;
    this.laterEl.querySelector('small').textContent = step;
    this.earlierEl.setAttribute('aria-label', S.skyUI.earlier(step));
    this.laterEl.setAttribute('aria-label', S.skyUI.later(step));
    this.earlierEl.disabled = this.disabled || this.animating || this.t <= this.minT;
    this.laterEl.disabled = this.disabled || this.animating || this.t >= this.maxT;
    this.yearEl.disabled = this.disabled || this.animating || this.lockStep !== null;
    this.trackEl.setAttribute('aria-valuemin', this.minT);
    this.trackEl.setAttribute('aria-valuemax', this.maxT);
    this.trackEl.setAttribute('aria-valuenow', Math.round(this.t));
    this.trackEl.setAttribute('aria-valuetext', fmtYear(this.year));
    this.faceEl.textContent = this.face === 'indian'
      ? S.skyUI.indian : S.skyUI.gregorian;
  }

  show(on = true) { this.el.style.display = on ? '' : 'none'; }
  dispose() { clearTimeout(this._engageTimer); clearTimeout(this._wheelTimer); this._resize.disconnect(); this.el.remove(); }
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * pow) return m * pow;
  }
  return 10 * pow;
}
