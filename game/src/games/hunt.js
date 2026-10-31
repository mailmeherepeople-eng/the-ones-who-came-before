// The Act 1 hunt's shooting, on the shared bow (games/bow.js). Moved out of
// acts/act1.js, which is frozen at its size (AGENTS.md).
//
// The bow is up (first person, crosshair) whenever it is equipped; putting it
// away with the equip control lowers it (bow.js bowFollowsEquip). The tribe
// needs `need` deer; a kill scatters the herd
// near it and a miss in the grass spooks the deer near where it landed; kills
// are saved as they happen so a reload resumes with the bodies where they fell.
// New: hold to draw and let go to shoot, arrows that land where the crosshair
// is, and arrows that stay in the deer they hit.
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { FX } from '../fx/fx.js';
import { Bow, equipBow, bowFollowsEquip } from './bow.js';
import { wait } from '../ui/hud.js';

const BODY_UP = 0.62;  // the body's centre above a deer's feet
const BODY_R = 0.85;   // generous: a hunt, not an exam
const SCATTER_HIT = 8, SCATTER_MISS = 5;

const _c = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Vector3();
function deerTarget(d) {
  return {
    deer: d,
    anchor: (v) => v.set(d.pos.x, d.pos.y + BODY_UP, d.pos.z),
    // closest approach of the arrow's step to the deer's body
    hitTest(p0, p1) {
      _c.set(d.pos.x, d.pos.y + BODY_UP, d.pos.z);
      _s.subVectors(p1, p0);
      const len2 = _s.lengthSq();
      const f = len2 > 0 ? Math.max(0, Math.min(1, _q.subVectors(_c, p0).dot(_s) / len2)) : 0;
      const point = new THREE.Vector3().copy(p0).addScaledVector(_s, f);
      if (point.distanceTo(_c) > BODY_R) return null;
      return { f, point, parent: d.fig ?? d.group, points: 1, tier: 1, dust: 0xb9a77e };
    },
  };
}

// Resolves with the deer that were taken, once `need` are down.
export async function huntWithBow(G, deer, need) {
  const bag = [];
  for (const saved of Save.activity('hunt').kills ?? []) {
    const d = deer[saved.index];
    if (d) { d.pos.set(saved.x, saved.y, saved.z); d.down(); bag.push(d); }
  }
  if (bag.length >= need) return bag;

  const live = deer.map(deerTarget);
  const bow = new Bow(G, {
    targets: () => live.filter((t) => !t.deer.downed),
    onHit: (hit) => {
      const d = hit.target.deer;
      d.down();
      bag.push(d);
      Save.setActivity('hunt', { kills: bag.map((a) => ({ index: deer.indexOf(a), x: a.pos.x, y: a.pos.y, z: a.pos.z })) });
      FX.puff(d.pos, { count: 10, size: 0.32, life: 0.6, color: 0xb9a77e });
      for (const o of deer) {
        if (o !== d && !o.downed && Math.hypot(o.pos.x - d.pos.x, o.pos.z - d.pos.z) < SCATTER_HIT) o.fleeFrom(d.pos.x, d.pos.z);
      }
      bow.popup(S.range.hit, 1);
      if (bag.length < need) G.hud.setObjective(S.act1.obj_huntN(bag.length, need));
    },
    onMiss: (at) => {
      if (!at) return;
      for (const o of deer) {
        if (!o.downed && Math.hypot(o.pos.x - at.x, o.pos.z - at.z) < SCATTER_MISS) o.fleeFrom(at.x, at.z);
      }
    },
  });

  // Equipped means aiming: the crosshair comes with the bow (bow.js)
  equipBow(G);
  const follow = bowFollowsEquip(G, bow);
  G.hud.setObjective(S.act1.obj_huntN(bag.length, need));

  await new Promise((res) => {
    G.tick = (dt) => {
      follow();
      bow.update(dt);
      if (bag.length >= need) res();
    };
  });
  await wait(700); // the last one falls; arrows still in the air land
  G.tick = null;
  G.hud.hideHint();
  bow.stop();
  return bag;
}
