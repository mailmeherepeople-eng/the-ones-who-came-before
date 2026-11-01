// How the bow looks in the hands, two ways (2026-11-01: "the bow and arrow
// look really weird in game. like some lame broken looking bow and the hand
// isnt even visible ... it should look like the person is using the bow and
// arrow. now the bow and arrow are floating", then "show me how both will
// look. Over the shoulder as well as Through the eyes").
//
//  - eyesView(): first person. The left fist round the grip low and left of
//    centre, the bow canted, the right hand pinching the nock and drawing it
//    back, both forearms running out of the frame. Drawn last and unlit, so it
//    never clips a tree at your elbow.
//  - shoulderPose(): third person. Built onto the player's own body: the bow
//    arm straight out at shoulder height, the draw elbow high, the draw hand
//    coming back to the jaw. Two-bone arms follow the string as it comes back.
//
// Shared rules (from archery form and low-poly references): a self bow about
// the archer's height, a D-curve with the tips flicked forward, a wrapped grip
// in a contrasting colour, a pale string, and the arrow's nock tied to the
// string so the two can never drift apart.
import * as THREE from '../../vendor/three.module.js';
import { foldStatic } from '../world/merge.js';
import { enhance } from '../world/shade.js';

const _Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export const SKIN = 0x8d5b3b, SKIN_DARK = 0x77492e, OCHRE = 0xd49a3a;
const WOOD = 0x6b4423, WOOD_LIGHT = 0x8a5a2e, GRIP = 0xa4472b, STRING = 0xf1e6c8;

// a box stretched between two points (thickness w)
function segment(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.y = Math.max(1e-4, a.distanceTo(b));
  mesh.quaternion.setFromUnitVectors(_Y, _b.copy(b).sub(a).normalize());
}

// The bow's curve in its own space: grip at the origin, height along y, the
// archer behind it at +z. L is half the bow's length.
function bowPoints(L) {
  const pts = [];
  for (let i = -6; i <= 6; i++) {
    const u = i / 6, y = u * L;
    const bend = 0.32 * L * u * u;                      // limbs come back toward the archer
    const flick = Math.max(0, Math.abs(u) - 0.78) / 0.22; // the tips flick forward again
    pts.push(new THREE.Vector3(0, y, bend - 0.2 * L * flick * flick));
  }
  return pts;
}

// Fold the static bow (limbs and grip) into one vertex-coloured geometry.
function bowGeometry(L, w) {
  const tmp = new THREE.Group(), src = [];
  const part = (geo, color) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    src.push(m); tmp.add(m);
    return m;
  };
  const pts = bowPoints(L);
  for (let i = 0; i < pts.length - 1; i++) {
    const taper = 1 - Math.abs((i + 0.5) / (pts.length - 1) - 0.5) * 0.9; // thick at the grip, thin at the tips
    const m = part(new THREE.BoxGeometry(w * taper, 1, w * 1.25 * taper), i % 2 ? WOOD : WOOD_LIGHT);
    segment(m, pts[i], pts[i + 1]);
  }
  const grip = part(new THREE.BoxGeometry(w * 1.7, L * 0.2, w * 1.9), GRIP);
  grip.position.set(0, 0, 0.005);
  for (const s of [-1, 1]) { // nocks at the tips, a touch darker
    const t = part(new THREE.BoxGeometry(w * 0.9, w * 1.2, w * 0.9), 0x3b2614);
    t.position.copy(pts[s < 0 ? 0 : pts.length - 1]);
  }
  foldStatic(tmp);
  for (const m of src) { m.geometry.dispose(); m.material.dispose(); }
  return { geo: tmp.children[0].geometry, top: pts[pts.length - 1].clone(), bot: pts[0].clone() };
}

function arrowGeometry(len, w) {
  const tmp = new THREE.Group(), src = [];
  const box = (sx, sy, sz, color, z, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ color }));
    m.position.z = z; m.rotation.z = rz;
    src.push(m); tmp.add(m);
  };
  // along -z from the nock at the origin
  box(w, w, len, 0xcdb48a, -len / 2);
  box(w * 2.6, w * 1.7, w * 4, 0x3a3530, -len - w * 1.6);
  box(w * 0.3, w * 3, w * 5.5, 0xb4532f, -w * 4);
  box(w * 0.3, w * 3, w * 5.5, 0xb4532f, -w * 4, Math.PI / 2);
  foldStatic(tmp);
  for (const m of src) { m.geometry.dispose(); m.material.dispose(); }
  return tmp.children[0].geometry;
}

