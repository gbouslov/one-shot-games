import { Engine } from './kit/core/engine.js';
import { createConfig } from './kit/core/config.js';
import { RenderSystem } from './kit/render/render.js';
import { AudioSystem } from './kit/audio/audio.js';
import { RoundSystem } from './kit/runner/round.js';
import { HudSystem } from './kit/hud/hud.js';
import { DirectorSystem } from './kit/runner/director.js';
import { installDebugApi } from './kit/debug/api.js';

import config from './game/config.js';
import { rules } from './game/rules.js';
import { grade, palette } from './game/look.js';
import { buildWorld } from './game/world.js';
import { buildArt } from './game/art.js';
import { buildCourier } from './game/courier.js';
import { voices, bed } from './game/sounds.js';
import { shots } from './game/shots.js';

function showFailure(err) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;inset:0;margin:0;padding:2rem;color:#f88;background:#000;font:13px/1.5 monospace;white-space:pre-wrap;z-index:9999';
  box.textContent = `This game could not start.\n\n${err?.message ?? err}\n\nIt needs a browser with WebGL 2.`;
  document.body.appendChild(box);
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const cfg = createConfig(config, params);
  const lockstep = cfg.deterministic && params.get('lockstep') === '1';

  const engine = new Engine({ canvas: document.getElementById('game'), config: cfg });
  engine
    .add(RenderSystem)
    .add(AudioSystem, { voices, bed })
    .add(RoundSystem, { rules })
    .add(HudSystem, { text: config.text })
    .add(DirectorSystem);
  await engine.init();

  const ctx = engine.ctx;
  const round = ctx.get('round');
  const [world, art, runner] = await Promise.all([
    buildWorld(ctx, config, rules, palette, round.track),
    buildArt(ctx, config, rules, palette),
    buildCourier(ctx, config, rules, palette),
  ]);
  ctx.get('render').setLook({ ...grade, sunDir: world.sunDir.toArray() });
  ctx.input.installTouch(document.getElementById('ui'), { isLive: () => round.state === 'playing' });
  ctx.get('director').setup({ runner, world, art, look: palette, camera: { goalView: world.goalView } });

  ctx.get('render').prewarm(ctx);
  const api = installDebugApi(engine, shots, { lockstep, game: { start: () => round.start() } });
  engine.start();

  const BOOT_FRAMES = 3;
  if (lockstep) {
    await api.pump(BOOT_FRAMES);
    api.markReady();
  } else {
    let warm = 0;
    const probe = () => {
      if (++warm >= BOOT_FRAMES) api.markReady();
      else requestAnimationFrame(probe);
    };
    requestAnimationFrame(probe);
  }
}

boot().catch((err) => {
  console.error('[boot] failed', err);
  showFailure(err);
});
