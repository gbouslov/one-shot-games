/**
 * The rules of the default game: the ship, the enemies, the run's script and
 * the target at the end. Distances are metres along the rail; the rail runs
 * at 42 m/s, so the target is reached about 83 seconds in, and the fight
 * there takes another 10 to 20.
 */
export const rules = {
  hull: 100,
  invulnerable: 0.45, // seconds after a hit
  shipRadius: 1.1,
  barDamage: 18,
  barAhead: 320, // bars appear this far ahead of the ship when their event fires
  hullBonus: 20, // score per hull point left at the win
  attractSpeed: 16, // the title screen's drift
  attractLength: 700,

  ship: {
    baseY: 0,
    baseSpeed: 42,
    boostSpeed: 74,
    bounds: { x: 14, y: 8 },
    speedX: 30,
    speedY: 22,
    fireRate: 8,
    boltSpeed: 300,
    aimDistance: 90,
    aimGain: 1.7,
    guns: [[-1.6, -0.15, -1.2], [1.6, -0.15, -1.2]],
  },

  enemies: {
    damage: 6, // per enemy bolt
    craft: { hp: 3, radius: 3.2, score: 100, fireEvery: 3, boltSpeed: 46, scatter: 1.4, stay: 5, holdAhead: 72, ram: 14, spawnAhead: 260 },
    turret: { hp: 4, radius: 2.6, score: 150, fireEvery: 2.6, boltSpeed: 50, scatter: 1.2, spawnAhead: 300 },
  },

  // What happens where. `wave`: craft that fly in, hold in front and leave
  // (formation line | vee | arc | column, from ahead | left | right | above).
  // `turrets`: [x, y, extra metres ahead] on the trench walls (|x| about 20.8).
  // `bar`: a girder across the trench, centre y and height; fly over or under.
  script: [
    { at: 260, wave: 'craft', formation: 'line', count: 4, y: 2, width: 18 },
    { at: 520, turrets: [[-20.8, -6], [20.8, -3, 40]] },
    { at: 700, wave: 'craft', formation: 'vee', count: 5, y: 0, width: 22, from: 'above' },
    { at: 860, bar: { y: -5, h: 5 } },
    { at: 1000, turrets: [[-20.8, 2], [20.8, -8, 30], [-20.8, -9, 60]] },
    { at: 1150, wave: 'craft', formation: 'arc', count: 5, y: 1, width: 22, from: 'left' },
    { at: 1420, bar: { y: 4.5, h: 5 } },
    { at: 1520, wave: 'craft', formation: 'column', count: 4, x: 0, y: 1 },
    { at: 1760, turrets: [[20.8, 1], [-20.8, -5, 25], [20.8, -9, 55], [-20.8, 4, 80]] },
    { at: 1900, wave: 'craft', formation: 'line', count: 3, x: -8, y: 3, width: 10, from: 'left' },
    { at: 1960, wave: 'craft', formation: 'line', count: 3, x: 8, y: -1, width: 10, from: 'right' },
    { at: 2240, bar: { y: -1, h: 6 } },
    { at: 2340, wave: 'craft', formation: 'line', count: 6, y: 2, width: 24, stay: 6 },
    { at: 2600, turrets: [[-20.8, -7], [20.8, -7, 20], [-20.8, 3, 50], [20.8, 3, 70]] },
    { at: 2760, wave: 'craft', formation: 'vee', count: 5, y: -2, width: 20, from: 'below' },
    { at: 2960, wave: 'craft', formation: 'arc', count: 5, y: 3, width: 22, from: 'right' },
    { at: 3120, turrets: [[-20.8, 0], [20.8, -6, 30]] },
  ],

  // The target at the end: four armoured nodes around a core. Destroy the
  // nodes and the core's shutters open; destroy the core to win.
  boss: {
    at: 3500, // rail metres where the ship stops
    ahead: 95, // the target's centre sits this far past the stop
    y: 0,
    revealAt: 520, // starts drawing this many metres before the stop
    wakeAt: 70, // fights back (and takes damage) from this many metres before the stop
    nodes: [[-10.5, 6], [10.5, 6], [-10.5, -6], [10.5, -6]],
    nodeHp: 9,
    nodeRadius: 3.4,
    nodeScore: 400,
    nodeFireEvery: 2.8,
    coreHp: 22,
    coreRadius: 4.6,
    coreZ: -3,
    coreScore: 2500,
    coreFireEvery: 3.2,
    coreRing: 10,
    boltSpeed: 40,
    scatter: 0.8,
    damage: 8,
  },

  // The autoplay bot (src/kit/rail/bot.js).
  bot: { gain: 0.32, dodgeTime: 1.0, dodgeRadius: 2.6 },
};
