// HUD + dialog primitives every act uses: objective line, interact prompt,
// narrator boxes, full-screen cards, choice prompts, fader, satchel counter.
import { S } from '../strings.js';
import { Settings, SETTINGS } from '../settings.js';

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
      <button id="hud-settings" title="${S.ui.settings}" aria-label="${S.ui.settings}">⚙</button>
      <div id="hud-actions"></div>
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
    this.settingsBtn = this.root.querySelector('#hud-settings');
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this._settingsPanel = null;
    this.actionsEl = this.root.querySelector('#hud-actions');
  }

  // Right-hand action rail: big labelled buttons stacked above the jump
  // control, for verbs the interact pill cannot express (Take Aim, Fire).
  // Thumb-reachable on a phone and clickable on desktop, so neither platform
  // needs a special case.
  //
  // setActions([]) or setActions(null) clears the rail.
  setActions(actions) {
    this.actionsEl.innerHTML = '';
    if (!actions || !actions.length) { this.actionsEl.classList.remove('on'); return; }
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'act-btn' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      // pointerdown must not reach the canvas, or pressing Fire also starts a
      // drag-look and the shot pulls off target
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); a.onClick?.(); });
      this.actionsEl.appendChild(b);
    }
    this.actionsEl.classList.add('on');
  }

  clearActions() { this.setActions(null); }

  // Settings panel. Built from the SETTINGS list so a new option is one entry
  // in settings.js plus one string, never another block of DOM here.
  openSettings() {
    if (this._settingsPanel) return;
    const el = document.createElement('div');
    el.className = 'panel-dim';
    el.innerHTML = `
      <div class="settings-panel" role="dialog" aria-label="${S.ui.settingsTitle}">
        <h3>${S.ui.settingsTitle}</h3>
        <div class="settings-list"></div>
        <button class="btn primary set-close">${S.ui.close}</button>
      </div>`;
    const list = el.querySelector('.settings-list');
    for (const s of SETTINGS) {
      const row = document.createElement('label');
      row.className = 'settings-row';
      row.innerHTML = `
        <input type="checkbox">
        <span class="settings-text"><span class="settings-label"></span><span class="settings-note"></span></span>`;
      const box = row.querySelector('input');
      box.checked = !!Settings.get(s.id);
      row.querySelector('.settings-label').textContent = s.label();
      row.querySelector('.settings-note').textContent = s.note ? s.note() : '';
      box.addEventListener('change', () => Settings.set(s.id, box.checked));
      list.appendChild(row);
    }
    const close = () => {
      el.remove();
      this._settingsPanel = null;
      this.input?.clearEdges(); // the closing tap must not also interact
    };
    el.querySelector('.set-close').addEventListener('click', close);
    // click the dimmed backdrop (but not the panel) to dismiss
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
    addEventListener('keydown', function onEsc(e) {
      if (e.code !== 'Escape') return;
      removeEventListener('keydown', onEsc);
      close();
    });
    this.root.appendChild(el);
    this._settingsPanel = el;
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
