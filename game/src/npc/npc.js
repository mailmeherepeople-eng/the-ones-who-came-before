// NPCs and animals: blocky figures with grounded, wall-aware movement,
// idle life, blob shadows, and DOM speech bubbles (icon-based in Act 1 —
// invented pictograms, readable intent, no words).
//
// Movement notes (fixes wall-phasing / floating):
// - Columns span [x, x+1) so column lookup uses Math.floor, never Math.round.
// - Ground is found by scanning DOWN from just above current feet, so roofs
//   and rock-shelter overhangs never count as "ground".
// - Grounding samples a small CENTER footprint (GROUND_R), not the full
//   collision radius, so a character can never keep standing on the stale
//   column behind it after its center passes a ledge lip; drops resolve with
//   gravity-style acceleration (FALL_ACC), never a slow constant-rate glide.
// - Before moving, the destination footprint is checked: faces more than
//   ~1 block above the feet are walls — try axis-separated moves, then 45°
//   slides, and if still stalled take perpendicular detours; a scripted
//   target is force-cleared after 3 failed detours so beats never hang.
import * as THREE from '../../vendor/three.module.js';
import { WORLD } from '../constants.js';
import { isSolid, isWater } from '../world/blocks.js';
import { foldStatic } from '../world/merge.js';

const SY = WORLD.SIZE_Y;

const SKIN = [0x8a5a3a, 0x74492e, 0x9c6b45, 0x684026];
const WRAP = [0xa0563c, 0x8a6a3d, 0x767d4a, 0x6d5a70, 0x557080];
const HAIR = [0x241812, 0x14100c, 0x3d2414];

function clampW(v) { return Math.min(124, Math.max(4, v)); }
function clampX(v) { return Math.min(WORLD.SIZE_X - 2, Math.max(2, v)); }
function clampZ(v) { return Math.min(WORLD.SIZE_Z - 2, Math.max(2, v)); }

function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

// ---- shared geometry / material caches ------------------------------------
// Session-lived: dispose() only detaches groups from the scene so cached GPU
// resources stay valid for every other character (colors are a small set).
const GEO = new Map();
const MATS = new Map();

function geoBox(w, h, d, pivotTop) {
  const key = `${w},${h},${d}${pivotTop ? ',t' : ''}`;
  let g = GEO.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    if (pivotTop) g.translate(0, -h / 2, 0); // origin at top — limbs swing from hip/shoulder
    GEO.set(key, g);
  }
  return g;
}

function matFor(color) {
  let m = MATS.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); MATS.set(color, m); }
  return m;
}

function box(w, h, d, color, x = 0, y = 0, z = 0, pivotTop = false) {
  const m = new THREE.Mesh(geoBox(w, h, d, pivotTop), matFor(color));
  m.position.set(x, y, z);
  return m;
}

const SHADOW_GEO = new THREE.CircleGeometry(1, 12);
const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false,
});

function makeShadow(radius) {
  const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(radius);
  m.renderOrder = 1;
  return m;
}

// ---- terrain queries -------------------------------------------------------
// Top solid block index in a column, scanning DOWN from just above the feet.
// Ignores ceilings/overhangs above the character (unlike world.topAt).
function colGround(world, cx, cz, feetY) {
  let y = Math.min(SY - 1, Math.floor(feetY) + 1);
  while (y >= 0 && !isSolid(world.get(cx, y, cz))) y--;
  return y; // -1 if no ground below
}

// Highest walkable ground (block index) under a footprint of radius r.
function footTop(world, x, z, r, feetY) {
  let best = -1;
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const t = colGround(world, cx, cz, feetY);
      if (t > best) best = t;
    }
  return best;
}

// Can a character with footprint r and feet at feetY stand at (nx, nz)?
// Natural 1-block steps pass; 2+ block faces (cliffs, hut walls) do not.
function passable(world, nx, nz, r, feetY) {
  const x0 = Math.floor(nx - r), x1 = Math.floor(nx + r);
  const z0 = Math.floor(nz - r), z1 = Math.floor(nz + r);
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const t = colGround(world, cx, cz, feetY);
      if (t < 0) return false;                        // void — never walk off the world
      if (t + 1 - feetY > 1.05) return false;         // wall / cliff face
      if (isSolid(world.get(cx, t + 2, cz))) return false; // 1-high slot, no headroom
    }
  return true;
}

const S45 = Math.SQRT1_2;

// ---- the player as an obstacle ------------------------------------------------
// main.js registers the player's body here so characters cannot walk THROUGH
// the player (the player is pushed out of characters on its own side, in
// player.resolveCharacters). A candidate step is rejected only when it moves
// the character deeper into the player's cylinder — stepping OUT of an
// existing overlap always passes, so nobody can be wedged permanently.
let PLAYER_BODY = null;
export function setPlayerBody(body) { PLAYER_BODY = body; }

function hitsPlayer(e, nx, nz) {
  const p = PLAYER_BODY;
  if (!p || e.downed) return false;
  if (Math.abs(e.pos.y - p.pos.y) > 2.0) return false; // genuinely different levels
  const need = (p.r ?? 0.32) + e._r;
  const ndx = nx - p.pos.x, ndz = nz - p.pos.z;
  const nd2 = ndx * ndx + ndz * ndz;
  if (nd2 >= need * need) return false;
  const cdx = e.pos.x - p.pos.x, cdz = e.pos.z - p.pos.z;
  return nd2 <= cdx * cdx + cdz * cdz; // only block moves that close the gap
}

// Try the full move, then axis-separated, then 45° slides. Mutates e.pos.
function tryMove(e, dx, dz, dist) {
  const world = e.world, pos = e.pos, r = e._r;
  const ok = (nx, nz) => passable(world, nx, nz, r, pos.y) && !hitsPlayer(e, nx, nz);
  if (!world) { pos.x += dx * dist; pos.z += dz * dist; return true; }
  let nx = clampX(pos.x + dx * dist), nz = clampZ(pos.z + dz * dist);
  if (ok(nx, nz)) { pos.x = nx; pos.z = nz; return true; }
  if (Math.abs(dx) > 1e-4) {
    nx = clampX(pos.x + dx * dist);
    if (ok(nx, pos.z)) { pos.x = nx; return true; }
  }
  if (Math.abs(dz) > 1e-4) {
    nz = clampZ(pos.z + dz * dist);
    if (ok(pos.x, nz)) { pos.z = nz; return true; }
  }
  let sx = (dx - dz) * S45, sz = (dx + dz) * S45; // slide 45° one way
  nx = clampX(pos.x + sx * dist); nz = clampZ(pos.z + sz * dist);
  if (ok(nx, nz)) { pos.x = nx; pos.z = nz; return true; }
  sx = (dx + dz) * S45; sz = (dz - dx) * S45;     // then the other
  nx = clampX(pos.x + sx * dist); nz = clampZ(pos.z + sz * dist);
  if (ok(nx, nz)) { pos.x = nx; pos.z = nz; return true; }
  return false;
}

