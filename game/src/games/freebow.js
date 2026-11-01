// The bow out in the world (2026-11-01: "the player should still be able to
// move while aiming, even during the training. also, the player should be able
// to use arrows no matter where they are. not only near the training post.").
//
// One bow for the whole band camp scene. Whenever the bow is in hand and
// equipped, it is up and shoots, anywhere: at the painted targets by the river,
// at any deer on the map, at the bear. Nothing plants the feet.
//
//  - Deer have 6 health and an arrow does 3, so a deer takes two arrows (the
//    user's numbers). A hit deer bolts; a downed deer drops its meat on the
//    spot, there and then ("killing an animal should immediately create the
//    meat. not after killing 3 of them").
//  - Meat left lying is saved, so a reload finds it where it fell.
//  - The painted targets still count three practice hits, once, for the
//    narrator's nod, but nothing waits on them any more.
//  - Anything else that wants arrows (the bear, games/bear.js) registers a
//    target with addTarget().
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { Inv } from '../inventory.js';
import { FX } from '../fx/fx.js';
import * as P from '../world/props.js';
import { Bow, bowHint } from './bow.js';

export const ARROW_DAMAGE = 3;
export const DEER_HEALTH = 6;
// Rabbits (2026-11-01: "rabbits give 1/2 meat", "one arrow. make rabbits hard
// to hit"): health 3, a small body to hit, half a meat each.
const PREY = {
  deer: { health: DEER_HEALTH, up: 0.62, r: 0.85, drop: 'meat', bar: 1.55 },
  hare: { health: 3, up: 0.28, r: 0.36, drop: 'rabbit', bar: 0.85 },
};
const SCATTER_HIT = 8, SCATTER_MISS = 5;
const PRACTICE = 3;

const _c = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Vector3();

// A body as a sphere: the closest approach of the arrow's step to its centre.
export function bodyTarget(get, up, r, extra) {
  return {
    ...extra,
    anchor: (v) => { const p = get(); return v.set(p.x, p.y + up, p.z); },
    hitTest(p0, p1) {
      const p = get();
      _c.set(p.x, p.y + up, p.z);
      _s.subVectors(p1, p0);
      const len2 = _s.lengthSq();
      const f = len2 > 0 ? Math.max(0, Math.min(1, _q.subVectors(_c, p0).dot(_s) / len2)) : 0;
      const point = new THREE.Vector3().copy(p0).addScaledVector(_s, f);
      if (point.distanceTo(_c) > r) return null;
      return { f, point, parent: extra.parent?.() ?? null, points: 1, tier: 1, dust: 0xb9a77e };
    },
  };
}

