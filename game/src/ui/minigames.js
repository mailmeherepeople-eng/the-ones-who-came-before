// Shared timing-ring minigame: a marker sweeps a circle; tap when it's inside
// the lit zone. Used by hunt (draw/release), knapping (3 strikes), bead
// drilling (hold-through), and fishing (reaction tap).
import { S } from '../strings.js';
import { SFX } from '../audio.js';

export function timingGame(uiRoot, {
  title,
  rounds = 3,
  speed = 1.6, // radians/sec multiplier
  zone = 0.5, // radians of success arc
  stepText = null, // (round) => string shown after each success
  failText = null,
  mode = 'tap', // 'tap' | 'react' (zone appears after random delay)
} = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'minigame';
    el.innerHTML = `
      <h3></h3>
      <div class="stage mg-stage-frame">
        <svg class="timing-ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="82" fill="none" stroke="#3a2c19" stroke-width="14"/>
          <path id="tg-zone" fill="none" stroke="#7fb069" stroke-width="14" stroke-linecap="round"/>
          <line id="tg-needle" x1="100" y1="100" x2="100" y2="22" stroke="#e0a458" stroke-width="5" stroke-linecap="round"/>
          <circle cx="100" cy="100" r="10" fill="#e0a458"/>
        </svg>
      </div>
      <div id="tg-msg" style="min-height:24px;font-size:14px;color:var(--ink-dim)"></div>
      <div id="tg-dots" class="mg-dots"></div>
    `;
    el.querySelector('h3').textContent = title;
    uiRoot.appendChild(el);

    const zonePath = el.querySelector('#tg-zone');
    const needle = el.querySelector('#tg-needle');
    const msg = el.querySelector('#tg-msg');
    const dots = el.querySelector('#tg-dots');

    let round = 0, angle = 0, zoneStart = Math.random() * Math.PI * 2;
    let running = true, acceptInput = mode !== 'react';
    let reactTimer = null;
    let raf;

    let zoneTimer = null;
    if (mode === 'react') {
      zonePath.style.opacity = '0';
      scheduleReact();
    }
    function scheduleReact() {
      acceptInput = false;
      clearTimeout(zoneTimer);
      zonePath.style.opacity = '0';
      msg.textContent = '…';
      reactTimer = setTimeout(() => {
        acceptInput = true;
        zoneStart = angle + Math.PI * 0.4; // zone just ahead of the needle
        drawZone();
        zonePath.style.opacity = '1';
        msg.textContent = '';
        // the window stays open ~3s — early taps are misses, not resets
        zoneTimer = setTimeout(() => { if (running) scheduleReact(); }, 3000);
      }, 900 + Math.random() * 1800);
    }

    function drawZone() {
      const a0 = zoneStart, a1 = zoneStart + zone;
      const x0 = 100 + 82 * Math.sin(a0), y0 = 100 - 82 * Math.cos(a0);
      const x1 = 100 + 82 * Math.sin(a1), y1 = 100 - 82 * Math.cos(a1);
      zonePath.setAttribute('d', `M ${x0} ${y0} A 82 82 0 ${zone > Math.PI ? 1 : 0} 1 ${x1} ${y1}`);
    }
    function renderDots() {
      dots.textContent = '●'.repeat(round) + '○'.repeat(Math.max(0, rounds - round));
    }
    renderDots(); drawZone();

    let last = performance.now();
    function loop(t) {
      if (!running) return;
      const dt = (t - last) / 1000; last = t;
      angle += dt * speed * Math.PI;
      needle.setAttribute('x2', 100 + 78 * Math.sin(angle));
      needle.setAttribute('y2', 100 - 78 * Math.cos(angle));
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function inZone() {
      const a = ((angle - zoneStart) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      return a >= 0 && a <= zone;
    }

    function onTap(e) {
      e.preventDefault?.();
      if (!running || !acceptInput) return;
      if (inZone()) {
        round++;
        SFX.blip();
        clearTimeout(zoneTimer);
        renderDots();
        flash(el.querySelector('.stage'), 'fx-flash');
        msg.textContent = stepText ? stepText(round - 1) : '✓';
        msg.style.color = 'var(--accent2)';
        if (round >= rounds) return finish(true);
        zoneStart = Math.random() * Math.PI * 2;
        zone *= 0.86; // tighten a little
        drawZone();
        if (mode === 'react') scheduleReact();
      } else {
        flash(el.querySelector('.stage'), 'mg-shake');
        msg.textContent = failText ?? S.act1.knapFail;
        msg.style.color = 'var(--danger)';
        // misses do NOT reset the window — the zone stays until its timer ends
      }
    }
    el.addEventListener('pointerdown', onTap);
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') onTap(e); };
    addEventListener('keydown', onKey);

    function finish(ok) {
      running = false;
      if (ok) SFX.success();
      flash(el.querySelector('.stage'), ok ? 'fx-flash' : 'mg-shake');
      cancelAnimationFrame(raf);
      clearTimeout(reactTimer);
      removeEventListener('keydown', onKey);
      setTimeout(() => { el.remove(); resolve(ok); }, 650);
    }
  });
}

