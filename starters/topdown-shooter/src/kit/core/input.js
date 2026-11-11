/**
 * Twin-stick input: keyboard, mouse and touch, read once per frame.
 *
 * Gameplay never touches DOM events. It reads:
 *   input.move          {x, y} in screen space, -1..1 (y up is negative, like the screen)
 *   input.pointer       {x, y} mouse position in CSS pixels, or null before the mouse moves
 *   input.aimStick      {x, y} right touch stick, or null when the stick is idle
 *   input.aimWorld      [x, z] a world point to aim at, set by the bot (wins over the mouse)
 *   input.fire          trigger held (left mouse, F, the right stick past half way)
 *   input.held(action)  any binding of an action is down
 *   input.pressed(action) went down this frame
 *
 * The touch overlay (two floating sticks, three buttons) follows the twin-stick
 * overlay in xMPon/undead-protocol src/core/Touch.ts (MIT): a floating stick
 * planted where the thumb lands, a deadzone rescaled so the first movement is not
 * a jump, and buttons that never start the stick underneath them.
 *
 * Every source ends in the same place: keys go through `down`, so the bot that
 * plays a round presses the same virtual keys a person does (see `virtual`).
 */

export const ACTIONS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Mouse0', 'KeyF'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  swap: ['KeyQ', 'Mouse2'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
};

const STICK_RADIUS = 58;
const DEADZONE = 0.14;
/** The right stick fires once pushed this far, so aiming and shooting are one thumb. */
const FIRE_AT = 0.45;

export function stickVector(dx, dy, radius = STICK_RADIUS, deadzone = DEADZONE) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  const raw = Math.min(1, len / radius);
  if (raw <= deadzone) return { x: 0, y: 0 };
  const k = (raw - deadzone) / (1 - deadzone);
  return { x: (dx / len) * k, y: (dy / len) * k };
}

const TOUCH_CSS = `
#touch{position:fixed;inset:0;pointer-events:none;z-index:5}
#touch.off{display:none}
#touch .zone{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
#touch .zl{left:0;width:50%}#touch .zr{right:0;width:50%}
#touch .stick{position:absolute;width:116px;height:116px;margin:-58px 0 0 -58px;border-radius:50%;border:1.5px solid #ffffff38;background:radial-gradient(circle,#0000 52%,#00000040 53%);opacity:0;transition:opacity .12s}
#touch .stick.on{opacity:1}
#touch .knob{position:absolute;left:50%;top:50%;width:46px;height:46px;border-radius:50%;background:#ffffff30;border:1.5px solid #ffffff70;transform:translate(-50%,-50%)}
#touch .btn{position:absolute;width:58px;height:58px;border-radius:50%;border:1.5px solid #ffffff40;background:#0a0d1266;color:#ffffffd0;font:700 10px/58px var(--font,system-ui);letter-spacing:.12em;text-align:center;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none}
#touch .btn.on{background:#ffffff30}
#touch .b-dash{right:22px;bottom:118px}
#touch .b-reload{right:92px;bottom:150px}
#touch .b-swap{right:22px;top:20px;width:48px;height:48px;line-height:48px}
`;

export class Input {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.down = new Set();
    this._pressed = new Set();
    this._pending = new Set();

    this.move = { x: 0, y: 0 };
    this.pointer = null;
    this.aimStick = null;
    this.aimWorld = null;
    this.fire = false;
    /** 'mouse' or 'touch': which device spoke last. */
    this.mode = 'mouse';
    /** Capture mode freezes input so scripted shots are not fought. */
    this.frozen = false;
    /** False on the title and end screens: gameplay input is ignored. */
    this.captureGameplay = false;

    this._t = { move: null, aim: null, mo: { x: 0, y: 0 }, ao: { x: 0, y: 0 }, mv: { x: 0, y: 0 }, av: { x: 0, y: 0 } };

