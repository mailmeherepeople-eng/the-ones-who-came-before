// File-based audio: narration, music and recorded SFX.
//
// This is a LAYER on top of audio.js, not a replacement. audio.js stays exactly
// as it was: synthesised stings and the wind/bird ambience bed, always
// available, no download, correct on a cold first load. This module adds real
// files over the top, and the whole game must still play with none of them
// present. A missing file is a silent no-op, never an error and never a stall.
//
// FORMAT: AAC in .m4a. Opus is roughly twice as efficient for speech, but it
// only decodes on iOS 17.5+, and iPhone support was a requirement. AAC plays
// everywhere, so one file per line is all you author.
//
// THE RAM RULE, which decides the whole design: decoded PCM costs about 192 KB
// per second (mono, 48 kHz, float32). Seven minutes of narration decoded into
// AudioBuffers would be ~80 MB, which is not something to do to a phone. So:
//
//   voice + music -> HTMLAudioElement. Streams. Near-zero resident memory.
//   short sfx     -> decoded AudioBuffer. Instant, sample-accurate, tiny.
//
// Both still run through ONE volume path: the element is piped into the Web
// Audio graph with a MediaElementAudioSourceNode so it lands on the same master
// gain as the synth. That also sidesteps iOS ignoring `.volume` on an audio
// element, where the property is read-only in practice.
import { SFX } from './audio.js';
import { Settings } from './settings.js';
import { S } from './strings.js';

const BASE = 'audio/';
const EXT = '.m4a';

// Which files actually exist. Fetched once; a 404 (nothing authored yet) leaves
// it empty, which makes every has() false and every play a no-op. This is why
// nothing ever 404-spams the console per line.
let manifest = null;
let manifestLoading = null;

export async function loadManifest() {
  if (manifest) return manifest;
  if (manifestLoading) return manifestLoading;
  manifestLoading = fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      manifest = {
        voice: new Set(j?.voice ?? []),
        sfx: new Set(j?.sfx ?? []),
        music: new Set(j?.music ?? []),
      };
      return manifest;
    })
    .catch(() => {
      manifest = { voice: new Set(), sfx: new Set(), music: new Set() };
      return manifest;
    });
  return manifestLoading;
}

function has(kind, id) { return !!id && !!manifest && manifest[kind].has(id); }
function url(kind, id) { return `${BASE}${kind}/${id}${EXT}`; }

// ---------- line id <- the strings.js key path ----------
//
// hud.narrator() is handed a resolved STRING, not a key, and there are 88 call
// sites across the acts. Rather than edit all of them, the map is built once by
// walking S: the value "You wake in a rock shelter..." resolves back to
// "act1.wake", so the file to record is simply audio/voice/act1.wake.m4a.
//
// Two deliberate limits. Template strings (p3_challenge and friends) are
// functions, so they have no fixed value and get no voice; and if two keys hold
// the identical string the FIRST wins, so the mapping stays deterministic. Pass
// an explicit { voice: 'act1.wake' } to override either case.
let voiceIndex = null;
export function voiceIdFor(text) {
  if (typeof text !== 'string' || !text) return null;
  if (!voiceIndex) {
    voiceIndex = new Map();
    const walk = (obj, path) => {
      for (const [k, v] of Object.entries(obj)) {
        const p = path ? `${path}.${k}` : k;
        if (typeof v === 'string') { if (!voiceIndex.has(v)) voiceIndex.set(v, p); }
        else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p);
      }
    };
    walk(S, '');
  }
  return voiceIndex.get(text) ?? null;
}

// ---------- the mixer ----------
// Three gains under audio.js's existing master, so one mute covers synth and
// files alike and each category can be turned down on its own.
let buses = null;
function mixer() {
  if (buses) return buses;
  const ctx = SFX.ctx;
  if (!ctx || !SFX.master) return null; // before the first gesture: stay silent
  const mk = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(SFX.master); return g; };
  buses = { ctx, voice: mk(1.0), music: mk(0.45), sfx: mk(0.8) };
  applySettings();
  return buses;
}

