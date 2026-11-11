import { Engine } from './kit/core/engine.js';
import { createConfig } from './kit/core/config.js';
import { RenderSystem } from './kit/render/render.js';
import { MaterialSystem } from './kit/materials/index.js';
import { ArenaSystem } from './kit/arena/arena.js';
import { AudioSystem } from './kit/audio/audio.js';
import { FxSystem } from './kit/fx/fx.js';
import { PixelFxSystem } from './kit/fx/pixelfx.js';
import { PlayerSystem } from './kit/actors/player.js';
import { CameraSystem } from './kit/camera/camera.js';
import { HordeSystem } from './kit/horde/horde.js';
import { GemSystem } from './kit/gems/gems.js';
import { ArsenalSystem } from './kit/arsenal/arsenal.js';
import { PickupSystem } from './kit/pickups/pickups.js';
import { HudSystem } from './kit/hud/hud.js';
import { LevelUpSystem } from './kit/levelup/levelup.js';
import { RoundSystem } from './kit/round/round.js';
import { BotSystem } from './kit/bot/autoplay.js';
import { installDebugApi } from './kit/debug/api.js';

import config from './game/config.js';
import { loadAssets } from './game/assets.js';
import { createLook } from './game/look.js';
import { buildLevel } from './game/level.js';
import { weapons } from './game/weapons.js';
import { enemies } from './game/enemies.js';
import { rules, pickups, gems } from './game/rules.js';
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
    .add(ArenaSystem)
    .add(AudioSystem, { voices, ambient })
    .add(FxSystem)
    .add(PixelFxSystem)
    .add(PlayerSystem)
    .add(CameraSystem)
    .add(HordeSystem, { defs: enemies })
    .add(GemSystem, { tiers: gems })
    .add(ArsenalSystem, { defs: weapons, maxWeapons: rules.maxWeapons, maxPassives: rules.maxPassives })
    .add(PickupSystem, { kinds: pickups })
    .add(HudSystem)
    .add(LevelUpSystem, { rules })
    .add(RoundSystem, { rules })
    .add(BotSystem);
  await engine.init();

  const ctx = engine.ctx;
  ctx.get('camera').configure(cfg.camera ?? {});
  const assets = await loadAssets();
  const look = createLook(ctx, assets);
  const level = buildLevel(ctx, assets);

  engine.registry.add(new (class LookDriver {
    static id = 'look';
    update(dt) {
      look.update?.(dt, ctx);
      level.update?.(dt, ctx);
    }
  })());
  engine.registry.resolve();
  engine.registry.invalidate();

  ctx.get('round').setLevel(level);
  ctx.get('render').prewarm?.(ctx);

  const api = installDebugApi(engine, shots, { lockstep });
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
