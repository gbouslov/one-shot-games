/**
 * Named screenshots for `npm run capture`. Each one stages a moment (towers,
 * beetles, shells in the air) and places the camera. pos/look in world metres;
 * leave them out to use the game camera (blend 1 = play view, 0 = title view).
 * Cells are [column, row] on the map in src/game/level.js.
 */

function stage(ctx, { towers = [], enemies = [], steps = 0, wave = 4, gold = 245, lives = 17, state = 'playing' }) {
  const d = ctx.get('defense');
  d.start();
  d.countdown = 999;
  d.gold = 1e6;
  for (const [i, c, r, level = 0] of towers) {
    const t = d.build(i, c, r);
    if (!t) continue;
    for (let k = 0; k < level; k++) d.upgrade(t);
    t.built = 1;
    t.yaw = Math.PI * 0.75;
  }
  for (const [id, dist, lane = 0] of enemies) {
    d._spawn(id, wave - 1);
    const e = d.enemies[d.enemies.length - 1];
    e.d = dist;
    e.lane = lane;
    e.wave = -1; // staged walkers belong to no wave
    d._place(e);
  }
  d.wave = wave;
  d.cleared = wave;
  for (let s = 0; s < steps; s++) d._step(1 / 60);
  d.gold = gold;
  d.lives = lives;
  d.countdown = 11.4;
  d.state = state;
}

const DEFENSES = [
  [0, 7, 5, 1], [1, 8, 6, 0], [2, 5, 5, 0], [0, 10, 3, 0], [1, 12, 5, 1],
  [0, 14, 6, 2], [2, 16, 7, 0], [0, 17, 9, 0], [0, 4, 3, 0],
];
const WAVE = [
  ['crawler', 12, 0.2], ['crawler', 13.4, -0.3], ['mite', 14.6, 0.4], ['crawler', 16.2, 0], ['mite', 17, -0.4],
  ['shell', 19.5, 0], ['crawler', 22, 0.3], ['crawler', 23.2, -0.2], ['mite', 26, 0.2], ['mite', 26.7, -0.3],
  ['crawler', 31, 0], ['shell', 35, 0.1], ['crawler', 38, -0.3], ['mite', 40, 0.3], ['crawler', 44, 0],
  ['crawler', 52, 0.2], ['mite', 53, -0.2], ['crawler', 58, 0.1],
];

export const shots = {
  /** The title screen over the live valley. */
  title: {
    blend: 0,
    apply: (ctx) => stage(ctx, { towers: DEFENSES.slice(0, 5), enemies: WAVE.slice(0, 8), steps: 0, state: 'title' }),
  },
  /** The game as played: mid-night, shells in the air, HUD up. */
  play: {
    blend: 1,
    apply: (ctx) => stage(ctx, { towers: DEFENSES, enemies: WAVE, steps: 150 }),
  },
  /** Low over the switchback where the kiln and spires catch the column. */
  switchback: {
    hud: false,
    pos: [2.5, 6.2, 11.5],
    look: [-4.8, 0.6, 0.6],
    fov: 42,
    apply: (ctx) => stage(ctx, { towers: DEFENSES, enemies: WAVE, steps: 120 }),
  },
  /** The shrine at the road's end, beetles closing in. */
  shrine: {
    hud: false,
    pos: [12.5, 4.6, 14],
    look: [22.5, 1.6, 3.8],
    fov: 44,
    apply: (ctx) => stage(ctx, { towers: DEFENSES, enemies: [['crawler', 60, 0.2], ['mite', 62, -0.3], ['shell', 57, 0], ['crawler', 64, 0.1], ['mite', 66.5, 0.2]], steps: 40 }),
  },
  /** The ruined gate the beetles pour out of. */
  gate: {
    hud: false,
    pos: [-15.5, 4.8, -1.5],
    look: [-24, 1.5, -7.4],
    fov: 44,
    apply: (ctx) => stage(ctx, { towers: [[0, 4, 3, 1], [2, 5, 1, 0]], enemies: [['crawler', 0.5, 0.2], ['crawler', 2.2, -0.3], ['mite', 3.3, 0.4], ['crawler', 5, 0], ['shell', 7.5, 0], ['mite', 9, -0.3]], steps: 20 }),
  },
};