// Two-bone arm: shoulder S, hand H, bone lengths a and b, elbow pushed toward
// `pole`. Writes the elbow into E.
function solveElbow(S, H, a, b, pole, E) {
  const dir = _a.copy(H).sub(S);
  let d = dir.length();
  dir.divideScalar(d || 1);
  d = Math.min(d, a + b - 1e-3);
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const perp = _b.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  return E.copy(S).addScaledVector(dir, along).addScaledVector(perp, h);
}

// ---------- through the eyes ----------
// After Oblivion Remastered (2026-11-01: "i want it to be like how it is in the
// video. the oblivion remastered view. copy it exactly like that ... including
// the subtle zoom in effect when the bow is fully drawn"). Studied frame by
// frame (a phone-shaped crop of the widescreen game):
//  - not drawing: the bow is lowered, lying flat along the bottom edge, only
//    the fist and the bow's top edge in view, no arrow;
//  - drawing: an arrow slides in from the lower right onto the fist, then the
//    bow rises into the lower third: turned on its side, horizontal across the
//    screen (running off both edges on a phone), the bow arm coming up from
//    the bottom left to the fist, the arrow lying on the knuckle and pointing
//    at the crosshair (parallel to the view, so it runs in from the lower
//    right). The draw hand and the string stay out of the frame;
//  - full draw: a gentle zoom of about a tenth and a slight sway (bow.js, player.js);
//  - release: the arrow goes, the bow snaps (its right end kicks up), the
//    string flashes into view, and it all drops back down in about half a second.
// Positions are in units of the screen's half height, so a phone sees the
// same middle slice of the picture a monitor does, as in the video.
const _v = new THREE.Vector3();
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export function eyesView() {
  const flat = { depthTest: false, depthWrite: false, fog: false };
  const solid = new THREE.MeshBasicMaterial({ vertexColors: true, ...flat });
  const skin = new THREE.MeshBasicMaterial({ color: SKIN, ...flat });
  const bracer = new THREE.MeshBasicMaterial({ color: 0x7a5230, ...flat });  // a hide bracer on the bow arm
  const bracerDark = new THREE.MeshBasicMaterial({ color: 0x5a3c22, ...flat });
  const band = new THREE.MeshBasicMaterial({ color: 0x3e2a18, ...flat }); // a dark thong at the wrist
  const stringMat = new THREE.MeshBasicMaterial({ color: STRING, ...flat });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group();
  const add = (geo, mat, order, parent = group) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; parent.add(m); return m; };
  // the rig: everything that moves together (bow, fist, bow arm, the arrow on it)
  const rig = new THREE.Group();
  group.add(rig);
  // the bow, lying on its side: limbs along x, belly toward the eye (+z)
  const L = 0.72;
  const bow = bowGeometry(L, 0.034);
  const bowG = new THREE.Group();
  bowG.rotation.z = Math.PI / 2; // its limbs ran along y; now along x
  rig.add(bowG);
  add(bow.geo, solid, 1000, bowG);
  // the fist round the grip
  const fist = add(unit, skin, 1004, rig); fist.scale.set(0.085, 0.1, 0.1); fist.position.set(-0.005, -0.012, 0.008);
  const knuck = add(unit, skin, 1004, rig); knuck.scale.set(0.09, 0.03, 0.06); knuck.position.set(0, 0.04, -0.02);
  // the bow arm: a hide bracer from the wrist down and back to the bottom left
  // (placed each frame in the view's own space: from the wrist to an elbow off
  // the bottom left corner, the way the video's sleeve crosses the frame)
  const arm = add(unit, bracer, 1003), armEdge = add(unit, bracerDark, 1003), cuff = add(unit, band, 1004);
  const wristR = new THREE.Vector3(-0.02, -0.055, 0.03), wrist = new THREE.Vector3(), elbow = new THREE.Vector3();
  // the string between the tips (braced), or back to the nock while drawn
  const strUnit = new THREE.BoxGeometry(0.006, 1, 0.006);
  const s1 = add(strUnit, stringMat, 1001, rig), s2 = add(strUnit, stringMat, 1001, rig);
  // the arrow on the knuckle, pointing straight into the view
  const arrowGeo = arrowGeometry(0.78, 0.012);
  const arrow = add(arrowGeo, solid, 1005, rig);
  const top = new THREE.Vector3(), bot = new THREE.Vector3(), nock = new THREE.Vector3();
  const REST = new THREE.Vector3(0.05, 0.05, 0); // where the arrow lies on the fist, rig space
  return {
    group,
    kick: 0,
    set(draw, nocked, t, kick, cam) {
      const D = 0.85;                                   // the grip's distance from the eye
      const h = D * Math.tan((cam.fov * Math.PI) / 360); // half the screen's height at that distance
      // poses in half-heights: aimed (the video's full draw) and lowered (rest)
      const rel = 1 - kick;                              // kick runs 1 to 0 after a shot
      const loosing = kick > 0 ? 1 : 0;
      // drawing: the arrow first, then the bow comes up; loosing: from the aim,
      // a snap (right end up, a little left), then down to rest
      const raise = loosing ? 1 - ease((rel - 0.12) / 0.7) : ease((draw - 0.15) / 0.55);
      const ax = 0.07, ay = -0.46, lx = 0.0, ly = -0.98;
      let x = lx + (ax - lx) * raise, y = ly + (ay - ly) * raise, roll = 0.04 * raise;
      if (loosing) {
        const k = Math.sin(Math.min(1, rel * 1.6) * Math.PI);
        roll += 0.3 * k;
        x -= 0.1 * k; y += 0.04 * k;
      }
      const sway = 0.006 * ease((draw - 0.7) / 0.3);
      rig.position.set(x * h + Math.sin(t * 1.3) * sway, y * h + Math.sin(t * 1.9) * sway * 0.7, -D);
      rig.rotation.set(-0.06, 0.08, roll);
      rig.updateMatrix();
      // the bow arm: wrist on the fist, elbow off the bottom left corner
      wrist.copy(wristR).applyMatrix4(rig.matrix);
      const ed = 0.42, eh = ed * Math.tan((cam.fov * Math.PI) / 360);
      elbow.set((-1.15 + (x - ax)) * eh, (-1.3 + (y - ay)) * eh, -ed);
      segment(arm, wrist, elbow); arm.scale.x = 0.1; arm.scale.z = 0.09;
      segment(armEdge, _v.copy(wrist).add(elbow).multiplyScalar(0.5), elbow); armEdge.scale.x = 0.104; armEdge.scale.z = 0.094;
      armEdge.position.lerp(elbow, 0.02);
      cuff.position.copy(wrist).lerp(elbow, 0.06); cuff.quaternion.copy(arm.quaternion); cuff.scale.set(0.106, 0.018, 0.096);
      // the tips, in rig space
      top.copy(bow.top).applyAxisAngle(_v.set(0, 0, 1), Math.PI / 2);
      bot.copy(bow.bot).applyAxisAngle(_v.set(0, 0, 1), Math.PI / 2);
      // the nock: braced string behind the grip at rest, drawn back toward the eye
      const pull = loosing ? 0 : ease(draw / 0.85);
      nock.set(REST.x, REST.y, 0.17 + pull * 0.62);
      segment(s1, top, nock); s1.scale.x = s1.scale.z = 1;
      segment(s2, bot, nock); s2.scale.x = s2.scale.z = 1;
      // the arrow: slides in from the lower right while nocking, then lies on the fist
      const nockIn = ease(draw / 0.3);
      arrow.visible = nocked && !loosing && draw > 0.01;
      arrow.position.set(nock.x + (1 - nockIn) * 0.3, nock.y - (1 - nockIn) * 0.25, nock.z);
      arrow.rotation.set(0, 0, 0);
    },
    dispose() {
      group.removeFromParent();
      for (const g of [bow.geo, strUnit, arrowGeo, unit]) g.dispose();
      for (const m of [solid, skin, bracer, bracerDark, band, stringMat]) m.dispose();
    },
  };
}

