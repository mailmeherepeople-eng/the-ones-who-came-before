// Ambient band / village life: NPCs run real errands out of the shared chest.
//
// Every worker loops: idle near home → walk to the chest → OPEN it and take a
// tool → walk out to a work site → work there (hunt, fish, gather, chop, tend)
// → walk back → OPEN the chest and put the tool back → idle again. Tools are
// visible in their hands the whole way, so the shared-store lesson is legible
// without a word of text.
//
// Scenes seed workers MID-CYCLE (see AmbientLife.assign's `seed`): when a
// scene loads someone is already out hunting and someone else is already
// walking home with a rod — the band is never caught all queueing at the box.
//
// Ownership rules:
//  - `npc.busy` is held for the whole errand, so the NPC's own idle wander
//    never fights the errand; it is released the moment the errand ends.
//  - Scripted act beats always win: call stop() before a beat that moves the
//    band by hand (the burial, the camp move), and every worker is handed back
//    empty-handed with its normal wander restored.
//  - A leg that cannot finish (blocked path, unreachable site) times out and
//    the errand is abandoned rather than hanging.
import * as THREE from '../../vendor/three.module.js';
import { WORLD } from '../constants.js';
import { B } from '../world/blocks.js';
import { FX } from '../fx/fx.js';
import { PROP_MATS, disposeGroup } from '../world/props.js';

const ARRIVE = 1.5;        // blocks — "close enough" to end a walking leg
const LEG_TIMEOUT = 45;    // seconds before a leg is abandoned
const CHEST_MS = 1.15;     // seconds spent at the open chest, each way

function rnd(range) { return range[0] + Math.random() * (range[1] - range[0]); }

// nearest living, unfrozen animal within maxD (skips carcasses)
function nearestLive(list, pos, maxD) {
  let best = null, bd = maxD * maxD;
  for (const a of list ?? []) {
    if (!a || a.downed || a.frozen) continue;
    const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = a; }
  }
  return best;
}

// a spooked animal trots clear of the shot but stays on its own range — a
// full fleeFrom would scatter the herd off the map after a few volleys
function spook(a, fx, fz) {
  const dx = a.pos.x - fx, dz = a.pos.z - fz;
  const d = Math.hypot(dx, dz) || 1;
  a.goTo(
    a.home.x + (dx / d) * 4 + (Math.random() - 0.5) * 3,
    a.home.z + (dz / d) * 4 + (Math.random() - 0.5) * 3,
  );
}

function topY(G, x, z) { return G.world.topAt(Math.round(x), Math.round(z)) + 1; }

// ---------- job factories ----------------------------------------------------
// A job is data: which tool it needs, where it happens, the work pose, and an
// onBeat hook that fires every `beat` seconds for the FX that make the work
// readable from across the valley.

export function jobHunt(G, { at, herd, item = 'bow' }) {
  return {
    id: 'hunt', item, icon: '🏹', doneIcon: '🏹🦌', pose: 'aim', at,
    work: [11, 17], beat: 2.6,
    onBeat(ctx, npc) {
      const prey = nearestLive(herd, npc.pos, 18);
      if (!prey) { npc._yawTarget += (Math.random() - 0.5) * 1.3; return; } // scanning
      npc.faceToward(prey.pos.x, prey.pos.z);
      ctx.shoot(npc, prey);
    },
  };
}

export function jobFish(G, { at, water, item = 'rod' }) {
  return {
    id: 'fish', item, icon: '🎣', doneIcon: '🐟', pose: 'cast', at, face: water,
    work: [11, 17], beat: 3.2,
    onBeat(ctx, npc) {
      const p = { x: water.x, y: WORLD.WATER_LEVEL + 0.2, z: water.z };
      FX.burst(p, { color: 0xbfe4f5, count: 9, size: 0.1, speed: 1.7, life: 0.5, gravity: 9, additive: false });
      if (Math.random() < 0.3) npc.say('🐟', 1600);
    },
  };
}

