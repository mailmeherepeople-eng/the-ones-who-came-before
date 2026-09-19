// Player-facing settings, persisted separately from the save file.
//
// Kept out of save.js on purpose: a setting is a preference about how the game
// is CONTROLLED, not part of the story, so "start over" must never reset it
// and jumping acts with ?act=N must never lose it.
import { S } from './strings.js';
import { QUALITY_TIER } from './constants.js';

const KEY = 'towcb-settings-v1';

// The panel is built from this list, so adding a setting is one entry here
// plus one string. `apply` runs on load and on every change.
export const SETTINGS = [
  ...['largeText', 'gentleCamera', 'assisted', 'sensitivity', 'autoAdvance'].map(id => ({
    id, label: () => S.revision[id], note: () => S.revision[id + 'Note'],
    def: id === 'gentleCamera' ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) : false,
  })),
  {
    id: 'lockCamera',
    label: () => S.ui.setLockCamera,
    note: () => S.ui.setLockCameraNote,
    def: false,
  },
  {
    id: 'sound',
    label: () => S.ui.setSound,
    note: () => S.ui.setSoundNote,
    def: true,
  },
  {
    id: 'music',
    label: () => S.ui.setMusic,
    note: () => S.ui.setMusicNote,
    def: true,
  },
  {
    // Rich tier: the shadow map, cloud shadows and the post pass
    // (engine/renderer.js setRich). On by default only where the capability
    // guess says the GPU can take it; the baked lighting runs everywhere.
    id: 'rich',
    label: () => S.ui.setRich,
    note: () => S.ui.setRichNote,
    def: QUALITY_TIER === 'high',
  },
];

const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.id, s.def]));

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

const state = load();
const listeners = new Set();

export const Settings = {
  get(id) { return state[id]; },
  set(id, value) {
    if (state[id] === value) return;
    state[id] = value;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
    for (const fn of listeners) fn(id, value);
  },
  all() { return { ...state }; },
  // called on every change and once at boot, so a listener never has to
  // duplicate the initial-apply logic
  subscribe(fn) { listeners.add(fn); fn(null, null); return () => listeners.delete(fn); },
};
