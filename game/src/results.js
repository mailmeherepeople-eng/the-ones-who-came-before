// Measurement: what a student actually retrieved, and how to get it off the
// device.
//
// Written for a specific room: thirty children, a handful of shared tablets,
// school wifi that may or may not exist, and no accounts. So everything here
// works fully offline, stores nothing anywhere but this browser, and produces
// one CSV a teacher can open in a spreadsheet.
//
// THE SINK SEAM. submit() takes a named sink and today there is exactly one,
// localDownload. A hosted backend later is a new entry in SINKS plus a config
// value; no call site changes, and nothing in the game learns about a network.
// That seam is the only reason this is a module rather than a button.
//
// WHAT THE NUMBERS MEAN, because a teacher will read them and they must not
// mislead:
//   taught     the game covered it. Says nothing about whether it landed.
//   asked      the game asked the student to produce it, unprompted.
//   correct    they produced it.
// A low correct with a high asked is a finding. A low asked is a gap in the
// GAME, not in the student, and the summary says so in as many words.

import { S } from './strings.js';
import { Save, SLOT_KEY } from './save.js';
import { SAVE_KEY } from './constants.js';
import { TEACHABLE } from './syllabus.js';
import { wirePanelClose } from './ui/report.js';

export const RESULTS_SCHEMA = 1;

// Slot bookkeeping lives in save.js, which owns the storage key. Re-exported
// here only so a caller reading results does not have to know that.
export const currentSlot = () => Save.currentSlot();

