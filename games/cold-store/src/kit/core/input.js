// Derived from mshumer/Claude-of-Duty src/core/input.js (MIT). See third_party/NOTICES.md.
// Added here: drag-to-look when pointer lock is refused, touch controls, fire key.

/**
 * Keyboard, mouse and touch, exposed as a per-frame snapshot so gameplay never
 * touches raw DOM events.
 *
 * Look has two modes:
 *   lock  normal pointer lock, the mouse aims
 *   drag  entered automatically when the browser or embedding page refuses the
 *         lock (sandboxed iframes, some artifact hosts). Drag to look, a quick
 *         click fires once, right button or F holds the trigger.
 */

export const ACTIONS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  crouch: ['ControlLeft', 'KeyC'],
  sprint: ['ShiftLeft'],
  reload: ['KeyR'],
  use: ['KeyE'],
  melee: ['KeyV'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  nextWeapon: ['KeyQ'],
};

const DRAG_START_PX = 5;
const TAP_MS = 280;

export class Input {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;

    this.down = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this._pendingDown = new Set();
    this._pendingUp = new Set();

    this.look = { x: 0, y: 0 };
    this._rawLook = { x: 0, y: 0 };
    this.wheel = 0;
    this._pendingWheel = 0;

    this.pointerLocked = false;
    this.lockEverWorked = false;
    this.mode = config.forceDrag ? 'drag' : 'lock';
    this.enabled = true;
    /** Set by capture mode so scripted shots are not fought by real input. */
    this.frozen = false;
    /** When false, gameplay input is ignored (title and end screens). */
    this.captureGameplay = false;

    this.stick = { moveX: 0, moveY: 0 };
    this._touch = { moveId: null, lookId: null, mx: 0, my: 0, lx: 0, ly: 0 };
    this._drag = { active: false, moved: false, x: 0, y: 0, t: 0 };