function applySettings() {
  if (!buses) return;
  const on = Settings.get('sound') !== false;
  const music = on && Settings.get('music') !== false;
  buses.voice.gain.value = on ? 1.0 : 0;
  buses.sfx.gain.value = on ? 0.8 : 0;
  buses.music.gain.value = music ? 0.45 : 0;
  if (SFX.master) SFX.master.gain.value = on ? 0.5 : 0; // also silences the synth bed
}
Settings.subscribe(applySettings);

// An element may only ever have ONE MediaElementAudioSourceNode, so the node is
// cached alongside the element it was made from.
const wired = new WeakMap();
function route(el, bus) {
  const m = mixer();
  if (!m) return false;
  let node = wired.get(el);
  if (!node) {
    try { node = m.ctx.createMediaElementSource(el); } catch { return false; }
    wired.set(el, node);
  }
  try { node.disconnect(); } catch { /* first connect */ }
  node.connect(bus);
  return true;
}

// ---------- short sfx: decoded, pooled ----------
const buffers = new Map();
async function buffer(id) {
  if (buffers.has(id)) return buffers.get(id);
  const m = mixer();
  if (!m || !has('sfx', id)) return null;
  const p = fetch(url('sfx', id))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('404'))))
    .then((b) => m.ctx.decodeAudioData(b))
    .catch(() => null);
  buffers.set(id, p);
  return p;
}

// ---------- character voice pools ----------
//
// A character's voice is a FOLDER of sfx, not one file: everything under
// `sfx/npc/tribe/` is a tribe vocalisation, everything under `sfx/npc/elder/`
// is the elder's. The filename is only a variant label, so adding a line means
// dropping a file in and re-running tools/sync-audio-manifest.mjs. No code and
// no act script knows how many there are.
//
// These are noises, never words. Act 1's whole language beat is that the
// tribe's speech was rich and is completely lost, so a voice pool can carry
// grunts, laughter and song and stay true to it, where a recorded sentence
// would quietly undo the lesson.
const lastFromPool = new Map();   // prefix -> the id played last, so it repeats least
const activeFromPool = new Map(); // prefix -> the source now sounding, so it can be cut

function poolFor(prefix) {
  if (!manifest) return [];
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return [...manifest.sfx].filter((id) => id.startsWith(p));
}

/**
 * Play one random clip from a voice folder.
 * @returns {Promise<boolean>} false when the pool (and its fallback) is empty,
 *          which is the caller's signal to make its own noise instead.
 */
async function playFromPool(prefix, { fallback = null, gain = 1 } = {}) {
  let key = prefix;
  let ids = poolFor(key);
  if (!ids.length && fallback && fallback !== prefix) { key = fallback; ids = poolFor(key); }
  if (!ids.length) return false;
  // Never the same clip twice running. With one file in the folder that means
  // it repeats, which is the only thing it can do; with two or more it always
  // moves on, so a talkative tribe never sounds like a loop.
  const last = lastFromPool.get(key);
  const choices = ids.length > 1 ? ids.filter((id) => id !== last) : ids;
  const id = choices[Math.floor(Math.random() * choices.length)];
  lastFromPool.set(key, id);

  const m = mixer();
  const buf = await buffer(id);
  if (!m || !buf) return false;
  // One voice at a time per pool: an impatient tap-tap-tap on the talk prompt
  // should interrupt, not build a chorus.
  try { activeFromPool.get(key)?.stop(); } catch { /* already ended */ }
  const src = m.ctx.createBufferSource();
  src.buffer = buf;
  if (gain === 1) { src.connect(m.sfx); } else {
    const g = m.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(m.sfx);
  }
  src.addEventListener('ended', () => {
    if (activeFromPool.get(key) === src) activeFromPool.delete(key);
  }, { once: true });
  activeFromPool.set(key, src);
  src.start();
  return true;
}

