import * as THREE from 'three';

/**
 * Draws every enemy with a handful of instanced meshes per enemy type, so forty
 * walkers cost a dozen draw calls. The game supplies the parts (src/game/models.js):
 *
 *   new Crowd(ctx, { crawler: [{ geometry, material, anim }], ... }, max, { bars })
 *
 * anim: 'body'  bobs and rolls with the gait, flashes white when hit, tints when slowed
 *       'legsA' / 'legsB'  swing in opposite phase (a tripod scuttle)
 *       'glow'  follows the body, never tinted
 *       'spin'  rotates about its own up axis (a shell, a halo)
 * Health bars float over damaged enemies and face the camera.
 */
export class Crowd {
  constructor(ctx, parts, max = 96, { bars = true, barColor = '#e9c46a', barBack = '#1a1410', barWidth = 0.9 } = {}) {
    this.ctx = ctx;
    this.object = new THREE.Group();
    this.object.name = 'crowd';
    this.types = {};
    for (const [id, list] of Object.entries(parts)) {
      this.types[id] = list.map((p) => {
        const mesh = new THREE.InstancedMesh(p.geometry, p.material, max);
        mesh.castShadow = p.shadow !== false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        mesh.count = 0;
        if (p.anim === 'body') mesh.setColorAt(0, new THREE.Color(1, 1, 1));
        this.object.add(mesh);
        return { ...p, mesh };
      });
    }
    this.bars = bars;
    this.barWidth = barWidth;
    if (bars) {
      const quad = new THREE.PlaneGeometry(1, 1);
      this.barBack = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ color: barBack, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }), max);
      this.barFill = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ color: barColor, depthWrite: false, toneMapped: false }), max);
      for (const m of [this.barBack, this.barFill]) {
        m.frustumCulled = false;
        m.count = 0;
        m.renderOrder = 20;
        this.object.add(m);
      }
    }
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._slow = new THREE.Color('#9fd8ff');
  }

  update(enemies, dt, camera) {
    const counts = {};
    for (const id in this.types) counts[id] = 0;
    let bars = 0;
    for (const e of enemies) {
      const parts = this.types[e.def.id];
      if (!parts) continue;
      const i = counts[e.def.id]++;
      const scale = (e.def.scale ?? 1) * (e.dead ? Math.max(0.001, 1 - e.dying / 0.45) : 1);
      const sink = e.dead ? e.dying * 0.6 : 0;
      const gait = Math.sin(e.phase);
      for (const p of parts) {
        let yaw = e.heading;
        let pitch = 0;
        let roll = 0;
        let lift = 0;
        if (p.anim === 'body' || p.anim === 'glow' || p.anim === 'spin') {
          lift = Math.abs(gait) * 0.05 * scale;
          roll = gait * 0.06;
          if (e.dead) roll += e.dying * 5;
        }
        if (p.anim === 'legsA') yaw += gait * 0.32;
        if (p.anim === 'legsB') yaw -= gait * 0.32;
        if (p.anim === 'spin') yaw += e.phase * 0.25;
        this._e.set(pitch, yaw, roll, 'YXZ');
        this._q.setFromEuler(this._e);
        this._p.set(e.x, e.y + lift - sink, e.z);
        this._s.setScalar(scale);
        this._m.compose(this._p, this._q, this._s);
        p.mesh.setMatrixAt(i, this._m);
        if (p.anim === 'body') {
          this._c.setRGB(1, 1, 1);
          if (e.slow < 1) this._c.copy(this._slow);
          this._c.multiplyScalar(1 + e.flash * 4);
          p.mesh.setColorAt(i, this._c);
        }
      }
      if (this.bars && !e.dead && e.hp < e.maxHp) {
        const w = this.barWidth * (e.def.scale ?? 1);
        const y = e.y + (e.def.barY ?? 1.1) * (e.def.scale ?? 1);
        const f = Math.max(0, e.hp / e.maxHp);
        this._q.copy(camera.quaternion);
        this._p.set(e.x, y, e.z);
        this._s.set(w, 0.11, 1);
        this._m.compose(this._p, this._q, this._s);
        this.barBack.setMatrixAt(bars, this._m);
        // shift the fill left in camera space so it drains toward the left
        const right = this._r.set(1, 0, 0).applyQuaternion(camera.quaternion);
        this._p.set(e.x - right.x * w * (1 - f) * 0.5, y - right.y * w * (1 - f) * 0.5 + 0.001, e.z - right.z * w * (1 - f) * 0.5);
        this._s.set(Math.max(0.001, w * f), 0.07, 1);
        this._m.compose(this._p, this._q, this._s);
        this.barFill.setMatrixAt(bars, this._m);
        bars++;
      }
    }
    for (const [id, parts] of Object.entries(this.types)) {
      for (const p of parts) {
        p.mesh.count = counts[id];
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      }
    }
    if (this.bars) {
      this.barBack.count = this.barFill.count = bars;
      this.barBack.instanceMatrix.needsUpdate = true;
      this.barFill.instanceMatrix.needsUpdate = true;
    }
  }
}
