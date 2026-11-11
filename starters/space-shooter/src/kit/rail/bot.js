/**
 * The autoplay bot. It flies through the SAME control map the keyboard
 * writes (KeyA/KeyD/KeyW/KeyS, Space, ShiftLeft) as its own 'bot' source,
 * so a round it wins proves the keyboard path works end to end.
 *
 * Each frame it picks a place to be in the screen box:
 *   1. clear of any bar crossing the trench ahead (over or under it),
 *   2. out of the path of enemy bolts that will pass close in the next second,
 *   3. otherwise lined up so a bolt fired now meets the best target
 *      (the boss's open parts first, then the nearest craft or turret),
 * and holds fire while a target is lined up. It boosts down empty stretches.
 *
 * Written for this repository.
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RailBot {
  constructor(input, opts = {}) {
    this.input = input;
    this.o = { gain: 0.32, deadband: 0.25, dodgeTime: 1.0, dodgeRadius: 2.6, boost: true, ...opts };
  }

  /** Offset the ship needs so a bolt meets a point `dz` ahead at (tx, ty) (rail frame). */
  _lead(ship, tx, ty, dz) {
    const p = ship.p;
    const k = 1 + (p.aimGain - 1) * Math.min(1.6, dz / p.aimDistance);
    return { x: tx / k, y: (ty - p.baseY) / k };
  }

  update(round) {
    const ship = round.ship;
    const p = ship.p;
    const b = p.bounds;
    const sz = ship.position.z;
    let tx = 0;
    let ty = 0;
    let fire = false;
    let target = null;

    // 3. Target: best enemy ahead in range.
    let best = Infinity;
    for (const e of round.enemies) {
      if (!e.alive) continue;
      const dz = sz - e.pos.z; // distance ahead
      if (dz < 12 || dz > 200) continue;
      if (e.kind === 'node' || e.kind === 'core') {
        if (!round.bossActive || e.armored) continue;
      }
      if (e.rel && e.t - (e.delay ?? 0) < 1.2) continue; // still flying in
      const lead = this._lead(ship, e.pos.x, e.pos.y, dz);
      if (Math.abs(lead.x) > b.x + 1 || Math.abs(lead.y) > b.y + 1) continue;
      const cost = dz * 0.4 + Math.hypot(lead.x - ship.offset.x, lead.y - ship.offset.y) * 2 + (e.kind === 'turret' ? -20 : 0);
      if (cost < best) {
        best = cost;
        target = { e, lead };
      }
    }
    if (target) {
      tx = target.lead.x;
      ty = target.lead.y;
      const err = Math.hypot(tx - ship.offset.x, ty - ship.offset.y);
      fire = err < Math.max(1.6, target.e.r * 0.8);
    } else {
      tx = ship.offset.x * 0.5;
      ty = 1.5;
    }

    // 2. Dodge enemy bolts that will pass close within dodgeTime.
    let dx = 0;
    let dy = 0;
    for (const s of round.shots) {
      // Relative to the ship, assuming the ship holds still in the rail frame.
      const rx = s.pos.x - ship.position.x;
      const ry = s.pos.y - ship.position.y;
      const rz = s.pos.z - ship.position.z;
      const vz = s.vel.z + ship.speed;
      if (rz > 2 || vz <= 1) continue;
      const tHit = -rz / vz;
      if (tHit > this.o.dodgeTime) continue;
      const px = rx + s.vel.x * tHit;
      const py = ry + s.vel.y * tHit;
      const d = Math.hypot(px, py);
      if (d < this.o.dodgeRadius) {
        const w = (this.o.dodgeRadius - d) / this.o.dodgeRadius + 0.4;
        dx -= (px / (d || 1)) * w * 5 || w * 5;
        dy -= (py / (d || 1)) * w * 3;
      }
    }
    if (dx || dy) {
      tx = ship.offset.x + dx;
      ty = ship.offset.y + dy;
      // Pinned against a wall of the box: go the other way.
      if (Math.abs(tx) > b.x - 0.5) tx = ship.offset.x - Math.sign(dx) * 4;
    }

    // 1. Bars: the side with more room, decided well ahead.
    for (const bar of round.bars) {
      const dz = sz - bar.z;
      if (dz < -2 || dz > 120) continue;
      const by = bar.y - p.baseY;
      const above = by + bar.h / 2 + 2.2;
      const below = by - bar.h / 2 - 2.2;
      const goUp = above <= b.y && (below < -b.y || Math.abs(above - ship.offset.y) <= Math.abs(below - ship.offset.y));
      ty = goUp ? Math.max(ty, above) : Math.min(ty, below);
      if (dz < 40) fire = false;
    }

    tx = clamp(tx, -b.x, b.x);
    ty = clamp(ty, -b.y, b.y);
    const ex = tx - ship.offset.x - ship.vel.x * 0.12;
    const ey = ty - ship.offset.y - ship.vel.y * 0.12;
    const g = this.o.gain;
    const db = this.o.deadband;
    const set = (code, v) => (v > 0.02 ? this.input.press(code, clamp(v, 0, 1), 'bot') : this.input.release(code, 'bot'));
    set('KeyD', ex > db ? ex * g : 0);
    set('KeyA', ex < -db ? -ex * g : 0);
    set('KeyW', ey > db ? ey * g : 0);
    set('KeyS', ey < -db ? -ey * g : 0);
    set('Space', fire ? 1 : 0);
    const quiet = !target && round.enemies.length === 0 && !round.boss && round.shots.length === 0;
    set('ShiftLeft', this.o.boost && quiet && ship.boost > 0.5 ? 1 : 0);
    this.target = target?.e ?? null;
  }
}
