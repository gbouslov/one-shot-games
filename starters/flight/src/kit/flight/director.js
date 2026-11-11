import * as THREE from 'three';
import { ChaseCamera } from './chase-camera.js';
import { Particles, Trail } from '../fx/particles.js';

/**
 * Presentation for a flight round: puts the aircraft where the flight model
 * says, runs the chase camera, wingtip trails, gate bursts, crash spray and
 * smoke, the engine bed, warnings, the screens, and start / restart input.
 * It listens to the round's events and never changes the rules.
 *
 *   engine.add(DirectorSystem, { plane, world, course, text })
 *     plane:  Object3D with userData.tips (wingtip points) and userData.update(dt, throttle)
 *     world:  { sun, update(dt, time, camera, focus) } from src/game/world.js
 *     course: { group, update(dt, time, next), burst(i), reset() } from src/game/course.js
 *
 * Written for this repository.
 */
export class DirectorSystem {
  static id = 'director';
  static deps = ['round', 'hud', 'audio'];

  constructor(opts) {
    this.opts = opts;
  }

  init(ctx) {
    this.ctx = ctx;
  }

  /** Called by main.js once the world, course and plane exist. */
  setup({ plane, world, course, cameraOptions = {} }) {
    const ctx = this.ctx;
    const round = ctx.get('round');
    const hud = ctx.get('hud');
    const audio = ctx.get('audio');
    this.round = round;
    this.hud = hud;
    this.audio = audio;
    this.plane = plane;
    this.world = world;
    this.course = course;
    ctx.scene.add(plane, course.group);

    const q = ctx.config.q;
    this.sparks = new Particles({ max: Math.round(q.particles * 0.6), additive: true });
    this.smoke = new Particles({ max: Math.round(q.particles * 0.6), additive: false });
    ctx.scene.add(this.sparks.points, this.smoke.points);
    this.trails = plane.userData.tips.map(() => new Trail({ length: 40, maxLength: 50, width: 0.16, color: '#fff6ea', opacity: 0.4, nearFade: [16, 34] }));
    for (const t of this.trails) ctx.scene.add(t.mesh);

    this.cam = new ChaseCamera(ctx.camera, { maxSpeed: round.model.p.maxSpeed, fov: ctx.config.fov, ...cameraOptions });
    this.cam.ground = (x, z) => world.field.at(x, z);
    this.rng = ctx.rng.fork();
    this.rand = () => this.rng.float();
    this._tip = new THREE.Vector3();
    this._warnT = 0;
    this._lastGate = 0;
    this.time = 0;

    const ev = ctx.events;
    ev.on('round:start', () => {
      course.reset();
      this._lastGate = 0;
      this._resetVisuals();
      hud.show(null);
      audio.play('start');
    });
    ev.on('round:gate', ({ index, pos, last, total, attract }) => {
      course.burst(index);
      this.sparks.emit({ pos, count: 46, spread: 26, life: 1.1, size: 1.6, endSize: 0.3, color: '#ffc77a', drag: 1.6, rng: this.rand });
      this.sparks.emit({ pos, count: 18, spread: 10, life: 0.6, size: 4, endSize: 1, color: '#fff2d6', drag: 2, rng: this.rand });
      if (attract) return;
      audio.play('gate', { index });
      if (!last) hud.toast(`Gate ${index + 1} of ${total}`);
    });
    ev.on('round:crash', ({ pos, water, lives }) => {
      plane.visible = false;
      this.cam.hold(pos);
      if (water) {
        this.smoke.emit({ pos, vel: [0, 22, 0], count: 70, spread: 16, life: 1.8, size: 4, endSize: 9, color: '#f4efe6', gravity: 22, drag: 0.8, rng: this.rand });
        this.sparks.emit({ pos, vel: [0, 10, 0], count: 30, spread: 20, life: 0.8, size: 1.5, endSize: 0.2, color: '#ffe2b8', gravity: 15, rng: this.rand });
      } else {
        this.sparks.emit({ pos, vel: [0, 12, 0], count: 60, spread: 26, life: 0.9, size: 3, endSize: 0.5, color: '#ff9b45', gravity: 10, drag: 1.2, rng: this.rand });
        this.smoke.emit({ pos, vel: [0, 9, 0], count: 50, spread: 8, life: 3, size: 6, endSize: 18, color: '#4a4038', gravity: -2, drag: 0.6, rng: this.rand });
      }
      if (round.state === 'playing' || round.state === 'lost') {
        audio.play(water ? 'splash' : 'crash');
        if (lives > 0) hud.toast(lives === 1 ? 'One airframe left' : `${lives} airframes left`, 1.6);
      }
    });
    ev.on('round:respawn', () => {
      this._resetVisuals();
      if (round.state === 'playing') audio.play('respawn');
    });
    ev.on('round:won', ({ score, time }) => {
      audio.play('win');
      hud.show('won', { score, time, lives: round.lives });
    });
    ev.on('round:lost', ({ reason }) => {
      audio.play('lose');
      hud.show('lost', { reason, gates: round.gate, total: round.course.gates.length });
    });

    // Start, restart, mute. Audio unlocks inside the first gesture.
    const activate = () => {
      audio.unlock();
      if (round.state !== 'playing') round.start();
    };
    this.activate = activate;
    hud.mountScreen(activate);
    addEventListener('pointerdown', () => audio.unlock(), { capture: true });
    addEventListener('touchstart', () => audio.unlock(), { capture: true, passive: true });
    ctx.input.onKey((code) => {
      audio.unlock();
      if (code === 'KeyM') audio.setMuted(!audio.muted);
      if ((code === 'Enter' || code === 'Space') && round.state !== 'playing') activate();
    });
    hud.show('title');
    this._resetVisuals();
  }

