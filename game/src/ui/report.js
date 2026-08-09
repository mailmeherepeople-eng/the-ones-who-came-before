// Act 3 UI: Source Card popups, the claim board, the lab tray, and the final
// Site Report (the revision artifact the player made).
import { S } from '../strings.js';
import { Save, FIND_META } from '../save.js';
import { YEARS, gapYears, fmtYear, fmtNum } from '../constants.js';
import { SFX } from '../audio.js';

// ---------- source cards ----------

// photo: dataURL string, or {emoji:'🏺'}; returns the stored card
export function collectCard(G, key, { photo = null, emptySlot = false } = {}) {
  const meta = FIND_META[metaKey(key)] ?? FIND_META.pot;
  const text = S.act3.cards[key];
  const card = {
    recordId: key,
    title: text.title,
    tells: text.tells,
    photo,
    specialist: S.act3.specialists[meta.specialist],
    category: meta.category,
    emptySlot,
  };
  Save.addCard(card);
  G.hud?.setSatchel(Save.data.cards.length, true);
  return card;
}

function metaKey(key) {
  if (key.startsWith('oral')) return 'oral';
  if (key.startsWith('lab')) return 'labResult';
  return key;
}

export function showSourceCard(G, card, { layer = null } = {}) {
  SFX.discover();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'source-card card-treasure fx-pop' + (card.emptySlot ? ' empty-slot' : '');
    el.innerHTML = `
      ${photoHTML(card.photo)}
      <div class="sc-title"></div>
      <div class="sc-row sc-spec"></div>
      ${layer ? `<div class="sc-row"><span class="layer-chip">${esc(S.act3.findLayer)}: ${esc(layer)}</span></div>` : ''}
      <div class="sc-tells"></div>
      <div class="sc-cat"></div>
      <button class="btn primary mg-confirm" style="margin-top:12px">${S.ui.continue}</button>`;
    el.querySelector('.sc-title').textContent = card.emptySlot ? S.act3.basketSlot : card.title;
    el.querySelector('.sc-spec').textContent = `${S.act3.sourceCard} · ${card.specialist}`;
    el.querySelector('.sc-tells').textContent = card.tells;
    el.querySelector('.sc-cat').textContent = S.act3.sourceCategories[card.category];
    G.hud.root.appendChild(el);
    el.querySelector('button').addEventListener('click', () => {
      el.remove();
      G.input?.clearEdges?.();
      resolve();
    });
  });
}

function photoHTML(photo) {
  if (typeof photo === 'string') return `<img class="sc-photo" src="${photo}" alt="">`;
  const emoji = photo?.emoji ?? '🗿';
  return `<div class="sc-photo" style="display:flex;align-items:center;justify-content:center;font-size:64px">${emoji}</div>`;
}

// ---------- pot portrait ----------
// The excavated pot's card photo. The old photo was the maker's-mark PNG
// alone (a thin stroke arc) which read as a broken loading spinner. This
// draws the pot the player actually shaped: a filled silhouette from the
// saved 8-radius profile — closed path, clay fill, darker rim line.
// Returns a dataURL, or null when no profile was saved (caller falls back).
export function potPortrait(record) {
  const prof = record?.data?.profile;
  if (!Array.isArray(prof) || prof.length < 2) return null;
  const W = 192, H = 192;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return null;
  const CX = W / 2, TOP = 30, BOT = H - 22, SCALE = 76;
  const rowY = (i) => BOT - (i / (prof.length - 1)) * (BOT - TOP); // row 0 = base
  // closed silhouette: up the left flank, over the rim, down the right flank
  c.beginPath();
  c.moveTo(CX - prof[0] * SCALE, rowY(0));
  for (let i = 1; i < prof.length; i++) c.lineTo(CX - prof[i] * SCALE, rowY(i));
  for (let i = prof.length - 1; i >= 0; i--) c.lineTo(CX + prof[i] * SCALE, rowY(i));
  c.closePath();
  const grad = c.createLinearGradient(CX - SCALE, 0, CX + SCALE, 0);
  grad.addColorStop(0, '#8a5230');
  grad.addColorStop(0.42, '#c0834e');
  grad.addColorStop(1, '#7c4a28');
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = '#4a2c18';
  c.lineJoin = 'round';
  c.stroke();
  // mouth: a darker ellipse at the top row so the opening reads as an opening
  const iTop = prof.length - 1;
  const rTop = Math.max(6, prof[iTop] * SCALE);
  c.beginPath();
  c.ellipse(CX, rowY(iTop), rTop, Math.max(4, rTop * 0.22), 0, 0, Math.PI * 2);
  c.fillStyle = '#57331d';
  c.fill();
  c.stroke();
  // simple band decoration at the belly — echoes the fired-clay look
  let belly = 0;
  for (let i = 1; i < prof.length; i++) if (prof[i] > prof[belly]) belly = i;
  const by = rowY(belly);
  c.beginPath();
  c.moveTo(CX - prof[belly] * SCALE + 5, by);
  c.lineTo(CX + prof[belly] * SCALE - 5, by);
  c.lineWidth = 2.5;
  c.strokeStyle = 'rgba(74, 44, 24, 0.55)';
  c.stroke();
  return cv.toDataURL('image/png');
}

