// Web Audio: synthesized ambient bed + a handful of stingers. No assets.
// Everything is gentle and quiet — this is a classroom game.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this._unlocked = false;
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      this._init();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  // wind + occasional bird chirps, all synthesized
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);

    // wind: filtered noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    src.connect(lp);
    lp.connect(g);
    src.start();

    // slow wind swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.028;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    lfo.start();

    this.ambient = { g, src, lfo };
    this._birdTimer = setInterval(() => {
      if (Math.random() < 0.5) this._bird();
    }, 6000);
  }

  _bird() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    const t = ctx.currentTime;
    const f0 = 1900 + Math.random() * 900;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.17);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  _tone(freq, { dur = 0.4, type = 'sine', gain = 0.09, when = 0, sweep = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  blip() { this._tone(660, { dur: 0.09, gain: 0.05, type: 'triangle' }); }
  success() {
    this._tone(523, { dur: 0.16, gain: 0.07 });
    this._tone(659, { dur: 0.18, gain: 0.07, when: 0.11 });
    this._tone(784, { dur: 0.3, gain: 0.07, when: 0.22 });
  }
  discover() {
    this._tone(392, { dur: 0.5, gain: 0.06, type: 'triangle' });
    this._tone(587, { dur: 0.7, gain: 0.05, when: 0.18, type: 'triangle' });
  }
  trick() {
    this._tone(220, { dur: 0.5, gain: 0.09, type: 'square', sweep: 110 });
  }
  hush() {
    // grave scene: a single low, soft tone
    this._tone(147, { dur: 1.6, gain: 0.05, type: 'sine' });
  }
  step() { this._tone(880, { dur: 0.05, gain: 0.02, type: 'triangle' }); }
}

// shared singleton — import { SFX } anywhere a sting is needed
export const SFX = new GameAudio();
