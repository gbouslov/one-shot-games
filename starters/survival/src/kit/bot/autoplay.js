/**
 * A bot that plays a survivors round through the same keys a person presses.
 * It walks a wide loop round the middle of the map (the way people kite a
 * horde), leans away from whatever is close, sweeps up experience when the
 * way is clear, fetches a flask when hurt, and picks level-up cards by
 * pressing 1, 2 or 3. It writes only to input.virtual(), never to the player
 * or the level-up state, so a round it wins proves the controls can win one.
 *
 *   ctx.get('bot').enabled = true      (window.__GAME__.debug.autoplay(true))
 *   bot.prefer = (option, ctx) => number    how much it wants a card (game may replace)
 */
export class BotSystem {
  static id = 'bot';
  static deps = ['player', 'horde', 'arena', 'camera'];

  init(ctx) {
    this.ctx = ctx;
    this.enabled = false;
    this.keys = new Set();
    this.spin = 1;
    this.prefer = null;
    this.tapped = null;
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
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.release();
  }

  _want(o, ctx) {
    if (this.prefer) return this.prefer(o, ctx);
    const p = ctx.get('player');
    if (o.kind === 'evolve') return 10;
    if (o.kind === 'filler') return 0.5;
    const hurt = 1 - p.health / p.maxHealth;
    if (o.def.kind === 'passive') return 3 + (o.def.levels[0].health ? hurt * 6 : 0) + o.level * 0.2;
    return (o.kind === 'new' ? 6 : 4) + o.level * 0.3;
  }

  update(dt, ctx) {
    if (!this.enabled) return;
    const round = ctx.get('round');
    if (round.state !== 'playing') {
      this.release();
      return;
    }
    // a card is up: choose through the keys
    const lu = ctx.get('levelup');
    if (this.tapped) {
      this._key(this.tapped, false);
      this.tapped = null;
    }
    if (lu.open) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) this._key(k, false);
      let best = 0;
      let bw = -Infinity;
      lu.choices.forEach((o, i) => {
        const w = this._want(o, ctx);
        if (w > bw) {
          bw = w;
          best = i;
        }
      });
      // wait a beat so a watcher sees the cards
      if (performance.now() - lu.openedAt > 250) {
        this.tapped = `Digit${best + 1}`;
        this._key(this.tapped, true);
      }
      return;
    }

    const p = ctx.get('player');
    const arena = ctx.get('arena');
    const list = ctx.get('horde').alive;
    const play = arena.play;
    const cx = (play.minX + play.maxX) / 2;
    const cz = (play.minZ + play.maxZ) / 2;

    // 1. away from what is close, harder the closer it is
    let ax = 0;
    let az = 0;
    let threat = 0;
    for (const e of list) {
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 0.01;
      const reach = e.def.boss ? 12 : 6;
      if (d > reach) continue;
      const w = ((reach - d) / reach) ** 2 * (e.def.boss ? 4 : 1) * (e.charge?.state === 'charge' ? 3 : 1);
      ax += (dx / d) * w;
      az += (dz / d) * w;
      threat += w;
    }
    // 2. a wide loop round the middle
    const rx = p.x - cx;
    const rz = p.z - cz;
    const r = Math.hypot(rx, rz) || 0.01;
    const ring = 11;
    // loop hard only when something is close; otherwise drift and let them come into range
    const loop = 0.25 + Math.min(1, threat) * 0.75;
    let mx = ((-rz / r) * this.spin + (rx / r) * (ring - r) * 0.12) * loop;
    let mz = ((rx / r) * this.spin + (rz / r) * (ring - r) * 0.12) * loop;
    mx += ax * 2.2;
    mz += az * 2.2;
    // 3. experience when it is safe, a flask when hurt
    let g = null;
    if (threat < 1.5) {
      let gd = 14;
      for (const it of ctx.get('gems').items) {
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < gd) {
          gd = d;
          g = it;
        }
      }
      if (g) {
        mx += ((g.x - p.x) / gd) * 1.3;
        mz += ((g.z - p.z) / gd) * 1.3;
      }
    }
    // nothing near and nothing to collect: close in until the weapons reach
    if (!g && threat < 0.2) {
      const e = ctx.get('horde').nearest(p.x, p.z, 30);
      if (e) {
        const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
        if (d > 9) {
          mx += ((e.x - p.x) / d) * 0.7;
          mz += ((e.z - p.z) / d) * 0.7;
        }
      }
    }
    const items = ctx.get('pickups').items;
    if (p.health < p.maxHealth * 0.6 && items.length) {
      let it = items[0];
      for (const i of items) if (Math.hypot(i.x - p.x, i.z - p.z) < Math.hypot(it.x - p.x, it.z - p.z)) it = i;
      const d = Math.hypot(it.x - p.x, it.z - p.z) || 1;
      if (d < 18) {
        mx += ((it.x - p.x) / d) * 1.6;
        mz += ((it.z - p.z) / d) * 1.6;
      }
    }
    // 4. off the edges and out of solids
    const edge = 5;
    if (p.x < play.minX + edge) mx += (play.minX + edge - p.x) * 0.6;
    if (p.x > play.maxX - edge) mx -= (p.x - (play.maxX - edge)) * 0.6;
    if (p.z < play.minZ + edge) mz += (play.minZ + edge - p.z) * 0.6;
    if (p.z > play.maxZ - edge) mz -= (p.z - (play.maxZ - edge)) * 0.6;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      const hit = arena.raycast(p.x, p.z, dx, dz, 2);
      if (hit.hit) {
        mx -= dx * (2 - hit.t) * 1.2;
        mz -= dz * (2 - hit.t) * 1.2;
      }
    }
    // cornered (pushed both ways): reverse the loop
    if (threat > 3 && ax * mx + az * mz < 0) this.spin = -this.spin;

    const b = ctx.get('camera').groundBasis();
    const sx = mx * b.rx + mz * b.rz;
    const sy = -(mx * b.fx + mz * b.fz);
    const l = Math.hypot(sx, sy) || 1;
    // a light touch on the keys when there is little reason to move
    if (Math.hypot(mx, mz) < 0.18) mx = mz = 0;
    const dead = 0.38;
    this._key('KeyD', sx / l > dead);
    this._key('KeyA', sx / l < -dead);
    this._key('KeyS', sy / l > dead);
    this._key('KeyW', sy / l < -dead);
  }
}
