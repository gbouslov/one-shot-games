/**
 * Named setups for screenshots. capture.mjs renders each in a fresh page with a
 * fixed number of frames, so two runs can be compared with imagediff.
 *   play: true      start a round first (HUD on, the follow camera)
 *   title: true     keep the title screen up
 *   pos / look      a scripted camera instead of the follow camera
 *   apply(ctx)      place enemies, hand out weapons, move the clock
 */
const kit = (ctx, list) => {
  const ar = ctx.get('arsenal');
  ar.reset(list.map(([id]) => id));
  for (const o of ar.owned) o.level = list.find(([id]) => id === o.def.id)[1];
  ar._passives(false);
};

const ring = (ctx, type, n, r0, r1, seed = 1) => {
  const h = ctx.get('horde');
  const p = ctx.get('player');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.sin(i * 12.9898 + seed) * 0.4;
    const r = r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(i * 78.233 + seed));
    h.spawn(type, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
  }
};

/** Keep a capture from levelling up mid-shot (the cards would cover it): a long way to the next level. */
const steady = (ctx, level, fill = 0.4) => {
  const lu = ctx.get('levelup');
  lu.level = level;
  lu.next = 100000;
  lu.xp = lu.next * fill;
};

const shards = (ctx, n, r0, r1) => {
  const g = ctx.get('gems');
  const p = ctx.get('player');
  for (let i = 0; i < n; i++) {
    const a = i * 2.399;
    const r = r0 + ((i * 0.618) % 1) * (r1 - r0);
    g.drop(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, i % 9 === 0 ? 6 : i % 4 === 0 ? 3 : 1);
  }
};

export const shots = {
  title: { title: true },
  // a minute in: the lantern, an ember ring, a crowd closing
  fight: {
    play: true,
    apply: (ctx) => {
      kit(ctx, [['bolt', 2], ['ember', 2]]);
      ctx.get('round').elapsed = 62;
      ring(ctx, 'mireling', 26, 3.2, 9);
      ring(ctx, 'skitter', 6, 6, 10, 3);
      shards(ctx, 30, 4, 9);
      steady(ctx, 4, 0.55);
    },
  },
  // late: every weapon, the field full
  horde: {
    play: true,
    apply: (ctx) => {
      kit(ctx, [['bolt', 4], ['ember', 4], ['bell', 3], ['storm', 3], ['oilskin', 1]]);
      ctx.get('round').elapsed = 205;
      steady(ctx, 11, 0.3);
      ring(ctx, 'mireling', 70, 3, 14);
      ring(ctx, 'skitter', 20, 5, 13, 5);
      ring(ctx, 'wisp', 12, 4, 11, 7);
      ring(ctx, 'bogman', 4, 6, 9, 9);
      shards(ctx, 50, 4, 11);
    },
  },
  boss: {
    play: true,
    apply: (ctx) => {
      kit(ctx, [['bolt', 5], ['hearth', 1], ['bell', 4], ['storm', 3], ['oilskin', 2], ['lodestone', 1]]);
      ctx.get('round').elapsed = 262;
      steady(ctx, 15, 0.7);
      const p = ctx.get('player');
      ctx.get('horde').spawn('hart', p.x + 3.5, p.z - 3.5);
      ring(ctx, 'mireling', 30, 5, 12, 11);
      ring(ctx, 'wisp', 8, 4, 9, 13);
    },
  },
  levelup: {
    play: true,
    apply: (ctx) => {
      kit(ctx, [['bolt', 2], ['ember', 1]]);
      ctx.get('round').elapsed = 48;
      ring(ctx, 'mireling', 18, 4, 10);
      ctx.get('levelup').force();
    },
  },
  ground: {
    pos: [6.5, 2.2, 7.5], look: [-0.5, 0.8, -1.5], fov: 50, hud: false, play: true,
    apply: (ctx) => {
      kit(ctx, [['bolt', 2], ['ember', 3]]);
      const h = ctx.get('horde');
      h.spawn('bogman', -1.8, -2.5);
      h.spawn('mireling', 1.6, -1.2);
      h.spawn('mireling', 2.6, 0.4);
      h.spawn('skitter', -0.4, -4.6);
      h.spawn('wisp', 0.8, -3.2);
      ctx.get('player').x = 0.5;
      ctx.get('player').z = 1.5;
    },
  },
  clearing: { pos: [-18, 15, 24], look: [2, 0, -2], fov: 46, hud: false },
};
