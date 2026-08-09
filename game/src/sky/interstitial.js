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
  G.input.setEnabled(true);
  G.mode = prevMode;
}

// rAF-driven with a timer fallback: story beats await these, and rAF starves
// in hidden/embedded tabs — the fallback keeps progression from wedging.
export function tween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { done = true; clearInterval(iv); res(); };
    const advance = () => {
      if (done) return;
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
