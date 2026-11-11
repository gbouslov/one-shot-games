// Named set-ups for `npm run capture`. Each one puts the world in a state worth a picture;
// the tool then runs 30 updates and takes the screenshot.
import * as LJS from '../kit/engine.js';
import { control } from '../kit/boot.js';
import { input } from '../kit/input.js';

const { vec2 } = LJS;

export function makeShots(api) {
  const { g, placeCamera } = api;
  const at = (x, y, vx = 0, vy = 0) => {
    const p = g.player;
    p.pos = vec2(x, y);
    p.velocity = vec2(vx, vy);
    placeCamera(vec2(x + 2.2, y + 1.6), true);
  };
  // put the nearest sunseed on the robot's path
  const moveSeed = (x, y) => {
    let best = null;
    for (const t of g.things) if (t.home && (!best || Math.abs(t.pos.x - x) < Math.abs(best.pos.x - x))) best = t;
    if (best) { best.home = vec2(x, y); best.pos = vec2(x, y); best.phase = -LJS.time * 2.4; }
  };
  return {
    title: { state: 'title', apply: () => { placeCamera(vec2(30, 8), true); } },
    run: { apply: () => { control.start(); at(19.5, 5.5, 0.13); input.setBot(true); } },
    leap: { apply: () => { control.start(); at(29.8, 5.5, 0.13); input.setBot(true); } },
    // the bug near x=41 is moved under the falling robot, so the 30 updates end just after the stomp
    stomp: { apply: () => { control.start(); at(38.6, 7.4, 0.06, 0.02); for (const t of g.things) if (t.dir !== undefined && Math.abs(t.pos.x - 41) < 1) t.pos.x = 40.2; } },
    ledges: { apply: () => { control.start(); at(82.5, 9.6, 0.13); input.setBot(true); } },
    beacon: { hud: false, apply: () => { control.start(); at(108.2, 9.6, 0.1); input.setBot(true); } },
    // the moments of action, each timed to land about 20 of the 30 updates in, so the picture is mid-effect
    seed: { apply: () => { control.start(); at(47.6, 7.5, 0.13); input.setBot(true); moveSeed(50.6, 7.5); } },
    hurt: { apply: () => { control.start(); at(33.3, 11, 0, 0); } },
    lantern: { apply: () => { control.start(); at(34, 5.5, 0.13); input.setBot(true); } },
    // the beacon wakes on the first update; pixel effects are run on 0.9 s so the fireworks are open
    celebrate: { hud: false, apply: () => { control.start(); at(109.6, 9.5, 0); placeCamera(vec2(108, 11.4), true); g.winAt = LJS.time; g.beacon.ignite(); api.advanceFx?.(0.9); } },
  };
}
