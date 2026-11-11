import * as THREE from 'three';
import { FlowField } from './flowfield.js';

/**
 * Enemy framework. A game supplies definitions (src/game/enemies.js):
 *   id, hp, speed, radius, height,
 *   attack: { kind: 'melee'|'ranged', range, damage, windup, cooldown, projectile },
 *   stagger (s), blood (color), build(rng): Object3D with feet at y=0,
 *   animate(enemy, dt, t): optional procedural animation,
 *   deathHold (s): optional; the game animates its own death (state 'dying',
 *     e.g. a Death clip) instead of the kit's tip-over, and the body stays this
 *     long before it sinks away.
 *   hover: optional height above the ground for flyers.
 *
 * Each enemy runs: chase -> windup -> strike -> recover, interrupted by stagger,
 * ending in a short death animation. enemy.state is what animate() reads.
 */

const _p = { x: 0, z: 0 };
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
let nextId = 1;

export class EnemySystem {
  static id = 'enemies';
  static deps = ['physics', 'player', 'fx', 'audio', 'weapons'];

  constructor({ defs }) {
    this.defs = Object.fromEntries(defs.map((d) => [d.id, d]));
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.physics = ctx.get('physics');
    this.player = ctx.get('player');
    this.fx = ctx.get('fx');
    this.audio = ctx.get('audio');
    this.alive = [];
    this.dying = [];
    this.field = new FlowField();
    this._fieldTimer = 0;
    this.spawned = 0;
  }

  bake(bounds) {
    this.field.bake(this.physics, bounds);
  }

  /** Instance every definition once so its shaders compile before play. */
  prewarm() {
    const group = new THREE.Group();
    for (const d of Object.values(this.defs)) group.add(d.build(this.rng));
    group.position.y = -500;
    this.ctx.scene.add(group);
    this.ctx.get('render').prewarm(this.ctx);
    this.ctx.scene.remove(group);
  }

  clear() {
    for (const e of [...this.alive, ...this.dying]) this._remove(e);
    this.alive.length = 0;
    this.dying.length = 0;
  }

