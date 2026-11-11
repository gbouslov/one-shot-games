import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Weapons that fire by themselves, and passives that change the player. The
 * player only moves; everything here picks its own targets. Four behaviours,
 * each driven by numbers per level from src/game/weapons.js:
 *
 *   bolt     glowing shots at the nearest enemies     { cooldown, damage, count, speed, pierce, range, size, knock }
 *   orbit    lights circling the player, hurt on touch { count, radius, damage, spin, size, knock, every }
 *   pulse    a ring that rolls out from the player     { cooldown, radius, damage, knock, speed }
 *   strike   lightning on enemies near the player     { cooldown, count, damage, range, splash }
 *   passive  totals per level                          { health, regen, speed, pickup, might, haste }
 *
 * A def: { id, name, kind, color, text: [per level], levels: [stats per level],
 *          evolve: { needs: '<passive id>', into: '<def id>' }, evolution: true }
 *
 *   arsenal.reset(['bolt'])   arsenal.owned   arsenal.level(id)
 *   arsenal.options()         every upgrade that could be offered now
 *   arsenal.take(option)      add, level up or evolve
 *
 * Events: weapon:fire { def, x, y, z, dx, dz }. Stats: shots, hits, kills.
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _f = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const _c = new THREE.Color();

export class ArsenalSystem {
  static id = 'arsenal';
  static deps = ['player', 'horde', 'fx', 'audio'];