// Every save on this device: the shared-tablet case, where one ?data visit has
// to hand back all of the day's students and not just the last one to play.
export function listSlots() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${SAVE_KEY}:`) || k === SLOT_KEY) continue;
      out.push(k.slice(SAVE_KEY.length + 1));
    }
  } catch { /* ignore */ }
  return out.sort();
}

function readSlot(slotId) {
  const key = slotId ? `${SAVE_KEY}:${slotId}` : SAVE_KEY;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- the payload ----------

// `data` defaults to the live save so a mid-session ?data call reports the game
// in progress rather than the last persisted write.
export function buildResults(data = Save.data, slotId = currentSlot()) {
  const mastery = data?.mastery ?? {};
  const beatTimes = data?.beatTimes ?? {};
  const stamps = Object.values(beatTimes).filter((t) => Number.isFinite(t));
  const items = TEACHABLE.map((it) => {
    const m = mastery[it.id] ?? {};
    return {
      id: it.id,
      act: it.act,
      label: S.syllabus?.[it.id] ?? it.id,
      taught: !!m.taught,
      asked: m.asked ?? 0,
      correct: m.correct ?? 0,
      firstCorrectAt: m.firstCorrectAt ?? null,
    };
  });
  return {
    schema: RESULTS_SCHEMA,
    generatedAt: new Date().toISOString(),
    slot: slotId ?? null,
    session: data?.session ?? { id: null, label: null, startedAt: null },
    progress: { act: data?.act ?? 0, beat: data?.beat ?? 'start' },
    totals: {
      teachable: items.length,
      taught: items.filter((i) => i.taught).length,
      asked: items.filter((i) => i.asked > 0).length,
      retrieved: items.filter((i) => i.correct > 0).length,
      attempts: items.reduce((n, i) => n + i.asked, 0),
      hits: items.reduce((n, i) => n + i.correct, 0),
    },
    // beatTimes has been recorded since the save system was written and read by
    // nothing until now. Time on task, free.
    elapsedMs: stamps.length > 1 ? Math.max(...stamps) - Math.min(...stamps) : 0,
    beatTimes,
    items,
  };
}

// ---------- csv ----------

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEAD = ['slot', 'student', 'item', 'act', 'label', 'taught', 'asked', 'correct', 'reached_beat', 'elapsed_min'];

// One row per syllabus item, with the student repeated on every row, so that
// thirty separate downloads concatenate into one analysable sheet without any
// reshaping.
export function toCSV(payloads) {
  const list = Array.isArray(payloads) ? payloads : [payloads];
  const rows = [CSV_HEAD.join(',')];
  for (const p of list) {
    const mins = Math.round(p.elapsedMs / 60000);
    for (const it of p.items) {
      rows.push([
        p.slot, p.session?.label ?? '', it.id, it.act, it.label,
        it.taught ? 1 : 0, it.asked, it.correct, p.progress.beat, mins,
      ].map(csvCell).join(','));
    }
  }
  return rows.join('\n');
}

// ---------- sinks ----------

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke late: Safari has been known to cancel an in-flight download when the
  // object URL dies in the same tick as the click
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const SINKS = {
  localDownload(payloads, { format = 'csv' } = {}) {
    const list = Array.isArray(payloads) ? payloads : [payloads];
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      download(`towcb-results-${stamp}.json`, JSON.stringify(list, null, 2), 'application/json');
    } else {
      download(`towcb-results-${stamp}.csv`, toCSV(list), 'text/csv;charset=utf-8');
    }
    return { ok: true, sink: 'localDownload', count: list.length };
  },
};

// The seam. A hosted sink is added to SINKS and named here; nothing else moves.
export async function submit(payloads, sink = 'localDownload', opts = {}) {
  const fn = SINKS[sink];
  if (!fn) throw new Error(`results: unknown sink "${sink}"`);
  return fn(payloads, opts);
}

// ---------- who is playing (pilot only) ----------

// Shown only when a teacher has put the game into pilot mode. A child playing
// at home must never be asked to identify themselves to start a game, so this
// is off by default and there is no path to it from the title screen.
export async function askIdentity(G) {
  const existing = currentSlot();
  const el = document.createElement('div');
  el.className = 'panel-dim';
  el.innerHTML = `
    <div class="settings-panel" role="dialog">
      <h3></h3>
      <div class="rep-body" style="margin-bottom:12px"></div>
      <input id="pilot-name" type="text" autocomplete="off"
             style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;
                    border:1px solid #7a6440;background:rgba(0,0,0,0.35);color:var(--ink);
                    font:inherit;font-size:16px">
      <button class="btn primary" id="pilot-go" style="margin-top:14px"></button>
    </div>`;
  el.querySelector('h3').textContent = S.pilot.title;
  el.querySelector('.rep-body').textContent = S.pilot.note;
  el.querySelector('#pilot-go').textContent = S.pilot.start;
  const input = el.querySelector('#pilot-name');
  input.value = existing ?? '';
  G.hud.root.appendChild(el);
  input.focus();

  const label = await new Promise((res) => {
    const go = () => res(input.value.trim());
    el.querySelector('#pilot-go').addEventListener('click', go, { once: true });
    input.addEventListener('keydown', (e) => { if (e.code === 'Enter') go(); });
  });
  el.remove();
  G.input?.clearEdges?.();

  // Anything unusable falls back to the ordinary single save rather than
  // creating a slot called "" that nobody can find again.
  const slot = label.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 40);
  if (!slot) return null;
  Save.useSlot(slot); // also remembers the slot across reloads
  Save.setSession({ id: slot, label, startedAt: Save.data.session.startedAt ?? Date.now() });
  return slot;
}

// ---------- the on-screen summary ----------

export function resultsPanel(G) {
  return new Promise((resolve) => {
    // Every save on the device, sloted or not. The unsloted one is included
    // whenever it holds real progress, because a tablet that was played on
    // BEFORE the teacher switched pilot mode on still has a child's session in
    // it, and silently dropping that row would lose data nobody could recover.
    const plain = readSlot(null);
    const payloads = [
      ...(plain && plain.beat !== 'start' ? [buildResults(plain, null)] : []),
      ...listSlots().map((s) => buildResults(readSlot(s), s)),
    ];
    // Nothing played yet: still show the (empty) live session rather than an
    // empty table, so a teacher checking setup sees the report working.
    if (!payloads.length) payloads.push(buildResults(Save.data, Save.currentSlot()));

    const el = document.createElement('div');
    // .bigpanel only. The parchment look belongs to #report (an id, owned by
    // siteReport), and borrowing the class without the id would leave dark ink
    // on a dark panel.
    el.className = 'bigpanel';
    const rowHTML = (p) => {
      const t = p.totals;
      const pct = t.asked ? Math.round((t.retrieved / t.asked) * 100) : 0;
      return `<tr>
        <td>${esc(p.session?.label || p.slot || S.results.anon)}</td>
        <td>${t.taught}/${t.teachable}</td>
        <td>${t.asked}</td>
        <td>${t.retrieved}${t.asked ? ` (${pct}%)` : ''}</td>
        <td>${Math.round(p.elapsedMs / 60000)}</td>
        <td>${esc(p.progress.beat)}</td>
      </tr>`;
    };

    el.innerHTML = `
      <h2>${esc(S.results.title)}</h2>
      <div class="rep-body">${esc(S.results.blurb)}</div>
      <div style="overflow-x:auto;margin-top:14px">
        <table class="results-table">
          <thead><tr>
            <th>${esc(S.results.colStudent)}</th>
            <th>${esc(S.results.colTaught)}</th>
            <th>${esc(S.results.colAsked)}</th>
            <th>${esc(S.results.colRetrieved)}</th>
            <th>${esc(S.results.colMinutes)}</th>
            <th>${esc(S.results.colReached)}</th>
          </tr></thead>
          <tbody>${payloads.map(rowHTML).join('')}</tbody>
        </table>
      </div>
      <div class="rep-body" style="margin-top:12px">${esc(S.results.caveat)}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">
        <button class="btn primary chip-btn" id="res-csv">${esc(S.results.downloadCsv)}</button>
        <button class="btn small chip-btn" id="res-json">${esc(S.results.downloadJson)}</button>
        <button class="btn small chip-btn" id="res-done">${esc(S.ui.close)}</button>
      </div>`;

    const close = wirePanelClose(G, el, () => { el.remove(); resolve(); }, { backdrop: true });
    el.querySelector('#res-done').addEventListener('click', close);
    el.querySelector('#res-csv').addEventListener('click', () => submit(payloads, 'localDownload', { format: 'csv' }));
    el.querySelector('#res-json').addEventListener('click', () => submit(payloads, 'localDownload', { format: 'json' }));
    G.hud.root.appendChild(el);
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
