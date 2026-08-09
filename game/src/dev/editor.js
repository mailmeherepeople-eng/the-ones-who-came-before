// ---------------------------------------------------------------------------
// WORLD EDITOR — a general three.js scene editor, dev-only, loaded on demand.
//
// It knows nothing about this game: everything it touches comes through a HOST
// adapter (see dev/host.js). To reuse it in another three.js project, write a
// host and call initEditor(host). Every host capability is optional; features
// whose capability is missing simply do not appear.
//
//   host = {
//     scene, camera, renderer, dom, THREE,
//     label(),                                  // name of the current scene
//     frame: { add(fn), setScale(n), setPaused(b) },
//     cameraControl: { take(), release(), held },
//     input: { setEnabled(bool) },              // host's own input, muted while editing
//     voxel: { SX,SY,SZ, ids, defs, name(id), get, set, topAt, remesh, materials() },
//     props(), addProp, removeProp, propKinds(), spawnProp(kind,x,y,z), addImported(g,x,y,z),
//     characters(), characterKinds(), spawnCharacter(kind,x,z), removeCharacter(c),
//     sites(), ambient(),
//     player: { obj, pos, teleport, model(), tune, world },
//   }
//
// The editor makes LIVE edits, but the source files stay the source of truth:
// every change is written to a change list that exports as a precise, numbered
// request (name, old value, new value, owning file) to hand back for a real
// source edit. The list survives reloads and can be re-applied.
// ---------------------------------------------------------------------------
import * as THREE from '../../vendor/three.module.js';
import { importFile, cellsToGroup, parseBlockJson } from './voxel-import.js';
import { TILE, grainTile } from '../world/atlas.js';

const LOG_KEY = 'towcb-edit-log';
const n2 = (v) => Math.round(v * 100) / 100;
const xyz = (p) => `(${n2(p.x)}, ${n2(p.y)}, ${n2(p.z)})`;
const xz = (p) => `(${n2(p.x)}, ${n2(p.z)})`;
const hex = (c) => '#' + c.getHexString();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let EDITOR = null;
export function initEditor(host) {
  if (EDITOR) { EDITOR.toggle(true); return EDITOR; }
  EDITOR = new Editor(host);
  window.__editor = EDITOR;
  return EDITOR;
}

class Editor {
  constructor(host) {
    this.host = host;
    this.sel = null;
    this.changes = load();
    this.step = 0.5;
    this.tab = 'scene';
    this.paintBlock = host.voxel ? host.voxel.ids.WOOD ?? 1 : 1;
    this.brush = { radius: 0, shape: 'cube', mode: 'paint' };
    this.pickMode = null;      // { prompt, cb } — next world click feeds cb
    this.fly = { on: false, keys: new Set(), yaw: 0, pitch: 0, speed: 9 };
    this.stats = { fps: 0, t: 0, n: 0 };
    this.filter = '';

    this._style();
    this._panel();
    this._helpers();
    this._keys();
    this._mouse();
    this._drop();
    host.frame.add((dt) => this._tick(dt));
    this.setFly(true);         // the editor always opens in flight
    this.refresh();
    this.status(`editor ready · ${this.changes.length} change(s) carried over`);
  }

  // ------------------------------------------------------------------ chrome --
  _style() {
    const el = document.createElement('style');
    el.textContent = `
#wed{position:fixed;top:0;right:0;width:396px;height:100%;z-index:9000;background:#14120f;color:#e9e0cc;
 font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;border-left:1px solid #3a3226;display:flex;flex-direction:column;
 box-shadow:-8px 0 24px rgba(0,0,0,.5)}
#wed.hidden{display:none}
#wed .bar{display:flex;gap:4px;padding:5px 6px;border-bottom:1px solid #2a251c;flex-wrap:wrap;align-items:center}
#wed .sp{flex:1}
#wed button{background:#2a2419;color:#e9e0cc;border:1px solid #4a4030;border-radius:4px;padding:3px 7px;cursor:pointer;font:inherit}
#wed button:hover{background:#3a3223}
#wed button.on{background:#7a5a20;border-color:#c08a30;color:#fff}
#wed .tabs{display:flex;border-bottom:1px solid #2a251c}
#wed .tabs button{flex:1;border:0;border-radius:0;border-right:1px solid #2a251c;padding:6px 0;font-size:11px}
#wed .tabs button.on{background:#3a2f18;color:#ffd58a;box-shadow:inset 0 -2px 0 #c08a30}
#wed .body{flex:1;overflow:auto;padding:8px}
#wed h4{margin:12px 0 4px;color:#c9a86a;font-size:11px;letter-spacing:.5px;text-transform:uppercase}
#wed h4:first-child{margin-top:0}
#wed .row{display:flex;align-items:center;gap:6px;margin:2px 0}
#wed .row label{width:88px;color:#a89a7c;flex:none}
#wed input[type=number],#wed input[type=text],#wed select{background:#0d0b09;color:#e9e0cc;border:1px solid #3d3527;
 border-radius:3px;padding:2px 4px;width:100%;min-width:0;font:inherit}
#wed input[type=range]{width:100%}
#wed input[type=color]{background:#0d0b09;border:1px solid #3d3527;height:22px;width:48px;padding:0}
#wed .item{display:flex;gap:6px;align-items:center;padding:3px 5px;border-radius:3px;cursor:pointer}
#wed .item:hover{background:#241f16}
#wed .item.on{background:#3a2f18;color:#ffd58a}
#wed .item .dim{color:#7d7360;margin-left:auto;font-size:11px}
#wed .muted{color:#7d7360}
#wed .warn{color:#e0a35c}
#wed textarea{width:100%;height:170px;background:#0d0b09;color:#d9cfb4;border:1px solid #3d3527;border-radius:4px;padding:6px}
#wed .chg{padding:3px 5px;border-bottom:1px solid #221d15;display:flex;gap:6px}
#wed .chg b{color:#ffd58a;font-weight:normal}
#wed .chg .x{margin-left:auto;color:#a06050;cursor:pointer}
#wed .foot{border-top:1px solid #2a251c;padding:5px 8px;color:#7d7360;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wed .drop{border:1px dashed #5a4c34;border-radius:6px;padding:12px;text-align:center;color:#a89a7c;margin:6px 0}
#wed .drop.over{background:#2a2113;border-color:#c08a30;color:#ffd58a}
#wed .chips{display:flex;flex-wrap:wrap;gap:4px}
#wed .chips button{font-size:11px;padding:2px 6px}
#wed-toggle{position:fixed;right:8px;bottom:8px;z-index:9001;background:#2a2419;color:#ffd58a;border:1px solid #6a5530;
 border-radius:6px;padding:5px 9px;cursor:pointer;font:12px ui-monospace,Menlo,Consolas,monospace}
#wed-pick{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9002;background:#7a5a20;color:#fff;
 border:1px solid #c08a30;border-radius:6px;padding:6px 12px;font:12px ui-monospace,Menlo,Consolas,monospace}`;
    document.head.appendChild(el);
  }