    this._bound = {
      keydown: (e) => this._key(e, true),
      keyup: (e) => this._key(e, false),
      mousedown: (e) => {
        this.mode = 'mouse';
        this._press(`Mouse${e.button}`);
      },
      mouseup: (e) => this._release(`Mouse${e.button}`),
      mousemove: (e) => {
        this.mode = 'mouse';
        this.pointer = { x: e.clientX, y: e.clientY };
      },
      blur: () => this.down.clear(),
      contextmenu: (e) => e.preventDefault(),
    };
  }

  attach() {
    const b = this._bound;
    addEventListener('keydown', b.keydown);
    addEventListener('keyup', b.keyup);
    this.canvas.addEventListener('mousedown', b.mousedown);
    addEventListener('mouseup', b.mouseup);
    addEventListener('mousemove', b.mousemove);
    addEventListener('blur', b.blur);
    addEventListener('contextmenu', b.contextmenu);
    this._mountTouch();
  }

  detach() {
    const b = this._bound;
    removeEventListener('keydown', b.keydown);
    removeEventListener('keyup', b.keyup);
    this.canvas.removeEventListener('mousedown', b.mousedown);
    removeEventListener('mouseup', b.mouseup);
    removeEventListener('mousemove', b.mousemove);
    removeEventListener('blur', b.blur);
    removeEventListener('contextmenu', b.contextmenu);
    this._touchRoot?.remove();
  }

  /** Kept for API parity with the first-person kit: top-down never locks the pointer. */
  requestPointerLock() {}

  _key(e, isDown) {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (isDown) this._press(e.code);
    else this._release(e.code);
  }

  _press(code) {
    if (!this.down.has(code)) this._pending.add(code);
    this.down.add(code);
  }

  _release(code) {
    this.down.delete(code);
  }

  /** Press or release a key from code: the touch buttons and the bot use this. */
  virtual(code, isDown) {
    if (isDown) this._press(code);
    else this._release(code);
  }

  held(action) {
    if (this.frozen || !this.captureGameplay) return false;
    for (const c of ACTIONS[action] ?? [action]) if (this.down.has(c)) return true;
    return false;
  }

  pressed(action) {
    if (this.frozen || !this.captureGameplay) return false;
    for (const c of ACTIONS[action] ?? [action]) if (this._pressed.has(c)) return true;
    return false;
  }

  beginFrame() {
    this._pressed = this._pending;
    this._pending = new Set();
    const live = !this.frozen && this.captureGameplay;

    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const t = this._t;
    if (live && t.move !== null) {
      x = t.mv.x;
      y = t.mv.y;
    }
    this.move.x = live ? x : 0;
    this.move.y = live ? y : 0;

    const stickLen = t.aim !== null ? Math.hypot(t.av.x, t.av.y) : 0;
    this.aimStick = live && stickLen > 0.05 ? { x: t.av.x / stickLen, y: t.av.y / stickLen } : null;
    this.fire = live && (this.held('fire') || stickLen >= FIRE_AT);
  }

  // ---------------------------------------------------------------- touch --
  _mountTouch() {
    const style = document.createElement('style');
    style.textContent = TOUCH_CSS;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'touch';
    root.className = 'off';
    root.innerHTML = `<div class="zone zl"></div><div class="zone zr"></div>
      <div class="stick sm"><div class="knob"></div></div><div class="stick sa"><div class="knob"></div></div>
      <div class="btn b-dash" data-c="Space">DASH</div><div class="btn b-reload" data-c="KeyR">RELOAD</div><div class="btn b-swap" data-c="KeyQ">SWAP</div>`;
    document.body.appendChild(root);
    this._touchRoot = root;
    const q = (s) => root.querySelector(s);
    const sticks = { move: [q('.sm'), q('.sm .knob')], aim: [q('.sa'), q('.sa .knob')] };
    const t = this._t;

    const start = (which) => (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      this.mode = 'touch';
      e.currentTarget.setPointerCapture?.(e.pointerId);
      t[which] = e.pointerId;
      const o = which === 'move' ? t.mo : t.ao;
      o.x = e.clientX;
      o.y = e.clientY;
      const [stick, knob] = sticks[which];
      stick.style.left = `${e.clientX}px`;
      stick.style.top = `${e.clientY}px`;
      stick.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    };
    const move = (e) => {
      for (const which of ['move', 'aim']) {
        if (e.pointerId !== t[which]) continue;
        e.preventDefault();
        const o = which === 'move' ? t.mo : t.ao;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        const v = stickVector(dx, dy);
        const out = which === 'move' ? t.mv : t.av;
        out.x = v.x;
        out.y = v.y;
        const len = Math.hypot(dx, dy);
        const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
        sticks[which][1].style.transform = `translate(calc(-50% + ${dx * k}px),calc(-50% + ${dy * k}px))`;
      }
    };
    const end = (e) => {
      for (const which of ['move', 'aim']) {
        if (e.pointerId !== t[which]) continue;
        t[which] = null;
        const out = which === 'move' ? t.mv : t.av;
        out.x = out.y = 0;
        sticks[which][0].classList.remove('on');
      }
    };
    for (const [sel, which] of [['.zl', 'move'], ['.zr', 'aim']]) {
      const z = q(sel);
      z.addEventListener('pointerdown', start(which));
      z.addEventListener('pointermove', move);
      z.addEventListener('pointerup', end);
      z.addEventListener('pointercancel', end);
    }
    root.querySelectorAll('.btn').forEach((b) => {
      const code = b.dataset.c;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.mode = 'touch';
        b.classList.add('on');
        this.virtual(code, true);
      });
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('on');
        this.virtual(code, false);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    // First touch anywhere switches the overlay on for good.
    addEventListener('touchstart', () => { this.mode = 'touch'; this.touchSeen = true; }, { passive: true });
  }

  /** The round shows the overlay only while playing, and only on a touch device. */
  showTouch(on) {
    const want = on && (this.touchSeen || matchMedia?.('(pointer: coarse)').matches);
    this._touchRoot?.classList.toggle('off', !want);
    if (!want) {
      const t = this._t;
      t.move = t.aim = null;
      t.mv.x = t.mv.y = t.av.x = t.av.y = 0;
    }
  }
}
