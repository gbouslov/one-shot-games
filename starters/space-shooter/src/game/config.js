/**
 * The default game: "The Long Seam". A strike fighter dives the length of the
 * trench cut through a drifting ore barge, breaks the raider flights and wall
 * guns on the way, and cracks the reactor heart at the far end. Everything a
 * rewrite is likely to change first lives here, in rules.js and in look.js.
 */
export default {
  quality: 'medium',
  fov: 68,
  far: 1400,
  worldSeed: 7, // the trench's dressing; ?seed= seeds effects only

  // Where the far glow (and the light shafts) sit: straight down the trench, a little up.
  sunDir: [0, 0.1, -1],

  trench: {
    halfWidth: 22, // inner wall faces at x = +-22 (turrets mount at +-20.8)
    floor: -14,
    segment: 60, // metres per wall bay
  },

  // Rotate a model whose nose does not point down -Z (radians about Y). null = detect from its nozzles.
  models: { fighterYaw: null, raiderYaw: null, scale: { fighter: 0.62, raider: 0.85, turret: 2.3 } },

  text: {
    kicker: 'An on-rails strike',
    title: 'The Long Seam',
    tagline: 'Dive the trench of a drifting ore barge. Break the raider flights and the wall guns, then crack the reactor heart at the far end.',
    keys: [
      ['WASD / arrows', 'Steer'],
      ['Space or click', 'Fire'],
      ['Shift', 'Boost'],
      ['M', 'Sound on / off'],
    ],
    start: 'Click or press Enter to launch',
    runName: 'The seam',
    bossName: 'Reactor heart',
    bossWarning: 'Reactor heart ahead',
    bossOpen: 'Core exposed',
    lowHull: 'Hull critical',
    wonKicker: 'Run complete',
    wonTitle: 'The heart is out',
    again: 'Click or press Enter to fly again',
    lostKicker: 'Run over',
    lostHull: 'Hull breached',
    lostOther: 'Recalled',
    // CC-BY assets must be credited where players see them (full list in NOTICES.md).
    credits: 'Models: "Agile Starfighter", "Interceptor" and "Defense Turret" by Polyfork, CC BY 4.0.',
  },
};
