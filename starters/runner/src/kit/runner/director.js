import * as THREE from 'three';
import { RunnerCamera } from './camera.js';
import { Particles } from '../fx/particles.js';
import { SpeedLines } from '../fx/speedlines.js';

/**
 * Presentation for a runner round: puts the runner and every obstacle on the
 * path, runs the camera, the speed lines and the speed blur, bursts of
 * particles at each action (dust on footfalls and landings, a spray on a
 * slide, sparks on a pickup, shards and a flash on a hit), the sound bed, the
 * screens, and start / restart / mute input. It listens to the round's events
 * and never changes the rules.
 *
 *   director.setup({ runner, world, art, look, camera })
 *     runner: Object3D; userData.update(dt, body, round, time, hooks) where
 *             hooks.step() is called on each footfall; userData.on?(type, e)
 *             receives every round event (to play clips)
 *     world:  { update(dt, time, camera, round), flash?(pos, color, power) }
 *     art:    { obstacle(o) -> Object3D in track-local axes (-Z ahead, +Y up),
 *               pickups(course, track) -> { object, update(dt, time, round), take(p) } }
 *     look:   { dust, spark, hit, lines }   colours
 *
 * Obstacle visuals are made when they come within `config.q.view` metres and
 * dropped once passed, so a long course costs only what is in view.
 *
 * Written for this repository.
 */
export class DirectorSystem {
  static id = 'director';
  static deps = ['round', 'hud', 'audio'];

  init(ctx) {
    this.ctx = ctx;
  }

