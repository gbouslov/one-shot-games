// Movement and camera feel condensed from mshumer/Claude-of-Duty src/player (MIT).
// See third_party/NOTICES.md. Stances, mantling and leaning were removed.
import * as THREE from 'three';
import { RecoilAxis, Spring, approach, clamp, hashNoise, moveToward } from './springs.js';

export const PLAYER_DEFAULTS = {
  walkSpeed: 5.2,
  sprintSpeed: 8.4,
  crouchSpeed: 2.8,
  groundAccel: 62,
  groundDecel: 48,
  airAccel: 16,
  gravity: -22,
  jumpSpeed: 7.6,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  height: 1.78,
  crouchHeight: 1.15,
  eyeBelowTop: 0.12,
  radius: 0.32,
  maxHealth: 100,
  regenDelay: 5,
  regenRate: 12,
  bobAmount: 0.038,
  killY: -40,
};

/**
 * First-person body: capsule movement, look, camera feel and health.
 *
 * API used by the rest of the kit:
 *   player.addRecoil(pitch, yaw)   player.addTrauma(0..1)
 *   player.applyDamage(n, fromVec3)   player.heal(n)   player.reset(spawn, yaw)
 *   player.eye (Vector3)  player.forward (Vector3)  player.yaw  player.pitch
 */
export class PlayerSystem {
  static id = 'player';
  static deps = ['physics'];

  async init(ctx) {
    this.ctx = ctx;
    this.t = { ...PLAYER_DEFAULTS, ...(ctx.config.player ?? {}) };
    this.character = ctx.get('physics').createCharacter({
      radius: this.t.radius,
      height: this.t.height,
    });
    this.velocity = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.feet = new THREE.Vector3();
    this.prevFeet = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.health = this.t.maxHealth;
    this.maxHealth = this.t.maxHealth;
    this.dead = false;
    this.grounded = false;
    this.sprinting = false;
    this.crouching = false;
    this.controlEnabled = false;
    this.speed = 0;
    this.stepPhase = 0;

    this._coyote = 0;
    this._jumpBuffered = 0;
    this._eyeHeight = this.t.height - this.t.eyeBelowTop;
    this._lastHurt = -999;
    this._wish = { x: 0, y: 0 };
    this._lastStep = 0;

    this.recoilPitch = new RecoilAxis();
    this.recoilYaw = new RecoilAxis(10, 0.6, 0.24, 0.2);
    this.landDip = new Spring(4.5, 0.55);
    this.roll = 0;
    this.trauma = 0;
    this.fovKick = 0;
    this.scriptedCamera = false;
  }

  reset(spawn, yaw = 0) {
    this.character.height = this.t.height;
    this.character.teleport(spawn[0], spawn[1], spawn[2]);
    this.velocity.set(0, 0, 0);
    this.feet.set(spawn[0], this.character.position.y, spawn[2]);
    this.prevFeet.copy(this.feet);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.trauma = 0;
    this.landDip.reset(0);
    this.recoilPitch.reset();
    this.recoilYaw.reset();
  }

  addRecoil(pitch = 0, yaw = 0) {
    this.recoilPitch.kick(pitch);
    this.recoilYaw.kick(yaw);
  }

  addTrauma(a) {
    this.trauma = Math.min(1, this.trauma + a);
  }

