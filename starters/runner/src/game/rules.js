/**
 * The rules of the default game. Distances in metres, times in seconds.
 * The kit reads this shape (src/kit/runner/round.js, course.js, body.js, bot.js).
 */
export const rules = {
  goal: 1500, // reach this distance to win
  hearts: 3, // obstacles struck before the run is over
  invulnerable: 1.2, // after a hit
  stumbleTime: 0.6, // a hit slows you for this long...
  stumbleSlow: 0.35, // ...by this share of your speed
  comboTime: 1.4, // pick up the next cinder within this to keep the chain
  milestoneEvery: 250,
  attractSpeed: 8, // the jog behind the title screen
  attractLength: 100,

  speed: { start: 13, max: 27, rampTo: 1500 },

  scores: { metre: 1, pickup: 10, heart: 500 },

  body: {
    lanes: 3,
    laneWidth: 2.2,
    laneDamp: 16, // lane change settles in about 0.2 s
    jumpHeight: 1.6,
    jumpTime: 0.78,
    slideTime: 0.72,
    dropSpeed: 16, // slide pressed in the air: fall this fast, slide on landing
    height: 1.7,
    slideHeight: 0.85,
    halfWidth: 0.34,
    buffer: 0.14, // a jump pressed this long before landing still happens
  },

  // The path: heading terms [radians, wavelength m, phase] and height terms [m, wavelength m, phase].
  track: {
    bends: [[0.42, 560, 0.6], [0.2, 240, 2.1]],
    hills: [[4.2, 400, 1.2], [1.6, 160, 0.4]],
    flat: 70,
  },

  // Each kind blocks a box in track space: its lanes (or all, if full), depth along the path, y from..to above it.
  obstacles: {
    spire: { y: [0, 4.6], depth: 1.4 }, // a basalt column: change lane
    rubble: { y: [0, 0.8], depth: 1.3 }, // a heap of hot rock: jump it or change lane
    fissure: { y: [-8, 0.28], depth: 2.0, full: true }, // a crack of fire across the road: jump
    arch: { y: [1.15, 2.6], depth: 0.9, full: true }, // a fallen column at head height: slide
  },

  course: {
    start: 110,
    end: 1460,
    gap: [1.7, 1.1], // seconds of running between rows, at the start and at the end
    patterns: [
      { kinds: ['spire'], lanes: 1, weight: 3 },
      { kinds: ['spire'], lanes: 2, weight: 2.4, from: 260 },
      { kinds: ['rubble'], lanes: 1, weight: 2 },
      { kinds: ['rubble'], lanes: 2, weight: 1.4, from: 200 },
      { kinds: ['spire', 'rubble'], lanes: 2, weight: 2, from: 380 },
      { kinds: ['rubble'], lanes: 3, weight: 0.7, from: 600 },
      { kinds: ['fissure'], weight: 1.8, from: 150 },
      { kinds: ['arch'], weight: 1.8, from: 210 },
    ],
    pickups: { chance: 0.85 },
  },

  bot: { horizon: 1.25, jumpLead: [0.16, 0.34], slideLead: [0.08, 0.3] },
};
