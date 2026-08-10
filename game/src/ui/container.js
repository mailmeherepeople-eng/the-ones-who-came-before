// Container panel — the chest / store box view, and the player's own carry
// view. Two grids of square slots: what is in the box, and what is in your
// hands. Tap a slot to move it across.
//
// Reuses the existing panel furniture rather than inventing any: `.bigpanel`
// for the shell, `wirePanelClose` for the ✕ / Escape / backdrop trio (one
// idempotent close path), and the `.satchel-card` / `.satchel-ghost` filled and
// empty tile pair. The only new CSS is the square-slot variant, because those
// tiles are content-height rectangles and a grid of slots wants squares.
import { Inv, ITEMS, takeQuantity } from '../inventory.js';
import { S } from '../strings.js';
import { wirePanelClose } from './report.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function itemLabel(id) { return S.items[id] ?? id; }

// One slot. Filled and empty are the SAME square, differing only in depth: a
// raised parchment tile versus a recess cut into the box floor.
//
// They deliberately do NOT reuse .satchel-card / .satchel-ghost. Those are
// content-height rectangles and the ghost carries a hard `min-height: 118px`
// that outranked this panel's square sizing, so empty slots burst out of their
// grid cell and overlapped the row below. Owning both states here settles it.
function slotHTML(entry, i) {
  if (!entry) return '<div class="inv-slot inv-slot--empty" aria-hidden="true"></div>';
  const def = ITEMS[entry.id];
  const name = itemLabel(entry.id);
  // the count is in the accessible name too, or a screen reader announces
  // "Berries" whether you are holding one or twenty
  const label = entry.n > 1 ? `${name}, ${entry.n}` : name;
  return `<button type="button" class="inv-slot inv-slot--filled" data-id="${entry.id}"
      style="animation-delay:${Math.min(i * 40, 400)}ms" aria-label="${esc(label)}">
    <span class="inv-art" aria-hidden="true">${def?.emoji ?? '•'}</span>
    <span class="inv-name">${esc(name)}</span>
    ${entry.n > 1 ? `<span class="inv-count" aria-hidden="true">${entry.n}</span>` : ''}
  </button>`;
}

function gridHTML(entries, minSlots) {
  const pad = Math.max(0, minSlots - entries.length);
  return `<div class="inv-grid">
    ${entries.map(slotHTML).join('')}
    ${Array.from({ length: pad }, (_, i) => slotHTML(null, entries.length + i)).join('')}
  </div>`;
}

/**
 * Open a container against the player's inventory.
 *
 * @param {object}  G
 * @param {string}  which      'chest' | 'store'
 * @param {object} [opts]
 * @param {(id:string, n:number, dir:'take'|'put') => void} [opts.onMove]
 *        Fired after every successful move so the act script can react (light
 *        an FX, advance an objective) without polling.
 * @returns {Promise<void>} resolves when the panel closes. Carries `.close()`.
 */
export function openContainer(G, which, { onMove = null } = {}) {
  let closeFn = null;
  const p = new Promise((resolve) => {
    const isChest = which === 'chest';
    // 'player' is the carry view the HUD satchel button opens: one grid, no
    // second container to move things into, so it is a look not a transfer.
    const carryOnly = which === 'player';
    const el = document.createElement('div');
    el.className = 'bigpanel inv-panel';

    const render = () => {
      const held = Inv.contents('player');
      if (!carryOnly) {
        const boxed = Inv.contents(which);
        el.querySelector('.inv-box-grid').innerHTML = gridHTML(boxed, 8);
        el.querySelector('.inv-box-empty').style.display = boxed.length ? 'none' : '';
      }
      el.querySelector('.inv-you-grid').innerHTML = gridHTML(held, 4);
      el.querySelector('.inv-you-empty').style.display = held.length ? 'none' : '';
    };

    const title = carryOnly ? S.container.youTitle
      : isChest ? S.container.chestTitle : S.container.storeTitle;
    el.innerHTML = `
      <h2>${esc(title)}</h2>
      ${carryOnly ? '' : `
      <p class="inv-note">${esc(isChest ? S.container.chestNote : S.container.storeNote)}</p>
      <div class="inv-box-grid"></div>
      <p class="inv-empty inv-box-empty">${esc(S.container.empty)}</p>
      <h3 class="inv-sub">${esc(S.container.youTitle)}</h3>`}
      <div class="inv-you-grid"></div>
      <p class="inv-empty inv-you-empty">${esc(S.container.carryNothing)}</p>
      ${carryOnly ? '' : `<p class="inv-hint">${esc(S.container.takeHint)}</p>`}
      <button class="btn primary chip-btn inv-done">${esc(S.ui.done)}</button>`;

    // One delegated listener on the panel, so re-rendering the grids after a
    // move never has to re-wire anything.
    el.addEventListener('click', (e) => {
      if (carryOnly) return; // nothing to move it to
      const slot = e.target.closest?.('.inv-slot[data-id]');
      if (!slot || !el.contains(slot)) return;
      const id = slot.dataset.id;
      const fromYou = !!slot.closest('.inv-you-grid');
      const from = fromYou ? 'player' : which;
      const to = fromYou ? which : 'player';
      const moved = Inv.move(from, to, id, takeQuantity(id, Inv.count(from, id)));
      if (!moved) return;
      G.audio?.blip?.();
      render();
      onMove?.(id, moved, fromYou ? 'put' : 'take');
    });

    const finish = () => {
      el.remove();
      // The world was frozen while the panel was up; hand it back before the
      // caller's continuation runs, and swallow the closing tap so it cannot
      // land as an interact on the next frame.
      G.input?.setEnabled?.(true);
      G.input?.clearEdges?.();
      Inv.flush();
      resolve();
    };
    const close = wirePanelClose(G, el, finish, { backdrop: true });
    closeFn = close;
    el.querySelector('.inv-done').addEventListener('click', close);

    // Unlike every other panel in the game, this one FREEZES the player. The
    // others are read-only and it does not matter if you wander while they are
    // open; here you are reaching into a box two feet away, and walking off
    // mid-transfer reads as a bug.
    G.input?.setEnabled?.(false);
    G.hud.hidePrompt();
    G.hud.root.appendChild(el);
    render();
  });
  p.close = () => closeFn?.();
  return p;
}