export function jobGather(G, { at, item = 'basket' }) {
  return {
    id: 'gather', item, icon: '🧺', doneIcon: '🫐', pose: 'pick', at,
    work: [9, 14], beat: 1.8,
    onBeat(ctx, npc) {
      const p = { x: at.x + 0.5, y: topY(G, at.x, at.z) + 0.7, z: at.z + 0.5 };
      FX.floaties(p, { color: 0xaef0c8, count: 4, size: 0.09, life: 1.1 });
      if (Math.random() < 0.45) FX.floaties(p, { color: 0xd8503c, count: 3, size: 0.08, life: 1.0, rise: 0.8 });
    },
  };
}

export function jobWood(G, { at, item = 'axe' }) {
  return {
    id: 'wood', item, icon: '🪵', doneIcon: '🪵', pose: 'chop', at,
    work: [8, 13], beat: 1.05,
    onBeat(ctx, npc) {
      const p = { x: at.x, y: topY(G, at.x, at.z) + 0.5, z: at.z };
      FX.burst(p, { color: 0xb08f52, count: 7, size: 0.08, speed: 2.2, life: 0.45, gravity: 8, additive: false });
    },
  };
}

// generic settled-life errand: field work, herding, hauling water
export function jobTend(G, { at, item = 'basket', icon = '🌾', doneIcon = '🌾', color = 0xaef0c8, pose = 'tend' }) {
  return {
    id: `tend-${at.x},${at.z}`, item, icon, doneIcon, pose, at,
    work: [10, 16], beat: 2.0,
    onBeat(ctx, npc) {
      const p = { x: npc.pos.x, y: npc.pos.y + 0.5, z: npc.pos.z };
      FX.floaties(p, { color, count: 4, size: 0.09, life: 1.2 });
    },
  };
}

// ---------- the scheduler ------------------------------------------------------

export class AmbientLife {
  /**
   * @param G          the game object (scene, world, props)
   * @param chest      chest prop from props.makeCommunityChest (hold/releaseHold)
   * @param chestAt    {x,z} of the chest block
   * @param jobs       { id: jobDef } — workers rotate through the ids they are given
   * @param stand      optional {x,z} standing spot; defaults to 1.4 in front (+z)
   * @param speed      walking speed while on an errand
   */
  constructor(G, { chest, chestAt, jobs, stand = null, speed = 1.5 }) {
    this.G = G;
    this.chest = chest;
    this.chestAt = chestAt;
    this.stand = stand ?? { x: chestAt.x, z: chestAt.z + 1.4 };
    this.jobs = jobs;
    this.workSpeed = speed;
    this.workers = [];
    this.arrows = [];
    this.stopped = false;
  }

  /**
   * Put an NPC to work.
   * @param npc     the Npc
   * @param jobIds  job id, or a list the worker rotates through
   * @param seed    'idle' | 'outbound' | 'work' | 'return' — where in the cycle
   *                this worker starts when the scene opens
   */
  assign(npc, jobIds, seed = 'idle') {
    const ids = Array.isArray(jobIds) ? jobIds : [jobIds];
    const w = {
      // a seeded worker starts on its FIRST job (the scene picks what should
      // already be happening); an idle one starts anywhere in its rotation
      npc, ids, idx: seed === 'idle' ? Math.floor(Math.random() * ids.length) : 0,
      job: null, state: 'idle', t: 1 + Math.random() * 6, legT: 0, beatT: 0,
      baseSpeed: npc.speed, home: { ...npc.home }, heldChest: false,
    };
    this.workers.push(w);
    if (seed !== 'idle') this._seed(w, seed);
    return w;
  }