  _panel() {
    const p = this.el = document.createElement('div');
    p.id = 'wed';
    p.innerHTML = `
      <div class="bar">
        <b style="color:#ffd58a">WORLD EDITOR</b><span class="sp"></span>
        <button data-a="fly" title="Fly (always on by default). Off = drive the player">fly</button>
        <button data-a="pause" title="Freeze the simulation">pause</button>
        <button data-a="shot" title="Save a PNG of the viewport">📷</button>
        <button data-a="close" title="F2">×</button>
      </div>
      <div class="bar">
        <label class="muted">step</label>
        <select data-a="step" style="width:58px"><option>0.1</option><option selected>0.5</option><option>1</option><option>2</option><option>5</option></select>
        <label class="muted">speed</label>
        <select data-a="speed" style="width:58px"><option>0</option><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option><option>4</option><option>8</option></select>
        <button data-a="xray" title="See through terrain">xray</button>
        <button data-a="wire" title="Wireframe">wire</button>
        <button data-a="plan" title="Top-down layout view">plan</button>
      </div>
      <div class="tabs">
        <button data-t="scene" class="on">Scene</button>
        <button data-t="inspect">Inspect</button>
        <button data-t="terrain">Terrain</button>
        <button data-t="create">Create</button>
        <button data-t="world">World</button>
        <button data-t="changes">Changes</button>
      </div>
      <div class="body" data-f="body"></div>
      <div class="foot" data-f="status">ready</div>`;
    document.body.appendChild(p);
    this.bodyEl = p.querySelector('[data-f=body]');
    this.statusEl = p.querySelector('[data-f=status]');

    const t = this.toggleBtn = document.createElement('button');
    t.id = 'wed-toggle';
    t.textContent = '⚙ editor (F2)';
    t.onclick = () => this.toggle();
    t.style.display = 'none';
    document.body.appendChild(t);

    p.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      if (b.dataset.t) { this.tab = b.dataset.t; this.refresh(); }
      else if (a === 'close') this.toggle(false);
      else if (a === 'fly') this.setFly(!this.fly.on);
      else if (a === 'pause') this.setPaused(!this.paused);
      else if (a === 'shot') this.screenshot();
      else if (a === 'xray') this.setXray(!this.xray);
      else if (a === 'wire') this.setWire(!this.wire);
      else if (a === 'plan') this.planView();
    });
    p.addEventListener('change', (e) => {
      if (e.target.dataset.a === 'step') this.step = Number(e.target.value);
      if (e.target.dataset.a === 'speed') { this.host.frame.setScale(Number(e.target.value)); }
    });
    this.host.input?.setEnabled(false);
    document.exitPointerLock?.();
  }

  _helpers() {
    const cube = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const mat = (c, o) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: o });
    this.marker = new THREE.LineSegments(cube, mat(0xffd166, 1));
    this.hoverMarker = new THREE.LineSegments(cube, mat(0x8ad0ff, 0.75));
    this.boxHelper = new THREE.BoxHelper(this.marker, 0xffd166);
    this.hoverHelper = new THREE.BoxHelper(this.marker, 0x8ad0ff);
    this.hoverHelper.material.opacity = 0.75;
    this.grid = new THREE.GridHelper(64, 64, 0x6a5530, 0x3a3226);
    this.grid.material.transparent = true; this.grid.material.opacity = 0.3;
    for (const h of [this.marker, this.hoverMarker, this.boxHelper, this.hoverHelper, this.grid]) {
      h.material.depthTest = false; h.material.transparent = true;
      h.renderOrder = 999; h.visible = false;
      this.host.scene.add(h);
    }
  }

  toggle(on = this.el.classList.contains('hidden')) {
    this.el.classList.toggle('hidden', !on);
    this.toggleBtn.style.display = on ? 'none' : '';
    if (on) { this.host.input?.setEnabled(false); this.setFly(true); this.refresh(); }
    else {
      this.host.input?.setEnabled(true);
      this.setFly(false);
      this.hoverObj = this.hoverBlock = this._hoverName = null;
      this.host.dom.style.cursor = '';
    }
  }

  status(s) { this.statusEl.textContent = s; }

  // ------------------------------------------------------------------- frame --
  _tick(dt) {
    if (this.fly.on) this._flyTick(dt);
    if (this.el.classList.contains('hidden')) {
      for (const h of [this.marker, this.hoverMarker, this.boxHelper, this.hoverHelper, this.grid]) h.visible = false;
      return;
    }
    // outlines
    if (this.sel?.object3d) { this.boxHelper.setFromObject(this.sel.object3d); this.boxHelper.visible = true; }
    else this.boxHelper.visible = false;
    const ho = this.hoverObj && this.hoverObj !== this.sel?.object3d ? this.hoverObj : null;
    if (ho) { this.hoverHelper.setFromObject(ho); this.hoverHelper.visible = true; }
    else this.hoverHelper.visible = false;
    const hb = this.hoverBlock;
    const sm = this.sel?.marker;
    if (hb && !(sm && sm.x === hb.x && sm.y === hb.y && sm.z === hb.z)) {
      this.hoverMarker.position.set(hb.x + 0.5, hb.y + 0.5, hb.z + 0.5);
      this.hoverMarker.visible = true;
    } else this.hoverMarker.visible = false;

    // fps + a live readout in the status bar when nothing else is talking
    const s = this.stats;
    s.t += dt; s.n++;
    if (s.t >= 0.5) { s.fps = Math.round(s.n / s.t); s.t = 0; s.n = 0; }
    if (this._pendingShot) { this._pendingShot(); this._pendingShot = null; }
  }

  // ------------------------------------------------------------------ flight --
  setFly(on) {
    const cam = this.host.camera;
    if (on && !this.fly.on) {
      this.fly.on = true;
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      this.fly.yaw = e.y; this.fly.pitch = e.x;
      this.host.cameraControl?.take();
      this.status('flight: WASD move · E up · Q down · Shift fast · drag to look');
    } else if (!on && this.fly.on) {
      this.fly.on = false;
      this.fly.keys.clear();
      this.host.cameraControl?.release();
      this.status('walking the player again');
    }
    this.el.querySelector('[data-a=fly]')?.classList.toggle('on', this.fly.on);
  }

  _flyTick(dt) {
    const f = this.fly, cam = this.host.camera;
    f.pitch = clamp(f.pitch, -1.5, 1.5);
    cam.rotation.set(0, 0, 0);
    cam.rotateY(f.yaw); cam.rotateX(f.pitch);
    const boost = f.keys.has('ShiftLeft') || f.keys.has('ShiftRight') ? 3.2
      : f.keys.has('ControlLeft') ? 0.25 : 1;
    const sp = f.speed * boost * dt;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (f.keys.has('KeyW')) cam.position.addScaledVector(fwd, sp);
    if (f.keys.has('KeyS')) cam.position.addScaledVector(fwd, -sp);
    if (f.keys.has('KeyD')) cam.position.addScaledVector(right, sp);
    if (f.keys.has('KeyA')) cam.position.addScaledVector(right, -sp);
    if (f.keys.has('KeyE')) cam.position.y += sp;
    if (f.keys.has('KeyQ')) cam.position.y -= sp;
  }

  planView() {
    const v = this.host.voxel;
    const cx = v ? v.SX / 2 : 0, cz = v ? v.SZ / 2 : 0;
    this.setFly(true);
    this.host.camera.position.set(cx, (v ? v.SY : 20) + 90, cz + 0.01);
    this.fly.yaw = 0; this.fly.pitch = -Math.PI / 2 + 0.001;
    this.grid.position.set(cx, 0.05, cz);
    this.grid.visible = true;
    this.status('plan view — xray + slice make the layout readable from here');
  }

  setPaused(p) {
    this.paused = p;
    this.host.frame.setPaused(p);
    this.el.querySelector('[data-a=pause]')?.classList.toggle('on', !!p);
  }

  setXray(on) {
    this.xray = on;
    for (const m of this.host.voxel?.materials() ?? []) {
      m.transparent = on || m.userData._wasTransparent || false;
      m.opacity = on ? 0.35 : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
    this.el.querySelector('[data-a=xray]')?.classList.toggle('on', !!on);
  }

  setWire(on) {
    this.wire = on;
    for (const m of this.host.voxel?.materials() ?? []) { m.wireframe = on; m.needsUpdate = true; }
    this.el.querySelector('[data-a=wire]')?.classList.toggle('on', !!on);
  }

  setSlice(y) {
    this.sliceY = y;
    const r = this.host.renderer;
    r.clippingPlanes = y >= (this.host.voxel?.SY ?? 24) ? []
      : [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)];
  }

  screenshot() {
    // must read the buffer in the same task as a render — do it at frame end
    this._pendingShot = () => {
      const url = this.host.dom.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `world-${this.host.label()}.png`;
      a.click();
      this.status('screenshot saved');
    };
  }

  // ------------------------------------------------------------------- input --
  _keys() {
    addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.code === 'F2' && !typing) { e.preventDefault(); this.toggle(); return; }
      if (this.el.classList.contains('hidden')) return;
      if (this.fly.on && !typing) this.fly.keys.add(e.code);
      if (typing) return;
      if (e.code === 'Escape') {
        if (this.pickMode) { this.endPick(); return; }
        this.select(null); this.refresh(); return;
      }
      const mul = e.shiftKey ? 5 : e.altKey ? 0.2 : 1;
      const s = this.step * mul;
      const nudge = { ArrowRight: [s, 0, 0], ArrowLeft: [-s, 0, 0], PageUp: [0, s, 0], PageDown: [0, -s, 0], ArrowUp: [0, 0, -s], ArrowDown: [0, 0, s] };
      if (nudge[e.code] && this.sel?.pos) { e.preventDefault(); this.move(...nudge[e.code]); return; }
      if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
      if (e.code === 'KeyR' && this.sel?.object3d) this.rotate(Math.PI / 8);
      if (e.code === 'KeyG') this.dragging = true; // hold G: drag the selection on the ground
    });
    addEventListener('keyup', (e) => {
      this.fly.keys.delete(e.code);
      if (e.code === 'KeyG') this.dragging = false;
    });
    addEventListener('blur', () => this.fly.keys.clear());
  }

  _mouse() {
    const dom = this.host.dom;
    const open = () => !this.el.classList.contains('hidden');
    const SLOP = 5;
    let drag = null;

    dom.addEventListener('contextmenu', (e) => { if (open()) e.preventDefault(); });
    dom.addEventListener('mousedown', (e) => {
      if (!open()) return;
      if (e.altKey) {
        e.preventDefault();
        const hit = this._probe(e.clientX, e.clientY);
        if (hit?.kind === 'block') e.button === 2 ? this.removeBlockAt(hit.ref) : this.placeBlockAt(hit.ref);
        return;
      }
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    addEventListener('mouseup', (e) => {
      if (!drag) return;
      const click = drag.moved <= SLOP;
      drag = null;
      if (click && open()) this.clickAt(e.clientX, e.clientY);
    });
    addEventListener('mousemove', (e) => {
      if (drag) {
        drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (drag.moved <= SLOP) return;
        if (this.dragging && this.sel?.pos) this._dragSelection(e);
        else if (this.fly.on) { this.fly.yaw -= e.movementX * 0.003; this.fly.pitch -= e.movementY * 0.003; }
        else if (this.host.player?.obj) {
          const pl = this.host.player.obj;
          pl.yaw += e.movementX * 0.003;
          pl.pitch = clamp(pl.pitch + e.movementY * 0.003, -1.2, 1.35);
        }
        return;
      }
      if (open() && !this.el.contains(e.target)) this._hoverAt(e.clientX, e.clientY);
    });
    addEventListener('wheel', (e) => {
      if (!open() || e.target !== dom) return;
      if (this.fly.on) this.fly.speed = clamp(this.fly.speed * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 120);
      else if (this.host.player?.obj) {
        const pl = this.host.player.obj;
        pl.camDist = clamp(pl.camDist + (e.deltaY > 0 ? 0.6 : -0.6), 2.2, 7.5);
      }
    }, { passive: true });
  }

  // hold G and move the mouse: slide the selection across the ground plane
  _dragSelection(e) {
    const hit = this._probe(e.clientX, e.clientY, true);
    if (!hit || hit.kind !== 'block') return;
    const p = this.sel.pos();
    this.setAbs(hit.ref.x + 0.5, p.y, hit.ref.z + 0.5);
  }

  _drop() {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    this.el.addEventListener('dragover', (e) => { stop(e); this.el.querySelector('.drop')?.classList.add('over'); });
    this.el.addEventListener('dragleave', (e) => { stop(e); this.el.querySelector('.drop')?.classList.remove('over'); });
    this.el.addEventListener('drop', async (e) => {
      stop(e);
      for (const f of e.dataTransfer.files) await this.importOne(f);
    });
  }

  // ------------------------------------------------------------------ picking --
  _rayFrom(cx, cy) {
    const r = this.host.dom.getBoundingClientRect();
    const nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(nd, this.host.camera);
    return ray;
  }

  _pickRoots() {
    const roots = [];
    for (const p of this.host.props?.() ?? []) if (p.group?.visible) roots.push({ root: p.group, ref: p, kind: 'prop' });
    for (const c of this.host.characters?.() ?? []) if (c.group) roots.push({ root: c.group, ref: c, kind: 'npc' });
    return roots;
  }

  // blocksOnly skips objects — used by the ground-drag so you can slide a prop
  // under another one
  _probe(cx, cy, blocksOnly = false) {
    const ray = this._rayFrom(cx, cy);
    if (!blocksOnly) {
      const roots = this._pickRoots();
      const hits = ray.intersectObjects(roots.map((r) => r.root), true);
      if (hits.length) {
        const objs = roots.map((r) => r.root);
        const found = roots.find((r) => r.root === rootOf(hits[0].object, objs));
        if (found) return { ...found, dist: hits[0].distance };
      }
    }
    const blk = this.rayBlock(ray);
    return blk ? { kind: 'block', ref: blk } : null;
  }

  // march the voxel grid; returns { x,y,z,id, face:{x,y,z} } — face is the last
  // EMPTY cell before the hit, i.e. where a new block goes
  rayBlock(ray, max = 140) {
    const v = this.host.voxel;
    if (!v) return null;
    const o = ray.ray.origin, d = ray.ray.direction;
    let last = null;
    for (let t = 0; t < max; t += 0.15) {
      const x = Math.floor(o.x + d.x * t), y = Math.floor(o.y + d.y * t), z = Math.floor(o.z + d.z * t);
      if (y < 0 || y >= v.SY) { if (y < 0) return null; last = { x, y, z }; continue; }
      const id = v.get(x, y, z);
      if (id !== 0) return { x, y, z, id, face: last };
      last = { x, y, z };
    }
    return null;
  }

  // world point a hit stands for: the cell ON TOP of a block, or the object's
  // own position. Everything that says "click where it goes" runs through this.
  _pointOf(hit) {
    if (hit.kind === 'block') return { x: hit.ref.x + 0.5, y: hit.ref.y + 1, z: hit.ref.z + 0.5 };
    if (hit.kind === 'prop') return { ...hit.ref.group.position };
    return { x: hit.ref.pos.x, y: hit.ref.pos.y, z: hit.ref.pos.z };
  }

  _labelFor(hit) {
    if (hit.kind === 'prop') return hit.ref.group.name || 'prop';
    if (hit.kind === 'npc') return hit.ref.name || hit.ref.kind;
    return `${this.host.voxel.name(hit.ref.id)} ${hit.ref.x},${hit.ref.y},${hit.ref.z}`;
  }

  _hoverAt(cx, cy) {
    const now = performance.now();
    if (now - (this._hoverT || 0) < 60) return;
    this._hoverT = now;
    const hit = this._probe(cx, cy);
    if (!hit) {
      this.hoverObj = this.hoverBlock = null;
      this.host.dom.style.cursor = '';
      return;
    }
    this.host.dom.style.cursor = 'pointer';
    this.hoverObj = hit.kind === 'block' ? null : hit.root;
    this.hoverBlock = hit.kind === 'block' ? hit.ref : null;
    const name = this._labelFor(hit);
    if (name !== this._hoverName) {
      this._hoverName = name;
      const extra = this.pickMode ? this.pickMode.prompt : `${this.stats.fps}fps · click to select`;
      this.status(`${extra}: ${name}`);
    }
  }

  clickAt(cx, cy) {
    const hit = this._probe(cx, cy);
    if (!hit) { this.status('nothing there'); return; }
    if (this.pickMode) {
      const cb = this.pickMode.cb;
      this.endPick();
      cb(hit);
      return;
    }
    if (hit.kind === 'block' && this.tab === 'terrain') { this.brushAt(hit.ref); return; }
    this.select(this._selFor(hit));
    this.tab = 'inspect';
    this.refresh();
    this.status(`selected ${this.sel.label}`);
  }

  _selFor(hit) {
    if (hit.kind === 'prop') return propSel(this, hit.ref);
    if (hit.kind === 'npc') return charSel(this, hit.ref);
    return blockSel(this, hit.ref);
  }

  // modal pick: "click a point / a character in the world"
  beginPick(prompt, cb) {
    this.endPick();
    this.pickMode = { prompt, cb };
    const b = document.createElement('div');
    b.id = 'wed-pick';
    b.textContent = `${prompt} — Esc to cancel`;
    document.body.appendChild(b);
    this.status(prompt);
  }
  endPick() {
    this.pickMode = null;
    document.getElementById('wed-pick')?.remove();
  }

  // ---------------------------------------------------------------- selection --
  select(sel) {
    this.sel = sel;
    if (sel?.marker) {
      this.marker.position.set(sel.marker.x + 0.5, sel.marker.y + 0.5, sel.marker.z + 0.5);
      this.marker.visible = true;
    } else this.marker.visible = false;
  }

  move(dx, dy, dz) {
    const s = this.sel;
    if (!s?.pos) return;
    const b = { ...s.pos() };
    s.setPos(b.x + dx, b.y + dy, b.z + dz);
    this.record({ kind: 'move', what: s.kind, name: s.label, from: b, to: { ...s.pos() }, file: s.file });
    if (s.marker) this.select(s);
    if (this.tab === 'inspect') this.refresh();
  }

  setAbs(x, y, z) {
    const s = this.sel;
    const b = { ...s.pos() };
    s.setPos(x, y, z);
    this.record({ kind: 'move', what: s.kind, name: s.label, from: b, to: { ...s.pos() }, file: s.file });
    if (s.marker) this.select(s);
  }

  rotate(d) {
    const o = this.sel.object3d;
    if (!o) return;
    const b = n2(o.rotation.y);
    o.rotation.y += d;
    this.record({ kind: 'set', what: this.sel.kind, name: this.sel.label, prop: 'rotY', from: b, to: n2(o.rotation.y), file: this.sel.file });
  }

  deleteSelected() {
    const s = this.sel;
    if (!s) return;
    if (s.kind === 'prop') {
      this.record({ kind: 'remove', what: 'prop', name: s.label, at: { ...s.pos() }, file: s.file });
      this.host.removeProp(s.ref);
      this.select(null);
    } else if (s.kind === 'npc') {
      this.record({ kind: 'remove', what: 'character', name: s.label, at: { ...s.pos() }, file: s.file });
      this.host.removeCharacter(s.ref);
      this.select(null);
    } else if (s.kind === 'block') {
      this.removeBlockAt(s.ref);
    }
    this.refresh();
  }

  // ------------------------------------------------------------------- blocks --
  placeBlockAt(blk) {
    const v = this.host.voxel, f = blk.face ?? blk;
    const from = v.name(v.get(f.x, f.y, f.z));
    v.set(f.x, f.y, f.z, this.paintBlock);
    this.record({ kind: 'block', at: { x: f.x, y: f.y, z: f.z }, from, to: v.name(this.paintBlock), toId: this.paintBlock });
    this.status(`placed ${v.name(this.paintBlock)} at ${f.x},${f.y},${f.z}`);
  }

  // Removing a block clears EXACTLY that cell and keeps the selection on the
  // now-empty cell, so the hole stays addressable (you can put something back
  // into it, or keep digging from there).
  removeBlockAt(blk) {
    const v = this.host.voxel;
    const from = v.name(v.get(blk.x, blk.y, blk.z));
    if (from === 'AIR') { this.status('already empty'); return; }
    v.set(blk.x, blk.y, blk.z, 0);
    this.record({ kind: 'block', at: { x: blk.x, y: blk.y, z: blk.z }, from, to: 'AIR', toId: 0 });
    this.select(blockSel(this, { x: blk.x, y: blk.y, z: blk.z, id: 0, face: null }));
    if (this.tab === 'inspect') this.refresh();
    this.status(`removed ${from} at ${blk.x},${blk.y},${blk.z} — the empty cell stays selected`);
  }

  // brush / terrain ops over a radius
  brushAt(blk) {
    const v = this.host.voxel, r = this.brush.radius, m = this.brush.mode;
    const cells = [];
    const inShape = (dx, dy, dz) => this.brush.shape === 'cube' || dx * dx + dy * dy + dz * dz <= r * r + 0.01;
    let n = 0;
    if (m === 'paint' || m === 'erase') {
      const target = m === 'erase' ? blk : (blk.face ?? blk);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (!inShape(dx, dy, dz)) continue;
        const x = target.x + dx, y = target.y + dy, z = target.z + dz;
        if (y < 0 || y >= v.SY) continue;
        const id = m === 'erase' ? 0 : this.paintBlock;
        if (v.get(x, y, z) === id) continue;
        v.set(x, y, z, id);
        cells.push([x, y, z, id]); n++;
      }
    } else {
      // column ops: raise / lower / flatten / smooth
      const cols = [];
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (this.brush.shape !== 'cube' && dx * dx + dz * dz > r * r + 0.01) continue;
        cols.push([blk.x + dx, blk.z + dz]);
      }
      const targetY = blk.y;
      for (const [x, z] of cols) {
        const top = v.topAt(x, z);
        if (m === 'raise') {
          const id = v.get(x, top, z) || this.paintBlock;
          if (top + 1 < v.SY) { v.set(x, top + 1, z, id); cells.push([x, top + 1, z, id]); n++; }
        } else if (m === 'lower') {
          if (top >= 0) { v.set(x, top, z, 0); cells.push([x, top, z, 0]); n++; }
        } else if (m === 'flatten') {
          const id = v.get(x, top, z) || this.paintBlock;
          for (let y = top; y > targetY; y--) { v.set(x, y, z, 0); n++; }
          for (let y = top + 1; y <= targetY; y++) { v.set(x, y, z, id); n++; }
          cells.push([x, targetY, z, id]);
        } else if (m === 'smooth') {
          const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => v.topAt(x + a, z + b));
          const avg = Math.round(around.reduce((s, h) => s + h, 0) / around.length);
          const id = v.get(x, top, z) || this.paintBlock;
          if (avg > top) { for (let y = top + 1; y <= avg; y++) { v.set(x, y, z, id); n++; } }
          else if (avg < top) { for (let y = top; y > avg; y--) { v.set(x, y, z, 0); n++; } }
        }
      }
    }
    v.remesh();
    this.record({ kind: 'terrain', mode: m, at: { x: blk.x, y: blk.y, z: blk.z }, radius: r, block: v.name(this.paintBlock), n, cells: cells.slice(0, 400) });
    this.status(`${m} ×${n} block(s)`);
  }

  // ------------------------------------------------------------------ imports --
  async importOne(file) {
    try {
      const res = await importFile(file);
      if (res.kind === 'mesh') {
        this.imported ??= [];
        this.imported.push({ name: res.name, group: res.group, scale: 1 });
        this.record({ kind: 'import', what: 'mesh', name: res.name, file: file.name });
        this.tab = 'create'; this.refresh();
        const s = res.size;
        this.status(`${res.name}: glTF loaded (${n2(s.x)}×${n2(s.y)}×${n2(s.z)}${res.animations ? `, ${res.animations} clip(s)` : ''}) — click "place" then click the world`);
        return;
      }
      if (res.kind === 'block') {
        this.paintBlock = res.id;
        this.record({ kind: 'import', what: 'block', name: res.name, id: res.id, file: file.name });
        this.tab = 'terrain'; this.refresh();
        this.status(`block "${res.name}" added (id ${res.id}) — it is now the paint block`);
        return;
      }
      const scale = res.scale ?? 0.1;
      const built = cellsToGroup(res.cells, { scale, name: res.name });
      this.imported ??= [];
      this.imported.push({ name: res.name, cells: res.cells, scale, size: built.size });
      this.record({ kind: 'import', what: 'model', name: res.name, cells: res.cells.length, file: file.name });
      this.tab = 'create'; this.refresh();
      this.status(`${res.name}: ${built.count} voxels${res.hadPalette === false ? ' (no palette in file — colours approximated)' : ''} — click "place" then click the world`);
    } catch (err) {
      this.status(`import failed: ${err.message}`);
    }
  }

  placeImported(entry) {
    this.beginPick('click where it goes', (hit) => {
      const p = this._pointOf(hit);
      // a glTF import is a ready-made group (cloned per placement); a voxel
      // import is rebuilt from its cells so every copy owns its geometry
      const group = entry.group
        ? entry.group.clone(true)
        : cellsToGroup(entry.cells, { scale: entry.scale, name: entry.name }).group;
      if (entry.group) group.scale.setScalar(entry.scale ?? 1);
      const prop = this.host.addImported(group, p.x, p.y, p.z);
      this.record({ kind: 'add', what: 'imported model', name: entry.name, at: p, file: 'dropped file' });
      this.select(propSel(this, prop));
      this.tab = 'inspect'; this.refresh();
    });
  }

  // ------------------------------------------------------------------ changes --
  record(c) {
    c.scene = this.host.label?.() ?? 'scene';
    const prev = this.changes[this.changes.length - 1];
    if (prev && c.kind === 'move' && prev.kind === 'move' && prev.name === c.name && prev.what === c.what) prev.to = c.to;
    else if (prev && c.kind === 'set' && prev.kind === 'set' && prev.name === c.name && prev.prop === c.prop) prev.to = c.to;
    else this.changes.push(c);
    save(this.changes);
    if (this.tab === 'changes') this.refresh();
  }

  consolidated() {
    const key = (c) => c.kind === 'block' ? `block:${c.at.x},${c.at.y},${c.at.z}`
      : c.kind === 'set' ? `set:${c.what}:${c.name}:${c.prop}`
      : c.kind === 'terrain' || c.kind === 'add' || c.kind === 'import' ? `${c.kind}:${Math.random()}`
      : `${c.kind}:${c.what}:${c.name}`;
    const out = [], seen = new Map();
    for (const c of this.changes) {
      const k = `${c.scene}|${key(c)}`;
      const prev = seen.get(k);
      if (prev) { prev.to = c.to; if (c.at) prev.at = c.at; continue; }
      const copy = { ...c };
      seen.set(k, copy); out.push(copy);
    }
    return out;
  }

  requestText() {
    const byScene = {};
    for (const c of this.consolidated()) (byScene[c.scene] ??= []).push(c);
    let out = '# World edit request\n';
    for (const [scene, list] of Object.entries(byScene)) {
      out += `\n## ${scene}\n`;
      list.forEach((c, i) => { out += `${i + 1}. ${describe(c)}\n`; });
    }
    return out.trim() + '\n';
  }

  reapply() {
    let n = 0;
    for (const c of this.changes) {
      try {
        if (c.kind === 'move' && c.what === 'prop') {
          const p = (this.host.props() || []).find((p) => p.group?.name === c.name && near(p.group.position, c.from));
          if (p) { p.group.position.set(c.to.x, c.to.y, c.to.z); n++; }
        } else if (c.kind === 'block') {
          this.host.voxel.set(c.at.x, c.at.y, c.at.z, c.toId); n++;
        } else if (c.kind === 'terrain' && c.cells) {
          for (const [x, y, z, id] of c.cells) this.host.voxel.set(x, y, z, id);
          n++;
        } else if (c.kind === 'set' && c.what === 'npc') {
          const ch = (this.host.characters() || []).find((x) => (x.name || x.kind) === c.name);
          if (ch) { ch[c.prop] = c.to; n++; }
        }
      } catch { /* a change that no longer applies is skipped */ }
    }
    this.host.voxel?.remesh();
    this.status(`re-applied ${n}/${this.changes.length}`);
  }

  async copy(text) {
    try { await navigator.clipboard.writeText(text); this.status('copied to clipboard'); }
    catch { this.status('clipboard blocked — select the text box and copy manually'); }
  }

  // ----------------------------------------------------------------- rendering --
  refresh() {
    for (const b of this.el.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === this.tab);
    this.bodyEl.innerHTML = '';
    ({
      scene: () => this.viewScene(), inspect: () => this.viewInspect(), terrain: () => this.viewTerrain(),
      create: () => this.viewCreate(), world: () => this.viewWorld(), changes: () => this.viewChanges(),
    })[this.tab]();
  }

  // small DOM helpers
  add(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) e[k] = v;
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    e.append(...kids);
    this.bodyEl.append(e);
    return e;
  }
  head(t) { this.add('h4', {}, t); }
  note(t) { this.add('div', { class: 'muted' }, t); }
  item(label, dim, on, onclick) {
    const e = this.add('div', { class: 'item' + (on ? ' on' : ''), onclick });
    e.append(label);
    const d = document.createElement('span'); d.className = 'dim'; d.textContent = dim;
    e.append(d);
    return e;
  }
  field(label, value, oninput, type = 'number') {
    const row = this.add('div', { class: 'row' });
    const l = document.createElement('label'); l.textContent = label;
    const i = document.createElement('input');
    i.type = type; i.value = value; if (type === 'number') i.step = 'any';
    i.oninput = () => oninput(type === 'number' ? Number(i.value) : i.value);
    row.append(l, i);
    return i;
  }
  slider(label, value, min, max, step, oninput) {
    const row = this.add('div', { class: 'row' });
    const l = document.createElement('label'); l.textContent = label;
    const i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = value;
    const out = document.createElement('span'); out.className = 'dim'; out.textContent = value;
    i.oninput = () => { out.textContent = i.value; oninput(Number(i.value)); };
    row.append(l, i, out);
    return i;
  }
  picker(label, options, value, onchange) {
    const row = this.add('div', { class: 'row' });
    const l = document.createElement('label'); l.textContent = label;
    const s = document.createElement('select');
    for (const o of options) {
      const op = document.createElement('option');
      if (Array.isArray(o)) { op.value = o[1]; op.textContent = o[0]; } else { op.value = o; op.textContent = o; }
      s.append(op);
    }
    s.value = value;
    s.onchange = () => onchange(s.value);
    row.append(l, s);
    return s;
  }
  buttons(...defs) {
    const row = this.add('div', { class: 'chips' });
    for (const [label, fn, title, on] of defs) {
      const b = document.createElement('button');
      b.textContent = label; b.onclick = fn; if (title) b.title = title;
      if (on) b.classList.add('on');
      row.append(b);
    }
    return row;
  }

  // ---- Scene tab ----
  viewScene() {
    const H = this.host;
    const f = this.filter.toLowerCase();
    const show = (name) => !f || name.toLowerCase().includes(f);
    this.field('filter', this.filter, (v) => { this.filter = v; this.refresh(); }, 'text');

    const props = H.props?.() ?? [];
    this.head(`props (${props.filter((p) => p.group).length})`);
    const seen = new Map();
    for (const p of props) {
      if (!p.group) continue;
      const nm = p.group.name || 'prop';
      seen.set(nm, (seen.get(nm) || 0) + 1);
      const label = `${nm}${seen.get(nm) > 1 ? ' #' + seen.get(nm) : ''}${p.group.visible ? '' : ' (hidden)'}`;
      if (!show(label)) continue;
      this.item(label, xyz(p.group.position), this.sel?.ref === p,
        () => { this.select(propSel(this, p)); this.tab = 'inspect'; this.refresh(); });
    }

    const chars = H.characters?.() ?? [];
    this.head(`characters (${chars.length})`);
    for (const c of chars) {
      const nm = c.name || c.kind;
      if (!show(nm)) continue;
      const job = this._jobOf(c);
      this.item(`${nm}${job ? ' · ' + job : ''}`, xz(c.pos), this.sel?.ref === c,
        () => { this.select(charSel(this, c)); this.tab = 'inspect'; this.refresh(); });
    }

    const amb = H.ambient?.();
    if (amb) {
      this.head('ambient jobs');
      for (const [id, job] of Object.entries(amb.jobs)) {
        if (!show(id)) continue;
        this.item(`${id} · ${job.item}`, xz(job.at), this.sel?.ref === job,
          () => { this.select(jobSel(this, id, job, amb)); this.tab = 'inspect'; this.refresh(); });
      }
      this.item('▸ ambient system', `${amb.workers.length} workers`, this.sel?.ref === amb,
        () => { this.select(ambientSel(this, amb)); this.tab = 'inspect'; this.refresh(); });
    }

    const sites = H.sites?.() ?? {};
    this.head('named sites');
    for (const [k, v] of Object.entries(sites)) {
      if (Array.isArray(v) || !show(k)) continue;
      this.item(k, xz(v), this.sel?.ref === v,
        () => { this.select(siteSel(this, k, v)); this.tab = 'inspect'; this.refresh(); });
    }

    this.head('scene');
    this.item('sky / light', '', this.sel?.kind === 'sky', () => { this.select(skySel(this)); this.tab = 'inspect'; this.refresh(); });
    if (H.player) this.item('player', xyz(H.player.pos), this.sel?.kind === 'player',
      () => { this.select(playerSel(this)); this.tab = 'inspect'; this.refresh(); });
  }

  _jobOf(c) {
    const amb = this.host.ambient?.();
    const w = amb?.workers.find((w) => w.npc === c);
    return w ? `${w.job?.id ?? '—'}/${w.state}` : '';
  }

  // ---- Inspect tab ----
  viewInspect() {
    const s = this.sel;
    if (!s) {
      this.head('nothing selected');
      this.note('Click anything in the world, or pick it from the Scene tab.');
      return;
    }
    this.head(`${s.kind} · ${s.label}`);
    if (s.file) this.note(`source: ${s.file}`);

    if (s.pos) {
      const p = s.pos();
      this.field('x', n2(p.x), (v) => this.setAxis('x', v));
      if (!s.flat) this.field('y', n2(p.y), (v) => this.setAxis('y', v));
      this.field('z', n2(p.z), (v) => this.setAxis('z', v));
      this.buttons(
        ['−X', () => this.move(-this.step, 0, 0)], ['+X', () => this.move(this.step, 0, 0)],
        ['−Y', () => this.move(0, -this.step, 0)], ['+Y', () => this.move(0, this.step, 0)],
        ['−Z', () => this.move(0, 0, -this.step)], ['+Z', () => this.move(0, 0, this.step)],
      );
      this.buttons(
        ['place…', () => this.beginPick('click the new position', (hit) => {
          const q = this._pointOf(hit);
          this.setAbs(q.x, s.flat ? 0 : q.y, q.z);
          this.refresh();
        }), 'click a spot in the world'],
        ['snap', () => { const q = s.pos(); this.setAbs(Math.round(q.x * 2) / 2, q.y, Math.round(q.z * 2) / 2); this.refresh(); }],
        ['look at it', () => this.focus(s)],
      );
    }

    for (const fd of s.fields ?? []) this._renderField(s, fd);

    if (s.kind === 'prop' || s.kind === 'npc') {
      this.buttons(
        ['duplicate', () => s.duplicate?.()],
        ['delete', () => this.deleteSelected()],
        ...(s.kind === 'prop' ? [['hide', () => { s.ref.group.visible = false; this.refresh(); }], ['show', () => { s.ref.group.visible = true; this.refresh(); }]] : []),
      );
    }
    this.note('keys: arrows = XZ · PgUp/PgDn = Y · R rotate · hold G + move = drag on ground · Del delete');
  }

  _renderField(s, f) {
    if (f.type === 'button') { this.buttons([f.label, f.onclick, f.title]); return; }
    if (f.type === 'buttons') { this.buttons(...f.items); return; }
    if (f.type === 'note') { this.note(f.label); return; }
    if (f.type === 'head') { this.head(f.label); return; }
    if (f.type === 'text') {
      this.field(f.label, f.get(), (v) => { const b = f.get(); f.set(v); this.record({ kind: 'set', what: s.kind, name: s.label, prop: f.label, from: b, to: v, file: s.file }); }, 'text');
      return;
    }
    if (f.type === 'color') {
      const row = this.add('div', { class: 'row' });
      const l = document.createElement('label'); l.textContent = f.label;
      const i = document.createElement('input');
      i.type = 'color'; i.value = f.get();
      i.oninput = () => { const b = f.get(); f.set(i.value); this.record({ kind: 'set', what: s.kind, name: s.label, prop: f.label, from: b, to: i.value, file: s.file }); };
      row.append(l, i);
      return;
    }
    if (f.type === 'select') {
      this.picker(f.label, f.options, f.get(), (v) => {
        const b = f.get(); f.set(v);
        this.record({ kind: 'set', what: s.kind, name: s.label, prop: f.label, from: b, to: v, file: s.file });
        if (f.refresh !== false) this.refresh();
      });
      return;
    }
    this.field(f.label, f.get(), (v) => {
      const b = f.get(); f.set(v);
      this.record({ kind: 'set', what: s.kind, name: s.label, prop: f.label, from: b, to: v, file: s.file });
    });
  }

  setAxis(axis, v) {
    const p = { ...this.sel.pos() };
    p[axis] = v;
    this.setAbs(p.x, p.y, p.z);
  }

  focus(s) {
    const p = s.pos ? s.pos() : (s.marker ?? { x: 0, y: 0, z: 0 });
    const cam = this.host.camera;
    this.setFly(true);
    cam.position.set(p.x + 4, (p.y || 0) + 3, p.z + 4);
    this.fly.yaw = Math.atan2(cam.position.x - p.x, cam.position.z - p.z);
    this.fly.pitch = -0.45;
  }

  // ---- Terrain tab ----
  viewTerrain() {
    const v = this.host.voxel;
    if (!v) { this.note('this host has no voxel world'); return; }
    this.head('block');
    const ids = Object.entries(v.ids).sort((a, b) => a[1] - b[1]);
    this.picker('paint with', ids.map(([n, id]) => [n, String(id)]), String(this.paintBlock), (val) => { this.paintBlock = Number(val); });
    this.buttons(
      ['sample under me', () => {
        const p = this.host.player?.pos ?? this.host.camera.position;
        const x = Math.floor(p.x), z = Math.floor(p.z), y = v.topAt(x, z);
        this.paintBlock = v.get(x, y, z);
        this.refresh();
        this.status(`sampled ${v.name(this.paintBlock)}`);
      }],
      ['sample by click', () => this.beginPick('click the block to sample', (hit) => {
        if (hit.kind === 'block') { this.paintBlock = hit.ref.id; this.refresh(); this.status(`sampled ${v.name(hit.ref.id)}`); }
      })],
    );

    this.head('brush');
    this.picker('mode', ['paint', 'erase', 'raise', 'lower', 'flatten', 'smooth'], this.brush.mode, (m) => { this.brush.mode = m; });
    this.picker('shape', ['cube', 'sphere'], this.brush.shape, (m) => { this.brush.shape = m; });
    this.slider('radius', this.brush.radius, 0, 8, 1, (r) => { this.brush.radius = r; });
    this.note('While this tab is open, a plain click applies the brush. Alt+click places a single block anywhere; Alt+right-click removes one.');

    this.head('x-ray / cutaway');
    this.buttons(
      ['xray', () => this.setXray(!this.xray), 'see through terrain', this.xray],
      ['wire', () => this.setWire(!this.wire), 'wireframe', this.wire],
      ['plan view', () => this.planView()],
    );
    this.slider('slice Y', this.sliceY ?? v.SY, 0, v.SY, 1, (y) => this.setSlice(y));
    this.note('Slice hides everything above that height — a clean cutaway of the layout.');

    this.head('column under the camera');
    const p = this.host.camera.position;
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    const top = v.topAt(cx, cz);
    this.note(`${cx}, ${cz} · top y=${top} · ${v.name(v.get(cx, top, cz))}`);
  }

  // ---- Create tab ----
  viewCreate() {
    const H = this.host;
    this.head('place a prop');
    const kinds = H.propKinds?.() ?? [];
    this.picker('prop', kinds, this._newProp ?? kinds[0], (k) => { this._newProp = k; });
    this.buttons(['place…', () => {
      const kind = this._newProp ?? kinds[0];
      this.beginPick(`click where the ${kind} goes`, (hit) => {
        const p = this._pointOf(hit);
        const prop = H.spawnProp(kind, p.x, p.y, p.z);
        this.record({ kind: 'add', what: 'prop', name: kind, at: p, file: 'src/acts/act1.js (placement)' });
        this.select(propSel(this, prop));
        this.tab = 'inspect'; this.refresh();
      });
    }]);

    this.head('spawn a character');
    const ck = H.characterKinds?.() ?? [];
    this.picker('kind', ck, this._newChar ?? ck[0], (k) => { this._newChar = k; });
    this.buttons(['spawn…', () => {
      const kind = this._newChar ?? ck[0];
      this.beginPick(`click where the ${kind} appears`, (hit) => {
        const p = this._pointOf(hit);
        const c = H.spawnCharacter(kind, p.x, p.z);
        this.record({ kind: 'add', what: 'character', name: kind, at: p, file: 'src/acts/act1.js (spawn)' });
        this.select(charSel(this, c));
        this.tab = 'inspect'; this.refresh();
      });
    }]);

    this.head('import your own voxels');
    const drop = this.add('div', { class: 'drop' }, 'drop a .vox or .json here');
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.vox,.json'; input.multiple = true;
    input.style.marginTop = '6px';
    input.onchange = async () => { for (const f of input.files) await this.importOne(f); };
    drop.append(document.createElement('br'), input);
    this.note('.vox = MagicaVoxel (free). .json = { "name":"x", "scale":0.1, "cells":[[x,y,z,"#rrggbb"], …] } for a model, or { "block":"MOSSY_STONE", "top":"#6f7a4a" } to add a new terrain block type.');

    if (this.imported?.length) {
      this.head('imported this session');
      for (const e of this.imported) {
        const dim = e.group ? 'glTF mesh' : `${e.cells.length} voxels ${e.size ? `${e.size.x}×${e.size.y}×${e.size.z}` : ''}`;
        this.item(e.name, dim, false, () => this.placeImported(e));
      }
      this.slider('place at scale', this._impScale ?? 1, 0.02, 4, 0.02, (v) => {
        this._impScale = v;
        for (const e of this.imported) e.scale = e.group ? v : v * 0.1;
      });
      this.note('Click one, then click in the world to place it.');
    }

    this.viewBlockDesigner();
  }

  // ---- block designer: paint the six faces of your own block ----------------
  // Faces are 16×16 tiles of CSS colours, which is exactly the format the atlas
  // and the JSON importer take, so what you paint here is what you can save.
  viewBlockDesigner() {
    const v = this.host.voxel;
    if (!v) return;
    const d = this.designer ??= {
      name: 'MY_BLOCK', face: 'side', color: '#7a6a4a', tool: 'pencil',
      solid: true, tiles: { top: grainTile(0x8aa356), side: grainTile(0x7a6a4a), bottom: grainTile(0x6a5a3c) },
    };

    this.head('design your own block');
    this.field('name', d.name, (val) => { d.name = val.toUpperCase().replace(/[^A-Z0-9_]/g, '_'); }, 'text');
    this.picker('face', ['top', 'side', 'bottom'], d.face, (f) => { d.face = f; this.refresh(); });

    // the canvas painter
    const wrap = this.add('div', { class: 'row' });
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE;
    cv.style.cssText = 'width:224px;height:224px;image-rendering:pixelated;border:1px solid #3d3527;cursor:crosshair';
    const ctx = cv.getContext('2d');
    const paintCanvas = () => {
      ctx.clearRect(0, 0, TILE, TILE);
      const px = d.tiles[d.face];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const c = px[y * TILE + x];
        if (!c) continue;
        ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
      }
    };
    paintCanvas();
    let down = false;
    const cellAt = (e) => {
      const r = cv.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * TILE), Math.floor((e.clientY - r.top) / r.height * TILE)];
    };
    const apply = (e) => {
      const [x, y] = cellAt(e);
      if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
      const px = d.tiles[d.face], i = y * TILE + x;
      if (d.tool === 'pick') { d.color = px[i] || d.color; this.refresh(); return; }
      if (d.tool === 'fill') { const from = px[i]; floodFill(px, x, y, from, d.tool === 'erase' ? null : d.color); }
      else px[i] = d.tool === 'erase' ? null : d.color;
      paintCanvas();
    };
    cv.onmousedown = (e) => { down = true; apply(e); e.preventDefault(); };
    cv.onmousemove = (e) => { if (down) apply(e); };
    addEventListener('mouseup', () => { down = false; });
    wrap.append(cv);

    const row = this.add('div', { class: 'row' });
    const ci = document.createElement('input');
    ci.type = 'color'; ci.value = d.color;
    ci.oninput = () => { d.color = ci.value; };
    const lbl = document.createElement('label'); lbl.textContent = 'colour';
    row.append(lbl, ci);

    this.buttons(
      ...['pencil', 'fill', 'erase', 'pick'].map((t) => [t, () => { d.tool = t; this.refresh(); }, '', d.tool === t]),
    );
    this.buttons(
      ['flat fill', () => { d.tiles[d.face] = new Array(TILE * TILE).fill(d.color); this.refresh(); }],
      ['grain fill', () => { d.tiles[d.face] = grainTile(parseInt(d.color.slice(1), 16)); this.refresh(); }],
      ['noise', () => { const px = d.tiles[d.face]; for (let i = 0; i < px.length; i++) if (px[i] && Math.random() < 0.25) px[i] = jitterHex(px[i], 0.12); this.refresh(); }],
      ['clear', () => { d.tiles[d.face] = new Array(TILE * TILE).fill(null); this.refresh(); }],
      ['copy to all faces', () => { const px = d.tiles[d.face].slice(); d.tiles = { top: px.slice(), side: px.slice(), bottom: px.slice() }; this.status('face copied to top, side and bottom'); }],
    );
    // start from an existing block's colours
    this.picker('start from', ['(none)', ...Object.keys(v.ids).filter((k) => k !== 'AIR')], '(none)', (name) => {
      if (name === '(none)') return;
      const def = v.defs[v.ids[name]];
      const toHex = (c) => (c ? ((Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255)) : 0x808080);
      d.tiles = { top: grainTile(toHex(def.top)), side: grainTile(toHex(def.side)), bottom: grainTile(toHex(def.bottom)) };
      d.name = `MY_${name}`;
      this.refresh();
    });
    this.picker('solid', ['yes', 'no'], d.solid ? 'yes' : 'no', (val) => { d.solid = val === 'yes'; });

    this.buttons(
      ['create / update block', () => {
        const id = parseBlockJson({ block: d.name, tiles: d.tiles, solid: d.solid }, this._designerTex ??= {});
        // remember the tiles so a second "update" repaints in place
        this._designerTex = v.defs[id]?.tex ?? {};
        this.paintBlock = id;
        v.remeshAll();
        this.record({ kind: 'import', what: 'painted block', name: d.name, id, file: 'block designer' });
        this.status(`${d.name} is block ${id} and is now your paint block — Alt+click to place it`);
        this.refresh();
      }],
      ['copy JSON', () => this.copy(JSON.stringify({ block: d.name, solid: d.solid, tiles: d.tiles }, null, 1))],
    );
    this.note('Paint a face, copy it to all faces if you like, then create the block. "copy JSON" gives you a file you can drop back in later — or hand to me to make it permanent in blocks.js.');
  }

  // ---- World tab ----
  viewWorld() {
    const H = this.host;
    this.head('render');
    const cam = H.camera;
    this.slider('fov', cam.fov ?? 70, 30, 110, 1, (v) => { cam.fov = v; cam.updateProjectionMatrix(); });
    this.slider('fly speed', this.fly.speed, 1, 60, 1, (v) => { this.fly.speed = v; });
    this.buttons(
      ['grid', () => { this.grid.visible = !this.grid.visible; }, 'ground grid'],
      ['screenshot', () => this.screenshot()],
    );
    const info = H.renderer?.info;
    if (info) this.note(`${this.stats.fps} fps · ${info.render.calls} draw calls · ${info.render.triangles.toLocaleString()} tris`);

    this.head('sky / light');
    const sky = skySel(this);
    for (const f of sky.fields) this._renderField(sky, f);

    if (H.player?.tune) {
      this.head('player');
      for (const k of ['SPEED', 'JUMP', 'GRAVITY', 'REACH', 'RADIUS']) {
        if (H.player.tune[k] === undefined) continue;
        this.field(k.toLowerCase(), H.player.tune[k], (v) => {
          const b = H.player.tune[k];
          H.player.tune[k] = v;
          this.record({ kind: 'set', what: 'player', name: 'PLAYER', prop: k, from: b, to: v, file: 'src/constants.js' });
        });
      }
      this.buttons(['teleport me here', () => {
        const p = H.camera.position;
        H.player.teleport(p.x, p.z, undefined, p.y);
        this.status('player moved to the camera');
      }]);
    }

    if (H.player?.world) {
      this.head('map size');
      this.note('Changing these needs a rebuild, so they are RECORDED, not applied live — the world array and chunk grid are sized at load.');
      for (const k of ['SIZE_X', 'SIZE_Y', 'SIZE_Z']) {
        this.field(k.toLowerCase(), H.player.world[k], (v) => {
          this.record({ kind: 'set', what: 'world', name: 'WORLD', prop: k, from: H.player.world[k], to: v, file: 'src/constants.js (needs a reload)' });
        });
      }
    }
  }

  // ---- Changes tab ----
  viewChanges() {
    this.head(`change list (${this.changes.length})`);
    this.buttons(
      ['copy request', () => this.copy(this.requestText())],
      ['copy JSON', () => this.copy(JSON.stringify(this.changes, null, 2))],
      ['re-apply', () => this.reapply()],
      ['clear', () => { if (confirm('Clear the whole change list?')) { this.changes = []; save([]); this.refresh(); } }],
    );
    const ta = this.add('textarea', {});
    ta.value = this.requestText();
    ta.onclick = () => ta.select();
    this.note('Paste that into the chat and the same edits get made in the source files.');
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const c = this.changes[i];
      const row = this.add('div', { class: 'chg' });
      const b = document.createElement('b'); b.textContent = String(i + 1);
      const t = document.createElement('span'); t.textContent = describe(c);
      const x = document.createElement('span'); x.className = 'x'; x.textContent = '✕';
      x.onclick = () => { this.changes.splice(i, 1); save(this.changes); this.refresh(); };
      row.append(b, t, x);
    }
  }
}