// ---------- over the shoulder ----------
// Built in the player model's own space (+z is the front, shoulders at y 1.2,
// x 0.34). The pose pitches with the camera so the bow points where you aim.
export function shoulderPose() {
  const mat = (color) => enhance(new THREE.MeshLambertMaterial({ color }));
  const skinM = mat(SKIN), skinDarkM = mat(SKIN_DARK), bandM = mat(OCHRE), stringM = new THREE.MeshBasicMaterial({ color: STRING });
  const woodM = enhance(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();     // at the shoulders, pitched with the aim
  root.position.set(0, 1.22, 0);
  const meshes = [];
  const add = (geo, m, parent = root) => { const x = new THREE.Mesh(geo, m); x.castShadow = true; parent.add(x); meshes.push(x); return x; };
  // the bow, as tall as its archer, turned to face +z
  const L = 0.72;
  const bow = bowGeometry(L, 0.045);
  const bowG = new THREE.Group();
  bowG.rotation.y = Math.PI; // its own space has the archer at +z; here the archer is at -z
  root.add(bowG);
  add(bow.geo, woodM, bowG);
  const arrowGeo = arrowGeometry(0.8, 0.026);
  const arrow = add(arrowGeo, woodM);
  const strUnit = new THREE.BoxGeometry(0.012, 1, 0.012);
  const s1 = add(strUnit, stringM), s2 = add(strUnit, stringM);
  // arms: upper arm and forearm each side, a hand at the end
  const upL = add(unit, skinM), foL = add(unit, skinDarkM), handL = add(unit, skinM);
  const upR = add(unit, skinM), foR = add(unit, skinDarkM), handR = add(unit, skinM);
  const bandL = add(unit, bandM), bandR = add(unit, bandM);
  for (const m of [upL, upR]) m.scale.set(0.13, 1, 0.15);
  for (const m of [foL, foR]) m.scale.set(0.11, 1, 0.13);
  for (const m of [handL, handR]) m.scale.set(0.12, 0.13, 0.12);
  for (const m of [bandL, bandR]) m.scale.set(0.15, 0.05, 0.17);
  // Side-on, the way archers stand: the body is turned SIDE radians so the
  // left shoulder leads (player.js turns the model by pose.side), and the
  // grip, the jaw and the rest point are swung back by the same angle so the
  // bow still points where you aim.
  const SIDE = 0.35; // 2026-11-01 round 2: "the character is not totally turned" (Skyrim, Oblivion)
  const swing = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(_Y, -SIDE);
  const SL = new THREE.Vector3(-0.34, 0, 0), SR = new THREE.Vector3(0.34, 0, 0);
  const grip = swing(-0.02, 0.04, 0.62).add(new THREE.Vector3(-0.1, 0, 0));
  const anchor = swing(0.0, 0.19, 0.17);                    // the jaw, under the eye
  const rest = swing(-0.02, 0.04, 0.46).add(new THREE.Vector3(-0.1, 0, 0));
  const poleL = new THREE.Vector3(-1, -0.4, 0).normalize();
  const poleRest = new THREE.Vector3(0.7, -0.7, 0).normalize(), poleFull = new THREE.Vector3(0.75, 0.35, -0.55).normalize();
  const nock = new THREE.Vector3(), E = new THREE.Vector3(), pole = new THREE.Vector3();
  const top = new THREE.Vector3(), bot = new THREE.Vector3();
  const UP = 0.3, FORE = 0.3;
  bowG.position.copy(grip);
  bowG.rotation.set(0, Math.PI - SIDE, -0.12); // facing the aim, a slight cant
  bowG.updateMatrix();
  const toRoot = (v, out) => out.copy(v).applyMatrix4(bowG.matrix);
  return {
    group: root,
    side: SIDE,
    set(draw, nocked, pitch, kick) {
      // pitch about the aim line, not the body's own x (the body is side-on)
      root.rotation.set(0, 0, 0);
      root.rotateOnAxis(_a.set(Math.cos(SIDE), 0, Math.sin(SIDE)), pitch * 0.9);
      root.position.z = -kick * 0.03;
      nock.copy(rest).lerp(anchor, draw);
      // the string from each tip to the nock
      toRoot(bow.top, top); toRoot(bow.bot, bot);
      segment(s1, top, nock); s1.scale.x = s1.scale.z = 1;
      segment(s2, bot, nock); s2.scale.x = s2.scale.z = 1;
      // the arrow from the nock through the grip
      arrow.visible = nocked;
      arrow.position.copy(nock);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _a.copy(grip).sub(nock).normalize());
      // bow arm: nearly straight to the grip
      solveElbow(SL, grip, UP, FORE + 0.02, poleL, E);
      segment(upL, SL, E); segment(foL, E, grip);
      handL.position.copy(grip); handL.quaternion.copy(foL.quaternion);
      bandL.position.copy(E).lerp(grip, 0.75); bandL.quaternion.copy(foL.quaternion);
      // draw arm: the elbow swings up and back as the hand comes to the jaw
      pole.copy(poleRest).lerp(poleFull, draw).normalize();
      solveElbow(SR, nock, UP, FORE, pole, E);
      segment(upR, SR, E); segment(foR, E, nock);
      handR.position.copy(nock); handR.quaternion.copy(foR.quaternion);
      bandR.position.copy(E).lerp(nock, 0.75); bandR.quaternion.copy(foR.quaternion);
      // segment() writes scale.y only; keep each part's own thickness
      for (const [m, w, d] of [[upL, 0.13, 0.15], [upR, 0.13, 0.15], [foL, 0.11, 0.13], [foR, 0.11, 0.13]]) { m.scale.x = w; m.scale.z = d; }
    },
    dispose() {
      root.removeFromParent();
      for (const g of [bow.geo, arrowGeo, strUnit, unit]) g.dispose();
      for (const m of [skinM, skinDarkM, bandM, stringM, woodM]) m.dispose();
    },
  };
}
