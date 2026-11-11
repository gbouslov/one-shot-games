/**
 * The autoplay bot: plays a round through controls.act(), the same path the
 * mouse, touch and keyboard use. It ranks every open cell by how many metres
 * of path each tower type would cover from there, then follows a build order
 * (src/game/config.js `bot.order`): a tower type index, or 'up' to upgrade the
 * tower that has dealt the most damage. It calls waves early once the field is quiet.
 */
export class BotSystem {
  static id = 'bot';
  static deps = ['controls'];

  constructor({ order = [0, 0, 1, 2, 'up', 0, 1, 'up', 2, 'up', 0, 1, 'up', 'up'], callAt = 4 } = {}) {
    this.order = order;
    this.callAt = callAt;
  }

  init(ctx) {
    this.ctx = ctx;
    this.on = false;
    this.step = 0;
    this.clock = 0;
    this.ranked = null;
  }

  set(on) {
    this.on = on;
    this.step = 0;
    this.ranked = null;
  }

  /** Open cells for tower type i, best first. */
  rank(i) {
    const d = this.ctx.get('defense');
    this.ranked ??= {};
    if (!this.ranked[i]) {
      const def = d.towerDefs[i];
      const cells = [];
      for (const [c, r, t] of d.board.each()) {
        if (t !== '.') continue;
        const p = d.board.toWorld(c, r);
        // pulse towers want to sit right beside the path; shooters want coverage
        const near = d.board.distanceToPath(p.x, p.z);
        let score = d.board.coverage(p.x, p.z, def.range * 0.92);
        if (def.kind === 'pulse') score -= near * 4;
        cells.push({ c, r, score });
      }
      cells.sort((a, b) => b.score - a.score);
      this.ranked[i] = cells;
    }
    return this.ranked[i].filter((x) => d.board.buildable(x.c, x.r));
  }

  update(dt) {
    if (!this.on) return;
    const d = this.ctx.get('defense');
    const controls = this.ctx.get('controls');
    if (d.state !== 'playing') return;
    this.clock += dt;
    if (this.clock < 0.2) return;
    this.clock = 0;

    if (d.speed !== Math.max(...d.speeds)) {
      controls.act('speed');
      return;
    }

    // spend
    const want = this.order[this.step % this.order.length];
    if (want === 'up') {
      const best = [...d.towers].filter((t) => d.upgradeCost(t) !== null).sort((a, b) => (b.dealt ?? 0) - (a.dealt ?? 0))[0];
      if (!best) this.step++;
      else if (d.gold >= d.upgradeCost(best)) {
        controls.act('cell', best.c, best.r);
        controls.act('upgrade');
        controls.act('cancel');
        this.step++;
      }
    } else {
      const def = d.towerDefs[want];
      const spot = this.rank(want)[0];
      if (!def || !spot) this.step++;
      else if (d.gold >= def.cost) {
        if (controls.tool !== want) controls.act('tool', want);
        controls.act('cell', spot.c, spot.r);
        controls.act('cancel');
        this.step++;
      }
    }

    // call the next wave once this one has fully spawned and the field is thinning
    const alive = d.enemies.filter((e) => !e.dead).length;
    if (d.wave < d.waves.length && d.spawning.length === 0 && alive <= this.callAt && d.towers.length > 0) controls.act('call');
  }
}
