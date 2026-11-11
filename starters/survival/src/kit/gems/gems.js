import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Experience on the floor. Fallen enemies leave gems; gems inside the player's
 * pickup reach are pulled in, faster the longer they fly, and pay their value
 * on arrival. Drawn as one instanced crystal mesh and one instanced glow on the
 * ground, so a field of a few hundred costs two draw calls. Past `max`, a new
 * gem's value is folded into an old one instead of adding another.
 *
 * Tiers (src/game/rules.js `gems`): [{ value, color, size }], smallest first.
 *
 *   gems.drop(x, z, value)     gems.items     gems.clear()     gems.vacuum()
 *
 * Reads player.pickup (metres). Events: gem:collected { value, x, z }
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class GemSystem {
  static id = 'gems';
  static deps = ['player', 'fx', 'audio'];

  constructor({ tiers, max = 320 } = {}) {
    this.tiers = tiers ?? [{ value: 1, color: '#6ff5c8', size: 0.16 }, { value: 5, color: '#ffc45c', size: 0.24 }, { value: 25, color: '#ff8ad8', size: 0.34 }];
    this.max = max;
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.items = [];
    this.collected = 0;
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(0.75, 1.25, 0.75);
    // a lit crystal shell over an unlit, over-bright core: it glints and it glows
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }), this.max);
    this.core = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), this.max);
    this.halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(64), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      this.max,
    );
    for (const m of [this.mesh, this.core, this.halo]) {
      m.frustumCulled = false;
      m.count = 0;
      for (let i = 0; i < this.max; i++) m.setColorAt(i, _c.setRGB(1, 1, 1));
      ctx.scene.add(m);
    }
    this.mesh.castShadow = false;
    this._chime = 0;
  }

  _tier(value) {
    let t = this.tiers[0];
    for (const x of this.tiers) if (value >= x.value) t = x;
    return t;
  }

  drop(x, z, value = 1) {
    if (this.items.length >= this.max) {
      // fold into the nearest old gem rather than add one
      let best = this.items[0];
      let bd = Infinity;
      for (const g of this.items) {
        const d = (g.x - x) ** 2 + (g.z - z) ** 2;
        if (d < bd && g.state === 'rest') {
          bd = d;
          best = g;
        }
      }
      best.value += value;
      best.tier = this._tier(best.value);
      return best;
    }
    const a = this.rng.range(0, Math.PI * 2);
    const g = { x, z, vx: Math.cos(a) * 1.5, vz: Math.sin(a) * 1.5, value, tier: this._tier(value), t: 0, state: 'rest', pull: 0, spin: this.rng.range(0, 6) };
    this.items.push(g);
    return g;
  }

  /** Pull every gem on the floor to the player (a reward, or the end of a round). */
  vacuum() {
    for (const g of this.items) g.state = 'pull';
  }

  clear() {
    this.items = [];
    this._draw();
  }

  update(dt, ctx) {
    const p = ctx.get('player');
    const reach = p.pickup ?? 2;
    const playing = ctx.get('round').state === 'playing';
    for (let i = this.items.length - 1; i >= 0; i--) {
      const g = this.items[i];
      g.t += dt;
      const dx = p.x - g.x;
      const dz = p.z - g.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      if (g.state === 'rest') {
        g.vx *= Math.exp(-6 * dt);
        g.vz *= Math.exp(-6 * dt);
        if (d < reach && playing && !p.dead) g.state = 'pull';
      }
      if (g.state === 'pull' && playing && !p.dead) {
        g.pull += dt;
        const sp = 4 + g.pull * 26;
        g.vx = (dx / d) * sp;
        g.vz = (dz / d) * sp;
        if (d < 0.55 + sp * dt) {
          this.items.splice(i, 1);
          this.collected += g.value;
          const now = ctx.time.elapsed;
          if (now - this._chime > 0.045) {
            this._chime = now;
            ctx.get('audio').play('gem', { value: g.value });
          }
          ctx.get('fx').burst([p.x, 0.9, p.z], { count: 3, color: g.tier.color, speed: 2, life: 0.3, size: 0.08, gravity: 3 });
          ctx.events.emit('gem:collected', { value: g.value, x: g.x, z: g.z });
          continue;
        }
      }
      g.x += g.vx * dt;
      g.z += g.vz * dt;
    }
    this._draw();
  }

  _draw() {
    const t = this.ctx.time.elapsed;
    let n = 0;
    for (const g of this.items) {
      const s = g.tier.size;
      const y = 0.32 + Math.sin(t * 3 + g.spin) * 0.06 + (g.state === 'pull' ? 0.25 : 0);
      _e.set(0, t * 1.8 + g.spin, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(g.x, y, g.z), _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(n, _m);
      _c.set(g.tier.color);
      this.mesh.setColorAt(n, _c);
      _m.compose(_p, _q, _s.set(s * 0.55, s * 0.55, s * 0.55));
      this.core.setMatrixAt(n, _m);
      this.core.setColorAt(n, _c.set(g.tier.color).multiplyScalar(2.6));
      _q.identity();
      const h = s * 5.5;
      _m.compose(_p.set(g.x, 0.03, g.z), _q, _s.set(h, 1, h));
      this.halo.setMatrixAt(n, _m);
      this.halo.setColorAt(n, _c.set(g.tier.color).multiplyScalar(0.55));
      n++;
    }
    for (const m of [this.mesh, this.core, this.halo]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