  spawn(type, x, z) {
    const def = this.defs[type];
    if (!def) throw new Error(`unknown enemy type "${type}"`);
    const ground = this.physics.groundHeight(x, z) ?? 0;
    const model = def.build(this.rng);
    const materials = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        materials.push(o.material);
        o.castShadow = true;
      }
    });
    this.ctx.scene.add(model);

    const e = {
      id: nextId++,
      def, model, materials,
      x, z,
      y: ground + (def.hover ?? 0),
      yaw: 0,
      hp: def.hp,
      state: 'chase',
      timer: 0,
      cooldown: this.rng.range(0, 0.4),
      flash: 0,
      speedFactor: 1,
      moved: 0,
      t: this.rng.range(0, 10),
      dead: false,
      headY: 0,
      deathT: 0,
    };
    e.target = this.physics.addTarget({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: def.radius, owner: e });
    this._syncTarget(e);
    this.alive.push(e);
    this.spawned++;
    this.fx.burst([x, e.y + 0.6, z], { count: 12, color: def.spawnColor ?? '#b08cff', speed: 3, life: 0.5, size: 0.1 });
    return e;
  }

  _syncTarget(e) {
    const r = e.def.radius;
    const t = e.target;
    const base = e.y;
    t.ax = e.x;
    t.ay = base + r;
    t.az = e.z;
    t.bx = e.x;
    t.by = base + e.def.height - r;
    t.bz = e.z;
    e.headY = base + e.def.height * (e.def.headFrom ?? 0.8);
  }

  damage(e, amount, point, dir, head) {
    if (e.dead) return;
    e.hp -= amount;
    e.flash = 1;
    const kill = e.hp <= 0;
    const blood = e.def.blood ?? '#b6342a';
    this.fx.burst(point, { count: head ? 22 : 12, color: blood, additive: false, speed: 5, life: 0.45, size: 0.09, dir: [-dir[0], -dir[1], -dir[2]], spread: 0.9, gravity: -12, grow: 0.2 });
    this.audio.play('hit', { head });
    this.ctx.events.emit('enemy:hit', { enemy: e, amount, head, kill, point });

    if (kill) {
      this._die(e, dir);
      return;
    }
    if (e.def.stagger && e.state !== 'strike') {
      e.state = 'stagger';
      e.timer = e.def.stagger;
    }
  }

  _die(e, dir) {
    e.dead = true;
    e.state = 'dying';
    e.deathT = 0;
    e.deathYaw = Math.atan2(dir[0], dir[2]);
    this.physics.removeTarget(e.target);
    this.alive.splice(this.alive.indexOf(e), 1);
    this.dying.push(e);
    this.fx.burst([e.x, e.y + e.def.height * 0.55, e.z], { count: 26, color: e.def.blood ?? '#b6342a', additive: false, speed: 6, life: 0.8, size: 0.12, gravity: -14 });
    this.audio.play('kill');
    this.ctx.events.emit('enemy:killed', { enemy: e });
  }

  _remove(e) {
    this.ctx.scene.remove(e.model);
    if (!e.dead) this.physics.removeTarget(e.target);
    for (const m of e.materials) m.dispose();
  }

  update(dt, ctx) {
    const pl = this.player;
    this._fieldTimer -= dt;
    if (this._fieldTimer <= 0 && this.alive.length) {
      this._fieldTimer = 0.16;
      this.field.update(pl.feet.x, pl.feet.z);
    }

    for (const e of this.alive) this._think(e, dt, pl);
    this._separate(dt);

    for (const e of this.alive) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 7);
      this._applyVisual(e, dt);
      this._syncTarget(e);
    }

    for (let i = this.dying.length - 1; i >= 0; i--) {
      const e = this.dying[i];
      e.deathT += dt;
      e.t += dt;
      const hold = e.def.deathHold;
      if (hold) {
        e.def.animate?.(e, dt, e.t);
        e.model.position.set(e.x, e.y - Math.max(0, e.deathT - hold) * 0.6, e.z);
        e.model.rotation.y = e.yaw;
      } else {
        const f = Math.min(1, e.deathT / 0.5);
        e.model.rotation.x = -f * f * 1.5;
        e.model.position.y = e.y - Math.max(0, e.deathT - 0.7) * 1.6;
      }
      e.flash = Math.max(0, e.flash - dt * 7);
      this._flash(e);
      if (e.deathT > (hold ? hold + 1.5 : 1.5)) {
        this._remove(e);
        this.dying.splice(i, 1);
      }
    }
  }

  _think(e, dt, pl) {
    const def = e.def;
    const atk = def.attack;
    e.cooldown = Math.max(0, e.cooldown - dt);
    const dx = pl.feet.x - e.x;
    const dz = pl.feet.z - e.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);

    if (pl.dead || !pl.controlEnabled) {
      e.state = e.state === 'stagger' ? 'chase' : e.state;
      e.moved = 0;
      return;
    }

    switch (e.state) {
      case 'stagger':
        e.timer -= dt;
        e.moved = 0;
        if (e.timer <= 0) e.state = 'chase';
        break;
      case 'windup':
        e.timer -= dt;
        e.moved = 0;
        e.yaw = turnToward(e.yaw, targetYaw, dt * 6);
        if (e.timer <= 0) this._strike(e, dist);
        break;
      case 'strike':
        e.timer -= dt;
        e.moved = 0;
        if (e.timer <= 0) e.state = 'chase';
        break;
      default: {
        const canStrike = dist <= atk.range && e.cooldown <= 0 && this._sees(e, pl);
        if (canStrike) {
          e.state = 'windup';
          e.timer = atk.windup;
          this.audio.play('telegraph', { freq: def.telegraphHz ?? 180 });
          return;
        }
        if (atk.kind === 'ranged' && dist < atk.keepAway && this._sees(e, pl)) {
          e.moved = 0;
          e.yaw = turnToward(e.yaw, targetYaw, dt * 6);
          return;
        }
        this._move(e, dt, dx, dz, dist, targetYaw);
      }
    }
  }

  _sees(e, pl) {
    const y = e.y + e.def.height * 0.75;
    return this.physics.lineOfSight([e.x, y, e.z], [pl.feet.x, pl.feet.y + 1.4, pl.feet.z]);
  }

  _move(e, dt, dx, dz, dist, targetYaw) {
    const step = e.def.speed * e.speedFactor * dt;
    let hx = dx / (dist || 1);
    let hz = dz / (dist || 1);

    if (dist > 2.2) {
      const next = this.field.next(e.x, e.z);
      if (next >= 0) {
        this.field.center(next, _p);
        const nx = _p.x - e.x;
        const nz = _p.z - e.z;
        const len = Math.hypot(nx, nz) || 1;
        hx = nx / len;
        hz = nz / len;
      }
    }

    const nx = e.x + hx * step;
    const nz = e.z + hz * step;
    if (this._standable(nx, e.z)) e.x = nx;
    if (this._standable(e.x, nz)) e.z = nz;

    const k = this.field.indexAt(e.x, e.z);
    if (k >= 0) {
      const ground = this.physics.groundHeight(e.x, e.z) ?? this.field.height[k];
      const want = ground + (e.def.hover ?? 0);
      e.y += (want - e.y) * Math.min(1, dt * 14);
    }
    e.moved = step / Math.max(dt, 1e-5);
    e.yaw = turnToward(e.yaw, Math.atan2(hx, hz), dt * 9);
  }

  _standable(x, z) {
    const k = this.field.indexAt(x, z);
    return k >= 0 && this.field.walk[k] === 1;
  }

  _strike(e, dist) {
    const atk = e.def.attack;
    const pl = this.player;
    e.state = 'strike';
    e.timer = atk.recover ?? 0.25;
    e.cooldown = atk.cooldown;
    if (atk.kind === 'ranged') {
      _from.set(e.x, e.y + e.def.height * 0.72, e.z);
      _dir.set(pl.feet.x, pl.feet.y + 1.2, pl.feet.z).sub(_from).normalize();
      this.ctx.get('weapons').spawnEnemyProjectile(atk.projectile, [_from.x, _from.y, _from.z], _dir, atk.damage);
      this.audio.play('swing');
      return;
    }
    this.audio.play('swing');
    if (dist <= atk.range * 1.3) {
      _from.set(e.x, e.y, e.z);
      pl.applyDamage(atk.damage, _from);
    }
  }

  _separate(dt) {
    const a = this.alive;
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) {
        const dx = a[j].x - a[i].x;
        const dz = a[j].z - a[i].z;
        const min = a[i].def.radius + a[j].def.radius + 0.25;
        const d2 = dx * dx + dz * dz;
        if (d2 > min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) * Math.min(1, dt * 8)) / d;
        const px = dx * push * 0.5;
        const pz = dz * push * 0.5;
        if (this._standable(a[i].x - px, a[i].z - pz)) {
          a[i].x -= px;
          a[i].z -= pz;
        }
        if (this._standable(a[j].x + px, a[j].z + pz)) {
          a[j].x += px;
          a[j].z += pz;
        }
      }
    }
  }

  _applyVisual(e, dt) {
    e.model.position.set(e.x, e.y, e.z);
    e.model.rotation.y = e.yaw;
    e.def.animate?.(e, dt, e.t);
    this._flash(e);
  }

  _flash(e) {
    const hit = e.def.hitColor ?? 0xffffff;
    for (const m of e.materials) {
      if (!m.emissive) continue;
      if (m.userData.base === undefined) m.userData.base = m.emissive.getHex();
      if (e.flash > 0.01) m.emissive.set(hit).multiplyScalar(e.flash * 0.9);
      else m.emissive.setHex(m.userData.base);
    }
  }
}

function turnToward(from, to, maxStep) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-maxStep, Math.min(maxStep, d));
}
