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
});

class SaveSystem {
  constructor() {
    this.data = FRESH();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
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
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
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
        localStorage.setItem(SAVE_KEY, JSON.stringify(slim));
      } catch (e2) { console.error('save persist failed twice', e2); }
    }
  }

  reset() {
    this.data = FRESH();
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
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
