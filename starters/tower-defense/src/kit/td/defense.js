import * as THREE from 'three';
import { SIM_DT, MAX_SIM_STEPS } from '../core/config.js';

/**
 * The defense: round state, economy, waves, towers, enemies and projectiles.
 * Runs at a fixed 60 Hz step scaled by game speed (1x, 2x, 3x), so the result
 * of a round does not depend on frame rate. Everything a game changes lives in
 * src/game/config.js (towers, enemies, waves, economy) and src/game/models.js
 * (what towers and enemies look like); this file is genre machinery.
 *
 * Tower def:  { id, name, cost, range, rate, damage, kind: 'bolt'|'shell'|'pulse',
 *               projectile: { speed, color, size, arc }, splash, slow: { factor, time },
 *               upgrades: [{ cost, damage, range, rate }], sounds: { fire, hit } }
 * Enemy def:  { id, name, hp, speed, reward, leak, radius, armor }
 * Wave:       { groups: [{ enemy, count, gap, at }], bonus }
 *
 * Events (ctx.events): round:start, round:won, round:lost, wave:start, wave:clear,
 *   tower:built, tower:upgraded, tower:sold, tower:fire, tower:pulse,
 *   enemy:spawn, enemy:hit, enemy:killed, enemy:leaked, shell:burst
 */
export class DefenseSystem {
  static id = 'defense';
  static deps = ['render', 'fx', 'audio'];

  constructor({ towers, enemies, waves, economy, models }) {
    this.towerDefs = towers;
    this.enemyDefs = Object.fromEntries(enemies.map((e) => [e.id, e]));
    this.waves = waves;
    this.economy = economy;
    this.models = models;
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.state = 'title';
    this.speed = 1;
    this.speeds = this.economy.speeds ?? [1, 2, 3];
    this.towers = [];
    this.enemies = [];
    this.missiles = [];
    this._acc = 0;
    this._ids = 1;
    this.root = new THREE.Group();
    this.root.name = 'defense';
    ctx.scene.add(this.root);
    this.reset();
  }

  /** The level: { board, heightAt(x, z) }. */
  setLevel(level) {
    this.level = level;
    this.board = level.board;
    this.crowd = this.models.crowd(this.ctx, this.enemyDefs, this.economy.maxEnemies ?? 96);
    this.root.add(this.crowd.object);
    this.missileView = new MissileView(this.ctx, this.economy.maxMissiles ?? 128);
    this.root.add(this.missileView.object);
  }

  reset() {
    for (const t of this.towers) this.root.remove(t.view);
    if (this.board) this.board.occupied.clear();
    this.towers = [];
    this.enemies = [];
    this.missiles = [];
    this.gold = this.economy.gold;
    this.lives = this.economy.lives;
    this.score = 0;
    this.kills = 0;
    this.leaked = 0;
    this.wave = 0; // waves called so far
    this.cleared = 0; // waves fully beaten
    this.spawning = []; // pending spawns { at, enemy, wave }
    this.waveClock = 0;
    this.countdown = this.economy.firstCall ?? 20;
    this.roundTime = 0;
    this.selected = null;
  }

