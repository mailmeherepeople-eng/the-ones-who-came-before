// Training post scores: a personal best, the best medal and a top-ten board
// per round, on this device only (minors' data stays on the device, GAME.md
// "Hard lines"). Kids sharing a phone or a classroom tablet compare on the
// board; a name is optional and never leaves the device.
const KEY = 'towcb-range-v1';
const TOP = 10;
export const MEDALS = ['bronze', 'silver', 'gold'];

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { rounds: d.rounds ?? {}, name: typeof d.name === 'string' ? d.name : '' };
  } catch { return { rounds: {}, name: '' }; }
}
let data = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: scores last the session */ }
}
function round(id) {
  return (data.rounds[id] ??= { best: 0, medal: -1, top: [], plays: 0 });
}

// -1 for none, else an index into MEDALS
export function medalFor(score, thresholds) {
  let m = -1;
  thresholds.forEach((t, i) => { if (score >= t) m = i; });
  return m;
}

export const Scores = {
  get(id) { return round(id); },
  lastName() { return data.name; },
  // Record a finished round. Returns what changed, for the results card.
  finish(id, score, thresholds) {
    const r = round(id);
    r.plays++;
    const medal = medalFor(score, thresholds);
    const newBest = score > r.best;
    const newMedal = medal > r.medal;
    if (newBest) r.best = score;
    if (newMedal) r.medal = medal;
    save();
    const rank = score > 0 ? r.top.filter((e) => e.score >= score).length : TOP;
    return { medal, newBest, newMedal, best: r.best, onBoard: rank < TOP, rank };
  },
  // Put a name on the board for a score just finished.
  addToBoard(id, score, name) {
    const r = round(id);
    const clean = String(name ?? '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 12);
    if (clean) data.name = clean;
    r.top.push({ name: clean, score, at: Date.now() });
    r.top.sort((a, b) => b.score - a.score || a.at - b.at);
    r.top.length = Math.min(r.top.length, TOP);
    save();
    return r.top;
  },
};