  // Drop an NPC mid-cycle so the scene opens with the band already at work.
  _seed(w, seed) {
    const npc = w.npc;
    w.job = this.jobs[w.ids[w.idx]];
    if (!w.job) return;
    npc.busy = true;
    npc.speed = this.workSpeed;
    npc.carry(w.job.item);
    const site = w.job.at;
    if (seed === 'work') {
      this._place(npc, site.x + (Math.random() - 0.5) * 2, site.z + 1 + (Math.random() - 0.5) * 2, site);
      npc.pose(w.job.pose);
      const f = w.job.face ?? site;
      npc.faceToward(f.x, f.z);
      w.state = 'work';
      w.t = rnd(w.job.work) * 0.6;
      w.beatT = Math.random() * w.job.beat;
    } else {
      const back = seed === 'return';
      const from = back ? site : this.stand;
      const to = back ? this.stand : site;
      const k = 0.3 + Math.random() * 0.3;
      this._place(npc, from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k, site);
      w.state = back ? 'back' : 'toSite';
      w.legT = 0;
      npc.goTo(to.x, to.z);
    }
  }

  // Drop a character at (x, z), sliding toward `ref` (always open ground) if
  // the spot sits on a structure — a seeded worker must never open the scene
  // standing on a hut roof or the kiln stack.
  _place(npc, x, z, ref) {
    const w = this.G.world;
    const refH = w.topAt(Math.round(ref.x), Math.round(ref.z));
    let px = x, pz = z;
    for (let i = 0; i < 4; i++) {
      const cx = Math.round(px), cz = Math.round(pz);
      const h = w.topAt(cx, cz);
      if (h >= 0 && Math.abs(h - refH) <= 2 && w.get(cx, h + 1, cz) === B.AIR) break;
      px += (ref.x - px) * 0.45;
      pz += (ref.z - pz) * 0.45;
    }
    npc.pos.set(px, npc.pos.y, pz);
    npc.snapToGround();
    npc.home = { x: px, z: pz };
  }

  _nextJob(w) {
    w.idx = (w.idx + 1) % w.ids.length;
    return this.jobs[w.ids[w.idx]];
  }

  update(dt) {
    if (this.stopped) return;
    for (const w of this.workers) this._step(w, dt);
    this._stepArrows(dt);
  }

  _step(w, dt) {
    const npc = w.npc;
    if (!npc || npc.frozen) return;
    w.t -= dt;
    switch (w.state) {
      case 'idle':
        if (w.t <= 0) {
          w.job = this._nextJob(w);
          if (!w.job) { w.t = 6; return; }
          npc.busy = true;
          npc.speed = this.workSpeed;
          this._leg(w, this.stand);
        }
        break;

      case 'toChest':
        if (this._walk(w, dt, this.stand)) {
          npc.faceToward(this.chestAt.x, this.chestAt.z);
          this._holdChest(w, true);
          npc.say(w.job.icon, 2200);
          w.state = 'take';
          w.t = CHEST_MS;
        }
        break;

      case 'take':
        if (w.t <= 0) {
          npc.carry(w.job.item);
          this._chestSparkle();
          this._holdChest(w, false);
          this._leg(w, w.job.at, 'toSite');
        }
        break;

      case 'toSite':
        if (this._walk(w, dt, w.job.at)) {
          npc._target = null;
          npc.pose(w.job.pose);
          const f = w.job.face ?? w.job.at;
          npc.faceToward(f.x, f.z);
          w.state = 'work';
          w.t = rnd(w.job.work);
          w.beatT = 0.4;
        }
        break;

      case 'work':
        w.beatT -= dt;
        if (w.beatT <= 0) {
          w.beatT = w.job.beat;
          w.job.onBeat?.(this, npc, w);
        }
        if (w.t <= 0) {
          npc.pose(null);
          npc.say(w.job.doneIcon, 2200);
          this._leg(w, this.stand, 'back');
        }
        break;

      case 'back':
        if (this._walk(w, dt, this.stand)) {
          npc.faceToward(this.chestAt.x, this.chestAt.z);
          this._holdChest(w, true);
          w.state = 'put';
          w.t = CHEST_MS;
        }
        break;

      case 'put':
        if (w.t <= 0) {
          npc.carry(null);
          this._chestSparkle();
          this._holdChest(w, false);
          this._release(w);
          w.state = 'idle';
          w.t = 7 + Math.random() * 12;
        }
        break;
    }
  }