    this._bound = {
      keydown: this._onKeyDown.bind(this),
      keyup: this._onKeyUp.bind(this),
      mousedown: this._onMouseDown.bind(this),
      mouseup: this._onMouseUp.bind(this),
      mousemove: this._onMouseMove.bind(this),
      wheel: this._onWheel.bind(this),
      lockchange: this._onLockChange.bind(this),
      lockerror: this._onLockError.bind(this),
      blur: this._onBlur.bind(this),
      touchstart: this._onTouchStart.bind(this),
      touchmove: this._onTouchMove.bind(this),
      touchend: this._onTouchEnd.bind(this),
      contextmenu: (e) => e.preventDefault(),
    };
  }

  attach() {
    const b = this._bound;
    addEventListener('keydown', b.keydown);
    addEventListener('keyup', b.keyup);
    addEventListener('mousedown', b.mousedown);
    addEventListener('mouseup', b.mouseup);
    addEventListener('mousemove', b.mousemove);
    addEventListener('wheel', b.wheel, { passive: true });
    addEventListener('blur', b.blur);
    document.addEventListener('pointerlockchange', b.lockchange);
    document.addEventListener('pointerlockerror', b.lockerror);
    this.canvas.addEventListener('contextmenu', b.contextmenu);
    this.canvas.addEventListener('touchstart', b.touchstart, { passive: false });
    this.canvas.addEventListener('touchmove', b.touchmove, { passive: false });
    this.canvas.addEventListener('touchend', b.touchend);
    this.canvas.addEventListener('touchcancel', b.touchend);
  }

  detach() {
    const b = this._bound;
    removeEventListener('keydown', b.keydown);
    removeEventListener('keyup', b.keyup);
    removeEventListener('mousedown', b.mousedown);
    removeEventListener('mouseup', b.mouseup);
    removeEventListener('mousemove', b.mousemove);
    removeEventListener('wheel', b.wheel);
    removeEventListener('blur', b.blur);
    document.removeEventListener('pointerlockchange', b.lockchange);
    document.removeEventListener('pointerlockerror', b.lockerror);
    this.canvas.removeEventListener('contextmenu', b.contextmenu);
    this.canvas.removeEventListener('touchstart', b.touchstart);
    this.canvas.removeEventListener('touchmove', b.touchmove);
    this.canvas.removeEventListener('touchend', b.touchend);
    this.canvas.removeEventListener('touchcancel', b.touchend);
  }

  requestPointerLock() {
    if (this.mode === 'drag') return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => this._onLockError());
      else if (!this.canvas.requestPointerLock) this._onLockError();
    } catch {
      this._onLockError();
    }
  }

  /** A refusal after a successful lock is only Chrome's re-lock cooldown. */
  _onLockError() {
    if (!this.lockEverWorked) this.mode = 'drag';
  }

  _onLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) this.lockEverWorked = true;
    else this._onBlur();
  }

  _onKeyDown(e) {
    if (!this.enabled || e.repeat) return;
    if (!e.metaKey && !e.ctrlKey && e.code !== 'F12' && e.code !== 'F5') e.preventDefault();
    this._pendingDown.add(e.code);
  }

  _onKeyUp(e) {
    if (this.enabled) this._pendingUp.add(e.code);
  }

  _onMouseDown(e) {
    if (!this.enabled || !this.captureGameplay) return;
    if (this.mode === 'lock') {
      if (!this.pointerLocked && e.button === 0 && this.captureGameplay) this.requestPointerLock();
      this._pendingDown.add(`Mouse${e.button}`);
      return;
    }
    if (e.button === 0) {
      this._drag = { active: true, moved: false, x: e.clientX, y: e.clientY, t: performance.now() };
    } else {
      this._pendingDown.add(`Mouse${e.button}`);
    }
  }

  _onMouseUp(e) {
    if (!this.enabled) return;
    if (this.mode === 'lock' || e.button !== 0) {
      this._pendingUp.add(`Mouse${e.button}`);
      return;
    }
    if (this._drag.active && !this._drag.moved && performance.now() - this._drag.t < TAP_MS) {
      this._pendingDown.add('Mouse0');
      this._pendingUp.add('Mouse0');
    }
    this._drag.active = false;
  }

  _onMouseMove(e) {
    if (!this.enabled || this.frozen) return;
    if (this.mode === 'lock') {
      if (!this.pointerLocked) return;
      this._rawLook.x += e.movementX ?? 0;
      this._rawLook.y += e.movementY ?? 0;
      return;
    }
    const d = this._drag;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    const scale = this.config.dragSensitivity / this.config.sensitivity;
    this._rawLook.x += dx * scale;
    this._rawLook.y += dy * scale;
  }

  _onWheel(e) {
    if (this.enabled) this._pendingWheel += Math.sign(e.deltaY);
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t = this._touch;
    for (const c of e.changedTouches) {
      if (c.clientX < innerWidth * 0.42 && t.moveId === null) {
        t.moveId = c.identifier;
        t.mx = c.clientX;
        t.my = c.clientY;
      } else if (t.lookId === null) {
        t.lookId = c.identifier;
        t.lx = c.clientX;
        t.ly = c.clientY;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    const t = this._touch;
    const scale = this.config.dragSensitivity / this.config.sensitivity;
    for (const c of e.changedTouches) {
      if (c.identifier === t.moveId) {
        this.stick.moveX = Math.max(-1, Math.min(1, (c.clientX - t.mx) / 56));
        this.stick.moveY = Math.max(-1, Math.min(1, (c.clientY - t.my) / 56));
      } else if (c.identifier === t.lookId) {
        this._rawLook.x += (c.clientX - t.lx) * scale;
        this._rawLook.y += (c.clientY - t.ly) * scale;
        t.lx = c.clientX;
        t.ly = c.clientY;
      }
    }
  }

  _onTouchEnd(e) {
    const t = this._touch;
    for (const c of e.changedTouches) {
      if (c.identifier === t.moveId) {
        t.moveId = null;
        this.stick.moveX = this.stick.moveY = 0;
      } else if (c.identifier === t.lookId) {
        t.lookId = null;
      }
    }
  }

  /** On-screen buttons (touch) press codes through here. */
  virtual(code, isDown) {
    (isDown ? this._pendingDown : this._pendingUp).add(code);
  }

  /** Losing focus must release every held key, or the player runs forever. */
  _onBlur() {
    for (const code of this.down) this._pendingUp.add(code);
    this._rawLook.x = 0;
    this._rawLook.y = 0;
    this._drag.active = false;
  }

  beginFrame() {
    this._pressed.clear();
    this._released.clear();
    for (const code of this._pendingDown) {
      if (!this.down.has(code)) {
        this.down.add(code);
        this._pressed.add(code);
      }
    }
    for (const code of this._pendingUp) {
      if (this.down.delete(code)) this._released.add(code);
    }
    this._pendingDown.clear();
    this._pendingUp.clear();

    const s = this.config.sensitivity;
    this.look.x = this.frozen ? 0 : this._rawLook.x * s;
    this.look.y = this.frozen ? 0 : this._rawLook.y * s * (this.config.invertY ? -1 : 1);
    this._rawLook.x = 0;
    this._rawLook.y = 0;

    this.wheel = this._pendingWheel;
    this._pendingWheel = 0;
  }

  action(name) {
    const codes = ACTIONS[name];
    return !!codes && codes.some((c) => this.down.has(c));
  }

  actionPressed(name) {
    const codes = ACTIONS[name];
    return !!codes && codes.some((c) => this._pressed.has(c));
  }

  held(code) {
    return this.down.has(code);
  }

  pressed(code) {
    return this._pressed.has(code);
  }

  released(code) {
    return this._released.has(code);
  }

  get fire() {
    return this.down.has('Mouse0') || this.down.has('KeyF') || (this.mode === 'drag' && this.down.has('Mouse2'));
  }

  get firePressed() {
    return this._pressed.has('Mouse0') || this._pressed.has('KeyF') || (this.mode === 'drag' && this._pressed.has('Mouse2'));
  }

  get aim() {
    return this.mode === 'lock' && this.down.has('Mouse2');
  }

  /** Normalised movement, clamped so diagonals are no faster than cardinals. */
  moveVector(out = { x: 0, y: 0 }) {
    let x = (this.action('right') ? 1 : 0) - (this.action('left') ? 1 : 0);
    let y = (this.action('forward') ? 1 : 0) - (this.action('back') ? 1 : 0);
    x += this.stick.moveX;
    y -= this.stick.moveY;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    out.x = x;
    out.y = y;
    return out;
  }
}
