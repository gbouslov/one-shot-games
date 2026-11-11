import * as THREE from 'three';
import { RailShip } from './ship.js';
import { RailBot } from './bot.js';

/**
 * A round of an on-rails shooter: the rail runs a scripted course, waves of
 * craft fly in and hold in front of the ship, turrets sit on the trench walls,
 * bars cross the trench to be flown over or under, and a target with armoured
 * nodes and a core waits at the end. Destroy the core to win; lose when the
 * hull runs out. Owns the ship, the script, every enemy and bolt, hits,
 * damage, score and the bot. Visuals and sound listen to its events:
 *
 *   'round:start', 'round:won' {score}, 'round:lost' {reason}
 *   'shot' {pos}                       the player fired
 *   'enemy:spawn' {e}, 'enemy:hit' {e, pos}, 'enemy:die' {e, pos}
 *   'enemy:fire' {e, pos}
 *   'bar:spawn' {bar}, 'bar:scrape' {pos}
 *   'player:hit' {pos, damage}, 'player:die' {pos}
 *   'boss:spawn' {boss}, 'boss:open' {boss}, 'boss:die' {pos}
 *
 * States: 'title' (the rail drifts, no enemies), 'playing', 'won', 'lost'.
 * Game time only (clamped dt), never frame counts.
 *
 * Rules (src/game/rules.js): hull, ship (RailShip params), script [...],
 * boss {...}, enemies {craft, turret}, scores. See the default game for the shape.
 *
 * Written for this repository.
 */
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Shortest distance from point c to segment ab. */
function segDist(a, b, c) {
  _a.subVectors(b, a);
  const len2 = _a.lengthSq();
  const t = len2 > 0 ? Math.max(0, Math.min(1, _b.subVectors(c, a).dot(_a) / len2)) : 0;
  return _c.copy(a).addScaledVector(_a, t).distanceTo(c);
}

export class RoundSystem {
  static id = 'round';
  static deps = ['audio'];

  constructor({ rules }) {
    this.rules = rules;
  }

  init(ctx) {
    this.ctx = ctx;
    this.ship = new RailShip(this.rules.ship);
    this.bot = new RailBot(ctx.input, this.rules.bot);
    this.rng = ctx.rng.fork();
    this.state = 'title';
    this.autoplay = false;
    this.enemies = [];
    this.bolts = []; // player bolts { pos, prev, vel, age }
    this.shots = []; // enemy bolts { pos, prev, vel, age }
    this.bars = [];
    this.boss = null;
    this._id = 0;
    this._reset();
  }

  get courseLength() {
    return this.rules.boss.at;
  }

  _reset() {
    this.ship.reset(0);
    this.hull = this.rules.hull ?? 100;
    this.elapsed = 0;
    this.score = 0;
    this.kills = 0;
    this.hits = 0;
    this.cursor = 0;
    this.invuln = 0;
    this.enemies.length = 0;
    this.bolts.length = 0;
    this.shots.length = 0;
    this.bars.length = 0;
    this.boss = null;
    this.dead = false;
  }

  start() {
    this._reset();
    this.ctx.input.clearSource('bot');
    this.state = 'playing';
    this.ctx.events.emit('round:start', {});
  }

  lose(reason = 'debug') {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.reason = reason;
    this.ctx.input.clearSource('bot');
    this.ctx.events.emit('round:lost', { reason });
  }

  setAutoplay(on) {
    this.autoplay = !!on;
    if (!on) this.ctx.input.clearSource('bot');
  }

  beginFrame() {
    if (this.state === 'playing' && this.autoplay && !this.dead) this.bot.update(this);
  }

  // ------------------------------------------------------------------ step
  fixedUpdate(dt) {
    const s = this.ship;
    const R = this.rules;
    if (this.state === 'title') {
      // Attract: drift down the opening stretch and loop.
      s.step(dt, this.ctx.input, { speed: R.attractSpeed ?? 16, fire: false, steer: false });
      if (s.distance > (R.attractLength ?? 700)) {
        s.reset(0);
        this.ctx.events.emit('round:loop', {});
      }
      return;
    }
    if (this.state === 'playing') this.elapsed += dt;
    this.invuln = Math.max(0, this.invuln - dt);

    if (!this.dead && this.state !== 'lost') {
      const bossNear = s.distance >= R.boss.at - 2;
      const prevZ = s.position.z;
      const fired = s.step(dt, this.ctx.input, {
        speed: bossNear || this.state === 'won' ? 0 : undefined,
        fire: this.state === 'playing',
      });
      for (const f of fired) {
        this.bolts.push({ pos: f.pos, prev: f.pos.clone(), vel: f.vel, age: 0 });
        this.ctx.events.emit('shot', { pos: f.pos });
      }
      if (this.state === 'playing') this._checkBars(prevZ);
    }
    if (this.state === 'playing') this._runScript();
    this._stepEnemies(dt);
    this._stepBolts(dt);
  }