// ---- character registry / NPC-NPC separation --------------------------------
// Every live Npc/Animal registers here so characters gently push apart instead
// of standing inside (or on top of) each other. O(n²) with n <= ~12, with a
// squared-distance early-out and no per-frame allocation.
const CHARACTERS = [];
let SEP_SEED = 0;

const SEP_START = 0.55;             // begin pushing apart inside this distance
const SEP_START2 = SEP_START * SEP_START;
const SEP_HARD = 0.4;               // never let two characters rest closer than this
const SEP_SPEED = 0.9;              // gentle drift apart (blocks/sec)
const SEP_HARD_SPEED = 2.8;         // firm push while inside the hard radius
const SEP_GOLDEN = 2.399963;        // golden angle — spreads tie-break directions

function separateTick(e, dt) {
  if (e.frozen) return; // frozen characters hold still — the mobile one yields
  for (let i = 0; i < CHARACTERS.length; i++) {
    const o = CHARACTERS[i];
    if (o === e) continue;
    let dx = e.pos.x - o.pos.x;
    let dz = e.pos.z - o.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= SEP_START2) continue;                    // early-out on distance²
    if (Math.abs(e.pos.y - o.pos.y) > 2.4) continue;   // genuinely different levels
    let d = Math.sqrt(d2);
    if (d < 1e-4) {
      // perfectly coincident (incl. one standing on the other's head):
      // deterministic per-character direction so the pair always resolves
      const a = e._sepSeed * SEP_GOLDEN;
      dx = Math.sin(a); dz = Math.cos(a); d = 0;
    } else { dx /= d; dz /= d; }
    const speed = d < SEP_HARD ? SEP_HARD_SPEED : SEP_SPEED;
    const step = Math.min(SEP_START - d, speed * dt);
    if (step <= 0) continue;
    // tryMove runs the same passable() checks as walking, so separation can
    // never shove a character into a wall or off the world.
    tryMove(e, dx, dz, step);
  }
}

function registerCharacter(e) {
  e._sepSeed = SEP_SEED++;
  CHARACTERS.push(e);
}

function unregisterCharacter(e) {
  const i = CHARACTERS.indexOf(e);
  if (i >= 0) CHARACTERS.splice(i, 1);
}

// Per-frame vertical grounding: short lerp up 1-block steps, gravity-style
// fall when the ground drops, wading (feet ~0.6 under the waterline) in water
// columns. Returns true when wading. Sets e._groundY (solid surface under feet).
//
// Grounding uses a SMALL center footprint (GROUND_R), not the full collision
// radius: with the old max-of-4-columns footprint a character whose center had
// walked past a ledge lip kept "standing" on the stale column behind it —
// hovering in mid-air beyond the edge. Support now follows the center, so the
// body can only overhang a lip by a believable toe's width.
const GROUND_R = 0.15;  // grounding footprint radius (center 0.3 of the body)
const FALL_V0 = 4;      // initial fall speed (blocks/s) — small steps resolve instantly
const FALL_ACC = 30;    // downward acceleration (blocks/s²) — drops read as falls
const FALL_MAX = 16;    // terminal fall speed (blocks/s)

function groundTick(e, dt) {
  if (!e.world) return false;
  const g = footTop(e.world, e.pos.x, e.pos.z, GROUND_R, e.pos.y + 0.1);
  if (g < 0) return false;
  e._groundY = g + 1;
  let target = g + 1;
  let wading = false;
  const cx = Math.floor(e.pos.x), cz = Math.floor(e.pos.z);
  if (isWater(e.world.get(cx, g + 1, cz))) {
    let w = g + 1;
    while (w + 1 < SY && isWater(e.world.get(cx, w + 1, cz))) w++;
    if (w + 0.4 > g + 1) { // deep enough to float the body
      wading = true;
      target = Math.max(g + 1, w + 0.4 + Math.sin(e._t * 2.6) * 0.05);
    }
  }
  const dy = target - e.pos.y;
  if (dy > 0.001) {
    e._fallV = 0;
    e.pos.y = Math.min(target, e.pos.y + Math.max(3 * dt, dy * Math.min(1, 14 * dt)));
    if (!wading && target - e.pos.y > 0.35) e.pos.y = target - 0.35; // never sink deeper than a shin
  } else if (dy < -0.001) {
    // gravity-style fall: accelerate instead of gliding at a fixed rate, so a
    // walk off a ledge snaps down instead of drifting horizontally in mid-air
    e._fallV = Math.min(FALL_MAX, Math.max(FALL_V0, e._fallV) + FALL_ACC * dt);
    e.pos.y = Math.max(target, e.pos.y - e._fallV * dt);
    if (e.pos.y <= target) e._fallV = 0; // landed
  } else {
    e._fallV = 0;
  }
  return wading;
}

// ---- navigation / anti-stuck ------------------------------------------------
// Shared result object — consumed immediately by the caller, never stored.
const NAV = { x: 0, z: 0 };