// ---------------------------------------------------------------- selections --

function propSel(ed, p) {
  return {
    kind: 'prop', ref: p, label: p.group.name || 'prop', object3d: p.group,
    file: 'src/acts/act1.js (placement) · src/world/props.js (shape)',
    pos: () => p.group.position,
    setPos: (x, y, z) => p.group.position.set(x, y, z),
    duplicate: () => {
      const g = p.group.clone(true);
      g.position.x += 1;
      const copy = ed.host.addImported(g, g.position.x, g.position.y, g.position.z);
      ed.record({ kind: 'add', what: 'prop (copy)', name: p.group.name, at: { ...g.position }, file: 'src/acts/act1.js' });
      ed.select(propSel(ed, copy)); ed.refresh();
    },
    fields: [
      { label: 'rotY', get: () => n2(p.group.rotation.y), set: (v) => { p.group.rotation.y = v; } },
      { label: 'scale', get: () => n2(p.group.scale.x), set: (v) => p.group.scale.setScalar(v || 1) },
      { label: 'name', type: 'text', get: () => p.group.name, set: (v) => { p.group.name = v; } },
      ...(p.setOpen ? [{ type: 'button', label: 'toggle open/closed', onclick: () => p.setOpen(!p.isOpen) }] : []),
      ...(p.setBerries ? [{ type: 'button', label: 'toggle berries', onclick: () => p.setBerries(!p.hasBerries) }] : []),
    ],
  };
}

