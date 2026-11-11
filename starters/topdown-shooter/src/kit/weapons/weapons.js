import * as THREE from 'three';

/**
 * Guns for a ground-plane shooter. Hitscan rays on the (x, z) plane against the
 * arena's solids and the enemies' circles; every shot draws a tracer, a muzzle
 * flash with a real light, sparks where it lands and a little camera kick.
 *
 * A weapon def (src/game/weapons.js):
 *   { id, name, rate (shots/s), damage, pellets, spread (rad), range, magazine,
 *     reload (s), knockback, auto, sound ('light'|'medium'|'heavy'|profile),
 *     tracer: color, flash: color, shake, model: (add, shapes) => {} }
 *
 * Events: weapon:fire { def }, enemy:hit { enemy, damage, x, z, kill }
 * Stats: shots, hits, kills (the playtest reads them).
 */
export class WeaponSystem {
  static id = 'weapons';
  static deps = ['player', 'arena', 'fx', 'audio'];

  constructor({ defs }) {
    this.defs = defs;
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.slots = this.defs.map((def) => ({ def, ammo: def.magazine ?? Infinity }));
    this.index = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this.models = this.slots.map((s) => this._model(s.def));
    const socket = ctx.get('player').rig?.socket;
    for (const m of this.models) {
      m.visible = false;
      socket?.add(m);
    }
    this.models[0].visible = true;
    this.flashT = 0;
  }

  get current() {
    return this.slots[this.index];
  }

