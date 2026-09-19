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
import { snapshotRead, snapshotWrite } from './storage.js';

const FRESH = () => ({
  version: 1,
  updatedAt: 0,
  activeMs: 0,
  activities: {},
  objective: null,
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
    this.lastWrite = Promise.resolve(true);
    this.ready = this.restoreSnapshot();
  }

  async restoreSnapshot() {
    const key = this.key;
    try {
      const stored = await snapshotRead(key);
      if (key === this.key && stored?.version === 1 && (stored.updatedAt ?? 0) > (this.data.updatedAt ?? 0)) {
        this.data = { ...FRESH(), ...stored };
      }
    } catch { /* synchronous local save remains available */ }
    return this.data;
  }

  currentSlot() {
    try { return localStorage.getItem(SLOT_KEY) || null; } catch { return null; }
  }

  // Shared-tablet classrooms: one browser, thirty students, and without this
  // the second child to sit down resumes the first child's game and both sets
  // of data are ruined. Called at boot, before any beat runs, and only when the
  // teacher has turned the pilot flag on. Passing null returns to the ordinary
  // single save, which is what a child playing at home always uses.
  async useSlot(slotId) {
    await this.lastWrite;
    try {
      if (slotId) localStorage.setItem(SLOT_KEY, slotId);
      else localStorage.removeItem(SLOT_KEY);
    } catch { /* ignore */ }
    this.key = slotId ? `${SAVE_KEY}:${slotId}` : SAVE_KEY;
    this.data = FRESH();
    this.load();
    await this.restoreSnapshot();
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
    this.data.updatedAt = Math.max(Date.now(), (this.data.updatedAt ?? 0) + 1);
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const key = this.key;
    let localOK = false;
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
      localOK = true;
    } catch (e) {
      // Keep the full snapshot, including art, in the larger async store.
    }
    this.lastWrite = this.lastWrite.then(async () => {
      let durable = false;
      try { await snapshotWrite(key, snapshot); durable = true; } catch { /* report below */ }
      const ok = localOK || durable;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('save-status', { detail: { ok } }));
      return ok;
    });
    return this.lastWrite;
  }

  reset() {
    const session = this.data.session; // starting over must not lose WHO is playing
    const updatedAt = this.data.updatedAt;
    this.data = FRESH();
    this.data.session = session;
    this.data.updatedAt = updatedAt;
    // Write a newer empty snapshot, so an old async copy cannot resurrect it.
    this.persist();
  }

  get hasProgress() { return this.data.beat !== 'start'; }

  checkpoint(act, beat) {
    this.data.act = act;
    this.data.beat = beat;
    this.data.beatTimes[beat] ??= Date.now();
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

  activity(id) { return this.data.activities[id] ?? {}; }
  setActivity(id, patch) {
    this.data.activities[id] = { ...this.activity(id), ...patch };
    this.persist();
  }

  export() { return JSON.stringify(this.data, null, 2); }

  async import(text) {
    if (text.length > 12 * 1024 * 1024) throw new Error('Oversized save');
    const data = JSON.parse(text);
    if (data.version !== 1 || !Array.isArray(data.records) || !Array.isArray(data.cards)
      || !Number.isInteger(data.act) || data.act < 0 || data.act > 3 || typeof data.beat !== 'string') throw new Error('Invalid save');
    // Photos enter HTML image attributes. Only our PNG data URLs are allowed.
    for (const r of data.records) {
      if (!r || typeof r.id !== 'string' || typeof r.type !== 'string') throw new Error('Invalid record');
      for (const k of ['png', 'mark']) if (r.data?.[k] && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.data[k])) throw new Error('Invalid image');
    }
    for (const c of data.cards) {
      if (!c || typeof c.title !== 'string' || typeof c.recordId !== 'string') throw new Error('Invalid card');
      if (typeof c.photo === 'string' && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.photo)) throw new Error('Invalid image');
      if (c.photo && typeof c.photo !== 'string' && !/^[\p{L}\p{N}\p{P}\p{S}\p{Z}\uFE0F\u200D]*$/u.test(c.photo.emoji ?? '')) throw new Error('Invalid icon');
    }
    for (const key of ['inventory', 'choices', 'claims', 'codex', 'mastery', 'activities', 'beatTimes']) {
      if (key in data && (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key]))) throw new Error('Invalid state');
    }
    if ('labUsed' in data && (!Array.isArray(data.labUsed) || data.labUsed.some(v=>typeof v!=='string'))) throw new Error('Invalid lab');
    if ('activeMs' in data && (!Number.isFinite(data.activeMs) || data.activeMs<0)) throw new Error('Invalid time');
    if (data.inventory) for(const name of ['player','chest','store']) {
      const items=data.inventory[name];
      if(!items || typeof items!=='object' || Array.isArray(items) || Object.values(items).some(n=>!Number.isFinite(n)||n<0)) throw new Error('Invalid inventory');
    }
    const before = this.data;
    this.data = { ...FRESH(), ...data, session: before.session, updatedAt:Math.max(before.updatedAt ?? 0,data.updatedAt ?? 0) };
    if (!await this.persist()) { this.data = before; throw new Error('Save unavailable'); }
  }

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
      if (this.data.codex[itemId]?.taught) this.data.codex[itemId].mastered ??= Date.now();
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