  setup({ runner, world, art, look = {}, camera = {} }) {
    const ctx = this.ctx;
    const round = ctx.get('round');
    const hud = ctx.get('hud');
    const audio = ctx.get('audio');
    Object.assign(this, { round, hud, audio, runnerObj: runner, world, art });
    ctx.scene.add(runner);
    this.track = round.track;
    this.look = { dust: '#8a7a6a', spark: '#ffcf7a', hit: '#ff7a3a', lines: '#ffe2bf', ...look };

    const q = ctx.config.q;
    this.rng = ctx.rng.fork();
    this.rand = () => this.rng.float();
    this.sparks = new Particles({ max: Math.round(q.particles * 0.5), additive: true });
    this.dust = new Particles({ max: Math.round(q.particles * 0.5), additive: false });
    ctx.scene.add(this.sparks.points, this.dust.points);
    this.lines = new SpeedLines({ count: q.bloom ? 110 : 70, color: this.look.lines, rng: this.rand });
    ctx.scene.add(this.lines.object);
    this.cam = new RunnerCamera(ctx.camera, { fov: ctx.config.fov, ...camera });
    this.visuals = new Map(); // obstacle id -> Object3D
    this.next = 0; // next obstacle index to make
    this.time = 0;
    this.pickups = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this.hooks = { step: (side) => this._footfall(side) };

    const ev = ctx.events;
    const pass = (type) => ev.on(type, (e) => runner.userData.on?.(type, e));
    for (const t of ['round:start', 'round:won', 'round:lost', 'round:loop', 'runner:jump', 'runner:land', 'runner:slide', 'runner:rise', 'runner:drop', 'runner:lane', 'runner:hit', 'pickup']) pass(t);

    ev.on('round:start', ({ course }) => {
      this._clear();
      if (this.pickups) ctx.scene.remove(this.pickups.object);
      this.pickups = art.pickups(course, this.track);
      ctx.scene.add(this.pickups.object);
      this.cam.mode = 'chase';
      this.cam.snap(this.track, round.body);
      hud.show(null);
      audio.play('start');
    });
    ev.on('round:loop', () => this.cam.snap(this.track, round.body));
    ev.on('runner:jump', () => {
      audio.play('jump');
      this._dustAt(0, 10, 0.5);
    });
    ev.on('runner:land', ({ vy }) => {
      audio.play('land', { hard: Math.min(1, Math.abs(vy) / 14) });
      this._dustAt(0, 18, 0.8);
      this.cam.addShake(0.08);
    });
    ev.on('runner:slide', () => {
      audio.play('slide');
      this._dustAt(0, 22, 0.6);
    });
    ev.on('runner:drop', () => audio.play('drop'));
    ev.on('runner:lane', ({ from, to }) => audio.play('lane', { dir: Math.sign(to - from) }));
    ev.on('runner:hit', ({ o, hearts }) => {
      const p = this._bodyWorld(0.9);
      this.sparks.emit({ pos: p, count: 34, spread: 7, life: 0.55, size: 0.35, endSize: 0.05, color: this.look.hit, drag: 2.5, gravity: 6, rng: this.rand });
      this.dust.emit({ pos: p, count: 16, spread: 2.5, life: 1.1, size: 1.0, endSize: 2.4, color: this.look.dust, drag: 2, gravity: -0.6, rng: this.rand });
      this.cam.addShake(0.75);
      ctx.get('render').hurt = 1;
      world.flash?.(p, this.look.hit, 1);
      const vis = this.visuals.get(o.id);
      if (vis) vis.userData.hitT = 0.0001;
      audio.play(hearts <= 0 ? 'crash' : 'hit');
      if (hearts > 0) hud.toast(hearts === 1 ? hud.text.lastHeart ?? 'Last chance' : hud.text.hitToast ?? 'Hit', 1.2);
    });
    ev.on('runner:graze', () => audio.play('graze'));
    ev.on('pickup', ({ p, combo }) => {
      const pos = this.track.toWorld(p.s, p.lane * round.body.p.laneWidth, p.y, this._w).clone();
      this.sparks.emit({ pos, count: 14, spread: 3.2, life: 0.45, size: 0.22, endSize: 0.04, color: this.look.spark, drag: 3, rng: this.rand });
      this.pickups?.take(p);
      audio.play('pickup', { combo });
    });
    ev.on('milestone', ({ m, left }) => {
      hud.toast((hud.text.milestone ?? '{left} m to go').replace('{m}', m).replace('{left}', left), 1.8);
      audio.play('milestone');
    });
    ev.on('round:won', (d) => {
      audio.play('win');
      this.cam.mode = 'won';
      hud.show('won', d);
    });
    ev.on('round:lost', (d) => {
      audio.play('lose');
      this.cam.mode = 'end';
      hud.show('lost', d);
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
    this.cam.mode = 'title';
    this.cam.snap(this.track, round.body);
  }

  _bodyWorld(up = 0) {
    const b = this.round.body;
    return this.track.toWorld(b.s, b.x, b.y + up, this._v).clone();
  }

  _dustAt(up, count, size) {
    const p = this._bodyWorld(up + 0.05);
    const f = this.track.frame(this.round.body.s);
    const back = [-f.fwd.x * 3, 0.6, -f.fwd.z * 3];
    this.dust.emit({ pos: p, vel: back, count, spread: 1.6, life: 0.7, size, endSize: size * 2.6, color: this.look.dust, drag: 3, gravity: -0.3, rng: this.rand });
  }

  _footfall(side) {
    if (this.round.body.airborne) return;
    this.audio.play('step', { side, speed: this.round.body.speed });
    if (this.rand() < 0.7) this._dustAt(0, 3, 0.35);
  }

  _clear() {
    for (const o of this.visuals.values()) this.ctx.scene.remove(o);
    this.visuals.clear();
    this.next = 0;
    this.sparks.clear();
    this.dust.clear();
  }

  _place(obj, s, x, y) {
    this.track.basis(s, this._m);
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(this._m);
    if (x || y) {
      const f = this.track.frame(s);
      obj.matrix.setPosition(this._v.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, y));
    }
    obj.matrixWorldNeedsUpdate = true;
  }

  _stream() {
    const round = this.round;
    const b = round.body;
    const list = round.course.obstacles;
    const view = this.ctx.config.q.view ?? 220;
    while (this.next < list.length && list[this.next].s < b.s + view) {
      const o = list[this.next++];
      const obj = this.art.obstacle(o);
      if (!obj) continue;
      obj.userData.o = o;
      const lane = o.lanes ? o.lanes.reduce((a, l) => a + l, 0) / o.lanes.length : 0;
      this._place(obj, o.s + o.depth / 2, lane * b.p.laneWidth, 0);
      this.ctx.scene.add(obj);
      this.visuals.set(o.id, obj);
    }
    for (const [id, obj] of this.visuals) {
      const o = obj.userData.o;
      if (o && o.s + o.depth < b.s - 14) {
        this.ctx.scene.remove(obj);
        this.visuals.delete(id);
      }
    }
  }

  update(dt, ctx) {
    if (!this.round) return;
    const round = this.round;
    const b = round.body;
    this.time += dt;
    if (round.state !== 'title') this._stream();

    // The runner on the path, leaning into lane changes.
    const r = this.runnerObj;
    this.track.basis(b.s, this._m);
    const f = this.track.frame(b.s);
    r.position.copy(f.pos).addScaledVector(f.right, b.x).addScaledVector(f.up, b.y);
    r.quaternion.setFromRotationMatrix(this._m);
    r.userData.update?.(dt, b, round, this.time, this.hooks);

    for (const obj of this.visuals.values()) {
      obj.userData.update?.(dt, this.time, round);
      if (obj.userData.hitT > 0) obj.userData.hitT += dt;
    }
    this.pickups?.update(dt, this.time, round);

    const h = ctx.engine.canvas.clientHeight || innerHeight;
    this.sparks.update(dt, ctx.camera, h);
    this.dust.update(dt, ctx.camera, h);
    const rs = ctx.get('render');
    rs.hurt = Math.max(0, rs.hurt - dt * 2.2);
    const S = round.rules.speed;
    const fast = round.state === 'playing' ? Math.max(0, Math.min(1, (b.speed - S.start * 0.9) / (S.max - S.start * 0.9))) : 0;
    this.fast = fast;
    rs.setSpeed?.(fast);
    this.audio.setBed({ speed: b.speed, on: round.state !== 'lost', fast });
  }

  lateUpdate(dt, ctx) {
    if (!this.round) return;
    const round = this.round;
    if (round.state === 'title') this.cam.mode = 'title';
    if (ctx.cameraOverride) ctx.cameraOverride(ctx.camera, this.round);
    else this.cam.update(dt, this.track, round.body);
    ctx.camera.updateMatrixWorld();
    this.lines.update(dt, ctx.camera, round.state === 'playing' ? 0.15 + this.fast * 0.85 : 0, round.body.speed);
    this.world.update(dt, this.time, ctx.camera, round);
  }
}
