/**
 * Title, waves, end screens, and the breaker objective.
 * The round is won by clearing 3 waves. While they come, the player can reset the 3 tripped
 * breakers (stand at a panel for 1.5 s); with all 3 on, the generator starts and the hall
 * lights come up. Every line is an objective, a direction, a count or Dispatch on the radio.
 */
const RESET_SECONDS = 1.5;
const REACH = 1.9;

let progress = new Map();
let genOn = false;

const level = (ctx) => ctx.get('round').level;
const hud = (ctx) => ctx.get('hud').shooter;
const onCount = (ctx) => level(ctx).breakers.filter((b) => b.on).length;

function refreshObjective(ctx) {
  const h = hud(ctx);
  const lv = level(ctx);
  const n = onCount(ctx);
  h.markers = lv.breakers.map((b) => ({ x: b.x, z: b.z, done: b.on }));
  if (genOn) {
    h.setObjective('GENERATOR ONLINE – HOLD THE DOCK', '', null, 'CLEAR THE LAST WAVE');
    return;
  }
  const p = ctx.get('player').feet;
  let next = null;
  let best = Infinity;
  for (const b of lv.breakers) {
    if (b.on) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d < best) { best = d; next = b; }
  }
  h.setObjective('RESET 3 BREAKERS', `${n}/3`, n / 3, next ? `NEXT: ${next.id} · ${next.where} · ${Math.round(best)} M` : '');
}

export const rules = {
  title: 'Cold Chain',
  tagline: 'Kessler Cold Store, 02:10. Power is out and the freezers are warming. Reset the 3 breakers and hold the loading dock through 3 waves.',
  startLabel: 'Click to start',
  controls: 'WASD move · mouse aim (the light follows) · click fire · right mouse aim down the 3x sight · R reload · 1 2 3 or Q swap · Shift sprint · C crouch · stand at a breaker panel to reset it',
  minSpawnDistance: 16,
  breakSeconds: 5,
  intro: {
    kicker: 'MAP 01 · 02:10',
    title: 'KESSLER COLD STORE',
    sub: 'LOADING DOCK · POWER OUT · −22 °C · FREEZER FOG',
    seconds: 4.5,
    path: [[-2, 7.6, -11.5], [8.5, 1.2, 9]],
  },
  waves: [
    { message: 'WAVE 1/3 · MOTION IN THE RACKING', spawnInterval: 1.6, enemies: [{ type: 'thawed', count: 4 }],
      radio: 'Three breakers tripped: west wall, dock, east wall. Reset all three and the generator starts.', radioSeconds: 6 },
    { message: 'WAVE 2/3 · CRAWLERS – CHECK UNDER THE RACKS', spawnInterval: 0.9, enemies: [{ type: 'thawed', count: 3 }, { type: 'rimecrawler', count: 4 }],
      radio: 'Four crawlers under the racks, three walkers behind them. Watch the floor lines.' },
    { message: 'WAVE 3/3 · FOREMAN – AIM FOR THE HEAD', spawnInterval: 0.8, enemies: [{ type: 'foreman', count: 1 }, { type: 'thawed', count: 2 }, { type: 'rimecrawler', count: 2 }],
      radio: 'Foreman coming through dock 2. Hi-vis, hard hat. Go for the head.' },
  ],
  winScreen: { title: 'Dock held', text: 'Dock held.', action: 'Play again' },
  loseScreen: { title: 'You died', text: 'Dock lost.', action: 'Retry' },

  endScreen(state, ctx) {
    const n = onCount(ctx);
    if (state === 'won' && genOn) return { title: 'Generator online', text: 'Breakers 3/3.' };
    if (state === 'won') return { text: `Generator offline. Breakers ${n}/3.` };
    return { text: `Dock lost. Breakers ${n}/3.` };
  },

  onStart(ctx) {
    progress = new Map();
    genOn = false;
    for (const b of level(ctx).breakers) b.set(false);
    level(ctx).generator(false);
    refreshObjective(ctx);
  },

  onUpdate(dt, ctx) {
    const lv = level(ctx);
    const p = ctx.get('player');
    const h = hud(ctx);
    for (const b of lv.breakers) {
      if (b.on) continue;
      const d = Math.hypot(b.x - p.feet.x, b.z - p.feet.z);
      if (d > REACH || p.dead) {
        progress.set(b.id, Math.max(0, (progress.get(b.id) ?? 0) - dt * 2));
        continue;
      }
      const t = (progress.get(b.id) ?? 0) + dt;
      progress.set(b.id, t);
      h.prompt(`RESETTING BREAKER ${b.id}`, Math.min(1, t / RESET_SECONDS));
      if (t >= RESET_SECONDS) {
        b.set(true);
        ctx.get('audio').play('breaker');
        h.addScore(250);
        const n = onCount(ctx);
        if (n === 3) {
          genOn = true;
          lv.generator(true);
          ctx.get('audio').play('generator');
          h.radio('Generator is running. Lights are coming up. Hold the dock.', 5);
          ctx.get('hud').showBanner('GENERATOR ONLINE', 2.4);
        } else {
          h.radio(`Breaker ${b.id} is live. ${3 - n} to go.`, 3.5);
        }
      }
    }
    refreshObjective(ctx);
  },
};