function navTick(e, dt, tx, tz, scripted, isFollow) {
  e._stuckT += dt;
  if (e._stuckT >= 3) {
    const prog = Math.hypot(e.pos.x - e._stuckX, e.pos.z - e._stuckZ);
    e._stuckT = 0; e._stuckX = e.pos.x; e._stuckZ = e.pos.z;
    if (prog < 0.3) {
      if (!scripted) { e._target = null; e._detour = null; return null; } // unreachable wander — drop it
      e._detourCount++;
      if (e._detourCount > 3) {
        // last resort: complete the arrival so an act beat never hangs
        e._detour = null; e._detourCount = 0;
        if (!isFollow) e._target = null;
        return null;
      }
      const dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz) || 1;
      e._detourSide = -e._detourSide;
      const len = 2 + Math.random();
      e._detour = {
        x: clampX(e.pos.x + (-dz / d) * e._detourSide * len + (dx / d) * 0.8),
        z: clampZ(e.pos.z + (dx / d) * e._detourSide * len + (dz / d) * 0.8),
        t: 3.5,
      };
    }
  }
  if (e._detour) {
    e._detour.t -= dt;
    if (e._detour.t <= 0 || Math.hypot(e._detour.x - e.pos.x, e._detour.z - e.pos.z) < 0.5) {
      e._detour = null;
    } else {
      NAV.x = e._detour.x; NAV.z = e._detour.z;
      return NAV;
    }
  }
  NAV.x = tx; NAV.z = tz;
  return NAV;
}

function navIdle(e) { e._stuckT = 0; e._stuckX = e.pos.x; e._stuckZ = e.pos.z; }

// Wander-only filter: is (x, z) a precarious ledge lip? True when the
// destination column's neighbors drop more than 1.5 blocks on 2+ sides.
// Scripted goTo targets are NEVER run through this — beats always play out.
function nearLedge(world, x, z, feetY) {
  if (!world) return false;
  const cx = Math.floor(x), cz = Math.floor(z);
  const t = colGround(world, cx, cz, feetY + 1.1);
  if (t < 0) return true; // void column — never idle there
  let drops = 0;
  if (t - colGround(world, cx - 1, cz, t + 1) > 1.5) drops++;
  if (t - colGround(world, cx + 1, cz, t + 1) > 1.5) drops++;
  if (t - colGround(world, cx, cz - 1, t + 1) > 1.5) drops++;
  if (t - colGround(world, cx, cz + 1, t + 1) > 1.5) drops++;
  return drops >= 2;
}