// ---------- big-panel close chrome ----------
// Every .bigpanel gets an always-visible ✕ pinned to its top-right (sticky,
// so it never scrolls out of view like the below-the-fold Back/Continue
// buttons did), plus Escape-to-close. Both funnel into the SAME close path
// the panel's own button uses; close() is idempotent so ✕ / Escape / button /
// backdrop can race safely. Optional dimmed backdrop closes on click.
// Returns close() so callers can wire their own buttons through it.
function wirePanelClose(G, el, onClose, { backdrop = false } = {}) {
  let dim = null;
  if (backdrop) {
    dim = document.createElement('div');
    dim.className = 'panel-dim';
    G.hud.root.appendChild(dim);
  }
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    removeEventListener('keydown', onKey);
    dim?.remove();
    onClose();
  };
  const onKey = (e) => {
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); close(); }
  };
  addEventListener('keydown', onKey);
  dim?.addEventListener('click', close);
  const wrap = document.createElement('div');
  wrap.className = 'panel-close-wrap';
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'panel-close';
  x.textContent = '✕'; // decorative glyph, not player-facing copy
  x.setAttribute('aria-label', S.ui.back);
  x.addEventListener('click', close);
  wrap.appendChild(x);
  el.prepend(wrap);
  return close;
}

// ---------- satchel: quick view of collected Source Cards ----------

// Returns a Promise that resolves on close; the promise also carries a
// .close() so the caller (the HUD basket button) can toggle it shut.
export function satchelPanel(G) {
  let closeFn = null;
  const p = new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'bigpanel';
    const cards = Save.data.cards;
    // total collectible cards = the card catalog itself (S.act3.cards is the
    // single source of truth collectCard draws text from; addCard dedupes by
    // recordId, so collected count can never exceed it)
    const total = Object.keys(S.act3.cards).length;
    const ghosts = Math.max(0, total - cards.length);
    el.innerHTML = `<h2>🧺 ${S.act3.satchelTitle} (${cards.length}/${total})</h2>
      <div class="rep-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
        ${cards.map((c, i) => `
          <div class="satchel-card" style="animation-delay:${Math.min(i * 45, 540)}ms">
            ${typeof c.photo === 'string'
              ? `<img src="${c.photo}" style="width:100%;height:70px;object-fit:contain;image-rendering:pixelated" alt="">`
              : `<div style="font-size:38px;line-height:70px">${c.photo?.emoji ?? '🗿'}</div>`}
            <div class="satchel-t">${esc(c.emptySlot ? S.act3.basketSlot : c.title)}</div>
            <div class="satchel-d">${esc(c.specialist)}</div>
          </div>`).join('')}
        ${Array.from({ length: ghosts }, (_, i) => `
          <div class="satchel-card satchel-ghost" style="animation-delay:${Math.min((cards.length + i) * 45, 540)}ms"></div>`).join('')}
      </div>
      <button class="btn primary chip-btn" style="display:block;margin:14px auto 0">${S.ui.back}</button>`;
    // escape hatch trio: ✕ (always visible), Escape key, dimmed-backdrop click
    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); }, { backdrop: true });
    closeFn = close;
    el.querySelector('.btn.primary').addEventListener('click', close);
    G.hud.root.appendChild(el);
  });
  p.close = () => closeFn?.();
  return p;
}

// ---------- claim board ----------

