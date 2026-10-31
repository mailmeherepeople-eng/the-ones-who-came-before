// Archery targets for the training post (games/range.js) and its practice
// stop in the Act 1 hunt. Each returns { root, hitTest, update?, mult }.
//
// Every target faces the archer along its own -x. A hit is found in the
// target's own space (worldToLocal), so a swinging or running target, or one
// mirrored to run the other way, needs no special case. Arrows stick into
// `frame`, a plain Group, so they ride along with whatever moves. Plain
// Groups also survive world/merge.js folding, which bakes the static wood
// and straw into one mesh.
//
// The faces are painted hide in the valley's own pigments: red ochre, white
// clay and charcoal, the colours of the cave paintings.
import * as THREE from '../../vendor/three.module.js';
import { foldStatic } from '../world/merge.js';
import { enhance } from '../world/shade.js';
import { PROP_MATS } from '../world/props.js';

// rings, as fractions of a face's radius, and what each is worth
export const RINGS = [
  { r: 0.2, points: 10, tier: 2 },
  { r: 0.45, points: 7, tier: 1 },
  { r: 0.72, points: 4, tier: 0 },
  { r: 1.0, points: 2, tier: 0 },
];

let faceTex = null;
function faceTexture() {
  if (faceTex) return faceTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const ring = (f, color) => { c.fillStyle = color; c.beginPath(); c.arc(64, 64, f * 63, 0, Math.PI * 2); c.fill(); };
  ring(1.0, '#c9a77a');  // hide
  ring(0.94, '#d8b98a');
  ring(0.72, '#ece2cb'); // white clay
  ring(0.45, '#a8432a'); // red ochre
  ring(0.2, '#2b231d');  // charcoal
  c.strokeStyle = 'rgba(90,60,30,0.55)'; c.lineWidth = 2;
  for (const f of [0.2, 0.45, 0.72, 0.995]) { c.beginPath(); c.arc(64, 64, f * 63, 0, Math.PI * 2); c.stroke(); }
  faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

const MATS = {};
function mats() {
  if (MATS.face) return MATS;
  MATS.face = enhance(new THREE.MeshLambertMaterial({ map: faceTexture() }));
  MATS.straw = enhance(new THREE.MeshLambertMaterial({ color: 0xcaa864 }));
  MATS.rope = enhance(new THREE.MeshLambertMaterial({ color: 0xa88b5c }));
  MATS.hide = enhance(new THREE.MeshLambertMaterial({ color: 0x9a6a3c }));
  MATS.hideDark = enhance(new THREE.MeshLambertMaterial({ color: 0x6e4a2a }));
  return MATS;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function face(radius) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mats().face);
  m.rotation.y = -Math.PI / 2; // the circle's +z turned to face -x, the archer
  return m;
}

