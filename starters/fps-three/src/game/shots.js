/**
 * Named camera setups for screenshots. capture.mjs renders each in a fresh page,
 * so two runs can be compared with imagediff. Add one per thing you care about.
 */
const holding = (id) => (ctx) => {
  const w = ctx.get('weapons');
  w._select(w.slots.findIndex((s) => s.def.id === id), true);
};

export const shots = {
  // First-person views with the hands: what the player looks at all game.
  held: { pos: [3, 1.75, 12], look: [-5, 1.9, -3], fov: 78, hud: true, apply: holding('carbine') },
  heldSide: { pos: [-6, 1.75, 4], look: [6, 1.6, 4], fov: 78, hud: false, apply: holding('carbine') },
  heldPulse: { pos: [3, 1.75, 12], look: [-5, 1.9, -3], fov: 78, hud: false, apply: holding('pulse') },
  heldMelee: { pos: [3, 1.75, 12], look: [-5, 1.9, -3], fov: 78, hud: false, apply: holding('hatchet') },
  hero: { pos: [4, 2.2, 15], look: [-7, 2.6, -14], fov: 72, hud: false },
  stones: { pos: [-16, 1.7, 2], look: [-13, 3.6, -9], fov: 62, hud: false },
  horizon: { pos: [0, 4.6, -11], look: [-24, 3.4, -30], fov: 70, hud: false },
  enemies: {
    pos: [0, 1.7, 7], look: [0, 1.25, -2], fov: 62, hud: false,
    apply: (ctx) => {
      const e = ctx.get('enemies');
      e.spawn('walker', -1.8, 0.5);
      e.spawn('walker', 2, -1.5);
      e.spawn('spitter', 0.4, -3.5);
      ctx.get('fx').clear();
    },
  },
};
