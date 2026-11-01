// Player-facing settings, persisted separately from the save file.
//
// Kept out of save.js on purpose: a setting is a preference about how the game
// is CONTROLLED, not part of the story, so "start over" must never reset it
// and jumping acts with ?act=N must never lose it.
import { S } from './strings.js';
import { QUALITY_TIER } from './constants.js';

const KEY = 'towcb-settings-v1';

// A touchscreen is a guess (constants.js says why); the player can correct it
// in Settings, and every control and instruction follows (engine/input.js).
const TOUCH_GUESS = (() => {
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
})();

// The panel is built from this list, so adding a setting is one entry here
// plus one string. `apply` runs on load and on every change.
export const SETTINGS = [
  {
    // 2026-11-01: "the instructions should change based on the device. maybe
    // we can keep a setting where the person picks the device they are using"
    id: 'touchControls', tab: 'controls',
    label: () => S.ui.setTouch,
    note: () => S.ui.setTouchNote,
    def: TOUCH_GUESS,
  },
  ...['largeText', 'gentleCamera', 'assisted', 'sensitivity', 'autoAdvance'].map(id => ({
    id, label: () => S.revision[id], note: () => S.revision[id + 'Note'],
    tab: { largeText: 'display', gentleCamera: 'display', assisted: 'play', sensitivity: 'controls', autoAdvance: 'play' }[id],
    def: id === 'gentleCamera' ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) : false,
  })),
  {
    // on for everyone since 2026-11-01 ("Behind me everywhere"): a free
    // camera on a phone "feels horrible"
    id: 'lockCamera', tab: 'controls',
    label: () => S.ui.setLockCamera,
    note: () => S.ui.setLockCameraNote,
    def: true,
  },
  {
    // 2026-11-01: "show me how both will look. Over the shoulder as well as
    // Through the eyes" (games/archer.js)
    id: 'aimEyes', tab: 'controls',
    label: () => S.ui.setAimEyes,
    note: () => S.ui.setAimEyesNote,
    def: false,
  },
  {
    id: 'sound', tab: 'sound',
    label: () => S.ui.setSound,
    note: () => S.ui.setSoundNote,
    def: true,
  },
  {
    id: 'music', tab: 'sound',
    label: () => S.ui.setMusic,
    note: () => S.ui.setMusicNote,
    def: true,
  },
  {
    // Rich tier: the shadow map, cloud shadows and the post pass
    // (engine/renderer.js setRich). On by default only where the capability
    // guess says the GPU can take it; the baked lighting runs everywhere.
    id: 'rich', tab: 'display',
    label: () => S.ui.setRich,
    note: () => S.ui.setRichNote,
    def: QUALITY_TIER === 'high',
  },
  {
    // Vivid style (world/shade.js setVivid): the game's look since slice 1 of
    // the 2026-10-27 plan, bold palette with storybook light, on for every
    // device. Off falls back to the realistic lit pipeline. A style choice,
    // not a performance tier (vivid is the cheaper of the two: it skips the
    // shadow map, see renderer.setShadowsAllowed).
    id: 'vivid', tab: 'display',
    label: () => S.ui.setVivid,
    note: () => S.ui.setVividNote,
    def: true,
  },
];

// The settings panel's tabs, in order (2026-11-01: "make it a proper menu.
// with proper tabs like controls, display, sound"). The actions on the
// Controls and My story tabs are buttons added by ui/hud.js.
export const SETTING_TABS = ['controls', 'display', 'sound', 'play', 'story'];

const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.id, s.def]));

// Bumped when a default changes and returning players should get the new
// one. Settings are saved whole, so a player who changed ANY toggle has the
// old default for every other toggle written down as if they had chosen it.
// Version 2 (2026-10-27): vivid became the default look.
// Version 3 (2026-11-01): the camera follows behind you by default.
const LOOK_VERSION = 3;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, lookVersion: LOOK_VERSION };
    const saved = JSON.parse(raw);
    if ((saved.lookVersion ?? 1) < LOOK_VERSION) {
      if ((saved.lookVersion ?? 1) < 2) delete saved.vivid; // never chosen, only inherited: take the new default
      delete saved.lockCamera; // the same, for the camera (version 3)
      saved.lookVersion = LOOK_VERSION;
      try { localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...saved })); } catch { /* private mode */ }
    }
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS, lookVersion: LOOK_VERSION };
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
