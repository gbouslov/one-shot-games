/**
 * The round: what the screens say, how long to last, how the fen fills up,
 * what the level-ups offer and what drops. The director reads in fractions of
 * the round (0 = first second, 1 = the bell), so `seconds` alone changes the
 * length and the whole arc stretches with it.
 */
export const rules = {
  kicker: 'Corrow Fen · after midnight',
  title: 'Peatlight',
  tagline: 'When the lamps on the fen go out, the peat gets up and walks. Keep your lantern burning until the chapel bell at five past.',
  startLabel: 'Light the lantern',
  controls: 'WASD or arrows: walk  ·  your lantern fights by itself  ·  level up: 1, 2, 3 or click a card  ·  touch: drag anywhere to walk, tap a card',
  credits: 'Scanned rock, tree and leaf litter: Poly Haven (CC0), via Patch',
  seconds: 300,
  start: ['bolt'],
  maxWeapons: 4,
  maxPassives: 2,
  levelTitle: 'Choose one',
  levelKicker: 'Warden',
  levels: { first: 5, step: 6, growth: 0.9 },
  director: {
    openBanner: 'The lamps are out',
    openSub: 'Survive until the bell',
    ring: [15, 19],
    alive: [[0, 10], [0.1, 26], [0.3, 60], [0.5, 100], [0.7, 145], [0.85, 165], [1, 210]],
    rate: [[0, 1.6], [0.2, 4], [0.5, 8], [1, 14]],
    hp: [[0, 1], [0.5, 1.6], [1, 2.5]],
    mix: [
      [0, { mireling: 1 }],
      [0.12, { mireling: 4, skitter: 1 }],
      [0.3, { mireling: 4, skitter: 2, wisp: 1 }],
      [0.5, { mireling: 4, skitter: 2, wisp: 2, bogman: 0.5 }],
      [0.7, { mireling: 3, skitter: 3, wisp: 2, bogman: 0.9 }],
    ],
    events: [
      { at: 0.4, type: 'skitter', count: 24, radius: 12, banner: 'They are circling', sub: 'Break out of the ring' },
      { at: 0.64, type: 'mireling', count: 36, radius: 13, banner: 'The fen closes in', sub: 'Keep moving' },
    ],
    boss: { at: 0.82, type: 'hart', banner: 'The Fen Hart', sub: 'When it lowers its head, get out of its way' },
  },
  drops: [{ kind: 'flask', chance: 0.012 }],
  // offered when everything is at its last level
  filler: [
    { id: 'tea', name: 'Hot Tea', color: '#e8c79a', text: 'A swallow from the flask: mend 40 health.', apply: (ctx) => ctx.get('player').heal(40) },
    { id: 'breath', name: 'Second Wind', color: '#9fd4e8', text: 'Every shard on the ground flies to you.', apply: (ctx) => ctx.get('gems').vacuum() },
  ],
  winScreen: { kicker: '05:05 · The chapel bell', title: 'First Light', text: 'The bell rings over the water and the fen lies down again. Your lantern is still burning.', action: 'Another night' },
  loseScreen: { kicker: 'The lantern is out', title: 'Taken', text: 'The peat closed over the light.', action: 'Try again' },
};

/** Experience shards: the smallest tier at or under a drop's value is how it looks. */
export const gems = [
  { value: 1, color: '#7ff0c4', size: 0.15 },
  { value: 3, color: '#8fd0ff', size: 0.2 },
  { value: 6, color: '#ffc46a', size: 0.26 },
  { value: 20, color: '#ff9ad8', size: 0.36 },
];

/** Things to walk over: apply() returns false to leave it lying. */
export const pickups = {
  flask: {
    color: '#ffb36b',
    life: 25,
    sound: 'pickup',
    apply: (ctx) => {
      const p = ctx.get('player');
      if (p.health >= p.maxHealth) return false;
      p.heal(35);
      return true;
    },
  },
};
