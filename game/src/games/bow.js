// The bow, shared by the Act 1 hunt (games/hunt.js) and the training post
// (games/range.js).
//
// 2026-10-30: "shooting the animals with arrows does not feel satisfying. the
// aiming is weird, the shooting is weird." What this changes:
//  - The arrow lands where the crosshair points. At release a ray from the
//    camera finds what the crosshair is on, and the arrow is launched on the
//    arc that lands there. The old arrow left the head with an upward kick
//    under heavy gravity and fell 1.8 blocks short at 15 blocks.
//  - Hold to draw, let go to shoot. A tap on the world never shoots, so a
//    small aiming nudge on a phone no longer looses an arrow.
//  - The draw is the skill. A full draw flies fast and true; a short one
//    flies slow and wobbles. Under MIN_DRAW nothing leaves the string.
//  - Arrows stick where they land, and a hit is felt: a short pause, a thud,
//    a kick of the camera, a mark on the crosshair.
import * as THREE from '../../vendor/three.module.js';
import { SFX } from '../audio.js';
import { Sound } from '../sound.js';
import { FX } from '../fx/fx.js';
import { isSolid } from '../world/blocks.js';
import { foldStatic, MERGED_MAT } from '../world/merge.js';
import { S } from '../strings.js';
import { Inv } from '../inventory.js';
import { syncEquipment } from '../ui/equipment.js';

export const BOW = {
  DRAW_TIME: 0.55,  // seconds from rest to full draw
  MIN_DRAW: 0.18,   // a shorter pull is a cancel, not a shot
  SPEED_MIN: 24,    // blocks per second at MIN_DRAW
  SPEED_MAX: 54,    // and at full draw
  GRAVITY: 9.8,
  WOBBLE: 0.06,     // radians of scatter at the weakest draw, none at full
  LIFE: 4,          // seconds in the air before a lost arrow is dropped
  GROUND_LIFE: 6,   // a miss stays stuck in the ground this long
  MAX_ARROWS: 16,   // oldest stuck arrows go first past this
  AIM_RANGE: 90,
  RELOAD: 0.35,     // the next arrow is on the string after this
  HIT_STOP: 0.07,   // the world holds still this long on a hit
};

const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _prev = new THREE.Vector3();

// One arrow is one mesh: shaft, stone head and two ochre fins are folded into
// a single vertex-coloured geometry, built once and shared by every arrow.
let arrowGeo = null;
function arrowGeometry() {
  if (arrowGeo) return arrowGeo;
  const g = new THREE.Group();
  const part = (w, h, d, color, z, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.z = z; m.rotation.z = rz;
    g.add(m);
  };
  part(0.035, 0.035, 0.72, 0xcdb48a, 0);
  part(0.075, 0.05, 0.11, 0x3a3530, 0.38);
  part(0.008, 0.09, 0.15, 0xb4532f, -0.29);
  part(0.008, 0.09, 0.15, 0xb4532f, -0.29, Math.PI / 2);
  foldStatic(g);
  arrowGeo = g.children[0].geometry;
  return arrowGeo;
}
// Arrows stuck in a target leave with it; this keeps a target's disposal
// (targets.js dropTarget) from freeing the one geometry every arrow shares.
function arrowMesh() {
  const m = new THREE.Mesh(arrowGeometry(), MERGED_MAT);
  m.userData.shared = true;
  return m;
}

// The arc from `from` that lands on `to` at speed v: the flatter of the two
// solutions. Out of reach, the 45 degree shot (the farthest it can go).
function launch(from, to, v, g) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return null;
  const v2 = v * v, disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  const a = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * d));
  return new THREE.Vector3((dx / d) * v * Math.cos(a), v * Math.sin(a), (dz / d) * v * Math.cos(a));
}

function orient(obj, vel) {
  obj.quaternion.setFromUnitVectors(_Z, _d.copy(vel).normalize());
}

// The hint under the crosshair, in the words of the device in hand.
export function bowHint(G) {
  return G.input.isTouch ? S.range.hintTouch : S.range.hintKeys;
}

// In the story the bow is up whenever it is equipped (the user, 2026-10-31:
// "when a player equips the bow and arrow, automatically the crosshair should
// come"). The equip control (button or Q) is the one switch: put it away to
// walk in third person, equip it again to aim. equipBow() puts it in hand at
// the start of a shooting beat; call the returned function every tick.
export function equipBow(G) {
  if (Inv.selectTool('bow', true)) syncEquipment(G);
}
export function bowFollowsEquip(G, bow) {
  return () => {
    const want = Inv.equippedTool() === 'bow';
    bow.followsEquip = true;
    if (want && !bow.raised) { bow.raise(); G.hud.hint(bowHint(G), 7000); }
    else if (!want && bow.raised) { bow.lower(); G.hud.hint(S.range.equipHint, 6000); }
  };
}

