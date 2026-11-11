# Notices: platformer-2d

Every file here that was copied or adapted from another project. Everything not listed was written for this repo.

| File here | File there | Source repo | Licence | Commit | What changed |
|---|---|---|---|---|---|
| `src/kit/vendor/littlejs.esm.min.js` | `dist/littlejs.esm.min.js` | https://github.com/KilledByAPixel/LittleJS | MIT (Copyright (c) 2021 Frank Force) | 9712ac4cd76e8d5eb77da21004687b63f7856fc1 | Nothing. Copied with `tools/vendor.mjs`. |
| `src/kit/vendor/LICENSE` | `LICENSE` | same | MIT | same | Nothing. |
| `src/game/entities.js` (class `Player`) | `examples/platformer/gameCharacter.js`, `gamePlayer.js` | same | MIT | same | Adapted, not copied: the idea of a ground timer for coyote time, a pressed-jump timer as a buffer, and a held-jump boost while a jump timer runs. Rewritten with new numbers, a jump cut on release, extra fall gravity, squash and stretch, dust, footsteps; no ladders, rolling, wall climb, weapons or grenades. |
| `src/game/game.js` (camera, backdrops) | `examples/platformer/game.js`, `gameLevel.js` | same | MIT | same | Uses the engine's `ParallaxLayer` and `TileCollisionLayer` the way the example does. The camera, level format, backdrop painters and terrain painter are new. |
| `src/kit/fx.js` (`burst`, `stream`) | `examples/platformer/gameEffects.js` | same | MIT | same | The `ParticleEmitter` argument order follows the example's calls; the wrappers and presets are new. |

The example's sprite sheets (`tiles.png`, `tilesLevel.png`) and its level file were not copied. All art is drawn in code in `src/game/art.js`.

## From patch-gg/pixelfx (MIT)

Source: https://github.com/patch-gg/pixelfx at commit 044e12a45dc9cc312cec50ee606dfc98afe5adc2. MIT, Copyright (c) 2026 Patch and Copyright (c) 2026 Hugo Duprez; its `NOTICE.md` credits Hugo Duprez's Sprite Fusion pixel art VFX (https://www.spritefusion.com/pixel-art-vfx, MIT), which `src/core/sim.js` and every effect below adapt (each says so at its top). Copied with `node tools/vendor.mjs --from=<pixelfx clone> --to=starters/platformer-2d/src/kit/vendor/pixelfx`; the licence and notice travel with the copy. The gallery, its font (not MIT), the tools and the skill were not taken.

| File here | File there | What changed |
|---|---|---|
| `src/kit/vendor/pixelfx/LICENSE`, `NOTICE.md` | `LICENSE`, `NOTICE.md` | Nothing |
| `src/kit/vendor/pixelfx/src/core/math.js`, `color.js`, `particles.js`, `shapes.js`, `sim.js`, `painter.js`, `font.js`, `fx.js`, `actor.js` | `src/core/` same names | Nothing |
| `src/kit/vendor/pixelfx/src/core/index.js` | `src/core/index.js` | Re-exports of `scene.js`, `act.js`, `rig.js`, `poses.js`, `chain.js` removed; those files were not copied |
| `src/kit/vendor/pixelfx/src/fx/spawn/poof.js` | `src/fx/spawn/poof.js` | Nothing |
| `src/kit/vendor/pixelfx/src/fx/pickups/collect-burst.js`, `_lib.js` | `src/fx/pickups/` same names | Nothing |
| `src/kit/vendor/pixelfx/src/fx/impacts/hit-spark.js` | `src/fx/impacts/hit-spark.js` | Nothing |
| `src/kit/vendor/pixelfx/src/fx/explosions/firework-burst.js`, `firework-rocket.js`, `_lib.js` | `src/fx/explosions/` same names | Nothing |

`src/kit/pixelfx.js` (the bridge) and `src/game/effects.js` (which effect, palette and place for each moment) were written here.