// restart a one-shot CSS animation class (purely presentational)
function flash(elm, cls) {
  if (!elm) return;
  elm.classList.remove(cls);
  void elm.offsetWidth; // reflow so the animation can replay
  elm.classList.add(cls);
}

// Read a typed answer forgivingly. The game prints these numbers WITH thousands
// separators ("2,583 years"), so a child copying the format back is the normal
// case, not an edge case. `type="number"` cannot help here: a browser blanks
// `value` the moment the text is not a bare number, so the comma version came
// back as an empty string and scored as wrong with nothing to explain it. The
// fields are `type="text" inputmode="numeric"` instead, which still raises the
// numeric keypad on a phone, and separators and stray spaces are stripped here.
// Returns NaN when there is no digit at all.
function readNumber(input) {
  const cleaned = String(input.value).replace(/[\s,._]/g, '');
  return /^-?\d+$/.test(cleaned) ? parseInt(cleaned, 10) : NaN;
}

// 30-second countdown challenge overlay (P2 find-zero, P3 count-the-gap).
// Resolves { expired:true } when the clock runs out, { expired:false, gaveUp:true }
// on the give-up button, or { expired:false, won:true } when `answer` was passed
// and the player typed it before time. Omit `answer` for a challenge with no win
// condition (P2's find-zero is a trick question: running out IS the lesson).
export function countdownChallenge(uiRoot, {
  text, seconds = 30, giveUpLabel = null, answer = null, answerLabel = '',
}) {
  if (new URLSearchParams(location.search).has('fast')) seconds = 3; // test rig only
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'cd-wrap';
    el.innerHTML = `
      <div class="cd-card fx-pop">
        <div id="cd-text" class="cd-text"></div>
        <div id="cd-t" class="ember-pill">${seconds}</div>
        ${answer !== null ? `
        <div id="cd-answer" style="display:flex;gap:6px;margin-top:10px">
          <input type="text" inputmode="numeric" class="num-input" id="cd-in" style="flex:1">
          <button class="btn small chip-btn" id="cd-ok">${S.ui.done}</button>
        </div>` : ''}
        ${giveUpLabel ? `<button class="btn small chip-btn" id="cd-give" style="margin-top:8px">${giveUpLabel}</button>` : ''}
      </div>`;
    el.querySelector('#cd-text').textContent = text;
    if (answerLabel) el.querySelector('#cd-in')?.setAttribute('placeholder', answerLabel);
    uiRoot.appendChild(el);
    let s = seconds;
    const iv = setInterval(() => {
      s--;
      el.querySelector('#cd-t').textContent = s;
      if (s <= 0) { cleanup(); resolve({ expired: true }); }
    }, 1000);
    el.querySelector('#cd-give')?.addEventListener('click', () => { cleanup(); resolve({ expired: false, gaveUp: true }); });
    // deliberately NOT autofocused: on a phone the keyboard would cover the
    // dial the player is supposed to be counting on. A wrong answer only
    // flags the field, so the clock stays the only thing that ends this.
    const input = el.querySelector('#cd-in');
    if (input) {
      const submit = () => {
        const v = readNumber(input);
        if (v === answer) { cleanup(); resolve({ expired: false, won: true }); return; }
        input.style.borderColor = 'var(--danger)';
        input.select?.();
      };
      el.querySelector('#cd-ok').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      input.addEventListener('input', () => { input.style.borderColor = ''; });
    }
    function cleanup() { clearInterval(iv); el.remove(); }
    el.done = (result) => { cleanup(); resolve(result); };
  });
}

// numeric answer prompt (gap formula practice)
export function numberPrompt(uiRoot, { title, placeholder = '' }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'choice-box';
    el.innerHTML = `
      <h3></h3>
      <input type="text" inputmode="numeric" placeholder="${placeholder}" class="num-input">
      <button class="btn primary mg-confirm" style="width:100%;margin-top:10px">${S.ui.done}</button>`;
    el.querySelector('h3').textContent = title;
    uiRoot.appendChild(el);
    const input = el.querySelector('input');
    setTimeout(() => input.focus(), 60);
    const submit = () => {
      const v = readNumber(input); // same separator tolerance as the countdown
      if (Number.isNaN(v)) { input.style.borderColor = 'var(--danger)'; return; }
      el.remove(); resolve(v);
    };
    el.querySelector('button').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });
}
