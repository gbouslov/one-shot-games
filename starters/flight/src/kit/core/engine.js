// Adapted from starters/fps-three/src/kit/core/engine.js, itself derived from
// mshumer/Claude-of-Duty src/core/engine.js (MIT). See NOTICES.md.
import * as THREE from 'three';
import { Registry, EventBus } from './registry.js';
import { FIXED_DT, MAX_SUBSTEPS } from './config.js';
import { Controls } from '../flight/controls.js';
import { Rng } from './rng.js';

/**
 * The Engine owns the frame loop and the context handed to every system. It
 * does not know what any system does; it only sequences them.
 *
 * Frame order:
 *   1. controls.beginFrame()
 *   2. beginFrame(dt)             the bot and anything else that writes controls
 *   3. fixedUpdate(FIXED_DT) xN   flight model, gates, crashes, clock
 *   4. update(dt)                 animation, particles, HUD
 *   5. lateUpdate(dt)             camera, anything that reads final transforms
 *   6. render system draws (skipped while fast-forwarding)
 *
 * Game time is the wall clock clamped to 0.1 s a frame, so a software-WebGL
 * browser drawing 3 fps still runs the clock at a third of real time instead
 * of stalling, and never jumps more than 0.1 s.
 */
export class Engine {
  constructor({ canvas, config }) {
    this.canvas = canvas;
    this.config = config;
    this.registry = new Registry();
    this.events = new EventBus();
    this.input = new Controls(canvas);
    this.rng = new Rng(config.deterministic ? 0x5eed1234 : (config.seed ?? (Math.random() * 2 ** 32)) >>> 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(config.fov ?? 60, 1, config.near ?? 0.5, config.far ?? 20000);

    /** Overlay scene (kept for parity with fps-three's render pass; empty here). */
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 12);

    this.time = { elapsed: 0, raw: 0, dt: 0, fixed: FIXED_DT, alpha: 0, scale: 1, frame: 0 };
    this.skipRender = false;

    this.ctx = {
      engine: this,
      scene: this.scene,
      camera: this.camera,
      viewScene: this.viewScene,
      viewCamera: this.viewCamera,
      canvas,
      config,
      events: this.events,
      input: this.input,
      time: this.time,
      rng: this.rng,
      get: (id) => this.registry.get(id),
      peek: (id) => this.registry.peek(id),
      has: (id) => this.registry.has(id),
    };

    this._accum = 0;
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
    this.input.attach();
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

  /**
   * Advance one frame. `fixedDt` makes the frame a constant slice of game time
   * (lockstep captures, the recorder, fastForward).
   */
  step(now = performance.now(), fixedDt = null) {
    const t = this.time;
    const rawDt = fixedDt ?? Math.min(0.1, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    t.raw += rawDt;
    t.dt = rawDt * t.scale;
    t.elapsed += t.dt;
    t.frame++;

    this.input.beginFrame();
    for (const sys of this.registry.with('beginFrame')) sys.beginFrame(t.dt, this.ctx);

    this._accum += t.dt;
    let steps = 0;
    const fixedSystems = this.registry.with('fixedUpdate');
    while (this._accum >= FIXED_DT - 1e-9 && steps < MAX_SUBSTEPS) {
      for (const sys of fixedSystems) sys.fixedUpdate(FIXED_DT, this.ctx);
      this._accum -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this._accum = 0; // shed backlog rather than spiral
    t.alpha = Math.max(0, this._accum) / FIXED_DT;

    for (const sys of this.registry.with('update')) sys.update(t.dt, this.ctx);
    for (const sys of this.registry.with('lateUpdate')) sys.lateUpdate(t.dt, this.ctx);

    if (!this.skipRender) this.registry.peek('render')?.render(this.ctx);
  }

  /** Simulate `seconds` of game time without drawing. */
  fastForward(seconds, fps = 30) {
    this.skipRender = true;
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) this.step(performance.now(), 1 / fps);
    this.skipRender = false;
  }

  dispose() {
    this.stop();
    removeEventListener('resize', this._onResize);
    this.input.detach();
    for (const sys of [...this.registry.ordered].reverse()) sys.dispose?.();
    this.events.clear();
  }
}
