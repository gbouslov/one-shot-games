// Adapted from djpav/threejs-tower-defense src/map/MapGenerator.ts and
// src/utils/MathUtils.ts (MIT, dcb33e1): the flow-field walker, the organic
// serpentine fallback, the zigzag last resort and the grid validator.
// Ported to plain JS; topology anchors and branching paths left out. See NOTICES.md.

/** Cell codes: 0 open, 1 spawn, 2 path, 3 goal. Board maps them to '.', 'S', '#', 'G'. */
const OPEN = 0;
const SPAWN = 1;
const PATH = 2;
const GOAL = 3;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function permutation(rand) {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
}

function valueNoise2D(x, y, perm) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const n = (a, b) => (perm[(perm[a & 255] + (b & 255)) & 511] / 255) * 2 - 1;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = n(xi, yi) + (n(xi + 1, yi) - n(xi, yi)) * u;
  const bot = n(xi, yi + 1) + (n(xi + 1, yi + 1) - n(xi, yi + 1)) * u;
  return top + (bot - top) * v;
}

/** Path cells have exactly two path neighbours, the ends one; enough open ground, span and turns. */
function validate(grid, rows, cols, path) {
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let open = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === OPEN) {
        open++;
        continue;
      }
      let n = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] !== OPEN) n++;
      }
      const end = grid[r][c] === SPAWN || grid[r][c] === GOAL;
      if (end ? n !== 1 : n !== 2) return false;
    }
  }
  const ratio = open / (rows * cols);
  if (ratio < 0.3 || ratio > 0.9) return false;
  let c0 = cols;
  let c1 = 0;
  let r0 = rows;
  let r1 = 0;
  for (const p of path) {
    c0 = Math.min(c0, p.col);
    c1 = Math.max(c1, p.col);
    r0 = Math.min(r0, p.row);
    r1 = Math.max(r1, p.row);
  }
  if ((c1 - c0 + 1) / cols < 0.6 || (r1 - r0 + 1) / rows < 0.4) return false;
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const a = [path[i].row - path[i - 1].row, path[i].col - path[i - 1].col];
    const b = [path[i + 1].row - path[i].row, path[i + 1].col - path[i].col];
    if (a[0] !== b[0] || a[1] !== b[1]) turns++;
  }
  return turns >= Math.max(2, Math.floor(path.length / 10));
}

function stamp(rows, cols, path) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(OPEN));
  path.forEach((p, i) => {
    grid[p.row][p.col] = i === 0 ? SPAWN : i === path.length - 1 ? GOAL : PATH;
  });
  return grid;
}

function flowField(rows, cols, minLen, rand) {
  const perm = permutation(rand);
  const scale = 0.18 + rand() * 0.2;
  const curviness = 0.8 + rand() * 0.15;
  const lo = 1;
  const hi = rows - 2;
  const top = rand() < 0.5;
  const startRow = top ? randInt(rand, lo, lo + 1) : randInt(rand, hi - 1, hi);
  const goal = { row: top ? randInt(rand, hi - 1, hi) : randInt(rand, lo, lo + 1), col: cols - 1 };
  const path = [];
  const seen = new Set();
  let row = startRow;
  let col = 0;
  const max = rows * cols;
  for (let step = 0; step < max; step++) {
    path.push({ row, col });
    seen.add(`${row},${col}`);
    if (row === goal.row && col === goal.col) break;
    const dx = goal.col - col;
    const dy = goal.row - row;
    const dist = Math.hypot(dx, dy) || 1;
    const progress = path.length / max;
    const gw = Math.max(1 - curviness, progress ** 3);
    const a = valueNoise2D(col * scale, row * scale, perm) * Math.PI;
    const vx = Math.cos(a) * (1 - gw) + (dx / dist) * gw;
    const vy = Math.sin(a) * (1 - gw) + (dy / dist) * gw;
    const options = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dr, dc]) => ({ dr, dc, s: dr * vy + dc * vx }))
      .sort((p, q) => q.s - p.s);
    let moved = false;
    for (const { dr, dc } of options) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen.has(`${nr},${nc}`)) continue;
      row = nr;
      col = nc;
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  if (row !== goal.row || col !== goal.col || path.length < minLen) return null;
  const grid = stamp(rows, cols, path);
  return validate(grid, rows, cols, path) ? grid : null;
}

function serpentine(rows, cols, minLen, rand) {
  const lo = 1;
  const hi = rows - 2;
  const top = rand() < 0.5;
  let row = top ? randInt(rand, lo, lo + 1) : randInt(rand, hi - 1, hi);
  const goalRow = top ? randInt(rand, hi - 1, hi) : randInt(rand, lo, lo + 1);
  let col = 0;
  const path = [{ row, col }];
  let down = top;
  while (col < cols - 1) {
    const left = cols - 1 - col;
    const h = left <= 5 ? left : randInt(rand, 2, 5);
    for (let i = 0; i < h && col < cols - 1; i++) path.push({ row, col: ++col });
    if (col >= cols - 1) break;
    const target = rand() < 0.6 ? (down ? randInt(rand, hi - 1, hi) : randInt(rand, lo, lo + 1)) : clamp(row + randInt(rand, -4, 4), lo, hi);
    if (target === row) {
      down = !down;
      continue;
    }
    const s = target > row ? 1 : -1;
    while (row !== target) path.push({ row: (row += s), col });
    down = !down;
  }
  if (row !== goalRow) {
    path.pop();
    col = cols - 2;
    const last = path[path.length - 1];
    if (last.row !== row || last.col !== col) path.push({ row, col });
    const s = goalRow > row ? 1 : -1;
    while (row !== goalRow) path.push({ row: (row += s), col });
    path.push({ row, col: cols - 1 });
  }
  if (path.length < minLen) return null;
  const seen = new Set();
  const unique = path.filter((p) => !seen.has(`${p.row},${p.col}`) && seen.add(`${p.row},${p.col}`));
  const grid = stamp(rows, cols, unique);
  return validate(grid, rows, cols, unique) ? grid : null;
}

function zigzag(rows, cols) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(OPEN));
  let row = 1;
  let col = 0;
  grid[row][col] = SPAWN;
  let down = true;
  while (col < cols - 1) {
    for (let i = 0; i < Math.min(2, cols - 1 - col); i++) grid[row][++col] = PATH;
    if (col >= cols - 1) break;
    const target = down ? rows - 2 : 1;
    const s = target > row ? 1 : -1;
    while (row !== target) grid[(row += s)][col] = PATH;
    down = !down;
  }
  grid[row][cols - 1] = GOAL;
  return grid;
}

/**
 * A seeded random path from the left edge to the right edge.
 *   generateMap({ rows: 12, cols: 20, minPathLength: 28, seed: 7 })  -> { grid }
 */
export function generateMap({ rows = 12, cols = 20, minPathLength = 28, seed = 1 } = {}) {
  const rand = mulberry32(seed);
  for (let i = 0; i < 15; i++) {
    const g = flowField(rows, cols, minPathLength, rand);
    if (g) return { grid: g };
  }
  for (let i = 0; i < 15; i++) {
    const g = serpentine(rows, cols, minPathLength, rand);
    if (g) return { grid: g };
  }
  return { grid: zigzag(rows, cols) };
}
