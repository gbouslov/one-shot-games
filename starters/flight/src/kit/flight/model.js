// Adapted from arjunemirchandani/skyward-flight-simulator index.html (MIT,
// commit 5fde882): the arcade flight model in updateFlight(). See NOTICES.md.
import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Arcade flight that feels like an aeroplane:
 *  - pitch, roll and yaw are rates, and lose authority at low airspeed
 *  - hands off the stick, the wings drift back to level (only while upright)
 *  - banking turns the nose, which is what makes it fly like a plane
 *  - speed chases a throttle target and trades with altitude (climb slows you,
 *    diving speeds you up)
 *  - below stall speed the nose drops and the aircraft sinks
 *
 * Units: world units are metres, speed is metres per second. The nose is -Z.
 * Controls are read through Controls.value(code), so keys, touch and the bot
 * all fly the same model.
 */
export const DEFAULT_FLIGHT = {
  maxSpeed: 150,
  minSpeed: 14,
  stallSpeed: 34,
  thrustK: 0.55, // how fast speed chases the throttle target
  gravity: 68, // speed traded for altitude
  pitchRate: 1.15, // rad/s at full authority
  rollRate: 1.85,
  yawRate: 0.55,
  bankTurn: 1.4, // banked-turn coupling
  authoritySpeed: 60, // full control authority above this speed
  throttleRate: 0.55, // per second
  selfLevel: 0.85,
  ceiling: 1600,
  bounds: 3200, // soft boundary, turns you back toward the middle
  keys: {
    pitchUp: 'KeyS', pitchDown: 'KeyW', rollLeft: 'KeyA', rollRight: 'KeyD',
    yawLeft: 'KeyQ', yawRight: 'KeyE', throttleUp: ['KeyR', 'ShiftLeft', 'ShiftRight'], throttleDown: ['KeyF'],
  },
};

export class FlightModel {
  constructor(params = {}) {
    this.p = { ...DEFAULT_FLIGHT, ...params, keys: { ...DEFAULT_FLIGHT.keys, ...(params.keys ?? {}) } };
    this.position = new THREE.Vector3();
    this.prevPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.right = new THREE.Vector3(1, 0, 0);
    this.speed = 0;
    this.throttle = 0.7;
    this.stalled = false;
    this.warning = '';
    this.inputs = { pitch: 0, roll: 0, yaw: 0 };
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
  }

  /** Put the aircraft at `pos`, level, nose on `heading` (radians, 0 = -Z, clockwise). */
  reset(pos, heading = 0, speed = 95, throttle = 0.72) {
    this.position.copy(pos);
    this.prevPosition.copy(pos);
    this.quaternion.setFromAxisAngle(WORLD_UP, -heading);
    this.speed = speed;
    this.throttle = throttle;
    this.stalled = false;
    this._axes();
  }

  _axes() {
    this.fwd.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
  }

  _rotateWorld(axis, angle) {
    this._q.setFromAxisAngle(axis, angle);
    this.quaternion.premultiply(this._q);
  }

  /** Bank, positive rolled right. */
  get bank() { return Math.atan2(-this.right.y, this.up.y); }
  /** Pitch of the nose, positive up. */
  get pitch() { return Math.asin(THREE.MathUtils.clamp(this.fwd.y, -1, 1)); }
  /** Compass heading, 0 toward -Z, increasing clockwise (to the right). */
  get heading() { return Math.atan2(this.fwd.x, -this.fwd.z); }

  step(dt, controls) {
    const p = this.p;
    const k = p.keys;
    this._axes();

    const auth = Math.min(1, Math.max(0.18, this.speed / p.authoritySpeed));
    const pitchIn = controls.axis(k.pitchUp, k.pitchDown);
    let rollIn = controls.axis(k.rollLeft, k.rollRight);
    const yawIn = controls.axis(k.yawLeft, k.yawRight);
    this.inputs.pitch = pitchIn;
    this.inputs.roll = -rollIn;
    this.inputs.yaw = -yawIn;

    // Hands off the stick, the wings drift back to level, only while upright.
    if (Math.abs(rollIn) < 0.02) rollIn = -this.right.y * Math.max(0, this.up.y) * p.selfLevel;

    this._e.set(pitchIn * p.pitchRate * auth * dt, yawIn * p.yawRate * auth * dt, rollIn * p.rollRate * auth * dt, 'XYZ');
    this.quaternion.multiply(this._q.setFromEuler(this._e));

    // Banking turns the nose.
    this._axes();
    this._rotateWorld(WORLD_UP, this.right.y * p.bankTurn * auth * dt);

    const up = controls.any(...[].concat(k.throttleUp));
    const down = controls.any(...[].concat(k.throttleDown));
    this.throttle = THREE.MathUtils.clamp(this.throttle + (up - down) * p.throttleRate * dt, 0, 1);

    // Speed: thrust toward the throttle target, and the climb/dive energy trade.
    this._axes();
    const target = p.minSpeed + this.throttle * (p.maxSpeed - p.minSpeed);
    this.speed += (target - this.speed) * p.thrustK * dt;
    this.speed -= this.fwd.y * p.gravity * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, 0, p.maxSpeed * 1.25);

    // Stall: below flying speed the nose drops and the aircraft sinks.
    let sink = 0;
    this.stalled = this.speed < p.stallSpeed;
    if (this.stalled) {
      const s = (p.stallSpeed - this.speed) / p.stallSpeed;
      sink = s * 60;
      this._v.copy(this.right).setY(0);
      if (this._v.lengthSq() > 1e-6) this._rotateWorld(this._v.normalize(), -s * 1.6 * dt);
      this._axes();
    }

    this.prevPosition.copy(this.position);
    this.velocity.copy(this.fwd).multiplyScalar(this.speed).addScaledVector(WORLD_UP, -sink);
    this.position.addScaledVector(this.velocity, dt);

    // Soft boundary: turn back toward the middle of the map.
    this.leaving = false;
    const d = Math.max(Math.abs(this.position.x), Math.abs(this.position.z));
    if (d > p.bounds) {
      const push = Math.min(1, (d - p.bounds) / 400);
      this._v.set(-this.position.x, 0, -this.position.z).normalize();
      const cross = this.fwd.x * this._v.z - this.fwd.z * this._v.x;
      this._rotateWorld(WORLD_UP, -Math.sign(cross) * push * 0.9 * dt);
      this.leaving = true;
    }
    if (this.position.y > p.ceiling) {
      this.position.y = p.ceiling;
      this.speed *= 0.985;
    }
    this.quaternion.normalize();
    this._axes();
  }
}
