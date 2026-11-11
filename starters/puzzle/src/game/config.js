// The rules and colours of the default game. Times are seconds of game time.

export const rules = {
  width: 8,
  height: 8,
  kinds: 6,
  moves: 20, // swaps you get
  target: 2000, // points to reach before the moves run out (the greedy bot scored 2140 to 8100 over 200 seeds, median 3940)
  perCell: 20,
  bonus4: 60,
  bonus5: 200,
  swapTime: 0.16,
  clearTime: 0.24,
  gravity: 60, // cells per second squared for falling pieces
};

// one entry per piece kind: name, main colour, light and dark tones, glow
export const kinds = [
  { name: 'jelly', main: '#ff5fa8', light: '#ffd0ea', dark: '#8a1a5a', glow: [1, 0.35, 0.7] },
  { name: 'star', main: '#ff9a3c', light: '#ffe2b0', dark: '#9a3a10', glow: [1, 0.6, 0.25] },
  { name: 'shell', main: '#ffd84a', light: '#fff6c8', dark: '#9a6a10', glow: [1, 0.85, 0.3] },
  { name: 'urchin', main: '#a066ff', light: '#e0ccff', dark: '#3a1680', glow: [0.65, 0.4, 1] },
  { name: 'kelp', main: '#4fe08a', light: '#c8ffd8', dark: '#106a3a', glow: [0.3, 1, 0.55] },
  { name: 'pearl', main: '#5ad8ff', light: '#e6fbff', dark: '#105a8a', glow: [0.35, 0.85, 1] },
];

export const palette = {
  deep: '#041a2e',
  mid: '#06344e',
  shallow: '#0b5a72',
  sand: '#c8a878',
  sandDark: '#6a5038',
  coral: '#ff6a7a',
  ink: '#eafcff',
  accent: '#7ff0ff',
};
