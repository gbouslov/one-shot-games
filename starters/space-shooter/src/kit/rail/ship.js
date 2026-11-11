import * as THREE from 'three';

/**
 * The rail and the ship on it. The rail is an invisible anchor that flies
 * down -Z at a set speed (boost raises it, the end of the course stops it);
 * the ship steers inside a screen-sized box around the anchor, banks into
 * its sideways speed and pitches with its vertical speed. Fire is a twin
 * bolt at a fixed rate; each bolt flies toward an aim point ahead that leads
 * the ship's offset, so steering is aiming.
 *
 *   const ship = new RailShip(rules.ship)
 *   ship.step(dt, controls, { stopAt })   one fixed step; returns bolts fired this step
 *   ship.position, ship.offset {x,y}, ship.vel {x,y}, ship.bank, ship.pitch,
 *   ship.distance, ship.speed, ship.boost (0..1 meter), ship.boosting
 *
 * Rail speed ramps toward its target with exponential smoothing, and the
 * steering accelerates toward a target velocity with separate accel and
 * decel rates; both after the rail in bop-del/meridian-line src/core/rail.js
 * (MIT). Written for this repository.
 */
const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  fire: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
};

export class RailShip {
  constructor(p = {}) {
    this.p = {
      baseY: 0,
      baseSpeed: 42,
      boostSpeed: 74,
      accel: 2.6, // 1/s, rail speed smoothing
      bounds: { x: 14, y: 8 },
      speedX: 30,
      speedY: 22,
      steerAccel: 9, // 1/s toward the target velocity
      steerDecel: 7,
      boostDrain: 0.45, // meter per second
      boostRegen: 0.22,
      boostMin: 0.12,
      fireRate: 8,
      boltSpeed: 300,
      aimDistance: 90,
      aimGain: 1.7, // the aim point sits at offset * aimGain, aimDistance ahead
      guns: [[-1.5, -0.1, -1.6], [1.5, -0.1, -1.6]],
      keys: KEYS,
      ...p,
    };
    this.position = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.offset = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.inputs = { x: 0, y: 0, fire: 0, boost: 0 };
    this.quaternion = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.reset();
  }

  reset(distance = 0) {
    this.distance = distance;
    this.speed = this.p.baseSpeed;
    this.target = this.p.baseSpeed;
    this.offset.x = 0;
    this.offset.y = 0;
    this.vel.x = 0;
    this.vel.y = 0;
    this.bank = 0;
    this.pitch = 0;
    this.boost = 1;
    this.boosting = false;
    this._lock = false;
    this.cool = 0;
    this.shots = 0;
    this.gun = 0;
    this._sync();
  }

  /** Where a bolt fired now will be aimed: world point aimDistance ahead. */
  aimPoint(out = new THREE.Vector3()) {
    const p = this.p;
    return out.set(this.offset.x * p.aimGain, this.p.baseY + this.offset.y * p.aimGain, -this.distance - p.aimDistance);
  }

  /**
   * One fixed step. `opts.speed` overrides the rail's target speed (title
   * drift, the stop at the end); `opts.fire === false` holds fire.
   */
  step(dt, input, { speed, fire = true, steer = true } = {}) {
    const p = this.p;
    const k = p.keys;
    const ix = steer ? input.any(...k.right) - input.any(...k.left) : 0;
    const iy = steer ? input.any(...k.up) - input.any(...k.down) : 0;
    const wantBoost = input.any(...k.boost) > 0.5 && speed === undefined;
    this.inputs.x = ix;
    this.inputs.y = iy;
    this.inputs.boost = wantBoost ? 1 : 0;
    this.inputs.fire = fire ? input.any(...k.fire) : 0;

    // Boost meter: drains while held, locks out when empty until it refills a little.
    if (this._lock && this.boost >= p.boostMin * 2) this._lock = false;
    this.boosting = wantBoost && !this._lock && this.boost > 0;
    if (this.boosting) {
      this.boost = Math.max(0, this.boost - p.boostDrain * dt);
      if (this.boost <= 0) this._lock = true;
    } else this.boost = Math.min(1, this.boost + p.boostRegen * dt);

    // Rail.
    this.target = speed ?? (this.boosting ? p.boostSpeed : p.baseSpeed);
    this.speed += (this.target - this.speed) * (1 - Math.exp(-p.accel * dt));
    this.distance += this.speed * dt;

    // Steering: accelerate toward a target velocity, soft walls at the bounds.
    const b = p.bounds;
    for (const [axis, inp, max, lim] of [['x', ix, p.speedX, b.x], ['y', iy, p.speedY, b.y]]) {
      const want = inp * max;
      const rate = Math.abs(want) > Math.abs(this.vel[axis]) ? p.steerAccel : p.steerDecel;
      this.vel[axis] += (want - this.vel[axis]) * (1 - Math.exp(-rate * dt));
      let o = this.offset[axis] + this.vel[axis] * dt;
      if (o > lim) { o = lim; if (this.vel[axis] > 0) this.vel[axis] = 0; }
      if (o < -lim) { o = -lim; if (this.vel[axis] < 0) this.vel[axis] = 0; }
      this.offset[axis] = o;
    }
    // Bank into sideways speed, pitch with vertical speed (smoothed).
    const bankT = -this.vel.x / p.speedX * 0.75;
    const pitchT = this.vel.y / p.speedY * 0.22;
    this.bank += (bankT - this.bank) * (1 - Math.exp(-8 * dt));
    this.pitch += (pitchT - this.pitch) * (1 - Math.exp(-8 * dt));
    this._sync();

    // Guns.
    this.cool = Math.max(0, this.cool - dt);
    const fired = [];
    if (this.inputs.fire > 0.5 && this.cool <= 0) {
      this.cool = 1 / p.fireRate;
      const aim = this.aimPoint(this._aim ??= new THREE.Vector3());
      const g = p.guns[this.gun++ % p.guns.length];
      const from = new THREE.Vector3(...g).applyQuaternion(this.quaternion).add(this.position);
      const dir = aim.clone().sub(from).normalize();
      fired.push({ pos: from, vel: dir.multiplyScalar(p.boltSpeed).add(new THREE.Vector3(0, 0, -this.speed)) });
      this.shots++;
    }
    return fired;
  }

  _sync() {
    this.anchor.set(0, this.p.baseY, -this.distance);
    this.position.set(this.offset.x, this.p.baseY + this.offset.y, -this.distance);
    this._e.set(this.pitch, -this.vel.x / this.p.speedX * 0.12, this.bank);
    this.quaternion.setFromEuler(this._e);
  }
}
