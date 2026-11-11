import * as THREE from 'three';
import { Particles } from './particles.js';

/**
 * Drawing for things that fly: bolt streaks, glowing orbs and tumbling
 * debris, each one instanced draw call however many there are. The bright
 * cores use toneMapped:false HDR colours so the bloom pass turns them into
 * light; halos are additive points (hidden from the AO pass by render.js).
 *
 *   const s = new Streaks({ max, color, length, width });  s.sync(list)  // list of { pos, vel }
 *   const o = new Orbs({ max, color, radius, halo });      o.sync(list, camera, viewportH)
 *   const d = new Debris({ max, color });  d.burst(pos, n, speed, rng); d.update(dt)
 *
 * Written for this repository.
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const _e = new THREE.Euler();

export class Streaks {
  constructor({ max = 96, color = '#9fe8ff', intensity = 6, length = 3.2, width = 0.13 } = {}) {
    const geo = new THREE.BoxGeometry(width, width, 1);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    this.length = length;
    // A soft halo around each streak.
    this.halo = new Particles({ max, additive: true, fog: false });
    this.haloColor = new THREE.Color(color);
    this.haloSize = width * 9;
  }

  get objects() {
    return [this.mesh, this.halo.points];
  }

  sync(list, camera, h) {
    const n = Math.min(this.max, list.length);
    const H = this.halo;
    for (let i = 0; i < n; i++) {
      const b = list[i];
      _d.copy(b.vel).normalize();
      _q.setFromUnitVectors(_z, _d);
      const len = Math.min(this.length, (b.age ?? 1) * 120 + 0.3);
      _m.compose(b.pos, _q, _s.set(1, 1, len));
      this.mesh.setMatrixAt(i, _m);
      H.p[i * 3] = b.pos.x; H.p[i * 3 + 1] = b.pos.y; H.p[i * 3 + 2] = b.pos.z;
      H.c[i * 3] = this.haloColor.r; H.c[i * 3 + 1] = this.haloColor.g; H.c[i * 3 + 2] = this.haloColor.b;
      H.a[i] = 0.35;
      H.s[i] = this.haloSize;
    }
    for (let i = n; i < this.max; i++) { H.a[i] = 0; H.s[i] = 0; }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    H._flag();
    if (camera) H.material.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}

export class Orbs {
  constructor({ max = 160, color = '#ff8a3a', intensity = 3.2, radius = 0.34, halo = 2.0 } = {}) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    this.halo = new Particles({ max, additive: true, fog: false });
    this.color = new THREE.Color(color);
    this.haloSize = halo;
  }

  get objects() {
    return [this.mesh, this.halo.points];
  }

  sync(list, camera, h, time = 0) {
    const n = Math.min(this.max, list.length);
    const H = this.halo;
    for (let i = 0; i < n; i++) {
      const b = list[i];
      const k = b.big ? 1.5 : 1;
      _m.compose(b.pos, _q.identity(), _s.setScalar(k * (1 + Math.sin(time * 30 + i) * 0.12)));
      this.mesh.setMatrixAt(i, _m);
      H.p[i * 3] = b.pos.x; H.p[i * 3 + 1] = b.pos.y; H.p[i * 3 + 2] = b.pos.z;
      H.c[i * 3] = this.color.r; H.c[i * 3 + 1] = this.color.g; H.c[i * 3 + 2] = this.color.b;
      // Fade the halo as a bolt nears the camera, so a near miss never fills the screen.
      const near = camera ? Math.min(1, Math.max(0.15, (camera.position.distanceTo(b.pos) - 4) / 20)) : 1;
      H.a[i] = 0.6 * near;
      H.s[i] = this.haloSize * k;
    }
    for (let i = n; i < this.max; i++) { H.a[i] = 0; H.s[i] = 0; }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    H._flag();
    if (camera) H.material.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}

/** Hot hull fragments: tumble, fall a little, cool from orange to dark. */
export class Debris {
  constructor({ max = 120, color = '#3a3f4a', hot = '#ff7a2a' } = {}) {
    const geo = new THREE.TetrahedronGeometry(0.5, 0);
    geo.scale(1.4, 0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.5, emissive: '#ffffff', emissiveIntensity: 1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    // Emissive follows the instance colour: hot pieces glow, cold ones go dark.
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor * 3.0;')
        .replace('#include <color_fragment>', '');
    };
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    this.items = [];
    this.hot = new THREE.Color(hot);
    this._c = new THREE.Color();
  }

  get objects() {
    return [this.mesh];
  }

  burst(pos, n, speed, rng, vel) {
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize().multiplyScalar(speed * (0.4 + rng() * 0.8));
      if (vel) v.add(vel);
      this.items.push({
        p: pos.clone(), v, r: new THREE.Vector3(rng() * 6, rng() * 6, rng() * 6), w: new THREE.Vector3(rng() * 10 - 5, rng() * 10 - 5, rng() * 10 - 5),
        s: 0.6 + rng() * 1.4, age: 0, life: 1.6 + rng() * 1.4,
      });
    }
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      d.age += dt;
      if (d.age > d.life) {
        this.items.splice(i, 1);
        continue;
      }
    }
    for (const d of this.items) {
      d.v.multiplyScalar(Math.exp(-0.6 * dt));
      d.v.y -= 6 * dt;
      d.p.addScaledVector(d.v, dt);
      d.r.addScaledVector(d.w, dt);
      const t = d.age / d.life;
      _m.compose(d.p, _q.setFromEuler(_e.set(d.r.x, d.r.y, d.r.z)), _s.setScalar(d.s * (t > 0.85 ? (1 - t) / 0.15 : 1)));
      this.mesh.setMatrixAt(n, _m);
      const heat = Math.max(0, 1 - t * 2.2);
      this.mesh.setColorAt(n, this._c.copy(this.hot).multiplyScalar(heat * heat));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
