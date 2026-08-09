// fx.js — pooled, allocation-free visual-effects toolkit (owned by the FX layer).
//
// LIFECYCLE / API CONTRACT (wave-2 agents: read this header, it is the contract)
//   import { FX } from '../fx/fx.js';
//   FX.init(scene)      — once at boot (main.js already does this). Emitters
//                         called before init are safely ignored, never throw.
//   FX.update(dt)       — once per frame (main.js already does this).
//   FX.clear()          — instantly retires EVERY live effect. Call at act/beat
//                         transitions if lingering fx would look wrong.
//   FX.removeHandle(h)  — stops a persistent pillar or an active trail handle.
//                         Safe to call with null/undefined/already-removed.
//
// EMITTERS — pos is any {x,y,z} (a THREE.Vector3 works; values are copied
// immediately, callers may reuse the object). All options optional; defaults:
//
//   FX.burst(pos, {color:0xffcc66, count:18, size:0.16, speed:4, life:0.55,
//                  gravity:6, spread:1, additive:true, alpha:1})
//     Spark/debris burst. additive:true = glowing sparks (knapping, strikes);
//     additive:false = matte debris (dirt from digging, water droplets).
//   FX.puff(pos, {color:0xcfc4a8, count:8, size:0.35, life:0.7, alpha:0.45})
//     Soft dust puff — slow, expanding, fading (footsteps, landings, crumbles).
//   FX.ring(pos, {color:0xffe9a8, radius:2.2, life:0.6, width:0.18})
//     Expanding flat ground ring — the "power activated" tell. width = ring
//     thickness as a fraction of radius (snaps to a thin or thick geometry).
//   FX.pillar(pos, {color:0x9fd8ff, height:6, life:2.5, opacity:0.22,
//                   pulse:false}) -> handle
//     Soft glowing translucent column marking a spot (survey dig-site marker).
//     life:0 = persistent (gentle shimmer) until FX.removeHandle(handle).
//     opacity = peak alpha (default 0.22, the soft marker look; wayfinder
//     beacons want ~0.4-0.5). pulse:true = a stronger 0.75-1.25 scale+alpha
//     breathing on the persistent mode so a far-off beacon reads as "go here".
//   FX.pulseWave(pos, {color:0x8fd0ff, maxRadius:10, life:1.2})
//     Big expanding translucent hemisphere — reads as a radar sweep (geologist
//     strata-scan, archaeologist survey).
//   FX.floaties(pos, {color:0xaef0c8, count:10, size:0.12, life:1.6, rise:1.2})
//     Gentle rising glow motes — magic/insight feel (reading a fossil, a clue).
//   FX.trail(getPos, {color:0xfff0b0, size:0.1, life:0.5, rate:30}) -> handle
//     Leaves fading motes at getPos() every frame while active (thrown line,
//     guided path). getPos must return {x,y,z}. Stop with FX.removeHandle(h).
//   FX.flames(getPosOrPos, {color:0xff9d3c, size:0.34, rate:30}) -> handle
//     Continuous campfire flame: rising, shrinking particles that hue-shift
//     yellow-white core -> orange -> dark red over a ~1.2 block rise. Reads
//     from 10+ blocks away. Accepts a fixed {x,y,z} (copied) or a getPos()
//     function. Throttled internally, <= ~40 live particles per flame.
//     Persistent until FX.removeHandle(h) (FX.clear() also retires it).
//   FX.smoke(pos, {rate:3, life:3}) -> handle
//     Slow grey puffs rising 3-5 blocks with drift, growth and fade above a
//     fire/kiln. <= ~12 live particles per column. Persistent until
//     FX.removeHandle(h) (FX.clear() also retires it).
//   FX.flash(pos, {color:0xffffff, size:1.1, life:0.15})
//     One quick additive billboard flash (knapping strike, documentation photo).
//   FX.confetti(pos, {count:26, size:0.14, life:1.1, speed:3.5})
//     Multicolour celebratory burst for quest completions.
//
// PERF NOTES (low-end Android budget)
//   Particles: exactly two THREE.Points draw calls — one additive pool (900)
//   and one normal-blend pool (600), per-particle color/size/alpha packed in
//   buffer attributes, CPU-integrated, oldest-steal when full, zero allocation
//   at steady state. The tiny point shader exists only to read those per-
//   particle attributes; it is flat-shaded, cheaper than MeshBasic per pixel.
//   Meshes: pooled MeshBasicMaterial objects — 10 rings, 6 pillars, 4 waves —
//   geometries shared, one cloned material per pooled instance (tinted via
//   material.color). Any single emitter call stays ≤ ~200 particles.
//   Teardown-safe: everything lives under FX's own group on renderer.scene
//   (which persists across acts); if anything ever detaches the group,
//   update() re-attaches it.

