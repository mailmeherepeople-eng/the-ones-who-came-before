// The codex panel: the 📖 button in every act, and the only place in the game
// where a player can re-read something they were told earlier.
//
// Three visual states, and the middle one is the whole design:
//
//   ✓ known    retrieved from memory later on. Full colour.
//   ◌ pending  the line fired, but it has not been shown back yet. Dimmed,
//              readable, and openly labelled as unfinished.
//   blank      not met yet. Anonymous, so progress is visible without the
//              contents being spoiled.
//
// Nothing here is a score. A pending entry is not a failure, it is a thing the
// game still owes the player a chance to prove, and the wording has to carry
// that or the panel turns into a report card halfway through act 1.
//
// wirePanelClose comes from ui/report.js, which is act 3's file but has been a
// de facto shared helper since ui/container.js started importing it: it is the
// one close path that ✕, Escape, the backdrop and the panel button all funnel
// through, and duplicating it here would mean two of them to keep in step.
import { S } from '../strings.js';
import { codexList, codexCounts } from '../codex.js';
import { wirePanelClose } from './report.js';

// Returns a Promise that resolves on close; the promise also carries a
// .close() so the HUD button can toggle it shut, matching satchelPanel.
export function codexPanel(G) {
  let closeFn = null;
  const p = new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'bigpanel';
    const list = codexList();
    const met = list.filter((e) => e.taught);
    const { mastered, taught, total } = codexCounts();
    const unmet = Math.max(0, total - taught);

    const cardHTML = (e, i) => `
      <div class="codex-card ${e.mastered ? 'known' : 'pending'}"
           style="animation-delay:${Math.min(i * 45, 540)}ms">
        <div class="cx-icon">${e.icon}</div>
        <div class="cx-term"></div>
        <div class="cx-tells"></div>
        <div class="cx-state">${e.mastered ? `✓ ${esc(S.codexUI.known)}` : `◌ ${esc(S.codexUI.pending)}`}</div>
      </div>`;

    el.innerHTML = `<h2>📖 ${esc(S.codexUI.title)} (${mastered}/${taught})</h2>
      <div class="rep-body" style="text-align:center">${esc(S.codexUI.blurb)}</div>
      <div class="codex-grid">
        ${met.map(cardHTML).join('')}
        ${Array.from({ length: unmet }, (_, i) => `
          <div class="codex-card codex-blank" style="animation-delay:${Math.min((met.length + i) * 45, 540)}ms"></div>`).join('')}
      </div>
      ${met.length ? '' : `<div class="rep-body" style="text-align:center">${esc(S.codexUI.empty)}</div>`}
      <button class="btn primary chip-btn" style="display:block;margin:14px auto 0">${esc(S.ui.back)}</button>`;

    // textContent, not innerHTML: entry copy is authored prose and must never
    // be parsed as markup, whoever writes it later
    const cards = el.querySelectorAll('.codex-card:not(.codex-blank)');
    met.forEach((e, i) => {
      cards[i].querySelector('.cx-term').textContent = e.text?.term ?? e.id;
      cards[i].querySelector('.cx-tells').textContent = e.text?.tells ?? '';
    });

    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); }, { backdrop: true });
    closeFn = close;
    el.querySelector('.btn.primary').addEventListener('click', close);
    G.hud.root.appendChild(el);
  });
  p.close = () => closeFn?.();
  return p;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
