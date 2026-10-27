// SKY glimpse between Act 1 scenes: lift the camera, run the years forward,
// optionally swap the world state mid-flight, drop back down. Foreshadows
// Act 2's full dial (design doc §4).
import * as THREE from '../../vendor/three.module.js';
import { fmtYear } from '../constants.js';
import { wait } from '../ui/hud.js';

function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

export async function skyGlimpse(G, {
  fromYear, toYear,
  caption = null,
  rebuild = null, // () => void — swap world state at apogee
  overXZ = null, // look-down centre; default player position
  holdMs = 1600,
}) {
  const cam = G.renderer.camera;
  const prevMode = G.mode;
  G.mode = 'ui';
  G.input.setEnabled(false);
  G.hud.hidePrompt();
  // the body stays where act 1 left it while the camera flies overhead and
  // `rebuild` moves the ground out from under it — from up here that reads as
  // a figure floating over, or half sunk into, the new terrain
  G.player.setModelHidden(true);

  const centre = overXZ ?? { x: G.player.pos.x, z: G.player.pos.z };
  const startPos = cam.position.clone();
  const startQuat = cam.quaternion.clone();
  const topPos = new THREE.Vector3(centre.x, 68, centre.z + 14);

  // cinematic letterbox + year ticker overlay (styles in css/style.css)
  const boxEl = document.createElement('div');
  boxEl.className = 'sky-letterbox';
  G.hud.root.appendChild(boxEl);
  const yearEl = document.createElement('div');
  yearEl.className = 'sky-year';
  G.hud.root.appendChild(yearEl);
  const capEl = document.createElement('div');
  if (caption) {
    capEl.className = 'sky-cap';
    capEl.textContent = caption;
    G.hud.root.appendChild(capEl);
  }

  const lookDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.32, 0, 0));

  // ascend
  await tween(900, (t) => {
    cam.position.lerpVectors(startPos, topPos, ease(t));
    cam.quaternion.slerpQuaternions(startQuat, lookDown, ease(t));
  });

  // scrub years
  let swapped = false;
  await tween(holdMs + 800, (t) => {
    const y = Math.round(fromYear + (toYear - fromYear) * ease(t));
    yearEl.textContent = fmtYear(y >= 1 || fromYear >= 0 ? Math.max(1, y) : Math.min(-1, y));
    if (!swapped && rebuild && t > 0.5) {
      swapped = true;
      rebuild();
      G.mesher.remeshAll();
    }
  });
  if (rebuild && !swapped) { rebuild(); G.mesher.remeshAll(); }
  await wait(400);

  // descend to (possibly moved) player
  const endFeet = G.player.pos.clone();
  const endPos = new THREE.Vector3(endFeet.x, endFeet.y + 1.62, endFeet.z);
  const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -G.player.yaw, 0, 'YXZ'));
  const top2 = cam.position.clone();
  const q2 = cam.quaternion.clone();
  await tween(900, (t) => {
    cam.position.lerpVectors(top2, endPos, ease(t));
    cam.quaternion.slerpQuaternions(q2, endQuat, ease(t));
  });

  yearEl.remove();
  capEl.remove?.();
  boxEl.remove();
  G.player.pitch = 0;
  G.player.syncCamera();
  G.player.setModelHidden(false); // back on the ground, back in the boom's hands
  G.input.setEnabled(true);
  G.mode = prevMode;
}

// ---------- the first look at the valley ----------
// Slice 1 (2026-10-27): "when the person steps out into the light, there
// should be a cinematic style shot that shows the world with the camera slowly
// panning". The camera leaves the player at the cave mouth, rises over the
// cliff edge, and sweeps slowly across the valley (the camp and its smoke by
// the river, the river itself, the plains with their herds, the far meadow),
// then settles back behind the player. No words: the world is the point.
//
// A tap or a key after the first second skips straight to the return, so a
// player who has seen it never sits through it. With gentle camera (the
// reduced-motion setting) there is no flight: one still wide shot, a cut in
// and a cut back.
const REVEAL = {
  rise: [new THREE.Vector3(26, 25, 13), new THREE.Vector3(30, 24, 16), new THREE.Vector3(36, 22, 20)],
  // where the camera looks while it drifts: near camp and river, the valley
  // floor, the plains, then down the valley to the south
  look: [
    new THREE.Vector3(44, 9, 30), new THREE.Vector3(62, 6, 52),
    new THREE.Vector3(96, 8, 50), new THREE.Vector3(84, 6, 98),
  ],
  still: { pos: new THREE.Vector3(30, 24, 15), look: new THREE.Vector3(66, 6, 58) },
};

