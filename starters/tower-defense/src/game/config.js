/**
 * The default game: "Lamps of Mossvale". Dusk in a mossy valley; beetles of
 * living shadow crawl from a ruined gate toward the last lit shrine. Rewrite
 * everything in this folder for a new game; the kit does not care what any of
 * it is called.
 */

/** Towers, in hotbar order (keys 1, 2, 3...). kind: 'bolt' homing shot, 'shell' arcing splash, 'pulse' area around the tower. */
export const towers = [
  {
    id: 'spire', name: 'Bolt Spire', blurb: 'Fast, single target', kind: 'bolt',
    cost: 55, range: 7.2, rate: 1.7, damage: 13, turn: 10,
    projectile: { speed: 26, color: '#ffd58a', size: 0.12 },
    upgrades: [{ cost: 60, damage: 1.55, range: 1.08, rate: 1.15 }, { cost: 110, damage: 1.6, range: 1.08, rate: 1.2 }],
    sounds: { fire: 'twang' },
  },
  {
    id: 'kiln', name: 'Ember Kiln', blurb: 'Slow, splashes', kind: 'shell',
    cost: 90, range: 8.5, rate: 0.55, damage: 34, splash: 2.3, turn: 4,
    projectile: { speed: 10, color: '#ff8a3a', size: 0.2, arc: 3.4 },
    upgrades: [{ cost: 85, damage: 1.5, range: 1.06, rate: 1.12 }, { cost: 150, damage: 1.55, range: 1.06, rate: 1.15 }],
    sounds: { fire: 'thump', hit: 'boom' },
  },
  {
    id: 'bell', name: 'Frost Bell', blurb: 'Slows all nearby', kind: 'pulse',
    cost: 70, range: 4.4, rate: 0.75, damage: 5, slow: { factor: 0.5, time: 1.8 },
    upgrades: [{ cost: 70, damage: 1.6, range: 1.1, rate: 1.1 }, { cost: 120, damage: 1.6, range: 1.1, rate: 1.15 }],
    sounds: { fire: 'bell' },
  },
];

/** Enemies. speed in metres per second; leak = lamps lost when one reaches the shrine. */
export const enemies = [
  { id: 'mite', name: 'Ash Mite', hp: 22, speed: 3.6, reward: 3, leak: 1, radius: 0.36, scale: 0.85, barY: 0.85, lane: 0.45 },
  { id: 'crawler', name: 'Gloam Crawler', hp: 70, speed: 2.3, reward: 6, leak: 1, radius: 0.5, scale: 1.2, barY: 0.9, lane: 0.35 },
  { id: 'shell', name: 'Mossback', hp: 260, speed: 1.35, reward: 22, leak: 3, radius: 0.85, scale: 1.8, armor: 6, barY: 0.95, lane: 0.15 },
];

/** Waves in order. Each group: enemy id, count, seconds between spawns, start offset in seconds. */
export const waves = [
  { name: 'First dusk', groups: [{ enemy: 'crawler', count: 7, gap: 0.9 }], bonus: 25 },
  { name: 'A swarm of mites', groups: [{ enemy: 'mite', count: 14, gap: 0.4 }], bonus: 30 },
  { name: 'Crawlers in the reeds', groups: [{ enemy: 'crawler', count: 10, gap: 0.6 }, { enemy: 'mite', count: 6, gap: 0.4, at: 3 }], bonus: 35 },
  { name: 'The first Mossback', groups: [{ enemy: 'shell', count: 2, gap: 2.4 }, { enemy: 'crawler', count: 8, gap: 0.6, at: 1.2 }], bonus: 40 },
  { name: 'Ash on the wind', groups: [{ enemy: 'mite', count: 24, gap: 0.26 }], bonus: 45 },
  { name: 'Shells and shadows', groups: [{ enemy: 'shell', count: 4, gap: 1.8 }, { enemy: 'crawler', count: 12, gap: 0.5, at: 1 }], bonus: 55 },
  { name: 'The long night', groups: [{ enemy: 'crawler', count: 16, gap: 0.42 }, { enemy: 'mite', count: 16, gap: 0.3, at: 1.5 }], bonus: 65 },
  { name: 'Last dark', groups: [{ enemy: 'shell', count: 7, gap: 1.4 }, { enemy: 'mite', count: 18, gap: 0.26, at: 2 }, { enemy: 'crawler', count: 10, gap: 0.45, at: 4 }], bonus: 0 },
];

export const economy = {
  gold: 150,
  lives: 20,
  refund: 0.7,
  hpGrowth: 0.4, // +40% enemy health per wave
  firstCall: 25, // seconds before the first wave comes on its own
  betweenWaves: 20, // seconds before the next wave comes on its own
  earlyBonus: 1, // gold per second left on the clock when a wave is called early
  scorePerLife: 50,
  speeds: [1, 2, 4],
};

/** The autoplay bot's build order: tower index, or 'up' to upgrade its best tower. */
export const bot = {
  order: [0, 0, 1, 2, 0, 'up', 1, 'up', 'up', 0, 2, 'up', 1, 'up', 'up', 0, 'up', 1, 'up', 'up'],
  callAt: 99, // call the next night as soon as this one has fully arrived, for the early bonus
};

export default {
  quality: 'high',
  fov: 36,
  camera: { pitch: 0.95, yaw: 0, margin: 1.02, target: [0, 0, 1.1], titleOrbit: 0.2, titlePitch: 0.5, titleDistance: 0.74 },
  hud: {
    accent: '#f2b45a',
    words: {
      kicker: 'A valley at dusk',
      title: 'Lamps of Mossvale',
      pitch: 'Shadow beetles crawl from the old gate toward the last lit shrine. Raise towers along the road and keep the lamp burning through eight nights.',
      start: 'Light the lamps',
      controls: '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> choose a tower, click the ground to raise it &middot; click a tower to upgrade or sell<br><kbd>Space</kbd> call the next wave early for gold &middot; <kbd>F</kbd> speed',
      wave: 'Night',
      next: 'Next night in',
      last: 'Final night',
      cleared: 'The lamp holds',
      gold: 'amber',
      callFirst: 'Begin the first night',
      call: 'Call the next night',
      holding: 'Hold until dawn',
      wonKicker: 'Dawn',
      won: 'The lamp still burns',
      wonText: 'Eight nights held with {lives} lamps left. Score {score}.',
      lostKicker: 'Darkness',
      lost: 'The shrine went dark',
      lostText: 'The beetles reached the lamp on night {wave}. Score {score}.',
      again: 'Defend it again',
      retry: 'Relight the lamp',
    },
  },
};
