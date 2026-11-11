/**
 * The runner in track space: distance `s`, lateral `x`, height `y` above the
 * path. Three (or any odd number of) lanes, a jump, a slide, a stumble.
 * Stepped on the engine's fixed step from presses taken off the control map.
 *
 *   body.step(dt, { left, right, jump, slide }, speed)
 *     left/right/jump/slide are press counts this step (edges, not holds)
 *
 * Lane changes ease in with exponential damping and a jump is a fixed arc
 * under gravity, after omsingh02/bunny's PhysicsEngine (MIT): `damp` toward
 * the target lane and a jump defined by launch speed and gravity, all on
 * elapsed time so it plays the same at any frame rate. Slide, the fast drop
 * when sliding in the air, buffered presses and the stumble are new.
 *
 * Params (rules.body): lanes, laneWidth, laneDamp, jumpHeight, jumpTime,
 * slideTime, dropSpeed, height, slideHeight, halfWidth, buffer.
 */
export class RunnerBody {
  constructor(p = {}) {
    this.p = {
      lanes: 3, laneWidth: 2.2, laneDamp: 16, jumpHeight: 1.6, jumpTime: 0.78,
      slideTime: 0.72, dropSpeed: 16, height: 1.7, slideHeight: 0.85, halfWidth: 0.34, buffer: 0.14, ...p,
    };
    const tHalf = this.p.jumpTime / 2;
    this.jumpV = (2 * this.p.jumpHeight) / tHalf;
    this.gravity = this.jumpV / tHalf;
    this.reset();
  }

  reset(s = 0) {
    this.s = s;
    this.lane = 0; // -1, 0, 1 for three lanes
    this.x = 0;
    this.xv = 0;
    this.y = 0;
    this.vy = 0;
    this.airborne = false;
    this.slideT = 0;
    this.slideQueued = false;
    this.jumpBuf = 0;
    this.slideBuf = 0;
    this.stumble = 0;
    this.speed = 0;
    this.jumps = 0;
    this.slides = 0;
    this.laneChanges = 0;
    this.landed = false;
    this.events = [];
  }

  get maxLane() {
    return (this.p.lanes - 1) / 2;
  }

  get sliding() {
    return this.slideT > 0;
  }

  /** Top of the hitbox above the path. */
  get top() {
    return this.y + (this.sliding ? this.p.slideHeight : this.p.height);
  }

  step(dt, press, speed) {
    const P = this.p;
    const ev = this.events;
    this.speed = speed;
    this.s += speed * dt;

    // Lanes: each press moves one lane; presses beyond the edge are dropped.
    const dl = (press.right ?? 0) - (press.left ?? 0);
    if (dl) {
      const next = Math.max(-this.maxLane, Math.min(this.maxLane, this.lane + dl));
      if (next !== this.lane) {
        ev.push({ type: 'lane', from: this.lane, to: next });
        this.lane = next;
        this.laneChanges++;
      }
    }
    const tx = this.lane * P.laneWidth;
    const prevX = this.x;
    this.x = tx + (this.x - tx) * Math.exp(-P.laneDamp * dt);
    this.xv = (this.x - prevX) / dt;

    // Buffered presses: a jump pressed just before landing still happens.
    if (press.jump) this.jumpBuf = P.buffer;
    if (press.slide) this.slideBuf = P.buffer;

    if (this.slideBuf > 0) {
      if (this.airborne) {
        // Down in the air: drop fast and slide on landing.
        this.vy = Math.min(this.vy, -P.dropSpeed);
        this.slideQueued = true;
        this.slideBuf = 0;
        ev.push({ type: 'drop' });
      } else {
        this._slide();
        this.slideBuf = 0;
      }
    }
    if (this.jumpBuf > 0 && !this.airborne) {
      this.slideT = 0;
      this.slideQueued = false;
      this.airborne = true;
      this.vy = this.jumpV;
      this.jumps++;
      this.jumpBuf = 0;
      ev.push({ type: 'jump' });
    }
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.slideBuf = Math.max(0, this.slideBuf - dt);

    if (this.airborne) {
      this.vy -= this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.airborne = false;
        ev.push({ type: 'land', vy: this.vy });
        this.vy = 0;
        if (this.slideQueued) {
          this.slideQueued = false;
          this._slide();
        }
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0) ev.push({ type: 'rise' });
    }
    this.stumble = Math.max(0, this.stumble - dt);
  }

  _slide() {
    if (this.slideT <= 0) {
      this.slides++;
      this.events.push({ type: 'slide' });
    }
    this.slideT = this.p.slideTime;
  }

  /** Knocked: lose the jump or slide, a short stumble. */
  knock(stumble = 0.5) {
    this.stumble = stumble;
    this.slideT = 0;
    this.slideQueued = false;
    if (this.airborne && this.vy > 0) this.vy = 0;
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
