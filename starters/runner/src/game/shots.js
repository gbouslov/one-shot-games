/**
 * Named screenshots for `npm run capture`. Each one starts a round with the
 * bot running, simulates game time (`seconds`, `untilDistance`, or
 * `until(round)`), then optionally places the camera relative to the runner:
 * pos and look are [right, up, ahead] offsets in track space. No camera means
 * the normal chase camera.
 */
const nextKind = (r, kind, lo, hi) => r.ahead(r.body.s, hi).some((o) => o.kind === kind && o.s - r.body.s > lo && o.s - r.body.s < hi);
// npm run capture plays 30 more frames (0.5 s) after a shot is set up, so these
// conditions aim half a second early: `v` metres is where things will be by then.
const soon = (r, t) => r.body.speed * t;

export const shots = {
  title: { seconds: 4 },
  run: { state: 'playing', untilDistance: 260, until: (r) => nextKind(r, 'spire', soon(r, 0.5) + 12, soon(r, 0.5) + 26) || nextKind(r, 'rubble', soon(r, 0.5) + 12, soon(r, 0.5) + 26) },
  // The bot jumps about 0.3 s before a fissure; by the end of the settle it is over it.
  jump: { state: 'playing', untilDistance: 300, until: (r) => nextKind(r, 'fissure', soon(r, 0.62), soon(r, 0.72)) },
  leap: { state: 'playing', untilDistance: 500, until: (r) => nextKind(r, 'fissure', soon(r, 0.56), soon(r, 0.64)), camera: { pos: [3.6, 0.6, 2.2], look: [-0.5, 0.9, -2.5], fov: 54 }, hud: false },
  slide: { state: 'playing', untilDistance: 300, until: (r) => nextKind(r, 'arch', soon(r, 0.5) + 2, soon(r, 0.5) + 4) },
  hero: { state: 'playing', untilDistance: 700, after: 0.4, camera: { pos: [2.6, 1.1, 4.2], look: [0, 1.0, -1.5], fov: 48 }, hud: false },
  // The bot lets go of the controls, so the runner meets the first obstacle in its lane.
  hit: { state: 'playing', until: (r) => (r.setAutoplay(false), r.hits > 0), after: 0.12 },
  finish: { state: 'playing', until: (r) => r.state === 'won', after: 2.5 },
};
