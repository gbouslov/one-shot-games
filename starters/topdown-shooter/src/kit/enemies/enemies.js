import * as THREE from 'three';
import { blobShadow, poseRig } from '../actors/rig.js';
import { rayVsCircle } from '../arena/geometry.js';

/**
 * The horde. Every enemy samples one shared flow field toward the player (so
 * they route round cover and pour through gaps), keeps its distance from its
 * neighbours, winds up before it hits, flinches and is shoved back when shot,
 * and falls where it dies.
 *
 * A def (src/game/enemies.js):
 *   { id, hp, speed, radius, damage, reach, windup, cooldown, score, mass,
 *     rig: (rng) => humanoid(...), blood: color, spark: color, glow: color }
 *
 *   enemies.spawn(type, x, z)        enemies.alive          enemies.clear()
 *   enemies.raycast(ox, oz, dx, dz, max) -> { enemy, t }
 *   enemies.damage(enemy, amount, dx, dz, knock) -> killed?
 *
 * Events: enemy:hit, enemy:killed { enemy, x, z, def }, enemy:attack
 */
export class EnemySystem {
  static id = 'enemies';
  static deps = ['arena', 'player', 'fx', 'audio'];

  constructor({ defs }) {
    this.defs = Object.fromEntries(defs.map((d) => [d.id, d]));
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.alive = [];
    this.dying = [];
    this.pool = {};
    this.nextId = 1;
    this.flowTimer = 0;
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this._s = { x: 0, z: 0 };
  }

  /** Build rigs ahead of time so the first wave never hitches. */
  prewarm(counts = {}) {
    for (const def of Object.values(this.defs)) {
      const n = counts[def.id] ?? def.prewarm ?? 6;
      for (let i = 0; i < n; i++) this._release(this._make(def));
    }
  }

  _make(def) {
    const rig = def.rig(this.rng);
    const root = new THREE.Group();
    root.add(rig.group);
    root.add(blobShadow(def.radius * 1.35, 0.55));
    root.visible = false;
    this.group.add(root);
    return { def, rig, root };
  }

  _release(body) {
    body.root.visible = false;
    (this.pool[body.def.id] ??= []).push(body);
  }

  spawn(type, x, z) {
    const def = this.defs[type];
    if (!def) throw new Error(`unknown enemy "${type}"`);
    const body = this.pool[type]?.pop() ?? this._make(def);
    const e = {
      id: this.nextId++, def, body, x, z, vx: 0, vz: 0, kx: 0, kz: 0,
      hp: def.hp, yaw: Math.atan2(-x, -z), state: 'walk', t: 0, cd: 0,
      flash: 0, gait: this.rng.range(0, 6), speed: 0, dead: false, stagger: 0,
      pace: this.rng.range(0.88, 1.12),
    };
    body.root.visible = true;
    body.root.position.set(x, 0, z);
    body.rig.group.rotation.set(0, 0, 0);
    body.rig.group.position.set(0, 0, 0);
    body.rig.flash(0);
    this.alive.push(e);
    this.ctx.events.emit('enemy:spawned', { enemy: e });
    return e;
  }

  clear() {
    for (const e of [...this.alive, ...this.dying]) this._release(e.body);
    this.alive = [];
    this.dying = [];
  }

  raycast(ox, oz, dx, dz, max = Infinity) {
    let best = null;
    let bt = max;
    for (const e of this.alive) {
      const t = rayVsCircle(ox, oz, dx, dz, e.x, e.z, e.def.radius + 0.08);
      if (t !== null && t < bt) {
        bt = t;
        best = e;
      }
    }
    return best ? { enemy: best, t: bt } : null;
  }

