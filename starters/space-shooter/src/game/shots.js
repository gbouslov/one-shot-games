/**
 * Named screenshots for `npm run capture`. Each one starts a round with the
 * bot flying, simulates game time (`seconds`, `untilDistance` along the rail,
 * or `until(round)`), then optionally places the camera relative to the ship:
 * pos and look are [x, y, z] offsets from the ship in world axes (-Z is
 * ahead). No camera means the normal rail camera.
 */
export const shots = {
  title: { seconds: 5 },
  run: { state: 'playing', until: (r) => r.enemies.filter((e) => e.rel && e.t - e.delay > 1.9).length >= 2 },
  turrets: { state: 'playing', untilDistance: 1060, after: 0.5 },
  hero: { state: 'playing', untilDistance: 1540, after: 1, camera: { pos: [-7, 1.2, -9], look: [0, 0.5, 4], fov: 50 }, hud: false },
  boss: { state: 'playing', until: (r) => r.bossActive && r.ship.speed < 4, after: 2 },
};