// Full behaviour control for people and animals.
function charSel(ed, c) {
  const isAnimal = !!c.kind;
  const H = ed.host;
  const say = { text: '👋', ms: 2500 };
  const fields = [
    { type: 'head', label: 'movement' },
    { label: 'speed', get: () => n2(c.speed), set: (v) => { c.speed = v; } },
    { label: 'wanderR', get: () => n2(c.wanderR), set: (v) => { c.wanderR = v; } },
    { label: 'homeX', get: () => n2(c.home.x), set: (v) => { c.home.x = v; } },
    { label: 'homeZ', get: () => n2(c.home.z), set: (v) => { c.home.z = v; } },
    {
      type: 'buttons', items: [
        ['walk to…', () => ed.beginPick('click where they should walk', (hit) => {
          const p = ed._pointOf(hit);
          c.goTo(p.x, p.z);
          ed.record({ kind: 'behaviour', name: c.name || c.kind, action: `goTo(${n2(p.x)}, ${n2(p.z)})`, file: 'src/acts/act1.js' });
        })],
        ['home here', () => ed.beginPick('click their new home', (hit) => {
          const p = ed._pointOf(hit);
          const b = { ...c.home };
          c.home = { x: p.x, z: p.z }; c.goTo(p.x, p.z);
          ed.record({ kind: 'set', what: 'npc', name: c.name || c.kind, prop: 'home', from: xz(b), to: xz(c.home), file: 'src/acts/act1.js' });
          ed.refresh();
        })],
        ['stop', () => { c._target = null; c.followTarget = null; }],
        [c.frozen ? 'unfreeze' : 'freeze', () => { c.frozen = !c.frozen; ed.refresh(); }],
      ],
    },
    {
      type: 'buttons', items: [
        ['follow player', () => { c.followTarget = H.player?.pos ?? null; ed.record({ kind: 'behaviour', name: c.name || c.kind, action: 'followTarget = player', file: 'src/acts/act1.js' }); }],
        ['follow…', () => ed.beginPick('click who they should follow', (hit) => {
          if (hit.kind !== 'npc') return ed.status('pick a character');
          c.followTarget = hit.ref.pos;
          ed.record({ kind: 'behaviour', name: c.name || c.kind, action: `follows ${hit.ref.name || hit.ref.kind}`, file: 'src/acts/act1.js' });
        })],
        ['face…', () => ed.beginPick('click what they should face', (hit) => {
          const p = ed._pointOf(hit);
          c.faceToward(p.x, p.z);
        })],
        ['bring to me', () => { const p = H.camera.position; c.pos.set(p.x, c.pos.y, p.z); c.snapToGround?.(); }],
      ],
    },
  ];

  if (!isAnimal) {
    fields.push(
      { type: 'head', label: 'what they do' },
      { label: 'pose', type: 'select', options: ['(none)', 'aim', 'cast', 'pick', 'chop', 'tend'], get: () => c._pose ?? '(none)', set: (v) => c.pose(v === '(none)' ? null : v), refresh: false },
      { label: 'carries', type: 'select', options: ['(nothing)', 'bow', 'rod', 'basket', 'spear', 'axe', 'firewood'], get: () => c.carried ?? '(nothing)', set: (v) => c.carry(v === '(nothing)' ? null : v), refresh: false },
      { label: 'busy', type: 'select', options: ['no', 'yes'], get: () => (c.busy ? 'yes' : 'no'), set: (v) => { c.busy = v === 'yes'; }, refresh: false },
      { type: 'head', label: 'what they say' },
      { label: 'bubble', type: 'text', get: () => say.text, set: (v) => { say.text = v; } },
      { type: 'button', label: 'say it', onclick: () => { c.say(say.text, say.ms); ed.record({ kind: 'behaviour', name: c.name || c.kind, action: `say("${say.text}")`, file: 'src/acts/act1.js · src/strings.js' }); } },

      // ---- when talked to -------------------------------------------------
      // The player-facing conversation, edited live. This is npc.talk, plain
      // data on the character, so authoring tribe dialogue never means opening
      // an act script. Every change lands in the change list against
      // strings.js, which is where the final wording has to end up.
      { type: 'head', label: 'when talked to' },
      {
        type: 'note',
        label: 'Reply in PICTOGRAMS, not words. Act 1 teaches that their language is lost, and an English reply undoes it.',
      },
      {
        label: 'talkable', type: 'select', options: ['yes', 'no'],
        get: () => (c.talk?.enabled === false ? 'no' : 'yes'),
        set: (v) => {
          if (!c.talk) c.talk = { icons: '', note: '', enabled: true };
          c.talk.enabled = v === 'yes';
          ed.record({ kind: 'set', what: 'npc', name: c.name || c.kind, prop: 'talk.enabled', from: v === 'yes' ? 'no' : 'yes', to: v, file: 'src/acts/act1.js' });
        },
      },
      {
        label: 'reply (icons)', type: 'text',
        get: () => c.talk?.icons ?? '',
        set: (v) => {
          if (!c.talk) c.talk = { icons: '', note: '', enabled: true };
          const from = c.talk.icons;
          c.talk.icons = v;
          ed.record({ kind: 'set', what: 'npc', name: c.name || c.kind, prop: 'talk.icons', from, to: v, file: 'src/strings.js' });
        },
      },
      {
        label: 'your thought', type: 'text',
        get: () => c.talk?.note ?? '',
        set: (v) => {
          if (!c.talk) c.talk = { icons: '', note: '', enabled: true };
          const from = c.talk.note;
          c.talk.note = v;
          ed.record({ kind: 'set', what: 'npc', name: c.name || c.kind, prop: 'talk.note', from, to: v, file: 'src/strings.js' });
        },
      },
      {
        type: 'button', label: 'preview the reply',
        onclick: () => c.say(c.talk?.icons || '…', 3000),
      },
    );
    const amb = H.ambient?.();
    const w = amb?.workers.find((w) => w.npc === c);
    if (amb) {
      fields.push({ type: 'head', label: 'errand (ambient life)' });
      if (w) {
        fields.push(
          { type: 'note', label: `job ${w.job?.id ?? '—'} · state ${w.state}` },
          {
            label: 'job now', type: 'select', options: Object.keys(amb.jobs), get: () => w.ids[w.idx] ?? Object.keys(amb.jobs)[0],
            set: (v) => { w.ids = [v]; w.idx = 0; w.state = 'idle'; w.t = 0; },
          },
          { label: 'rotation', type: 'text', get: () => w.ids.join(','), set: (v) => { w.ids = v.split(',').map((s) => s.trim()).filter((s) => amb.jobs[s]); w.idx = 0; } },
          { type: 'buttons', items: [['restart errand', () => { w.state = 'idle'; w.t = 0; }], ['send home', () => { amb._abort(w); }]] },
        );
      } else {
        fields.push({
          type: 'button', label: 'give this one a job',
          onclick: () => { amb.assign(c, Object.keys(amb.jobs)[0], 'idle'); ed.refresh(); },
        });
      }
    }
  } else {
    fields.push(
      { type: 'head', label: 'animal' },
      { type: 'note', label: `kind: ${c.kind}${c.downed ? ' · downed' : ''}` },
      {
        type: 'buttons', items: [
          ['flee from me', () => c.fleeFrom(H.camera.position.x, H.camera.position.z)],
          ['down it', () => { c.down(); ed.record({ kind: 'behaviour', name: c.kind, action: 'down()', file: 'src/npc/npc.js' }); }],
        ],
      },
    );
  }

  return {
    kind: 'npc', ref: c, label: c.name || c.kind, object3d: c.group,
    file: 'src/acts/act1.js (spawn + script) · src/npc/npc.js (behaviour)',
    pos: () => c.pos,
    setPos: (x, y, z) => { c.pos.set(x, y, z); c.snapToGround?.(); },
    duplicate: () => {
      const copy = H.spawnCharacter(isAnimal ? c.kind : 'npc', c.pos.x + 1, c.pos.z);
      ed.record({ kind: 'add', what: 'character', name: isAnimal ? c.kind : 'npc', at: { x: c.pos.x + 1, z: c.pos.z }, file: 'src/acts/act1.js' });
      ed.select(charSel(ed, copy)); ed.refresh();
    },
    fields,
  };
}

