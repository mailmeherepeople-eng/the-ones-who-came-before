// The codex: the terms the game teaches, made persistent and reviewable.
//
// Before this existed, every one of the game's ~33 "Note" lines fired once in a
// narrator box and was then unrecoverable for the rest of the playthrough. A
// student who wanted to check what a hamlet was had no surface to check it on,
// which is a strange thing for a game whose whole pitch is "play this instead
// of reading the textbook".
//
// TWO STATES, AND THE DIFFERENCE IS THE POINT:
//
//   taught    the line fired. The entry appears as a GHOST slot.
//   mastered  the player RETRIEVED it, unprompted, later on. The slot fills in.
//
// The counter therefore reads mastered/taught, not collected/total. Reading a
// definition is not knowing it; producing it from memory is, and that is the
// only finding in learning science robust enough to build a claim on. A ghost
// slot says "you have seen this, you have not shown it back yet", which is also
// exactly what a teacher wants to see at a glance.
//
// This is NOT act 3's Source Card satchel (ui/report.js). Source Cards are
// things you FOUND; codex entries are things you KNOW. They stay separate
// systems with separate buttons so that rewriting act 3 cannot disturb either.
//
// ISOLATION RULE: this module must never import from src/acts/. Acts import it
// and call in. Per-act content sits in its own array below, so the act 2 and
// act 3 rewrites replace CODEX_ACT2 / CODEX_ACT3 and CODEX_ACT1 is untouched.

import { S } from './strings.js';
import { Save } from './save.js';

// { id, syllabus, icon } — text lives in strings.js under S.codex[id], per the
// house rule that every user-visible string is in one file.
export const CODEX_ACT1 = [
  { id: 'band', syllabus: '4.32', icon: '👣' },
  { id: 'huntGather', syllabus: '4.33', icon: '🏹' },
  { id: 'camp', syllabus: '4.34', icon: '⛺' },
  { id: 'lostTongues', syllabus: '4.35', icon: '🗣' },
  { id: 'toolmaking', syllabus: '4.36', icon: '🪨' },
  { id: 'graveGoods', syllabus: '4.37', icon: '🪦' },
  { id: 'rockArt', syllabus: '4.38', icon: '🖼' },
  { id: 'exchange', syllabus: '4.39', icon: '📿' },
  { id: 'iceAge', syllabus: '4.41', icon: '🧊' },
  { id: 'thaw', syllabus: '4.42', icon: '🌊' },
  { id: 'farming', syllabus: '4.43', icon: '🌾' },
  { id: 'riverside', syllabus: '4.44', icon: '🏞' },
  { id: 'chieftain', syllabus: '4.45', icon: '🪶' },
  { id: 'shared', syllabus: '4.46', icon: '🧺' },
  { id: 'village', syllabus: '4.47', icon: '🏘' },
  { id: 'network', syllabus: '4.48', icon: '🛤' },
  { id: 'pottery', syllabus: '4.49', icon: '🏺' },
  { id: 'hamlet', syllabus: '4.50', icon: '🏡' },
];

// Filled by the act 2 rework. Empty is correct today, not an oversight: act 2
// currently teaches a third of the syllabus through 32 text screens and none of
// it is retrievable, which is the single biggest gap in the game.
export const CODEX_ACT2 = [];

// Filled by the act 3 rework.
export const CODEX_ACT3 = [];

export const CODEX = [...CODEX_ACT1, ...CODEX_ACT2, ...CODEX_ACT3];

const BY_ID = new Map(CODEX.map((e) => [e.id, e]));

export function codexEntry(id) { return BY_ID.get(id) ?? null; }

export function codexText(id) { return S.codex?.[id] ?? null; }

export function codexState(id) {
  return Save.getCodex(id) ?? { taught: null, mastered: null };
}

export function isTaught(id) { return !!codexState(id).taught; }
export function isMastered(id) { return !!codexState(id).mastered; }

export function codexCounts() {
  let taught = 0, mastered = 0;
  for (const e of CODEX) {
    const st = codexState(e.id);
    if (st.taught) taught++;
    if (st.mastered) mastered++;
  }
  return { taught, mastered, total: CODEX.length };
}

// Every entry the player has met, newest last, with its state attached. The
// panel renders from this so it never has to know how state is stored.
export function codexList() {
  return CODEX.map((e) => ({ ...e, ...codexState(e.id), text: codexText(e.id) }));
}

// The HUD pill hides itself until the first term lands, so a player who has met
// nothing is not shown an empty 0/0 book on the opening shot.
export function refreshCodexBadge(G) {
  const { taught, mastered } = codexCounts();
  G?.hud?.setCodex?.(mastered, taught, taught > 0);
}

// The very first term of a session announces itself and points at the button;
// after that the badge count does the talking. Eighteen toasts in act 1 would
// be noise, and one is the difference between a player who knows the codex
// exists and a player who never opens it.
let announced = false;

// The note fired. Ghost slot. Also stamps the syllabus item as taught, which is
// what lets the results export separate "never covered" from "covered but not
// retrieved" — two very different things for a teacher to read.
export function teach(G, id) {
  const entry = codexEntry(id);
  if (!entry) { console.warn('codex: unknown entry', id); return null; }
  const fresh = !isTaught(id);
  if (fresh) Save.setCodex(id, { taught: Date.now() });
  Save.markTaught(entry.syllabus);
  refreshCodexBadge(G);
  if (fresh && !announced) {
    announced = true;
    G?.hud?.toast?.(S.codexUI.added(codexText(id)?.term ?? id), 4200);
    G?.hud?.hint?.(S.codexUI.firstHint, 6000);
  }
  return entry;
}

// The player produced it from memory. Slot fills. Idempotent, so a term
// retrieved twice keeps its original timestamp.
export function master(G, id) {
  const entry = codexEntry(id);
  if (!entry) { console.warn('codex: unknown entry', id); return null; }
  if (!isTaught(id)) Save.setCodex(id, { taught: Date.now() });
  if (!isMastered(id)) Save.setCodex(id, { mastered: Date.now() });
  refreshCodexBadge(G);
  return entry;
}
