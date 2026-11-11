/**
 * One control map for every device. The keyboard, touch swipes and the
 * autoplay bot all write the same key codes into it, each as its own source;
 * the runner reads only the map and cannot tell who is playing. That is what
 * lets the playtest bot prove the keyboard path works.
 *
 *   controls.press('ArrowLeft', 1, 'bot')    hold a control from a source
 *   controls.release('ArrowLeft', 'bot')
 *   controls.value('ArrowLeft')              0..1, the strongest source wins
 *   controls.take('ArrowLeft', 'KeyA')       presses since the last take (edges), then cleared
 *   controls.onKey(fn)                       one-shot key presses (mute, start)
 *
 * A runner acts on presses, not holds: a key tapped and released between two
 * slow frames (software WebGL draws 2 to 10 a second) still counts, because
 * every rising edge is counted when it happens and taken by the next step.
 *
 * Touch: a swipe left / right / up / down anywhere writes a tap of
 * ArrowLeft / ArrowRight / ArrowUp / ArrowDown as the 'touch' source; a quick
 * tap without movement writes ArrowUp (jump). Thresholds after
 * omsingh02/bunny's InputController (MIT): 50 px, the longer axis wins.
 *
 * Adapted from starters/space-shooter/src/kit/rail/controls.js.
 */
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Map(); // code -> { key, touch, bot }
    this.edges = new Map(); // code -> presses not yet taken
    this.listeners = new Set();
    this.frozen = false;
    this.mode = 'keyboard';
    this.touchUsed = false;
    this.swipes = 0;
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
    if (/^(Arrow|Space|Key[WASD])/.test(code)) e.preventDefault();
    if (down && !e.repeat) {
      this.mode = 'keyboard';
      for (const fn of this.listeners) fn(code, e);
    }
    if (down) {
      if (!e.repeat) this.press(code, 1, 'key');
    } else this.release(code, 'key');
  }

  _raw(code) {
    const s = this.held.get(code);
    if (!s) return 0;
    let v = 0;
    for (const k in s) v = Math.max(v, s[k]);
    return v;
  }

  press(code, value = 1, source = 'key') {
    const before = this._raw(code);
    let s = this.held.get(code);
    if (!s) this.held.set(code, (s = {}));
    s[source] = Math.max(0, Math.min(1, value));
    if (before === 0 && s[source] > 0) this.edges.set(code, (this.edges.get(code) ?? 0) + 1);
  }

  release(code, source = 'key') {
    const s = this.held.get(code);
    if (s) delete s[source];
  }

  /** press + release: one edge, nothing left held. */
  tap(code, source) {
    this.press(code, 1, source);
    this.release(code, source);
  }

  clearSource(source) {
    for (const s of this.held.values()) delete s[source];
  }

  clearEdges() {
    this.edges.clear();
  }

  value(code) {
    if (this.frozen) return 0;
    return this._raw(code);
  }

  any(...codes) {
    let v = 0;
    for (const c of codes) v = Math.max(v, this.value(c));
    return v;
  }

  /** Presses of any of these codes since the last take; clears them. */
  take(...codes) {
    let n = 0;
    for (const c of codes) {
      n += this.edges.get(c) ?? 0;
      this.edges.delete(c);
    }
    return this.frozen ? 0 : n;
  }

  /**
   * Swipes anywhere on `root`'s page. Writes taps of the arrow codes as the
   * 'touch' source. `isLive()` says whether a swipe should count (the round is
   * playing); outside it touches fall through to the screens.
   */
  installTouch(root, { isLive = () => true, min = 50, tapMs = 180, tapPx = 14 } = {}) {
    let t0 = null;
    const showTouch = () => {
      this.touchUsed = true;
      this.mode = 'touch';
      document.body.classList.add('touch');
    };
    const hint = document.createElement('div');
    hint.id = 'swipe-hint';
    hint.innerHTML = '<span>Swipe</span><i class="l"></i><i class="r"></i><i class="u"></i><i class="d"></i>';
    root.appendChild(hint);
    addEventListener('touchstart', (e) => {
      showTouch();
      if (!isLive()) return;
      const t = e.changedTouches[0];
      t0 = { id: t.identifier, x: t.clientX, y: t.clientY, at: performance.now(), fired: false };
    }, { passive: true });
    const fire = (dx, dy) => {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) < min) return false;
        this.tap(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 'touch');
      } else {
        if (Math.abs(dy) < min) return false;
        this.tap(dy < 0 ? 'ArrowUp' : 'ArrowDown', 'touch');
      }
      this.swipes++;
      return true;
    };
    // A swipe fires as soon as it passes the threshold, not on lift: a runner cannot wait.
    addEventListener('touchmove', (e) => {
      if (!t0 || t0.fired) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== t0.id) continue;
        if (fire(t.clientX - t0.x, t.clientY - t0.y)) t0.fired = true;
      }
      if (isLive()) e.preventDefault();
    }, { passive: false });
    addEventListener('touchend', (e) => {
      if (!t0) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== t0.id) continue;
        const dx = t.clientX - t0.x;
        const dy = t.clientY - t0.y;
        if (!t0.fired && isLive()) {
          if (!fire(dx, dy) && Math.hypot(dx, dy) < tapPx && performance.now() - t0.at < tapMs) this.tap('ArrowUp', 'touch');
        }
        t0 = null;
      }
    });
    addEventListener('touchcancel', () => { t0 = null; });
  }
}
