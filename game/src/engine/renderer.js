// Three.js setup: capped pixel ratio, fog, two lights, deliberate 30fps
// limiter, WebGL context-loss recovery (spec addendum §3).
// Sky: gradient dome + sun disc/glow + drifting cloud billboards, all derived
// from the two hexes acts already pass to setSky(skyHex, fogHex).
import * as THREE from '../../vendor/three.module.js';
import { PERF, QUALITY } from '../constants.js';

// matches this.sun.position (40, 60, 20) so the disc sits on the light
const SUN_DIR = new THREE.Vector3(40, 60, 20).normalize();

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, PERF.FAR_PLANE);
    this.onFrame = null; // (dt) => void
    this.paused = false;
    this._last = 0;
    this._acc = 0;
    this._frameInterval = 1 / PERF.TARGET_FPS;

    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, PERF.MAX_PIXEL_RATIO));

    this.sky = null; // group (dome + sun + clouds), follows the camera
    this._clouds = [];
    this.setSky(0x9ec8e8, 0xcfe0ee);

    // slightly golden key light; cool sky fill over warm earth bounce
    this.sun = new THREE.DirectionalLight(0xffe4b8, 1.2);
    this.sun.position.set(40, 60, 20);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xaecdea, 0x7d6a48, 0.95);
    this.scene.add(this.hemi);
    // very weak, slightly cool fill from the opposite azimuth: faces pointing
    // away from the sun (toward the camera in the default camp view) must
    // never drop to pure ambient black. Fill, not flattening — keep it faint.
    this.fill = new THREE.DirectionalLight(0xbdd2ec, 0.25);
    this.fill.position.set(-30, 40, -25);
    this.scene.add(this.fill);

    window.addEventListener('resize', () => this.resize());
    this.resize();

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.paused = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.paused = false;
      if (this.onContextRestored) this.onContextRestored();
    });

    requestAnimationFrame((t) => this._loop(t));

    // heartbeat: rAF starves in hidden/embedded tabs; keep game LOGIC ticking
    // at low rate so beats and interactions never wedge (rendering can wait)
    this._lastTick = performance.now();
    setInterval(() => {
      const now = performance.now();
      if (now - this._lastTick > 600 && !this.paused) {
        if (this.onFrame) this.onFrame(0.1);
        this._updateSky(0.1);
        this.gl.render(this.scene, this.camera);
        this._lastTick = now;
      }
    }, 300);
  }

  setSky(skyHex, fogHex) {
    const sky = new THREE.Color(skyHex);
    const fog = new THREE.Color(fogHex);
    // zenith: skyHex pushed darker and a touch more saturated
    const hsl = { h: 0, s: 0, l: 0 };
    sky.getHSL(hsl);
    const zenith = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.04), Math.max(0, hsl.l * 0.7));
    // horizon: fogHex warmed slightly; fog uses the SAME color so terrain
    // melts into the dome instead of banding against it
    const horizon = fog.clone().lerp(new THREE.Color(0xfff0d6), 0.22);

    if (!this.sky) this._buildSky();
    this._paintGradient(zenith, sky, fog, horizon);

    this.scene.background = zenith.clone(); // fallback fill behind the dome
    this.scene.fog = new THREE.Fog(horizon.clone(), PERF.FOG_NEAR, PERF.FAR_PLANE - 6);

    // hemisphere fill follows the era's sky so voxel tops stay in harmony
    if (this.hemi) this.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.3);

    // clouds sit slightly grey of the sky — never bright enough to read as a
    // second sun disc
    const cloudTint = new THREE.Color(0xe8ecef).lerp(sky, 0.18);
    for (const c of this._clouds) c.spr.material.color.copy(cloudTint);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(w, h, false);
  }

  // ---------- sky dome / sun / clouds ----------
  _buildSky() {
    const R = PERF.FAR_PLANE * 0.86;
    const group = new THREE.Group();

    // gradient dome (canvas strip stretched over an inverted sphere)
    this._gradCanvas = document.createElement('canvas');
    this._gradCanvas.width = 2;
    this._gradCanvas.height = 256;
    this._gradTex = new THREE.CanvasTexture(this._gradCanvas);
    this._gradTex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 20, 12),
      new THREE.MeshBasicMaterial({ map: this._gradTex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.frustumCulled = false;
    dome.renderOrder = -30;
    group.add(dome);

    // sun: soft additive glow behind a pale warm disc, sitting on SUN_DIR
    const glowTex = this._radialTex(128, [
      [0, 'rgba(255,236,200,0.55)'], [0.35, 'rgba(255,214,150,0.22)'], [1, 'rgba(255,200,120,0)'],
    ]);
    const discTex = this._radialTex(128, [
      [0, 'rgba(255,250,235,1)'], [0.42, 'rgba(255,242,210,0.95)'], [0.5, 'rgba(255,230,180,0.28)'], [0.62, 'rgba(255,220,160,0)'], [1, 'rgba(255,220,160,0)'],
    ]);
    const sunPos = SUN_DIR.clone().multiplyScalar(R * 0.93);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true,
    }));
    glow.position.copy(sunPos);
    glow.scale.setScalar(R * 0.55);
    glow.renderOrder = -20;
    group.add(glow);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: discTex, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true,
    }));
    disc.position.copy(sunPos);
    disc.scale.setScalar(R * 0.16);
    disc.renderOrder = -19;
    group.add(disc);

    // clouds: flat billboards orbiting the camera very slowly (fewer on the
    // low tier — they are large overlapping transparent sprites, so they cost
    // fill rate, which is the one thing a weak mobile GPU has least of)
    const cloudTexA = this._cloudTex(1);
    const cloudTexB = this._cloudTex(2);
    for (let i = 0; i < QUALITY.clouds; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: i % 2 ? cloudTexB : cloudTexA,
        transparent: true,
        // reviewers kept reporting the sky read as empty. Opacity is the one
        // lever here that is genuinely free: identical pixel count, identical
        // blend, the sprite is just less see-through. Raised on every tier.
        opacity: 0.58 + (i % 3) * 0.06, // 0.58–0.70 — reads as weather, still soft
        fog: false,
        depthWrite: false,
      }));
      const a = (i / QUALITY.clouds) * Math.PI * 2 + (i * 0.7) % 1;
      const r = R * (0.5 + ((i * 37) % 10) / 40); // 0.5R..0.72R
      const h = R * (0.26 + ((i * 53) % 10) / 45); // 0.26R..0.46R
      // Size is deliberately NOT touched. A bigger sprite is more fill rate,
      // and fill rate is the one thing a weak mobile GPU has least of (§12).
      // A first attempt grew these on the "high" tier only, on the assumption
      // that high meant desktop. It does not: pickTier() returns 'high' for
      // ANY coarse-pointer device with more than 4 cores or more than 4 GB,
      // which is most midrange Androids. The tier is a capability guess, not a
      // form factor. Presence comes from opacity and texture density instead,
      // both of which are free.
      const w = R * (0.26 + ((i * 29) % 10) / 40);
      spr.scale.set(w, w * 0.26, 1); // flat and wide: cloud bank, not a ball
      spr.renderOrder = -10;
      const c = { spr, a, r, h, speed: 0.004 + ((i * 13) % 5) * 0.0016 };
      spr.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      this._clouds.push(c);
      group.add(spr);
    }

    this.sky = group;
    this.scene.add(group);
  }

  _paintGradient(zenith, sky, fog, horizon) {
    const c = this._gradCanvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 256); // y=0 → zenith (flipY)
    g.addColorStop(0, '#' + zenith.getHexString());
    g.addColorStop(0.42, '#' + sky.getHexString());
    g.addColorStop(0.62, '#' + sky.clone().lerp(fog, 0.55).getHexString());
    g.addColorStop(0.78, '#' + fog.getHexString());
    g.addColorStop(0.86, '#' + horizon.getHexString());
    g.addColorStop(1, '#' + horizon.clone().lerp(fog, 0.5).getHexString());
    c.fillStyle = g;
    c.fillRect(0, 0, 2, 256);
    this._gradTex.needsUpdate = true;
  }

  _radialTex(size, stops) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [t, col] of stops) g.addColorStop(t, col);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _cloudTex(seed) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    // one CONNECTED lumpy mass: big overlapping puffs marched tightly across
    // the strip (step ~24–30px vs radii 20–50, so neighbours always merge)
    // with a bumpy top and flatter base — a cumulus bank, not a dot row.
    // The elongated strip + flat sprite aspect keeps it from ever reading as
    // a second sun; slightly grey so it can't match the warm disc either.
    // Deterministic per seed.
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 233280 + 9301) % 233280; return s / 233280; };
    const n = 8 + (seed % 3); // 8–10 puffs
    for (let i = 0; i < n; i++) {
      const x = 22 + (i / (n - 1)) * 212 + (rnd() - 0.5) * 14; // tight march, small jitter
      const r = 20 + rnd() * 30;                               // big enough to merge
      const y = 88 - r * 0.45 - rnd() * 14;                    // bumpy top, flatter base
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
      // denser core, fade held back to the outer fifth: the old stops spent
      // half the radius already half transparent, which is what made the banks
      // read as haze. Costs nothing, the canvas is built once per seed.
      g.addColorStop(0, 'rgba(240,243,247,1)');
      g.addColorStop(0.5, 'rgba(232,237,243,0.82)');
      g.addColorStop(0.82, 'rgba(228,233,240,0.3)');
      g.addColorStop(1, 'rgba(226,231,238,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // keep the dome centred on the camera and drift the clouds; cheap enough
  // to run every rendered frame
  _updateSky(dt) {
    if (!this.sky) return;
    this.sky.position.copy(this.camera.position);
    for (const c of this._clouds) {
      c.a += c.speed * dt;
      c.spr.position.set(Math.cos(c.a) * c.r, c.h, Math.sin(c.a) * c.r);
    }
  }

  _loop(t) {
    requestAnimationFrame((tt) => this._loop(tt));
    if (this.paused) { this._last = t; return; }
    const dt = Math.min(0.1, (t - this._last) / 1000 || 0);
    this._last = t;
    this._acc += dt;
    // frame limiter: render at most TARGET_FPS; skip fast frames to flatten
    // the thermal curve on phones
    if (this._acc < this._frameInterval) return;
    const step = Math.min(this._acc, 0.1);
    // carry the remainder so non-multiple refresh rates hold the target rate,
    // but never bank more than one interval (no spiral after hitches)
    this._acc = Math.min(this._acc - this._frameInterval, this._frameInterval);
    this._lastTick = t;
    if (this.onFrame) this.onFrame(step);
    this._updateSky(step);
    this.gl.render(this.scene, this.camera);
  }
}