  _resetVisuals() {
    this.plane.visible = true;
    this._syncPlane();
    this.cam.snap(this.round.model);
    for (const t of this.trails) t.reset();
  }

  _syncPlane() {
    const m = this.round.model;
    this.plane.position.copy(m.position);
    this.plane.quaternion.copy(m.quaternion);
  }

  update(dt, ctx) {
    if (!this.round) return;
    const round = this.round;
    const m = round.model;
    this.time += dt;

    if (round.gate < this._lastGate) this.course.reset();
    this._lastGate = round.gate;

    if (!round.crashed) {
      this._syncPlane();
      this.plane.userData.update?.(dt, m.throttle);
      const pull = Math.abs(m.inputs.pitch) * 0.6 + Math.abs(m.bank) * 0.5 + Math.max(0, m.speed - 100) / 80;
      // Vapour only when the wing is working: hard pulls, steep banks, high speed.
      const strength = THREE.MathUtils.clamp(pull - 0.25, 0, 1);
      this.plane.updateMatrixWorld();
      this.plane.userData.tips.forEach((p, i) => this.trails[i].push(this._tip.copy(p).applyMatrix4(this.plane.matrixWorld), strength));
    }
    for (const t of this.trails) t.update(ctx.camera);
    const h = ctx.engine.canvas.clientHeight || innerHeight;
    this.sparks.update(dt, ctx.camera, h);
    this.smoke.update(dt, ctx.camera, h);
    this.course.update(dt, this.time, round.state === 'playing' ? round.gate : -1);

    if (round.state === 'playing' && round.warning && !round.crashed) {
      this._warnT -= dt;
      if (this._warnT <= 0) {
        this.audio.play('warn');
        this._warnT = 1.4;
      }
    } else this._warnT = 0;

    this.audio.setBed({ throttle: m.throttle, speed: m.speed, on: !round.crashed && round.state !== 'lost' });
  }

  lateUpdate(dt, ctx) {
    if (!this.round) return;
    const m = this.round.model;
    if (ctx.cameraOverride) ctx.cameraOverride(ctx.camera, m);
    else this.cam.update(dt, m);
    ctx.camera.updateMatrixWorld();
    this.world.update(dt, this.time, ctx.camera, m.position);
  }
}
