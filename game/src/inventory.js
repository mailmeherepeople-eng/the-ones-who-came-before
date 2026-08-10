// Inventory — the mechanical form of Act 1's one real lesson.
//
// The chapter's point is that an early band owned almost nothing personally:
// tools belonged to the group and food was shared. Until now that was a single
// narrator line and the player's hands were a one-slot visual (`player.equip`,
// which is explicitly cosmetic). This module makes it a rule you have to obey:
//
//   TOOL    — borrowed from the community chest, and it has to go back.
//   HARVEST — gathered by you, and it goes into the store box for everyone.
//
// You carry a tool AND a harvest at the same time, which is the whole reason
// the bear beat works: you are still holding the band's bow when it turns up,
// so putting it back afterwards is a thing you DO, not a thing you are told.
//
// Deliberately small. No slots-by-index, no drag and drop, no weight. A
// container is `{ itemId: count }` and that is the entire data model.
import { Save } from './save.js';

// Item table. `kind` decides which container an item belongs in and how a tap
// in the container panel behaves (see TAKE_WHOLE_STACK below). `equip` names
// the visual the player model should show while the item is held, and must be
// a kind `player.equip()` already understands.
//
// Display names are NOT here — they live in `S.items` in strings.js, because
// every user-visible string does. Look them up with `itemLabel()`.
export const ITEMS = {
  // tools, lent by the community chest
  basket: { kind: 'tool', emoji: '🧺', equip: 'basket' },
  bow: { kind: 'tool', emoji: '🏹', equip: 'bow' },
  rod: { kind: 'tool', emoji: '🎣', equip: 'rod' },
  spear: { kind: 'tool', emoji: '🔱', equip: 'spear' },
  waterskin: { kind: 'tool', emoji: '🫙', equip: 'waterskin' },
  // harvests, bound for the store box
  berry: { kind: 'harvest', emoji: '🫐' },
  meat: { kind: 'harvest', emoji: '🍖', equip: 'meat' },
  fish: { kind: 'harvest', emoji: '🐟' },
  firewood: { kind: 'harvest', emoji: '🪵', equip: 'firewood' },
};

export const CONTAINERS = ['player', 'chest', 'store'];

function fresh() {
  return { player: {}, chest: {}, store: {} };
}

// Save.load() merges `{...FRESH(), ...parsed}`, so adding `inventory` to the
// save's FRESH() backfills it into existing saves with no version bump. This
// guard covers the other direction: a save written before that change.
function bag(where) {
  const inv = Save.data.inventory || (Save.data.inventory = fresh());
  return inv[where] || (inv[where] = {});
}

// Persisting is debounced. Berries are pickable across the whole map now, so a
// gathering run fires many small changes, and Save.persist() stringifies the
// entire save including the painting dataURL. Once per burst is plenty; the
// beat checkpoints that matter call flush() themselves.
let dirtyT = null;
function touch() {
  for (const fn of listeners) fn();
  if (dirtyT) return;
  dirtyT = setTimeout(() => { dirtyT = null; Save.persist(); }, 500);
}

const listeners = new Set();

export const Inv = {
  count(where, id) { return bag(where)[id] || 0; },

  has(where, id, n = 1) { return this.count(where, id) >= n; },

  add(where, id, n = 1) {
    if (!ITEMS[id] || n <= 0) return 0;
    const b = bag(where);
    b[id] = (b[id] || 0) + n;
    touch();
    return n;
  },

  // Removes up to n and returns how many actually came out, so a caller can
  // never conjure items by asking for more than exists.
  take(where, id, n = 1) {
    const b = bag(where);
    const got = Math.min(b[id] || 0, n);
    if (got <= 0) return 0;
    b[id] -= got;
    if (b[id] <= 0) delete b[id];
    touch();
    return got;
  },

  move(from, to, id, n = 1) {
    const got = this.take(from, id, n);
    if (got > 0) this.add(to, id, got);
    return got;
  },

  // [{ id, n }], tools first then harvests, stable within each group so the
  // grid does not reshuffle under the player's finger as counts change.
  contents(where) {
    const b = bag(where);
    const ids = Object.keys(ITEMS).filter((id) => (b[id] || 0) > 0);
    return ids.map((id) => ({ id, n: b[id] }));
  },

  total(where) {
    return Object.values(bag(where)).reduce((a, n) => a + n, 0);
  },

  // How much of `kind` the player is carrying — drives the HUD carry counter.
  totalOfKind(where, kind) {
    const b = bag(where);
    return Object.keys(b).reduce((a, id) => (ITEMS[id]?.kind === kind ? a + b[id] : a), 0);
  },

  // The one tool the player is holding, or null. Act 1 never lends two at once;
  // if that ever changes this returns the first and the caller decides.
  heldTool() {
    const held = this.contents('player').find((e) => ITEMS[e.id].kind === 'tool');
    return held ? held.id : null;
  },

  // Seed a container. Replaces rather than adds, so re-entering a scene cannot
  // stack duplicate stock into the chest.
  stock(where, obj) {
    const inv = Save.data.inventory || (Save.data.inventory = fresh());
    inv[where] = { ...obj };
    touch();
  },

  clear(where) { this.stock(where, {}); },

  resetAll() { Save.data.inventory = fresh(); touch(); },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  flush() {
    if (dirtyT) { clearTimeout(dirtyT); dirtyT = null; }
    Save.persist();
  },
};

// A tap on a slot takes ONE tool but the WHOLE stack of a harvest. Taking one
// bow is obviously right, and making a child tap twenty times to hand over
// twenty berries obviously is not.
export function takeQuantity(id, available) {
  return ITEMS[id]?.kind === 'tool' ? 1 : available;
}