export function installFreeBow(G, { deer = [], postTargets = [] } = {}) {
  const extra = new Set();
  const deerTargets = new Map();
  const targetFor = (d) => {
    const k = PREY[d.kind] ?? PREY.deer;
    if (!deerTargets.has(d)) deerTargets.set(d, bodyTarget(() => d.pos, k.up, k.r, { deer: d, parent: () => d.fig ?? d.group }));
    return deerTargets.get(d);
  };
  const post = postTargets.map((t) => ({ t, post: true }));
  const meats = [];
  let practiceHits = 0;

  const scatter = (x, z, r) => {
    for (const o of deer) if (!o.downed && Math.hypot(o.pos.x - x, o.pos.z - z) < r) o.fleeFrom(x, z);
  };

  // ---------- the meat ----------
  const saveDrops = () => Save.setActivity('hunt', { drops: meats.map((m) => ({ x: m.at.x, y: m.at.y, z: m.at.z, item: m.item })) });
  const dropMeat = (at, item = at.item ?? 'meat') => {
    const m = { at, item, prop: P.makeMeat(at.x, at.y, at.z) };
    if (item === 'rabbit') m.prop.group.scale.setScalar(0.55);
    G.renderer.scene.add(m.prop.group);
    G.props.push(m.prop);
    m.spot = {
      id: `meat-${Math.round(at.x * 10)}-${Math.round(at.z * 10)}`, x: at.x, z: at.z, r: 2.6, prompt: '🍖', label: item === 'rabbit' ? S.act1.takeRabbit : S.act1.takeMeat, enabled: true,
      onInteract(self) {
        G.interactables = G.interactables.filter((o) => o !== self);
        P.disposeGroup(G.renderer.scene, m.prop.group);
        G.props = G.props.filter((pp) => pp !== m.prop);
        meats.splice(meats.indexOf(m), 1);
        saveDrops();
        Inv.add('player', item, 1);
        FX.floaties({ x: at.x, y: at.y + 0.5, z: at.z }, { color: 0xffd9a0, count: 12, size: 0.11, life: 1.6, rise: 1.0 });
        G.audio?.blip?.();
        api.onMeat?.();
      },
    };
    G.interactables.push(m.spot);
    meats.push(m);
    saveDrops();
  };
  for (const at of Save.activity('hunt').drops ?? []) dropMeat(at);

  const kill = (d) => {
    d.down();
    scatter(d.pos.x, d.pos.z, SCATTER_HIT);
    const at = { x: d.pos.x, y: d.pos.y, z: d.pos.z };
    // the body falls, then becomes the meat where it lies
    setTimeout(() => {
      FX.puff({ x: at.x, y: at.y + 0.4, z: at.z }, { count: 10, size: 0.32, life: 0.6, color: 0xb9a77e });
      d.dispose();
      G.npcs = G.npcs.filter((n) => n !== d);
      const k = deer.indexOf(d);
      if (k >= 0) deer.splice(k, 1);
      dropMeat(at, (PREY[d.kind] ?? PREY.deer).drop);
    }, 900);
    api.onKill?.(d);
  };

  // A small health bar over an animal you have hit (2026-11-01: "a small
  // health bar should appear above the animal that shows the life lost"):
  // the part just lost shows pale and drains away, then the bar fades.
  const bars = new Map();
  const barGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  const showBar = (d, frac, up) => {
    let b = bars.get(d);
    if (!b) {
      const mk = (color, order) => { const m = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, fog: false })); m.renderOrder = order; return m; };
      const g = new THREE.Group();
      const bg = mk(0x120a06, 900), lost = mk(0xf0d9a8, 901), fill = mk(0xc8321f, 902);
      bg.scale.set(0.9, 0.11, 1); bg.position.set(-0.45, 0, 0);
      for (const m of [lost, fill]) { m.scale.set(0.84, 0.07, 1); m.position.set(-0.42, 0, 0.001); }
      g.add(bg, lost, fill);
      G.renderer.scene.add(g);
      b = { g, fill, lost, mats: [bg.material, lost.material, fill.material], up, t: 0, frac: 1 };
      bars.set(d, b);
    }
    b.lost.scale.x = 0.84 * b.frac;
    b.frac = frac;
    b.fill.scale.x = 0.84 * frac;
    b.t = 0;
  };
  const tickBars = (dt) => {
    const cam = G.renderer.camera;
    for (const [d, b] of bars) {
      b.t += dt;
      b.g.position.set(d.pos.x, d.pos.y + b.up, d.pos.z);
      b.g.quaternion.copy(cam.quaternion);
      b.g.scale.setScalar(Math.max(1, cam.position.distanceTo(b.g.position) / 7)); // readable at range
      b.lost.scale.x += (b.fill.scale.x - b.lost.scale.x) * Math.min(1, dt * 2.5);
      const a = b.t < 3 ? 1 : Math.max(0, 1 - (b.t - 3) / 0.6);
      for (const m of b.mats) m.opacity = a;
      if (a <= 0 || (d.downed && b.t > 1)) { b.g.removeFromParent(); for (const m of b.mats) m.dispose(); bars.delete(d); }
    }
  };

  const bow = new Bow(G, {
    targets: () => [
      ...post.map((p) => p.t),
      ...deer.filter((d) => !d.downed && d.group.visible).map(targetFor),
      ...extra,
    ],
    onHit: (hit, arrow) => {
      const t = hit.target;
      // a full draw does the full 3; a rushed one only 1 (after Skyrim, where
      // an early release does about a third)
      const dmg = (arrow?.draw ?? 1) >= 0.95 ? ARROW_DAMAGE : 1;
      if (t?.deer) {
        const d = t.deer, k = PREY[d.kind] ?? PREY.deer;
        d.health = (d.health ?? k.health) - dmg;
        showBar(d, Math.max(0, d.health) / k.health, k.bar);
        if (d.health <= 0) { kill(d); bow.popup(S.range.down, 2); }
        else { d.fleeFrom(G.player.pos.x, G.player.pos.z); bow.popup(S.range.hitAgain, 1); }
        return;
      }
      if (t?.onArrow) { t.onArrow(hit, bow, dmg); return; }
      // a painted target at the post
      if (hit.points <= 0) { bow.popup(S.range.straw, -1); return; }
      bow.popup(hit.tier === 2 ? S.range.bull : S.range.hit, hit.tier);
      if (!Save.activity('hunt').practised && ++practiceHits >= PRACTICE) {
        Save.setActivity('hunt', { practised: true });
        G.hud.toast(S.range.practiceDone, 4200);
      }
    },
    onMiss: (at) => { if (at) scatter(at.x, at.z, SCATTER_MISS); },
  });
  bow.followsEquip = true;

  const api = {
    _folded: true,
    bow,
    onKill: null,
    onMeat: null,
    meatsLying: () => meats.length,
    nearestMeat(from) {
      let best = null, bd = Infinity;
      for (const m of meats) { const d = Math.hypot(m.at.x - from.x, m.at.z - from.z); if (d < bd) { bd = d; best = m.at; } }
      return best;
    },
    addTarget(t) { extra.add(t); return () => extra.delete(t); },
    // the bow is up whenever it is in hand and equipped, in the world, and
    // nothing else (a card, a panel, a cutscene) has the screen
    update(dt) {
      const want = G.mode === 'ground' && G.input.enabled && !G.tutorialActive &&
        Inv.has('player', 'bow') && Inv.equippedTool() === 'bow';
      if (want && !bow.raised) { bow.raise(); if (!api._hinted) { api._hinted = true; G.hud.hint(bowHint(G), 7000); } }
      else if (!want && bow.raised) bow.lower();
      bow.update(dt);
      tickBars(dt);
    },
    stop() { bow.stop(); },
    dispose() { bow.stop(); },
  };
  return api;
}
