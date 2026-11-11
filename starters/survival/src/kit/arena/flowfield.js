// Adapted from xMPon/undead-protocol src/sim/pathing.ts (MIT, 145db1e).
// Ported to JavaScript on the (x, z) plane; adds circle obstacles and a cheap
// "same goal cell, skip the rebuild" check.

const NEIGH = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * A coarse grid flow field: breadth-first search out from the goal over walkable
 * cells, then each cell stores a unit vector toward its nearest-to-goal
 * neighbour. Every enemy samples it to steer round walls and through gaps,
 * without each one running its own pathfind.
 */
export class FlowField {
  constructor(bounds, cell = 1) {
    this.cell = cell;
    this.ox = bounds.minX;
    this.oz = bounds.minZ;
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
    this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.dist = new Float32Array(n);
    this.fx = new Float32Array(n);
    this.fz = new Float32Array(n);
    // Diagonals cost more than straights, so a cell can be improved and queued
    // again; eight slots per cell is far more than that ever needs.
    this.queue = new Int32Array(n * 8);
    this.goal = { x: 0, z: 0 };
    this.goalCell = -1;
  }

  idx(cx, cz) {
    return cz * this.cols + cx;
  }

  cellOf(x, z) {
    return [Math.floor((x - this.ox) / this.cell), Math.floor((z - this.oz) / this.cell)];
  }

  inBounds(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  /** Mark cells under walls (rects) and round obstacles, widened by `inflate`. */
  rebuild(rects, circles = [], inflate = 0.45) {
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const x = this.ox + (cx + 0.5) * this.cell;
        const z = this.oz + (cz + 0.5) * this.cell;
        let solid = false;
        for (const r of rects) {
          if (x > r.minX - inflate && x < r.maxX + inflate && z > r.minZ - inflate && z < r.maxZ + inflate) {
            solid = true;
            break;
          }
        }
        if (!solid) {
          for (const c of circles) {
            const rr = c.r + inflate;
            if ((x - c.x) ** 2 + (z - c.z) ** 2 < rr * rr) {
              solid = true;
              break;
            }
          }
        }
        this.blocked[this.idx(cx, cz)] = solid ? 1 : 0;
      }
    }
    this.goalCell = -1;
  }

  compute(gx0, gz0) {
    this.goal.x = gx0;
    this.goal.z = gz0;
    let [gx, gz] = this.cellOf(gx0, gz0);
    gx = Math.min(this.cols - 1, Math.max(0, gx));
    gz = Math.min(this.rows - 1, Math.max(0, gz));
    if (this.blocked[this.idx(gx, gz)]) {
      const free = this._nearestFree(gx, gz);
      if (free) [gx, gz] = free;
    }
    const start = this.idx(gx, gz);
    if (start === this.goalCell) return;
    this.goalCell = start;

    this.dist.fill(Infinity);
    const q = this.queue;
    let tail = 0;
    this.dist[start] = 0;
    q[tail++] = start;
    for (let head = 0; head < tail; head++) {
      const cur = q[head];
      const cx = cur % this.cols;
      const cz = (cur - cx) / this.cols;
      for (const [ox, oz] of NEIGH) {
        const nx = cx + ox;
        const nz = cz + oz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (this.blocked[ni]) continue;
        // No corner cutting: a diagonal needs both orthogonal cells open.
        if (ox && oz && (this.blocked[this.idx(cx + ox, cz)] || this.blocked[this.idx(cx, cz + oz)])) continue;
        const nd = this.dist[cur] + (ox && oz ? 1.414 : 1);
        if (this.dist[ni] <= nd) continue;
        this.dist[ni] = nd;
        if (tail < q.length) q[tail++] = ni;
      }
    }

    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const i = this.idx(cx, cz);
        this.fx[i] = 0;
        this.fz[i] = 0;
        if (this.blocked[i] || !Number.isFinite(this.dist[i])) continue;
        let best = this.dist[i];
        let bx = 0;
        let bz = 0;
        for (const [ox, oz] of NEIGH) {
          const nx = cx + ox;
          const nz = cz + oz;
          if (!this.inBounds(nx, nz)) continue;
          if (ox && oz && (this.blocked[this.idx(cx + ox, cz)] || this.blocked[this.idx(cx, cz + oz)])) continue;
          const nd = this.dist[this.idx(nx, nz)];
          if (nd < best) {
            best = nd;
            bx = ox;
            bz = oz;
          }
        }
        const l = Math.hypot(bx, bz) || 1;
        this.fx[i] = bx / l;
        this.fz[i] = bz / l;
      }
    }
  }

  _nearestFree(cx, cz) {
    for (let r = 1; r < 8; r++) {
      for (let oz = -r; oz <= r; oz++) {
        for (let ox = -r; ox <= r; ox++) {
          const nx = cx + ox;
          const nz = cz + oz;
          if (this.inBounds(nx, nz) && !this.blocked[this.idx(nx, nz)]) return [nx, nz];
        }
      }
    }
    return null;
  }

  reachable(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    return this.inBounds(cx, cz) && Number.isFinite(this.dist[this.idx(cx, cz)]);
  }

  /** Steering direction toward the goal from a world position, into `out` {x, z}. */
  sample(x, z, out) {
    const [cx, cz] = this.cellOf(x, z);
    if (this.inBounds(cx, cz)) {
      const i = this.idx(cx, cz);
      if (this.fx[i] !== 0 || this.fz[i] !== 0) {
        out.x = this.fx[i];
        out.z = this.fz[i];
        return out;
      }
    }
    const dx = this.goal.x - x;
    const dz = this.goal.z - z;
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
  }
}
