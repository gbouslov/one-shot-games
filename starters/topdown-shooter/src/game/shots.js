/**
 * Named setups for screenshots. capture.mjs renders each in a fresh page with a
 * fixed number of frames, so two runs can be compared with imagediff.
 *   play: true      start a round first (HUD on, the follow camera)
 *   title: true     keep the title screen up
 *   pos / look      a scripted camera instead of the follow camera
 *   apply(ctx)      place enemies, aim, hold the trigger
 */
const fight = (list, aim, fire = true, weapon = 0) => (ctx) => {
  const e = ctx.get('enemies');
  for (const [type, x, z] of list) e.spawn(type, x, z);
  ctx.get('weapons')._select(weapon, true);
  ctx.input.aimWorld = aim;
  if (fire) ctx.input.virtual('Mouse0', true);
};

export const shots = {
  title: { title: true },
  fight: {
    play: true,
    apply: fight([['walker', -2.5, 1.2], ['walker', 1.5, 0.8], ['runner', -5, -1.5], ['walker', 3.8, -2.6], ['walker', -1, -4.5], ['brute', 1.2, -7]], [-2.3, 1.4]),
  },
  shotgun: {
    play: true,
    apply: fight([['walker', -1.2, 3.2], ['walker', 0.6, 3.0], ['runner', 1.8, 2.4], ['walker', -2.8, 0.6], ['walker', 3.2, -1.2]], [-0.2, 3.1], true, 1),
  },
  horde: {
    play: true,
    apply: (ctx) => {
      const e = ctx.get('enemies');
      const pts = [[-1.5, -12], [1.2, -11], [0, -13.5], [-2.6, -9.5], [2.4, -9], [0.4, -8], [-0.8, -15.5], [1.8, -14.6], [-3.6, -13]];
      pts.forEach(([x, z], i) => e.spawn(i === 2 ? 'brute' : i % 3 ? 'walker' : 'runner', x, z));
      ctx.input.aimWorld = [0, -8];
    },
  },
  // the same fight with the kit's pixel-art light effects switched on (they are off by default), to judge them
  'fight-pixelfx': {
    play: true,
    apply: (ctx) => {
      ctx.get('pixelfx').enabled = true;
      fight([['walker', -2.5, 1.2], ['walker', 1.5, 0.8], ['runner', -5, -1.5], ['walker', 3.8, -2.6], ['walker', -1, -4.5], ['brute', 1.2, -7]], [-2.3, 1.4])(ctx);
    },
  },
  // shooting into the yard wall, with a health drop under the keeper's feet, pixel effects on
  'wall-pixelfx': {
    play: true,
    apply: (ctx) => {
      ctx.get('pixelfx').enabled = true;
      const p = ctx.get('player');
      p.health = 60;
      ctx.get('pickups').spawn('medkit', p.x + 0.4, p.z);
      ctx.get('weapons')._select(0, true);
      ctx.input.aimWorld = [p.x + 12, p.z - 3];
      ctx.input.virtual('Mouse0', true);
    },
  },
  wall: {
    play: true,
    apply: (ctx) => {
      const p = ctx.get('player');
      p.health = 60;
      ctx.get('pickups').spawn('medkit', p.x + 0.4, p.z);
      ctx.get('weapons')._select(0, true);
      ctx.input.aimWorld = [p.x + 12, p.z - 3];
      ctx.input.virtual('Mouse0', true);
    },
  },
  yard: { pos: [-15, 7.5, 18], look: [2, 0, -3], fov: 46, hud: false },
  ground: {
    pos: [5.5, 1.6, 7.5], look: [-1, 1.1, -0.5], fov: 50, hud: false,
    apply: (ctx) => {
      const e = ctx.get('enemies');
      e.spawn('brute', -1.5, -1.2);
      e.spawn('walker', 1.2, -2.5);
      e.spawn('walker', -3.4, 0.4);
      const p = ctx.get('player');
      p.controlEnabled = true;
      p.x = 2.4;
      p.z = 3.2;
      ctx.input.captureGameplay = true;
      ctx.input.aimWorld = [-1.5, -1.2];
    },
    play: true,
  },
};
