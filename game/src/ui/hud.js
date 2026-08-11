// HUD + dialog primitives every act uses: objective line, interact prompt,
// narrator boxes, full-screen cards, choice prompts, fader, satchel counter.
import { S } from '../strings.js';
import { Settings, SETTINGS } from '../settings.js';
import { Sound, voiceIdFor } from '../sound.js';

export class HUD {
  constructor(uiRoot) {
    this.root = uiRoot;
    this.input = null; // wired by main.js; lets dialogs consume input edges
    this.root.insertAdjacentHTML('beforeend', `
      <div id="hud-objective" class="fade-out"></div>
      <div id="hud-prompt" class="fade-out"></div>
      <div id="hud-hint" class="fade-out"></div>
      <button id="hud-codex" class="fade-out">📖 <span class="count">0/0</span></button>
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
    this.codexEl = this.root.querySelector('#hud-codex');
    this.zoomEl = this.root.querySelector('#hud-zoom');
    this.faderEl = this.root.querySelector('#fader');
    this._hintTimer = null;
    this.onSatchel = null;
    this.onCodex = null;
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
    this.codexEl.addEventListener('click', () => this.onCodex && this.onCodex());
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

  // Icon plus what the action actually IS ("Pick berries"), instead of a bare
  // emoji the player has to guess at.
  //
  // This is called EVERY FRAME from main.js while a target is in range, so it
  // rebuilds only when the content genuinely changes. Without the guard it
  // would thrash the DOM sixty times a second and restart the pill's entrance
  // animation on every one of them.
  showPrompt(icon, label) {
    // JSON, not a delimiter: concatenating needs a separator that cannot occur
    // in either half, and reaching for a control character is how a stray NUL
    // ends up in a source file (there was already one of those in strings.js).
    const key = JSON.stringify([icon ?? '', label ?? '']);
    if (key !== this._promptKey) {
      this._promptKey = key;
      this.promptEl.textContent = '';
      if (icon) {
        const i = document.createElement('span');
        i.className = 'p-icon';
        i.textContent = icon;
        this.promptEl.appendChild(i);
      }
      if (label) {
        const l = document.createElement('span');
        l.className = 'p-label';
        l.textContent = label;
        this.promptEl.appendChild(l);
      }
    }
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

  // The codex counter reads mastered/taught, not collected/total: a number that
  // only moves when the player has SHOWN a term back. See src/codex.js.
  setCodex(mastered, taught, visible = true) {
    this.codexEl.querySelector('.count').textContent = `${mastered}/${taught}`;
    this.codexEl.classList.toggle('fade-out', !visible);
  }

  showZoom(visible) { this.zoomEl.classList.toggle('fade-out', !visible); }

  // The ms argument used to be a WAIT only: the fade itself was pinned to the
  // 0.7s transition in style.css, so fadeIn(1800) faded in 700 ms and then sat
  // on a finished fade for another 1100. Driving transitionDuration from the
  // same argument makes every existing call site behave the way it already
  // reads. The forced reflow between the two writes is what stops the browser
  // batching them into one recalc, which would run the fade at the OLD
  // duration; it costs one layout per scene boundary, roughly twenty a game.
  _fade(on, ms) {
    this.faderEl.style.transitionDuration = `${ms}ms`;
    void this.faderEl.offsetHeight;
    this.faderEl.classList.toggle('on', on);
    return wait(ms);
  }

  async fadeOut(ms = 700) { await this._fade(true, ms); }
  async fadeIn(ms = 700) { await this._fade(false, ms); }

  // Narrator box. Resolves on tap/click/E, and ALSO when its voice clip ends.
  //
  // When a recording exists for this line the box narrates and then closes
  // itself, so pacing comes from how the line was read rather than from how
  // fast the player taps. A tap still skips ahead at any point. With no
  // recording the behaviour is exactly what it always was: wait for a tap.
  narrator(text, { tapLabel = S.ui.continue, voice = null } = {}) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'narrator';
      el.innerHTML = `<span></span><span class="tap">▼ ${tapLabel}</span>`;
      el.querySelector('span').textContent = text;
      const clip = Sound.playVoice(voice ?? voiceIdFor(text));
      if (clip) {
        // a voiced box closes on its own, so it needs to SHOW that it is
        // running or a player who looks away thinks it vanished on them
        el.classList.add('voiced');
        const bar = document.createElement('div');
        bar.className = 'narrator-progress';
        el.appendChild(bar);
        const tick = () => {
          if (!el.isConnected) return;
          const d = clip.el.duration;
          if (d) bar.style.transform = `scaleX(${Math.min(1, clip.el.currentTime / d)})`;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        clip.ended.then(() => done());
      }
      // announce and activate as a button for assistive tech. Kept a div on
      // purpose: `.narrator .tap` is styled for a span, and a real <button>
      // would drag in a UA background/border reset for no behavioural gain.
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      this.root.appendChild(el);
      let closed = false;
      let swallowClick = false;
      const openedAt = performance.now();
      const done = (e) => {
        // the 350 ms guard is a TIMESTAMP, not a delayed listener attach. With
        // the listeners going on late, a dispatched click aimed at the box
        // landed before anything was listening and was silently swallowed, so
        // automated runs (and some assistive tech) could not advance a beat.
        // the guard applies to INPUT only: a clip finishing must always close
        // the box, however soon after it opened
        if (closed || (e && performance.now() - openedAt < 350)) return;
        closed = true;
        e?.preventDefault?.();
        clip?.stop(); // tapping through cuts the narration with it
        removeEventListener('keydown', onKey);
        el.remove();
        this.input?.clearEdges(); // the dismissing press must not re-trigger interact/jump
        resolve();
      };
      const onKey = (e) => {
        if (e.repeat) return;
        if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') done(e);
      };
      // pointerdown is the real-finger path (no 300 ms tap delay); click also
      // covers dispatched clicks and AT activation. `closed` stops a real tap
      // from running both.
      el.addEventListener('pointerdown', (e) => {
        // A press that STARTS inside the guard window must not slip through on
        // release: click fires on pointer-up, so a hold begun at 100 ms and
        // released at 500 ms would otherwise pass a check made at release time.
        // Mark the gesture and swallow its click.
        if (performance.now() - openedAt < 350) { swallowClick = true; return; }
        done(e);
      });
      el.addEventListener('click', (e) => {
        if (swallowClick) { swallowClick = false; return; }
        done(e);
      });
      addEventListener('keydown', onKey);
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

  // full-screen card(s); each entry: string or {text, big, voice}
  //
  // Voiced exactly like the narrator box, and for the same reason: the game's
  // first four spoken lines are CARDS (the two opening cards, then Scene A's
  // two), so a card that could not narrate meant the recorded opening never
  // played. A card with a clip reads itself and closes when the clip ends; a
  // tap still skips at any point. With no recording the behaviour is what it
  // always was, wait for the button.
  async card(entries, { holdMs = 0 } = {}) {
    const list = Array.isArray(entries) ? entries : [entries];
    const el = document.createElement('div');
    el.className = 'card-overlay';
    this.root.appendChild(el);
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const t = typeof entry === 'string' ? { text: entry } : entry;
      el.innerHTML = `<div class="card-text ${t.big ? 'big' : ''}"></div>` +
        (holdMs ? '' : `<button class="btn primary">${S.ui.continue}</button>`) +
        `<div class="card-progress"></div>`;
      el.querySelector('.card-text').textContent = t.text;
      const clip = holdMs ? null : Sound.playVoice(t.voice ?? voiceIdFor(t.text));
      if (clip) {
        // warm the next line's file while this one is still talking, so the
        // gap between cards is not a download
        const next = list[i + 1];
        const nx = typeof next === 'string' ? { text: next } : next;
        if (nx) Sound.prefetchVoice(nx.voice ?? voiceIdFor(nx.text));
        const bar = el.querySelector('.card-progress');
        bar.classList.add('on');
        const tick = () => {
          if (!bar.isConnected) return;
          const d = clip.el.duration;
          if (d) bar.style.transform = `scaleX(${Math.min(1, clip.el.currentTime / d)})`;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      if (holdMs) {
        await wait(holdMs);
      } else {
        await new Promise((res) => {
          const btn = el.querySelector('button');
          let closed = false;
          const finish = () => {
            if (closed) return;
            closed = true;
            clip?.stop(); // tapping through cuts the narration with it
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
          clip?.ended.then(finish); // the clip has finished reading: move on
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
