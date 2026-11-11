import * as THREE from 'three';
import { FlowField } from './flowfield.js';
import { clamp, pushOutOfCircle, pushOutOfRect, rayVsCircle, rayVsRect, rectNormal } from './geometry.js';

/**
 * The ground-plane world every actor lives in. Gameplay is simulated on (x, z):
 * actors are circles, solids are axis-aligned rectangles and circles, and
 * height is only for drawing. That is the idea undead-protocol is built on (one
 * flat simulation, any camera), and it is what lets one kit serve a top-down
 * and an over-the-shoulder game.
 *
 *   arena.box({ x, z, w, d, h, material, y, solid, castShadow })   a solid block with a mesh
 *   arena.solidRect(minX, minZ, maxX, maxZ)                        collision only
 *   arena.solidCircle(x, z, r)                                     collision only
 *   arena.setField(rect)     where the flow field runs (include the ground outside gaps)
 *   arena.setPlay(rect)      where the player is allowed to stand
 *   arena.finish()           bake the flow field once the level is built
 *   arena.resolve(p, r)      push a circle {x, z} out of every solid
 *   arena.raycast(ox, oz, dx, dz, max)   -> { t, nx, nz } nearest solid along a ray
 *   arena.clearLine(ax, az, bx, bz)      true if nothing solid is between
 */
export class ArenaSystem {
  static id = 'arena';
  static deps = ['render'];

  init(ctx) {
    this.ctx = ctx;
    this.rects = [];
    this.circles = [];
    this.field = { minX: -30, minZ: -30, maxX: 30, maxZ: 30 };
    this.play = { minX: -20, minZ: -20, maxX: 20, maxZ: 20 };
    this.flow = null;
    this._geo = new THREE.BoxGeometry(1, 1, 1);
  }

  setField(r) {
    this.field = r;
  }

  setPlay(r) {
    this.play = r;
  }

  solidRect(minX, minZ, maxX, maxZ) {
    const r = { minX, minZ, maxX, maxZ };
    this.rects.push(r);
    return r;
  }

  solidCircle(x, z, r) {
    const c = { x, z, r };
    this.circles.push(c);
    return c;
  }

  /** A box standing on the ground at (x, z), w along x, d along z, h tall. */
  box({ x, z, w, d, h, material, y = 0, solid = true, castShadow = true, receiveShadow = true, geometry = null, rotY = 0 }) {
    const mesh = new THREE.Mesh(geometry ?? this._geo, material);
    if (!geometry) mesh.scale.set(w, h, d);
    mesh.position.set(x, y + (geometry ? 0 : h / 2), z);
    mesh.rotation.y = rotY;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.ctx.scene.add(mesh);
    // A quarter turn swaps the footprint; any other angle keeps the box's own.
    const quarter = Math.abs(Math.sin(rotY)) > 0.7;
    const hw = (quarter ? d : w) / 2;
    const hd = (quarter ? w : d) / 2;
    if (solid) this.solidRect(x - hw, z - hd, x + hw, z + hd);
    return mesh;
  }

  finish(cell = 1) {
    this.flow = new FlowField(this.field, cell);
    this.flow.rebuild(this.rects, this.circles);
  }

  /** Push a circle out of every solid, then keep it inside `cage` (default: the field). */
  resolve(p, radius, cage = this.field) {
    for (let pass = 0; pass < 2; pass++) {
      for (const r of this.rects) pushOutOfRect(p, radius, r);
      for (const c of this.circles) pushOutOfCircle(p, radius, c);
    }
    p.x = clamp(p.x, cage.minX + radius, cage.maxX - radius);
    p.z = clamp(p.z, cage.minZ + radius, cage.maxZ - radius);
    return p;
  }

  raycast(ox, oz, dx, dz, max = 100) {
    let best = max;
    let nx = 0;
    let nz = 0;
    let hit = false;
    for (const r of this.rects) {
      const t = rayVsRect(ox, oz, dx, dz, r);
      if (t !== null && t < best) {
        best = t;
        [nx, nz] = rectNormal(ox + dx * t, oz + dz * t, r);
        hit = true;
      }
    }
    for (const c of this.circles) {
      const t = rayVsCircle(ox, oz, dx, dz, c.x, c.z, c.r);
      if (t !== null && t < best) {
        best = t;
        const hx = ox + dx * t - c.x;
        const hz = oz + dz * t - c.z;
        const l = Math.hypot(hx, hz) || 1;
        nx = hx / l;
        nz = hz / l;
        hit = true;
      }
    }
    return { t: best, nx, nz, hit };
  }

  clearLine(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    return !this.raycast(ax, az, dx / len, dz / len, len).hit;
  }

  /** A random free point inside `rect`, at least `clear` metres from any solid. */
  freePoint(rng, rect = this.play, clear = 0.8) {
    for (let i = 0; i < 40; i++) {
      const p = { x: rng.range(rect.minX + clear, rect.maxX - clear), z: rng.range(rect.minZ + clear, rect.maxZ - clear) };
      const q = { ...p };
      this.resolve(q, clear, rect);
      if (Math.hypot(q.x - p.x, q.z - p.z) < 1e-3) return p;
    }
    return { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 };
  }
}
