// The examinable knowledge map of NCERT Class 6 History Ch. 4, as data.
//
// game/COVERAGE.md is the prose version and maps every item to the beat that
// ships it; this file is the machine-readable half, and it is what the codex,
// the recall prompts and the results export all key off. One id, one meaning,
// everywhere.
//
// LABELS ARE NOT HERE. They are user-visible (they render in the codex panel
// and in the teacher's results summary), so they live in strings.js under
// S.syllabus like every other user-visible string. Keeping them out also keeps
// this file clear of the date literals the lint restricts to strings.js and
// constants.js: "560 BCE" or "12,000 years ago" inside a label would fail
// tools/lint-strings.mjs the moment it appeared in a src file.
//
// `act` is the act that OWNS the item, meaning the act whose rework would have
// to re-home it. Acts 2 and 3 are rewritten in a later pass; nothing here needs
// to change when they are, because the ids come from the syllabus and not from
// the beats.

// untaught: 4.20 (the plural of millennium) is deliberately never taught, per
// the design doc. It stays in the list so coverage arithmetic is honest, and is
// excluded from every total.
export const SYLLABUS = [
  { id: '4.1', act: 3 },
  { id: '4.2', act: 3 },
  { id: '4.3', act: 3 },
  { id: '4.4', act: 3 },
  { id: '4.5', act: 3 },
  { id: '4.6', act: 3 },
  { id: '4.7', act: 3 },
  { id: '4.8', act: 2 },
  { id: '4.9', act: 2 },
  { id: '4.10', act: 2 },
  { id: '4.11', act: 2 },
  { id: '4.12', act: 2 },
  { id: '4.13', act: 2 },
  { id: '4.14', act: 2 },
  { id: '4.15', act: 2 },
  { id: '4.16', act: 2 },
  { id: '4.17', act: 2 },
  { id: '4.18', act: 2 },
  { id: '4.19', act: 2 },
  { id: '4.20', act: 2, untaught: true },
  { id: '4.21', act: 2 },
  { id: '4.22', act: 2 },
  { id: '4.23', act: 2 },
  { id: '4.24', act: 3 },
  { id: '4.25', act: 3 },
  { id: '4.26', act: 2 },
  { id: '4.27', act: 3 },
  { id: '4.28', act: 3 },
  { id: '4.29', act: 3 },
  { id: '4.30', act: 3 },
  { id: '4.31', act: 2 },
  { id: '4.32', act: 1 },
  { id: '4.33', act: 1 },
  { id: '4.34', act: 1 },
  { id: '4.35', act: 1 },
  { id: '4.36', act: 1 },
  { id: '4.37', act: 1 },
  { id: '4.38', act: 1 },
  { id: '4.39', act: 1 },
  { id: '4.40', act: 2 },
  { id: '4.41', act: 1 },
  { id: '4.42', act: 1 },
  { id: '4.43', act: 1 },
  { id: '4.44', act: 1 },
  { id: '4.45', act: 1 },
  { id: '4.46', act: 1 },
  { id: '4.47', act: 1 },
  { id: '4.48', act: 1 },
  { id: '4.49', act: 1 },
  { id: '4.50', act: 1 },
];

const BY_ID = new Map(SYLLABUS.map((it) => [it.id, it]));

export function syllabusItem(id) { return BY_ID.get(id) ?? null; }

// Every item the game intends to teach. 4.20 is excluded, so "38 of 49" can
// never quietly become "38 of 50" and read as a gap that was never there.
export const TEACHABLE = SYLLABUS.filter((it) => !it.untaught);

export function teachableFor(act) { return TEACHABLE.filter((it) => it.act === act); }
