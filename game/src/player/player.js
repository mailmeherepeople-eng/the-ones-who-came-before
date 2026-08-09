// Third-person player: AABB voxel collision, gravity, jump, swim-ish water,
// orbit camera on a collision-aware boom, a visible voxel character, and a
// DDA ray for block targeting. Physics is identical to the first-person
// build — only the camera rig and the character model are TPS-specific.
import * as THREE from '../../vendor/three.module.js';
import { PLAYER, WORLD } from '../constants.js';
import { isSolid, isWater } from '../world/blocks.js';

// camera boom: desired follow distance (wheel/pinch adjusts within MIN..MAX),
// orbit pivot height above the feet, and how far short of a wall hit to stop
const CAM = { DIST: 4.6, MIN: 2.2, MAX: 7.5, PIVOT: 1.5, PAD: 0.3, HIDE_BELOW: 1.15 };

export class Player {
  constructor(world, camera, scene = null) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3(40, 12, 28); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.onGround = false;
    this.frozen = false;

    // ---- third-person rig state ----
    this.camDist = CAM.DIST;      // desired boom length (player-adjustable)
    this._camDistSmooth = CAM.DIST; // actual boom after occlusion + smoothing
    this._snapCam = true;         // teleport/first-frame: no boom lerp sweep
    // character facing (lerped toward motion). NOTE the convention offset:
    // camera yaw 0 looks along -z, but model rotation.y 0 faces +z (its eyes
    // are on local +z) — so "face where the camera faces" is yaw + π.
    this._modelYaw = this.yaw + Math.PI;
    this._animPhase = 0;
    this.model = null;
    this.equipped = null;   // 'basket' | 'bow' | 'rod' | 'spear' | 'waterskin' | null
    this._equipCache = {};  // built item groups, one per kind (session-lived)
    this._equipCur = null;  // currently attached item group
    if (scene) this._buildModel(scene);