function jobSel(ed, id, job, amb) {
  return {
    kind: 'job', ref: job, label: id, flat: true,
    file: 'src/acts/act1.js (job list) · src/npc/ambient.js (behaviour)',
    marker: { x: Math.floor(job.at.x), y: 0, z: Math.floor(job.at.z) },
    pos: () => ({ x: job.at.x, y: 0, z: job.at.z }),
    setPos: (x, _y, z) => { job.at.x = x; job.at.z = z; },
    fields: [
      { label: 'tool', type: 'select', options: ['bow', 'rod', 'basket', 'spear', 'axe', 'firewood'], get: () => job.item, set: (v) => { job.item = v; } },
      { label: 'pose', type: 'select', options: ['aim', 'cast', 'pick', 'chop', 'tend'], get: () => job.pose, set: (v) => { job.pose = v; } },
      { label: 'workMin', get: () => job.work[0], set: (v) => { job.work[0] = v; } },
      { label: 'workMax', get: () => job.work[1], set: (v) => { job.work[1] = v; } },
      { label: 'beat', get: () => job.beat, set: (v) => { job.beat = v; } },
      { label: 'icon', type: 'text', get: () => job.icon, set: (v) => { job.icon = v; } },
      { label: 'doneIcon', type: 'text', get: () => job.doneIcon, set: (v) => { job.doneIcon = v; } },
      { type: 'button', label: 'move site by click', onclick: () => ed.beginPick('click the new work site', (hit) => {
        const p = ed._pointOf(hit);
        const b = { x: job.at.x, y: 0, z: job.at.z };
        job.at.x = p.x; job.at.z = p.z;
        ed.record({ kind: 'move', what: 'job', name: id, from: b, to: { x: p.x, y: 0, z: p.z }, file: 'src/acts/act1.js (job list)' });
        ed.refresh();
      }) },
    ],
  };
}

