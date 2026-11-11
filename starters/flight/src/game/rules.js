/**
 * Round rules. Read by kit/flight/round.js.
 * The clock is the course length divided by `paceMetresPerSecond`, rounded up
 * to 5 s, plus 10 s; set `timeLimit` to fix it instead.
 */
export const rules = {
  lives: 3,
  paceMetresPerSecond: 56,
  crashDelay: 1.8,
  startSpeed: 95,
  startThrottle: 0.72,
  // Flight model overrides (see kit/flight/model.js DEFAULT_FLIGHT).
  flight: {
    maxSpeed: 150,
    stallSpeed: 34,
    bounds: 3000,
  },
  bot: { clearance: 40, throttle: 0.86 },
  course: {
    gates: 10,
    radius: 26, // metres, generous for a first course
    spacing: [480, 620],
    turn: 0.62, // max change of direction between legs, radians
    height: [50, 120], // above the highest ground on the leg
  },
};
