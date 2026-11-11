import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Things on the floor the player walks over: health, ammo, power. Each kind
 * (src/game/rules.js `pickups`) is { color, life, apply(ctx) -> bool, sound }.
 * A pickup bobs, turns, glows onto the ground under it and blinks before it goes.
 *
 *   pickups.spawn(kind, x, z)     pickups.items     pickups.clear()
 */
export class PickupSystem {
  static id = 'pickups';
  static deps = ['player', 'fx', 'audio'];

  constructor({ kinds = {} } = {}) {
    this.kinds = kinds;
  }

  init(ctx) {
    this.ctx = ctx;
    this.items = [];
    this.collected = 0;
    this._geo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 10);
    this._cap = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10);
    this._halo = new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2);
    this._haloTex = glowTexture(64);
    this._mats = {};
  }

  _mat(kind) {
    if (this._mats[kind]) return this._mats[kind];
    const c = new THREE.Color(this.kinds[kind]?.color ?? '#9effc4');
    this._mats[kind] = {
      body: new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.35, metalness: 0.2, emissive: c, emissiveIntensity: 1.4 }),
      cap: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.5, metalness: 0.6 }),
      halo: new THREE.MeshBasicMaterial({ map: this._haloTex, color: c.clone().multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    };
    return this._mats[kind];
  }

  spawn(kind, x, z) {
    const m = this._mat(kind);
    const g = new THREE.Group();
    const body = new THREE.Mesh(this._geo, m.body);
    const top = new THREE.Mesh(this._cap, m.cap);
    top.position.y = 0.2;
    const bot = new THREE.Mesh(this._cap, m.cap);
    bot.position.y = -0.2;
    const can = new THREE.Group();
    can.add(body, top, bot);
    can.rotation.z = 0.35;
    can.position.y = 0.55;
    const halo = new THREE.Mesh(this._halo, m.halo);
    halo.position.y = 0.03;
    g.add(can, halo);
    g.position.set(x, 0, z);
    this.ctx.scene.add(g);
    const item = { kind, x, z, t: 0, life: this.kinds[kind]?.life ?? 14, group: g, can };
    this.items.push(item);
    return item;
  }

  clear() {
    for (const it of this.items) this.ctx.scene.remove(it.group);
    this.items = [];
  }

  update(dt, ctx) {
    const p = ctx.get('player');
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.can.position.y = 0.55 + Math.sin(it.t * 3) * 0.08;
      it.can.rotation.y += dt * 1.6;
      const left = it.life - it.t;
      it.group.visible = left > 3 || Math.floor(it.t * 8) % 2 === 0;
      const near = Math.hypot(p.x - it.x, p.z - it.z) < 1.1;
      let gone = left <= 0;
      if (near && !p.dead) {
        const kind = this.kinds[it.kind];
        if (!kind?.apply || kind.apply(ctx) !== false) {
          gone = true;
          this.collected++;
          ctx.get('fx').burst([it.x, 0.6, it.z], { count: 14, color: kind?.color ?? '#9effc4', speed: 3, life: 0.5, size: 0.1, gravity: 2 });
          ctx.get('audio').play(kind?.sound ?? 'pickup');
          ctx.events.emit('pickup', { kind: it.kind, x: it.x, z: it.z, color: kind?.color ?? '#9effc4' });
        }
      }
      if (gone) {
        ctx.scene.remove(it.group);
        this.items.splice(i, 1);
      }
    }
  }
}