function ambientSel(ed, amb) {
  return {
    kind: 'ambient', ref: amb, label: 'ambient life', file: 'src/npc/ambient.js',
    fields: [
      { label: 'walkSpeed', get: () => amb.workSpeed, set: (v) => { amb.workSpeed = v; for (const w of amb.workers) if (w.npc.busy) w.npc.speed = v; } },
      { type: 'note', label: amb.workers.map((w, i) => `worker${i}: ${w.npc.name} ${w.ids.join('→')} (${w.state})`).join(' · ') },
      ...amb.workers.map((w, i) => ({
        label: `worker${i}`, type: 'select', options: Object.keys(amb.jobs),
        get: () => w.ids[w.idx] ?? Object.keys(amb.jobs)[0],
        set: (v) => { w.ids = [v]; w.idx = 0; w.state = 'idle'; w.t = 0; },
      })),
      { type: 'button', label: 'stop all errands', onclick: () => amb.stop() },
    ],
  };
}

function siteSel(ed, key, v) {
  const H = ed.host;
  return {
    kind: 'site', ref: v, label: key, flat: true, file: 'src/world/terrain.js → SITES',
    marker: { x: v.x, y: H.voxel ? H.voxel.topAt(v.x, v.z) : 0, z: v.z },
    pos: () => ({ x: v.x, y: 0, z: v.z }),
    setPos: (x, _y, z) => { v.x = Math.round(x); v.z = Math.round(z); },
    fields: [
      { type: 'note', label: 'Structures already built into the voxel world do not move — this records the coordinate change for terrain.js, where the next build picks it up.' },
    ],
  };
}

