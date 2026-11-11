/**
 * The round: what the screens say, the waves, what drops.
 */
export const rules = {
  kicker: 'Night shift · Freight yard 9',
  title: 'Sodium Yard',
  tagline: 'The lamps are the only thing they avoid, and the lamps are failing. Hold the yard through five waves until the first train at dawn.',
  startLabel: 'Hold the yard',
  controls: 'WASD move  ·  mouse aim  ·  click fire  ·  Space dash  ·  R reload  ·  Q or 1 / 2 swap  ·  touch: left stick moves, right stick aims and fires',
  waveLabel: 'Wave',
  breakSeconds: 2.5,
  maxAlive: 16,
  minSpawnDistance: 12,
  waves: [
    { label: 'First light out', sub: 'They are at the fence', interval: 0.75, enemies: [{ type: 'walker', count: 6 }] },
    { label: 'Wave two', sub: 'Runners in the rain', interval: 0.65, enemies: [{ type: 'walker', count: 7 }, { type: 'runner', count: 3 }] },
    { label: 'Wave three', sub: 'Something heavy', interval: 0.6, enemies: [{ type: 'walker', count: 8 }, { type: 'runner', count: 4 }, { type: 'brute', count: 1 }] },
    { label: 'Wave four', sub: 'All gates', interval: 0.55, enemies: [{ type: 'walker', count: 9 }, { type: 'runner', count: 6 }, { type: 'brute', count: 1 }] },
    { label: 'Last wave', sub: 'Dawn is close', interval: 0.5, enemies: [{ type: 'walker', count: 10 }, { type: 'runner', count: 7 }, { type: 'brute', count: 2 }] },
  ],
  drops: [{ kind: 'medkit', chance: 0.09 }],
  winScreen: { kicker: '05:42 · First train', title: 'Dawn', text: 'The yard is yours. The lamps can rest.', action: 'Another night' },
  loseScreen: { kicker: 'Lamps out', title: 'Overrun', text: 'The yard went dark.', action: 'Try again' },
};

/** What drops: walk over it to take it. apply() returns false to leave it lying. */
export const pickups = {
  medkit: {
    color: '#7dffb2',
    life: 14,
    sound: 'pickup',
    apply: (ctx) => {
      const p = ctx.get('player');
      if (p.health >= p.maxHealth) return false;
      p.heal(35);
      return true;
    },
  },
};