  /** Begin a fresh round. */
  start() {
    this.reset();
    this.state = 'playing';
    this.ctx.get('fx').clear?.();
    this.ctx.events.emit('round:start', {});
  }

  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.speed = 1;
    this.ctx.get('audio').play('lose');
    this.ctx.events.emit('round:lost', { wave: this.wave, score: this.score });
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.speed = 1;
    this.score += this.lives * (this.economy.scorePerLife ?? 50);
    this.ctx.get('audio').play('win');
    this.ctx.events.emit('round:won', { score: this.score });
  }

  // ------------------------------------------------------------- actions --

  canBuild(def, c, r) {
    return this.state === 'playing' && this.board.buildable(c, r) && this.gold >= def.cost;
  }

  build(index, c, r) {
    const def = this.towerDefs[index];
    if (!def || !this.canBuild(def, c, r)) return null;
    this.gold -= def.cost;
    const p = this.board.toWorld(c, r);
    const t = {
      id: this._ids++, def, level: 0, c, r, x: p.x, z: p.z, y: this.level.heightAt(p.x, p.z),
      cooldown: 0.2, yaw: Math.PI, target: null, spent: def.cost, shots: 0, view: null, built: 0,
    };
    this._stats(t);
    this._view(t);
    this.towers.push(t);
    this.board.occupied.set(this.board.key(c, r), t);
    this.ctx.get('audio').play('build');
    this.ctx.events.emit('tower:built', { tower: t });
    return t;
  }

  upgradeCost(t) {
    return t.def.upgrades?.[t.level]?.cost ?? null;
  }

  upgrade(t) {
    const cost = this.upgradeCost(t);
    if (cost === null || this.gold < cost || this.state !== 'playing') return false;
    this.gold -= cost;
    t.spent += cost;
    t.level++;
    this._stats(t);
    this._view(t);
    this.ctx.get('audio').play('upgrade');
    this.ctx.events.emit('tower:upgraded', { tower: t });
    return true;
  }

  sell(t) {
    if (this.state !== 'playing') return false;
    const refund = Math.floor(t.spent * (this.economy.refund ?? 0.7));
    this.gold += refund;
    this.root.remove(t.view);
    this.towers.splice(this.towers.indexOf(t), 1);
    this.board.occupied.delete(this.board.key(t.c, t.r));
    if (this.selected === t) this.selected = null;
    this.ctx.get('audio').play('sell');
    this.ctx.events.emit('tower:sold', { tower: t, refund });
    return true;
  }

  /** Send the next wave now. Calling early pays a bonus for the time left on the clock. */
  callWave() {
    if (this.state !== 'playing' || this.wave >= this.waves.length) return false;
    const w = this.waves[this.wave];
    const early = Math.max(0, Math.floor(this.countdown * (this.economy.earlyBonus ?? 1)));
    if (this.wave > 0 && early > 0) this.gold += early;
    const base = this.waveClock;
    for (const g of w.groups) {
      for (let i = 0; i < g.count; i++) this.spawning.push({ at: base + (g.at ?? 0) + i * g.gap, enemy: g.enemy, wave: this.wave });
    }
    this.spawning.sort((a, b) => a.at - b.at);
    this.wave++;
    this.countdown = this.economy.betweenWaves ?? 18;
    this.ctx.get('audio').play('wave');
    this.ctx.events.emit('wave:start', { wave: this.wave, early });
    return true;
  }

  cycleSpeed() {
    const i = this.speeds.indexOf(this.speed);
    this.speed = this.speeds[(i + 1) % this.speeds.length];
    return this.speed;
  }

  towerAt(c, r) {
    return this.board.occupied.get(this.board.key(c, r)) ?? null;
  }

  // ---------------------------------------------------------- simulation --

  update(dt) {
    if (!this.board) return;
    if (this.state === 'playing') {
      this._acc += dt * this.speed;
      let n = 0;
      while (this._acc >= SIM_DT && n < MAX_SIM_STEPS) {
        this._step(SIM_DT);
        this._acc -= SIM_DT;
        n++;
        if (this.state !== 'playing') break;
      }
      if (n === MAX_SIM_STEPS) this._acc = 0;
    } else {
      // the title and end screens keep the world alive: walkers idle, missiles land
      this._acc = 0;
      this._animate(dt);
    }
    this._present(dt);
  }

  _step(h) {
    this.roundTime += h;
    this.waveClock += h;

    // waves: auto-call when the clock runs out, so the round always moves
    if (this.wave < this.waves.length) {
      this.countdown -= h;
      if (this.countdown <= 0) this.callWave();
    }
    while (this.spawning.length && this.spawning[0].at <= this.waveClock) {
      const s = this.spawning.shift();
      this._spawn(s.enemy, s.wave);
    }

    this._moveEnemies(h);
    this._towers(h);
    this._missiles(h);

    // a wave is clear when nothing of it is left to spawn or alive
    while (this.cleared < this.wave) {
      const idx = this.cleared;
      const pending = this.spawning.some((s) => s.wave === idx) || this.enemies.some((e) => e.wave === idx && !e.dead);
      if (pending) break;
      this.cleared++;
      const bonus = this.waves[idx].bonus ?? 0;
      this.gold += bonus;
      this.ctx.events.emit('wave:clear', { wave: idx + 1, bonus });
      if (this.cleared === this.waves.length) {
        this.win();
        return;
      }
    }
    if (this.lives <= 0) this.lose();
  }

  _spawn(id, wave) {
    const def = this.enemyDefs[id];
    const grow = 1 + (this.economy.hpGrowth ?? 0.2) * wave;
    const e = {
      id: this._ids++, def, wave, hp: def.hp * grow, maxHp: def.hp * grow,
      d: -this.rng.range(0, 0.6), lane: this.rng.signed() * (def.lane ?? 0.35), speed: def.speed * this.rng.range(0.94, 1.06),
      slow: 1, slowT: 0, x: 0, y: 0, z: 0, heading: 0, flash: 0, phase: this.rng.range(0, 6.28), dead: false, dying: 0,
    };
    this._place(e);
    this.enemies.push(e);
    this.ctx.events.emit('enemy:spawn', { enemy: e });
  }

  _place(e) {
    const s = this.board.sample(e.d, _s);
    // a small sideways offset so a column of walkers is not one file
    e.x = s.x + Math.cos(s.heading) * e.lane;
    e.z = s.z - Math.sin(s.heading) * e.lane;
    e.y = this.level.heightAt(e.x, e.z);
    e.heading = s.heading;
  }

  _moveEnemies(h) {
    for (const e of this.enemies) {
      if (e.dead) {
        e.dying += h;
        continue;
      }
      if (e.slowT > 0) {
        e.slowT -= h;
        if (e.slowT <= 0) e.slow = 1;
      }
      e.d += e.speed * e.slow * h;
      e.phase += e.speed * e.slow * h * 3.2;
      e.flash = Math.max(0, e.flash - h * 6);
      this._place(e);
      if (e.d >= this.board.length) {
        e.dead = true;
        e.leaked = true;
        e.dying = 1;
        const cost = e.def.leak ?? 1;
        this.lives = Math.max(0, this.lives - cost);
        this.leaked++;
        this.ctx.get('audio').play('leak');
        this.ctx.events.emit('enemy:leaked', { enemy: e, lives: this.lives });
      }
    }
    // drop corpses once their death animation is over
    this.enemies = this.enemies.filter((e) => !e.dead || e.dying < 0.45);
  }

  /** Adapted from djpav/threejs-tower-defense CombatSystem.findBestTarget (MIT). */
  _target(t) {
    let best = null;
    let bestValue = -Infinity;
    const r2 = t.range * t.range;
    for (const e of this.enemies) {
      if (e.dead || e.d < 0) continue;
      const dx = e.x - t.x;
      const dz = e.z - t.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      let v;
      switch (t.targeting ?? 'first') {
        case 'strongest': v = e.hp; break;
        case 'nearest': v = -d2; break;
        default: v = e.d; // furthest along the path
      }
      if (v > bestValue) {
        bestValue = v;
        best = e;
      }
    }
    return best;
  }

  _towers(h) {
    for (const t of this.towers) {
      t.cooldown -= h;
      t.built += h;
      const target = this._target(t);
      t.target = target;
      if (target) {
        const want = Math.atan2(target.x - t.x, target.z - t.z);
        t.yaw = turn(t.yaw, want, h * (t.def.turn ?? 9));
      }
      if (!target || t.cooldown > 0) continue;
      t.cooldown = 1 / t.rate;
      t.shots++;
      if (t.def.kind === 'pulse') this._pulse(t);
      else this._fire(t, target);
    }
  }

  _muzzle(t) {
    const m = t.view?.userData.muzzle;
    if (m) {
      t.view.updateMatrixWorld(true);
      m.getWorldPosition(_v);
      return [_v.x, _v.y, _v.z];
    }
    return [t.x, t.y + 1.6, t.z];
  }

  _fire(t, target) {
    const from = this._muzzle(t);
    const p = t.def.projectile ?? {};
    const m = {
      kind: t.def.kind, tower: t, target, dmg: t.damage, splash: t.splash, slow: t.def.slow ?? null,
      x: from[0], y: from[1], z: from[2], sx: from[0], sy: from[1], sz: from[2], tx: target.x, ty: target.y + 0.4, tz: target.z,
      speed: p.speed ?? 20, color: p.color ?? '#ffd27a', size: p.size ?? 0.12, t: 0, flight: 0, arc: p.arc ?? 0, trail: 0,
    };
    if (m.kind === 'shell') {
      // lead the target by the flight time
      const dist = Math.hypot(target.x - m.x, target.z - m.z);
      m.flight = Math.max(0.35, dist / m.speed);
      const ahead = this.board.sample(target.d + target.speed * target.slow * m.flight, _s);
      m.tx = ahead.x;
      m.tz = ahead.z;
      m.ty = this.level.heightAt(m.tx, m.tz);
    }
    this.missiles.push(m);
    t.view?.userData.onFire?.();
    this.ctx.get('audio').play(t.def.sounds?.fire ?? 'bolt');
    this.ctx.events.emit('tower:fire', { tower: t, from, target });
  }

  _pulse(t) {
    const r2 = t.range * t.range;
    let hit = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if ((e.x - t.x) ** 2 + (e.z - t.z) ** 2 > r2) continue;
      this._damage(e, t.damage, t);
      if (t.def.slow) {
        e.slow = Math.min(e.slow, t.def.slow.factor);
        e.slowT = Math.max(e.slowT, t.def.slow.time);
      }
      hit++;
    }
    t.view?.userData.onFire?.();
    this.ctx.get('audio').play(t.def.sounds?.fire ?? 'chime');
    this.ctx.events.emit('tower:pulse', { tower: t, range: t.range, hit });
  }

  _missiles(h) {
    const keep = [];
    for (const m of this.missiles) {
      m.t += h;
      if (m.kind === 'shell') {
        const k = Math.min(1, m.t / m.flight);
        m.x = m.sx + (m.tx - m.sx) * k;
        m.z = m.sz + (m.tz - m.sz) * k;
        m.y = m.sy + (m.ty - m.sy) * k + m.arc * 4 * k * (1 - k);
        if (k >= 1) {
          this._burst(m);
          continue;
        }
      } else {
        const tgt = m.target;
        if (tgt && !tgt.dead) {
          m.tx = tgt.x;
          m.ty = tgt.y + (tgt.def.radius ?? 0.4) * 0.9;
          m.tz = tgt.z;
        }
        const dx = m.tx - m.x;
        const dy = m.ty - m.y;
        const dz = m.tz - m.z;
        const dist = Math.hypot(dx, dy, dz);
        const stepLen = m.speed * h;
        if (dist <= stepLen + 0.05) {
          if (tgt && !tgt.dead) {
            this._damage(tgt, m.dmg, m.tower);
            this.ctx.events.emit('enemy:hit', { enemy: tgt, at: [m.tx, m.ty, m.tz], color: m.color, kind: m.kind });
          }
          continue;
        }
        m.vx = dx / dist;
        m.vy = dy / dist;
        m.vz = dz / dist;
        m.x += m.vx * stepLen;
        m.y += m.vy * stepLen;
        m.z += m.vz * stepLen;
        if (m.t > 3) continue;
      }
      keep.push(m);
    }
    this.missiles = keep;
  }

  _burst(m) {
    const r2 = m.splash * m.splash;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d2 = (e.x - m.tx) ** 2 + (e.z - m.tz) ** 2;
      if (d2 > r2) continue;
      // full damage at the centre, half at the rim
      this._damage(e, m.dmg * (1 - 0.5 * Math.sqrt(d2 / r2)), m.tower);
    }
    this.ctx.get('audio').play(m.tower.def.sounds?.hit ?? 'boom');
    this.ctx.events.emit('shell:burst', { at: [m.tx, m.ty, m.tz], radius: m.splash, color: m.color });
  }

  _damage(e, amount, tower) {
    if (e.dead) return;
    const dmg = Math.max(amount * 0.25, amount - (e.def.armor ?? 0));
    e.hp -= dmg;
    e.flash = 1;
    if (tower) tower.dealt = (tower.dealt ?? 0) + dmg;
    if (e.hp <= 0) {
      e.dead = true;
      e.dying = 0;
      this.gold += e.def.reward ?? 0;
      this.kills++;
      this.score += (e.def.reward ?? 1) * 10;
      this.ctx.get('audio').play('kill', { big: (e.def.radius ?? 0.4) > 0.6 });
      this.ctx.events.emit('enemy:killed', { enemy: e, at: [e.x, e.y, e.z] });
    } else if (tower?.def.kind === 'bolt') {
      this.ctx.get('audio').play('hit');
    }
  }

  _stats(t) {
    const d = t.def;
    let damage = d.damage;
    let range = d.range;
    let rate = d.rate;
    for (let i = 0; i < t.level; i++) {
      const u = d.upgrades[i];
      damage *= u.damage ?? 1;
      range *= u.range ?? 1;
      rate *= u.rate ?? 1;
    }
    t.damage = damage;
    t.range = range;
    t.rate = rate;
    t.splash = (d.splash ?? 0) * (1 + 0.12 * t.level);
  }

  _view(t) {
    if (t.view) this.root.remove(t.view);
    t.view = this.models.tower(this.ctx, t.def, t.level);
    t.view.position.set(t.x, t.y, t.z);
    t.view.userData.tower = t;
    this.root.add(t.view);
  }

  /** Non-sim animation on title and end screens. */
  _animate(dt) {
    for (const e of this.enemies) {
      if (e.dead) e.dying += dt;
      e.flash = Math.max(0, e.flash - dt * 6);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.dying < 0.45);
  }

  _present(dt) {
    for (const t of this.towers) {
      const u = t.view.userData;
      if (u.head) u.head.rotation.y = t.yaw;
      u.update?.(dt, t);
    }
    this.crowd.update(this.enemies, dt, this.ctx.camera);
    this.missileView.update(this.missiles, dt);
  }
}