function blockSel(ed, blk) {
  const v = ed.host.voxel;
  const empty = v.get(blk.x, blk.y, blk.z) === 0;
  return {
    kind: 'block', ref: blk, label: `${empty ? 'empty cell' : v.name(blk.id)} @ ${blk.x},${blk.y},${blk.z}`,
    flat: true, file: 'src/world/terrain.js · src/world/states.js (whatever builds it)',
    marker: { x: blk.x, y: blk.y, z: blk.z },
    fields: [
      {
        label: 'block', type: 'select',
        options: Object.entries(v.ids).sort((a, b) => a[1] - b[1]).map(([n, id]) => [n, String(id)]),
        get: () => String(v.get(blk.x, blk.y, blk.z)),
        set: (val) => {
          const from = v.name(v.get(blk.x, blk.y, blk.z));
          v.set(blk.x, blk.y, blk.z, Number(val));
          ed.record({ kind: 'block', at: { x: blk.x, y: blk.y, z: blk.z }, from, to: v.name(Number(val)), toId: Number(val) });
        },
      },
      {
        type: 'buttons', items: [
          ['erase this cell', () => ed.removeBlockAt(blk)],
          ['fill with paint block', () => { v.set(blk.x, blk.y, blk.z, ed.paintBlock); ed.record({ kind: 'block', at: { x: blk.x, y: blk.y, z: blk.z }, from: v.name(blk.id), to: v.name(ed.paintBlock), toId: ed.paintBlock }); ed.refresh(); }],
          ['select cell above', () => { ed.select(blockSel(ed, { x: blk.x, y: blk.y + 1, z: blk.z, id: v.get(blk.x, blk.y + 1, blk.z), face: null })); ed.refresh(); }],
          ['select cell below', () => { ed.select(blockSel(ed, { x: blk.x, y: blk.y - 1, z: blk.z, id: v.get(blk.x, blk.y - 1, blk.z), face: null })); ed.refresh(); }],
        ],
      },
      { type: 'note', label: `column top: y=${v.topAt(blk.x, blk.z)}` },
    ],
  };
}

