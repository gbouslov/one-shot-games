import * as THREE from 'three';

/**
 * Speed lines: thin bright streaks that pour past the camera, kept out of the
 * middle of the frame, longer and brighter the faster you go. One draw call;
 * lives in the camera's space, so it needs no world placement.
 *
 *   const lines = new SpeedLines({ count: 90, color: '#ffd9a8' });
 *   scene.add(lines.object);
 *   lines.update(dt, camera, amount 0..1, speed)
 *
 * Written for this repository.
 */
export class SpeedLines {
  constructor({ count = 90, color = '#ffffff', inner = 1.6, outer = 6, near = 2, far = 40, rng = Math.random } = {}) {
    this.n = count;
    this.p = { inner, outer, near, far };
    this.rng = rng;
    this.items = Array.from({ length: count }, () => this._spawn({}, true));
    const pos = new Float32Array(count * 6);
    const alpha = new Float32Array(count * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAmount: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAmount; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA * uAmount, 1.0); }',
    });
    this.object = new THREE.LineSegments(geo, this.material);
    this.object.frustumCulled = false;
    this.object.matrixAutoUpdate = false;
    this.object.renderOrder = 50;
  }

  _spawn(it, anywhere = false) {
    const { near, far } = this.p;
    // Placed by where they land on screen: a ring outside the middle (where the
    // runner is), so they never streak across the player.
    const a = this.rng() * Math.PI * 2;
    const rs = 0.42 + 0.6 * Math.sqrt(this.rng());
    it.z = anywhere ? -(near + (far - near) * this.rng()) : -far;
    const k = -it.z * 0.6;
    it.x = Math.cos(a) * rs * k * 1.5;
    it.y = Math.sin(a) * rs * k;
    it.w = 0.4 + this.rng() * 0.6;
    return it;
  }

  update(dt, camera, amount, speed) {
    this.material.uniforms.uAmount.value = amount;
    this.object.visible = amount > 0.01;
    this.object.matrix.copy(camera.matrixWorld);
    this.object.matrixWorld.copy(camera.matrixWorld);
    if (!this.object.visible) return;
    const pos = this.object.geometry.attributes.position.array;
    const al = this.object.geometry.attributes.alpha.array;
    const len = 0.5 + speed * 0.09;
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      it.z += speed * 1.6 * dt;
      if (it.z > -this.p.near) this._spawn(it);
      const k = i * 6;
      pos[k] = it.x; pos[k + 1] = it.y; pos[k + 2] = it.z;
      pos[k + 3] = it.x; pos[k + 4] = it.y; pos[k + 5] = it.z - len;
      const fade = Math.min(1, (it.z + this.p.far) / 8) * Math.min(1, -it.z / 6);
      al[i * 2] = it.w * fade;
      al[i * 2 + 1] = 0;
    }
    this.object.geometry.attributes.position.needsUpdate = true;
    this.object.geometry.attributes.alpha.needsUpdate = true;
  }
}
