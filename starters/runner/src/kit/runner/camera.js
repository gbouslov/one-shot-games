import * as THREE from 'three';

/**
 * The runner's camera, placed in track space so it swings through bends and
 * rides over crests with the path:
 *
 *   'chase'  behind and above (high enough to pass over head-height
 *            obstacles), follows the lane change part way, looks down the
 *            path ahead; FOV opens with speed; lifts on a jump; a smooth
 *            shake on hits.
 *   'title'  a slow orbit from in front, so the runner's face and the path
 *            behind them share the frame with the sky.
 *   'won'    rises behind and beside the runner and looks past them at
 *            `goalView` (a world point the game sets, e.g. the finish line's landmark).
 *   'end'    eases round to a three-quarter front view and holds (a lost round).
 *
 * Springs are exponential (frame-rate independent). Written for this repository.
 */
export class RunnerCamera {
  constructor(camera, { fov = 64, back = 5.8, height = 3.3, look = 12, lookHeight = 1.2, follow = 0.55, fovSpeed = 0.42, goalView = null } = {}) {
    this.goalView = goalView;
    this.camera = camera;
    this.p = { fov, back, height, look, lookHeight, follow, fovSpeed };
    this.mode = 'title';
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.t = 0;
    this.blend = 1;
    this.pos = new THREE.Vector3();
    this.at = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  addShake(k) {
    this.shake = Math.min(1.2, this.shake + k);
  }

  snap(track, body) {
    this.x = body.x;
    this.y = body.y;
    this.update(0, track, body, true);
  }

  update(dt, track, body, snap = false) {
    const P = this.p;
    this.t += dt;
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.x += (body.x - this.x) * (snap ? 1 : 1 - Math.exp(-dt * 7));
    this.y += (body.y * 0.45 - this.y) * (snap ? 1 : 1 - Math.exp(-dt * 5));
    const p = this._p;
    const a = this._a;
    let fov = P.fov;
    if (this.mode === 'chase') {
      track.toWorld(body.s - P.back, this.x * P.follow, P.height + this.y, p);
      track.toWorld(body.s + P.look, this.x * P.follow * 0.7, P.lookHeight + this.y * 0.6, a);
      fov = P.fov + Math.max(0, body.speed - 12) * P.fovSpeed;
    } else if (this.mode === 'title') {
      const ang = Math.sin(this.t * 0.13) * 0.55 + 0.35;
      track.toWorld(body.s + Math.cos(ang) * 6.5, body.x + Math.sin(ang) * 4.2, 1.45 + Math.sin(this.t * 0.21) * 0.25, p);
      track.toWorld(body.s - 1.5, body.x * 0.9 + Math.sin(ang) * 0.6, 1.25, a);
      fov = P.fov - 8;
    } else if (this.mode === 'won' && this.goalView) {
      // Behind and to the side, high: the runner in front, the goal beyond.
      const side = body.x > 0 ? -1 : 1;
      track.toWorld(body.s - 15, body.x + side * 2.6, 3.4, p);
      track.toWorld(body.s, body.x, 1.6, a);
      a.lerp(this.goalView, 0.5);
      fov = P.fov - 6;
    } else {
      const ang = 0.75;
      track.toWorld(body.s + Math.cos(ang) * 5, body.x + Math.sin(ang) * 3.4, 1.6, p);
      track.toWorld(body.s, body.x, 1.05, a);
      fov = P.fov - 10;
    }
    if (snap) {
      this.pos.copy(p);
      this.at.copy(a);
    } else {
      this.pos.lerp(p, k);
      this.at.lerp(a, Math.min(1, k * 1.4));
    }
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.35;
      cam.position.add(this._s.set(Math.sin(this.t * 37) * s, Math.sin(this.t * 43 + 1) * s, Math.sin(this.t * 29 + 2) * s * 0.5));
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(this.at);
    const f = snap ? fov : cam.fov + (fov - cam.fov) * (1 - Math.exp(-dt * 3));
    if (Math.abs(f - cam.fov) > 0.01) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }
}