function playerSel(ed) {
  const H = ed.host;
  return {
    kind: 'player', ref: H.player, label: 'player', file: 'src/acts/act1.js (teleport)',
    object3d: H.player.model?.(),
    pos: () => H.player.pos,
    setPos: (x, y, z) => H.player.teleport(x, z, undefined, y),
    fields: [{ type: 'button', label: 'drop to ground', onclick: () => H.player.teleport(H.player.pos.x, H.player.pos.z) }],
  };
}

function skySel(ed) {
  const H = ed.host;
  const st = (ed._sky ??= {
    top: H.scene.background ? hex(H.scene.background) : '#9ec8e8',
    fog: H.scene.fog ? hex(H.scene.fog.color) : '#cfe0ee',
  });
  const apply = () => H.setSky?.(parseInt(st.top.slice(1), 16), parseInt(st.fog.slice(1), 16));
  const lights = [];
  H.scene.traverse((o) => { if (o.isLight && o.type !== 'PointLight') lights.push(o); });
  return {
    kind: 'sky', ref: 'sky', label: 'sky / light', file: 'src/acts/act1.js → setSky(skyHex, fogHex)',
    fields: [
      { type: 'color', label: 'skyTop', get: () => st.top, set: (v) => { st.top = v; apply(); } },
      { type: 'color', label: 'skyFog', get: () => st.fog, set: (v) => { st.fog = v; apply(); } },
      ...lights.map((l, i) => ({
        label: `${l.type.replace('Light', '').toLowerCase()}${i}`, get: () => n2(l.intensity), set: (v) => { l.intensity = v; },
      })),
      ...(H.scene.fog ? [
        { label: 'fogNear', get: () => n2(H.scene.fog.near), set: (v) => { H.scene.fog.near = v; } },
        { label: 'fogFar', get: () => n2(H.scene.fog.far), set: (v) => { H.scene.fog.far = v; } },
      ] : []),
    ],
  };
}

// -------------------------------------------------------------------- helpers --
function jitterHex(hex, amt) {
  const c = new THREE.Color(hex);
  const k = 1 + (Math.random() - 0.5) * 2 * amt;
  return '#' + new THREE.Color(Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)).getHexString();
}

// 4-way flood fill over a 16×16 tile
function floodFill(px, x, y, from, to) {
  if (from === to) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= TILE || cy >= TILE) continue;
    const i = cy * TILE + cx;
    if (px[i] !== from) continue;
    px[i] = to;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

function rootOf(obj, roots) {
  let o = obj;
  while (o && !roots.includes(o)) o = o.parent;
  return o;
}
function near(p, q, e = 0.75) {
  return Math.abs(p.x - q.x) < e && Math.abs(p.y - q.y) < e && Math.abs(p.z - q.z) < e;
}
function describe(c) {
  if (c.kind === 'move') return `MOVE ${c.what} \`${c.name}\` ${xyz(c.from)} → ${xyz(c.to)}${c.file ? `   [${c.file}]` : ''}`;
  if (c.kind === 'remove') return `REMOVE ${c.what} \`${c.name}\` at ${xyz(c.at)}${c.file ? `   [${c.file}]` : ''}`;
  if (c.kind === 'add') return `ADD ${c.what} \`${c.name}\` at ${xyz(c.at)}${c.file ? `   [${c.file}]` : ''}`;
  if (c.kind === 'block') return `BLOCK (${c.at.x}, ${c.at.y}, ${c.at.z}) ${c.from} → ${c.to}`;
  if (c.kind === 'terrain') return `TERRAIN ${c.mode} r=${c.radius} at (${c.at.x}, ${c.at.y}, ${c.at.z}) with ${c.block} — ${c.n} cell(s)`;
  if (c.kind === 'behaviour') return `BEHAVIOUR \`${c.name}\` ${c.action}${c.file ? `   [${c.file}]` : ''}`;
  if (c.kind === 'import') return `IMPORT ${c.what} \`${c.name}\` from ${c.file}`;
  if (c.kind === 'set') return `SET ${c.what} \`${c.name}\`.${c.prop} ${c.from} → ${c.to}${c.file ? `   [${c.file}]` : ''}`;
  return JSON.stringify(c);
}
function load() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(list)); } catch { /* quota */ }
}
