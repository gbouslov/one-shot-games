// Seeded randomness. `?seed=` makes a round repeatable; capture always uses the same seed.
// The engine's own rand() reads Math.random, so seeding it here seeds the whole game.

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

export function seedRandom(seed) {
  const next = mulberry32(seed);
  Math.random = next;
  return next;
}

/** A separate stream for things that must not shift when gameplay draws more numbers (decoration). */
export function stream(seed) {
  const next = mulberry32(seed);
  return {
    float: (a = 1, b = 0) => b + (a - b) * next(),
    int: (a, b = 0) => Math.floor(b + (a - b) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}