// ---------- voice ----------
let currentVoice = null;

/**
 * Play a narration clip.
 * @returns {null | { ended: Promise<void>, stop: () => void, el: HTMLAudioElement }}
 *          null when there is no such clip, which is the caller's signal to
 *          fall back to plain tap-to-continue.
 */
function playVoice(id) {
  if (!has('voice', id) || Settings.get('sound') === false) return null;
  const m = mixer();
  if (!m) return null;
  stopVoice();
  const el = new Audio(url('voice', id));
  el.preload = 'auto';
  if (!route(el, m.voice)) return null;
  let done = null;
  const ended = new Promise((res) => { done = res; });
  el.addEventListener('ended', () => done(), { once: true });
  el.addEventListener('error', () => done(), { once: true }); // never stall a beat
  const handle = {
    el,
    ended,
    stop() {
      try { el.pause(); el.currentTime = 0; } catch { /* detached */ }
      done();
      if (currentVoice === handle) currentVoice = null;
    },
  };
  currentVoice = handle;
  el.play().catch(() => done()); // autoplay refusal must not hang the story
  return handle;
}

function stopVoice() { currentVoice?.stop(); }

// Warm the next line's file while the current one is still talking, so the gap
// between narrator boxes is not a download.
function prefetchVoice(id) {
  if (!has('voice', id)) return;
  const el = new Audio();
  el.preload = 'auto';
  el.src = url('voice', id);
}

// ---------- music ----------
let musicEl = null;
let musicId = null;

function playMusic(id, { loop = true, fade = 1.2 } = {}) {
  if (musicId === id) return;
  if (!has('music', id)) { stopMusic(fade); return; }
  const m = mixer();
  if (!m) return;
  stopMusic(fade);
  const el = new Audio(url('music', id));
  el.loop = loop;
  el.preload = 'auto';
  if (!route(el, m.music)) return;
  musicEl = el;
  musicId = id;
  // fade in on the bus so a track never slams in over a narrator line
  const g = m.music.gain;
  const target = g.value;
  g.cancelScheduledValues(m.ctx.currentTime);
  g.setValueAtTime(0.0001, m.ctx.currentTime);
  g.linearRampToValueAtTime(target, m.ctx.currentTime + fade);
  el.play().catch(() => { /* still locked; the next gesture will start it */ });
}

function stopMusic(fade = 0.8) {
  const el = musicEl;
  if (!el) return;
  musicEl = null;
  musicId = null;
  const m = buses;
  if (m) {
    const g = m.music.gain;
    const from = g.value;
    g.cancelScheduledValues(m.ctx.currentTime);
    g.setValueAtTime(from, m.ctx.currentTime);
    g.linearRampToValueAtTime(0.0001, m.ctx.currentTime + fade);
    setTimeout(() => { try { el.pause(); } catch { /* gone */ } g.value = from; }, fade * 1000 + 60);
  } else {
    try { el.pause(); } catch { /* gone */ }
  }
}

// ---------- lifecycle ----------
// audio.js already creates its context on the first gesture, which is the right
// way to satisfy autoplay policy. What it never had is a resume: a context
// suspended by a phone call, a lock screen or a backgrounded tab stayed
// suspended for the rest of the session and the game went quiet for good.
function resume() {
  const ctx = SFX.ctx;
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
addEventListener('pointerdown', resume, { passive: true });
addEventListener('keydown', resume);

export const Sound = {
  loadManifest,
  has,
  playVoice,
  stopVoice,
  prefetchVoice,
  playFromPool,
  playMusic,
  stopMusic,
  resume,
  async playSfx(id, { gain = 1 } = {}) {
    const m = mixer();
    const buf = await buffer(id);
    if (!m || !buf) return false;
    const src = m.ctx.createBufferSource();
    src.buffer = buf;
    if (gain === 1) { src.connect(m.sfx); } else {
      const g = m.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(m.sfx);
    }
    src.start();
    return true;
  },
};
