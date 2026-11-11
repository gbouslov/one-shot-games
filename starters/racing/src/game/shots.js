/**
 * Named camera setups for `npm run capture`. Each shot starts from a fresh page:
 *   mode     'title' (the attract race behind the title) or 'race'
 *   seconds  game time simulated (not drawn) before the shot; the bot drives
 *   camera   optional { pos, look, fov } in the player kart's frame:
 *            x right, y up, z ahead (metres). Omit for the chase camera.
 *   hud      false hides every overlay
 *   until    'drift' | 'boost': keep simulating until the player is doing it
 */
export default {
  title: { mode: 'title', seconds: 1 },
  grid: { mode: 'race', seconds: 0.5, hud: false, camera: { pos: [7.5, 3.4, 30], look: [0, 0.4, 12], fov: 48 } },
  chase: { mode: 'race', seconds: 16 },
  bridge: { mode: 'race', seconds: 25.5 },
  drift: { mode: 'race', seconds: 30, until: 'drift' },
  pack: { mode: 'race', seconds: 6, hud: false, camera: { pos: [-2.6, 0.9, 6.5], look: [0.4, 0.7, -4], fov: 50 } },
  sundown: { mode: 'race', seconds: 9, hud: false, camera: { pos: [5.5, 1.6, -5], look: [-1, 0.8, 6], fov: 46 } },
};
