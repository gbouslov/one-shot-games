// Tuning and colours for the default game. Movement numbers are per update (1/60 s), the
// engine's units: 0.13 per update is 7.8 tiles a second.

export const tuning = {
  gravity: -0.012,
  runSpeed: 0.13,
  groundAccel: 0.022,
  airAccel: 0.009,
  groundStop: 0.72, // speed kept per update on the ground with no input
  jumpSpeed: 0.205,
  jumpHoldBoost: 0.0105, // added while the button is held, for jumpHoldTime
  jumpHoldTime: 0.16,
  jumpCut: 0.55, // upward speed kept when the button is let go early
  fallExtra: 0.25, // extra gravity while falling, for a snappier arc
  coyoteTime: 0.1, // a jump still works this long after running off a ledge
  jumpBuffer: 0.15, // a press this early still jumps on landing
  stompBounce: 0.2,
  hearts: 3,
  hurtTime: 1.4, // seconds of blinking safety after a hit
  bugSpeed: 0.028,
  viewHeight: 12, // tiles of the world shown top to bottom
};

export const palette = {
  // sky, top to horizon
  skyTop: '#16123a',
  skyMid: '#4a2a6e',
  skyLow: '#d25a78',
  horizon: '#ffb070',
  sun: '#ffd9a0',
  // backdrops
  farTop: '#c46a92',
  far: '#9a4c86',
  farLow: '#7a3a78',
  midTop: '#6a3a7a',
  mid: '#4a2662',
  midTree: '#42205a',
  near: '#2a1640',
  nearTree: '#231236',
  // ground
  soilTop: '#4e2f56',
  soilDeep: '#1a0f24',
  moss: '#6e9440',
  mossLight: '#b4c25a',
  mossDark: '#3e5a2c',
  grass: '#7aa04a',
  grassTip: '#ffd98a',
  rim: '#ffd2a0',
  shroom: '#b88aff',
  flowerA: '#ff8aa8',
  flowerB: '#ffcf6a',
  // things
  robot: '#d0844a',
  robotLight: '#ffd6a8',
  robotDark: '#6a3420',
  visor: '#120e26',
  eye: '#7ff4ff',
  bulb: '#ffcf5a',
  seed: '#ffcc4a',
  leaf: '#8ccf5a',
  bug: '#7a3c9a',
  bugSheen: '#f0c8ff',
  bugEye: '#ff4a6a',
  stone: '#4c3a62',
  crystal: '#8af0ff',
};
