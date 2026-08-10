// Player-facing settings, persisted separately from the save file.
//
// Kept out of save.js on purpose: a setting is a preference about how the game
// is CONTROLLED, not part of the story, so "start over" must never reset it
// and jumping acts with ?act=N must never lose it.
import { S } from './strings.js';

const KEY = 'towcb-settings-v1';

// The panel is built from this list, so adding a setting is one entry here
// plus one string. `apply` runs on load and on every change.
export const SETTINGS = [
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
