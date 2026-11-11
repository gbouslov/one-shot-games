import * as THREE from 'three';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;

/**
 * The autoplay bot. It flies by holding the same key codes a player holds,
 * as the 'bot' source in Controls, so a round it wins proves the keyboard
 * path works end to end. Call update() once per frame (not per physics step),
 * as a player's hands would.
 *
 *   const bot = new Autopilot(controls, { ground: (x, z) => h, keys: model.p.keys });
 *   bot.update(model, gate)   gate = { pos: Vector3, normal: Vector3 } or null
 *   bot.release()
 *
 * Steering: heading error asks for a bank, bank error drives roll; the climb
 * angle toward an aim point a little in front of the gate drives pitch; a
 * look-ahead over the ground overrides the climb when terrain is close.
 * If it overshoots a gate it swings round to a point in front of it again.
 *
 * Written for this repository.
 */
export class Autopilot {
  constructor(controls, { ground, keys, clearance = 40, throttle = 0.86, maxBank = 1.0 } = {}) {
    this.c = controls;
    this.ground = ground;
    this.k = keys;
    this.clearance = clearance;
    this.throttle = throttle;
    this.maxBank = maxBank;
    this.recover = false;
    this.aim = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  _set(pos, neg, v) {
    const src = 'bot';
    for (const c of [].concat(pos)) this.c.release(c, src);
    for (const c of [].concat(neg)) this.c.release(c, src);
    if (v > 0.01) this.c.press([].concat(pos)[0], Math.min(1, v), src);
    else if (v < -0.01) this.c.press([].concat(neg)[0], Math.min(1, -v), src);
  }

  release() {
    this.c.clearSource('bot');
  }

  update(model, gate) {
    const k = this.k;
    const pos = model.position;
    if (gate) {
      const s = this._d.subVectors(pos, gate.pos).dot(gate.normal);
      if (s > 2) this.recover = true;
      if (this.recover && s < -180) this.recover = false;
      const dist = pos.distanceTo(gate.pos);
      const lead = this.recover ? 320 : clamp(dist * 0.4, 0, 160) * (dist > 90 ? 1 : 0);
      this.aim.copy(gate.pos).addScaledVector(gate.normal, -lead);
    } else {
      this.aim.copy(pos).addScaledVector(model.fwd, 300);
      this.aim.y = Math.max(pos.y, 180);
    }

    const dx = this.aim.x - pos.x;
    const dz = this.aim.z - pos.z;
    const horiz = Math.max(1, Math.hypot(dx, dz));
    const want = Math.atan2(dx, -dz);
    const err = wrap(want - model.heading);

    // Roll toward the bank the turn needs.
    const bankWant = clamp(err * 1.6, -this.maxBank, this.maxBank);
    const bank = model.bank;
    this._set(k.rollRight, k.rollLeft, clamp((bankWant - bank) * 2.2, -1, 1));

    // Climb angle toward the aim point, overridden by the ground ahead.
    let gamma = clamp(Math.atan2(this.aim.y - pos.y, horiz), -0.35, 0.35);
    const fx = model.fwd.x;
    const fz = model.fwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    for (const d of [40, 90, 150, 230, 320]) {
      const g = Math.max(0, this.ground(pos.x + (fx / fl) * d, pos.z + (fz / fl) * d));
      const need = Math.atan2(g + this.clearance - pos.y, d);
      if (need > gamma) gamma = Math.min(0.5, need);
    }
    if (model.speed < model.p.stallSpeed + 14) gamma = Math.min(gamma, -0.05);
    const pitchCmd = clamp(((gamma - model.pitch) * 3) / Math.max(0.45, Math.cos(bank)), -1, 1);
    this._set(k.pitchUp, k.pitchDown, pitchCmd);

    // Rudder for the last few degrees.
    this._set(k.yawRight, k.yawLeft, Math.abs(err) < 0.3 ? clamp(err * 2.5, -1, 1) * 0.6 : 0);

    // Throttle: hold a cruise setting, more in a climb.
    const thr = this.throttle + (gamma > 0.15 ? 0.12 : 0);
    const tk = [].concat(k.throttleUp)[0];
    const fk = [].concat(k.throttleDown)[0];
    this.c.release(tk, 'bot');
    this.c.release(fk, 'bot');
    if (model.throttle < thr - 0.02) this.c.press(tk, 1, 'bot');
    else if (model.throttle > thr + 0.02) this.c.press(fk, 1, 'bot');
  }
}
