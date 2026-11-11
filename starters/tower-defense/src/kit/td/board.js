import { generateMap } from './mapgen.js';

/**
 * The board: a grid of cells, the path the enemies walk, and where towers may
 * stand. Built from an ASCII picture (src/game/level.js) or generated.
 *
 *   S  spawn (path start, on the board edge)     .  open ground, buildable
 *   #  path                                      x  blocked (rock, water, ruin)
 *   G  goal  (path end, on the board edge)
 *
 * Coordinates: column -> +x, row -> +z (toward the camera), centred on the origin.
 * board.path is a smooth polyline in world space with cumulative distances:
 *   board.sample(d, out)  position {x, z} and heading at distance d along it
 */
export class Board {
  constructor({ map, cell = 2, generate = null, lead = 2.5, tail = 2.2, cornerRadius = 0.85 }) {
    let rows;
    if (generate) {
      const g = generateMap(generate);
      rows = g.grid.map((r) => r.map((c) => '.S#Gx'[c]).join(''));
    } else {
      rows = map.map((r) => r.replace(/\s+/g, ''));
    }
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.cell = cell;
    this.grid = rows.map((r) => [...r]);
    this.occupied = new Map(); // "c,r" -> tower

    this.cells = this._extractPath();
    this.width = this.cols * cell;
    this.depth = this.rows * cell;

    // Centre points of the path cells, plus a lead-in from off the board and a tail into the goal.
    const pts = this.cells.map(([c, r]) => this.toWorld(c, r));
    const first = pts[0];
    const second = pts[1];
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    // lead and tail are measured in cells
    const lead0 = { x: first.x + (first.x - second.x) * lead, z: first.z + (first.z - second.z) * lead };
    const tailN = { x: last.x + (last.x - prev.x) * tail, z: last.z + (last.z - prev.z) * tail };
    this.spawnPoint = lead0;
    this.goalPoint = tailN;
    this.path = roundCorners([lead0, ...pts, tailN], cornerRadius * cell);
    this.length = this.path[this.path.length - 1].d;
  }

  key(c, r) {
    return `${c},${r}`;
  }

  inside(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  at(c, r) {
    return this.inside(c, r) ? this.grid[r][c] : 'x';
  }

  buildable(c, r) {
    return this.at(c, r) === '.' && !this.occupied.has(this.key(c, r));
  }

  toWorld(c, r) {
    return { x: (c - (this.cols - 1) / 2) * this.cell, z: (r - (this.rows - 1) / 2) * this.cell };
  }

  toCell(x, z) {
    const c = Math.round(x / this.cell + (this.cols - 1) / 2);
    const r = Math.round(z / this.cell + (this.rows - 1) / 2);
    return this.inside(c, r) ? [c, r] : null;
  }

  /** Point and heading at distance d along the path (clamped to its ends). */
  sample(d, out = { x: 0, z: 0, heading: 0 }) {
    const p = this.path;
    if (d <= 0) d = 0;
    if (d >= this.length) d = this.length;
    let lo = 0;
    let hi = p.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].d <= d) lo = mid;
      else hi = mid;
    }
    const a = p[lo];
    const b = p[hi];
    const t = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.heading = Math.atan2(b.x - a.x, b.z - a.z);
    return out;
  }

  /** Shortest distance from (x, z) to the path polyline. */
  distanceToPath(x, z) {
    let best = Infinity;
    const p = this.path;
    for (let i = 1; i < p.length; i++) {
      const ax = p[i - 1].x;
      const az = p[i - 1].z;
      const dx = p[i].x - ax;
      const dz = p[i].z - az;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + dx * t - x;
      const ez = az + dz * t - z;
      const d2 = ex * ex + ez * ez;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  /** How many metres of path lie within `range` of (x, z): the classic placement score. */
  coverage(x, z, range, step = 0.5) {
    let n = 0;
    const s = { x: 0, z: 0 };
    for (let d = 0; d <= this.length; d += step) {
      this.sample(d, s);
      if ((s.x - x) ** 2 + (s.z - z) ** 2 <= range * range) n += step;
    }
    return n;
  }

  /** Every cell, with its type. */
  *each() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) yield [c, r, this.grid[r][c]];
  }

  _extractPath() {
    let start = null;
    for (const [c, r, t] of this.each()) if (t === 'S') start = [c, r];
    if (!start) throw new Error('level map has no S (spawn) cell');
    const out = [start];
    const seen = new Set([this.key(...start)]);
    let cur = start;
    for (;;) {
      let next = null;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = cur[0] + dc;
        const r = cur[1] + dr;
        const t = this.at(c, r);
        if ((t === '#' || t === 'G') && !seen.has(this.key(c, r))) {
          next = [c, r];
          break;
        }
      }
      if (!next) break;
      out.push(next);
      seen.add(this.key(...next));
      cur = next;
      if (this.at(...next) === 'G') break;
    }
    if (this.at(...cur) !== 'G') throw new Error('level map path does not reach G from S');
    return out;
  }
}

/** Replace each sharp corner with a circular-ish arc so walkers turn instead of snapping. */
function roundCorners(pts, radius) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const d1x = b.x - a.x;
    const d1z = b.z - a.z;
    const d2x = c.x - b.x;
    const d2z = c.z - b.z;
    const l1 = Math.hypot(d1x, d1z);
    const l2 = Math.hypot(d2x, d2z);
    const cross = Math.abs(d1x * d2z - d1z * d2x) / (l1 * l2 || 1);
    if (cross < 0.01) {
      out.push(b);
      continue;
    }
    const r = Math.min(radius, l1 * 0.5, l2 * 0.5);
    const p0 = { x: b.x - (d1x / l1) * r, z: b.z - (d1z / l1) * r };
    const p2 = { x: b.x + (d2x / l2) * r, z: b.z + (d2z / l2) * r };
    // quadratic Bezier through the corner
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * b.z + t * t * p2.z });
    }
  }
  out.push(pts[pts.length - 1]);
  let d = 0;
  out[0].d = 0;
  for (let i = 1; i < out.length; i++) {
    d += Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z);
    out[i] = { x: out[i].x, z: out[i].z, d };
  }
  out[0] = { x: out[0].x, z: out[0].z, d: 0 };
  return out;
}