export async function valleyReveal(G, { gentle = false } = {}) {
  const cam = G.renderer.camera;
  const prevMode = G.mode;
  G.mode = 'ui';
  G.input.setEnabled(false);
  G.hud.hidePrompt();
  const boxEl = document.createElement('div');
  boxEl.className = 'sky-letterbox';
  G.hud.root.appendChild(boxEl);

  // Where the rig wants the camera when we hand back: let syncCamera place
  // it, read it, put the camera back (the wake sequence's trick, so the
  // return lands with no pop).
  const p0 = cam.position.clone(), q0 = cam.quaternion.clone();
  G.player.syncCamera();
  const homePos = cam.position.clone(), homeQuat = cam.quaternion.clone();
  cam.position.copy(p0); cam.quaternion.copy(q0);

  const aim = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  const quatLooking = (from, at, out = new THREE.Quaternion()) =>
    out.setFromRotationMatrix(aim.lookAt(from, at, up));

  let skipped = false, armed = false;
  // a held movement key repeats, and would skip the moment we arm: only a
  // fresh press counts
  const skip = (e) => { if (armed && !e.repeat) skipped = true; };
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);
  const armTimer = setTimeout(() => { armed = true; }, 1000);

  try {
    if (gentle) {
      cam.position.copy(REVEAL.still.pos);
      quatLooking(REVEAL.still.pos, REVEAL.still.look, cam.quaternion);
      const t0 = performance.now();
      while (!skipped && performance.now() - t0 < 3500) await wait(100);
    } else {
      const path = new THREE.CatmullRomCurve3(REVEAL.rise);
      const gaze = new THREE.CatmullRomCurve3(REVEAL.look);
      const pos = new THREE.Vector3(), at = new THREE.Vector3(), q = new THREE.Quaternion();
      // 1. lift off the shoulder to the first viewpoint, already turning to
      //    the valley (3.2 s)
      const from = cam.position.clone(), fromQ = cam.quaternion.clone();
      path.getPoint(0, pos); gaze.getPoint(0, at);
      const firstQ = quatLooking(pos, at, new THREE.Quaternion());
      const firstPos = pos.clone();
      await tween(3200, (t) => {
        const k = ease(t);
        cam.position.lerpVectors(from, firstPos, k);
        cam.quaternion.slerpQuaternions(fromQ, firstQ, k);
      }, () => skipped);
      // 2. the slow pan: drift along the cliff edge while the gaze sweeps the
      //    valley (8 s, eased so it starts and ends without a jolt)
      if (!skipped) {
        await tween(8000, (t) => {
          const k = ease(t);
          path.getPoint(k, pos); gaze.getPoint(k, at);
          cam.position.copy(pos);
          cam.quaternion.copy(quatLooking(pos, at, q));
        }, () => skipped);
      }
    }
    // 3. home: back down behind the player (a cut if gentle)
    if (gentle) {
      cam.position.copy(homePos); cam.quaternion.copy(homeQuat);
    } else {
      const from = cam.position.clone(), fromQ = cam.quaternion.clone();
      await tween(skipped ? 900 : 2400, (t) => {
        const k = ease(t);
        cam.position.lerpVectors(from, homePos, k);
        cam.quaternion.slerpQuaternions(fromQ, homeQuat, k);
      });
    }
  } finally {
    clearTimeout(armTimer);
    window.removeEventListener('keydown', skip);
    window.removeEventListener('pointerdown', skip);
    boxEl.remove();
    G.player.syncCamera();
    G.input.setEnabled(true);
    G.mode = prevMode;
  }
}

// rAF-driven with a timer fallback: story beats await these, and rAF starves
// in hidden/embedded tabs — the fallback keeps progression from wedging.
// `stop` (optional) ends the tween early, where it stands, when it returns true.
export function tween(ms, fn, stop = null) {
  return new Promise((res) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { done = true; clearInterval(iv); res(); };
    const advance = () => {
      if (done) return;
      if (stop?.()) { finish(); return; }
      const k = Math.min(1, (performance.now() - t0) / ms);
      fn(k);
      if (k >= 1) finish();
    };
    (function step() {
      if (done) return;
      advance();
      if (!done) requestAnimationFrame(step);
    })();
    const iv = setInterval(advance, 250);
  });
}
