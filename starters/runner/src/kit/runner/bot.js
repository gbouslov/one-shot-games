/**
 * The autoplay bot. It reads the course ahead the way a player reads the
 * screen and plays through the control map as its own source, tapping the
 * same codes the keyboard writes (ArrowLeft / ArrowRight / ArrowUp /
 * ArrowDown), so a round it wins proves the keyboard path works.
 *
 * Each frame (it runs once a frame, before the fixed steps, so on a slow
 * software-WebGL frame it decides once per 0.1 s of game time):
 *   1. The next row inside the horizon: which lanes are clear, which need a
 *      jump (low), which a slide (high), which are blocked (tall).
 *   2. Pick a lane: clear in this row and, if possible, the row after; then
 *      prefer one with pickups; then the nearest.
 *   3. Tap toward that lane; tap jump or slide when the row is at the right
 *      distance for the jump arc or the slide to cover it.
 *
 * Params (rules.bot): horizon (s), jumpLead [min,max] (s), slideLead [min,max] (s).
 *
 * Written for this repository.
 */
export class RunnerBot {
  constructor(input, p = {}) {
    this.input = input;
    this.p = { horizon: 1.25, jumpLead: [0.16, 0.34], slideLead: [0.06, 0.3], ...p };
    this.taps = 0;
  }

  _tap(code) {
    // A press not yet taken by a fixed step (a fast frame can have none) would count twice.
    if (this.input.edges.get(code)) return;
    this.input.tap(code, 'bot');
    this.taps++;
  }

  /** What a lane needs in a row: 'clear', 'jump', 'slide' or 'block'. */
  static need(row, lane, body) {
    let need = 'clear';
    for (const o of row) {
      if (o.lanes && !o.lanes.includes(lane)) continue;
      const jumpable = o.y1 <= body.p.jumpHeight * 0.85;
      const slidable = o.y0 >= body.p.slideHeight + 0.05;
      const n = jumpable ? 'jump' : slidable ? 'slide' : 'block';
      if (n === 'block' || need === 'clear') need = n;
      else if (n !== need) need = 'block';
    }
    return need;
  }

  update(round) {
    const b = round.body;
    const v = Math.max(1, b.speed);
    const P = this.p;
    const lanes = [];
    for (let l = -b.maxLane; l <= b.maxLane; l++) lanes.push(l);

    // Rows ahead (obstacles that share an s), nearest first.
    const near = round.ahead(b.s, v * P.horizon * 2 + 8).filter((o) => o.s + o.depth > b.s - 0.2 && !o.hit);
    const rows = [];
    for (const o of near) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last[0].s - o.s) < 0.5) last.push(o);
      else rows.push([o]);
    }
    const row = rows[0];
    const next = rows[1];
    const dist = row ? row[0].s - b.s : Infinity;
    const cost = { clear: 0, jump: 1, slide: 1, block: 9 };

    // 1. Lane.
    let target = b.lane;
    if (row && dist < v * P.horizon + 6) {
      let best = Infinity;
      for (const l of lanes) {
        let c = cost[RunnerBot.need(row, l, b)] * 10 + Math.abs(l - b.lane) * 1.5;
        if (next && next[0].s - row[0].s < v * 1.2) c += cost[RunnerBot.need(next, l, b)] * 2;
        // Not enough time to cross two lanes when the row is close.
        if (Math.abs(l - b.lane) >= 2 && dist < v * 0.35) c += 50;
        if (c < best) {
          best = c;
          target = l;
        }
      }
    } else {
      // Nothing close: drift toward pickups ahead.
      const want = round.course.pickups.find((p) => !p.taken && p.s > b.s + 2 && p.s < b.s + v * 1.4);
      if (want) target = want.lane;
    }
    if (!this.input.edges.get('ArrowLeft') && !this.input.edges.get('ArrowRight')) {
      if (target < b.lane) this._tap('ArrowLeft');
      else if (target > b.lane) this._tap('ArrowRight');
    }

    // 2. Jump or slide for the row, judged in the lane we will be in.
    if (!row) return;
    const t = dist / v;
    const need = RunnerBot.need(row, target, b);
    if (need === 'jump' && !b.airborne && t >= P.jumpLead[0] && t <= P.jumpLead[1]) this._tap('ArrowUp');
    if (need === 'slide' && !b.sliding && t >= P.slideLead[0] && t <= P.slideLead[1]) this._tap('ArrowDown');
    // A slide that will run out before the row has passed: slide again when it is close.
    if (need === 'slide' && b.sliding && b.slideT < (row[0].depth + 1) / v + 0.05 && t < 0.12) this._tap('ArrowDown');
  }
}
