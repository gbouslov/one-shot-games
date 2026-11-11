const holding = (id) => (ctx) => {
  const w = ctx.get('weapons');
  w._select(w.slots.findIndex((s) => s.def.id === id), true);
};
// The world's update() glues the flashlight to the camera, so every shot is lit as in play.
const fight = (ctx) => {
  const e = ctx.get('enemies');
  e.spawn('thawed', 7.6, 2.0);
  e.spawn('rimecrawler', 4.2, -3.5);
  e.spawn('thawed', 1.0, 0.5);
  ctx.get('fx').clear();
  const h = ctx.get('hud').shooter;
  if (h) {
    const lv = ctx.get('round').level;
    lv.breakers[0].set(true);
    h.markers = lv.breakers.map((b) => ({ x: b.x, z: b.z, done: b.on }));
    h.setObjective('RESET 3 BREAKERS', '1/3', 1 / 3, 'NEXT: C · EAST WALL · 22 M');
    h.setWave(2, 6, 0.45);
    h.score = 1450; h.chain = 3; h.chainT = 3;
    h.radio('Four crawlers under the racks, three walkers behind them. Watch the floor lines.', 30);
    h.contact(-15, 9.5);
    h.contactT = 20;
  }
};
import { rules } from './rules.js';
export const shots = {
  // the map intro card over the opening fly-in, at its first frame
  intro: { pos: rules.intro.path[0], look: rules.intro.path[1], fov: 78, hud: true, apply: (ctx) => { holding('smg')(ctx); ctx.get('hud').shooter?.intro(rules.intro, 60); } },
  // the full shooter HUD over a fight in aisle 04
  hud: { pos: [8.2, 1.7, 9.5], look: [7.4, 1.4, -4], fov: 78, hud: true, apply: (ctx) => { holding('smg')(ctx); fight(ctx); } },
  // aiming down the 3x sight: the lens shows a magnified view
  scope: { pos: [8.0, 1.7, 9.0], look: [7.8, 1.3, -2], fov: 78, hud: true, apply: (ctx) => { holding('smg')(ctx); fight(ctx); ctx.get('weapons').forceAds = true; } },
  breaker: { pos: [-17.2, 1.7, 5.6], look: [-19.6, 1.6, 3.4], fov: 74, hud: false, apply: holding('pistol') },
  heldPistol: { pos: [8.5, 1.7, 12.6], look: [8.3, 2.0, -14], fov: 78, hud: false, apply: holding('pistol') },
  held: { pos: [8.5, 1.7, 12.6], look: [8.3, 2.4, -14], fov: 78, hud: true, apply: holding('smg') },
  aisle: { pos: [-0.4, 1.7, 9], look: [-0.6, 2.8, -12], fov: 74, hud: false, apply: holding('smg') },
  dock: { pos: [0, 1.7, -5], look: [-9, 2.2, -15], fov: 76, hud: false, apply: holding('smg') },
  hut: { pos: [15.4, 1.7, 1.2], look: [16.6, 1.4, 9.6], fov: 72, hud: false, apply: holding('machete') },
  heldMelee: { pos: [8.0, 1.7, 12.6], look: [8.0, 2.0, -6], fov: 78, hud: false, apply: holding('machete') },
  enemiesSide: {
    pos: [4.2, 1.5, 1.6], look: [8, 1.0, 1.2], fov: 64, hud: false, apply: (ctx) => {
      const e = ctx.get('enemies');
      e.spawn('thawed', 7.2, 0.5);
      e.spawn('rimecrawler', 7.6, 2.4);
      ctx.get('fx').clear();
    },
  },
  enemies: {
    pos: [8, 1.7, 6], look: [8, 1.3, -2], fov: 64, hud: false, apply: (ctx) => {
      const e = ctx.get('enemies');
      e.spawn('thawed', 7.2, 0.5);
      e.spawn('foreman', 9.0, -2.5);
      e.spawn('rimecrawler', 7.6, 2.4);
      ctx.get('fx').clear();
    },
  },
  // close looks at the motion-captured clips: mid-stride side-on, mid-punch, and a body on the floor
  punch: {
    pos: [8, 1.7, 6], look: [8, 1.2, 4.2], fov: 70, hud: false, apply: (ctx) => {
      ctx.get('enemies').spawn('thawed', 8, 4.3);
      ctx.get('fx').clear();
    },
  },
  dead: {
    pos: [8, 1.7, 6], look: [8, 0.2, 3.2], fov: 64, hud: false, apply: (ctx) => {
      const es = ctx.get('enemies');
      const e = es.spawn('thawed', 8, 3.5);
      es._die(e, [0, 0, -1]);
      ctx.get('fx').clear();
    },
  },
};
