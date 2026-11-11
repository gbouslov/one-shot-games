import { Engine } from './kit/core/engine.js';
import { createConfig } from './kit/core/config.js';
import { RenderSystem } from './kit/render/render.js';
import { AudioSystem } from './kit/audio/audio.js';
import { RoundSystem } from './kit/rail/round.js';
import { HudSystem } from './kit/hud/hud.js';
import { DirectorSystem } from './kit/rail/director.js';
import { installDebugApi } from './kit/debug/api.js';

import config from './game/config.js';
import { rules } from './game/rules.js';
import { grade, palette } from './game/look.js';
import { buildTrench } from './game/trench.js';
import { buildArt } from './game/art.js';
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
  ctx.get('render').setLook({ ...grade, sunDir: config.sunDir });

  const world = buildTrench(ctx, config, rules, palette);
  const { ship, art } = await buildArt(ctx, config, rules, palette);
  const round = ctx.get('round');
  ctx.input.installTouch(document.getElementById('ui'));
  ctx.get('director').setup({ ship, world, art, look: palette });

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
