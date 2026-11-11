import * as THREE from 'three';

/**
 * The camera over the board. While playing it holds a three-quarter view that
 * fits the whole board to the window (portrait phones pull back); on the title
 * and end screens it drifts slowly round the valley. Shells and leaks shake it.
 *
 * config.camera: { pitch, yaw, margin, target: [x, y, z], titleOrbit, titlePitch, titleDistance }
 */
export class CameraSystem {
  static id = 'camera';
  static deps = ['defense'];

  init(ctx) {
    this.ctx = ctx;
    const c = ctx.config.camera ?? {};
    this.cfg = { pitch: 0.92, yaw: 0, margin: 1.06, target: [0, 0, 0.8], titleOrbit: 0.22, titlePitch: 0.62, titleDistance: 0.8, ...c };
    this.blend = 0; // 0 title, 1 play
    this.shake = 0;
    this.shot = null;
    this.t = 0;
    this._target = new THREE.Vector3(...this.cfg.target);
    ctx.events.on('shell:burst', () => { this.shake = Math.min(1, this.shake + 0.25); });
    ctx.events.on('enemy:leaked', () => { this.shake = Math.min(1, this.shake + 0.6); });
  }

  /** A fixed camera for a screenshot: { pos, look, fov } or { blend } (1 play view, 0 title view). */
  setShot(shot) {
    const cam = this.ctx.camera;
    if (shot.fov) cam.fov = shot.fov;
    cam.updateProjectionMatrix();
    if (shot.pos) this.shot = shot;
    else {
      this.shot = null;
      this.blend = this.lockBlend = shot.blend ?? 1;
    }
    this._apply();
  }

  /** Distance that fits the board (plus margin) inside the view at this pitch. */
  fit(pitch) {
    const d = this.ctx.get('defense');
    const cam = this.ctx.camera;
    const w = (d.board?.width ?? 40) * this.cfg.margin;
    const h = (d.board?.depth ?? 24) * this.cfg.margin;
    const vf = THREE.MathUtils.degToRad(cam.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    // the board's depth is foreshortened by the pitch
    const byW = w / 2 / Math.tan(hf / 2);
    const byH = (h * Math.sin(pitch)) / 2 / Math.tan(vf / 2) + h * 0.5 * Math.cos(pitch);
    return Math.max(byW, byH);
  }

  update(dt) {
    this.t += dt;
    const d = this.ctx.get('defense');
    const want = this.lockBlend ?? (d.state === 'playing' ? 1 : 0);
    this.blend += (want - this.blend) * Math.min(1, dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (!this.shot) this._apply();
  }

  _apply() {
    const cam = this.ctx.camera;
    if (this.shot) {
      cam.position.set(...this.shot.pos);
      cam.lookAt(...this.shot.look);
      return;
    }
    const c = this.cfg;
    const b = this.blend;
    const pitch = THREE.MathUtils.lerp(c.titlePitch, c.pitch, b);
    const yaw = c.yaw + (1 - b) * Math.sin(this.t * 0.07) * c.titleOrbit;
    const dist = this.fit(pitch) * THREE.MathUtils.lerp(c.titleDistance, 1, b);
    const t = this._target;
    cam.position.set(t.x + Math.sin(yaw) * Math.cos(pitch) * dist, t.y + Math.sin(pitch) * dist, t.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(t);
    if (this.shake > 0 && !this.ctx.config.deterministic) {
      const s = this.shake * this.shake * 0.12;
      cam.position.x += Math.sin(this.t * 61) * s;
      cam.position.y += Math.sin(this.t * 53 + 1) * s;
    }
  }
}
