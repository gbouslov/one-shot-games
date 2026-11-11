import { Engine } from './kit/core/engine.js';
import { createConfig } from './kit/core/config.js';
import { RenderSystem } from './kit/render/render.js';
import { MaterialSystem } from './kit/materials/index.js';
import { AudioSystem } from './kit/audio/audio.js';
import { FxSystem } from './kit/fx/fx.js';
import { DefenseSystem } from './kit/td/defense.js';
import { ControlsSystem } from './kit/td/controls.js';
import { CameraSystem } from './kit/td/camera.js';
import { HudSystem } from './kit/td/hud.js';
import { BotSystem } from './kit/td/bot.js';
import { installDebugApi } from './kit/debug/api.js';

import config, { towers, enemies, waves, economy, bot } from './game/config.js';
import { models } from './game/models.js';
import { buildLevel } from './game/level.js';
import { createLook } from './game/look.js';
import { createEffects } from './game/effects.js';
import { voices, ambient } from './game/sounds.js';
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
    .add(MaterialSystem)
    .add(AudioSystem, { voices, ambient })
    .add(FxSystem)
    .add(DefenseSystem, { towers, enemies, waves, economy, models })
    .add(ControlsSystem)
    .add(CameraSystem)
    .add(HudSystem)
    .add(BotSystem, bot);
  await engine.init();

  const ctx = engine.ctx;
  const look = createLook(ctx);
  const level = buildLevel(ctx);
  ctx.get('defense').setLevel(level);
  const effects = createEffects(ctx, level);

  engine.registry.add(new (class WorldDriver {
    static id = 'world';
    update(dt) {
      look.update?.(dt, ctx);
      level.update?.(dt, ctx);
      effects.update?.(dt, ctx);
    }
  })());
  engine.registry.resolve();
  engine.registry.invalidate();

  const api = installDebugApi(engine, shots, { lockstep });
  ctx.get('render').prewarm?.(ctx);
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
