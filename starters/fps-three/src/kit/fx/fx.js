import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Pooled billboard particles (additive and alpha layers), tracers, ground marks
 * and short-lived point lights, all preallocated so firing never allocates.
 *
 *   fx.burst([x,y,z], { count, color, speed, life, size, gravity, additive, dir, spread })
 *   fx.tracer(from, to, { color, width, life })
 *   fx.flash([x,y,z], { color, intensity, distance, life })
 *   fx.mark([x,y,z], normal, { color, size })
 */

const VERT = `
attribute vec4 iPosSize; attribute vec4 iColor; varying vec2 vUv; varying vec4 vColor;
void main(){
  vUv = uv; vColor = iColor;
  vec4 mv = modelViewMatrix * vec4(iPosSize.xyz, 1.0);
  mv.xy += position.xy * iPosSize.w;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
void main(){
  float a = texture2D(map, vUv).a * vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

class ParticleLayer {
  constructor(scene, map, count, blending) {
    this.n = count;
    this.head = 0;
    this.alive = 0;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.c = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.size = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.grow = new Float32Array(count);

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    this.iPosSize = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPosSize', this.iPosSize);
    geo.setAttribute('iColor', this.iColor);
    geo.instanceCount = 0;
    this.geo = geo;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { map: { value: map } },
      transparent: true,
      depthWrite: false,
      blending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    scene.add(mesh);
  }

  spawn(x, y, z, vx, vy, vz, r, g, b, life, size, grav, drag, grow) {
    const i = this.head;
    this.head = (i + 1) % this.n;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx;
    this.v[i * 3 + 1] = vy;
    this.v[i * 3 + 2] = vz;
    this.c[i * 3] = r;
    this.c[i * 3 + 1] = g;
    this.c[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.grow[i] = grow;
  }

  update(dt) {
    const ps = this.iPosSize.array;
    const cs = this.iColor.array;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.v[k] *= d;
      this.v[k + 1] = this.v[k + 1] * d + this.grav[i] * dt;
      this.v[k + 2] *= d;
      this.p[k] += this.v[k] * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += this.v[k + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      ps[w * 4] = this.p[k];
      ps[w * 4 + 1] = this.p[k + 1];
      ps[w * 4 + 2] = this.p[k + 2];
      ps[w * 4 + 3] = this.size[i] * (1 + this.grow[i] * (1 - f));
      cs[w * 4] = this.c[k];
      cs[w * 4 + 1] = this.c[k + 1];
      cs[w * 4 + 2] = this.c[k + 2];
      cs[w * 4 + 3] = Math.min(1, f * 2.4);
      w++;
    }
    this.geo.instanceCount = w;
    this.alive = w;
    this.iPosSize.needsUpdate = true;
    this.iColor.needsUpdate = true;
  }
}

const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

export class FxSystem {
  static id = 'fx';
  static deps = ['render'];

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    const map = glowTexture();
    const n = ctx.config.q.particles;
    this.add = new ParticleLayer(ctx.scene, map, n, THREE.AdditiveBlending);
    this.alpha = new ParticleLayer(ctx.scene, map, n, THREE.NormalBlending);

    // tracers: instanced thin boxes along +Z
    this.tracerCount = 48;
    this.tracers = Array.from({ length: this.tracerCount }, () => ({ life: 0, max: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), width: 0.02 }));
    this.tracerHead = 0;
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0, 0.5);
    this.tracerMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.tracerCount);
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.tracerMesh.count = 0;
    ctx.scene.add(this.tracerMesh);

    // ground marks
    this.markCount = 96;
    this.markHead = 0;
    this.markMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), this.markCount);
    this.markMesh.frustumCulled = false;
    this.markMesh.setColorAt(0, new THREE.Color(0, 0, 0));
    this.markMesh.count = 0;
    ctx.scene.add(this.markMesh);

    // a small pool of point lights; intensity zero when idle keeps shaders stable
    this.lights = Array.from({ length: 3 }, () => {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      ctx.scene.add(l);
      return { l, life: 0, max: 1, peak: 0 };
    });
  }

  burst(pos, o = {}) {
    const { count = 12, color = '#ffffff', speed = 4, life = 0.5, size = 0.12, gravity = -9, additive = true, dir = null, spread = 1, drag = 1.5, grow = 0.4 } = o;
    const layer = additive ? this.add : this.alpha;
    const r = this.rng;
    _c.set(color);
    for (let i = 0; i < count; i++) {
      let vx = r.signed();
      let vy = r.signed();
      let vz = r.signed();
      const len = Math.hypot(vx, vy, vz) || 1;
      vx /= len;
      vy /= len;
      vz /= len;
      if (dir) {
        vx = dir[0] + vx * spread;
        vy = dir[1] + vy * spread;
        vz = dir[2] + vz * spread;
      }
      const s = speed * r.range(0.4, 1);
      layer.spawn(pos[0], pos[1], pos[2], vx * s, vy * s, vz * s, _c.r, _c.g, _c.b, life * r.range(0.6, 1.1), size * r.range(0.6, 1.3), gravity, drag, grow);
    }
  }

  tracer(from, to, { color = '#ffe8b0', width = 0.018, life = 0.07 } = {}) {
    const t = this.tracers[this.tracerHead];
    this.tracerHead = (this.tracerHead + 1) % this.tracerCount;
    t.from.set(from[0], from[1], from[2]);
    t.to.set(to[0], to[1], to[2]);
    t.width = width;
    t.life = t.max = life;
    t.color = color;
  }

  flash(pos, { color = '#ffc680', intensity = 30, distance = 9, life = 0.06 } = {}) {
    const s = this.lights.reduce((a, b) => (b.life < a.life ? b : a));
    s.l.position.set(pos[0], pos[1], pos[2]);
    s.l.color.set(color);
    s.l.distance = distance;
    s.peak = intensity;
    s.life = s.max = life;
  }

  mark(pos, normal, { color = '#111', size = 0.16 } = {}) {
    const i = this.markHead;
    this.markHead = (i + 1) % this.markCount;
    _a.set(normal[0], normal[1], normal[2]);
    _q.setFromUnitVectors(_b.set(0, 0, 1), _a);
    _m.compose(_b.set(pos[0] + normal[0] * 0.012, pos[1] + normal[1] * 0.012, pos[2] + normal[2] * 0.012), _q, _s.set(size, size, size));
    this.markMesh.setMatrixAt(i, _m);
    this.markMesh.setColorAt(i, _c.set(color));
    this.markMesh.count = Math.max(this.markMesh.count, i + 1);
    this.markMesh.instanceMatrix.needsUpdate = true;
    if (this.markMesh.instanceColor) this.markMesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);

    let w = 0;
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) continue;
      _a.subVectors(t.to, t.from);
      const len = _a.length();
      _q.setFromUnitVectors(_b.set(0, 0, 1), _a.normalize());
      const fade = t.life / t.max;
      _m.compose(t.from, _q, _s.set(t.width * fade, t.width * fade, len));
      this.tracerMesh.setMatrixAt(w, _m);
      this.tracerMesh.setColorAt(w, _c.set(t.color).multiplyScalar(5));
      w++;
    }
    this.tracerMesh.count = w;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
    if (this.tracerMesh.instanceColor) this.tracerMesh.instanceColor.needsUpdate = true;

    for (const s of this.lights) {
      s.life = Math.max(0, s.life - dt);
      s.l.intensity = s.life > 0 ? s.peak * (s.life / s.max) : 0;
    }
  }

  clear() {
    this.add.life.fill(0);
    this.alpha.life.fill(0);
    this.markMesh.count = 0;
    for (const t of this.tracers) t.life = 0;
  }
}