export function claimBoard(G) {
  return new Promise((resolve) => {
    const claims = [
      { id: 'settled', text: S.act3.claims.settled, correct: 'supported', result: S.act3.claimResult_settled, ev: ['🌾', '🏺', '🗣'] },
      { id: 'fort', text: S.act3.claims.fort, correct: 'contradicted', result: S.act3.claimResult_fort, ev: ['🗣', '🗣', '⛏'], hint: S.act3.claimHint_shared },
      { id: 'animals', text: S.act3.claims.animals, correct: 'supported', result: S.act3.claimResult_animals, ev: ['🖼', '🦴', '🗣'] },
    ];
    const el = document.createElement('div');
    el.className = 'bigpanel';
    el.innerHTML = `<h2>⚖️ ${S.act3.claimBoard}</h2>`;
    // ✕ / Escape reuse the same resolve path as the end-of-board Continue —
    // no panel may ever trap the player, even before all verdicts are picked
    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); });
    const painting = Save.getRecord('painting');

    for (const cl of claims) {
      const c = document.createElement('div');
      c.className = 'claim';
      c.innerHTML = `
        <div class="c-text"></div>
        <div class="c-evidence"></div>
        ${cl.hint ? `<div class="c-result" style="display:block;border:none;padding:0"></div>` : ''}
        <div class="c-verdicts">
          <button class="vbtn chip-btn" data-v="supported">${S.act3.verdicts.supported}</button>
          <button class="vbtn chip-btn" data-v="contradicted">${S.act3.verdicts.contradicted}</button>
          <button class="vbtn chip-btn" data-v="cantTell">${S.act3.verdicts.cantTell}</button>
        </div>
        <div class="c-result c-final" style="display:none"></div>`;
      c.querySelector('.c-text').textContent = cl.text;
      if (cl.hint) c.querySelector('.c-result').textContent = '💡 ' + cl.hint;
      const ev = c.querySelector('.c-evidence');
      for (const icon of cl.ev) {
        if (icon === '🖼' && painting?.data?.png) {
          ev.insertAdjacentHTML('beforeend', `<img src="${painting.data.png}" alt="">`);
        } else {
          ev.insertAdjacentHTML('beforeend', `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:#17100a;border-radius:6px;border:1px solid var(--panel-line);font-size:22px">${icon}</div>`);
        }
      }
      c.querySelectorAll('.vbtn').forEach((b) => {
        b.addEventListener('click', () => {
          if (cl.done) return;
          cl.done = true;
          cl.picked = b.dataset.v;
          Save.setClaim(cl.id, cl.picked);
          b.classList.add('sel-' + b.dataset.v);
          const fin = c.querySelector('.c-final');
          fin.style.display = 'block';
          const right = cl.picked === cl.correct;
          fin.textContent = (right ? '✓ ' : '✗ ') + cl.result;
          fin.style.color = right ? 'var(--accent2)' : 'var(--danger)';
          if (claims.every((x) => x.done)) {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'btn primary mg-confirm fx-pop';
            doneBtn.style.cssText = 'display:block;margin:12px auto 0';
            doneBtn.textContent = S.ui.continue;
            doneBtn.addEventListener('click', close);
            el.appendChild(doneBtn);
          }
        });
      });
      el.appendChild(c);
    }
    G.hud.root.appendChild(el);
  });
}

// ---------- lab ----------