  constructor({ defs, maxWeapons = 4, maxPassives = 3 }) {
    this.list = defs;
    this.defs = Object.fromEntries(defs.map((d) => [d.id, d]));
    this.maxWeapons = maxWeapons;
    this.maxPassives = maxPassives;
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.owned = [];
    this.shots = [];
    this.rings = [];
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this.mods = { might: 1, haste: 1 };
    const p = ctx.get('player');
    this.base = { maxHealth: p.cfg.maxHealth, speed: p.cfg.speed, regen: p.cfg.regen ?? 0, pickup: p.cfg.pickup ?? 2.2 };
    p.pickup = this.base.pickup;

    // bolts: one instanced mesh of stretched glowing drops
    const drop = new THREE.SphereGeometry(1, 8, 6);
    drop.scale(0.55, 0.55, 1.6);
    this.boltMesh = new THREE.InstancedMesh(drop, new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), 96);
    this.boltMesh.frustumCulled = false;
    this.boltMesh.count = 0;
    for (let i = 0; i < 96; i++) this.boltMesh.setColorAt(i, _c.setRGB(1, 1, 1));
    ctx.scene.add(this.boltMesh);
    // orbiters
    this.orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), 24);
    this.orbMesh.frustumCulled = false;
    this.orbMesh.count = 0;
    for (let i = 0; i < 24; i++) this.orbMesh.setColorAt(i, _c.setRGB(1, 1, 1));
    ctx.scene.add(this.orbMesh);
    this.orbHalo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(64), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      24,
    );
    this.orbHalo.frustumCulled = false;
    this.orbHalo.count = 0;
    for (let i = 0; i < 24; i++) this.orbHalo.setColorAt(i, _c.setRGB(1, 1, 1));
    ctx.scene.add(this.orbHalo);
    // pulse rings: a few pooled flat rings
    const ringGeo = new THREE.RingGeometry(0.86, 1, 72).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 5;
      ctx.scene.add(mesh);
      this.rings.push({ mesh, live: false, r: 0, max: 1, hit: new Set(), damage: 0, knock: 0, speed: 1, color: '#fff' });
    }
  }

  level(id) {
    return this.owned.find((o) => o.def.id === id)?.level ?? 0;
  }

  reset(start = []) {
    this.owned = [];
    this.shots = [];
    for (const r of this.rings) {
      r.live = false;
      r.mesh.visible = false;
    }
    this.stats = { shots: 0, hits: 0, kills: 0 };
    for (const id of start) this._add(this.defs[id]);
    this._passives(false);
    this._draw();
  }

  _add(def) {
    this.owned.push({ def, level: 1, timer: 0.4, angle: 0, hits: new Map() });
  }

  /** Every choice that could be offered now: new things, next levels, evolutions. */
  options() {
    const out = [];
    const weapons = this.owned.filter((o) => o.def.kind !== 'passive').length;
    const passives = this.owned.filter((o) => o.def.kind === 'passive').length;
    for (const def of this.list) {
      if (def.evolution) continue;
      const o = this.owned.find((x) => x.def.id === def.id);
      if (o) {
        if (o.level < def.levels.length) out.push({ id: def.id, def, level: o.level + 1, kind: 'up', text: def.text[o.level] });
      } else if (!this.owned.some((x) => x.def.evolvedFrom === def.id)) {
        const room = def.kind === 'passive' ? passives < this.maxPassives : weapons < this.maxWeapons;
        if (room) out.push({ id: def.id, def, level: 1, kind: 'new', text: def.text[0] });
      }
    }
    for (const o of this.owned) {
      const ev = o.def.evolve;
      if (ev && o.level >= o.def.levels.length && this.level(ev.needs) > 0) {
        const into = this.defs[ev.into];
        out.push({ id: into.id, def: into, level: 1, kind: 'evolve', from: o.def.id, text: into.text[0] });
      }
    }
    return out;
  }

  take(opt) {
    if (opt.kind === 'new') this._add(opt.def);
    else if (opt.kind === 'up') this.owned.find((o) => o.def.id === opt.id).level++;
    else if (opt.kind === 'evolve') {
      const o = this.owned.find((x) => x.def.id === opt.from);
      o.def = { ...opt.def, evolvedFrom: opt.from };
      o.level = 1;
      o.timer = 0;
    }
    if (opt.def.kind === 'passive') this._passives(true);
    this.ctx.events.emit('arsenal:changed', { option: opt });
  }

  /** Sum the passives into the player and the global modifiers. */
  _passives(heal) {
    const t = { health: 0, regen: 0, speed: 0, pickup: 0, might: 0, haste: 0 };
    for (const o of this.owned) {
      if (o.def.kind !== 'passive') continue;
      const s = o.def.levels[o.level - 1];
      for (const k of Object.keys(t)) t[k] += s[k] ?? 0;
    }
    const p = this.ctx.get('player');
    const before = p.maxHealth;
    p.maxHealth = this.base.maxHealth + t.health;
    if (heal) p.health = Math.min(p.maxHealth, p.health + Math.max(0, p.maxHealth - before) + 10);
    else p.health = Math.min(p.health, p.maxHealth);
    p.cfg.speed = this.base.speed * (1 + t.speed);
    p.cfg.regen = this.base.regen + t.regen;
    p.pickup = this.base.pickup * (1 + t.pickup);
    this.mods.might = 1 + t.might;
    this.mods.haste = 1 / (1 + t.haste);
  }

  _stats(o) {
    return o.def.levels[Math.min(o.level, o.def.levels.length) - 1];
  }

  _hit(e, dmg, dx, dz, knock) {
    const horde = this.ctx.get('horde');
    this.stats.hits++;
    const killed = horde.damage(e, dmg * this.mods.might, dx, dz, knock);
    if (killed) this.stats.kills++;
    return killed;
  }

  _fired(def, x, z, dx = 0, dz = 0) {
    this.stats.shots++;
    this.ctx.events.emit('weapon:fire', { def, x, y: 1.1, z, dx, dz });
  }

  update(dt, ctx) {
    const p = ctx.get('player');
    const horde = ctx.get('horde');
    const fx = ctx.get('fx');
    const audio = ctx.get('audio');
    const active = ctx.get('round').state === 'playing' && !p.dead && dt > 0;
    const t = ctx.time.elapsed;

    if (active) {
      for (const o of this.owned) {
        const def = o.def;
        const s = this._stats(o);
        if (def.kind === 'bolt') {
          o.timer -= dt;
          if (o.timer > 0) continue;
          const taken = new Set();
          let fired = 0;
          for (let k = 0; k < s.count; k++) {
            const e = horde.nearest(p.x, p.z, s.range, taken) ?? (taken.size ? [...taken][k % taken.size] : null);
            if (!e) break;
            taken.add(e);
            const lead = Math.hypot(e.x - p.x, e.z - p.z) / s.speed;
            const ax = e.x + e.vx * lead * 0.6 - p.x;
            const az = e.z + e.vz * lead * 0.6 - p.z;
            const l = Math.hypot(ax, az) || 1;
            const spread = (k - (s.count - 1) / 2) * 0.06;
            const a = Math.atan2(ax / l, az / l) + spread;
            const dx = Math.sin(a);
            const dz = Math.cos(a);
            this.shots.push({ def, x: p.x + dx * 0.5, z: p.z + dz * 0.5, dx, dz, speed: s.speed, life: s.range / s.speed + 0.15, damage: s.damage, pierce: s.pierce ?? 0, size: s.size ?? 0.14, knock: s.knock ?? 0.6, hit: new Set(), color: def.color });
            fired++;
          }
          if (fired) {
            o.timer = s.cooldown * this.mods.haste;
            const sh = this.shots[this.shots.length - 1];
            fx.flash([p.x + sh.dx * 0.6, 1.3, p.z + sh.dz * 0.6], { color: def.color, intensity: 14, distance: 7, life: 0.08 });
            audio.play(def.sound ?? 'bolt');
            this._fired(def, p.x, p.z, sh.dx, sh.dz);
          } else o.timer = 0.1;
        } else if (def.kind === 'orbit') {
          o.angle += s.spin * dt;
          for (let k = 0; k < s.count; k++) {
            const a = o.angle + (k / s.count) * Math.PI * 2;
            const x = p.x + Math.cos(a) * s.radius;
            const z = p.z + Math.sin(a) * s.radius;
            horde.query(x, z, s.size + 0.15, (e) => {
              const last = o.hits.get(e) ?? -1;
              if (t - last < (s.every ?? 0.5)) return;
              o.hits.set(e, t);
              const dx = e.x - p.x;
              const dz = e.z - p.z;
              const l = Math.hypot(dx, dz) || 1;
              this._hit(e, s.damage, dx / l, dz / l, s.knock ?? 0.8);
              fx.burst([x, 1, z], { count: 4, color: def.color, speed: 3, life: 0.3, size: 0.08, gravity: -3 });
            });
          }
          if (o.hits.size > 400) o.hits.clear();
          o.timer -= dt;
          if (o.timer <= 0) {
            o.timer = 1.2;
            this._fired(def, p.x, p.z);
          }
        } else if (def.kind === 'pulse') {
          o.timer -= dt;
          if (o.timer > 0) continue;
          o.timer = s.cooldown * this.mods.haste;
          const r = this.rings.find((x) => !x.live) ?? this.rings[0];
          r.live = true;
          r.x = p.x;
          r.z = p.z;
          r.r = 0.4;
          r.max = s.radius;
          r.speed = s.speed ?? s.radius / 0.4;
          r.damage = s.damage;
          r.knock = s.knock ?? 2;
          r.color = def.color;
          r.hit.clear();
          r.mesh.material.color.set(def.color).multiplyScalar(2.2);
          r.mesh.visible = true;
          fx.flash([p.x, 1.5, p.z], { color: def.color, intensity: 40, distance: s.radius * 1.8, life: 0.35 });
          audio.play(def.sound ?? 'toll');
          ctx.get('camera').shake(0.12);
          this._fired(def, p.x, p.z);
        } else if (def.kind === 'strike') {
          o.timer -= dt;
          if (o.timer > 0) continue;
          const near = [];
          for (const e of horde.alive) if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 < s.range * s.range) near.push(e);
          if (!near.length) {
            o.timer = 0.2;
            continue;
          }
          o.timer = s.cooldown * this.mods.haste;
          for (let k = 0; k < s.count && near.length; k++) {
            const e = near.splice(this.rng.int(0, near.length - 1), 1)[0];
            this._bolt(e.x, e.z, def.color);
            const ex = e.x;
            const ez = e.z;
            this._hit(e, s.damage, 0, 0, 0.2);
            if (s.splash) horde.query(ex, ez, s.splash, (o2) => { if (o2 !== e) this._hit(o2, s.damage * 0.5, o2.x - ex, o2.z - ez, 0.6); });
          }
          audio.play(def.sound ?? 'crack');
          ctx.get('camera').shake(0.1);
          this._fired(def, p.x, p.z);
        }
      }

      // bolts in flight
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const b = this.shots[i];
        b.life -= dt;
        const step = b.speed * dt;
        b.x += b.dx * step;
        b.z += b.dz * step;
        let gone = b.life <= 0;
        if (!gone) {
          horde.query(b.x, b.z, b.size + 0.12, (e) => {
            if (gone || b.hit.has(e)) return;
            b.hit.add(e);
            this._hit(e, b.damage, b.dx, b.dz, b.knock);
            fx.burst([b.x, 1, b.z], { count: 5, color: b.color, speed: 3.5, life: 0.25, size: 0.07, gravity: -6, dir: [b.dx, 0.4, b.dz], spread: 0.9 });
            if (b.pierce-- <= 0) gone = true;
          });
        }
        if (gone) this.shots.splice(i, 1);
      }
    }

    // rings roll out whether or not the round is live, so they finish cleanly
    for (const r of this.rings) {
      if (!r.live) continue;
      r.r += r.speed * dt;
      const f = r.r / r.max;
      r.mesh.position.set(r.x, 0.12, r.z);
      r.mesh.scale.setScalar(r.r);
      r.mesh.material.opacity = Math.max(0, 1 - f) * 0.9;
      if (active) {
        horde.query(r.x, r.z, r.r, (e) => {
          if (r.hit.has(e)) return;
          const dx = e.x - r.x;
          const dz = e.z - r.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < r.r - 1.2) return; // only the rolling edge hurts
          r.hit.add(e);
          this._hit(e, r.damage, dx / d, dz / d, r.knock);
        });
      }
      if (f >= 1) {
        r.live = false;
        r.mesh.visible = false;
      }
    }
    this._draw();
  }

  /** A jagged lightning stroke from the sky to (x, z). */
  _bolt(x, z, color) {
    const fx = this.ctx.get('fx');
    let px = x + this.rng.signed() * 2;
    let py = 16;
    let pz = z + this.rng.signed() * 2 - 3;
    const n = 6;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const nx = i === n ? x : x + (px - x) * 0.5 + this.rng.signed() * 0.8 * (1 - f);
      const ny = 16 * (1 - f);
      const nz = i === n ? z : z + (pz - z) * 0.5 + this.rng.signed() * 0.8 * (1 - f);
      fx.tracer([px, py, pz], [nx, ny, nz], { color, width: 0.07, life: 0.16 });
      px = nx;
      py = ny;
      pz = nz;
    }
    fx.flash([x, 2.5, z], { color, intensity: 70, distance: 12, life: 0.18 });
    fx.burst([x, 0.2, z], { count: 14, color, speed: 6, life: 0.35, size: 0.09, gravity: -10, dir: [0, 1, 0], spread: 1.1 });
    fx.mark([x, 0.01, z], [0, 1, 0], { color: '#050403', size: 0.9 });
  }

  _draw() {
    const p = this.ctx.get('player');
    let n = 0;
    for (const b of this.shots) {
      if (n >= 96) break;
      _q.setFromUnitVectors(_f, _d.set(b.dx, 0, b.dz));
      const s = b.size;
      _m.compose(_p.set(b.x, 1.05, b.z), _q, _s.set(s, s, s));
      this.boltMesh.setMatrixAt(n, _m);
      this.boltMesh.setColorAt(n, _c.set(b.color).multiplyScalar(3));
      n++;
    }
    this.boltMesh.count = n;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    if (this.boltMesh.instanceColor) this.boltMesh.instanceColor.needsUpdate = true;

    let m = 0;
    const playing = this.ctx.get('round')?.state === 'playing';
    for (const o of this.owned) {
      if (o.def.kind !== 'orbit' || !playing || p.dead) continue;
      const s = this._stats(o);
      for (let k = 0; k < s.count && m < 24; k++) {
        const a = o.angle + (k / s.count) * Math.PI * 2;
        const x = p.x + Math.cos(a) * s.radius;
        const z = p.z + Math.sin(a) * s.radius;
        _q.identity();
        _m.compose(_p.set(x, 1.0 + Math.sin(a * 3) * 0.08, z), _q, _s.set(s.size, s.size, s.size));
        this.orbMesh.setMatrixAt(m, _m);
        this.orbMesh.setColorAt(m, _c.set(o.def.color).multiplyScalar(3.2));
        const h = s.size * 9;
        _m.compose(_p.set(x, 0.04, z), _q, _s.set(h, 1, h));
        this.orbHalo.setMatrixAt(m, _m);
        this.orbHalo.setColorAt(m, _c.set(o.def.color).multiplyScalar(0.7));
        m++;
      }
    }
    for (const mesh of [this.orbMesh, this.orbHalo]) {
      mesh.count = m;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