  // ------------------------------------------------------------------ script
  _runScript() {
    const R = this.rules;
    const d = this.ship.distance;
    const script = R.script;
    while (this.cursor < script.length && script[this.cursor].at <= d) this._event(script[this.cursor++]);
    if (!this.boss && d >= R.boss.at - (R.boss.revealAt ?? 450)) this._spawnBoss();
  }

  _event(ev) {
    const R = this.rules;
    const d = this.ship.distance;
    if (ev.wave) {
      const n = ev.count ?? 4;
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5
        let hx = (ev.x ?? 0) + k * (ev.width ?? 20);
        let hy = (ev.y ?? 2);
        if (ev.formation === 'vee') hy += Math.abs(k) * 6;
        if (ev.formation === 'arc') hy += (0.25 - k * k) * 10;
        if (ev.formation === 'column') { hx = ev.x ?? 0; hy = (ev.y ?? 0) + k * 10; }
        const from = ev.from ?? 'ahead';
        const sx = from === 'left' ? -60 : from === 'right' ? 60 : hx * 1.6;
        const sy = from === 'above' ? 40 : from === 'below' ? -30 : hy + 14;
        const c = R.enemies.craft;
        this._spawn({
          kind: ev.wave,
          rel: new THREE.Vector3(sx, sy, -(c.spawnAhead ?? 260) - i * 8),
          from: new THREE.Vector3(sx, sy, -(c.spawnAhead ?? 260) - i * 8),
          hold: new THREE.Vector3(hx, hy, -(ev.dist ?? R.enemies.craft.holdAhead ?? 80) - Math.abs(k) * 14),
          stay: ev.stay ?? c.stay ?? 5,
          delay: i * (ev.stagger ?? 0.25),
          hp: c.hp, r: c.radius, score: c.score,
          fireEvery: c.fireEvery, phase: this.rng.float() * 6.28,
        });
      }
    }
    if (ev.turrets) {
      const t = R.enemies.turret;
      for (const [x, y, ahead = 0] of ev.turrets) {
        this._spawn({
          kind: 'turret',
          pos: new THREE.Vector3(x, y, -(d + (t.spawnAhead ?? 300) + ahead)),
          hp: t.hp, r: t.radius, score: t.score, fireEvery: t.fireEvery,
          side: Math.sign(x) || 0, phase: this.rng.float() * t.fireEvery,
        });
      }
    }
    if (ev.bar) {
      const bar = { y: ev.bar.y, h: ev.bar.h, z: -(d + (R.barAhead ?? 320)), hit: false };
      this.bars.push(bar);
      this.ctx.events.emit('bar:spawn', { bar });
    }
  }

  _spawn(o) {
    const e = { id: this._id++, alive: true, t: 0, fireT: o.phase ?? 1, maxHp: o.hp, pos: o.pos ?? new THREE.Vector3(), ...o };
    if (e.rel) e.pos.copy(e.rel).add(this.ship.anchor);
    this.enemies.push(e);
    this.ctx.events.emit('enemy:spawn', { e });
    return e;
  }

  _spawnBoss() {
    const B = this.rules.boss;
    const center = new THREE.Vector3(0, B.y ?? 0, -(B.at + B.ahead));
    const boss = { center, open: false, dead: false, nodes: [], core: null, t: 0 };
    for (const [x, y, z = 0] of B.nodes) {
      boss.nodes.push(this._spawn({
        kind: 'node', pos: new THREE.Vector3(x, y, z).add(center), hp: B.nodeHp, r: B.nodeRadius, score: B.nodeScore,
        fireEvery: B.nodeFireEvery, phase: 1 + boss.nodes.length * (B.nodeFireEvery / B.nodes.length), boss,
      }));
    }
    boss.core = this._spawn({
      kind: 'core', pos: center.clone().add(new THREE.Vector3(0, 0, B.coreZ ?? 0)), hp: B.coreHp, r: B.coreRadius,
      score: B.coreScore, fireEvery: B.coreFireEvery, phase: 2, armored: true, boss,
    });
    this.boss = boss;
    this.ctx.events.emit('boss:spawn', { boss });
  }

  /** The boss fights only once the ship is close. */
  get bossActive() {
    return !!this.boss && this.ship.distance >= this.rules.boss.at - (this.rules.boss.wakeAt ?? 70);
  }

  // ------------------------------------------------------------------ enemies
  _stepEnemies(dt) {
    const s = this.ship;
    const R = this.rules;
    const playing = this.state === 'playing' && !this.dead;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      if (e.rel) {
        // Craft: enter to the hold point, sway there, then climb away ahead.
        const tt = e.t - e.delay;
        if (tt < 0) {
          e.rel.copy(e.from);
        } else if (tt < 2.2) {
          e.rel.lerpVectors(e.from, e.hold, smooth(tt / 2.2));
        } else if (tt < 2.2 + e.stay) {
          const w = tt - 2.2;
          e.rel.copy(e.hold);
          e.rel.x += Math.sin(w * 1.3 + e.phase) * 3.2;
          e.rel.y += Math.sin(w * 0.9 + e.phase * 1.7) * 1.8;
        } else {
          const w = tt - 2.2 - e.stay;
          e.rel.z -= (30 + w * 90) * dt;
          e.rel.y += (8 + w * 16) * dt;
          if (e.rel.z < -480) { e.alive = false; e.gone = true; }
        }
        e.vel ??= new THREE.Vector3();
        const before = e.pos.clone();
        e.pos.copy(e.rel).add(s.anchor);
        if (dt > 0) e.vel.subVectors(e.pos, before).divideScalar(dt);
        const canFire = tt > 2.2 && tt < 2.2 + e.stay;
        if (playing && canFire) this._fire(e, dt, R.enemies.craft);
        // Ram.
        if (playing && e.pos.distanceTo(s.position) < e.r + 1) {
          this._damage(R.enemies.craft.ram ?? 14, e.pos);
          this._kill(e, false);
        }
      } else if (e.kind === 'turret') {
        const rel = e.pos.z - s.position.z; // negative ahead
        if (rel > 30) { e.alive = false; e.gone = true; continue; }
        if (playing && rel < -35 && rel > -200) this._fire(e, dt, R.enemies.turret);
      } else if (e.kind === 'node' || e.kind === 'core') {
        if (!this.bossActive || e.boss.dead) continue;
        if (e.kind === 'core' && e.armored) continue;
        if (playing) this._fire(e, dt, R.boss, e.kind);
      }
    }
    if (this.boss) this.boss.t += dt;
    // Drop the dead.
    for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].alive) this.enemies.splice(i, 1);
  }

  _fire(e, dt, spec, bossPart) {
    e.fireT -= dt;
    if (e.fireT > 0) return;
    e.fireT = e.fireEvery * (0.8 + this.rng.float() * 0.4);
    const s = this.ship;
    const speed = spec.boltSpeed ?? 48;
    // Aim in the rail's frame at where the ship is, with a little scatter.
    const scatter = spec.scatter ?? 1.2;
    const aim = s.position.clone().add(new THREE.Vector3((this.rng.float() - 0.5) * scatter * 2, (this.rng.float() - 0.5) * scatter * 2, 0));
    const dir = aim.sub(e.pos).normalize();
    const railV = new THREE.Vector3(0, 0, -s.speed);
    const out = (d) => {
      const pos = e.pos.clone().addScaledVector(d, e.r * 0.8);
      this.shots.push({ pos, prev: pos.clone(), vel: d.clone().multiplyScalar(speed).add(railV), age: 0, big: !!bossPart });
    };
    if (bossPart === 'core') {
      const n = spec.coreRing ?? 10;
      const side = new THREE.Vector3(1, 0, 0);
      const up = new THREE.Vector3(0, 1, 0);
      const spin = this.boss.t * 0.7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + spin;
        out(dir.clone().addScaledVector(side, Math.cos(a) * 0.16).addScaledVector(up, Math.sin(a) * 0.16).normalize());
      }
    } else if (bossPart === 'node') {
      const side = new THREE.Vector3(1, 0, 0);
      for (const k of [-1, 0, 1]) out(dir.clone().addScaledVector(side, k * 0.07).normalize());
    } else out(dir);
    this.ctx.events.emit('enemy:fire', { e, pos: e.pos, boss: !!bossPart });
  }

  // ------------------------------------------------------------------ bolts
  _stepBolts(dt) {
    const s = this.ship;
    const R = this.rules;
    // Player bolts against enemies.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.age += dt;
      let hit = null;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.kind === 'node' || e.kind === 'core') {
          if (!this.bossActive) continue;
        }
        if (segDist(b.prev, b.pos, e.pos) < e.r) {
          hit = e;
          break;
        }
      }
      // Bars stop bolts too.
      if (!hit) {
        for (const bar of this.bars) {
          if (b.prev.z > bar.z && b.pos.z <= bar.z && Math.abs(b.pos.y - bar.y) < bar.h / 2) {
            hit = bar;
            break;
          }
        }
      }
      if (hit || b.age > 1.3) {
        this.bolts.splice(i, 1);
        if (hit && hit.alive) this._hitEnemy(hit, b.pos);
        else if (hit) this.ctx.events.emit('bar:spark', { pos: b.pos.clone() });
      }
    }
    // Enemy bolts against the ship.
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.age += dt;
      let gone = b.age > 6 || b.pos.z - s.position.z > 25;
      if (!gone && this.state === 'playing' && !this.dead && segDist(b.prev, b.pos, s.position) < (R.shipRadius ?? 1.1)) {
        gone = true;
        this._damage(b.big ? R.boss.damage ?? 9 : R.enemies.damage ?? 7, b.pos);
      }
      if (gone) this.shots.splice(i, 1);
    }
  }

  _hitEnemy(e, pos) {
    if (e.armored) {
      this.ctx.events.emit('enemy:hit', { e, pos: pos.clone(), armored: true });
      return;
    }
    e.hp -= 1;
    this.hits++;
    this.ctx.events.emit('enemy:hit', { e, pos: pos.clone() });
    if (e.hp <= 0) this._kill(e, true);
  }

  _kill(e, scored) {
    e.alive = false;
    if (scored && this.state === 'playing') {
      this.score += e.score ?? 100;
      this.kills++;
    }
    this.ctx.events.emit('enemy:die', { e, pos: e.pos.clone() });
    const boss = e.boss;
    if (!boss) return;
    if (e.kind === 'node' && boss.nodes.every((n) => !n.alive) && !boss.open) {
      boss.open = true;
      boss.core.armored = false;
      boss.core.fireT = 1.2;
      this.ctx.events.emit('boss:open', { boss });
    }
    if (e.kind === 'core') {
      boss.dead = true;
      this.shots.length = 0;
      this.ctx.events.emit('boss:die', { pos: e.pos.clone(), boss });
      if (this.state === 'playing') {
        this.score += Math.round(this.hull) * (this.rules.hullBonus ?? 20);
        this.state = 'won';
        this.ctx.input.clearSource('bot');
        this.ctx.events.emit('round:won', { score: this.score, time: this.elapsed, hull: this.hull, kills: this.kills });
      }
    }
  }

  _checkBars(prevZ) {
    const s = this.ship;
    for (const bar of this.bars) {
      if (bar.hit) continue;
      if (prevZ > bar.z && s.position.z <= bar.z) {
        if (Math.abs(s.position.y - bar.y) < bar.h / 2 + (this.rules.shipRadius ?? 1.1) * 0.8) {
          bar.hit = true;
          this.ctx.events.emit('bar:scrape', { pos: s.position.clone() });
          this._damage(this.rules.barDamage ?? 18, s.position);
        }
      }
    }
    for (let i = this.bars.length - 1; i >= 0; i--) if (this.bars[i].z - s.position.z > 60) this.bars.splice(i, 1);
  }

  _damage(n, pos) {
    if (this.state !== 'playing' || this.dead || this.invuln > 0) return;
    this.hull = Math.max(0, this.hull - n);
    this.invuln = this.rules.invulnerable ?? 0.4;
    this.ctx.events.emit('player:hit', { pos: pos.clone(), damage: n, hull: this.hull });
    if (this.hull <= 0) {
      this.dead = true;
      this.ctx.events.emit('player:die', { pos: this.ship.position.clone() });
      this.lose('hull');
    }
  }
}
