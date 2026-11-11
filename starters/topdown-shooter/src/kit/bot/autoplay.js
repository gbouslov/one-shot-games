/**
 * A bot that plays a round through the same keys a person presses. It holds
 * WASD toward safety, aims at the nearest enemy it can see (leading it a little),
 * fires, dashes out of a grab and walks over health when it is hurt. It writes
 * to input.virtual() and input.aimWorld, never to the player directly, so a
 * round it wins proves the controls can win one.
 *
 *   ctx.get('bot').enabled = true      (window.__GAME__.debug.autoplay(true))
 */
export class BotSystem {
  static id = 'bot';
  static deps = ['player', 'enemies', 'weapons', 'arena', 'camera'];

  init(ctx) {
    this.ctx = ctx;
    this.enabled = false;
    this.keys = new Set();
    this.strafe = 1;
    this.strafeT = 0;
    this.dashHeld = false;
  }

  _key(code, on) {
    const input = this.ctx.input;
    if (on && !this.keys.has(code)) {
      this.keys.add(code);
      input.virtual(code, true);
    } else if (!on && this.keys.has(code)) {
      this.keys.delete(code);
      input.virtual(code, false);
    }
  }

  release() {
    for (const k of [...this.keys]) this._key(k, false);
    this.ctx.input.aimWorld = null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.release();
  }

  update(dt, ctx) {
    if (!this.enabled) return;
    const round = ctx.get('round');
    if (round.state !== 'playing') {
      this.release();
      return;
    }
    const p = ctx.get('player');
    const arena = ctx.get('arena');
    const weapons = ctx.get('weapons');
    const list = ctx.get('enemies').alive;

    // target: the nearest enemy in sight, else the nearest at all
    let target = null;
    let best = Infinity;
    for (const e of list) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      const seen = arena.clearLine(p.x, p.z, e.x, e.z);
      const score = d + (seen ? 0 : 20);
      if (score < best) {
        best = score;
        target = e;
      }
    }

    // move: away from anything close, toward the middle, sideways around the target
    let mx = 0;
    let mz = 0;
    for (const e of list) {
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 8) {
        const w = (8 - d) / 8;
        mx += (dx / d) * w * 2;
        mz += (dz / d) * w * 2;
      }
    }
    const play = arena.play;
    const cx = (play.minX + play.maxX) / 2;
    const cz = (play.minZ + play.maxZ) / 2;
    const toC = Math.hypot(cx - p.x, cz - p.z);
    const pull = Math.min(1, toC / 10);
    mx += ((cx - p.x) / (toC || 1)) * pull * 0.9;
    mz += ((cz - p.z) / (toC || 1)) * pull * 0.9;
    // keep off walls: probe the four directions and push away from close solids
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hit = arena.raycast(p.x, p.z, dx, dz, 2.2);
      if (hit.hit) {
        mx -= dx * (2.2 - hit.t) * 0.8;
        mz -= dz * (2.2 - hit.t) * 0.8;
      }
    }
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = -this.strafe;
      this.strafeT = 2.5;
    }
    if (target) {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      mx += (-dz / d) * 0.6 * this.strafe;
      mz += (dx / d) * 0.6 * this.strafe;
      if (d > 13) {
        mx += (dx / d) * 0.8;
        mz += (dz / d) * 0.8;
      }
    }
    // hurt: go for the nearest health
    const items = ctx.get('pickups').items;
    if (p.health < p.maxHealth * 0.65 && items.length) {
      let it = items[0];
      for (const i of items) if (Math.hypot(i.x - p.x, i.z - p.z) < Math.hypot(it.x - p.x, it.z - p.z)) it = i;
      const d = Math.hypot(it.x - p.x, it.z - p.z) || 1;
      mx += ((it.x - p.x) / d) * 1.4;
      mz += ((it.z - p.z) / d) * 1.4;
    }

    const b = ctx.get('camera').groundBasis();
    const sx = mx * b.rx + mz * b.rz;
    const sy = -(mx * b.fx + mz * b.fz);
    const dead = 0.25;
    this._key('KeyD', sx > dead);
    this._key('KeyA', sx < -dead);
    this._key('KeyS', sy > dead);
    this._key('KeyW', sy < -dead);

    // aim and fire
    let fire = false;
    if (target) {
      const lead = 0.12;
      const ax = target.x + target.vx * lead;
      const az = target.z + target.vz * lead;
      ctx.input.aimWorld = [ax, az];
      const d = Math.hypot(ax - p.x, az - p.z);
      const range = weapons.current.def.range ?? 30;
      fire = d < range && arena.clearLine(p.x, p.z, target.x, target.z);
      // the short gun up close, the long gun at range
      const want = d < 4.5 && weapons.slots.length > 1 ? 1 : 0;
      if (weapons.index !== want && weapons.reloading <= 0 && weapons.slots[want].ammo > 0) this._key(`Digit${want + 1}`, true);
      else this._key(`Digit${want + 1}`, false);
      // grabbed: dash out
      if (d < 1.7 && p.dashCd <= 0 && !this.dashHeld) {
        this._key('Space', true);
        this.dashHeld = true;
      } else if (this.dashHeld) {
        this._key('Space', false);
        this.dashHeld = false;
      }
    } else {
      ctx.input.aimWorld = [p.x + Math.sin(p.yaw) * 6, p.z + Math.cos(p.yaw) * 6];
    }
    this._key('Mouse0', fire);
  }
}
