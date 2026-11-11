# Notices for starters/topdown-shooter

Every file below was copied or adapted from a project under the MIT licence. The lead merges these rows into `third_party/NOTICES.md`.

## From this repository's first-person starter

Copied with `node tools/vendor.mjs --from=starters/fps-three/src/kit` at commit a097aec (working tree). Those files carry their own upstream credit in `third_party/NOTICES.md` (mshumer/Claude-of-Duty, MIT, d9b237b, and three.js, MIT).

| File here | File there | What changed |
|---|---|---|
| `src/kit/materials/` (whole folder) | `starters/fps-three/src/kit/materials/` | Nothing |
| `src/kit/audio/audio.js`, `dsp.js`, `shot.js` | `starters/fps-three/src/kit/audio/` | Nothing |
| `src/kit/textures/textures.js` | `starters/fps-three/src/kit/textures/textures.js` | Nothing |
| `src/kit/fx/fx.js` | `starters/fps-three/src/kit/fx/fx.js` | Nothing |
| `src/kit/render/render.js` | `starters/fps-three/src/kit/render/render.js` | Nothing |
| `src/kit/core/engine.js`, `registry.js`, `rng.js`, `config.js` | `starters/fps-three/src/kit/core/` | Nothing |
| `src/kit/debug/api.js` | `starters/fps-three/src/kit/debug/api.js` | Snapshot reshaped for a ground-plane shooter; `lose()` and `autoplay()` added; shots can start a round or keep the title |
| `src/kit/world/builders.js` | `starters/fps-three/src/kit/world/builders.js` | Kept `skyDome`, `sunLight` (as `keyLight`) and `motes`; physics calls removed; `ground`, `lamp`, `puddles` and `rain` are new |

## From xMPon/undead-protocol (MIT)

Source: https://github.com/xMPon/undead-protocol at commit 145db1e. Code only: no names, HUD, maps, characters or art were taken. Licence: MIT, Copyright (c) 2026 Maciej Poniewierski (reproduce in `third_party/NOTICES.md`).

| File here | File there | What changed |
|---|---|---|
| `src/kit/arena/geometry.js` | `src/sim/collision.ts` | Ported to JavaScript on the (x, z) plane; kept circle-vs-rect push-out, ray-vs-rect, ray-vs-circle; added circle obstacles and a face normal; height-aware and oriented-box resolution left out |
| `src/kit/arena/flowfield.js` | `src/sim/pathing.ts` | Ported to JavaScript on (x, z); circle obstacles, diagonal cost, no corner cutting, skips the rebuild while the goal stays in one cell |
| `src/kit/core/input.js` (touch part) | `src/core/Touch.ts` | The floating twin-stick overlay rewritten into the input class: same deadzone rescale and stick geometry, right stick fires past half way, three buttons |
| `src/kit/actors/rig.js` | `src/render/procgen.ts` (`limb`, `makeZombieRig`, `makePlayerRig`) | The idea only, rewritten: pivot-jointed limbs and gait advanced by distance. New builder that merges each segment into one vertex-coloured mesh, emissive parts, poses for holding, reaching and staggering |

## From patch-gg/pixelfx (MIT)

Source: https://github.com/patch-gg/pixelfx at commit 044e12a45dc9cc312cec50ee606dfc98afe5adc2. MIT, Copyright (c) 2026 Patch and Copyright (c) 2026 Hugo Duprez; its `NOTICE.md` credits Hugo Duprez's Sprite Fusion pixel art VFX (MIT), which `src/core/sim.js` and the three effects below adapt. Copied with `node tools/vendor.mjs --from=<pixelfx clone> --to=starters/topdown-shooter/src/kit/vendor/pixelfx`; the licence and notice travel with the copy. The gallery, its font (not MIT), the tools and the skill were not taken.

| File here | File there | What changed |
|---|---|---|
| `src/kit/vendor/pixelfx/LICENSE`, `NOTICE.md` | `LICENSE`, `NOTICE.md` | Nothing |
| `src/kit/vendor/pixelfx/src/core/math.js`, `color.js`, `particles.js`, `shapes.js`, `sim.js`, `painter.js`, `font.js`, `fx.js`, `actor.js` | `src/core/` same names | Nothing |
| `src/kit/vendor/pixelfx/src/core/index.js` | `src/core/index.js` | Re-exports of `scene.js`, `act.js`, `rig.js`, `poses.js`, `chain.js` removed; those files were not copied |
| `src/kit/vendor/pixelfx/src/fx/impacts/hit-spark.js`, `bullet-impact.js`, `_lib.js` | `src/fx/impacts/` same names | Nothing |
| `src/kit/vendor/pixelfx/src/fx/pickups/collect-burst.js`, `_lib.js` | `src/fx/pickups/` same names | Nothing |

`src/kit/fx/pixelfx.js` (the bridge: one CanvasTexture per effect on an additive billboard, off by default) was written here. To support it, `src/kit/weapons/weapons.js` now emits `weapon:impact` when a shot hits a wall, `src/kit/pickups/pickups.js` adds the position and colour to its `pickup` event, `src/kit/round/round.js` clears the effects on a new round, and `src/kit/debug/api.js` reports `pixelfx` in the snapshot.

## Written for this starter

`src/kit/arena/arena.js`, `src/kit/camera/camera.js`, `src/kit/actors/player.js`, `src/kit/weapons/weapons.js`, `src/kit/enemies/enemies.js`, `src/kit/pickups/pickups.js`, `src/kit/hud/hud.js`, `src/kit/round/round.js`, `src/kit/bot/autoplay.js`, `src/main.js`, everything in `src/game/`, `playtest.plan.mjs`.