  damage(e, amount, dx, dz, knock = 1) {
    if (e.dead) return false;
    const def = e.def;
    e.hp -= amount;
    e.flash = 1;
    const shove = (knock * 4.5) / (def.mass ?? 1);
    e.kx += dx * shove;
    e.kz += dz * shove;
    e.stagger = Math.max(e.stagger, 0.12 * knock / (def.mass ?? 1));
    if (e.state === 'windup' && knock / (def.mass ?? 1) > 1.2) {
      e.state = 'walk';
      e.cd = 0.3;
    }
    const fx = this.ctx.get('fx');
    const h = def.height ?? 1.7;
    fx.burst([e.x - dx * 0.2, h * 0.65, e.z - dz * 0.2], { count: 7, color: def.blood ?? '#5a0d0d', speed: 4.5, life: 0.45, size: 0.09, gravity: -16, additive: false, dir: [dx, 0.35, dz], spread: 0.7 });
    if (def.spark) fx.burst([e.x, h * 0.65, e.z], { count: 4, color: def.spark, speed: 3, life: 0.3, size: 0.07, gravity: -4, dir: [dx, 0.5, dz], spread: 1 });
    fx.mark([e.x + dx * this.rng.range(0.6, 1.6), 0.01, e.z + dz * this.rng.range(0.6, 1.6)], [0, 1, 0], { color: def.blood ?? '#3a0a0a', size: this.rng.range(0.18, 0.4) });
    const killed = e.hp <= 0;
    this.ctx.events.emit('enemy:hit', { enemy: e, damage: amount, x: e.x, z: e.z, kill: killed });
    this.ctx.get('audio').play('hit', { kill: killed });
    if (killed) this._kill(e, dx, dz);
    return killed;
  }

  _kill(e, dx, dz) {
    e.dead = true;
    e.state = 'dead';
    e.t = 0;
    e.fall = this.rng.range(-0.4, 0.4);
    e.kx += dx * 3;
    e.kz += dz * 3;
    // fall away from the shot
    e.yaw = Math.atan2(-dx, -dz);
    this.alive.splice(this.alive.indexOf(e), 1);
    this.dying.push(e);
    const fx = this.ctx.get('fx');
    const def = e.def;
    const h = def.height ?? 1.7;
    fx.burst([e.x, h * 0.6, e.z], { count: 16, color: def.blood ?? '#5a0d0d', speed: 6, life: 0.6, size: 0.12, gravity: -15, additive: false, dir: [dx, 0.5, dz], spread: 1 });
    if (def.glow) fx.burst([e.x, h * 0.8, e.z], { count: 18, color: def.glow, speed: 3.5, life: 0.9, size: 0.12, gravity: 1.5, spread: 1 });
    for (let i = 0; i < 3; i++) fx.mark([e.x + this.rng.signed() * 0.8, 0.01, e.z + this.rng.signed() * 0.8], [0, 1, 0], { color: def.blood ?? '#3a0a0a', size: this.rng.range(0.3, 0.7) });
    this.ctx.get('audio').play('kill');
    this.ctx.get('camera')?.shake(0.06 * (def.mass ?? 1));
    this.ctx.events.emit('enemy:killed', { enemy: e, x: e.x, z: e.z, def });
  }

