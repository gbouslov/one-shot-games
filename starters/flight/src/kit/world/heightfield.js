// The island noise is adapted from arjunemirchandani/skyward-flight-simulator
// index.html (MIT, commit 5fde882): hash2/noise2/fbm and baseTerrain(), a
// low-frequency "continent" thresholded into islands, ridged mountains only
// where there is already land, and surface detail. Rescaled, seeded, with a
// falloff to open sea at the edges and a baked grid. See NOTICES.md.

function hash2(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function noise2(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}
export function fbm2(x, y, octaves, s = 0) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, s) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/**
 * An archipelago height function plus a baked grid of it.
 *
 *   const field = createIslands({ size: 7000, segments: 200, seed: 7, ... })
 *   field.height(x, z)     analytic, any point
 *   field.at(x, z)         bilinear from the grid (what the mesh shows); off-grid is open sea
 *   field.grid, field.n, field.size, field.cell
 *
 * Options (all optional): land (0..1, higher means more land), relief (ridge
 * height), detail, featureSize (metres across a typical island), edge (where
 * the sea takes over, as a fraction of the half size), floor (deepest sea).
 */
export function createIslands(opts = {}) {
  const {
    size = 7000,
    segments = 200,
    seed = 1,
    land = 0.5,
    relief = 380,
    lift = 1100,
    detail = 18,
    featureSize = 1500,
    edge = [0.55, 0.95],
    floor = -90,
  } = opts;
  const f = 1 / featureSize;
  const ox = (seed * 13.37) % 97;
  const oz = (seed * 7.91) % 89;
  const thresh = 1 - land - 0.03;

  const height = (x, z) => {
    const continent = fbm2(x * f + ox, z * f + oz, 5, seed);
    let h = (continent - thresh) * lift;
    const landMask = Math.max(0, Math.min(1, h / 120));
    const r = 1 - Math.abs(fbm2(x * f * 1.8 + 61.5 + ox, z * f * 1.8 + 19.2 + oz, 4, seed + 3) * 2 - 1);
    h += r * r * relief * landMask;
    h += (fbm2(x * f * 15 - 33 + ox, z * f * 15 + 88 + oz, 3, seed + 5) - 0.5) * detail * (0.35 + landMask);
    const d = Math.hypot(x, z) / (size * 0.5);
    const t = Math.max(0, Math.min(1, (d - edge[0]) / (edge[1] - edge[0])));
    h -= smooth(t) * 700;
    return Math.max(h, floor);
  };

  const n = segments + 1;
  const cell = size / segments;
  const grid = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) grid[j * n + i] = height(-size / 2 + i * cell, -size / 2 + j * cell);
  }

  const at = (x, z) => {
    const gx = (x + size / 2) / cell;
    const gz = (z + size / 2) / cell;
    if (gx < 0 || gz < 0 || gx >= n - 1 || gz >= n - 1) return floor;
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const a = grid[j * n + i];
    const b = grid[j * n + i + 1];
    const c = grid[(j + 1) * n + i];
    const d = grid[(j + 1) * n + i + 1];
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  };

  /** Highest ground (or sea, 0) on the straight line a→b, sampled every `step` metres. */
  const maxAlong = (a, b, step = 25) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const k = Math.max(2, Math.ceil(len / step));
    let hi = 0;
    for (let i = 0; i <= k; i++) {
      const t = i / k;
      hi = Math.max(hi, at(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
    }
    return hi;
  };

  return { height, at, maxAlong, grid, n, size, cell, floor };
}
