import * as THREE from 'three';

/**
 * A pool of soft round particles in one draw call: sparks, spray, smoke,
 * confetti. Each has position, velocity, drag, gravity, life, a start and end
 * size and a colour that fades out. Additive or normal blending per pool.
 *
 *   const fx = new Particles({ max: 600, additive: true });
 *   scene.add(fx.points);
 *   fx.emit({ pos, vel, spread, count, life, size, endSize, color, gravity, drag });
 *   fx.update(dt, camera)   every frame
 *
 * Written for this repository.
 */
export class Particles {
  constructor({ max = 600, additive = true, fog = true } = {}) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.a = new Float32Array(max); // alpha
    this.s = new Float32Array(max); // size
    this.meta = Array.from({ length: max }, () => ({ life: 0, age: 0, s0: 1, s1: 1, g: 0, drag: 0, alive: false }));
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 400 } }]),
      fog,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float alpha; attribute float size; attribute vec3 color;
        uniform float uScale; varying vec3 vColor; varying float vAlpha;
        #include <fog_pars_vertex>
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.1, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        #include <fog_pars_fragment>
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          if (r > 1.0) discard;
          float k = (1.0 - r) * (1.0 - r);
          gl_FragColor = vec4(vColor, vAlpha * k);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.material = mat;
    this._c = new THREE.Color();
  }

  emit({ pos, vel = [0, 0, 0], spread = 1, count = 10, life = 1, size = 1, endSize, color = '#ffffff', gravity = 0, drag = 0.5, rng = Math.random }) {
    const col = this._c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const m = this.meta[i];
      m.alive = true;
      m.age = 0;
      m.life = life * (0.7 + rng() * 0.6);
      m.s0 = size;
      m.s1 = endSize ?? size;
      m.g = gravity;
      m.drag = drag;
      // random direction in a sphere
      let x, y, z;
      do {
        x = rng() * 2 - 1;
        y = rng() * 2 - 1;
        z = rng() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      this.p[i * 3] = pos.x;
      this.p[i * 3 + 1] = pos.y;
      this.p[i * 3 + 2] = pos.z;
      this.v[i * 3] = vel[0] + x * spread;
      this.v[i * 3 + 1] = vel[1] + y * spread;
      this.v[i * 3 + 2] = vel[2] + z * spread;
      this.c[i * 3] = col.r;
      this.c[i * 3 + 1] = col.g;
      this.c[i * 3 + 2] = col.b;
      this.a[i] = 1;
      this.s[i] = size;
    }
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.meta[i].alive = false;
      this.a[i] = 0;
      this.s[i] = 0;
    }
    this._flag();
  }

  update(dt, camera, viewportHeight = 720) {
    if (camera) this.material.uniforms.uScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (let i = 0; i < this.max; i++) {
      const m = this.meta[i];
      if (!m.alive) continue;
      m.age += dt;
      const t = m.age / m.life;
      if (t >= 1) {
        m.alive = false;
        this.a[i] = 0;
        this.s[i] = 0;
        continue;
      }
      const k = Math.exp(-m.drag * dt);
      this.v[i * 3] *= k;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - m.g * dt;
      this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.a[i] = (1 - t) * Math.min(1, m.age * 12);
      this.s[i] = m.s0 + (m.s1 - m.s0) * t;
    }
    this._flag();
  }

  _flag() {
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}

/**
 * A ribbon that follows a moving point (wingtip vapour, smoke trail). It
 * always faces the camera across its length and fades toward its tail.
 *
 *   const trail = new Trail({ length: 40, width: 0.5, color: '#fff' });
 *   scene.add(trail.mesh); trail.push(worldPos, strength); trail.update(camera)
 */
export class Trail {
  constructor({ length = 40, maxLength = 80, width = 0.5, color = '#ffffff', opacity = 0.5, additive = false, nearFade = [8, 24] } = {}) {
    this.n = length;
    this.maxLength = maxLength;
    this.width = width;
    this.pts = Array.from({ length }, () => new THREE.Vector3());
    this.str = new Float32Array(length);
    this.filled = 0;
    const pos = new Float32Array(length * 2 * 3);
    const alpha = new Float32Array(length * 2);
    const idx = [];
    for (let i = 0; i < length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } }]),
        fog: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        // Fades out close to the camera, so a chase view never looks down the ribbon.
        vertexShader: `attribute float alpha; varying float vA;
          #include <fog_pars_vertex>
          void main(){ vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          vA = alpha * smoothstep(${nearFade[0].toFixed(1)}, ${nearFade[1].toFixed(1)}, -mvPosition.z);
          #include <fog_vertex>
          }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
          #include <fog_pars_fragment>
          void main(){ gl_FragColor = vec4(uColor, vA * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
          }`,
      }),
    );
    this.mesh.frustumCulled = false;
    this._side = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  reset() {
    this.filled = 0;
    this.str.fill(0);
  }

  push(p, strength = 1) {
    for (let i = this.n - 1; i > 0; i--) {
      this.pts[i].copy(this.pts[i - 1]);
      this.str[i] = this.str[i - 1];
    }
    this.pts[0].copy(p);
    this.str[0] = strength;
    this.filled = Math.min(this.n, this.filled + 1);
  }

  update(camera) {
    const pos = this.mesh.geometry.attributes.position.array;
    const al = this.mesh.geometry.attributes.alpha.array;
    let run = 0; // metres from the head: the ribbon has a length, whatever the frame rate
    for (let i = 0; i < this.n; i++) {
      if (i > 0 && i < this.filled) run += this.pts[i].distanceTo(this.pts[i - 1]);
      const p = this.pts[Math.min(i, Math.max(0, this.filled - 1))];
      const q = this.pts[Math.min(i + 1, Math.max(0, this.filled - 1))];
      this._d.subVectors(i + 1 < this.filled ? q : p, p);
      if (this._d.lengthSq() < 1e-8) this._d.set(0, 0, 1);
      this._v.subVectors(camera.position, p);
      this._side.crossVectors(this._d, this._v).normalize();
      const t = Math.min(1, run / this.maxLength);
      const w = this.width * (1 - t * 0.6);
      pos[i * 6] = p.x + this._side.x * w;
      pos[i * 6 + 1] = p.y + this._side.y * w;
      pos[i * 6 + 2] = p.z + this._side.z * w;
      pos[i * 6 + 3] = p.x - this._side.x * w;
      pos[i * 6 + 4] = p.y - this._side.y * w;
      pos[i * 6 + 5] = p.z - this._side.z * w;
      const a = i < this.filled ? (1 - t) * (1 - t) * this.str[i] : 0;
      al[i * 2] = a;
      al[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
}