  // start a walking leg
  _leg(w, dest, state = 'toChest') {
    w.state = state;
    w.legT = 0;
    w.npc._target = null;
    w.npc.goTo(dest.x, dest.z);
  }

  // returns true on arrival; abandons the errand if the leg cannot finish
  _walk(w, dt, dest) {
    const npc = w.npc;
    w.legT += dt;
    if (Math.hypot(npc.pos.x - dest.x, npc.pos.z - dest.z) < ARRIVE) return true;
    if (w.legT > LEG_TIMEOUT) { this._abort(w); return false; }
    // nav clears a scripted target after repeated detours — re-issue it
    if (!npc._target && !npc.followTarget) npc.goTo(dest.x, dest.z);
    return false;
  }

  _holdChest(w, on) {
    if (on === w.heldChest) return;
    w.heldChest = on;
    if (on) this.chest?.hold?.();
    else this.chest?.releaseHold?.();
  }

  _chestSparkle() {
    const y = topY(this.G, this.chestAt.x, this.chestAt.z) + 0.7;
    FX.floaties({ x: this.chestAt.x, y, z: this.chestAt.z }, { color: 0xffd9a0, count: 6, size: 0.09, life: 1.2 });
  }

  // hand the NPC back its ordinary life
  _release(w) {
    const npc = w.npc;
    npc.busy = false;
    npc.pose(null);
    npc.speed = w.baseSpeed;
    npc.home = { ...w.home };
    npc._target = null;
  }

  _abort(w) {
    w.npc.carry(null);
    this._holdChest(w, false);
    this._release(w);
    w.state = 'idle';
    w.t = 4 + Math.random() * 5;
  }

  // ---- arrows in flight (hunting) ----
  // Fresh geometry per arrow and registration in G.props, so a scene teardown
  // between loose and landing disposes them exactly like the player's arrows.
  shoot(npc, prey) {
    const s = npc._s ?? 1;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), PROP_MATS.woodDark));
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.11), PROP_MATS.bone);
    fletch.position.z = -0.22;
    g.add(fletch);
    const from = { x: npc.pos.x, y: npc.pos.y + 1.25 * s, z: npc.pos.z };
    g.position.set(from.x, from.y, from.z);
    this.G.renderer.scene.add(g);
    const arrow = {
      group: g, from, prey, t: 0,
      dur: Math.max(0.3, Math.hypot(prey.pos.x - from.x, prey.pos.z - from.z) / 26),
      to: { x: prey.pos.x, y: prey.pos.y + 0.55, z: prey.pos.z },
    };
    this.arrows.push(arrow);
    this.G.props.push(arrow);
    return arrow;
  }

  _stepArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const x = a.from.x + (a.to.x - a.from.x) * k;
      const z = a.from.z + (a.to.z - a.from.z) * k;
      const y = a.from.y + (a.to.y - a.from.y) * k + Math.sin(k * Math.PI) * 0.5;
      a.group.position.set(x, y, z);
      a.group.lookAt(a.to.x, a.to.y, a.to.z);
      if (k < 1) continue;
      // it lands short or wide — the animal bolts, the hunter tries again
      FX.puff({ x, y, z }, { count: 6, size: 0.24, life: 0.5, color: 0xb9a77e });
      if (a.prey && !a.prey.downed) spook(a.prey, x, z);
      this._dropArrow(i);
    }
  }

  _dropArrow(i) {
    const a = this.arrows[i];
    this.arrows.splice(i, 1);
    this.G.props = this.G.props.filter((p) => p !== a);
    disposeGroup(this.G.renderer.scene, a.group);
  }

  // Hand every worker back to scripted control (idempotent).
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const w of this.workers) {
      w.npc.carry(null);
      this._holdChest(w, false);
      this._release(w);
      w.state = 'idle';
    }
    while (this.arrows.length) this._dropArrow(this.arrows.length - 1);
    this.chest?.setOpen?.(false);
  }
}