// A target is anything with hitTest(p0, p1): given a segment of an arrow's
// path it returns null, or { f, point, parent, points, tier } where f is how
// far along the segment the arrow meets it, point is that place in the world,
// parent is what the arrow sticks into, and tier (0 plain, 1 good, 2 centre)
// picks the sound and the crosshair mark. anchor(v), optional, writes the
// target's centre into v and returns it (see _aimPoint).
export class Bow {
  constructor(G, { targets = () => [], canShoot = () => true, onLoose = null, onHit = null, onMiss = null, walkWhileDrawing = 0.35 } = {}) {
    Object.assign(this, { G, targets, canShoot, onLoose, onHit, onMiss, walkWhileDrawing });
    this.arrows = [];
    this.draw = 0;
    this.drawing = false;
    this.raised = false;
    this.hitStop = 0;
    this.reload = 0;
    this._held = { button: false, mouse: false };
    this._t = 0;
    this._built = false;
  }

  // Up to the eye: first person, the bow in view, the draw control on screen.
  raise() {
    if (this.raised) return;
    this._build();
    this.raised = true;
    const { G } = this;
    const cam = G.renderer.camera;
    if (!cam.parent) G.renderer.scene.add(cam); // the bow in view rides on the camera
    cam.add(this.vm.group);
    G.player.setFirstPerson(true);
    G.player.noJump = true;
    this.ui.classList.add('on');
    this.ui.classList.toggle('touch', G.input.isTouch);
    document.body.classList.add('bow-up'); // css: Draw takes the jump button's corner
    G.input.capture?.(true); // the mouse aims while the bow is up (engine/input.js)
    document.body.classList.toggle('bow-equip', !!this.followsEquip); // ui/equipment.js: Put away stays on screen
  }

  // Back down: third person. Arrows already loosed keep flying.
  lower() {
    if (!this.raised) return;
    this.raised = false;
    this._cancelDraw();
    this.vm.group.removeFromParent();
    this.ui.classList.remove('on');
    document.body.classList.remove('bow-up', 'bow-equip');
    this.G.input.capture?.(false);
    const p = this.G.player;
    p.setFirstPerson(false);
    p.noJump = false; p.aimLookMul = 1; p.fovZoom = 0; p.moveMul = 1;
  }

  // Still at the eye, but nothing to press: for a results card over the
  // targets, so the arrows you shot stay in view behind it.
  rest() {
    if (!this.raised) return;
    this._cancelDraw();
    this.ui.classList.remove('on');
    document.body.classList.remove('bow-up', 'bow-equip');
    this.G.input.capture?.(false);
    const p = this.G.player;
    p.aimLookMul = 1; p.fovZoom = 0; p.moveMul = 1;
  }

  // Gone for good: every arrow, the bow in view, the controls, the listeners.
  stop() {
    this.lower();
    this.clearArrows();
    if (!this._built) return;
    this._built = false;
    this._abort.abort();
    this.vm.dispose();
    this.ui.remove();
  }

  clearArrows() {
    for (const a of this.arrows) a.mesh.removeFromParent();
    this.arrows.length = 0;
  }

  inFlight() { return this.arrows.filter((a) => a.state === 'fly').length; }

  update(dt) {
    this._t += dt;
    if (this.hitStop > 0) { this.hitStop -= dt; this._view(dt); return; }
    this.reload = Math.max(0, this.reload - dt);
    if (this.raised) this._drawStep(dt);
    this._fly(dt);
    this._view(dt);
  }