  update(dt, ctx) {
    const arena = ctx.get('arena');
    const p = ctx.get('player');
    const t = ctx.time.elapsed;

    // The field follows the player; recomputing is skipped while they stay in one cell.
    this.flowTimer -= dt;
    if (this.flowTimer <= 0 && arena.flow) {
      arena.flow.compute(p.x, p.z);
      this.flowTimer = 0.2;
    }

    const list = this.alive;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const def = e.def;
      e.flash = Math.max(0, e.flash - dt * 7);
      e.stagger = Math.max(0, e.stagger - dt);
      e.cd = Math.max(0, e.cd - dt);
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      const reach = def.radius + (p.cfg?.radius ?? 0.42) + (def.reach ?? 0.45);

      // steer: the flow field, or straight at the player when nothing is between
      let sx;
      let sz;
      if (dist < 7 && arena.clearLine(e.x, e.z, p.x, p.z)) {
        sx = dx / (dist || 1);
        sz = dz / (dist || 1);
      } else {
        const s = arena.flow ? arena.flow.sample(e.x, e.z, this._s) : { x: dx / (dist || 1), z: dz / (dist || 1) };
        sx = s.x;
        sz = s.z;
      }
      // separation
      for (let j = 0; j < list.length; j++) {
        if (j === i) continue;
        const o = list[j];
        const ox = e.x - o.x;
        const oz = e.z - o.z;
        const want = def.radius + o.def.radius + 0.15;
        const d2 = ox * ox + oz * oz;
        if (d2 < want * want && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (want - d) / want;
          sx += (ox / d) * push * 1.6;
          sz += (oz / d) * push * 1.6;
        }
      }
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;

      let speed = def.speed * e.pace;
      if (e.state === 'windup') {
        speed *= 0.15;
        e.t += dt;
        if (e.t >= (def.windup ?? 0.4)) {
          e.state = 'walk';
          e.cd = def.cooldown ?? 0.9;
          if (dist < reach + 0.35 && !p.dead) {
            p.applyDamage(def.damage, e);
            ctx.get('camera')?.shake(0.25);
          }
          ctx.events.emit('enemy:attack', { enemy: e });
        }
      } else if (dist < reach && e.cd <= 0 && !p.dead) {
        e.state = 'windup';
        e.t = 0;
        ctx.get('audio').play('growl', { pitch: def.voice ?? 1 });
      }
      if (dist < reach * 0.8) speed *= 0.2;
      if (e.stagger > 0) speed *= 0.25;

      const k = 1 - Math.exp(-8 * dt);
      e.vx += (sx * speed - e.vx) * k;
      e.vz += (sz * speed - e.vz) * k;
      const kd = Math.exp(-9 * dt);
      e.kx *= kd;
      e.kz *= kd;
      const pos = { x: e.x + (e.vx + e.kx) * dt, z: e.z + (e.vz + e.kz) * dt };
      arena.resolve(pos, def.radius);
      const moved = Math.hypot(pos.x - e.x, pos.z - e.z);
      e.speed = dt > 0 ? moved / dt : 0;
      e.x = pos.x;
      e.z = pos.z;
      e.gait += moved * (def.gait ?? 2.4);

      // face the player when close, else where it is walking
      const face = dist < 4 ? Math.atan2(dx, dz) : Math.atan2(e.vx, e.vz);
      let dy = face - e.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      e.yaw += dy * Math.min(1, dt * (def.turn ?? 7));

      const b = e.body;
      b.root.position.set(e.x, 0, e.z);
      b.root.rotation.y = e.yaw;
      const windup = e.state === 'windup' ? Math.min(1, e.t / (def.windup ?? 0.4)) : 0;
      poseRig(b.rig, {
        phase: e.gait,
        stride: Math.min(1, e.speed / Math.max(0.5, def.speed)),
        reach: Math.max(def.reachPose ?? 0.35, windup),
        lean: windup * 0.35 - e.stagger * 2.2,
        t: t + e.id,
      });
      b.rig.flash(e.flash);
    }

    for (let i = this.dying.length - 1; i >= 0; i--) {
      const e = this.dying[i];
      e.t += dt;
      const kd = Math.exp(-7 * dt);
      e.kx *= kd;
      e.kz *= kd;
      const pos = { x: e.x + e.kx * dt, z: e.z + e.kz * dt };
      arena.resolve(pos, e.def.radius * 0.5);
      e.x = pos.x;
      e.z = pos.z;
      const b = e.body;
      b.root.position.set(e.x, 0, e.z);
      b.root.rotation.y = e.yaw;
      const fall = Math.min(1, e.t / 0.45);
      const ease = 1 - (1 - fall) * (1 - fall);
      b.rig.group.rotation.x = -ease * 1.5; // backward, away from the shot
      b.rig.group.rotation.z = ease * e.fall;
      b.rig.group.position.y = -Math.max(0, e.t - 2.4) * 0.6;
      b.rig.flash(Math.max(0, 1 - e.t * 4));
      if (e.t > 3.6) {
        this.dying.splice(i, 1);
        this._release(b);
      }
    }
  }
}
