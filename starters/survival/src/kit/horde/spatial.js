/**
 * A uniform grid over the ground plane for "who is near this point" queries,
 * rebuilt every frame. Items are integer indices into the caller's own list;
 * buckets are linked lists in typed arrays, so a rebuild never allocates.
 *
 * The idea (clear each frame, bucket by cell, query the cells a circle covers)
 * follows js/systems/SpatialHash.js in VictorZakharov/void-harvest-game (MIT,
 * commit 8d9109d); this is a rewrite for typed arrays and circle queries.
 *
 *   const grid = new SpatialHash(bounds, 2, 1024)
 *   grid.clear(); grid.insert(i, x, z)
 *   grid.query(x, z, r, (i) => {...})     visits every item whose cell touches the circle
 */
export class SpatialHash {
  constructor({ minX, minZ, maxX, maxZ }, cell = 2, capacity = 1024) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity).fill(-1);
  }

  clear() {
    this.head.fill(-1);
  }

  _cx(x) {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)));
  }

  _cz(z) {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)));
  }

  insert(i, x, z) {
    if (i >= this.next.length) {
      const grown = new Int32Array(this.next.length * 2).fill(-1);
      grown.set(this.next);
      this.next = grown;
    }
    const c = this._cz(z) * this.cols + this._cx(x);
    this.next[i] = this.head[c];
    this.head[c] = i;
  }

  query(x, z, r, visit) {
    const x0 = this._cx(x - r);
    const x1 = this._cx(x + r);
    const z0 = this._cz(z - r);
    const z1 = this._cz(z + r);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cz * this.cols + cx]; i !== -1; i = this.next[i]) visit(i);
      }
    }
  }
}