  // A score or a word over the crosshair, rising and fading.
  popup(text, tier = 0) {
    if (!this.ui) return;
    const el = document.createElement('div');
    el.className = `bow-pop t${tier}`;
    el.textContent = text;
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  // ---------- inside ----------

  _build() {
    if (this._built) return;
    this._built = true;
    this.vm = buildViewmodel();
    const ui = this.ui = document.createElement('div');
    ui.className = 'bow-ui';
    ui.innerHTML = '<svg class="bow-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="26"/>' +
      '<circle class="fg" cx="32" cy="32" r="26"/></svg><div class="bow-hitmark" aria-hidden="true"></div>' +
      '<button class="bow-draw" type="button"><span class="big"></span><span class="small"></span></button>';
    ui.querySelector('.big').textContent = S.range.drawBtn;
    ui.querySelector('.small').textContent = S.range.drawSub;
    this.G.hud.root.appendChild(ui);
    this._ring = ui.querySelector('.fg');
    this._mark = ui.querySelector('.bow-hitmark');

    // Hold the button (touch), the mouse (desktop), or Space, F or E.
    this._abort = new AbortController();
    const sig = { signal: this._abort.signal };
    const btn = ui.querySelector('.bow-draw');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { btn.setPointerCapture(e.pointerId); } catch { /* an id the browser no longer tracks */ }
      this._held.button = true;
    }, sig);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      btn.addEventListener(ev, () => { this._held.button = false; }, sig);
    }
    btn.addEventListener('contextmenu', (e) => e.preventDefault(), sig);
    const canvas = this.G.input.canvas;
    // The left button draws only once the mouse is caught (pointer lock).
    // Uncaught (the desktop app's browser pane, iframes) a left drag is the
    // only way to look (engine/input.js), so it must aim, not shoot. The
    // right button draws either way.
    canvas.addEventListener('mousedown', (e) => {
      if (this.G.input.isTouch) return;
      if (e.button === 2 || (e.button === 0 && document.pointerLockElement === canvas)) this._held.mouse = true;
    }, sig);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), sig);
    addEventListener('mouseup', () => { this._held.mouse = false; }, sig);
    addEventListener('blur', () => { this._held.button = false; this._held.mouse = false; }, sig);
  }

  _drawStep(dt) {
    const { G } = this;
    const k = G.input.keys;
    const free = G.input.enabled && !G.hud.root.dataset.modal;
    const held = free && (this._held.button || this._held.mouse || k.has('Space') || k.has('KeyF') || k.has('KeyE'));
    if (held && !this.drawing && this.reload <= 0 && this.canShoot()) {
      this.drawing = true;
      this.draw = 0;
      this._creak = SFX.bowDraw(BOW.DRAW_TIME);
    }
    if (this.drawing) {
      if (!free) this._cancelDraw(); // a dialog opened mid-draw: let down gently, no shot
      else if (held) this.draw = Math.min(1, this.draw + dt / BOW.DRAW_TIME);
      else {
        if (this.draw >= BOW.MIN_DRAW) this._loose();
        this._cancelDraw();
      }
    }
    const p = G.player, d = this.drawing ? this.draw : 0;
    p.aimLookMul = 1 - 0.55 * d;
    p.fovZoom = d;
    p.moveMul = this.drawing ? this.walkWhileDrawing : 1;
    const C = 163.4; // the ring's circumference, 2 pi 26
    this._ring.style.strokeDashoffset = String(C * (1 - d));
    this.ui.classList.toggle('full', d >= 1);
  }

  _cancelDraw() {
    this.drawing = false;
    this.draw = 0;
    this._creak?.stop();
    this._creak = null;
  }

  _loose() {
    const { G } = this, draw = this.draw;
    const cam = G.renderer.camera;
    cam.updateMatrixWorld();
    cam.getWorldPosition(_o);
    cam.getWorldDirection(_p);
    const dir = _p.clone();
    const aim = this._aimPoint(_o, dir);
    // leaves just under the eye, so you see it go
    const from = _o.clone().addScaledVector(dir, 0.6);
    from.y -= 0.06;
    const speed = BOW.SPEED_MIN + (BOW.SPEED_MAX - BOW.SPEED_MIN) * draw;
    const vel = launch(from, aim, speed, BOW.GRAVITY) ?? dir.multiplyScalar(speed);
    const wob = BOW.WOBBLE * (1 - draw) ** 2;
    if (wob > 0) {
      vel.applyAxisAngle(_Y, (Math.random() * 2 - 1) * wob);
      const side = new THREE.Vector3().crossVectors(vel, _Y).normalize();
      vel.applyAxisAngle(side, (Math.random() * 2 - 1) * wob);
    }
    const mesh = arrowMesh();
    mesh.position.copy(from);
    orient(mesh, vel);
    G.renderer.scene.add(mesh);
    this.arrows.push({ mesh, vel, life: 0, state: 'fly' });
    this._trim();
    this.reload = BOW.RELOAD;
    // a recorded clip wins if one is ever added (audio/sfx/bow-loose.m4a)
    Sound.playSfx('bow-loose').then((ok) => { if (!ok) SFX.bowLoose(draw); });
    G.player.addTrauma(0.05 + 0.07 * draw);
    this.vm.kick = 1;
    this.onLoose?.(draw);
  }

  // What the crosshair is on: the nearest target. If it is on nothing (you
  // are leading a moving target, aiming at the air in front of it) the arc is
  // set to cross the sight line at the range of the target nearest that line,
  // so the arrow passes through the crosshair where the target will be. Zeroed
  // on the ground far behind instead, a lead shot sailed half a block high.
  // A solid block before either point wins.
  _aimPoint(o, dir) {
    const far = new THREE.Vector3().copy(o).addScaledVector(dir, BOW.AIM_RANGE);
    let best = 1;
    const targets = this.targets();
    for (const t of targets) {
      const h = t.hitTest(o, far);
      if (h && h.f < best) best = h.f;
    }
    if (best === 1) {
      let near = null;
      for (const t of targets) {
        const c = t.anchor?.(_d);
        if (!c) continue;
        const along = _prev.subVectors(c, o).dot(dir);
        if (along < 2 || along > BOW.AIM_RANGE) continue;
        const off = _prev.copy(o).addScaledVector(dir, along).distanceTo(c);
        if (off < 4 && (!near || off < near.off)) near = { along, off };
      }
      if (near) best = near.along / BOW.AIM_RANGE;
    }
    const w = this.G.world, step = 0.25, limit = best * BOW.AIM_RANGE;
    for (let s = step; s < limit; s += step) {
      if (isSolid(w.get(Math.floor(o.x + dir.x * s), Math.floor(o.y + dir.y * s), Math.floor(o.z + dir.z * s)))) {
        best = s / BOW.AIM_RANGE;
        break;
      }
    }
    return new THREE.Vector3().copy(o).addScaledVector(dir, best * BOW.AIM_RANGE);
  }

  _fly(dt) {
    const w = this.G.world;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      if (a.state === 'ground') {
        a.life -= dt;
        if (a.life <= 0) this._remove(i);
        continue;
      }
      if (a.state !== 'fly') continue;
      a.life += dt;
      // short steps so a fast arrow cannot pass through a thin target
      const n = Math.max(1, Math.ceil((a.vel.length() * dt) / 0.3));
      const h = dt / n;
      let landed = false;
      for (let k = 0; k < n && !landed; k++) {
        _prev.copy(a.mesh.position);
        a.vel.y -= BOW.GRAVITY * h;
        a.mesh.position.addScaledVector(a.vel, h);
        let hit = null;
        for (const t of this.targets()) {
          const r = t.hitTest(_prev, a.mesh.position);
          if (r && (!hit || r.f < hit.f)) { hit = r; hit.target = t; }
        }
        if (hit) { this._stick(a, hit); landed = true; break; }
        const p = a.mesh.position;
        if (isSolid(w.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) { this._ground(a); landed = true; }
      }
      if (landed) continue;
      orient(a.mesh, a.vel);
      if (a.life > BOW.LIFE || a.mesh.position.y < -4) {
        this._remove(i);
        this.onMiss?.(null);
      }
    }
  }

  _stick(a, hit) {
    orient(a.mesh, a.vel);
    _d.copy(a.vel).normalize();
    a.mesh.position.copy(hit.point).addScaledVector(_d, -0.22); // the head buried
    (hit.parent ?? this.G.renderer.scene).attach(a.mesh);
    a.state = 'hit';
    this.hitStop = BOW.HIT_STOP;
    const tier = hit.tier ?? 0;
    SFX.arrowHit(Math.max(0, tier));
    FX.puff(hit.point, { count: 8, size: 0.16, life: 0.4, color: hit.dust ?? 0xd9c49a });
    this.G.player.addTrauma(0.04);
    this._mark.className = `bow-hitmark on t${tier}`;
    setTimeout(() => { if (this._mark) this._mark.className = 'bow-hitmark'; }, 170);
    this.onHit?.(hit, a);
  }

  _ground(a) {
    orient(a.mesh, a.vel);
    _d.copy(a.vel).normalize();
    a.mesh.position.addScaledVector(_d, -0.18);
    a.state = 'ground';
    a.life = BOW.GROUND_LIFE;
    SFX.arrowMiss();
    FX.puff(a.mesh.position, { count: 6, size: 0.18, life: 0.5, color: 0xb9a77e });
    this.onMiss?.(a.mesh.position.clone());
  }

  _remove(i) {
    this.arrows[i].mesh.removeFromParent();
    this.arrows.splice(i, 1);
  }

  _trim() {
    while (this.arrows.length > BOW.MAX_ARROWS) {
      const i = this.arrows.findIndex((a) => a.state !== 'fly');
      if (i < 0) break;
      this._remove(i);
    }
  }

  _view(dt) {
    if (!this.vm || !this.raised) return;
    this.vm.kick = Math.max(0, this.vm.kick - dt * 6);
    this.vm.set(this.drawing ? this.draw : 0, this.reload <= 0 && this.canShoot(), this._t, this.vm.kick, this.G.renderer.camera);
  }
}

