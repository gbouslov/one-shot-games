/**
 * The default game: "Last Light Circuit". A light plane threads ten lantern
 * gates strung between sunlit islands at golden hour, against the clock.
 * Everything a rewrite is likely to change first lives here.
 */
export default {
  quality: 'medium',
  fov: 60,
  // The islands and the course. Any integer gives a different archipelago and
  // gate line; it does not change with ?seed= (that seeds effects only).
  worldSeed: 11,

  // Low sun, a little right of the course's first leg. [x, y, z], y is height.
  sunDir: [0.5, 0.22, -0.84],

  world: {
    size: 7000, // metres across the terrain
    land: 0.47, // 0..1, more means bigger islands
    relief: 230, // ridge height on land
    lift: 800,
    featureSize: 1350, // metres across a typical island
  },

  text: {
    kicker: 'An air race at sundown',
    title: 'Last Light Circuit',
    tagline: 'Ten lantern gates strung between the islands. Clear them all before the clock runs out. Three airframes to spare.',
    keys: [
      ['W / S', 'Nose down / nose up'],
      ['A / D', 'Roll left / right'],
      ['Q / E', 'Rudder left / right'],
      ['R or Shift', 'More throttle'],
      ['F', 'Less throttle'],
      ['M', 'Sound on / off'],
    ],
    start: 'Click or press Enter to fly',
    wonKicker: 'Course clear',
    wonTitle: 'All ten gates',
    again: 'Click or press Enter to fly again',
    lostKicker: 'Round over',
    lostTime: 'Out of daylight',
    lostCrashes: 'Three strikes',
    lostOther: 'Grounded',
    // CC-BY assets must be credited where players see them (full list in NOTICES.md).
    credits: 'Lighthouse: "Old Lighthouse" by Polyfork, CC BY 4.0. Trees by Kenney and sky by Poly Haven, CC0.',
  },
};
