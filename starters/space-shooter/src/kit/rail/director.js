import * as THREE from 'three';
import { RailCamera } from './rail-camera.js';
import { Particles } from '../fx/particles.js';
import { Streaks, Orbs, Debris } from '../fx/bolts.js';

/**
 * Presentation for a rail round: puts the ship and every enemy where the
 * round says, runs the rail camera, draws bolts, explosions (sparks, smoke,
 * hot debris, a flash of real light, camera shake), the boss, the sound bed,
 * the screens, and start / restart / mute input. It listens to the round's
 * events and never changes the rules.
 *
 *   director.setup({ ship, world, art, look })
 *     ship:  Object3D, userData.update(dt, railShip, time)
 *     world: { update(dt, time, camera, railShip), flash(pos, color, power) }
 *     art:   { enemy(e) -> Object3D, bar(bar) -> Object3D, boss(boss) -> Object3D }
 *            each may have userData.update(dt, entity, time)
 *     look:  { playerBolt, enemyBolt, spark, smoke, fire }  colours
 *
 * Written for this repository.
 */
export class DirectorSystem {
  static id = 'director';
  static deps = ['round', 'hud', 'audio'];

  init(ctx) {
    this.ctx = ctx;
  }

  setup({ ship, world, art, look = {}, camera = {} }) {
    const ctx = this.ctx;
    const round = ctx.get('round');
    const hud = ctx.get('hud');
    const audio = ctx.get('audio');
    Object.assign(this, { round, hud, audio, shipObj: ship, world, art });
    ctx.scene.add(ship);

    const q = ctx.config.q;
    this.sparks = new Particles({ max: Math.round(q.particles * 0.6), additive: true });
    this.smoke = new Particles({ max: Math.round(q.particles * 0.4), additive: false });
    this.streaks = new Streaks({ color: look.playerBolt ?? '#9fe8ff' });
    this.orbs = new Orbs({ color: look.enemyBolt ?? '#ff7a2a' });
    this.debris = new Debris({ hot: look.fire ?? '#ff7a2a' });
    for (const o of [this.sparks.points, this.smoke.points, ...this.streaks.objects, ...this.orbs.objects, ...this.debris.objects]) ctx.scene.add(o);
    this.look = { spark: '#ffd79a', fire: '#ff7a2a', smoke: '#2a2d36', hit: '#bfefff', ...look };

    this.cam = new RailCamera(ctx.camera, { fov: ctx.config.fov, ...camera });
    this.rng = ctx.rng.fork();
    this.rand = () => this.rng.float();
    this.visuals = new Map(); // enemy id -> Object3D
    this.barObjs = [];
    this.bossObj = null;
    this.time = 0;
    this._endT = 0;

    const ev = ctx.events;
    ev.on('round:start', () => {
      this._clearWorld();
      this.cam.mode = 'chase';
      this.cam.snap(round.ship);
      ship.visible = true;
      hud.show(null);
      audio.play('start');
    });
    ev.on('round:loop', () => this.cam.snap(round.ship));
    ev.on('shot', () => audio.play('laser'));
    ev.on('enemy:spawn', ({ e }) => {
      const o = art.enemy(e);
      if (!o) return;
      o.position.copy(e.pos);
      ctx.scene.add(o);
      this.visuals.set(e.id, o);
    });
    ev.on('enemy:fire', ({ e, boss }) => {
      this.sparks.emit({ pos: e.pos, count: 4, spread: 3, life: 0.25, size: 2.2, endSize: 0.4, color: this.look.fire, rng: this.rand });
      if (this._near(e.pos, 220)) audio.play(boss ? 'bossShot' : 'enemyShot');
    });
    ev.on('enemy:hit', ({ e, pos, armored }) => {
      this.sparks.emit({ pos, count: armored ? 6 : 10, spread: 9, life: 0.35, size: 1.1, endSize: 0.2, color: armored ? '#9fdcff' : this.look.spark, drag: 3, rng: this.rand });
      const o = this.visuals.get(e.id);
      if (o) o.userData.hitT = 0.12;
      audio.play(armored ? 'ping' : 'hit');
    });
    ev.on('enemy:die', ({ e, pos }) => {
      const o = this.visuals.get(e.id);
      if (o) {
        ctx.scene.remove(o);
        this.visuals.delete(e.id);
      }
      if (e.gone) return;
      const big = e.kind === 'core' ? 3 : e.kind === 'node' ? 1.8 : 1;
      this._explode(pos, big, e.vel);
      audio.play(big > 1.5 ? 'boom' : 'pop');
    });
    ev.on('bar:spawn', ({ bar }) => {
      const o = art.bar(bar);
      ctx.scene.add(o);
      this.barObjs.push(o);
    });
    ev.on('bar:spark', ({ pos }) => this.sparks.emit({ pos, count: 5, spread: 6, life: 0.3, size: 0.9, endSize: 0.2, color: this.look.spark, rng: this.rand }));
    ev.on('bar:scrape', ({ pos }) => {
      this.sparks.emit({ pos, count: 40, spread: 18, life: 0.6, size: 1.2, endSize: 0.2, color: this.look.spark, drag: 2, rng: this.rand });
      audio.play('scrape');
    });
    ev.on('player:hit', ({ pos, damage }) => {
      this.sparks.emit({ pos, count: 18, spread: 10, life: 0.45, size: 1.4, endSize: 0.2, color: this.look.hit, drag: 2.5, rng: this.rand });
      this.cam.addShake(0.35 + damage / 40);
      ctx.get('render').hurt = 1;
      audio.play('damage');
    });
    ev.on('player:die', ({ pos }) => {
      ship.visible = false;
      this._explode(pos, 2, null);
      this.cam.hold(pos);
      audio.play('boom');
    });
    ev.on('boss:spawn', ({ boss }) => {
      this.bossObj = art.boss(boss);
      ctx.scene.add(this.bossObj);
      hud.toast(this.hud.text.bossWarning ?? 'Target ahead', 2.4);
      audio.play('alarm');
    });
    ev.on('boss:open', () => {
      hud.toast(this.hud.text.bossOpen ?? 'Core exposed', 2);
      audio.play('open');
      this.cam.addShake(0.4);
    });
    ev.on('boss:die', ({ pos }) => {
      for (let i = 0; i < 5; i++) {
        const p = pos.clone().add(new THREE.Vector3((this.rand() - 0.5) * 16, (this.rand() - 0.5) * 12, (this.rand() - 0.5) * 6));
        this._explode(p, 2.2, null);
      }
      this.cam.addShake(1.1);
      audio.play('bigBoom');
      if (this.bossObj) this.bossObj.userData.dead = true;
    });
    ev.on('round:won', (d) => {
      audio.play('win');
      hud.show('won', d);
    });
    ev.on('round:lost', ({ reason }) => {
      audio.play('lose');
      hud.show('lost', { reason, progress: Math.min(1, round.ship.distance / round.courseLength) });
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
    this.cam.snap(round.ship);
  }

  _near(p, d) {
    return Math.abs(p.z - this.round.ship.position.z) < d;
  }

  _clearWorld() {
    for (const o of this.visuals.values()) this.ctx.scene.remove(o);
    this.visuals.clear();
    for (const o of this.barObjs) this.ctx.scene.remove(o);
    this.barObjs.length = 0;
    if (this.bossObj) this.ctx.scene.remove(this.bossObj);
    this.bossObj = null;
    this.debris.clear();
    this.sparks.clear();
    this.smoke.clear();
  }

  _explode(pos, big, vel) {
    const r = this.rand;
    const v = vel ? [vel.x * 0.5, vel.y * 0.5, vel.z * 0.5] : [0, 0, 0];
    this.sparks.emit({ pos, vel: v, count: Math.round(26 * big), spread: 16 * big, life: 0.7, size: 1.4 * big, endSize: 0.2, color: this.look.spark, drag: 1.8, rng: r });
    this.sparks.emit({ pos, vel: v, count: Math.round(10 * big), spread: 5 * big, life: 0.5, size: 6 * big, endSize: 2 * big, color: this.look.fire, drag: 3, rng: r });
    this.smoke.emit({ pos, vel: v, count: Math.round(10 * big), spread: 4 * big, life: 1.6, size: 3 * big, endSize: 8 * big, color: this.look.smoke, drag: 1.5, gravity: -1, rng: r });
    this.debris.burst(pos, Math.round(7 * big), 14 * big, r, vel ? vel.clone().multiplyScalar(0.5) : null);
    this.world.flash?.(pos, this.look.fire, big);
    if (this._near(pos, 160)) this.cam.addShake(0.12 * big);
  }

  update(dt, ctx) {
    if (!this.round) return;
    const round = this.round;
    const s = round.ship;
    this.time += dt;
    if (round.state === 'title') this.cam.mode = 'title';
    else if (round.state === 'won') this.cam.mode = 'orbit';
    // Ship.
    this.shipObj.position.copy(s.position);
    this.shipObj.quaternion.copy(s.quaternion);
    this.shipObj.userData.update?.(dt, s, this.time);
    // Enemies.
    for (const e of round.enemies) {
      const o = this.visuals.get(e.id);
      if (!o) continue;
      o.position.copy(e.pos);
      o.userData.update?.(dt, e, this.time, s);
      if (o.userData.hitT > 0) o.userData.hitT -= dt;
    }
    if (this.bossObj) this.bossObj.userData.update?.(dt, round.boss, this.time, round);
    for (const o of this.barObjs) o.userData.update?.(dt, this.time);
    const h = ctx.engine.canvas.clientHeight || innerHeight;
    this.streaks.sync(round.bolts, ctx.camera, h);
    this.orbs.sync(round.shots, ctx.camera, h, this.time);
    this.debris.update(dt);
    this.sparks.update(dt, ctx.camera, h);
    this.smoke.update(dt, ctx.camera, h);
    const r = ctx.get('render');
    r.hurt = Math.max(0, r.hurt - dt * 2.5);
    this.audio.setBed({ speed: s.speed, boost: s.boosting ? 1 : 0, on: !round.dead && round.state !== 'lost' });
  }

  lateUpdate(dt, ctx) {
    if (!this.round) return;
    const s = this.round.ship;
    if (ctx.cameraOverride) ctx.cameraOverride(ctx.camera, s);
    else {
      if (this.round.state === 'playing' && (this.cam.mode === 'orbit' || this.cam.mode === 'title')) this.cam.mode = 'chase';
      this.cam.update(dt, s);
    }
    ctx.camera.updateMatrixWorld();
    this.world.update(dt, this.time, ctx.camera, s);
  }
}