// shortest signed angle from a to b
function angTo(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const _V = new THREE.Vector3(); // reused — no per-frame allocation

// ---- Npc --------------------------------------------------------------------
export class Npc {
  constructor(scene, uiRoot, camera, opts = {}) {
    this.scene = scene;
    this.uiRoot = uiRoot;
    this.camera = camera;
    this.name = opts.name ?? 'npc';
    this.home = { x: opts.x, z: opts.z };
    this.wanderR = opts.wander ?? 2.5;
    this.speed = opts.speed ?? 1.1;
    this.world = opts.world;
    this.followTarget = null;
    this.frozen = false;
    this.child = !!opts.child;

    const s = this._s = this.child ? 0.72 : 1;
    this._r = 0.3 * s;
    this._shR = 0.42 * s;
    const h = hashStr(this.name);
    const skin = opts.skin ?? SKIN[h % SKIN.length];
    const wrap = opts.wrap ?? WRAP[(h >> 3) % WRAP.length];
    const hairC = opts.elder ? 0xd8d3c8 : HAIR[(h >> 5) % HAIR.length];

    const g = new THREE.Group();
    const fig = this.fig = new THREE.Group();

    // torso: two-tone wrap with belt + shoulder drape
    this.body = box(0.5 * s, 0.6 * s, 0.32 * s, wrap, 0, 0.88 * s, 0);
    fig.add(this.body);
    fig.add(box(0.54 * s, 0.09 * s, 0.36 * s, shade(wrap, 1.35), 0, 0.62 * s, 0)); // belt
    fig.add(box(0.3 * s, 0.26 * s, 0.4 * s, shade(wrap, 0.7), -0.12 * s, 1.1 * s, 0)); // drape

    // head: kid-friendly big, with a real face (eyes + brow) and hair by name hash
    this.head = box(0.42 * s, 0.4 * s, 0.42 * s, skin, 0, 1.42 * s, 0);
    this.head.add(box(0.07 * s, 0.08 * s, 0.03 * s, 0x1a120c, -0.1 * s, 0.02 * s, 0.21 * s));
    this.head.add(box(0.07 * s, 0.08 * s, 0.03 * s, 0x1a120c, 0.1 * s, 0.02 * s, 0.21 * s));
    this.head.add(box(0.27 * s, 0.04 * s, 0.03 * s, hairC, 0, 0.11 * s, 0.21 * s)); // brow
    this.head.add(box(0.46 * s, 0.12 * s, 0.46 * s, hairC, 0, 0.23 * s, 0)); // cap of hair
    const style = opts.elder ? 0 : h % 3;
    if (style === 1) this.head.add(box(0.13 * s, 0.14 * s, 0.13 * s, hairC, 0, 0.34 * s, 0)); // top knot
    if (style === 2) this.head.add(box(0.1 * s, 0.34 * s, 0.09 * s, hairC, 0, -0.02 * s, -0.26 * s)); // back braid
    fig.add(this.head);

    // limbs pivot at hip/shoulder; feet stubs ride the legs
    this.legL = box(0.17 * s, 0.5 * s, 0.2 * s, skin, -0.13 * s, 0.58 * s, 0, true);
    this.legL.add(box(0.19 * s, 0.09 * s, 0.27 * s, shade(skin, 0.78), 0, -0.47 * s, 0.04 * s));
    this.legR = this.legL.clone(); this.legR.position.x = 0.13 * s;
    this.armL = box(0.13 * s, 0.52 * s, 0.17 * s, skin, -0.33 * s, 1.16 * s, 0, true);
    this.armR = this.armL.clone(); this.armR.position.x = 0.33 * s;
    fig.add(this.legL, this.legR, this.armL, this.armR);
    if (opts.elder) {
      // staff is a child of the right arm so it inherits arm swing/sway and
      // reads as held: gripped at the hand (arm-local origin is the shoulder,
      // hand sits ~0.47*s below), slightly forward with a small resting tilt.
      const staff = box(0.06, 1.4 * s, 0.06, 0x4c3a1e, 0.03 * s, -0.4 * s, 0.14 * s);
      staff.rotation.x = 0.1;
      this.armR.add(staff);
    }

    this.shadow = makeShadow(this._shR);
    this.shadow.position.y = 0.02;
    g.add(fig, this.shadow);

    // Fold the static parts into their animated parent, ~16 draw calls -> ~8.
    // Every part listed in a `keep` array is one the update loop moves, so it
    // has to survive as its own object: body breathes (scale.y), head turns,
    // limbs swing. Their static decoration has no such claim — eyes, brow and
    // hair ride the head; feet ride their leg; the belt and drape never move
    // relative to the torso group. The blob shadow is transparent so foldStatic
    // skips it on its own. Carried items attach after this and are unaffected.
    foldStatic(this.head);
    foldStatic(this.legL);
    foldStatic(this.legR);
    foldStatic(this.armR); // the elder's staff, when there is one
    foldStatic(fig, [this.body, this.head, this.legL, this.legR, this.armL, this.armR]);

    this.group = g;
    this.pos = g.position;
    this.pos.set(opts.x, opts.y ?? 0, opts.z);
    this._groundY = this.pos.y;
    this.snapToGround();
    scene.add(g);

    this.bubbleEl = null;
    this._t = Math.random() * 10;
    this._wt = Math.random() * 8;
    this._target = null;
    this._walkPhase = Math.random() * 6;
    this._yaw = this._yawTarget = Math.random() * Math.PI * 2;
    g.rotation.y = this._yaw;
    this._stuckT = 0; this._stuckX = this.pos.x; this._stuckZ = this.pos.z;
    this._detour = null; this._detourCount = 0; this._detourSide = 1;
    this._idleT = 1 + Math.random() * 4;
    this._glance = 0; this._glanceT = 0;
    this._bob = 0; this._lean = 0;
    this._hopT = 0; this._hopCd = 2 + Math.random() * 3;
    this._fallV = 0;
    // ambient work state (npc/ambient.js): `busy` suppresses idle wandering
    // while a job leg owns the character; carried item + work pose are visual.
    this.busy = false;
    this.carried = null;
    this._carryCache = {};
    this._carryCur = null;
    this._pose = null;
    this._poseT = 0;
    registerCharacter(this);
  }

  snapToGround() {
    if (!this.world) return;
    let top = -1;
    for (const bx of [Math.floor(this.pos.x - this._r), Math.floor(this.pos.x + this._r)])
      for (const bz of [Math.floor(this.pos.z - this._r), Math.floor(this.pos.z + this._r)])
        top = Math.max(top, this.world.topAt(bx, bz));
    if (top >= 0) { this.pos.y = top + 1; this._groundY = this.pos.y; }
  }

  goTo(x, z) {
    this._target = { x, z, scripted: true };
    this._detour = null; this._detourCount = 0;
    this._stuckT = 0; this._stuckX = this.pos.x; this._stuckZ = this.pos.z;
  }

  update(dt) {
    this._t += dt;
    const cam = this.camera;
    const pdx = cam ? cam.position.x - this.pos.x : 1e9;
    const pdz = cam ? cam.position.z - this.pos.z : 1e9;
    const pd = Math.hypot(pdx, pdz);

    let moving = false;
    if (!this.frozen) {
      this._wt -= dt;
      let tx = null, tz = null, scripted = false, isFollow = false;
      if (this.followTarget) {
        const d = Math.hypot(this.followTarget.x - this.pos.x, this.followTarget.z - this.pos.z);
        if (d > 1.6) { tx = this.followTarget.x; tz = this.followTarget.z; scripted = true; isFollow = true; }
      } else if (this._target) {
        if (Math.hypot(this._target.x - this.pos.x, this._target.z - this.pos.z) < 0.4) {
          this._target = null; this._detour = null; this._detourCount = 0; // arrived
        } else {
          tx = this._target.x; tz = this._target.z; scripted = !!this._target.scripted;
        }
      } else if (this._wt <= 0 && !this.busy) {
        this._wt = 3 + Math.random() * 6;
        // pick a wander spot, skipping precarious ledge lips (few tries, then wait)
        for (let i = 0; i < 4 && !this._target; i++) {
          const a = Math.random() * Math.PI * 2;
          const x = clampX(this.home.x + Math.cos(a) * this.wanderR * Math.random());
          const z = clampZ(this.home.z + Math.sin(a) * this.wanderR * Math.random());
          if (!nearLedge(this.world, x, z, this.pos.y)) this._target = { x, z, scripted: false };
        }
      }

      if (tx !== null) {
        const nav = navTick(this, dt, tx, tz, scripted, isFollow);
        if (nav) {
          const dx = nav.x - this.pos.x, dz = nav.z - this.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          const step = Math.min(this.speed * dt, d);
          moving = tryMove(this, dx / d, dz / d, step);
          if (moving) this._yawTarget = Math.atan2(dx, dz);
        }
      } else {
        navIdle(this);
      }
      separateTick(this, dt);
    }

    const wading = groundTick(this, dt);

    // ---- animation ----
    let headYaw = 0;
    if (moving) {
      this._walkPhase += dt * (wading ? 4.5 : 7);
      const sw = Math.sin(this._walkPhase) * (wading ? 0.32 : 0.55);
      this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
      this.armL.rotation.x = -sw * 0.5; this.armR.rotation.x = sw * 0.5;
      this.armL.rotation.z = this.armR.rotation.z = 0;
      this._bob += (Math.abs(Math.sin(this._walkPhase)) * 0.05 - this._bob) * Math.min(1, 10 * dt);
      this._lean += (0.07 - this._lean) * Math.min(1, 6 * dt);
      if (this.child) { // hop-skip
        this._hopCd -= dt;
        if (this._hopCd <= 0) { this._hopCd = 1.6 + Math.random() * 2.4; this._hopT = 0.38; }
      }
      if (pd < 3.5) headYaw = angTo(this._yaw, Math.atan2(pdx, pdz)) * 0.5; // walking glance
    } else {
      const k = Math.min(1, 8 * dt);
      this.legL.rotation.x -= this.legL.rotation.x * k;
      this.legR.rotation.x -= this.legR.rotation.x * k;
      this.armL.rotation.x -= this.armL.rotation.x * k;
      this.armR.rotation.x -= this.armR.rotation.x * k;
      this._bob -= this._bob * Math.min(1, 6 * dt);
      this._lean -= this._lean * Math.min(1, 6 * dt);
      // idle life — suppressed while an errand owns the character, so a
      // hunter keeps facing the herd instead of turning to greet the player
      if (!this.frozen && !this.busy) {
        if (pd < 2.4) this._yawTarget = Math.atan2(pdx, pdz); // greet a very close player
        this._idleT -= dt;
        if (this._idleT <= 0) {
          this._idleT = (this.child ? 1.6 : 3) + Math.random() * (this.child ? 3 : 5);
          const r = Math.random();
          if (pd < 6 && r < 0.65) this._yawTarget = Math.atan2(pdx, pdz); // turn to watch player
          else if (r < 0.82) this._yawTarget += (Math.random() - 0.5) * 1.4; // look around
          else { this._glance = (Math.random() - 0.5) * 1.1; this._glanceT = 1.2 + Math.random(); }
          if (this.child && Math.random() < 0.35) this._hopT = 0.3; // fidget hop
        }
      }
      if (pd < 6) headYaw = angTo(this._yaw, Math.atan2(pdx, pdz));
      else if (this._glanceT > 0) { this._glanceT -= dt; headYaw = this._glance; }
      // idle arm sway
      const sway = Math.sin(this._t * 1.3) * 0.04;
      this.armL.rotation.z = 0.05 + sway;
      this.armR.rotation.z = -0.05 + sway;
    }

    // work pose overrides the standing animation (never the walk cycle, so a
    // carried tool still swings naturally on the way there and back)
    if (this._pose && !moving) this._applyPose(dt);

    // breathing (always — even frozen NPCs are alive)
    this.body.scale.y = 1 + Math.sin(this._t * (this.child ? 2.6 : 1.7)) * 0.02;

    // head look (clamped so necks don't exorcist)
    headYaw = Math.max(-0.65, Math.min(0.65, headYaw));
    this.head.rotation.y += (headYaw - this.head.rotation.y) * Math.min(1, 6 * dt);

    // hop arc + torso bob/lean
    let hopY = 0;
    if (this._hopT > 0) {
      this._hopT -= dt;
      hopY = Math.sin(Math.min(1, Math.max(0, 1 - this._hopT / 0.38)) * Math.PI) * 0.13;
    }
    this.fig.position.y = this._bob + hopY;
    this.fig.rotation.x = this._lean;

    // smooth turn (runs while frozen too — faceToward during dialogs)
    const dyaw = angTo(this._yaw, this._yawTarget);
    const wmax = 9 * dt;
    this._yaw += Math.abs(dyaw) <= wmax ? dyaw : Math.sign(dyaw) * wmax;
    this.group.rotation.y = this._yaw;

    // blob shadow glued to the ground under the character
    this.shadow.position.y = this._groundY - this.pos.y + 0.03;
    const hgt = Math.max(0, this.pos.y - this._groundY);
    this.shadow.scale.setScalar(this._shR * Math.max(0.5, 1 - hgt * 0.35));

    this._bubbleTick();
  }

  faceToward(x, z) {
    this._yawTarget = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  // ---- carried items (visual only) ------------------------------------------
  // carry(kind) with kind ∈ 'bow'|'rod'|'basket'|'spear'|'axe'|'firewood'|null.
  // Mirrors player.equip: the item is parented to an ARM group, so it inherits
  // the walk swing and hides with the character. Item groups are cached per
  // kind on the character (a handful of small boxes each).
  carry(kind) {
    if (this._carryCur) {
      this._carryCur.parent?.remove(this._carryCur);
      this._carryCur = null;
    }
    this.carried = kind || null;
    if (!this.carried) return;
    let item = this._carryCache[this.carried];
    if (!item) item = this._carryCache[this.carried] = this._buildCarry(this.carried);
    (this.carried === 'basket' || this.carried === 'firewood' ? this.armL : this.armR).add(item);
    this._carryCur = item;
  }

  // Arm-local space: origin is the SHOULDER, the hand sits ~0.47·s below it,
  // and +z is the character's front.
  _buildCarry(kind) {
    const s = this._s;
    const g = new THREE.Group();
    const wood = 0x6d5028, woodDark = 0x4c3a1e, tan = 0xc9a866, tanDark = 0xb08f52;
    if (kind === 'bow') {
      g.add(box(0.05, 0.34, 0.06, wood, 0, 0, 0));
      const t = box(0.045, 0.3, 0.05, wood, 0, 0.26, 0.04); t.rotation.x = -0.45;
      const b = box(0.045, 0.3, 0.05, wood, 0, -0.26, 0.04); b.rotation.x = 0.45;
      g.add(t, b);
      g.add(box(0.014, 0.72, 0.014, 0x2a2118, 0, 0, 0.15));
      g.position.set(0.02, -0.45 * s, 0.08);
      g.rotation.set(0.15, 0, 0.45);
    } else if (kind === 'rod') {
      g.add(box(0.035, 1.2, 0.035, wood, 0, 0.42, 0));
      const line = box(0.014, 0.2, 0.014, 0x2a2118, 0, 0.96, -0.08);
      line.rotation.x = -1.0;
      g.add(line);
      g.position.set(0.02, -0.45 * s, 0.1);
      g.rotation.x = 1.0;
    } else if (kind === 'basket') {
      g.add(box(0.28, 0.05, 0.22, tan, 0, -0.09, 0));
      g.add(box(0.32, 0.15, 0.03, tan, 0, 0, 0.11));
      g.add(box(0.32, 0.15, 0.03, tan, 0, 0, -0.11));
      g.add(box(0.03, 0.15, 0.22, tanDark, -0.16, 0, 0));
      g.add(box(0.03, 0.15, 0.22, tanDark, 0.16, 0, 0));
      g.add(box(0.35, 0.04, 0.26, tanDark, 0, 0.08, 0)); // rim
      g.position.set(0.15, -0.48 * s, 0.2);
    } else if (kind === 'firewood') {
      for (let i = 0; i < 3; i++) {
        const l = box(0.5, 0.09, 0.09, i % 2 ? woodDark : wood, 0, -0.42 + i * 0.1, 0.16);
        l.rotation.y = 0.12 - i * 0.12;
        g.add(l);
      }
      g.position.set(0.16, -0.4 * s, 0.06);
    } else if (kind === 'axe') {
      g.add(box(0.06, 0.55, 0.06, wood, 0, -0.2, 0));
      g.add(box(0.2, 0.14, 0.05, 0x777777, 0.07, 0.03, 0));
      g.position.set(0.02, -0.42 * s, 0.06);
      g.rotation.set(0.2, 0, 0.2);
    } else { // spear
      g.add(box(0.05, 1.5, 0.05, woodDark, 0, 0.25, 0));
      g.add(box(0.09, 0.2, 0.04, 0x777777, 0, 1.08, 0));
      g.position.set(0.02, -0.45 * s, 0.05);
      g.rotation.set(0.18, 0, -0.08);
    }
    g.scale.setScalar(s);
    return g;
  }

  // ---- work poses (visual only) ---------------------------------------------
  // pose(name) with name ∈ 'aim'|'cast'|'pick'|'chop'|'tend'|null. Applied
  // only while standing still; pose(null) hands the arms back to the idle sway.
  pose(name) {
    if (this._pose === (name || null)) return;
    this._pose = name || null;
    this._poseT = 0;
  }

  _applyPose(dt) {
    this._poseT += dt;
    const t = this._poseT;
    const L = this.armL.rotation, R = this.armR.rotation;
    if (this._pose === 'aim') {
      const draw = 0.5 + Math.sin(t * 1.5) * 0.5; // slow draw / release cycle
      L.x = -1.45; L.z = 0.22;
      R.x = -1.2 - draw * 0.2; R.z = -0.45 - draw * 0.4;
    } else if (this._pose === 'cast') {
      const s = Math.sin(t * 0.9);
      L.x = -0.55; L.z = 0.12;
      R.x = -1.15 + s * 0.45; R.z = -0.12;
    } else if (this._pose === 'pick') {
      const s = Math.abs(Math.sin(t * 1.8));
      L.x = -0.55 - s * 0.7; L.z = 0.2;
      R.x = -0.5 - s * 0.85; R.z = -0.2;
      this._lean = 0.2 + s * 0.14; // stoop into the bush
    } else if (this._pose === 'chop') {
      const s = Math.sin(t * 3.4);
      L.x = -0.7 + s * 0.5; L.z = 0.15;
      R.x = -0.9 + s * 0.9; R.z = -0.15;
      this._lean = 0.1 + Math.max(0, s) * 0.1;
    } else if (this._pose === 'tend') {
      const s = Math.sin(t * 1.4);
      L.x = -0.75 + s * 0.2; L.z = 0.3;
      R.x = -0.75 - s * 0.2; R.z = -0.3;
      this._lean = 0.14;
    }
  }

  // icon speech bubble (emoji stand in for pictograms)
  say(icons, ms = 3200) {
    this._clearBubble();
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = icons;
    this.uiRoot.appendChild(el);
    this.bubbleEl = el;
    if (ms) this._bubbleTimer = setTimeout(() => this._clearBubble(), ms);
  }

  _clearBubble() {
    clearTimeout(this._bubbleTimer);
    if (this.bubbleEl) { this.bubbleEl.remove(); this.bubbleEl = null; }
  }

  _bubbleTick() {
    if (!this.bubbleEl) return;
    // far-off workers still chatter (ambient jobs) — their bubbles must not
    // float over the valley as free-standing icons
    const cam = this.camera;
    if (cam && Math.hypot(cam.position.x - this.pos.x, cam.position.z - this.pos.z) > 26) {
      this.bubbleEl.style.opacity = '0';
      return;
    }
    _V.set(this.pos.x, this.pos.y + 2.0 * this._s, this.pos.z);
    _V.project(this.camera);
    if (_V.z > 1) { this.bubbleEl.style.opacity = '0'; return; }
    this.bubbleEl.style.opacity = '1';
    this.bubbleEl.style.left = `${(_V.x * 0.5 + 0.5) * innerWidth}px`;
    this.bubbleEl.style.top = `${(-_V.y * 0.5 + 0.5) * innerHeight}px`;
  }

  dispose() {
    this._clearBubble();
    unregisterCharacter(this);
    // geometry/materials live in module caches shared by all characters —
    // only detach from the scene (do NOT disposeGroup here).
    this.scene.remove(this.group);
  }
}

// ---- Animal -------------------------------------------------------------------
export class Animal {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.kind = opts.kind ?? 'deer';
    this.world = opts.world;
    this.home = { x: opts.x, z: opts.z };
    this.wanderR = opts.wander ?? 5;
    this.speed = opts.speed ?? (this.kind === 'predator' ? 3.2 : 1.6);
    this.followTarget = null;
    this.fleeing = false;
    this.frozen = false;

    const K = this.kind;
    this._r = K === 'cattle' ? 0.36 : 0.3;
    this._shR = K === 'cattle' ? 0.55 : 0.45;

    const colors = { deer: 0x9a7448, goat: 0xd8d3c8, cattle: 0x6b4d3a, predator: 0x5a4a3c };
    const c = colors[K] ?? 0x9a7448;
    const dark = shade(c, 0.7);

    // distinct silhouettes per kind
    let bw, bh, blen, by, hw, hh, hd, hy, legH, legW;
    if (K === 'cattle') { bw = 0.6; bh = 0.5; blen = 0.95; by = 0.74; hw = 0.3; hh = 0.3; hd = 0.32; hy = 0.94; legH = 0.5; legW = 0.13; }
    else if (K === 'predator') { bw = 0.4; bh = 0.34; blen = 1.05; by = 0.52; hw = 0.3; hh = 0.26; hd = 0.34; hy = 0.6; legH = 0.36; legW = 0.1; } // low, long prowl posture
    else if (K === 'goat') { bw = 0.36; bh = 0.38; blen = 0.7; by = 0.62; hw = 0.24; hh = 0.26; hd = 0.28; hy = 0.8; legH = 0.44; legW = 0.09; }
    else { bw = 0.4; bh = 0.4; blen = 0.8; by = 0.68; hw = 0.26; hh = 0.28; hd = 0.3; hy = 0.88; legH = 0.48; legW = 0.09; }

    const g = new THREE.Group();
    const fig = this.fig = new THREE.Group();
    this.body = box(bw, bh, blen, c, 0, by, 0);
    this.head = box(hw, hh, hd, c, 0, hy, blen / 2 + hd / 2 - 0.02);
    this._headY = hy;
    // eyes
    this.head.add(box(0.05, 0.06, 0.03, 0x171310, -(hw / 2 - 0.05), 0.03, hd / 2));
    this.head.add(box(0.05, 0.06, 0.03, 0x171310, hw / 2 - 0.05, 0.03, hd / 2));

    this._tail = null;
    this._tailAxis = 'y';
    if (K === 'deer') {
      this.head.add(box(0.05, 0.3, 0.05, 0x6d5028, -0.1, 0.26, -0.04)); // antlers
      this.head.add(box(0.05, 0.3, 0.05, 0x6d5028, 0.1, 0.26, -0.04));
      this._tail = box(0.13, 0.16, 0.05, 0xe8e2d4, 0, by + 0.08, -blen / 2 - 0.02); // white tail patch
    } else if (K === 'goat') {
      const h1 = box(0.05, 0.2, 0.05, 0x8d8d8d, -0.08, 0.18, -0.03);
      h1.rotation.x = -0.8; // curved-back horns
      const h2 = h1.clone(); h2.position.x = 0.08;
      this.head.add(h1, h2);
      this.head.add(box(0.05, 0.11, 0.05, shade(c, 0.85), 0, -hh / 2 - 0.04, hd / 2 - 0.04)); // beard
      this._tail = box(0.06, 0.12, 0.05, dark, 0, by + 0.12, -blen / 2 - 0.02);
    } else if (K === 'cattle') {
      this.head.add(box(0.26, 0.06, 0.07, 0xd8d3c8, -0.22, 0.12, 0)); // wide horns
      this.head.add(box(0.26, 0.06, 0.07, 0xd8d3c8, 0.22, 0.12, 0));
      this.head.add(box(0.24, 0.13, 0.08, 0xcbb79f, 0, -0.09, hd / 2)); // muzzle
      this._tail = box(0.06, 0.42, 0.06, dark, 0, by + 0.14, -blen / 2 - 0.03, true); // hanging tail
      this._tailAxis = 'z';
    } else { // predator
      this.head.add(box(0.32, 0.1, 0.05, 0x2b211a, 0, 0.03, hd / 2)); // dark mask
      this.head.add(box(0.18, 0.05, 0.06, 0xe8e2d4, 0, -hh / 2 + 0.01, hd / 2 - 0.03)); // teeth notch
      this.head.add(box(0.07, 0.09, 0.06, dark, -0.1, hh / 2 + 0.03, -0.05)); // ears
      this.head.add(box(0.07, 0.09, 0.06, dark, 0.1, hh / 2 + 0.03, -0.05));
      this._tail = box(0.07, 0.07, 0.5, dark, 0, by + 0.08, -blen / 2 - 0.22);
      this._tail.rotation.x = -0.45;
    }
    if (this._tail) fig.add(this._tail);
    fig.add(this.body, this.head);

    // 4-beat gait: each leg a quarter-phase apart (LR walk sequence)
    this.legs = [];
    const off = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    let i = 0;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      const l = box(legW, legH, legW, dark, dx * (bw / 2 - legW / 2), legH, dz * (blen / 2 - 0.12), true);
      l._ph = off[i++];
      this.legs.push(l); fig.add(l);
    }

    this.shadow = makeShadow(this._shR);
    this.shadow.position.y = 0.02;
    g.add(fig, this.shadow);

    // Same fold as the human figure. The head carries the whole species
    // silhouette as static decoration — antlers, horns, beard, muzzle, the
    // predator's mask, teeth and ears — so a prowler drops from 8 head meshes
    // to 1. Body, head, tail and the four gait legs all animate, so they stay.
    foldStatic(this.head);
    foldStatic(fig, [this.body, this.head, this._tail, ...this.legs].filter(Boolean));

    this.group = g;
    this.pos = g.position;
    this.pos.set(opts.x, 0, opts.z);
    this._groundY = this.pos.y;
    this.snapToGround();
    scene.add(g);

    this._t = Math.random() * 10;
    this._wt = Math.random() * 4;
    this._target = null;
    this._phase = Math.random() * 6;
    this._yaw = this._yawTarget = Math.random() * Math.PI * 2;
    g.rotation.y = this._yaw;
    this._stuckT = 0; this._stuckX = this.pos.x; this._stuckZ = this.pos.z;
    this._detour = null; this._detourCount = 0; this._detourSide = 1;
    this._graze = 0; this._grazeT = 0; this._grazeCd = 4 + Math.random() * 8;
    this._flickT = 0; this._flickCd = 2 + Math.random() * 4;
    this._prowl = 0;
    this._fallV = 0;
    // down-state (carcass): after the 90° side-fall the body center ends up at
    // ground level, so the fig is LIFTED by ~half the body width minus a small
    // sink so the carcass rests believably in the grass instead of half-buried
    this.downed = false;
    this._downT = 0;
    this._downLift = Math.max(0, bw / 2 - 0.06);
    registerCharacter(this);
  }

  snapToGround() {
    if (!this.world) return;
    let top = -1;
    for (const bx of [Math.floor(this.pos.x - this._r), Math.floor(this.pos.x + this._r)])
      for (const bz of [Math.floor(this.pos.z - this._r), Math.floor(this.pos.z + this._r)])
        top = Math.max(top, this.world.topAt(bx, bz));
    if (top >= 0) { this.pos.y = top + 1; this._groundY = this.pos.y; }
  }

  goTo(x, z) {
    if (this.downed) return; // carcasses don't take orders
    this._target = { x: clampW(x), z: clampW(z), scripted: true };
    this._detour = null; this._detourCount = 0;
    this._stuckT = 0; this._stuckX = this.pos.x; this._stuckZ = this.pos.z;
  }

  fleeFrom(x, z) {
    if (this.downed) return;
    const dx = this.pos.x - x, dz = this.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this._target = { x: clampW(this.pos.x + (dx / d) * 18), z: clampW(this.pos.z + (dz / d) * 18), scripted: true };
    this.fleeing = true;
    this._detour = null; this._detourCount = 0;
    this._stuckT = 0; this._stuckX = this.pos.x; this._stuckZ = this.pos.z;
  }

  // Permanent down-state: all AI/movement stops, a quick ~0.4s side-fall
  // plays in update(), then the body stays put as a carcass (the act disposes
  // it and places meat). animal.downed flags the state; goTo/fleeFrom become
  // no-ops. Idempotent — a second call does nothing.
  down() {
    if (this.downed) return;
    this.downed = true;
    this.fleeing = false;
    this.followTarget = null;
    this._target = null;
    this._detour = null;
    this._downT = 0;
  }

  update(dt) {
    this._t += dt;
    if (this.downed) {
      // fall animation only: ease onto the side over ~0.4s, settle slightly
      // sunk into the ground; blob shadow stays glued. No AI, gait, or
      // breathing — everything below is skipped for good.
      this._downT = Math.min(0.4, this._downT + dt);
      const k = this._downT / 0.4;
      const e = k * (2 - k); // ease-out
      this.fig.rotation.z = e * (Math.PI / 2);
      this.fig.position.y = e * this._downLift;
      this.shadow.position.y = this._groundY - this.pos.y + 0.03;
      this.shadow.scale.setScalar(this._shR);
      return;
    }
    let moving = false;
    if (!this.frozen) {
      this._wt -= dt;
      let tx = null, tz = null, scripted = false, isFollow = false;
      if (this.followTarget) {
        const d = Math.hypot(this.followTarget.x - this.pos.x, this.followTarget.z - this.pos.z);
        if (d > 1.8) { tx = this.followTarget.x; tz = this.followTarget.z; scripted = true; isFollow = true; }
      } else if (this._target) {
        if (Math.hypot(this._target.x - this.pos.x, this._target.z - this.pos.z) < 0.6) {
          this._target = null; this.fleeing = false; this._detour = null; this._detourCount = 0;
        } else {
          tx = this._target.x; tz = this._target.z; scripted = !!this._target.scripted;
        }
      } else if (this._wt <= 0) {
        this._wt = 2 + Math.random() * 5;
        // pick a wander spot, skipping precarious ledge lips (few tries, then wait)
        for (let i = 0; i < 4 && !this._target; i++) {
          const a = Math.random() * Math.PI * 2;
          const x = clampX(this.home.x + Math.cos(a) * this.wanderR * Math.random());
          const z = clampZ(this.home.z + Math.sin(a) * this.wanderR * Math.random());
          if (!nearLedge(this.world, x, z, this.pos.y)) this._target = { x, z, scripted: false };
        }
      }
      if (tx !== null) {
        const nav = navTick(this, dt, tx, tz, scripted, isFollow);
        if (nav) {
          const dx = nav.x - this.pos.x, dz = nav.z - this.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          const sp = this.fleeing ? this.speed * 2.2 : this.speed;
          const step = Math.min(sp * dt, d);
          moving = tryMove(this, dx / d, dz / d, step);
          if (moving) this._yawTarget = Math.atan2(dx, dz);
        } else if (!this._target) {
          this.fleeing = false; // stall cleared the flee target
        }
      } else {
        navIdle(this);
      }
      separateTick(this, dt);
    }

    const wading = groundTick(this, dt);

    // ---- gait / idle ----
    if (moving) {
      this._phase += dt * (this.fleeing ? 14 : 8) * (wading ? 0.6 : 1);
      const amp = this.fleeing ? 0.8 : 0.55;
      for (let i = 0; i < 4; i++) {
        const l = this.legs[i];
        l.rotation.x = Math.sin(this._phase + l._ph) * amp;
      }
      this._graze = Math.max(0, this._graze - dt * 4);
      this._grazeT = 0;
    } else {
      const k = Math.min(1, 8 * dt);
      for (let i = 0; i < 4; i++) this.legs[i].rotation.x -= this.legs[i].rotation.x * k;
      if (!this.frozen) {
        if (this.kind !== 'predator') {
          // head-down grazing bouts
          this._grazeCd -= dt;
          if (this._grazeCd <= 0 && this._grazeT <= 0) {
            this._grazeCd = 6 + Math.random() * 9;
            this._grazeT = 2 + Math.random() * 2;
          }
          if (this._grazeT > 0) { this._grazeT -= dt; this._graze = Math.min(1, this._graze + dt * 3); }
          else this._graze = Math.max(0, this._graze - dt * 3);
        } else {
          this.head.rotation.y = Math.sin(this._t * 0.6) * 0.35; // slow scanning sweep
        }
        this._flickCd -= dt;
        if (this._flickCd <= 0) { this._flickCd = 2.5 + Math.random() * 5; this._flickT = 0.5; }
      }
    }

    if (this.kind !== 'predator') {
      this.head.position.y = this._headY - this._graze * 0.3;
      this.head.rotation.x = this._graze * 0.9;
    }

    // tail / ear flick when idle
    if (this._tail) {
      const rot = this._tail.rotation;
      if (this._flickT > 0) {
        this._flickT -= dt;
        rot[this._tailAxis] = Math.sin(this._t * 24) * 0.4;
      } else {
        rot[this._tailAxis] -= rot[this._tailAxis] * Math.min(1, 10 * dt);
      }
    }

    // predator drops into a prowl when stalking; fleeing herds bound
    let figY = 0;
    if (this.kind === 'predator') {
      this._prowl += ((this.followTarget ? 1 : 0) - this._prowl) * Math.min(1, 3 * dt);
      figY -= 0.06 * this._prowl;
      this.head.rotation.x = 0.18 * this._prowl;
    }
    if (moving && this.fleeing) figY += Math.abs(Math.sin(this._phase * 0.5)) * 0.08;
    this.fig.position.y = figY;

    // breathing
    this.body.scale.y = 1 + Math.sin(this._t * 1.9) * 0.02;

    // smooth turn
    const dyaw = angTo(this._yaw, this._yawTarget);
    const wmax = (this.fleeing ? 14 : 8) * dt;
    this._yaw += Math.abs(dyaw) <= wmax ? dyaw : Math.sign(dyaw) * wmax;
    this.group.rotation.y = this._yaw;

    // blob shadow
    this.shadow.position.y = this._groundY - this.pos.y + 0.03;
    const hgt = Math.max(0, this.pos.y - this._groundY);
    this.shadow.scale.setScalar(this._shR * Math.max(0.5, 1 - hgt * 0.35));
  }

  dispose() {
    unregisterCharacter(this);
    // shared cached geometry/materials — detach only
    this.scene.remove(this.group);
  }
}
