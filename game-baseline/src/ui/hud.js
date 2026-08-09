// HUD + dialog primitives every act uses: objective line, interact prompt,
// narrator boxes, full-screen cards, choice prompts, fader, satchel counter.
import { S } from '../strings.js';

export class HUD {
  constructor(uiRoot) {
    this.root = uiRoot;
    this.input = null; // wired by main.js; lets dialogs consume input edges
    this.root.insertAdjacentHTML('beforeend', `
      <div id="hud-objective" class="fade-out"></div>
      <div id="hud-prompt" class="fade-out"></div>
      <div id="hud-hint" class="fade-out"></div>
      <button id="hud-satchel" class="fade-out">🧺 <span class="count">0</span></button>
      <div id="hud-zoom" class="fade-out">
        <button class="btn" id="zoom-out-btn" title="${S.ui.zoomOutHint}">🔍−</button>
      </div>
      <div id="fader"></div>
    `);
    this.objectiveEl = this.root.querySelector('#hud-objective');
    this.promptEl = this.root.querySelector('#hud-prompt');
    this.hintEl = this.root.querySelector('#hud-hint');
    this.satchelEl = this.root.querySelector('#hud-satchel');
    this.zoomEl = this.root.querySelector('#hud-zoom');
    this.faderEl = this.root.querySelector('#fader');
    this._hintTimer = null;
    this.onSatchel = null;
    this.onZoomOut = null;
    // the interact prompt pill is itself a click/tap target (desktop mouse
    // users have no tap-to-interact): clicking it injects the same one-frame
    // interact edge the E key sets. pointerdown stops here so the press can
    // never double as a drag-look start on the canvas beneath.
    this.promptEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.promptEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.input?.injectInteract?.();
    });
    this.satchelEl.addEventListener('click', () => this.onSatchel && this.onSatchel());
    this.root.querySelector('#zoom-out-btn').addEventListener('click', () => this.onZoomOut && this.onZoomOut());
  }

  setObjective(text) {
    // objective changes mark beat/act boundaries — stale hints die here so
    // nothing like the dial hint can linger into a later act
    this.hideHint();
    if (!text) { this.objectiveEl.classList.add('fade-out'); return; }
    this.objectiveEl.textContent = text;
    this.objectiveEl.classList.remove('fade-out');
  }

  showPrompt(text) {
    this.promptEl.textContent = text;
    this.promptEl.classList.remove('fade-out');
  }
  hidePrompt() { this.promptEl.classList.add('fade-out'); }

  // hint always REPLACES the current hint (single #hud-hint element, timer
  // reset) — hints never stack
  hint(text, ms = 4200) {
    // touch devices must never see the desktop keyboard hint
    if (this.input?.isTouch && text === S.ui.desktopHint) text = S.ui.joystickHint;
    this.hintEl.textContent = text;
    this.hintEl.classList.remove('fade-out');
    clearTimeout(this._hintTimer);
    if (ms) this._hintTimer = setTimeout(() => this.hintEl.classList.add('fade-out'), ms);
  }

  hideHint() {
    clearTimeout(this._hintTimer);
    this.hintEl.classList.add('fade-out');
  }

  setSatchel(count, visible = true) {
    this.satchelEl.querySelector('.count').textContent = count;
    this.satchelEl.classList.toggle('fade-out', !visible);
  }

  showZoom(visible) { this.zoomEl.classList.toggle('fade-out', !visible); }

  async fadeOut(ms = 700) {
    this.faderEl.classList.add('on');
    await wait(ms);
  }
  async fadeIn(ms = 700) {
    this.faderEl.classList.remove('on');
    await wait(ms);
  }

  // narrator box; resolves on tap/click/E
  narrator(text, { tapLabel = S.ui.continue } = {}) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'narrator';
      el.innerHTML = `<span></span><span class="tap">▼ ${tapLabel}</span>`;
      el.querySelector('span').textContent = text;
      this.root.appendChild(el);
      const done = (e) => {
        e?.preventDefault?.();
        removeEventListener('keydown', onKey);
        el.remove();
        this.input?.clearEdges(); // the dismissing press must not re-trigger interact/jump
        resolve();
      };
      const onKey = (e) => {
        if (e.repeat) return;
        if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') done(e);
      };
      setTimeout(() => {
        el.addEventListener('pointerdown', done);
        addEventListener('keydown', onKey);
      }, 350); // guard against the tap that opened it
    });
  }

  // transient narrator that auto-fades (no tap needed)
  toast(text, ms = 4600) {
    const el = document.createElement('div');
    el.className = 'narrator';
    el.innerHTML = `<span></span>`;
    el.querySelector('span').textContent = text;
    this.root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.6s'; }, ms - 600);
    setTimeout(() => el.remove(), ms);
  }

  // full-screen card(s); each entry: string or {text, big}
  async card(entries, { holdMs = 0 } = {}) {
    const list = Array.isArray(entries) ? entries : [entries];
    const el = document.createElement('div');
    el.className = 'card-overlay';
    this.root.appendChild(el);
    for (const entry of list) {
      const t = typeof entry === 'string' ? { text: entry } : entry;
      el.innerHTML = `<div class="card-text ${t.big ? 'big' : ''}"></div>` +
        (holdMs ? '' : `<button class="btn primary">${S.ui.continue}</button>`);
      el.querySelector('.card-text').textContent = t.text;
      if (holdMs) {
        await wait(holdMs);
      } else {
        await new Promise((res) => {
          const btn = el.querySelector('button');
          const finish = () => {
            removeEventListener('keydown', onKey);
            this.input?.clearEdges();
            res();
          };
          btn.addEventListener('click', finish, { once: true });
          const onKey = (e) => {
            if (e.repeat) return;
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') finish();
          };
          addEventListener('keydown', onKey);
        });
      }
    }
    el.remove();
  }

  // choice prompt; returns chosen index
  choice(title, options) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'choice-box';
      el.innerHTML = `<h3></h3>`;
      el.querySelector('h3').textContent = title;
      options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = opt;
        b.addEventListener('click', () => { el.remove(); resolve(i); });
        el.appendChild(b);
      });
      this.root.appendChild(el);
    });
  }
}

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