    // ---- visual-only FX hooks (assigned by main.js; no-ops when unset) ----
    // Each receives a reused THREE.Vector3 — copy the values, don't retain it.
    this.onFootstep = null; // (pos) => void — cadenced step while walking grounded
    this.onSplash = null;   // (pos) => void — fired once on entering water
    this.onLand = null;     // (pos) => void — fired on landing after a real fall
    this._fxPos = new THREE.Vector3(); // scratch passed to the hooks above
    this._strideAcc = 0;     // distance walked since last footstep
    this._wasInWater = false;
    this._solidTime = 0; // seconds BOTH eye and feet cells have been solid (rescue timer)
    this._camDir = new THREE.Vector3(); // scratch for the camera unclip probe
  }

  // teleport(x, z, yaw, y?) — with no `y` the feet land on the highest column
  // top under the body. Pass an explicit `y` for interiors (the rock shelter,
  // any roofed space): topAt sees the cliff ABOVE the cave, so the surface
  // rule would spawn the player on the clifftop instead of inside.
  teleport(x, z, yaw = this.yaw, y = null) {
    // feet must clear EVERY column the collision box overlaps, not just the
    // centre one — riverbed/terrain lips vary by ±1 block
    const r = PLAYER.RADIUS;
    let top = -1;
    for (const bx of new Set([Math.floor(x - r), Math.floor(x + r)]))
      for (const bz of new Set([Math.floor(z - r), Math.floor(z + r)]))
        top = Math.max(top, this.world.topAt(bx, bz));
    this.pos.set(x, y === null ? top + 1.02 : y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this._modelYaw = yaw + Math.PI; // model-front convention is camera yaw + π
    this._snapCam = true; // no boom sweep across the map on teleport
    this.syncCamera();
  }

  // ---- character model (visual only; physics never reads it) ----
  _buildModel(scene) {
    // pivotTop: translate the geometry down so the mesh origin sits AT the
    // hip/shoulder joint — swing rotation then hinges naturally instead of
    // the limb detaching around its center (same pattern as npc.js geoBox).
    const box = (w, h, d, color, x, y, z, pivotTop = false) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (pivotTop) geo.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      return m;
    };
    const g = new THREE.Group();
    const skin = 0x8a5a3a, wrap = 0xc27b3e, hair = 0x2e2018; // ember wrap: the player pops
    // limbs pivot at the joint: legs hang from the hip (y=0.6), arms from the
    // shoulder (y=1.2); geometry is shifted down so proportions are unchanged
    this._legL = box(0.17, 0.6, 0.2, skin, -0.13, 0.6, 0, true);
    this._legR = box(0.17, 0.6, 0.2, skin, 0.13, 0.6, 0, true);
    this._torso = box(0.52, 0.62, 0.3, wrap, 0, 0.92, 0);
    this._armL = box(0.13, 0.5, 0.17, skin, -0.34, 1.2, 0, true);
    this._armR = box(0.13, 0.5, 0.17, skin, 0.34, 1.2, 0, true);
    const head = box(0.4, 0.38, 0.38, skin, 0, 1.45, 0);
    head.add(box(0.42, 0.12, 0.4, hair, 0, 0.16, -0.01)); // hair cap
    head.add(box(0.06, 0.06, 0.02, 0x1c1410, -0.09, 0.0, 0.2)); // eyes: front = +z
    head.add(box(0.06, 0.06, 0.02, 0x1c1410, 0.09, 0.0, 0.2));
    this._head = head;
    const satchel = box(0.2, 0.24, 0.1, 0x6d5433, -0.3, 0.68, -0.12); // evidence bag
    const belt = box(0.54, 0.08, 0.32, 0x6d5433, 0, 0.66, 0);
    g.add(this._legL, this._legR, this._torso, this._armL, this._armR, head, satchel, belt);
    // blob shadow, same language as the NPCs
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.03;
    g.add(sh);
    g.rotation.y = this._modelYaw;
    scene.add(g);
    this.model = g;
  }

  // walk/idle animation + facing. Reads pos/vel, writes only the model.
  _updateModel(dt) {
    if (!this.model) return;
    const g = this.model;
    g.position.set(this.pos.x, this.pos.y, this.pos.z);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.6) {
      // face where we're going (shortest-arc lerp, matches NPC yaw feel)
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this._modelYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this._modelYaw += d * Math.min(1, 12 * dt);
      this._animPhase += hs * dt * 2.1;
      const sw = Math.sin(this._animPhase) * Math.min(0.62, hs * 0.14);
      this._legL.rotation.x = sw;
      this._legR.rotation.x = -sw;
      this._armL.rotation.x = -sw * 0.75;
      this._armR.rotation.x = sw * 0.75;
      this._torso.rotation.x = 0.06 * Math.min(1, hs / PLAYER.SPEED); // lean in
    } else {
      // settle limbs + gentle breathing
      for (const m of [this._legL, this._legR, this._armL, this._armR]) {
        m.rotation.x *= Math.max(0, 1 - 10 * dt);
      }
      this._torso.rotation.x *= Math.max(0, 1 - 10 * dt);
      this._animPhase += dt * 2;
      this._torso.scale.y = 1 + Math.sin(this._animPhase) * 0.012;
    }
    g.rotation.y = this._modelYaw;
  }

  // ---- equipment (visual only; physics/camera never read it) ----
  // player.equip(kind) with kind ∈ 'basket'|'bow'|'rod'|'spear'|'waterskin'|null.
  // Builds the item once (cached per kind for the session) and parents it to
  // the matching arm group — basket to the LEFT arm, bow/rod/spear to the
  // RIGHT arm, waterskin to the model root at the hip — so held items inherit
  // the walk swing exactly like the elder's staff in npc.js. equip(null)
  // removes the current item. player.equipped exposes the active kind.
  // Items are children of the model, so they hide with it automatically.
  equip(kind) {
    if (this._equipCur) {
      this._equipCur.parent?.remove(this._equipCur);
      this._equipCur = null;
    }
    this.equipped = kind || null;
    if (!this.equipped || !this.model) return;
    let item = this._equipCache[this.equipped];
    if (!item) item = this._equipCache[this.equipped] = this._buildEquipItem(this.equipped);
    const parent = this.equipped === 'basket' ? this._armL
      : this.equipped === 'waterskin' ? this.model
      : this._armR;
    parent.add(item);
    this._equipCur = item;
  }

  // Item groups in arm-local space: the arm origin is the SHOULDER (y=1.2 on
  // the model), the hand sits ~0.45 below it, and +z is the model's front.
  _buildEquipItem(kind) {
    const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      return m;
    };
    const wood = 0x6d5028, woodDark = 0x4c3a1e, tan = 0xc9a866, tanDark = 0xb08f52;
    const g = new THREE.Group();
    if (kind === 'basket') {
      // woven-tan open box carried in front at hip height by the left hand
      g.add(box(0.3, 0.05, 0.24, tan, 0, -0.1, 0)); // base
      g.add(box(0.34, 0.16, 0.03, tan, 0, 0, 0.12));
      g.add(box(0.34, 0.16, 0.03, tan, 0, 0, -0.12));
      g.add(box(0.03, 0.16, 0.24, tanDark, -0.17, 0, 0));
      g.add(box(0.03, 0.16, 0.24, tanDark, 0.17, 0, 0));
      g.add(box(0.38, 0.045, 0.28, tanDark, 0, 0.09, 0)); // rim
      g.position.set(0.16, -0.5, 0.2); // front of the hip, off the left hand
    } else if (kind === 'bow') {
      // curved silhouette: grip + two forward-bent limbs + string, resting
      // diagonally in the right hand
      g.add(box(0.05, 0.34, 0.07, wood, 0, 0, 0));
      const limbT = box(0.045, 0.32, 0.06, wood, 0, 0.28, 0.05);
      limbT.rotation.x = -0.45;
      const limbB = box(0.045, 0.32, 0.06, wood, 0, -0.28, 0.05);
      limbB.rotation.x = 0.45;
      g.add(limbT, limbB);
      g.add(box(0.016, 0.78, 0.016, 0x2a2118, 0, 0, 0.17)); // string
      g.position.set(0.02, -0.45, 0.08);
      g.rotation.set(0.15, 0, 0.45);
    } else if (kind === 'rod') {
      // thin long stick angled forward-up, tiny line drooping from the tip
      g.add(box(0.035, 1.25, 0.035, wood, 0, 0.45, 0));
      const line = box(0.015, 0.2, 0.015, 0x2a2118, 0, 1.0, -0.08);
      line.rotation.x = -1.0; // roughly world-vertical after the group tilt
      g.add(line);
      g.position.set(0.02, -0.45, 0.1);
      g.rotation.x = 1.0;
    } else if (kind === 'spear') {
      // longer shaft with a knapped stone tip, near-upright in the right hand
      g.add(box(0.05, 1.7, 0.05, woodDark, 0, 0.35, 0));
      g.add(box(0.1, 0.22, 0.04, 0x777777, 0, 1.24, 0)); // knapped stone tip
      g.position.set(0.02, -0.45, 0.05);
      g.rotation.set(0.18, 0, -0.08);
    } else if (kind === 'meat') {
      // the haul from the hunt, hoisted on the shoulder: a dark haunch with a
      // pale bone end so it is readable in silhouette from the follow camera
      g.add(box(0.3, 0.24, 0.42, 0x7a3b2c, 0, 0, 0));
      g.add(box(0.2, 0.16, 0.2, 0x8f4a37, 0.04, 0.12, -0.1));
      g.add(box(0.06, 0.26, 0.06, 0xd8cfae, -0.1, 0.14, 0.16)); // bone
      g.position.set(0.06, -0.34, -0.02);
      g.rotation.set(0.2, 0, 0.25);
    } else { // waterskin: plump dark pouch slung at the hip (model-root local)
      const pouch = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x4a3524 }),
      );
      pouch.scale.set(1, 1.25, 0.72);
      g.add(pouch);
      g.add(box(0.05, 0.09, 0.05, wood, 0, 0.18, 0));   // neck plug
      g.add(box(0.09, 0.03, 0.09, 0x2a2118, 0, 0.13, 0)); // tie
      g.position.set(0.3, 0.68, 0.1); // right hip, just above the belt
    }
    return g;
  }

  // Tiny screen-center aim marker for bow aiming (DOM, visual only).
  // setAim(true) shows a 6px semi-transparent ring with a dark outline at the
  // screen center (#aim-dot, pointer-events none); setAim(false) hides it.
  setAim(on) {
    let el = document.getElementById('aim-dot');
    if (on) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'aim-dot';
        el.style.cssText =
          'position:fixed;left:50%;top:50%;width:6px;height:6px;' +
          'margin:-3px 0 0 -3px;border-radius:50%;' +
          'border:2px solid rgba(255,255,255,0.85);' +
          'box-shadow:0 0 0 1px rgba(0,0,0,0.6),inset 0 0 0 1px rgba(0,0,0,0.6);' +
          'background:transparent;pointer-events:none;z-index:40;';
        document.body.appendChild(el);
      }
      el.style.display = 'block';
    } else if (el) {
      el.style.display = 'none';
    }
  }

  // First-person sighting mode for the bow. Collapses the third-person boom so
  // the camera sits at the head, which also hides the character model through
  // the existing CAM.HIDE_BELOW rule in syncCamera, and swaps the small aim dot
  // for a full crosshair. The previous follow distance is restored on exit, so
  // a player who had zoomed the camera keeps their preference.
  setFirstPerson(on) {
    if (on === !!this._fpsOn) return;
    this._fpsOn = on;
    if (on) {
      this._fpsPrevDist = this.camDist;
      this.camDist = 0;          // syncCamera clamps to a 0.5 minimum
      this._snapCam = true;      // no sweep: cut straight to the sights
      this.setAim(false);
      let x = document.getElementById('aim-cross');
      if (!x) {
        x = document.createElement('div');
        x.id = 'aim-cross';
        x.innerHTML = '<span class="gap"></span><span class="dot"></span>';
        document.body.appendChild(x);
      }
      x.style.display = 'block';
    } else {
      this.camDist = this._fpsPrevDist ?? CAM.DIST;
      this._snapCam = true;
      const x = document.getElementById('aim-cross');
      if (x) x.style.display = 'none';
    }
    this.syncCamera();
  }

  // true if the collision box overlaps any solid block
  _embedded() {
    const p = this.pos, r = PLAYER.RADIUS, h = 1.75;
    for (let bx = Math.floor(p.x - r); bx <= Math.floor(p.x + r); bx++)
      for (let by = Math.floor(p.y); by <= Math.floor(p.y + h); by++)
        for (let bz = Math.floor(p.z - r); bz <= Math.floor(p.z + r); bz++)
          if (isSolid(this.world.get(bx, by, bz))) return true;
    return false;
  }

  // Third-person camera rig. Orientation is EXACTLY the old first-person
  // basis (rotateY(-yaw) then rotateX(-pitch), forward = (sin yaw·cos pitch,
  // -sin pitch, -cos yaw·cos pitch)) so the movement math and every caller
  // (interstitial restore, FX aiming) keep working — the camera just sits
  // `boom` units behind the head instead of inside it.
  syncCamera() {
    const px = this.pos.x, py = this.pos.y + CAM.PIVOT, pz = this.pos.z;
    const cp = Math.cos(this.pitch);
    const fx = Math.sin(this.yaw) * cp;
    const fy = -Math.sin(this.pitch);
    const fz = -Math.cos(this.yaw) * cp;

    // boom occlusion: DDA-march from the pivot backward; stop short of the
    // first solid block so walls/cave ceilings never sit between camera and
    // player. (Water and cross-flora are not solid — they don't block.)
    let limit = this.camDist;
    const step = 0.25;
    for (let t = step; t <= this.camDist; t += step) {
      const x = px - fx * t, y = py - fy * t, z = pz - fz * t;
      if (isSolid(this.world.get(Math.floor(x), Math.floor(y), Math.floor(z)))) {
        limit = Math.max(0.5, t - CAM.PAD);
        break;
      }
    }
    // shrink instantly (never clip a wall), relax back out smoothly
    if (this._snapCam || limit < this._camDistSmooth) this._camDistSmooth = limit;
    else this._camDistSmooth += (limit - this._camDistSmooth) * 0.12;
    this._snapCam = false;

    const d = this._camDistSmooth;
    this.camera.position.set(px - fx * d, py - fy * d, pz - fz * d);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(-this.yaw);
    this.camera.rotateX(-this.pitch);
    // collapsed boom = camera inside the body: hide the model so we don't
    // stare at the inside of the character's head
    if (this.model) this.model.visible = d > CAM.HIDE_BELOW;
  }

  update(dt, inp) {
    if (this.frozen) {
      // camera-safety still runs while frozen (cutscene inside the cave must
      // not leave the camera buried); the model keeps breathing
      this.syncCamera();
      this._cameraUnclip();
      this._updateModel(dt);
      return;
    }
    const wasGround = this.onGround; // FX only: landing detection baseline
    // depenetrate: if something solid now overlaps the player (world edits,
    // spawn lips), lift gently instead of letting collision snap-back spiral
    if (this._embedded()) {
      for (let k = 0; k < 20 && this._embedded(); k++) this.pos.y += 0.25;
      this.vel.y = Math.max(0, this.vel.y);
    }
    // rescue, NOT physics: if the depenetration above could not free us (deep
    // overhang/cliff interior — its 5-block lift ran out inside rock) and BOTH
    // the eye and feet cells stay solid for >0.6s continuously, lift straight
    // up to the first open 2-cell column at this x/z. Normal play never has
    // both cells solid, so this cannot fire outside a genuine wedge.
    const cellSolid = (dy) => isSolid(this.world.get(
      Math.floor(this.pos.x), Math.floor(this.pos.y + dy), Math.floor(this.pos.z)));
    if (cellSolid(0.05) && cellSolid(PLAYER.EYE_HEIGHT)) {
      this._solidTime += dt;
      if (this._solidTime > 0.6) {
        this._solidTime = 0;
        const bx = Math.floor(this.pos.x), bz = Math.floor(this.pos.z);
        let by = Math.floor(this.pos.y) + 1;
        while (by < WORLD.SIZE_Y &&
          (isSolid(this.world.get(bx, by, bz)) || isSolid(this.world.get(bx, by + 1, bz)))) by++;
        this.pos.y = by + 0.02;
        this.vel.set(0, 0, 0);
      }
    } else {
      this._solidTime = 0;
    }
    this.yaw += inp.look.x;
    this.pitch = Math.max(-1.2, Math.min(1.35, this.pitch + inp.look.y));

    // Camera lock (Settings): swing the camera around to sit behind the
    // direction of travel, so crossing the valley needs no dragging at all.
    //
    // This cannot oscillate even though movement is camera-relative: walking
    // forward already points the camera along the velocity, so W is a fixed
    // point and nothing moves. Only strafing and back-pedalling pull the yaw
    // round, which is exactly the wanted behaviour. Any active look input wins
    // outright, so dragging still works whenever the player wants it.
    if (this.lockCamera && !inp.look.x) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.6) {
        // yaw convention: forward = (sin yaw, -cos yaw)
        let d = Math.atan2(this.vel.x, -this.vel.z) - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, 2.6 * dt);
      }
    }
    // wheel/pinch adjusts the follow distance (was unused in the FP build —
    // the sky transition uses the HUD button, not the wheel)
    // ignored while sighting the bow: a stray wheel or pinch must not pull the
    // camera back out of first person mid-shot
    if (inp.zoom && !this._fpsOn) this.camDist = Math.max(CAM.MIN, Math.min(CAM.MAX, this.camDist + inp.zoom * 0.6));

    // camera forward: syncCamera applies rotateY(-yaw) to (0,0,-1), giving
    // (sin yaw, 0, -cos yaw). Movement MUST use the same basis so W is always
    // "where the camera looks", whatever way the player has turned.
    const fwd = { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: -fwd.z, z: fwd.x };

    const inWater = isWater(this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z)));
    const speed = PLAYER.SPEED * (inWater ? 0.55 : 1);
    const targetVx = (fwd.x * inp.move.y + right.x * inp.move.x) * speed;
    const targetVz = (fwd.z * inp.move.y + right.z * inp.move.x) * speed;
    const accel = this.onGround || inWater ? 14 : 5;
    this.vel.x += (targetVx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVz - this.vel.z) * Math.min(1, accel * dt);

    if (inWater) {
      // a jump PRESS breaches with full force (≤2-block banks are climbable);
      // the buoyancy cap must never claw back an active jump impulse
      if (inp.jump) {
        this.vel.y = PLAYER.JUMP * 0.95;
        this.onGround = false;
      } else if (inp.jumpHeld) {
        if (this.vel.y < 3.6) this.vel.y = Math.min(3.6, this.vel.y + 16 * dt);
      } else {
        this.vel.y += (-2.5 - this.vel.y) * Math.min(1, 3 * dt);
        if (this.vel.y < -3) this.vel.y = -3;
      }
    } else {
      this.vel.y -= PLAYER.GRAVITY * dt;
      if (inp.jump && this.onGround) { this.vel.y = PLAYER.JUMP; this.onGround = false; }
    }

    const fallSpeed = -this.vel.y; // FX only: read before collision zeroes it
    this.moveAxis(0, this.vel.x * dt);
    this.moveAxis(2, this.vel.z * dt);
    this.onGround = false;
    // substep vertical motion ≤0.9 blocks so lag spikes cannot tunnel terrain
    let dy = this.vel.y * dt;
    while (Math.abs(dy) > 0.9) {
      this.moveAxis(1, Math.sign(dy) * 0.9);
      dy -= Math.sign(dy) * 0.9;
      if (this.vel.y === 0) { dy = 0; break; } // collided
    }
    this.moveAxis(1, dy);

    // world floor safety
    if (this.pos.y < -4) this.teleport(this.pos.x, this.pos.z);

    // ---- visual feedback only from here down: reads state, never writes
    // pos/vel/onGround. ----
    this._fxDetect(dt, wasGround, fallSpeed, inWater);
    this.syncCamera();      // TPS boom (occlusion DDA replaces bob/ceiling clamp)
    this._cameraUnclip();   // probe fallback for any corner the DDA missed
    this._updateModel(dt);
  }

  // Soft body collision against NPCs and animals: people and animals are
  // obstacles, not fog. Called by main.js right after update() with the live
  // character list; the character side of the same rule lives in npc.js
  // (tryMove rejects steps that push INTO the player).
  //
  // The push goes through moveAxis, so being crowded can never shove the
  // player through a wall — and the velocity component heading into the body
  // is cancelled so holding W against someone reads as a firm stop, not a
  // jitter. Characters more than ~2 blocks above/below are ignored (roofs,
  // the rock shelter's cliff top).
  resolveCharacters(list) {
    if (!list?.length || this.frozen) return;
    const r = PLAYER.RADIUS;
    for (const c of list) {
      if (!c?.pos || c._r === undefined) continue;
      const reach = c._r + r;
      let dx = this.pos.x - c.pos.x, dz = this.pos.z - c.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= reach * reach) continue;
      if (Math.abs(c.pos.y - this.pos.y) > 2.0) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) { dx = 1; dz = 0; d = 0; } else { dx /= d; dz /= d; }
      const push = reach - d;
      this.moveAxis(0, dx * push);
      this.moveAxis(2, dz * push);
      const into = -(this.vel.x * dx + this.vel.z * dz); // speed toward the body
      if (into > 0) { this.vel.x += dx * into; this.vel.z += dz * into; }
    }
  }

  // Rendering-side remedy, camera-only — NEVER moves player.pos. If the boom
  // DDA missed a corner and the camera ended up inside an opaque solid block,
  // pull it FORWARD along the view axis (toward the player pivot — in third
  // person, forward is the way out of the wall) until it reaches open air,
  // ultimately collapsing to the player's own head space which is always free.
  _cameraUnclip() {
    const c = this.camera.position;
    const solid = (x, y, z) => isSolid(this.world.get(Math.floor(x), Math.floor(y), Math.floor(z)));
    if (!solid(c.x, c.y, c.z)) return;
    this.camera.getWorldDirection(this._camDir);
    const d = this._camDir;
    for (let fwd = 0.2; fwd <= CAM.MAX; fwd += 0.2) {
      const x = c.x + d.x * fwd, y = c.y + d.y * fwd, z = c.z + d.z * fwd;
      if (!solid(x, y, z)) {
        c.set(x, y, z);
        this._camDistSmooth = Math.max(0.5, this._camDistSmooth - fwd);
        return;
      }
    }
    // absolute fallback: sit at the pivot (head space is never solid)
    c.set(this.pos.x, this.pos.y + CAM.PIVOT, this.pos.z);
    this._camDistSmooth = 0.5;
  }

  // Footstep / splash / landing detection. Pure observation; calls the
  // optional onFootstep/onSplash/onLand hooks with a reused scratch vector.
  _fxDetect(dt, wasGround, fallSpeed, inWater) {
    // splash: fired once when the body enters water
    if (inWater && !this._wasInWater && this.onSplash) {
      this._fxPos.set(this.pos.x, this.pos.y + 0.6, this.pos.z);
      this.onSplash(this._fxPos);
    }
    this._wasInWater = inWater;

    // landing: touched down this frame after falling fast enough to notice
    if (this.onGround && !wasGround && !inWater && fallSpeed > 7 && this.onLand) {
      this._fxPos.set(this.pos.x, this.pos.y + 0.05, this.pos.z);
      this.onLand(this._fxPos);
    }

    // footsteps: cadence by distance walked, so sprint-vs-stroll feels right
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && !inWater && hs > 1.2) {
      this._strideAcc += hs * dt;
      if (this._strideAcc >= 2.3) { // ~one puff per stride pair
        this._strideAcc = 0;
        if (this.onFootstep) {
          this._fxPos.set(this.pos.x, this.pos.y + 0.05, this.pos.z);
          this.onFootstep(this._fxPos);
        }
      }
    } else {
      this._strideAcc = 0;
    }
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const p = this.pos;
    const r = PLAYER.RADIUS, h = 1.75;
    const comp = ['x', 'y', 'z'][axis];
    p[comp] += amount;

    const minX = Math.floor(p.x - r), maxX = Math.floor(p.x + r);
    const minY = Math.floor(p.y), maxY = Math.floor(p.y + h);
    const minZ = Math.floor(p.z - r), maxZ = Math.floor(p.z + r);

    for (let bx = minX; bx <= maxX; bx++)
      for (let by = minY; by <= maxY; by++)
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (!isSolid(this.world.get(bx, by, bz))) continue;
          // resolve along the moved axis only
          if (axis === 0) {
            p.x = amount > 0 ? bx - r - 0.001 : bx + 1 + r + 0.001;
            this.vel.x = 0;
          } else if (axis === 2) {
            p.z = amount > 0 ? bz - r - 0.001 : bz + 1 + r + 0.001;
            this.vel.z = 0;
          } else {
            if (amount > 0) { p.y = by - h - 0.001; }
            else { p.y = by + 1 + 0.001; this.onGround = true; }
            this.vel.y = 0;
          }
          return this.moveAxis(axis, 0); // done — collision resolved
        }
  }

  // DDA raycast into the voxel grid. Returns {x,y,z, face} or null.
  rayBlock(maxDist = PLAYER.REACH) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const o = this.camera.position.clone();
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = Math.sign(dir.x) || 1, stepY = Math.sign(dir.y) || 1, stepZ = Math.sign(dir.z) || 1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
    let tMaxX = tDeltaX * (stepX > 0 ? (x + 1 - o.x) : (o.x - x));
    let tMaxY = tDeltaY * (stepY > 0 ? (y + 1 - o.y) : (o.y - y));
    let tMaxZ = tDeltaZ * (stepZ > 0 ? (z + 1 - o.z) : (o.z - z));
    let face = null;
    let t = 0;
    while (t < maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      const id = this.world.get(x, y, z);
      if (id !== 0 && isSolid(id)) return { x, y, z, face, dist: t, id };
    }
    return null;
  }

  distTo(site) {
    return Math.hypot(this.pos.x - site.x, this.pos.z - site.z);
  }
}
