import { MASK } from '../physics/surfaces.js';

const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Grid pathing over whatever level was built. bake() probes the BVH for
 * standable cells, update(x, z) floods distance from the player, and next()
 * gives any enemy the neighbouring cell to walk to. No navmesh to author.
 */
export class FlowField {
  bake(physics, { minX, maxX, minZ, maxZ, cell = 1, agentRadius = 0.4, agentHeight = 1.7, maxStep = 0.8 }) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.maxStep = maxStep;
    const n = this.w * this.h;
    this.walk = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.dist = new Int32Array(n).fill(-1);
    this.queue = new Int32Array(n);

    const world = physics.world;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = minX + (i + 0.5) * cell;
        const z = minZ + (j + 0.5) * cell;
        const y = physics.groundHeight(x, z);
        const k = j * this.w + i;
        if (y === null) continue;
        this.height[k] = y;
        const clear = world.overlapCapsule(x, y + agentRadius + 0.12, z, x, y + agentHeight - agentRadius, z, agentRadius, MASK.CHARACTER, 0) === 0;
        this.walk[k] = clear ? 1 : 0;
      }
    }
  }

  indexAt(x, z) {
    const i = Math.floor((x - this.minX) / this.cell);
    const j = Math.floor((z - this.minZ) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  center(k, out) {
    out.x = this.minX + ((k % this.w) + 0.5) * this.cell;
    out.z = this.minZ + (Math.floor(k / this.w) + 0.5) * this.cell;
    return out;
  }

  _canStep(a, b) {
    return this.walk[b] === 1 && Math.abs(this.height[a] - this.height[b]) <= this.maxStep;
  }

  /** Nearest standable cell to a world point, searching outward. */
  nearestWalkable(x, z) {
    const k = this.indexAt(x, z);
    if (k >= 0 && this.walk[k]) return k;
    const ci = Math.floor((x - this.minX) / this.cell);
    const cj = Math.floor((z - this.minZ) / this.cell);
    for (let r = 1; r < 8; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          const c = j * this.w + i;
          if (this.walk[c]) return c;
        }
      }
    }
    return -1;
  }

  update(x, z) {
    const start = this.nearestWalkable(x, z);
    this.dist.fill(-1);
    if (start < 0) return;
    const { w, h, dist, queue } = this;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    dist[start] = 0;
    while (head < tail) {
      const k = queue[head++];
      const ci = k % w;
      const cj = (k / w) | 0;
      for (let n = 0; n < 8; n++) {
        const [di, dj] = NEIGHBOURS[n];
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const c = j * w + i;
        if (dist[c] !== -1 || !this._canStep(k, c)) continue;
        if (n >= 4 && (!this.walk[cj * w + i] || !this.walk[j * w + ci])) continue; // no corner cutting
        dist[c] = dist[k] + (n >= 4 ? 14 : 10);
        queue[tail++] = c;
      }
    }
  }

  /** The neighbouring cell closest to the player, or -1. */
  next(x, z) {
    const k = this.nearestWalkable(x, z);
    if (k < 0 || this.dist[k] < 0) return -1;
    const { w, h, dist } = this;
    const ci = k % w;
    const cj = (k / w) | 0;
    let best = -1;
    let bestD = dist[k];
    for (let n = 0; n < 8; n++) {
      const [di, dj] = NEIGHBOURS[n];
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const c = j * w + i;
      if (dist[c] < 0 || dist[c] >= bestD) continue;
      if (n >= 4 && (!this.walk[cj * w + i] || !this.walk[j * w + ci])) continue;
      bestD = dist[c];
      best = c;
    }
    return best;
  }
}
