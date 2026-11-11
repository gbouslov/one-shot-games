// Frame loop shape follows starters/fps-three/src/kit/core/engine.js, itself
// derived from mshumer/Claude-of-Duty src/core/engine.js (MIT). See NOTICES.md.
import * as THREE from 'three';
import { Registry, EventBus } from './registry.js';
import { Rng } from './rng.js';

/**
 * The Engine owns the frame loop and the context handed to every system. It
 * sequences systems; it does not know what any of them does.
 *
 * Frame order:  update(dt) for every system, lateUpdate(dt), then render.
 * dt is real time clamped to 0.1 s, so a slow machine slows the game instead
 * of skipping it. Systems that need a fixed step (the defense simulation)
 * accumulate dt themselves.
 */
export class Engine {
  constructor({ canvas, config }) {
    this.canvas = canvas;
    this.config = config;
    this.registry = new Registry();
    this.events = new EventBus();
    this.rng = new Rng(config.deterministic ? 0x5eed1234 : (config.seed ?? Math.random() * 2 ** 32) >>> 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(config.fov, 16 / 9, 0.5, 600);
    /** The render kit draws a second scene on top (held items in fps-three). Kept, empty by default. */
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(50, 16 / 9, 0.01, 10);

    this.time = { elapsed: 0, raw: 0, dt: 0, frame: 0 };
    this.ctx = {
      engine: this,
      scene: this.scene,
      camera: this.camera,
      viewScene: this.viewScene,
      viewCamera: this.viewCamera,
      canvas,
      config,
      events: this.events,
      time: this.time,
      rng: this.rng,
      get: (id) => this.registry.get(id),
      peek: (id) => this.registry.peek(id),
      has: (id) => this.registry.has(id),
    };
    this._last = 0;
    this._running = false;
    this._onResize = () => this.resize();
  }

  add(SystemClass, opts) {
    this.registry.add(new SystemClass(opts));
    return this;
  }

  async init() {
    for (const sys of this.registry.resolve()) await sys.init?.(this.ctx);
    addEventListener('resize', this._onResize);
    this.resize();
    return this;
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || innerHeight);
    for (const cam of [this.camera, this.viewCamera]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    for (const sys of this.registry.with('resize')) sys.resize(w, h, this.ctx);
    this.events.emit('resize', { width: w, height: h });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  stop() {
    this._running = false;
  }

  _loop(now) {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    this.step(now);
  }

  /** Advance one frame. `fixedDt` makes the frame an exact slice of game time (capture, recording). */
  step(now = performance.now(), fixedDt = null) {
    const t = this.time;
    const dt = fixedDt ?? Math.min(0.1, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    t.raw += dt;
    t.dt = dt;
    t.elapsed += dt;
    t.frame++;
    for (const sys of this.registry.with('update')) sys.update(dt, this.ctx);
    for (const sys of this.registry.with('lateUpdate')) sys.lateUpdate(dt, this.ctx);
    this.registry.peek('render')?.render(this.ctx);
  }
}
