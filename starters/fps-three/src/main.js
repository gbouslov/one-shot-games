import { Engine } from './kit/core/engine.js';
import { createConfig } from './kit/core/config.js';
import { RenderSystem } from './kit/render/render.js';
import { MaterialSystem } from './kit/materials/index.js';
import { PhysicsSystem } from './kit/physics/physics.js';
import { AudioSystem } from './kit/audio/audio.js';
import { FxSystem } from './kit/fx/fx.js';
import { PlayerSystem } from './kit/player/player.js';
import { WeaponSystem } from './kit/weapons/weapons.js';
import { ScopeSystem } from './kit/weapons/scope.js';
import { EnemySystem } from './kit/enemies/enemies.js';
import { HudSystem } from './kit/hud/hud.js';
import { RoundSystem } from './kit/round/round.js';
import { installDebugApi } from './kit/debug/api.js';

import config from './game/config.js';
import { createLook } from './game/look.js';
import { buildWorld } from './game/world.js';
import { weapons } from './game/weapons.js';
import { enemies } from './game/enemies.js';
import { rules } from './game/rules.js';
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
    .add(PhysicsSystem)
    .add(AudioSystem, { voices, ambient })
    .add(FxSystem)
    .add(PlayerSystem)
    .add(WeaponSystem, { defs: weapons })
    .add(ScopeSystem)
    .add(EnemySystem, { defs: enemies })
    .add(HudSystem)
    .add(RoundSystem, { rules });
  await engine.init();

  const ctx = engine.ctx;
  const physics = ctx.get('physics');
  const look = createLook(ctx);
  const level = buildWorld(ctx);
  physics.build();
  ctx.get('enemies').bake(level.bounds);
  level.afterPhysics?.(ctx);

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
  ctx.get('enemies').prewarm();

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
