// Save-record system (design doc §7.1 — "everything else serves it").
// Act 1 writes ObjectRecords; Act 2 reads them for erosion; Act 3 world-gen
// and Source Cards read them back. Autosaved after every beat.
//
// ObjectRecord: { id, type, pos:{x,z}, made:<year>, data:{...} }
//   pot:      data { shape:0|1|2, profile:[8 radii], mark:<dataURL 96x96> }
//   painting: data { png:<dataURL 256x128> }
//   beads:    data { count } — drilled shell beads (a string went to the grave)
//   arrowheads/axe/blade: data {}
//   hearth:   data {} — campfire charcoal
//   burial:   data { goods:['beads','blade'] }
//   crop:     data { plots } / camp: data { label }
//   obsidian: data {} — exchanged from the visiting band
//   basket:   data {} — organic; will NOT survive (the point)
//
// SourceCard (Act 3, derived): { recordId, title, photo, layer, specialist,
//   category, tells } — every rendered field must exist here or in the record.
import { SAVE_KEY } from './constants.js';

const FRESH = () => ({
  version: 1,
  act: 0,
  beat: 'start',
  records: [],
  choices: {},
  cards: [], // source cards collected in act 3 (ids + verdict state)
  claims: {},
  labUsed: [],
  beatTimes: {},
  // What is in the player's hands, the community chest and the store box
  // (src/inventory.js). Plain `{ itemId: count }` per container. load()'s
  // `{...FRESH(), ...parsed}` merge backfills this into saves written before
  // it existed, so no version bump was needed.
  inventory: { player: {}, chest: {}, store: {} },
  // Codex entries the player has met: { [entryId]: {taught, mastered} }, both
  // timestamps, `mastered` null until the term has been RETRIEVED (src/codex.js).
  codex: {},
  // Per-syllabus-item record, keyed by the ids in src/syllabus.js:
  // { taught, asked, correct, firstCorrectAt }. This is the pilot's data.
  mastery: {},
  // Who is playing, when a teacher has turned the pilot flag on. Empty in
  // ordinary play, and never shown to a child playing at home.
  session: { id: null, label: null, startedAt: null },
});

// Which child a shared device is currently on. Its own key, so that starting a
// new game (which wipes the save) does not also lose who is sitting there, for
// the same reason settings.js keeps its preferences outside the save.
export const SLOT_KEY = `${SAVE_KEY}:current-slot`;

class SaveSystem {
  constructor() {
    this.key = SAVE_KEY;
    this.data = FRESH();
    // A classroom device remembers its player across reloads. Without this a
    // mid-lesson refresh drops a child back into whichever save happens to be
    // unsloted, which is usually the previous child's.
    const slot = this.currentSlot();
    if (slot) this.key = `${SAVE_KEY}:${slot}`;
    this.load();
  }

  currentSlot() {
    try { return localStorage.getItem(SLOT_KEY) || null; } catch { return null; }
  }