import * as THREE from '../../vendor/three.module.js';
import { QUALITY } from '../constants.js';

// Pools are split 60/40 additive vs normal-blend out of the tier's total.
// Particles are the cheapest thing to trim on a weak GPU: they are large
// overlapping transparent quads, so they cost pure fill rate, and a thinner
// confetti burst still reads as a confetti burst.
const ADD_CAP = Math.round(QUALITY.particleCap * 0.6);  // additive particle pool
const NORM_CAP = QUALITY.particleCap - ADD_CAP;         // normal-blend particle pool
const MAX_POINT_PX = 64; // clamp near-camera quads: fill-rate guard

const VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(${MAX_POINT_PX}.0, aSize * uScale / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = vAlpha * smoothstep(0.5, 0.16, length(d));
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }`;

const rnd = (a, b) => a + Math.random() * (b - a);
const _c = new THREE.Color(); // shared scratch — emitters are synchronous

// ---------------------------------------------------------------- particles
class ParticlePool {
  constructor(cap, blending, pointScale) {
    this.cap = cap;
    this.cursor = 0; // ring cursor: when full, steals the oldest slot
    this.posA = new Float32Array(cap * 3);
    this.colA = new Float32Array(cap * 3);
    this.sizeA = new Float32Array(cap);
    this.alphaA = new Float32Array(cap);
    // sim state (CPU only)
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.ttl = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.a0 = new Float32Array(cap);
    this._dirty = false;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.colA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sizeA, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphaA, 1).setUsage(THREE.DynamicDrawUsage));
    this.geom = g;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: pointScale } },
      blending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false; // particles scatter; never cull the pool
  }

  spawn(x, y, z, vx, vy, vz, cr, cg, cb, size, life, gravity, drag, grow, alpha) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.cap;
    const j = i * 3;
    this.posA[j] = x; this.posA[j + 1] = y; this.posA[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.colA[j] = cr; this.colA[j + 1] = cg; this.colA[j + 2] = cb;
    this.size0[i] = size; this.sizeA[i] = size;
    this.life[i] = life; this.ttl[i] = life;
    this.grav[i] = gravity; this.drag[i] = drag; this.grow[i] = grow;
    this.a0[i] = alpha; this.alphaA[i] = alpha;
    this._dirty = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) { this.alphaA[i] = 0; this.sizeA[i] = 0; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j] *= d;
      this.vel[j + 1] = this.vel[j + 1] * d - this.grav[i] * dt;
      this.vel[j + 2] *= d;
      this.posA[j] += this.vel[j] * dt;
      this.posA[j + 1] += this.vel[j + 1] * dt;
      this.posA[j + 2] += this.vel[j + 2] * dt;
      const t = this.life[i] / this.ttl[i]; // 1 -> 0
      this.alphaA[i] = this.a0[i] * t;
      this.sizeA[i] = Math.max(0.001, this.size0[i] + this.grow[i] * (this.ttl[i] - this.life[i]));
    }
    if (any || this._dirty) {
      const at = this.geom.attributes;
      at.position.needsUpdate = true;
      at.aColor.needsUpdate = true;
      at.aSize.needsUpdate = true;
      at.aAlpha.needsUpdate = true;
      this._dirty = any; // one extra flush after the last particle dies
    }
  }

  clear() {
    this.life.fill(0);
    this.alphaA.fill(0);
    this.sizeA.fill(0);
    this._dirty = true;
  }
}

// ---------------------------------------------------------------- mesh pools
// Slot: { mesh, live, t, life, radius/height…, dying, base }. Pools are tiny;
// alloc() takes a free slot or steals the most-finished live one.
function allocSlot(slots) {
  let best = null, bestP = -1;
  for (const s of slots) {
    if (!s.live) return s;
    const p = s.life > 0 ? s.t / s.life : s.t; // persistent pillars: steal oldest
    if (p > bestP) { bestP = p; best = s; }
  }
  return best;
}

function makeBasicMat(blending) {
  return new THREE.MeshBasicMaterial({
    blending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
}

// ---------------------------------------------------------------- FX singleton
export const FX = {
  _scene: null,
  _group: null,
  _add: null,
  _norm: null,
  _rings: [],
  _pillars: [],
  _waves: [],
  _trails: [],
  _emitters: [], // persistent flame/smoke emitters (handle-based)
  _ringThin: null,
  _ringThick: null,

  // Call once at boot with the persistent renderer.scene. Idempotent; a second
  // call with a different scene just re-parents the FX group.
  init(scene) {
    if (this._group) {
      if (scene && scene !== this._scene) { this._scene = scene; scene.add(this._group); }
      return;
    }
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = 'FX';
    scene.add(this._group);

    // point-size scale: world-unit particle sizes at the game camera's 70° fov
    let h = 800, pr = 1;
    if (typeof window !== 'undefined') {
      h = window.innerHeight || 800;
      pr = Math.min(window.devicePixelRatio || 1, 1.5); // mirrors PERF.MAX_PIXEL_RATIO
    }
    const pointScale = (h * pr) / (2 * Math.tan((70 * Math.PI / 180) / 2));

    this._add = new ParticlePool(ADD_CAP, THREE.AdditiveBlending, pointScale);
    this._norm = new ParticlePool(NORM_CAP, THREE.NormalBlending, pointScale);
    this._group.add(this._add.points, this._norm.points);

    // rings (10) — shared thin/thick geometries, cloned material per instance
    this._ringThin = new THREE.RingGeometry(0.86, 1, 28);
    this._ringThick = new THREE.RingGeometry(0.6, 1, 28);
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(this._ringThin, makeBasicMat(THREE.AdditiveBlending));
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this._group.add(mesh);
      this._rings.push({ mesh, live: false, t: 0, life: 1, radius: 1 });
    }

    // pillars (6) — open cylinders
    const pillarGeom = new THREE.CylinderGeometry(0.55, 0.55, 1, 10, 1, true);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(pillarGeom, makeBasicMat(THREE.AdditiveBlending));
      mesh.visible = false;
      this._group.add(mesh);
      this._pillars.push({ mesh, live: false, t: 0, life: 0, dying: false, dieT: 0, base: 0.22, pulse: false });
    }

    // pulse waves (4) — hemispheres
    const waveGeom = new THREE.SphereGeometry(1, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(waveGeom, makeBasicMat(THREE.AdditiveBlending));
      mesh.visible = false;
      this._group.add(mesh);
      this._waves.push({ mesh, live: false, t: 0, life: 1, maxRadius: 10 });
    }
  },

  // Advance all live effects. Cheap when idle (early-outs on dead slots).
  update(dt) {
    if (!this._group) return;
    // resilience: if an act teardown ever detached the FX group, re-attach it
    if (this._scene && this._group.parent !== this._scene) this._scene.add(this._group);

    this._add.update(dt);
    this._norm.update(dt);

    for (const s of this._rings) {
      if (!s.live) continue;
      s.t += dt;
      const p = Math.min(1, s.t / s.life);
      if (p >= 1) { s.live = false; s.mesh.visible = false; continue; }
      const e = 1 - (1 - p) * (1 - p); // ease-out
      const r = Math.max(0.05, s.radius * (0.12 + 0.88 * e));
      s.mesh.scale.set(r, r, 1);
      s.mesh.material.opacity = 0.85 * (1 - p);
    }

    for (const s of this._pillars) {
      if (!s.live) continue;
      s.t += dt;
      if (s.dying) {
        s.dieT -= dt;
        if (s.dieT <= 0) { s.live = false; s.mesh.visible = false; continue; }
        s.mesh.material.opacity = s.base * (s.dieT / 0.25);
      } else if (s.life > 0) {
        const p = s.t / s.life;
        if (p >= 1) { s.live = false; s.mesh.visible = false; continue; }
        const env = Math.min(1, p * 6) * Math.min(1, (1 - p) * 2.5); // in/out
        s.mesh.material.opacity = s.base * env;
      } else if (s.pulse) {
        // persistent + pulse: fade in, then breathe 0.75–1.25 in both alpha
        // and girth (scale.y carries the height — only x/z breathe)
        const fadeIn = Math.min(1, s.t / 0.35);
        const b = 1 + 0.25 * Math.sin(s.t * 2.2);
        s.mesh.material.opacity = Math.min(1, s.base * fadeIn * b);
        s.mesh.scale.x = b;
        s.mesh.scale.z = b;
      } else {
        // persistent: fade in, then a slow gentle pulse
        const fadeIn = Math.min(1, s.t / 0.35);
        s.mesh.material.opacity = s.base * fadeIn * (0.8 + 0.2 * Math.sin(s.t * 2.6));
      }
    }

    for (const s of this._waves) {
      if (!s.live) continue;
      s.t += dt;
      const p = Math.min(1, s.t / s.life);
      if (p >= 1) { s.live = false; s.mesh.visible = false; continue; }
      const e = 1 - (1 - p) * (1 - p) * (1 - p); // strong ease-out: radar snap
      const r = Math.max(0.05, s.maxRadius * e);
      s.mesh.scale.set(r, r * 0.6, r); // slightly squashed dome reads better
      s.mesh.material.opacity = 0.32 * (1 - p);
    }

    if (this._trails.length) {
      for (let i = this._trails.length - 1; i >= 0; i--) {
        const tr = this._trails[i];
        if (!tr.live) { this._trails.splice(i, 1); continue; }
        tr.acc += dt * tr.rate;
        const pos = tr.getPos();
        if (!pos) continue;
        while (tr.acc >= 1) {
          tr.acc -= 1;
          this._add.spawn(
            pos.x + rnd(-0.05, 0.05), pos.y + rnd(-0.05, 0.05), pos.z + rnd(-0.05, 0.05),
            rnd(-0.15, 0.15), rnd(0, 0.25), rnd(-0.15, 0.15),
            tr.r, tr.g, tr.b, tr.size, tr.life, 0, 1.5, -tr.size * 0.6, 0.8,
          );
        }
      }
    }

    if (this._emitters.length) {
      for (let i = this._emitters.length - 1; i >= 0; i--) {
        const em = this._emitters[i];
        if (!em.live) { this._emitters.splice(i, 1); continue; }
        // throttle: after a stall (tab hidden, long frame) don't dump a burst
        em.acc = Math.min(em.acc + dt * em.rate, 3);
        if (em.acc < 1) continue;
        const pos = em.getPos();
        if (!pos) continue;
        if (em.kind === 'flames') {
          while (em.acc >= 1) {
            em.acc -= 1;
            // band 0..1 decides a particle's fate: short-lived bright ones die
            // near the base, long-lived dark ones survive to the tip — with
            // additive blending the base sums to a yellow-white core and the
            // top thins out to sparse dark red. life <= 1.0 keeps a flame at
            // rate 40/s under ~40 live particles.
            const band = Math.random();
            const life = 0.5 + band * 0.5;
            let r, g, b;
            if (band < 0.35) { // core: near-white
              r = em.mr + (1 - em.mr) * 0.8; g = em.mg + (1 - em.mg) * 0.75; b = em.mb + (1 - em.mb) * 0.55;
            } else if (band < 0.7) { // body: the flame color itself
              r = em.mr; g = em.mg; b = em.mb;
            } else { // tip: dark red
              r = em.mr * 0.6; g = em.mg * 0.22; b = em.mb * 0.12;
            }
            const spread = em.size * 0.55;
            const sz = em.size * rnd(0.8, 1.25) * (1.15 - 0.5 * band);
            this._add.spawn(
              pos.x + rnd(-spread, spread), pos.y + rnd(0, 0.15), pos.z + rnd(-spread, spread),
              rnd(-0.14, 0.14), rnd(1.15, 1.75), rnd(-0.14, 0.14), // ~1.2 block rise over a life
              r, g, b, sz, life, -0.35, 0.7, -sz / life * 0.85, 0.95, // slight upward lick, shrink to nothing
            );
          }
        } else { // smoke
          while (em.acc >= 1) {
            em.acc -= 1;
            const grey = rnd(0.5, 0.62);
            const life = em.life * rnd(0.85, 1.2);
            this._norm.spawn(
              pos.x + rnd(-0.12, 0.12), pos.y, pos.z + rnd(-0.12, 0.12),
              rnd(-0.22, 0.28), rnd(1.25, 1.8), rnd(-0.2, 0.24), // 3-5 block rise with sideways drift
              grey, grey, grey, 0.34 * rnd(0.8, 1.2), life,
              -0.05, 0.15, 0.26, 0.3, // near-buoyant, grows as it fades
            );
          }
        }
      }
    }
  },

  // Instantly retire every live effect (safe at beat/act transitions).
  clear() {
    if (!this._group) return;
    this._add.clear();
    this._norm.clear();
    for (const s of this._rings) { s.live = false; s.mesh.visible = false; }
    for (const s of this._pillars) { s.live = false; s.dying = false; s.mesh.visible = false; }
    for (const s of this._waves) { s.live = false; s.mesh.visible = false; }
    for (const tr of this._trails) tr.live = false;
    this._trails.length = 0;
    for (const em of this._emitters) em.live = false;
    this._emitters.length = 0;
  },

  // Stops a persistent pillar (fades out over 0.25s), a trail, or a
  // flames/smoke emitter. Null-safe.
  removeHandle(h) {
    if (!h) return;
    if (h.kind === 'pillar') {
      const s = h.slot;
      if (s && s.live && !s.dying) { s.dying = true; s.dieT = 0.25; }
    } else if (h.kind === 'trail' || h.kind === 'flames' || h.kind === 'smoke') {
      h.live = false;
    }
  },

  // ------------------------------------------------------------- emitters
  burst(pos, o = {}) {
    if (!this._group) return;
    const count = Math.min(200, o.count ?? 18);
    const size = o.size ?? 0.16, speed = o.speed ?? 4, life = o.life ?? 0.55;
    const gravity = o.gravity ?? 6, spread = o.spread ?? 1, alpha = o.alpha ?? 1;
    const pool = (o.additive ?? true) ? this._add : this._norm;
    _c.setHex(o.color ?? 0xffcc66);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const hv = speed * spread * (0.25 + 0.75 * Math.random());
      pool.spawn(
        pos.x + rnd(-0.1, 0.1), pos.y + rnd(-0.05, 0.1), pos.z + rnd(-0.1, 0.1),
        Math.cos(ang) * hv, speed * rnd(0.35, 1.1), Math.sin(ang) * hv,
        _c.r, _c.g, _c.b, size * rnd(0.7, 1.3), life * rnd(0.7, 1.2),
        gravity, 1.2, 0, alpha,
      );
    }
  },

  puff(pos, o = {}) {
    if (!this._group) return;
    const count = Math.min(200, o.count ?? 8);
    const size = o.size ?? 0.35, life = o.life ?? 0.7, alpha = o.alpha ?? 0.45;
    _c.setHex(o.color ?? 0xcfc4a8);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const hv = rnd(0.2, 0.8);
      this._norm.spawn(
        pos.x + rnd(-0.15, 0.15), pos.y + rnd(0, 0.15), pos.z + rnd(-0.15, 0.15),
        Math.cos(ang) * hv, rnd(0.1, 0.5), Math.sin(ang) * hv,
        _c.r, _c.g, _c.b, size * rnd(0.7, 1.2), life * rnd(0.8, 1.2),
        0, 2.2, size * 1.1, alpha, // grows as it fades: soft dust
      );
    }
  },

  ring(pos, o = {}) {
    if (!this._group) return;
    const s = allocSlot(this._rings);
    const width = o.width ?? 0.18;
    s.live = true; s.t = 0;
    s.life = o.life ?? 0.6;
    s.radius = o.radius ?? 2.2;
    s.mesh.geometry = width >= 0.3 ? this._ringThick : this._ringThin;
    s.mesh.position.set(pos.x, pos.y + 0.07, pos.z); // hover: no z-fight with ground
    s.mesh.material.color.setHex(o.color ?? 0xffe9a8);
    s.mesh.material.opacity = 0.85;
    s.mesh.scale.set(0.05, 0.05, 1);
    s.mesh.visible = true;
  },

  pillar(pos, o = {}) {
    if (!this._group) return null;
    const s = allocSlot(this._pillars);
    const height = o.height ?? 6;
    s.live = true; s.dying = false; s.t = 0;
    s.life = o.life ?? 2.5; // 0 => persistent until removeHandle
    // per-instance opacity is safe: every pooled pillar mesh owns its own
    // cloned MeshBasicMaterial (see init) — no cross-instance bleed
    s.base = Math.max(0, Math.min(1, o.opacity ?? 0.22));
    s.pulse = !!o.pulse;
    s.mesh.position.set(pos.x, pos.y + height / 2, pos.z);
    s.mesh.scale.set(1, height, 1);
    s.mesh.material.color.setHex(o.color ?? 0x9fd8ff);
    s.mesh.material.opacity = 0;
    s.mesh.visible = true;
    return { kind: 'pillar', slot: s };
  },

  pulseWave(pos, o = {}) {
    if (!this._group) return;
    const s = allocSlot(this._waves);
    s.live = true; s.t = 0;
    s.life = o.life ?? 1.2;
    s.maxRadius = o.maxRadius ?? 10;
    s.mesh.position.set(pos.x, pos.y + 0.05, pos.z);
    s.mesh.material.color.setHex(o.color ?? 0x8fd0ff);
    s.mesh.material.opacity = 0.32;
    s.mesh.scale.set(0.05, 0.03, 0.05);
    s.mesh.visible = true;
  },

  floaties(pos, o = {}) {
    if (!this._group) return;
    const count = Math.min(200, o.count ?? 10);
    const size = o.size ?? 0.12, life = o.life ?? 1.6, rise = o.rise ?? 1.2;
    _c.setHex(o.color ?? 0xaef0c8);
    for (let i = 0; i < count; i++) {
      this._add.spawn(
        pos.x + rnd(-0.6, 0.6), pos.y + rnd(0, 0.7), pos.z + rnd(-0.6, 0.6),
        rnd(-0.18, 0.18), rise * rnd(0.55, 1.15), rnd(-0.18, 0.18),
        _c.r, _c.g, _c.b, size * rnd(0.7, 1.3), life * rnd(0.7, 1.25),
        0, 0.35, 0, 0.85,
      );
    }
  },

  trail(getPos, o = {}) {
    if (!this._group || typeof getPos !== 'function') return null;
    _c.setHex(o.color ?? 0xfff0b0);
    const tr = {
      kind: 'trail', live: true, getPos, acc: 0,
      rate: o.rate ?? 30, life: o.life ?? 0.5, size: o.size ?? 0.1,
      r: _c.r, g: _c.g, b: _c.b,
    };
    this._trails.push(tr);
    return tr;
  },

  // Continuous flame emitter. Accepts a fixed {x,y,z} (values copied) or a
  // getPos() function. rate*max-life is capped so one flame stays <= ~40 live.
  flames(posOrGetPos, o = {}) {
    if (!this._group || posOrGetPos == null) return null;
    let getPos;
    if (typeof posOrGetPos === 'function') {
      getPos = posOrGetPos;
    } else {
      const p = { x: posOrGetPos.x, y: posOrGetPos.y, z: posOrGetPos.z };
      getPos = () => p;
    }
    _c.setHex(o.color ?? 0xff9d3c);
    const em = {
      kind: 'flames', live: true, getPos, acc: 0,
      rate: Math.min(40, Math.max(1, o.rate ?? 30)),
      size: o.size ?? 0.34,
      mr: _c.r, mg: _c.g, mb: _c.b,
    };
    this._emitters.push(em);
    return em;
  },

  // Slow grey smoke column above a fire/kiln (pos values copied).
  // rate is capped so one column stays <= ~12 live puffs.
  smoke(pos, o = {}) {
    if (!this._group || pos == null) return null;
    const p = { x: pos.x, y: pos.y, z: pos.z };
    const life = Math.max(0.5, o.life ?? 3);
    const em = {
      kind: 'smoke', live: true, getPos: () => p, acc: 0,
      rate: Math.min(12 / (life * 1.2), Math.max(0.2, o.rate ?? 3)),
      life,
    };
    this._emitters.push(em);
    return em;
  },

  flash(pos, o = {}) {
    if (!this._group) return;
    const size = o.size ?? 1.1, life = o.life ?? 0.15;
    _c.setHex(o.color ?? 0xffffff);
    // one big screen-facing additive particle: THREE.Points billboards for free
    this._add.spawn(
      pos.x, pos.y, pos.z, 0, 0, 0,
      _c.r, _c.g, _c.b, size, life, 0, 0, size * 3, 0.9,
    );
  },

  confetti(pos, o = {}) {
    if (!this._group) return;
    const count = Math.min(200, o.count ?? 26);
    const size = o.size ?? 0.14, life = o.life ?? 1.1, speed = o.speed ?? 3.5;
    const palette = [0xff5f6d, 0xffc24b, 0x5ad18b, 0x53a7f0, 0xc78bff, 0xfff3f0];
    for (let i = 0; i < count; i++) {
      _c.setHex(palette[i % palette.length]);
      const ang = Math.random() * Math.PI * 2;
      const hv = speed * rnd(0.2, 0.8);
      this._norm.spawn(
        pos.x + rnd(-0.2, 0.2), pos.y + rnd(0, 0.3), pos.z + rnd(-0.2, 0.2),
        Math.cos(ang) * hv, speed * rnd(0.7, 1.4), Math.sin(ang) * hv,
        _c.r, _c.g, _c.b, size * rnd(0.7, 1.4), life * rnd(0.75, 1.25),
        7, 1.1, 0, 1,
      );
    }
  },
};
