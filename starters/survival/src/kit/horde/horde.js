import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';
import { SpatialHash } from './spatial.js';

/**
 * The swarm of a survivors-like: a few hundred enemies drawn with one
 * instanced mesh per kind (body, glowing parts, and one shared mesh for every
 * blob shadow), so the draw count stays flat however many come. Each enemy
 * walks straight at the player, keeps apart from its neighbours through a
 * spatial hash, hurts on touch, flashes and is shoved when hit, and shrinks
 * into the ground when it dies.
 *
 * A kind (src/game/enemies.js):
 *   { id, name, hp, speed, radius, damage, xp, mass, max, scale: [min, max],
 *     fly (height), wobble, gait, boss, blood, glow,
 *     charge: { every, windup, time, speed },        optional lunge
 *     body: (THREE, rng) => ({ geometry, glow, roughness, metalness }) }
 *   geometry carries vertex colours; glow is drawn unlit and bright for the bloom.
 *
 *   horde.spawn(type, x, z, { hp })      horde.alive      horde.clear()
 *   horde.query(x, z, r, fn)             every live enemy within r (exact)
 *   horde.nearest(x, z, r)               the closest live enemy, or null
 *   horde.damage(e, amount, dx, dz, knock) -> killed?
 *
 * Events: enemy:spawned, enemy:hit { enemy, damage, kill }, enemy:killed { enemy, x, z, def }
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class HordeSystem {
  static id = 'horde';
  static deps = ['arena', 'player', 'fx', 'audio'];

  constructor({ defs }) {
    this.list = defs;
    this.defs = Object.fromEntries(defs.map((d) => [d.id, d]));
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.alive = [];
    this.dying = [];
    this.nextId = 1;
    this.boss = null;
    this.stats = { spawned: 0, killed: 0 };
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.kinds = {};
    const shadows = ctx.config.q.shadowSize > 0;
    let total = 0;
    for (const def of this.list) {
      const max = def.max ?? 160;
      total += max;
      const made = def.body(THREE, this.rng.fork());
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: made.roughness ?? 0.55, metalness: made.metalness ?? 0.05, envMapIntensity: 0.6 });
      if (def.rim) {
        // a faint cold edge so dark bodies still read against a dark floor
        const rim = new THREE.Color(def.rim).multiplyScalar(def.rimStrength ?? 0.5);
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.rimColor = { value: rim };
          sh.fragmentShader = sh.fragmentShader
            .replace('void main() {', 'uniform vec3 rimColor;\nvoid main() {')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += rimColor * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);');
        };
        mat.customProgramCacheKey = () => `rim-${def.id}`;
      }
      const body = new THREE.InstancedMesh(made.geometry, mat, max);
      body.castShadow = shadows && !def.fly;
      body.receiveShadow = false;
      body.frustumCulled = false;
      body.count = 0;
      for (let i = 0; i < max; i++) body.setColorAt(i, _c.setRGB(1, 1, 1));
      this.group.add(body);
      let glow = null;
      if (made.glow) {
        glow = new THREE.InstancedMesh(made.glow, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.glow ?? '#9fffe0').multiplyScalar(def.glowIntensity ?? 3), fog: false }), max);
        glow.frustumCulled = false;
        glow.count = 0;
        this.group.add(glow);
      }
      this.kinds[def.id] = { def, body, glow, max, live: 0 };
    }
    // one mesh for every soft shadow under the swarm
    const blob = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(64), color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      total,
    );
    blob.frustumCulled = false;
    blob.count = 0;
    blob.renderOrder = 1;
    this.group.add(blob);
    this.blob = blob;
    this.grid = null;
    this._sounds = { hit: 0, kill: 0 };
  }

  _grid() {
    if (!this.grid) {
      const f = this.ctx.get('arena').field;
      this.grid = new SpatialHash({ minX: f.minX - 4, minZ: f.minZ - 4, maxX: f.maxX + 4, maxZ: f.maxZ + 4 }, 2, 1024);
    }
    return this.grid;
  }

  count(type) {
    let n = 0;
    for (const e of this.alive) if (e.def.id === type) n++;
    return n;
  }

  spawn(type, x, z, { hp = 1 } = {}) {
    const def = this.defs[type];
    if (!def) throw new Error(`unknown enemy "${type}"`);
    const kind = this.kinds[type];
    if (kind.live >= kind.max) return null;
    kind.live++;
    const [s0, s1] = def.scale ?? [0.92, 1.08];
    const e = {
      id: this.nextId++, def, x, z, vx: 0, vz: 0, kx: 0, kz: 0,
      hp: def.hp * hp, maxHp: def.hp * hp, flash: 0, cd: 0, t: 0, dead: false,
      gait: this.rng.range(0, 6), yaw: Math.atan2(-x, -z), scale: this.rng.range(s0, s1),
      tint: this.rng.range(0.82, 1.12), pace: this.rng.range(0.9, 1.1), seed: this.rng.range(0, 100),
      charge: def.charge ? { t: def.charge.every * this.rng.range(0.5, 1), state: 'walk', dx: 0, dz: 0 } : null,
    };
    this.alive.push(e);
    if (def.boss) this.boss = e;
    this.stats.spawned++;
    this.ctx.events.emit('enemy:spawned', { enemy: e });
    return e;
  }

  clear() {
    for (const k of Object.values(this.kinds)) k.live = 0;
    this.alive = [];
    this.dying = [];
    this.boss = null;
    this._draw();
  }

  /** Every live enemy whose circle touches (x, z, r). */
  query(x, z, r, visit) {
    const list = this.alive;
    const pad = 1.6; // the largest common radius; bosses are checked below
    this._grid().query(x, z, r + pad, (i) => {
      const e = list[i];
      if (!e || e.dead) return;
      const rr = r + e.def.radius * e.scale;
      const dx = e.x - x;
      const dz = e.z - z;
      if (dx * dx + dz * dz <= rr * rr) visit(e);
    });
    const b = this.boss;
    if (b && !b.dead && b.def.radius * b.scale > pad) {
      const rr = r + b.def.radius * b.scale;
      if ((b.x - x) ** 2 + (b.z - z) ** 2 <= rr * rr) visit(b);
    }
  }

  nearest(x, z, r = Infinity, skip = null) {
    let best = null;
    let bd = r * r;
    for (const e of this.alive) {
      if (skip && skip.has(e)) continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  damage(e, amount, dx = 0, dz = 0, knock = 1) {
    if (e.dead) return false;
    const def = e.def;
    e.hp -= amount;
    e.flash = 1;
    const shove = (knock * 5) / (def.mass ?? 1);
    e.kx += dx * shove;
    e.kz += dz * shove;
    const killed = e.hp <= 0;
    const fx = this.ctx.get('fx');
    const h = (def.fly ?? 0) + (def.height ?? 0.8) * 0.6 * e.scale;
    fx.burst([e.x, h, e.z], { count: 4, color: def.blood ?? '#2a1d14', speed: 3.5, life: 0.4, size: 0.1, gravity: -14, additive: false, dir: [dx, 0.5, dz], spread: 0.8 });
    this.ctx.events.emit('enemy:hit', { enemy: e, damage: amount, x: e.x, z: e.z, kill: killed });
    const now = this.ctx.time.elapsed;
    if (!killed && now - this._sounds.hit > 0.07) {
      this._sounds.hit = now;
      this.ctx.get('audio').play('hit');
    }
    if (killed) this._kill(e, dx, dz);
    return killed;
  }

  _kill(e, dx, dz) {
    e.dead = true;
    e.t = 0;
    this.alive.splice(this.alive.indexOf(e), 1);
    this.dying.push(e);
    this.kinds[e.def.id].live--;
    if (this.boss === e) this.boss = null;
    this.stats.killed++;
    const def = e.def;
    const fx = this.ctx.get('fx');
    const h = (def.fly ?? 0) + (def.height ?? 0.8) * 0.5 * e.scale;
    const big = def.boss ? 4 : 1;
    fx.burst([e.x, h, e.z], { count: 10 * big, color: def.blood ?? '#2a1d14', speed: 5 * Math.sqrt(big), life: 0.55, size: 0.13 * Math.sqrt(big), gravity: -14, additive: false, dir: [dx, 0.6, dz], spread: 1 });
    if (def.glow) fx.burst([e.x, h, e.z], { count: 8 * big, color: def.glow, speed: 2.6 * Math.sqrt(big), life: 0.7, size: 0.1 * Math.sqrt(big), gravity: 1.2, spread: 1 });
    fx.mark([e.x, 0.01, e.z], [0, 1, 0], { color: def.stain ?? '#0d0a08', size: def.radius * e.scale * this.rng.range(1.4, 2.2) });
    const now = this.ctx.time.elapsed;
    if (def.boss || now - this._sounds.kill > 0.05) {
      this._sounds.kill = now;
      this.ctx.get('audio').play(def.boss ? 'bosskill' : 'kill');
    }
    if (def.boss) this.ctx.get('camera')?.shake(0.6);
    this.ctx.events.emit('enemy:killed', { enemy: e, x: e.x, z: e.z, def });
  }

  update(dt, ctx) {
    if (dt <= 0) {
      this._draw();
      return;
    }
    // on the title the crowd waits at the edge of the light, swaying
    if (ctx.get('round').state === 'title') {
      for (const e of this.alive) e.gait += dt * 0.9;
      this._draw();
      return;
    }
    const arena = ctx.get('arena');
    const p = ctx.get('player');
    const pr = p.cfg?.radius ?? 0.42;
    const list = this.alive;
    const grid = this._grid();
    grid.clear();
    for (let i = 0; i < list.length; i++) grid.insert(i, list[i].x, list[i].z);

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const def = e.def;
      const r = def.radius * e.scale;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.cd = Math.max(0, e.cd - dt);
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 1e-3;
      let sx = dx / dist;
      let sz = dz / dist;
      let speed = def.speed * e.pace;

      if (def.wobble) {
        // weave across the line to the player
        const w = Math.sin(e.t * 2.3 + e.seed) * def.wobble;
        sx += -sz * w;
        sz += (dx / dist) * w;
      }
      const ch = e.charge;
      if (ch) {
        ch.t -= dt;
        if (ch.state === 'walk' && ch.t <= 0 && dist < 16) {
          ch.state = 'windup';
          ch.t = def.charge.windup;
          ch.dx = sx;
          ch.dz = sz;
          ctx.get('audio').play('bellow');
          ctx.events.emit('enemy:windup', { enemy: e });
        } else if (ch.state === 'windup') {
          speed *= 0.05;
          ch.dx = sx;
          ch.dz = sz;
          if (ch.t <= 0) {
            ch.state = 'charge';
            ch.t = def.charge.time;
          }
        } else if (ch.state === 'charge') {
          sx = ch.dx;
          sz = ch.dz;
          speed = def.charge.speed;
          if (ch.t <= 0) {
            ch.state = 'walk';
            ch.t = def.charge.every;
          }
        }
      }

      // keep apart: neighbours from the grid
      const want = r * 2.1;
      grid.query(e.x, e.z, want + 0.6, (j) => {
        if (j === i) return;
        const o = list[j];
        const ox = e.x - o.x;
        const oz = e.z - o.z;
        const need = r + o.def.radius * o.scale + 0.08;
        const d2 = ox * ox + oz * oz;
        if (d2 < need * need && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = ((need - d) / need) * 2.2;
          sx += (ox / d) * push;
          sz += (oz / d) * push;
        }
      });
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;

      const k = 1 - Math.exp(-6 * dt);
      e.vx += (sx * speed - e.vx) * k;
      e.vz += (sz * speed - e.vz) * k;
      const kd = Math.exp(-8 * dt);
      e.kx *= kd;
      e.kz *= kd;
      const pos = { x: e.x + (e.vx + e.kx) * dt, z: e.z + (e.vz + e.kz) * dt };
      // nobody stands inside the player: they crowd round instead
      const reach = r + pr;
      const qx = pos.x - p.x;
      const qz = pos.z - p.z;
      const qd = Math.hypot(qx, qz);
      if (qd < reach && qd > 1e-4 && !p.dead) {
        pos.x = p.x + (qx / qd) * reach;
        pos.z = p.z + (qz / qd) * reach;
      }
      if (!def.fly) arena.resolve(pos, r);
      const moved = Math.hypot(pos.x - e.x, pos.z - e.z);
      e.x = pos.x;
      e.z = pos.z;
      e.gait += moved * (def.gait ?? 3);

      // touch: hurt the player
      if (dist < reach + 0.18 && e.cd <= 0 && !p.dead && ctx.get('round').state === 'playing') {
        e.cd = def.touchCooldown ?? 0.8;
        if (p.applyDamage(def.damage, null)) {
          ctx.get('camera')?.shake(def.boss ? 0.5 : 0.15);
          ctx.events.emit('enemy:attack', { enemy: e });
        }
      }
      const face = Math.atan2(e.vx, e.vz);
      let dy = face - e.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      e.yaw += dy * Math.min(1, dt * (def.turn ?? 8));
    }

    for (let i = this.dying.length - 1; i >= 0; i--) {
      const e = this.dying[i];
      e.t += dt;
      e.kx *= Math.exp(-7 * dt);
      e.kz *= Math.exp(-7 * dt);
      e.x += e.kx * dt;
      e.z += e.kz * dt;
      if (e.t > (e.def.boss ? 1.2 : 0.34)) this.dying.splice(i, 1);
    }
    this._draw();
  }

  /** Write every live and dying enemy into its kind's instances. */
  _draw() {
    const t = this.ctx.time.elapsed;
    for (const k of Object.values(this.kinds)) k.n = 0;
    let nb = 0;
    const put = (e, dyingT) => {
      const k = this.kinds[e.def.id];
      if (k.n >= k.max) return;
      const def = e.def;
      const i = k.n++;
      const stride = Math.sin(e.gait);
      const bob = Math.abs(stride) * (def.bob ?? 0.06);
      let s = e.scale;
      let y = bob + (def.fly ? def.fly + Math.sin(t * 2.2 + e.seed) * 0.25 : 0);
      let roll = stride * (def.waddle ?? 0.08);
      let pitch = def.lean ?? 0.08;
      const ch = e.charge;
      if (ch?.state === 'windup') {
        pitch -= 0.25;
        roll += Math.sin(t * 40) * 0.05;
      } else if (ch?.state === 'charge') pitch += 0.2;
      let squash = 1 + Math.sin(e.gait * 2) * (def.squash ?? 0.04);
      if (dyingT !== null) {
        const f = Math.min(1, dyingT / (def.boss ? 1.2 : 0.34));
        s *= 1 - f * 0.85;
        y -= f * 0.3;
        squash *= 1 - f * 0.4;
        roll += f * 0.6;
      }
      _e.set(pitch, e.yaw, roll);
      _q.setFromEuler(_e);
      _m.compose(_p.set(e.x, y, e.z), _q, _s.set(s, s * squash, s));
      k.body.setMatrixAt(i, _m);
      const f = dyingT !== null ? 1 : e.flash;
      const tint = e.tint;
      k.body.setColorAt(i, _c.setRGB(tint + f * 3, tint + f * 2.6, tint + f * 2.2));
      if (k.glow) k.glow.setMatrixAt(i, _m);
      // shadow on the ground under it
      if (nb < this.blob.instanceMatrix.count) {
        const r = def.radius * s * (def.fly ? 1.6 : 2.4);
        _q.identity();
        _m.compose(_p.set(e.x, 0.02, e.z), _q, _s.set(r, 1, r));
        this.blob.setMatrixAt(nb++, _m);
      }
    };
    for (const e of this.alive) put(e, null);
    for (const e of this.dying) put(e, e.t);
    for (const k of Object.values(this.kinds)) {
      k.body.count = k.n;
      k.body.instanceMatrix.needsUpdate = true;
      if (k.body.instanceColor) k.body.instanceColor.needsUpdate = true;
      if (k.glow) {
        k.glow.count = k.n;
        k.glow.instanceMatrix.needsUpdate = true;
      }
    }
    this.blob.count = nb;
    this.blob.instanceMatrix.needsUpdate = true;
  }
}
