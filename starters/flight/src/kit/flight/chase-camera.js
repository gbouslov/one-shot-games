// Adapted from arjunemirchandani/skyward-flight-simulator index.html (MIT,
// commit 5fde882): updateCamera(), the chase view. See NOTICES.md.
import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Chase camera: sits behind and above the aircraft in its own frame, follows
 * with exponential smoothing, blends only part of the roll into the horizon
 * (banking reads without making anyone seasick), looks a little ahead of the
 * nose, and widens the lens with speed.
 *
 *   const cam = new ChaseCamera(camera, { offset: [0, 3.4, 15.5], lead: 26 });
 *   cam.update(dt, model)           every frame after the flight step
 *   cam.snap(model)                 jump straight to the resting position
 *   cam.hold(point)                 stop following and watch a point (a crash)
 */
export class ChaseCamera {
  constructor(camera, { offset = [0, 3.4, 15.5], lead = 26, follow = 7, rollBlend = 0.65, fov = 60, fovGain = 16, maxSpeed = 150 } = {}) {
    this.camera = camera;
    this.offset = new THREE.Vector3(...offset);
    this.lead = lead;
    this.follow = follow;
    this.rollBlend = rollBlend;
    this.fov = fov;
    this.fovGain = fovGain;
    this.maxSpeed = maxSpeed;
    this.up = new THREE.Vector3(0, 1, 0);
    this.look = new THREE.Vector3();
    this.holdPoint = null;
    this.ground = null; // optional (x, z) => height, keeps the camera out of hills
    this._t = new THREE.Vector3();
    this._u = new THREE.Vector3();
  }

  _target(model) {
    return this._t.copy(this.offset).applyQuaternion(model.quaternion).add(model.position);
  }

  snap(model) {
    this.holdPoint = null;
    this.camera.position.copy(this._target(model));
    this.up.copy(model.up).lerp(WORLD_UP, 1 - this.rollBlend).normalize();
    this.camera.up.copy(this.up);
    this.look.copy(model.position).addScaledVector(model.fwd, this.lead);
    this.camera.lookAt(this.look);
  }

  hold(point) {
    this.holdPoint = point.clone();
  }

  update(dt, model) {
    const cam = this.camera;
    if (this.holdPoint) {
      cam.up.lerp(WORLD_UP, 1 - Math.exp(-3 * dt));
      cam.lookAt(this.holdPoint);
      return;
    }
    const k = 1 - Math.exp(-this.follow * dt);
    cam.position.lerp(this._target(model), k);
    if (this.ground) {
      const g = Math.max(0, this.ground(cam.position.x, cam.position.z)) + 3;
      if (cam.position.y < g) cam.position.y = g;
    }
    this._u.copy(model.up).lerp(WORLD_UP, 1 - this.rollBlend).normalize();
    this.up.lerp(this._u, k).normalize();
    cam.up.copy(this.up);
    this.look.copy(model.position).addScaledVector(model.fwd, this.lead);
    cam.lookAt(this.look);
    const target = this.fov + (model.speed / this.maxSpeed) * this.fovGain;
    cam.fov += (target - cam.fov) * (1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
  }
}
