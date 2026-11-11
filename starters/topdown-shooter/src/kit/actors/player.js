import * as THREE from 'three';
import { blobShadow, poseRig } from './rig.js';

/**
 * The player on the ground plane: twin-stick movement with acceleration, a dash
 * with invulnerable frames, health, and the body the camera follows.
 *
 * Reads input.move (screen space, turned into ground directions by the camera)
 * and the aim (mouse ray onto the ground, the right touch stick, or a world point
 * the bot sets). The look of the body comes from config.player.rig(rng).
 *
 * Events: player:damaged { amount, from }, player:died, player:dash, player:step
 */
export class PlayerSystem {
  static id = 'player';
  static deps = ['arena', 'audio', 'fx'];

  init(ctx) {
    this.ctx = ctx;
    const cfg = ctx.config.player ?? {};
    this.cfg = {
      speed: 6.2, accel: 42, radius: 0.42, maxHealth: 100,
      dashSpeed: 19, dashTime: 0.17, dashCooldown: 0.75, regen: 0, ...cfg,
    };
    this.maxHealth = this.cfg.maxHealth;
    this.rng = ctx.rng.fork();
    this.rig = cfg.rig ? cfg.rig(this.rng) : null;
    this.root = new THREE.Group();
    if (this.rig) this.root.add(this.rig.group);
    this.root.add(blobShadow(0.6, 0.6));
    ctx.scene.add(this.root);
    this.controlEnabled = false;
    this.scriptedCamera = false;
    this.reset([0, 0], 0);
  }

  reset(spawn, yaw = 0) {
    this.x = spawn[0];
    this.z = spawn[1];
    this.vx = 0;
    this.vz = 0;
    this.yaw = yaw;
    this.aimX = this.x + Math.sin(yaw) * 6;
    this.aimZ = this.z + Math.cos(yaw) * 6;
    this.health = this.maxHealth;
    this.dead = false;
    this.dash = 0;
    this.dashCd = 0;
    this.dashes = 0;
    this.invuln = 0;
    this.hurtT = 0;
    this.stepDist = 0;
    this.gait = 0;
    this.speed = 0;
    this.recoil = 0;
    this.deathT = 0;
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.set(0, yaw, 0);
    if (this.rig) this.rig.group.rotation.set(0, 0, 0);
  }

  get feet() {
    return { x: this.x, y: 0, z: this.z };
  }

  applyDamage(amount, from = null) {
    if (this.dead || this.invuln > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.hurtT = 1;
    this.invuln = 0.35;
    if (from) {
      const dx = this.x - from.x;
      const dz = this.z - from.z;
      const l = Math.hypot(dx, dz) || 1;
      this.vx += (dx / l) * 7;
      this.vz += (dz / l) * 7;
    }
    this.ctx.events.emit('player:damaged', { amount, from, direction: from ? Math.atan2(from.x - this.x, from.z - this.z) : null });
    if (this.health <= 0) {
      this.dead = true;
      this.ctx.events.emit('player:died');
    }
    return true;
  }

  heal(n) {
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  _aim(ctx) {
    const input = ctx.input;
    const cam = ctx.get('camera');
    if (input.aimWorld) {
      this.aimX = input.aimWorld[0];
      this.aimZ = input.aimWorld[1];
    } else if (input.aimStick) {
      const b = cam.groundBasis();
      const s = input.aimStick;
      this.aimX = this.x + (b.rx * s.x - b.fx * s.y) * 8;
      this.aimZ = this.z + (b.rz * s.x - b.fz * s.y) * 8;
    } else if (input.pointer && input.mode === 'mouse' && cam.mode === 'topdown') {
      const g = cam.screenToGround(input.pointer.x, input.pointer.y, 1.1);
      if (g) {
        this.aimX = g.x;
        this.aimZ = g.z;
      }
    } else if (cam.mode === 'shoulder' && input.lookDX) {
      // over-the-shoulder: horizontal mouse motion turns the aim
      this.yaw -= input.lookDX * 0.0042;
      this.aimX = this.x + Math.sin(this.yaw) * 10;
      this.aimZ = this.z + Math.cos(this.yaw) * 10;
    }
    const dx = this.aimX - this.x;
    const dz = this.aimZ - this.z;
    if (dx * dx + dz * dz > 0.04) this.yaw = Math.atan2(dx, dz);
  }

  update(dt, ctx) {
    const c = this.cfg;
    const input = ctx.input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 3);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.recoil = Math.max(0, this.recoil - dt * 9);

    if (this.dead) {
      this.deathT = Math.min(1, this.deathT + dt * 2.4);
      if (this.rig) this.rig.group.rotation.x = -this.deathT * 1.45;
      this.vx *= Math.exp(-6 * dt);
      this.vz *= Math.exp(-6 * dt);
    } else if (this.controlEnabled) {
      if (!this.scriptedCamera) this._aim(ctx);
      const b = ctx.get('camera').groundBasis();
      let mx = b.rx * input.move.x - b.fx * input.move.y;
      let mz = b.rz * input.move.x - b.fz * input.move.y;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) {
        mx /= ml;
        mz /= ml;
      }
      if (input.pressed('dash') && this.dashCd <= 0) {
        // Dash where you are moving, or where you aim when standing still.
        let dx = mx;
        let dz = mz;
        if (ml < 0.1) {
          dx = Math.sin(this.yaw);
          dz = Math.cos(this.yaw);
        }
        const l = Math.hypot(dx, dz) || 1;
        this.vx = (dx / l) * c.dashSpeed;
        this.vz = (dz / l) * c.dashSpeed;
        this.dash = c.dashTime;
        this.dashCd = c.dashCooldown;
        this.invuln = Math.max(this.invuln, c.dashTime + 0.05);
        this.dashes++;
        ctx.events.emit('player:dash', { x: this.x, z: this.z, dx: dx / l, dz: dz / l });
      }
      if (this.dash > 0) {
        this.dash -= dt;
      } else {
        const k = 1 - Math.exp(-c.accel / c.speed * dt);
        this.vx += (mx * c.speed - this.vx) * k;
        this.vz += (mz * c.speed - this.vz) * k;
      }
      if (c.regen) this.health = Math.min(this.maxHealth, this.health + c.regen * dt);
    } else {
      this.vx *= Math.exp(-10 * dt);
      this.vz *= Math.exp(-10 * dt);
    }

    const p = { x: this.x + this.vx * dt, z: this.z + this.vz * dt };
    ctx.get('arena').resolve(p, c.radius, ctx.get('arena').play);
    const moved = Math.hypot(p.x - this.x, p.z - this.z);
    this.speed = dt > 0 ? moved / dt : 0;
    this.x = p.x;
    this.z = p.z;

    // Gait advances by distance, so feet never slide.
    this.gait += moved * 2.6;
    this.stepDist += moved;
    if (this.stepDist > 1.25 && this.dash <= 0) {
      this.stepDist = 0;
      ctx.events.emit('player:step', { running: this.speed > 4 });
    }

    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw;
    if (this.rig && !this.dead) {
      // Lean into the run, measured in the body's own frame.
      const fwd = (this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw)) / c.speed;
      poseRig(this.rig, { phase: this.gait, stride: Math.min(1, this.speed / c.speed), hold: 1, lean: fwd * 0.12, t: ctx.time.elapsed, recoil: this.recoil });
      this.rig.flash(this.hurtT * 0.6);
      this.rig.group.visible = !(this.invuln > 0 && this.dash <= 0 && Math.floor(ctx.time.elapsed * 20) % 2 === 0);
    }
  }
}
