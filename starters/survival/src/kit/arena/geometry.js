// Adapted from xMPon/undead-protocol src/sim/collision.ts (MIT, 145db1e).
// Ported to JavaScript; the ground plane is (x, z) here instead of (x, y).

/** Rect: { minX, minZ, maxX, maxZ }. Circle obstacles: { x, z, r }. */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function pointInRect(x, z, r) {
  return x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
}

/** Push a circle out of one rect, mutating p ({x, z}). Returns true if it moved. */
export function pushOutOfRect(p, radius, r) {
  if (p.x <= r.minX - radius || p.x >= r.maxX + radius || p.z <= r.minZ - radius || p.z >= r.maxZ + radius) return false;
  if (pointInRect(p.x, p.z, r)) {
    // Centre buried inside: leave by the shallowest face.
    const left = p.x - r.minX;
    const right = r.maxX - p.x;
    const top = p.z - r.minZ;
    const bottom = r.maxZ - p.z;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = r.minX - radius;
    else if (m === right) p.x = r.maxX + radius;
    else if (m === top) p.z = r.minZ - radius;
    else p.z = r.maxZ + radius;
    return true;
  }
  const cx = clamp(p.x, r.minX, r.maxX);
  const cz = clamp(p.z, r.minZ, r.maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) {
    p.x += (dx / d) * (radius - d);
    p.z += (dz / d) * (radius - d);
  } else p.x = cx + radius;
  return true;
}

export function pushOutOfCircle(p, radius, c) {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const reach = radius + c.r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= reach * reach) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) {
    p.x = c.x + (dx / d) * reach;
    p.z = c.z + (dz / d) * reach;
  } else p.x = c.x + reach;
  return true;
}

/** Ray (unit dir) vs rect. Entry distance >= 0, or null. */
export function rayVsRect(ox, oz, dx, dz, r) {
  const ix = dx !== 0 ? 1 / dx : Infinity;
  const iz = dz !== 0 ? 1 / dz : Infinity;
  let t1 = (r.minX - ox) * ix;
  let t2 = (r.maxX - ox) * ix;
  let t3 = (r.minZ - oz) * iz;
  let t4 = (r.maxZ - oz) * iz;
  if (t1 > t2) [t1, t2] = [t2, t1];
  if (t3 > t4) [t3, t4] = [t4, t3];
  const enter = Math.max(t1, t3);
  const exit = Math.min(t2, t4);
  if (exit < 0 || enter > exit) return null;
  return enter >= 0 ? enter : null;
}

/** Ray (unit dir) vs circle. Distance to the first hit >= 0, or null. */
export function rayVsCircle(ox, oz, dx, dz, cx, cz, radius) {
  const ocx = ox - cx;
  const ocz = oz - cz;
  const b = dx * ocx + dz * ocz;
  const c = ocx * ocx + ocz * ocz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t >= 0 ? t : null;
}

/** Which face of a rect a point on its edge lies on, as an outward normal [x, z]. */
export function rectNormal(x, z, r) {
  const d = [Math.abs(x - r.minX), Math.abs(x - r.maxX), Math.abs(z - r.minZ), Math.abs(z - r.maxZ)];
  const m = Math.min(...d);
  if (m === d[0]) return [-1, 0];
  if (m === d[1]) return [1, 0];
  if (m === d[2]) return [0, -1];
  return [0, 1];
}
