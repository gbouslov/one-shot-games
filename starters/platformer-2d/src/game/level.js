// The level, written as pieces rather than a picture so it is easy to change by hand:
// every number is a tile column (x, from the left) or a row (y, from the bottom).
// Rules that keep it playable and keep the bot able to finish it:
//   a pit is at most 3 tiles wide, a step up at most 2 tiles, brambles at most 3 wide.

export const level = {
  width: 116,
  height: 18,
  start: [2.5, 4],
  // [fromX, toX, top]: solid ground from the bottom up to row `top` (the surface you stand on)
  ground: [
    [0, 15, 4],
    [19, 30, 5],
    [31, 44, 5],
    [47, 52, 7],
    [56, 68, 6],
    [69, 74, 6],
    [75, 77, 7],
    [78, 80, 8],
    [81, 90, 9],
    [94, 115, 9],
  ],
  // [fromX, toX, y, height]: floating rock
  rocks: [
    [9, 11, 8, 1],
    [36, 38, 9, 1],
    [61, 63, 11, 1],
    [99, 101, 14, 1],
  ],
  // [fromX, toX, y]: wooden ledges you can jump up through
  ledges: [
    [23, 26, 8],
    [48, 51, 10],
    [84, 87, 12],
    [104, 106, 12],
  ],
  // [fromX, toX]: brambles on top of the ground there
  thorns: [
    [31, 33],
    [70, 71],
    [99, 100],
  ],
  // sunseeds
  seeds: [
    [6, 5.6], [7.5, 6.2], [9, 6.4], [10, 9.6],
    [20.5, 7], [24, 9.4], [25.5, 9.4], [32, 7.6],
    [37, 10.6], [41, 6.6], [46, 8.6], [49.5, 11.4],
    [54.5, 8.8], [60, 7.6], [62, 12.6], [70.5, 8.6],
    [76, 8.6], [79, 9.6], [85.5, 13.4], [92.5, 11],
    [96.5, 11], [100, 15.6], [105, 13.6],
  ],
  // bramblebugs that patrol
  bugs: [[26, 5], [41, 5], [60, 6], [65, 6], [86, 9], [106, 9]],
  // lantern posts: where you come back after a fall
  checkpoints: [36, 58, 82, 98],
  beacon: [110.5, 9],
};

/** The level as a grid of cell kinds: 'solid', 'ledge', 'thorns', 'empty'. */
export function buildGrid(L = level) {
  const w = L.width;
  const h = L.height;
  const cells = new Array(w * h).fill('empty');
  const set = (x, y, k) => { if (x >= 0 && y >= 0 && x < w && y < h) cells[y * w + x] = k; };
  for (const [x0, x1, top] of L.ground) for (let x = x0; x <= x1; x++) for (let y = 0; y < top; y++) set(x, y, 'solid');
  for (const [x0, x1, y0, hh] of L.rocks) for (let x = x0; x <= x1; x++) for (let y = y0; y < y0 + hh; y++) set(x, y, 'solid');
  for (const [x0, x1, y] of L.ledges) for (let x = x0; x <= x1; x++) set(x, y, 'ledge');
  for (const [x0, x1] of L.thorns) {
    for (let x = x0; x <= x1; x++) {
      let top = 0;
      while (top < h && cells[top * w + x] === 'solid') top++;
      set(x, top, 'thorns');
    }
  }
  return {
    w,
    h,
    get: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 'empty' : cells[y * w + x]),
    /** the row you stand on at column x: the first open cell above the ground (not floating rock), or -1 over a pit */
    surface(x) {
      if (x < 0 || x >= w || cells[x] !== 'solid') return -1;
      let y = 0;
      while (y < h && cells[y * w + x] === 'solid') y++;
      return y;
    },
  };
}