  // Shared-tablet classrooms: one browser, thirty students, and without this
  // the second child to sit down resumes the first child's game and both sets
  // of data are ruined. Called at boot, before any beat runs, and only when the
  // teacher has turned the pilot flag on. Passing null returns to the ordinary
  // single save, which is what a child playing at home always uses.
  useSlot(slotId) {
    try {
      if (slotId) localStorage.setItem(SLOT_KEY, slotId);
      else localStorage.removeItem(SLOT_KEY);
    } catch { /* ignore */ }
    this.key = slotId ? `${SAVE_KEY}:${slotId}` : SAVE_KEY;
    this.data = FRESH();
    this.load();
    return this.data;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) this.data = { ...FRESH(), ...parsed };
      }
    } catch (e) {
      console.warn('save load failed, starting fresh', e);
      this.data = FRESH();
    }
    return this.data;
  }

  persist() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      // storage full (thumbnails) — drop largest art payloads progressively
      console.warn('save persist failed; retrying without art', e);
      try {
        const slim = JSON.parse(JSON.stringify(this.data));
        for (const r of slim.records) {
          if (r.data?.png) r.data.png = null;
          if (r.data?.mark) r.data.mark = null;
        }
        // cards carry copies of the same dataURLs — strip those too
        for (const c of slim.cards) {
          if (typeof c.photo === 'string') c.photo = { emoji: '🗿' };
        }
        localStorage.setItem(this.key, JSON.stringify(slim));
      } catch (e2) { console.error('save persist failed twice', e2); }
    }
  }

  reset() {
    const session = this.data.session; // starting over must not lose WHO is playing
    this.data = FRESH();
    this.data.session = session;
    try { localStorage.removeItem(this.key); } catch { /* ignore */ }
  }

  get hasProgress() { return this.data.beat !== 'start'; }

  checkpoint(act, beat) {
    this.data.act = act;
    this.data.beat = beat;
    this.data.beatTimes[beat] = Date.now();
    this.persist();
  }

  addRecord(rec) {
    // replace by id so re-running a beat cannot duplicate
    this.data.records = this.data.records.filter((r) => r.id !== rec.id);
    this.data.records.push(rec);
    this.persist();
    return rec;
  }

  getRecord(id) { return this.data.records.find((r) => r.id === id) || null; }
  getRecords(type) { return this.data.records.filter((r) => r.type === type); }

  setChoice(key, val) { this.data.choices[key] = val; this.persist(); }

  addCard(card) {
    if (!this.data.cards.find((c) => c.recordId === card.recordId && c.title === card.title)) {
      this.data.cards.push(card);
      this.persist();
    }
  }

  setClaim(claimId, verdict) { this.data.claims[claimId] = verdict; this.persist(); }
  useLab(sampleId) {
    if (!this.data.labUsed.includes(sampleId)) { this.data.labUsed.push(sampleId); this.persist(); }
  }

  // ---------- codex + mastery (src/codex.js, src/recall.js) ----------

  getCodex(entryId) { return this.data.codex[entryId] ?? null; }

  // Idempotent by design: a beat that replays on resume must not reset a term
  // the player has already shown back, and must not stamp a new taught time
  // over the original one.
  setCodex(entryId, patch) {
    const prev = this.data.codex[entryId] ?? { taught: null, mastered: null };
    this.data.codex[entryId] = { ...prev, ...patch };
    this.persist();
    return this.data.codex[entryId];
  }

  mastery(itemId) {
    return (this.data.mastery[itemId] ??= { taught: null, asked: 0, correct: 0, firstCorrectAt: null });
  }

  markTaught(itemId) {
    const m = this.mastery(itemId);
    if (m.taught) return m; // first sighting only, or a resume rewrites history
    m.taught = Date.now();
    this.persist();
    return m;
  }

  recordRecall(itemId, correct) {
    const m = this.mastery(itemId);
    m.asked += 1;
    if (correct) {
      m.correct += 1;
      m.firstCorrectAt ??= Date.now();
    }
    this.persist();
    return m;
  }

  setSession(patch) {
    this.data.session = { ...this.data.session, ...patch };
    this.persist();
    return this.data.session;
  }
}

export const Save = new SaveSystem();

// Which specialist reads which find, and its source category (spec §1.1 —
// bones/teeth/burnt grain are ARCHAEOLOGIST finds; Palaeontologist reads only
// deep-time fossils. This mapping is exam content: do not change casually.)
export const FIND_META = {
  pot: { specialist: 'archaeologist', category: 'archaeological' },
  potsherdMark: { specialist: 'epigraphist', category: 'archaeological' },
  basket: { specialist: 'archaeologist', category: 'archaeological' }, // the empty slot
  beads: { specialist: 'archaeologist', category: 'archaeological' },
  obsidian: { specialist: 'archaeologist', category: 'archaeological' },
  arrowheads: { specialist: 'archaeologist', category: 'archaeological' },
  hearth: { specialist: 'archaeologist', category: 'archaeological' },
  grain: { specialist: 'archaeologist', category: 'archaeological' },
  burial: { specialist: 'archaeologist', category: 'archaeological' },
  bones: { specialist: 'archaeologist', category: 'archaeological' },
  painting: { specialist: 'archaeologist', category: 'artistic' }, // revealed at the dig; art is the CATEGORY
  fossil: { specialist: 'palaeontologist', category: 'scientific' }, // not archaeology's domain — that's the lesson
  oral: { specialist: 'anthropologist', category: 'oral' },
  soil: { specialist: 'geologist', category: 'scientific' },
  labResult: { specialist: 'archaeologist', category: 'scientific' },
};
