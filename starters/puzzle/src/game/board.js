// The rules of the board, with no drawing: a grid of piece kinds, matches of three or more in a
// row or column, gravity, refills, and the search for moves. Pure functions over plain arrays, so
// they can be tested in Node and reused by the bot.
//
// The match scan and "remove all at once so L and T shapes clear together" follow LittleJS
// examples/puzzle/game.js (MIT); the rest is new.

export const EMPTY = -1;

export function makeGrid(w, h, kinds, rand) {
  const g = { w, h, kinds, cells: new Array(w * h).fill(EMPTY) };
  // fill so nothing matches at the start
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let k;
      do k = Math.floor(rand() * kinds);
      while ((x >= 2 && get(g, x - 1, y) === k && get(g, x - 2, y) === k) || (y >= 2 && get(g, x, y - 1) === k && get(g, x, y - 2) === k));
      set(g, x, y, k);
    }
  }
  if (!findMove(g)) return makeGrid(w, h, kinds, rand);
  return g;
}

export const get = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? EMPTY : g.cells[x + y * g.w]);
export const set = (g, x, y, k) => { g.cells[x + y * g.w] = k; };

export function swap(g, ax, ay, bx, by) {
  const a = get(g, ax, ay);
  set(g, ax, ay, get(g, bx, by));
  set(g, bx, by, a);
}

/** Every run of 3+ in a row or column. Returns { cells: Set of indices, runs: [{ kind, length, cells: [i...] }] } */
export function findMatches(g) {
  const cells = new Set();
  const runs = [];
  const scan = (outer, inner, at) => {
    for (let o = 0; o < outer; o++) {
      let start = 0;
      for (let i = 1; i <= inner; i++) {
        const k = i < inner ? get(g, ...at(o, i)) : EMPTY - 1;
        const k0 = get(g, ...at(o, start));
        if (k !== k0 || k0 === EMPTY) {
          const len = i - start;
          if (len >= 3 && k0 !== EMPTY) {
            const run = { kind: k0, length: len, cells: [] };
            for (let j = start; j < i; j++) {
              const [x, y] = at(o, j);
              run.cells.push(x + y * g.w);
              cells.add(x + y * g.w);
            }
            runs.push(run);
          }
          start = i;
        }
      }
    }
  };
  scan(g.h, g.w, (y, x) => [x, y]);
  scan(g.w, g.h, (x, y) => [x, y]);
  return { cells, runs };
}

/** Empty the matched cells, drop what is above, fill from the top.
 *  Returns moves: [{ from: [x, y], to: [x, y], kind, fresh }] for the drawing to animate. */
export function collapse(g, rand) {
  const moves = [];
  for (let x = 0; x < g.w; x++) {
    let write = 0;
    for (let y = 0; y < g.h; y++) {
      const k = get(g, x, y);
      if (k === EMPTY) continue;
      if (y !== write) {
        set(g, x, write, k);
        set(g, x, y, EMPTY);
        moves.push({ from: [x, y], to: [x, write], kind: k, fresh: false });
      }
      write++;
    }
    for (let y = write, n = 0; y < g.h; y++, n++) {
      const k = Math.floor(rand() * g.kinds);
      set(g, x, y, k);
      moves.push({ from: [x, g.h + n], to: [x, y], kind: k, fresh: true });
    }
  }
  return moves;
}

const DIRS = [[1, 0], [0, 1]];

/** How many cells a swap would clear right away (0 if it makes no match). */
export function swapValue(g, x, y, dx, dy) {
  const bx = x + dx;
  const by = y + dy;
  if (bx >= g.w || by >= g.h || bx < 0 || by < 0) return 0;
  if (get(g, x, y) === get(g, bx, by)) return 0;
  swap(g, x, y, bx, by);
  const n = findMatches(g).cells.size;
  swap(g, x, y, bx, by);
  return n;
}

/** The best move by cells cleared at once, ties to the lowest (lower moves stir more cascades). */
export function findMove(g) {
  let best = null;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      for (const [dx, dy] of DIRS) {
        const v = swapValue(g, x, y, dx, dy);
        if (v && (!best || v > best.value || (v === best.value && y < best.y))) best = { x, y, dx, dy, value: v };
      }
    }
  }
  return best;
}

/** Shuffle the kinds in place until there is no match and at least one move. */
export function shuffle(g, rand) {
  for (let tries = 0; tries < 200; tries++) {
    for (let i = g.cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [g.cells[i], g.cells[j]] = [g.cells[j], g.cells[i]];
    }
    if (!findMatches(g).cells.size && findMove(g)) return true;
  }
  const fresh = makeGrid(g.w, g.h, g.kinds, rand);
  g.cells = fresh.cells;
  return true;
}

/** Points for one clearing step: each cell is worth `per`, long runs add a bonus, cascades multiply. */
export function scoreStep({ cells, runs }, cascade, rules) {
  let bonus = 0;
  for (const r of runs) bonus += r.length >= 5 ? rules.bonus5 : r.length === 4 ? rules.bonus4 : 0;
  return (cells.size * rules.perCell + bonus) * cascade;
}