const _v = new THREE.Vector3();
const _s = { x: 0, z: 0, heading: 0 };

function turn(from, to, max) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}

/** Projectiles: one instanced glowing mesh, stretched along velocity for bolts, round for shells. */
class MissileView {
  constructor(ctx, max) {
    this.ctx = ctx;
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.object = this.mesh;
    this.max = max;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._sc = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._c = new THREE.Color();
    this._z = new THREE.Vector3(0, 0, 1);
  }

  update(list, dt) {
    const fx = this.ctx.get('fx');
    let n = 0;
    for (const m of list) {
      if (n >= this.max) break;
      this._p.set(m.x, m.y, m.z);
      if (m.kind === 'shell') {
        this._q.identity();
        this._sc.setScalar(m.size);
        m.trail += dt;
        if (m.trail > 0.03) {
          m.trail = 0;
          fx.burst([m.x, m.y, m.z], { count: 2, color: m.color, speed: 0.4, life: 0.45, size: m.size * 2.2, gravity: 0.6, drag: 2 });
          fx.burst([m.x, m.y, m.z], { count: 1, color: '#3a3532', speed: 0.3, life: 0.9, size: m.size * 3, gravity: 0.8, additive: false, grow: 1.6 });
        }
      } else {
        this._d.set(m.vx ?? 0, m.vy ?? 0, m.vz ?? 1);
        if (this._d.lengthSq() < 1e-6) this._d.set(0, 0, 1);
        this._q.setFromUnitVectors(this._z, this._d.normalize());
        this._sc.set(m.size * 0.45, m.size * 0.45, m.size * 4.5);
      }
      this._m.compose(this._p, this._q, this._sc);
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, this._c.set(m.color).multiplyScalar(4));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