export function labTray(G) {
  return new Promise((resolve) => {
    const samples = [
      { id: 'grain', icon: '🌾', label: S.act3.lab_grain, cardKey: 'labGrain' },
      { id: 'charcoal', icon: '🪵', label: S.act3.lab_charcoal, cardKey: 'labCharcoal' },
      { id: 'bone', icon: '🦴', label: S.act3.lab_bone, cardKey: 'labBone' },
    ];
    const el = document.createElement('div');
    el.className = 'bigpanel';
    el.innerHTML = `<h2>🔬 ${S.act3.lab}</h2>
      <div style="text-align:center;font-size:12.5px;color:var(--ink-dim);margin-bottom:12px">${S.act3.labNote}</div>
      <div id="lab-rows"></div>`;
    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); });
    const rows = el.querySelector('#lab-rows');
    let used = 0;
    for (const s of samples) {
      const row = document.createElement('div');
      row.className = 'claim lab-bench';
      row.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div class="lab-dish">${s.icon}</div>
          <button class="btn small chip-btn">${S.act3.lab} →</button>
          <div class="lab-out" style="font-size:13px;color:var(--ink-dim);flex:1"></div>
        </div>`;
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        btn.disabled = true;
        const out = row.querySelector('.lab-out');
        out.textContent = '…';
        setTimeout(() => {
          out.textContent = s.label;
          out.style.color = 'var(--accent2)';
          out.classList.add('fx-pop');
          Save.useLab(s.id);
          collectCard(G, s.cardKey, { photo: { emoji: s.icon } });
          used++;
          if (used === samples.length) {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'btn primary mg-confirm fx-pop';
            doneBtn.style.cssText = 'display:block;margin:12px auto 0';
            doneBtn.textContent = S.ui.continue;
            doneBtn.addEventListener('click', close);
            el.appendChild(doneBtn);
          }
        }, 900);
      });
      rows.appendChild(row);
    }
    G.hud.root.appendChild(el);
  });
}

// ---------- site report ----------

export function siteReport(G) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'bigpanel report-cert';
    el.id = 'report';
    const cards = Save.data.cards;
    const painting = Save.getRecord('painting');
    const pot = Save.getRecord('pot');

    const cardHTML = (c, i) => `
      <div class="rep-card pop-stagger" style="animation-delay:${Math.min(i * 45, 540)}ms">
        ${typeof c.photo === 'string' ? `<img src="${c.photo}" alt="">` : `<div style="font-size:44px;line-height:84px">${c.photo?.emoji ?? '🗿'}</div>`}
        <div class="t">${esc(c.emptySlot ? S.act3.basketSlot : c.title)}</div>
        <div class="d">${esc(c.specialist)} · ${esc(S.act3.sourceCategories[c.category] ?? '')}</div>
      </div>`;

    const E = S.act3.eraLabels;
    const eras = [
      [YEARS.SCENE_A_YEAR, E.band],
      [YEARS.ICE_AGE_END_BCE, E.iceEnd],
      [YEARS.SETTLEMENTS_BCE, E.settle],
      [YEARS.POTTERY_BCE, E.pottery],
      [YEARS.SCENE_D_YEAR, E.village],
      [YEARS.TODAY_CE, E.dig],
    ];

    el.innerHTML = `
      <h2>${S.act3.report}</h2>
      <div class="rep-body" style="text-align:center">${esc(S.act3.reportIntro)}</div>
      <div class="rep-sec">${esc(S.act3.reportWeFound)}</div>
      <div class="rep-grid">${cards.map(cardHTML).join('')}</div>
      <div class="rep-sec">${esc(S.act3.reportEmpty)}</div>
      <div class="rep-body">${esc(S.act3.basketSlotNote)}</div>
      <div class="rep-sec">${esc(S.act3.reportTimeline)}</div>
      <div class="strip">${eras.map(([y, t]) => `<span>${fmtYear(y)}, ${esc(t)}</span>`).join('')}</div>
      <div class="rep-sec">${esc(S.act3.reportSources)}</div>
      <div class="strip">
        <span>⛏ ${esc(S.act3.sourceCategories.archaeological)}</span>
        <span>🗣 ${esc(S.act3.sourceCategories.oral)}</span>
        <span>🖼 ${esc(S.act3.sourceCategories.artistic)}</span>
        <span>📜 ${esc(S.act3.sourceCategories.inscription)}: ${esc(S.act3.noneYet)}</span>
        <span>📖 ${esc(S.act3.sourceCategories.literary)}: ${esc(S.act3.noneYet)}</span>
        <span>🧭 ${esc(S.act3.sourceCategories.foreign)}: ${esc(S.act3.noneYet)}</span>
        <span>🔬 ${esc(S.act3.sourceCategories.scientific)}</span>
        <span>${esc(S.act3.recentMedia)}</span>
      </div>
      <div class="rep-body" style="margin-top:10px">${esc(S.act3.recentNote)}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">
        <button class="btn small chip-btn" id="rep-drill">${S.act3.drillMore}</button>
        <button class="btn primary mg-confirm" id="rep-done">${S.ui.continue}</button>
      </div>`;
    void pot;

    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); });
    el.querySelector('#rep-done').addEventListener('click', close);
    const drillBtn = el.querySelector('#rep-drill');
    drillBtn.addEventListener('click', async () => {
      drillBtn.disabled = true;
      await drillLoop(G, el);
      drillBtn.disabled = false;
    });
    G.hud.root.appendChild(el);
    void painting;
  });
}

// gap-formula practice generator (post-game toy; exam gold). Bails if the
// report has been closed so prompts cannot outlive it.
async function drillLoop(G, reportEl) {
  const bces = [YEARS.BUDDHA_BCE, YEARS.ASHOKA_BCE, YEARS.POTTERY_BCE, YEARS.SETTLEMENTS_BCE, YEARS.INDUS_SARASVATI_BCE];
  const { numberPrompt } = await import('./minigames.js');
  for (let i = 0; i < 3; i++) {
    if (!reportEl.isConnected) return;
    const a = bces[Math.floor(Math.random() * bces.length)];
    const b = YEARS.TODAY_CE;
    const expect = gapYears(a, b);
    const got = await numberPrompt(G.hud.root, { title: S.act3.drillQ(fmtYear(a), fmtYear(b)) });
    if (!reportEl.isConnected) return;
    G.hud.toast(got === expect ? '✓ ' + fmtNum(expect) : '✗ ' + fmtNum(expect), 2400);
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