  applyDamage(amount, from) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this._lastHurt = this.ctx.time.elapsed;
    this.addTrauma(Math.min(0.55, amount / 40));
    let direction = null;
    if (from) {
      const dx = from.x - this.feet.x;
      const dz = from.z - this.feet.z;
      direction = Math.atan2(dx, dz) - this.yaw;
    }
    this.ctx.events.emit('player:damaged', { amount, health: this.health, direction });
    if (this.health <= 0) {
      this.dead = true;
      this.ctx.events.emit('player:died', {});
    }
  }

  heal(n) {
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  beginFrame(dt, ctx) {
    if (!this.controlEnabled || this.dead) return;
    const input = ctx.input;
    this.yaw -= input.look.x;
    this.pitch = clamp(this.pitch - input.look.y, -1.45, 1.45);
    if (input.actionPressed('jump')) this._jumpBuffered = this.t.jumpBuffer;
    input.moveVector(this._wish);
    this.crouching = input.action('crouch');
    this.sprinting = input.action('sprint') && this._wish.y > 0.3 && !this.crouching;
  }

  fixedUpdate(h) {
    if (!this.controlEnabled) return;
    const t = this.t;
    const c = this.character;
    const v = this.velocity;
    this.prevFeet.copy(this.feet);

    const alive = !this.dead;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = alive ? this._wish.x * cos - this._wish.y * sin : 0;
    const wz = alive ? -this._wish.x * sin - this._wish.y * cos : 0;
    const target = this.crouching ? t.crouchSpeed : this.sprinting ? t.sprintSpeed : t.walkSpeed;

    const accel = c.grounded
      ? (wx || wz ? t.groundAccel : t.groundDecel)
      : t.airAccel;
    v.x = moveToward(v.x, wx * target, accel, h);
    v.z = moveToward(v.z, wz * target, accel, h);

    this._coyote = c.grounded ? t.coyoteTime : Math.max(0, this._coyote - h);
    this._jumpBuffered = Math.max(0, this._jumpBuffered - h);
    if (this._jumpBuffered > 0 && this._coyote > 0 && alive) {
      v.y = t.jumpSpeed;
      this._jumpBuffered = 0;
      this._coyote = 0;
      c.grounded = false;
      this.ctx.events.emit('player:jump', {});
    } else if (c.grounded && v.y <= 0) {
      v.y = -2; // keep contact on slopes
    } else {
      v.y += t.gravity * h;
    }

    c.velocity.x = v.x;
    c.velocity.y = v.y;
    c.velocity.z = v.z;
    const fallSpeed = -v.y;
    c.move(v.x * h, v.y * h, v.z * h);
    v.x = c.velocity.x;
    v.y = c.velocity.y;
    v.z = c.velocity.z;

    c.setHeight(this.crouching ? t.crouchHeight : t.height);

    if (c.grounded && !c.wasGrounded && fallSpeed > 3) {
      this.landDip.impulse(-Math.min(2.2, fallSpeed * 0.2));
      this.ctx.events.emit('player:land', { speed: fallSpeed });
    }
    this.grounded = c.grounded;
    this.speed = Math.hypot(v.x, v.z);
    this.feet.set(c.position.x, c.position.y, c.position.z);

    if (this.grounded && this.speed > 0.5) {
      this.stepPhase += (this.speed / (this.sprinting ? 3.1 : 2.45)) * h;
      if (Math.floor(this.stepPhase) !== this._lastStep) {
        this._lastStep = Math.floor(this.stepPhase);
        this.ctx.events.emit('player:step', { running: this.sprinting });
      }
    }
    if (c.position.y < t.killY && alive) this.applyDamage(99999);
  }

  update(dt, ctx) {
    const t = this.t;
    if (this.controlEnabled && !this.dead && ctx.time.elapsed - this._lastHurt > t.regenDelay) {
      this.heal(t.regenRate * dt);
    }

    this.recoilPitch.step(dt);
    this.recoilYaw.step(dt);
    this.landDip.step(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.fovKick = approach(this.fovKick, this.sprinting ? 6 : 0, 0.12, dt);

    const targetEye = (this.crouching ? t.crouchHeight : t.height) - t.eyeBelowTop;
    this._eyeHeight = approach(this._eyeHeight, targetEye, 0.05, dt);

    if (this.scriptedCamera) return;

    const cam = ctx.camera;
    const a = ctx.time.alpha;
    const x = THREE.MathUtils.lerp(this.prevFeet.x, this.feet.x, a);
    const y = THREE.MathUtils.lerp(this.prevFeet.y, this.feet.y, a);
    const z = THREE.MathUtils.lerp(this.prevFeet.z, this.feet.z, a);

    const moveAmt = this.grounded ? Math.min(1, this.speed / t.walkSpeed) : 0;
    const bobPhase = this.stepPhase * Math.PI;
    const bobY = Math.abs(Math.sin(bobPhase)) * t.bobAmount * moveAmt * (this.sprinting ? 1.5 : 1);
    const bobX = Math.cos(bobPhase) * t.bobAmount * 0.6 * moveAmt;

    const shake = this.trauma * this.trauma;
    const n = ctx.time.elapsed * 22;
    const sx = hashNoise(n, 1) * shake * 0.05;
    const sy = hashNoise(n, 2) * shake * 0.05;
    const sr = hashNoise(n, 3) * shake * 0.06;

    this.roll = approach(this.roll, -this._wish.x * 0.018, 0.12, dt);

    this.eye.set(x, y + this._eyeHeight + this.landDip.value * 0.1 + bobY, z);
    this.eye.x += Math.cos(this.yaw) * bobX;
    this.eye.z -= Math.sin(this.yaw) * bobX;

    cam.position.copy(this.eye);
    cam.rotation.set(
      this.pitch + this.recoilPitch.value + sx,
      this.yaw + this.recoilYaw.value + sy,
      this.roll + sr,
      'YXZ'
    );
    const fov = ctx.config.fov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
  }
}