// ---------- the bow in view ----------
// Unlit colours and no depth test: it is drawn last, over the world, so it
// never clips into a tree trunk at your elbow and reads the same in both
// visual styles.
function buildViewmodel() {
  const flat = { depthTest: false, depthWrite: false, fog: false };
  const solid = new THREE.MeshBasicMaterial({ vertexColors: true, ...flat });
  const stringMat = new THREE.MeshBasicMaterial({ color: 0xf1e6c8, ...flat });
  const geos = [];
  const group = new THREE.Group();
  const add = (mesh, order = 1000) => { mesh.renderOrder = order; mesh.frustumCulled = false; return mesh; };
  // Parts that never move against each other are built as coloured boxes and
  // folded into one mesh (world/merge.js), then drawn unlit: the limbs and
  // grip are one draw call, the arrow on the string another.
  const fold = (build) => {
    const tmp = new THREE.Group(), src = [];
    const part = (g, color) => {
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
      src.push(m);
      tmp.add(m);
      return m;
    };
    build(part);
    foldStatic(tmp);
    for (const m of src) { m.geometry.dispose(); m.material.dispose(); }
    const geo = tmp.children[0].geometry;
    geos.push(geo);
    return add(new THREE.Mesh(geo, solid));
  };
  // the limbs: grip at the origin, tips curling back toward the archer (+z)
  const L = 0.34, pts = [];
  for (let i = -4; i <= 4; i++) {
    const y = (i / 4) * L;
    pts.push(new THREE.Vector3(0, y, 0.11 * (y / L) ** 2));
  }
  const seg = (part, a, b, w, color) => {
    const m = part(new THREE.BoxGeometry(w, a.distanceTo(b), w), color);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_Y, b.clone().sub(a).normalize());
  };
  group.add(fold((part) => {
    for (let i = 0; i < pts.length - 1; i++) seg(part, pts[i], pts[i + 1], 0.026, 0x6b4423);
    seg(part, new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.05, 0), 0.042, 0xa4472b);
  }));
  const top = pts[pts.length - 1], bot = pts[0];
  // the string: two halves meeting at the nock, re-aimed every frame
  const unit = new THREE.BoxGeometry(0.006, 1, 0.006);
  geos.push(unit);
  const s1 = add(new THREE.Mesh(unit, stringMat), 1001), s2 = add(new THREE.Mesh(unit, stringMat), 1001);
  group.add(s1, s2);
  // the arrow on the string, pointing away along -z from the nock
  const arrow = fold((part) => {
    const box = (w, h, d, color, z, rz = 0) => { const m = part(new THREE.BoxGeometry(w, h, d), color); m.position.z = z; m.rotation.z = rz; };
    box(0.02, 0.02, 0.7, 0xcdb48a, -0.35);
    box(0.05, 0.035, 0.08, 0x3a3530, -0.72);
    box(0.006, 0.06, 0.11, 0xb4532f, -0.08);
    box(0.006, 0.06, 0.11, 0xb4532f, -0.08, Math.PI / 2);
  });
  arrow.renderOrder = 1002;
  group.add(arrow);
  const nock = new THREE.Vector3();
  const place = (m, a, b) => {
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, a.distanceTo(b), 1);
    m.quaternion.setFromUnitVectors(_Y, _d.copy(b).sub(a).normalize());
  };
  const BRACE = 0.13; // the string at rest, this far behind the grip
  return {
    group,
    kick: 0,
    set(draw, nocked, t, kick, cam) {
      // Sized from the view, not fixed: a portrait phone sees a narrow slice
      // of the world, and a bow of fixed size filled half its screen. This
      // keeps it about half the screen's height, low and a little left,
      // canted the way an archer holds it, on any screen and at any zoom.
      const D = 0.5;
      const halfH = D * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      const s = (halfH / 0.68) * 0.85;
      group.scale.setScalar(s);
      group.position.set(-Math.min(halfW * 0.42, halfH * 0.75), -halfH * 0.36 + Math.sin(t * 1.6) * 0.003 * s, -D - kick * 0.04 * s);
      group.rotation.set(0, 0, 0.22 + Math.sin(t * 23) * 0.004 * draw);
      nock.set(0, 0, BRACE + draw * 0.2);
      place(s1, top, nock);
      place(s2, bot, nock);
      arrow.visible = nocked;
      arrow.position.copy(nock);
    },
    dispose() {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      solid.dispose();
      stringMat.dispose();
    },
  };
}
