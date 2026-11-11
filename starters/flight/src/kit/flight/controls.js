/**
 * One control map for every device. The keyboard, the on-screen touch stick
 * and the autoplay bot all write the same key codes into it, each as its own
 * source; the flight model reads only `value(code)` and cannot tell who is
 * flying. That is what lets the playtest bot prove the keyboard path works.
 *
 *   controls.press('KeyS', 0.6, 'bot')   hold a control at 60 % from a source
 *   controls.release('KeyS', 'bot')
 *   controls.value('KeyS')               0..1, the strongest source wins
 *   controls.axis('KeyS', 'KeyW')        -1..1
 *   controls.onKey(fn)                   one-shot key presses (mute, start)
 *
 * Written for this repository. The touch stick follows the floating-stick
 * pattern: it appears where the thumb lands in the left half of the screen.
 */
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Map(); // code -> { key, touch, bot }
    this.listeners = new Set();
    this.frozen = false;
    this.mode = 'keyboard';
    this.touchUsed = false;
    this._kd = (e) => this._key(e, true);
    this._ku = (e) => this._key(e, false);
    this._blur = () => this.clearSource('key');
  }

  attach() {
    addEventListener('keydown', this._kd);
    addEventListener('keyup', this._ku);
    addEventListener('blur', this._blur);
  }

  detach() {
    removeEventListener('keydown', this._kd);
    removeEventListener('keyup', this._ku);
    removeEventListener('blur', this._blur);
  }

  beginFrame() {}

  onKey(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _key(e, down) {
    const code = e.code || e.key;
    if (/^(Arrow|Space|Shift|Key[WASDQERF])/.test(code)) e.preventDefault();
    if (down && !e.repeat) {
      this.mode = 'keyboard';
      for (const fn of this.listeners) fn(code, e);
    }
    if (down) this.press(code, 1, 'key');
    else this.release(code, 'key');
  }

  press(code, value = 1, source = 'key') {
    let s = this.held.get(code);
    if (!s) this.held.set(code, (s = {}));
    s[source] = Math.max(0, Math.min(1, value));
  }

  release(code, source = 'key') {
    const s = this.held.get(code);
    if (s) delete s[source];
  }

  clearSource(source) {
    for (const s of this.held.values()) delete s[source];
  }

  value(code) {
    if (this.frozen) return 0;
    const s = this.held.get(code);
    if (!s) return 0;
    let v = 0;
    for (const k in s) v = Math.max(v, s[k]);
    return v;
  }

  /** Strongest of several codes (e.g. two keys bound to one action). */
  any(...codes) {
    let v = 0;
    for (const c of codes) v = Math.max(v, this.value(c));
    return v;
  }

  axis(pos, neg) {
    return this.value(pos) - this.value(neg);
  }

  /**
   * On-screen controls: a floating stick in the left half (drag right to roll
   * right, drag down to pull the nose up) and throttle buttons on the right.
   * Each writes the same key codes the keyboard does, as the 'touch' source.
   */
  installTouch(root, { roll = ['KeyD', 'KeyA'], pitch = ['KeyS', 'KeyW'], up = 'KeyR', down = 'KeyF', radius = 56 } = {}) {
    const zone = document.createElement('div');
    zone.id = 'stick-zone';
    const base = document.createElement('div');
    base.className = 'stick-base';
    const knob = document.createElement('div');
    knob.className = 'stick-knob';
    base.appendChild(knob);
    zone.appendChild(base);
    const pad = document.createElement('div');
    pad.id = 'throttle-pad';
    pad.innerHTML = '<button data-c="up" aria-label="Throttle up">+</button><span>THR</span><button data-c="down" aria-label="Throttle down">−</button>';
    root.append(zone, pad);

    let id = null;
    let ox = 0;
    let oy = 0;
    const set = (dx, dy) => {
      const rx = Math.max(-1, Math.min(1, dx / radius));
      const ry = Math.max(-1, Math.min(1, dy / radius));
      this.press(roll[0], Math.max(0, rx), 'touch');
      this.press(roll[1], Math.max(0, -rx), 'touch');
      this.press(pitch[0], Math.max(0, ry), 'touch');
      this.press(pitch[1], Math.max(0, -ry), 'touch');
      knob.style.transform = `translate(${rx * radius * 0.7}px, ${ry * radius * 0.7}px)`;
    };
    const showTouch = () => {
      this.touchUsed = true;
      this.mode = 'touch';
      document.body.classList.add('touch');
    };
    addEventListener('touchstart', showTouch, { passive: true });
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showTouch();
      const t = e.changedTouches[0];
      id = t.identifier;
      ox = t.clientX;
      oy = t.clientY;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      base.classList.add('on');
      set(0, 0);
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) set(t.clientX - ox, t.clientY - oy);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        id = null;
        base.classList.remove('on');
        for (const c of [...roll, ...pitch]) this.release(c, 'touch');
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

    for (const b of pad.querySelectorAll('button')) {
      const code = b.dataset.c === 'up' ? up : down;
      const on = (e) => { e.preventDefault(); showTouch(); this.press(code, 1, 'touch'); b.classList.add('on'); };
      const off = () => { this.release(code, 'touch'); b.classList.remove('on'); };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off);
      b.addEventListener('touchcancel', off);
      b.addEventListener('mousedown', on);
      b.addEventListener('mouseup', off);
      b.addEventListener('mouseleave', off);
    }
  }
}