  _model(def) {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#1b1d21', roughness: 0.42, metalness: 0.7 });
    const len = def.length ?? 0.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, len), metal);
    body.position.z = len * 0.25;
    body.castShadow = true;
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len * 0.5, 6).rotateX(Math.PI / 2), metal);
    barrel.position.z = len * 0.75;
    g.add(barrel);
    if (def.accent) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, len * 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(2.5) }));
      strip.position.set(0, 0.06, len * 0.22);
      g.add(strip);
    }
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: flashTexture(), color: new THREE.Color(def.flash ?? '#ffcf8a').multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    flash.position.z = len + 0.22;
    flash.visible = false;
    g.add(flash);
    g.userData.flash = flash;
    g.userData.muzzle = len + 0.1;
    return g;
  }

  resetRound() {
    for (const s of this.slots) s.ammo = s.def.magazine ?? Infinity;
    this.reloading = 0;
    this.cooldown = 0;
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this._select(0, true);
  }

  _select(i, instant = false) {
    if (i < 0 || i >= this.slots.length) return;
    if (i === this.index && !instant) return;
    this.index = i;
    this.reloading = 0;
    this.cooldown = instant ? 0 : 0.18;
    this.models.forEach((m, k) => { m.visible = k === i; });
    if (!instant) this.ctx.get('audio').play('swap');
  }

  reload() {
    const s = this.current;
    if (this.reloading > 0 || !s.def.magazine || s.ammo >= s.def.magazine) return;
    this.reloading = s.def.reload ?? 1.2;
    this.ctx.get('audio').play('reload');
  }

  /** Muzzle position and direction in the ground plane. */
  muzzle() {
    const p = this.ctx.get('player');
    const s = Math.sin(p.yaw);
    const c = Math.cos(p.yaw);
    const reach = 0.5 + (this.models[this.index].userData.muzzle ?? 0.6) * 0.6;
    // The weapon socket sits 0.1 m along the body's local +x.
    return { x: p.x + s * reach + c * 0.1, z: p.z + c * reach - s * 0.1, y: 1.18, dx: s, dz: c };
  }

  fire() {
    const ctx = this.ctx;
    const s = this.current;
    const def = s.def;
    const m = this.muzzle();
    const arena = ctx.get('arena');
    const enemies = ctx.get('enemies');
    const fx = ctx.get('fx');
    const pellets = def.pellets ?? 1;
    this.stats.shots++;
    if (def.magazine) s.ammo--;

    for (let i = 0; i < pellets; i++) {
      const a = Math.atan2(m.dx, m.dz) + (this.rng.float() + this.rng.float() - 1) * (def.spread ?? 0.03);
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const range = def.range ?? 30;
      const wall = arena.raycast(m.x, m.z, dx, dz, range);
      const hit = enemies.raycast(m.x, m.z, dx, dz, wall.t);
      const t = hit ? hit.t : wall.t;
      const ex = m.x + dx * t;
      const ez = m.z + dz * t;
      fx.tracer([m.x, m.y, m.z], [ex, m.y - (hit ? 0.1 : 0.25), ez], { color: def.tracer ?? '#ffd9a0', width: def.tracerWidth ?? 0.05, life: 0.06 });
      if (hit) {
        this.stats.hits++;
        const killed = enemies.damage(hit.enemy, def.damage / (def.split ? pellets : 1), dx, dz, def.knockback ?? 1);
        if (killed) this.stats.kills++;
      } else if (wall.hit) {
        fx.burst([ex - dx * 0.05, m.y - 0.2, ez - dz * 0.05], { count: 6, color: '#ffc27a', speed: 5, life: 0.25, size: 0.07, gravity: -14, dir: [wall.nx, 0.4, wall.nz], spread: 0.8 });
        fx.burst([ex, m.y - 0.2, ez], { count: 2, color: '#6d6a66', speed: 1, life: 0.7, size: 0.35, gravity: 0.5, additive: false, grow: 1.2 });
        ctx.get('audio').play('impact', { level: 0.12 });
        ctx.events.emit('weapon:impact', { x: ex - dx * 0.05, y: m.y - 0.2, z: ez - dz * 0.05, dx, dz, nx: wall.nx, nz: wall.nz });
      }
    }
    fx.flash([m.x + m.dx * 0.3, m.y + 0.2, m.z + m.dz * 0.3], { color: def.flash ?? '#ffb55c', intensity: def.flashLight ?? 26, distance: 9, life: 0.07 });
    fx.burst([m.x, m.y, m.z], { count: 3, color: def.flash ?? '#ffcf8a', speed: 2.5, life: 0.12, size: 0.16, gravity: 0, dir: [m.dx, 0, m.dz], spread: 0.4 });
    // spent case
    fx.burst([m.x - m.dx * 0.4, m.y, m.z - m.dz * 0.4], { count: 1, color: '#d9a24a', speed: 3, life: 0.5, size: 0.05, gravity: -12, dir: [m.dz, 0.8, -m.dx], spread: 0.2 });
    this.flashT = 0.05;
    const flash = this.models[this.index].userData.flash;
    flash.visible = true;
    flash.rotation.y = this.rng.range(0, Math.PI * 2);
    flash.scale.setScalar(this.rng.range(0.8, 1.3) * (def.flashSize ?? 1));
    const p = ctx.get('player');
    p.recoil = 1;
    p.vx -= m.dx * (def.kick ?? 0.6);
    p.vz -= m.dz * (def.kick ?? 0.6);
    ctx.get('camera').shake(def.shake ?? 0.12);
    ctx.get('audio').play('shot', { profile: def.sound ?? 'medium' });
    ctx.events.emit('weapon:fire', { def });
  }

  update(dt, ctx) {
    const input = ctx.input;
    const p = ctx.get('player');
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) for (const m of this.models) m.userData.flash.visible = false;
    }
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.current.ammo = this.current.def.magazine;
        ctx.get('audio').play('reloaded');
      }
    }
    if (!p.controlEnabled || p.dead) return;
    for (let i = 0; i < this.slots.length; i++) if (input.pressed(`weapon${i + 1}`)) this._select(i);
    if (input.pressed('swap')) this._select((this.index + 1) % this.slots.length);
    if (input.pressed('reload')) this.reload();

    const s = this.current;
    const wants = s.def.auto === false ? input.pressed('fire') || (input.fire && input.aimStick && this.cooldown <= 0) : input.fire;
    if (wants && this.cooldown <= 0 && this.reloading <= 0 && p.dash <= 0) {
      if (s.def.magazine && s.ammo <= 0) {
        this.reload();
      } else {
        this.fire();
        this.cooldown = 1 / (s.def.rate ?? 8);
      }
    }
    if (s.def.magazine && s.ammo <= 0 && this.reloading <= 0) this.reload();
  }
}

let _flashTex = null;
function flashTexture() {
  if (_flashTex) return _flashTex;
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  // a four-point star, so the flash has a shape and not just a glow
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? size * 0.14 : size * 0.5;
    g.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  _flashTex = new THREE.CanvasTexture(cv);
  return _flashTex;
}
