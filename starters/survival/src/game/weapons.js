/**
 * What the warden carries. Weapons fire by themselves; charms change the warden.
 * Every number is a feel decision, one row per level. Kinds (src/kit/arsenal):
 *   bolt   { cooldown s, damage, count, speed m/s, pierce, range m, size, knock }
 *   orbit  { count, radius m, damage, spin rad/s, size, knock, every (s between hits on one enemy) }
 *   pulse  { cooldown, radius, damage, knock, speed (how fast the ring rolls out) }
 *   strike { cooldown, count, damage, range, splash }
 *   passive totals: { health, regen /s, speed (fraction), pickup (fraction), might, haste }
 * `evolve: { needs, into }`: at its last level, with `needs` owned, the next
 * level-up offers `into` in its place.
 */
const up = (base, ...steps) => steps.reduce((rows, s) => [...rows, { ...rows[rows.length - 1], ...s }], [base]);

export const weapons = [
  {
    id: 'bolt',
    name: 'Lamp Bolt',
    kind: 'bolt',
    color: '#ffcf7a',
    sound: 'bolt',
    weight: 1.2,
    levels: up(
      { cooldown: 0.8, damage: 10, count: 1, speed: 18, pierce: 0, range: 15, size: 0.14, knock: 0.6 },
      { count: 2 },
      { damage: 15 },
      { count: 3, pierce: 1 },
      { cooldown: 0.6, damage: 19, count: 4 },
    ),
    text: [
      'The lantern spits a coal of light at whatever is nearest.',
      'Two coals at a time.',
      'Hotter coals: half again the damage.',
      'Three coals, and each burns through one body.',
      'Faster and harder: four coals a throw.',
    ],
  },
  {
    id: 'ember',
    name: 'Ember Ring',
    kind: 'orbit',
    color: '#ff8a3c',
    weight: 1.2,
    levels: up(
      { count: 2, radius: 2.2, damage: 8, spin: 2.6, size: 0.2, knock: 0.9, every: 0.45 },
      { count: 3 },
      { damage: 12, radius: 2.5 },
      { count: 4, spin: 3.2 },
      { count: 5, damage: 16 },
    ),
    text: [
      'Two embers circle you and scorch whatever they touch.',
      'A third ember.',
      'Wider and hotter.',
      'A fourth ember, spinning faster.',
      'Five embers. With an Oilskin Coat, it can become a hearth.',
    ],
    evolve: { needs: 'oilskin', into: 'hearth' },
  },
  {
    id: 'hearth',
    name: 'Hearth Ring',
    kind: 'orbit',
    color: '#ffc05a',
    evolution: true,
    levels: [{ count: 7, radius: 3.0, damage: 26, spin: 3.6, size: 0.3, knock: 1.5, every: 0.32 }],
    text: ['The embers become a hearth: seven coals, wide and fierce, that throw the fen back.'],
  },
  {
    id: 'bell',
    name: 'Bell Toll',
    kind: 'pulse',
    color: '#bfe3ff',
    sound: 'toll',
    levels: up(
      { cooldown: 3.2, radius: 4.5, damage: 14, knock: 2.6, speed: 14 },
      { radius: 5.5 },
      { damage: 22 },
      { cooldown: 2.4 },
      { radius: 7, damage: 30 },
    ),
    text: [
      'A hand-bell rings by itself: a ring of sound that hurts and shoves back.',
      'The ring carries further.',
      'A harder note.',
      'It rings more often.',
      'A great bell: wide, loud, and heavy.',
    ],
  },
  {
    id: 'storm',
    name: 'Storm Call',
    kind: 'strike',
    color: '#b8d0ff',
    sound: 'crack',
    levels: up(
      { cooldown: 2.4, count: 2, damage: 24, range: 12, splash: 1.6 },
      { count: 3 },
      { damage: 34 },
      { cooldown: 1.8, count: 4 },
      { count: 6, damage: 42, splash: 2.2 },
    ),
    text: [
      'The storm answers you: lightning finds two things nearby.',
      'Three strikes.',
      'The strikes burn deeper.',
      'Four strikes, more often.',
      'Six strikes that split the ground around them.',
    ],
  },
  {
    id: 'oilskin',
    name: 'Oilskin Coat',
    kind: 'passive',
    color: '#8fd48a',
    levels: [{ health: 25, regen: 0.5 }, { health: 50, regen: 1 }, { health: 75, regen: 1.6 }],
    text: ['A waxed coat: more health, and you mend slowly.', 'Another layer of wax: more health, faster mending.', 'Proof against anything: the most health, the fastest mending.'],
  },
  {
    id: 'lodestone',
    name: 'Lodestone',
    kind: 'passive',
    color: '#c7a2ff',
    levels: [{ pickup: 0.6, speed: 0.06 }, { pickup: 1.2, speed: 0.12 }, { pickup: 1.9, speed: 0.18 }],
    text: ['Shards fly to you from further, and your step quickens.', 'Further still, and quicker.', 'The whole clearing pulls toward you.'],
  },
];
