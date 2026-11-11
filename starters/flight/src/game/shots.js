/**
 * Named screenshots for `npm run capture`. Each one starts a round with the
 * bot flying, simulates `seconds` of game time (or until a gate index), then
 * places the camera in the aircraft's frame: pos and look are [x, y, z] in
 * plane space (nose is -Z, up is +Y). No camera means the normal chase view.
 */
export const shots = {
  title: { seconds: 6 },
  chase: { state: 'playing', seconds: 4 },
  gate: { state: 'playing', untilGate: 3, seconds: 0.2, camera: { pos: [-9, 3.5, 20], look: [0, 1, -40], fov: 55 } },
  hero: { state: 'playing', seconds: 13, camera: { pos: [-15, 2, 5], look: [0, 0.5, -6], fov: 45 }, hud: false },
};
