// Unified input: WASD + pointer-lock mouse on desktop; virtual joystick +
// drag-look + jump button on touch. Emits an abstract state the player reads.
export class Input {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.move = { x: 0, y: 0 }; // strafe, forward (-1..1)
    this.lookDelta = { x: 0, y: 0 };
    this.jump = false;
    this.interactPressed = false;
    this.zoomDelta = 0; // +out, -in
    this.enabled = true;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.keys = new Set();
    this._pointerLocked = false;

    if (!this.isTouch) document.body.classList.add('no-touch');

    // ---- keyboard ----
    addEventListener('keydown', (e) => {
      this.keys.add(e.code); // before the repeat guard: held keys must survive setEnabled cycles
      if (e.repeat) return;
      if (!this.enabled) return;
      if (e.code === 'KeyE' || e.code === 'Enter') this.interactPressed = true;
      if (e.code === 'Space') { this.jump = true; e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // ---- mouse look (pointer lock) ----
    canvas.addEventListener('click', () => {
      if (!this.isTouch && this.enabled && !this._pointerLocked) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this._pointerLocked = document.pointerLockElement === canvas;
    });
    // drag-look fallback: pointer lock is not available everywhere (embedded
    // browsers, iframes) — a held left-drag on the canvas must always rotate
    this._mouseDrag = false;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.isTouch && e.button === 0) this._mouseDrag = true;
    });
    addEventListener('mouseup', () => { this._mouseDrag = false; });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this._pointerLocked) {
        this.lookDelta.x += e.movementX * 0.0024;
        this.lookDelta.y += e.movementY * 0.0022;
      } else if (this._mouseDrag) {
        this.lookDelta.x += e.movementX * 0.0032;
        this.lookDelta.y += e.movementY * 0.003;
      }
    });
    addEventListener('wheel', (e) => {
      // only when the wheel is over the 3D canvas — not scrollable overlays
      if (this.enabled && e.target === canvas) this.zoomDelta += e.deltaY > 0 ? 1 : -1;
    }, { passive: true });

    // ---- touch: joystick + look + jump + pinch ----
    this.joyEl = document.createElement('div');
    this.joyEl.id = 'joystick';
    this.joyEl.innerHTML = '<div class="nub"></div>';
    uiRoot.appendChild(this.joyEl);
    this.nub = this.joyEl.querySelector('.nub');

    this.jumpEl = document.createElement('button');
    this.jumpEl.id = 'touch-jump';
    this.jumpEl.textContent = '↥';
    uiRoot.appendChild(this.jumpEl);
    this.jumpEl.addEventListener('touchstart', (e) => { e.preventDefault(); this.jump = true; this._jumpTouchHeld = true; });
    this.jumpEl.addEventListener('touchend', () => { this._jumpTouchHeld = false; });
    this.jumpEl.addEventListener('touchcancel', () => { this._jumpTouchHeld = false; });

    this._joyTouch = null;
    this._lookTouch = null;
    this._pinchDist = 0;

    this.joyEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._joyTouch === null) this._joyTouch = e.changedTouches[0].identifier;
      this._joyMove(e);
    });
    this.joyEl.addEventListener('touchmove', (e) => { e.preventDefault(); this._joyMove(e); });
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyTouch) {
          this._joyTouch = null;
          this.move.x = 0; this.move.y = 0;
          this.nub.style.transform = 'translate(-50%,-50%)';
        }
      }
    };
    this.joyEl.addEventListener('touchend', joyEnd);
    this.joyEl.addEventListener('touchcancel', joyEnd);

    // NOTE: pinch detection must use targetTouches (touches that started on
    // the canvas) — e.touches includes the joystick finger, which would make
    // move+look read as a pinch.
    canvas.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      if (e.targetTouches.length === 2) {
        this._pinchDist = this._dist(e.targetTouches[0], e.targetTouches[1]);
        this._lookTouch = null;
        return;
      }
      const t = e.changedTouches[0];
      if (this._lookTouch === null) {
        this._lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY, moved: 0 };
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      if (e.targetTouches.length === 2 && this._pinchDist) {
        const d = this._dist(e.targetTouches[0], e.targetTouches[1]);
        const delta = d - this._pinchDist;
        if (Math.abs(delta) > 24) {
          this.zoomDelta += delta > 0 ? -1 : 1; // spread = zoom in
          this._pinchDist = d;
        }
        return;
      }
      for (const t of e.changedTouches) {
        if (this._lookTouch && t.identifier === this._lookTouch.id) {
          const dx = t.clientX - this._lookTouch.x;
          const dy = t.clientY - this._lookTouch.y;
          this._lookTouch.x = t.clientX; this._lookTouch.y = t.clientY;
          this._lookTouch.moved += Math.abs(dx) + Math.abs(dy);
          this.lookDelta.x += dx * 0.0052;
          this.lookDelta.y += dy * 0.0048;
        }
      }
    }, { passive: true });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (this._lookTouch && t.identifier === this._lookTouch.id) {
          // a light tap (no drag) = interact
          if (this._lookTouch.moved < 12) this.interactPressed = true;
          this._lookTouch = null;
        }
      }
      if (e.targetTouches.length < 2) this._pinchDist = 0;
    };
    canvas.addEventListener('touchend', lookEnd);
    canvas.addEventListener('touchcancel', lookEnd);
  }

  _dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

  _joyMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== this._joyTouch) continue;
      const r = this.joyEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      const dead = 0.16;
      this.move.x = Math.abs(dx) < dead ? 0 : dx;
      this.move.y = Math.abs(dy) < dead ? 0 : -dy;
      this.nub.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
    }
  }

  // UI-injected interact edge (the HUD prompt pill calls this on click/tap so
  // desktop mouse users are not keyboard-only). Behaves exactly like a KeyE
  // press: one-frame edge, consumed by poll(), cancelled by clearEdges().
  injectInteract() {
    if (this.enabled) this.interactPressed = true;
  }

  // clear one-shot edges (called by dialogs so their dismissal keypress/tap
  // does not re-trigger an interact or jump on the next frame)
  clearEdges() {
    this.interactPressed = false;
    this.jump = false;
  }

  // poll once per frame
  poll() {
    // disabled = the game is not driving: cutscenes, and the world editor while
    // its panel owns the mouse and keyboard. Held keys must not keep walking
    // the player through those.
    if (!this.enabled) {
      this.lookDelta.x = 0; this.lookDelta.y = 0;
      this.jump = false; this.interactPressed = false; this.zoomDelta = 0;
      return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, jump: false, jumpHeld: false, interact: false, zoom: 0 };
    }
    // keyboard always contributes (touch-primary hybrids can have keyboards);
    // the joystick wins whenever it is deflected
    const kf = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const ks = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const joyActive = this.isTouch && (this.move.x !== 0 || this.move.y !== 0) && this._joyTouch !== null;
    const mx = joyActive ? this.move.x : ks;
    const my = joyActive ? this.move.y : kf;
    if (!this.isTouch) { this.move.x = ks; this.move.y = kf; }
    const out = {
      move: { x: mx, y: my },
      look: { ...this.lookDelta },
      jump: this.jump,
      jumpHeld: this.keys.has('Space') || !!this._jumpTouchHeld,
      interact: this.interactPressed,
      zoom: this.zoomDelta,
    };
    this.lookDelta.x = 0; this.lookDelta.y = 0;
    this.jump = false;
    this.interactPressed = false;
    this.zoomDelta = 0;
    return out;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.move.x = 0; this.move.y = 0;
      if (this._pointerLocked) document.exitPointerLock?.();
    }
    this.joyEl.style.display = on && this.isTouch ? '' : 'none';
    this.jumpEl.style.display = on && this.isTouch ? '' : 'none';
  }
}
