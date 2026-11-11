import * as THREE from 'three';

/**
 * The rail camera. A chase camera whose springs run in rail-local space
 * (camera minus the rail anchor), so forward travel never adds lag; only
 * changes in the wanted pose do. It follows a fraction of the ship's offset,
 * looks ahead of it and leads the turn, rolls a little into the bank, pushes
 * in and widens on boost, and never sits inside or level with the ship.
 * 'orbit' circles the ship slowly for the title and end screens; 'hold'
 * frames a point (the wreck).
 *
 * Adapted from bop-del/meridian-line src/core/cameraRig.js (MIT, commit
 * bf4dc45): the rail-local critically damped springs, the follow / look
 * fractions, the minimum distance rule, the roll into the bank and the orbit
 * pose. The cinematic layers, intro flythrough and feel registry are gone.
 */
const clamp = THREE.MathUtils.clamp;
const DEG = Math.PI / 180;

function spring(s, target, freq, zeta, dt) {
  if (!(dt > 0)) return s.x;
  const w = 2 * Math.PI * Math.max(0.05, freq);
  const n = Math.min(10, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (-w * w * (s.x - target) - 2 * zeta * w * s.v) * h;
    s.x += s.v * h;
  }
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = target; s.v = 0; }
  return s.x;
}
const sp = () => ({ x: 0, v: 0 });

export class RailCamera {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.o = {
      fov: 68, boostFov: 9, height: 3.4, distance: 12.5, boostPush: 2.2,
      followX: 0.58, followY: 0.5, lookX: 0.78, lookY: 0.7, lookAhead: 38, lookLead: 0.12,
      freqX: 2.1, freqY: 2.3, freqZ: 1.7, lookFreq: 3, roll: 0.22, minDist: 6,
      ...opts,
    };
    this.s = { px: sp(), py: sp(), pz: sp(), lx: sp(), ly: sp(), roll: sp() };
    this.mode = 'chase';
    this.orbitA = 0.7;
    this.time = 0;
    this.fov = this.o.fov;
    this.shake = 0;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._hold = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._il = {};
  }

  addShake(x) {
    this.shake = Math.min(1.2, this.shake + x);
  }

  hold(p) {
    this._hold.copy(p);
    this.mode = 'hold';
    this._holdT = 0;
  }

  _ideal(ship) {
    const o = this.o;
    const up = clamp((ship.speed - ship.p.baseSpeed) / Math.max(1, ship.p.boostSpeed - ship.p.baseSpeed), 0, 1);
    const il = this._il;
    il.px = ship.offset.x * o.followX - ship.vel.x * 0.02;
    il.py = ship.offset.y * o.followY + o.height;
    il.pz = o.distance - up * o.boostPush;
    il.lx = ship.offset.x * o.lookX + ship.vel.x * o.lookLead;
    il.ly = ship.offset.y * o.lookY + 0.6;
    il.lz = -o.lookAhead;
    return o.fov + up * o.boostFov;
  }

  snap(ship) {
    this._ideal(ship);
    const s = this.s;
    const il = this._il;
    s.px.x = il.px; s.py.x = il.py; s.pz.x = il.pz; s.lx.x = il.lx; s.ly.x = il.ly; s.roll.x = 0;
    for (const k in s) s[k].v = 0;
  }

  update(dt, ship) {
    this.time += dt;
    const cam = this.camera;
    const pos = this._pos;
    const look = this._look;
    let fov = this.o.fov;
    let roll = 0;
    const a = ship.anchor;
    if (this.mode === 'title') {
      // Behind the ship, swinging slowly side to side, looking down the trench.
      const sw = Math.sin(this.time * 0.12) * 0.7;
      const r = 13;
      const p = ship.position;
      pos.set(p.x + Math.sin(sw) * r, p.y + 2.6 + Math.sin(this.time * 0.3) * 0.5, p.z + Math.cos(sw) * r);
      look.set(p.x - Math.sin(sw) * 6, p.y + 3.2, p.z - 40);
      fov = 56;
      roll = -sw * 0.08;
    } else if (this.mode === 'orbit') {
      this.orbitA += dt * 0.16;
      const r = 10;
      const p = ship.position;
      pos.set(p.x + Math.sin(this.orbitA) * r, p.y + 1.8 + Math.sin(this.time * 0.35) * 0.5, p.z + Math.cos(this.orbitA) * r * 1.1);
      look.set(p.x, p.y + 2.6, p.z - 0.5);
      fov = 50;
    } else if (this.mode === 'hold') {
      this._holdT += dt;
      const t = Math.min(this._holdT, 4);
      pos.set(this._hold.x + 5 + t * 0.6, this._hold.y + 3 + t * 0.4, this._hold.z + 14 + t * 1.2);
      look.copy(this._hold);
      fov = 60;
    } else {
      fov = this._ideal(ship);
      const s = this.s;
      const il = this._il;
      spring(s.px, il.px, this.o.freqX, 1, dt);
      spring(s.py, il.py, this.o.freqY, 1, dt);
      spring(s.pz, il.pz, this.o.freqZ, 1, dt);
      spring(s.lx, il.lx, this.o.lookFreq, 1, dt);
      spring(s.ly, il.ly, this.o.lookFreq, 1, dt);
      pos.set(a.x + s.px.x, a.y + s.py.x, a.z + s.pz.x);
      look.set(a.x + s.lx.x, a.y + s.ly.x, a.z + il.lz);
      // Never inside the ship, never level with or in front of it.
      const pp = ship.position;
      const minD = this.o.minDist;
      if (pos.z < pp.z + minD * 0.6) pos.z = pp.z + minD * 0.6;
      if (pos.distanceTo(pp) < minD) pos.sub(pp).setLength(minD).add(pp);
      const target = clamp(ship.bank * this.o.roll, -20 * DEG, 20 * DEG);
      roll = clamp(spring(s.roll, target, 1.8, 1, dt), -20 * DEG, 20 * DEG);
    }
    this.fov += (fov - this.fov) * (1 - Math.exp(-6 * dt));
    // Shake decays; offsets are a smooth pseudo-noise so it never jitters per frame.
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const k = this.shake * this.shake;
    const t = this.time * 31;
    cam.position.copy(pos);
    cam.position.x += Math.sin(t * 1.1) * Math.sin(t * 0.37) * k * 0.8;
    cam.position.y += Math.sin(t * 0.9 + 1) * Math.sin(t * 0.53) * k * 0.6;
    cam.up.copy(this._up);
    cam.lookAt(look);
    cam.rotateZ(roll + Math.sin(t * 0.7) * k * 0.03);
    const aspect = cam.aspect || 1.78;
    const fovOut = clamp(this.fov * (1 + Math.max(0, 1.5 - aspect) * 0.35), 20, 120);
    if (Math.abs(cam.fov - fovOut) > 0.01) {
      cam.fov = fovOut;
      cam.updateProjectionMatrix();
    }
  }
}