// turn `root` so its -x looks at (ax, az)
function faceArcher(root, ax, az) {
  const dx = ax - root.position.x, dz = az - root.position.z;
  const d = Math.hypot(dx, dz) || 1;
  root.rotation.y = Math.atan2(dz / d, -dx / d);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
// Where the segment p0 to p1 crosses the plane x = xFace of `frame`, coming
// from the archer's side. Returns { f, y, z } in frame space, or null.
function crossing(frame, p0, p1, xFace) {
  frame.updateWorldMatrix(true, false);
  frame.worldToLocal(_a.copy(p0));
  frame.worldToLocal(_b.copy(p1));
  if (!(_a.x < xFace && _b.x >= xFace)) return null;
  const f = (xFace - _a.x) / (_b.x - _a.x);
  return { f, y: _a.y + (_b.y - _a.y) * f, z: _a.z + (_b.z - _a.z) * f };
}
function ringAt(dist, radius) {
  const k = dist / radius;
  return RINGS.find((r) => k <= r.r) ?? null;
}
function result(c, p0, p1, frame, points, tier, extra = {}) {
  return { f: c.f, point: new THREE.Vector3().lerpVectors(p0, p1, c.f), parent: frame, points, tier, ...extra };
}

// A straw boss on two legs with a painted hide face. `mult` scales its rings
// (the far targets are worth more).
export function standTarget(x, y, z, archer, { radius = 0.6, mult = 1 } = {}) {
  const M = mats();
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const H = 1.35; // face centre above the ground
  root.add(box(0.12, H + 0.55, 0.12, PROP_MATS.woodDark, 0.2, (H + 0.55) / 2, -0.58));
  root.add(box(0.12, H + 0.55, 0.12, PROP_MATS.woodDark, 0.2, (H + 0.55) / 2, 0.58));
  root.add(box(0.1, 0.1, 1.35, PROP_MATS.wood, 0.2, H + 0.5, 0));
  root.add(box(0.36, 1.3, 1.3, M.straw, 0.1, H, 0));
  const frame = new THREE.Group();
  frame.position.set(0, H, 0);
  const disc = face(radius);
  disc.position.x = -0.085;
  frame.add(disc);
  root.add(frame);
  faceArcher(root, archer.x, archer.z);
  foldStatic(root); // the legs, the bar and the straw become one mesh
  return {
    root, frame, mult,
    anchor: (v) => frame.getWorldPosition(v),
    hitTest(p0, p1) {
      const c = crossing(frame, p0, p1, -0.08);
      if (!c) return null;
      const ring = ringAt(Math.hypot(c.y, c.z), radius);
      if (ring) return result(c, p0, p1, frame, ring.points * mult, ring.tier, { base: ring.points });
      if (Math.abs(c.y) <= 0.65 && Math.abs(c.z) <= 0.65) return result(c, p0, p1, frame, 0, -1, { straw: true });
      return null;
    },
  };
}

// A hide on a rope from a crossbar, swinging across the line of fire.
export function swingTarget(x, y, z, archer, { radius = 0.55, mult = 2 } = {}) {
  const M = mats();
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const TOP = 4.3, ROPE = 2.1, SPAN = 2.8;
  root.add(box(0.16, TOP, 0.16, PROP_MATS.woodDark, 0.25, TOP / 2, -SPAN));
  root.add(box(0.16, TOP, 0.16, PROP_MATS.woodDark, 0.25, TOP / 2, SPAN));
  root.add(box(0.14, 0.14, SPAN * 2 + 0.3, PROP_MATS.wood, 0.25, TOP, 0));
  const pivot = new THREE.Group();
  pivot.position.set(0.25, TOP - 0.05, 0);
  pivot.add(box(0.03, ROPE, 0.03, M.rope, 0, -ROPE / 2, 0));
  const frame = new THREE.Group();
  frame.position.set(0, -ROPE - radius, 0);
  frame.add(box(0.14, radius * 2.1, radius * 2.1, M.straw, 0.09, 0, 0));
  const disc = face(radius);
  disc.position.x = -0.03;
  frame.add(disc);
  pivot.add(frame);
  root.add(pivot);
  faceArcher(root, archer.x, archer.z);
  foldStatic(root);
  let t = 0, speed = 1;
  return {
    root, frame, mult,
    anchor: (v) => frame.getWorldPosition(v),
    // each hit swings it a little faster, up to half again
    faster() { speed = Math.min(1.5, speed + 0.06); },
    update(dt) {
      t += dt * speed;
      pivot.rotation.x = 0.62 * Math.sin(t * 2.1);
    },
    hitTest(p0, p1) {
      const c = crossing(frame, p0, p1, -0.02);
      if (!c) return null;
      const ring = ringAt(Math.hypot(c.y, c.z), radius);
      if (ring) return result(c, p0, p1, frame, ring.points * mult, ring.tier, { base: ring.points });
      if (Math.abs(c.y) <= radius * 1.05 && Math.abs(c.z) <= radius * 1.05) return result(c, p0, p1, frame, 0, -1, { straw: true });
      return null;
    },
  };
}

// A deer cut out of boards, painted with rings over the heart, sliding back
// and forth on a sled along a rope track. Turns to face the way it runs.
export function runningTarget(x, y, z, archer, { span = 11, mult = 2, speed = 3.2 } = {}) {
  const M = mats();
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const half = span / 2;
  root.add(box(0.14, 0.9, 0.14, PROP_MATS.woodDark, 0.3, 0.45, -half - 1));
  root.add(box(0.14, 0.9, 0.14, PROP_MATS.woodDark, 0.3, 0.45, half + 1));
  root.add(box(0.03, 0.03, span + 2, M.rope, 0.3, 0.42, 0));
  const sled = new THREE.Group();
  root.add(sled);
  const T = 0.07; // board thickness
  const parts = [
    [T, 0.6, 1.25, M.hide, 0, 1.0, 0],          // body
    [T, 0.48, 0.22, M.hide, 0, 1.42, 0.55],     // neck
    [T, 0.25, 0.4, M.hide, 0, 1.68, 0.74],      // head
    [T, 0.16, 0.06, M.hideDark, 0, 1.86, 0.62], // ear
    [T, 0.62, 0.1, M.hideDark, 0, 0.4, 0.45],   // legs
    [T, 0.62, 0.1, M.hideDark, 0, 0.4, 0.3],
    [T, 0.62, 0.1, M.hideDark, 0, 0.4, -0.35],
    [T, 0.62, 0.1, M.hideDark, 0, 0.4, -0.5],
    [T, 0.14, 0.12, M.hideDark, 0, 1.2, -0.68], // tail
    [0.5, 0.05, 1.3, PROP_MATS.wood, 0.1, 0.06, 0], // the sled
  ];
  for (const [w, h, d, m, px, py, pz] of parts) sled.add(box(w, h, d, m, px, py, pz));
  const HEART = { y: 1.0, z: 0.18, r: 0.36 };
  const disc = face(HEART.r);
  disc.position.set(-T / 2 - 0.005, HEART.y, HEART.z);
  sled.add(disc);
  faceArcher(root, archer.x, archer.z);
  // It runs like a deer, not a metronome: every second or so it picks a new
  // pace (a trot to a sprint), and now and then it freezes or doubles back
  // mid-track, so there is no rhythm to learn. The pace eases rather than
  // snaps, so a good eye can still read it in the moment before the shot.
  let pos = -half, dir = 1, v = 0, base = speed, want = speed, legT = 0, gait = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const nextLeg = () => {
    const r = Math.random();
    if (r < 0.18) { want = 0; legT = rnd(0.3, 0.8); return; } // freezes
    if (r < 0.38 && Math.abs(pos) < half - 2) dir = -dir;     // doubles back
    want = base * rnd(0.45, 1.5);
    legT = rnd(0.5, 1.6);
  };
  return {
    root, frame: sled, mult,
    anchor: (out) => sled.localToWorld(out.set(0, HEART.y, HEART.z)),
    faster() { base = Math.min(speed * 1.7, base * 1.07); },
    update(dt) {
      legT -= dt;
      if (legT <= 0) nextLeg();
      const goal = dir * want, acc = 9 * dt; // blocks per second, per second
      v += Math.max(-acc, Math.min(acc, goal - v));
      pos += v * dt;
      if (pos > half) { pos = half; v = 0; dir = -1; legT = Math.min(legT, 0.15); }
      if (pos < -half) { pos = -half; v = 0; dir = 1; legT = Math.min(legT, 0.15); }
      sled.position.z = pos;
      if (Math.abs(v) > 0.25) sled.scale.z = Math.sign(v); // the head leads
      gait += Math.abs(v) * dt * 2.4;
      sled.position.y = 0.09 * Math.abs(Math.sin(gait)) * Math.min(1, Math.abs(v) / speed); // bounding
    },
    hitTest(p0, p1) {
      const c = crossing(sled, p0, p1, -T / 2);
      if (!c) return null;
      const ring = ringAt(Math.hypot(c.y - HEART.y, c.z - HEART.z), HEART.r);
      if (ring) return result(c, p0, p1, sled, ring.points * mult, ring.tier, { base: ring.points, dust: 0xb08860 });
      const inBox = (cy, cz, h, d) => Math.abs(c.y - cy) <= h / 2 && Math.abs(c.z - cz) <= d / 2;
      if (inBox(1.0, 0, 0.6, 1.25)) return result(c, p0, p1, sled, 3 * mult, 0, { base: 3, dust: 0xb08860 });
      if (inBox(1.42, 0.55, 0.48, 0.22) || inBox(1.68, 0.74, 0.25, 0.4) || inBox(0.4, 0, 0.62, 1.1)) {
        return result(c, p0, p1, sled, 1 * mult, 0, { base: 1, dust: 0xb08860 });
      }
      return null;
    },
  };
}

// Remove a target built here. Geometries are its own; materials are shared.
export function dropTarget(scene, t) {
  scene.remove(t.root);
  t.root.traverse((o) => { if (o.isMesh && !o.userData.shared) o.geometry?.dispose(); });
}
