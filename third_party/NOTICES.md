# Third-party notices

Code here came from projects under MIT or Apache-2.0, and each licence is reproduced below. Downloaded models, textures and skies are CC0 or CC BY 4.0, listed per game or starter with their credit line; CC BY credits also appear on that game's title screen. Links to other people's games and repositories (`gallery/`, `prompts/`, `references/`) copy no code. Prompts are quoted with credit to their authors.

## Copied from mshumer/Claude-of-Duty (MIT)

Source: https://github.com/mshumer/Claude-of-Duty at commit d9b237b. Code unchanged; one comment in `character.js` no longer names a game.

| File here | File there |
|---|---|
| `starters/fps-three/src/kit/core/rng.js` | `src/core/rng.js` |
| `starters/fps-three/src/kit/core/registry.js` | `src/core/registry.js` |
| `starters/fps-three/src/kit/physics/bvh.js` | `src/physics/bvh.js` |
| `starters/fps-three/src/kit/physics/math.js` | `src/physics/math.js` |
| `starters/fps-three/src/kit/physics/surfaces.js` | `src/physics/surfaces.js` |
| `starters/fps-three/src/kit/physics/character.js` | `src/physics/character.js` |
| `starters/fps-three/src/kit/player/springs.js` | `src/player/springs.js` |
| `starters/fps-three/src/kit/audio/dsp.js` | `src/audio/dsp.js` |
| `tools/imagediff.mjs` | `tools/imagediff.mjs` |
| `starters/fps-three/src/kit/materials/` (whole folder: `index.js`, `generator.js`, `library.js`, `shader.js`, `masks.js`, `glsl/*`) | `src/materials/` (the dev pages `preview.html`, `preview.js`, `shoot.mjs` left out) |
| `starters/fps-three/src/kit/viewmodel/geometry.js`, `parts.js`, `hands.js`, `clips.js`, `mathx.js` | `src/weapons/` same names |
| `starters/fps-three/src/kit/viewmodel/models/rifle.js`, `smg.js`, `pistol.js` | `src/weapons/models/` same names; only the display labels changed to Carbine, Compact, Sidearm |

Copied with `node tools/vendor.mjs`, which prints the source commit.

## Patched from mshumer/Claude-of-Duty (MIT)

| File here | From | What changed |
|---|---|---|
| `starters/fps-three/src/kit/viewmodel/viewmodel.js` | `src/weapons/viewmodel.js` | Held items without a magazine, optic or support hand; per-item hand poses; an additive game layer (`extra`) for melee swings and throws; reload clips only for items that have a magazine |
| `starters/fps-three/src/kit/viewmodel/materials.js` | `src/weapons/materials.js` | `register(key, def)` so a game adds its own held-item and hand surfaces; plain materials at quality low |
| `starters/fps-three/src/kit/materials/index.js` | `src/materials/index.js` | At quality low, a plain material on the baked maps instead of the full surface shader |

## Derived from mshumer/Claude-of-Duty (MIT)

Adapted and reduced; the original theme and every named game or weapon reference removed.

| File here | Derived from | What changed |
|---|---|---|
| `starters/fps-three/src/kit/core/engine.js` | `src/core/engine.js` | Per-frame input hook, fixed-step option for recording |
| `starters/fps-three/src/kit/core/input.js` | `src/core/input.js` | Drag-to-look fallback, touch, fire key; gamepad removed |
| `starters/fps-three/src/kit/core/config.js` | `src/core/config.js` | Rewritten around three quality tiers |
| `starters/fps-three/src/kit/player/player.js` | `src/player/movement.js`, `camera.js`, `health.js` | Condensed; prone, lean, mantle and slide removed |
| `starters/fps-three/src/kit/audio/shot.js` | `src/audio/weapons.js` | Generic profiles, distance model removed |
| `starters/fps-three/src/kit/debug/api.js` | `src/dev/shots.js`, `src/main.js` | The screenshot and lockstep handshake, rewritten |
| `tools/lib/harness.mjs` | `tools/capture.mjs`, `tools/baseline.mjs` | Browser setup and capture handshake, now with software rendering and a local server |
| `tools/capture.mjs` | `tools/capture.mjs`, `tools/baseline.mjs` | Tests the built file; each shot gets a fresh page |
| `tools/playtest.mjs` | `tools/playtest.mjs` | Grew from a smoke test into a full scripted round |
| `tools/profile.mjs` | `tools/profile.mjs` | Same distribution and hitch logic, generic driver |
| `tools/record.mjs` | `tools/demo.mjs` | Same frame-stepped capture; sound now rendered from the game's own voices |
| `tools/lib/bot-driver.js` | `tools/demo-driver.js` | Rewritten as a small generic player |
| `starters/fps-three/src/kit/viewmodel/index.js` | `src/weapons/defs.js` (pose and recoil numbers), `src/render/index.js` (viewmodel light directions) | Handling presets for three firearms plus new presets for one-hand, two-hand and thrown items; a view-space light rig at fixed exposure |
| `starters/fps-three/src/kit/render/render.js` | `src/render/` (ideas only: AO before the viewmodel pass, split grade) | Uses three's own GTAO pass; sun shafts and the grade shader are written here |

Everything else in `starters/fps-three` and `tools/` was written for this repository.

```text
MIT License

Copyright (c) 2026 mshumer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Copied unchanged from gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0)

Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills

`third_party/skills/threejs-scene-setup`, `threejs-materials-lighting`, `game-feel`, `level-design`, `audio-design`; added at commit dcf3bbb: `camera-systems`, `game-ai`, `procedural-gen`, `input-systems` (from `skills/disciplines/`).

The project's NOTICE file reads:

```text
awesome-gamedev-agent-skills
Copyright 2026 Abhishek Barali and the awesome-gamedev-agent-skills contributors

This product is licensed under the Apache License, Version 2.0 (see LICENSE).

All skills in this repository are original works. They were authored from primary
documentation (engine and framework docs, language references, and platform
specifications). Third-party sources and other skill collections were studied for
general patterns only; no text or code was copied from them.

Game engine, framework, and platform names referenced in this repository
(including but not limited to Godot, Unity, Unreal Engine, Phaser, PixiJS,
three.js, Babylon.js, Bevy, GameMaker, LÖVE, and MonoGame) are trademarks of
their respective owners and are used for identification and descriptive purposes
only. Their use does not imply any affiliation with or endorsement by those owners.
```

The full licence is at `third_party/licenses/Apache-2.0.txt`.

## Copied unchanged from Donchitos/Claude-Code-Game-Studios (MIT)

Source: https://github.com/Donchitos/Claude-Code-Game-Studios at commit abc0de7. Copyright (c) 2026 Donchitos; the licence is `third_party/studio-genres/LICENSE`.

| File here | File there |
|---|---|
| `third_party/studio-genres/chipsets/*.md` (69 genre sheets), `chipsets.yaml`, `art-direction.md`, `mashups.md`, `sources.md` | `.claude/genres/` same names |

Its 49 agents were read and not taken: each asks for approval before writing, which this repo's skills are built not to do.

## starters/flight: adapted from arjunemirchandani/skyward-flight-simulator (MIT)

Source: https://github.com/arjunemirchandani/skyward-flight-simulator at commit 5fde882 (one `index.html`). Copyright (c) 2026 Arjune Mirchandani; MIT, licence text in `starters/flight/NOTICES.md`. Rewritten as modules with new names and scale; no name, callsign, place, course, HUD or art taken.

| File here | Part of `index.html` there | What changed |
|---|---|---|
| `starters/flight/src/kit/flight/model.js` | `updateFlight()` and its tunables | Same control laws; shared control map, rescaled; wind, turbulence, ground roll, traffic and landings removed |
| `starters/flight/src/kit/flight/chase-camera.js` | `updateCamera()` chase mode | Other modes removed; ground clamp and crash hold added |
| `starters/flight/src/kit/world/heightfield.js` | `hash2`, `noise2`, `fbm`, `baseTerrain()` | Seeded, rescaled, sea at the edge, baked grid; airfields removed |
| `starters/flight/src/kit/world/terrain.js`, `sky.js`, `clouds.js` | `terrainColor()`, sky dome, cloud billboards (ideas only) | Written new |

Also in `starters/flight/src/kit`, copied or adapted from `starters/fps-three`: `core/registry.js`, `core/rng.js`, `audio/dsp.js` (Claude-of-Duty, unchanged), `textures/textures.js` (unchanged), `render/render.js`, `core/engine.js`, `core/config.js`, `audio/audio.js`, `debug/api.js` (adapted). Details in `starters/flight/NOTICES.md`.

## starters/flight: assets from Patch's library (CC0 and CC BY)

Downloaded from patch.gg, files as published, one folder each under `starters/flight/src/game/assets/`.

| Asset | Patch id | Creator | Licence | URL | Credit |
|---|---|---|---|---|---|
| Tree default | `kenney:nature-kit/tree_default.glb` | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | "Tree default" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×2.5 to real-world size (calibrated on the camp bed (0.75 units; about 1.9 m)). |
| Tree pine round a | `kenney:nature-kit/tree_pineRoundA.glb` | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | "Tree pine round a" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: as above. |
| Tree palm tall | `kenney:nature-kit/tree_palmTall.glb` | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | "Tree palm tall" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: as above. |
| Old Lighthouse | `polyfork:old-lighthouse-48ca6c` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/old-lighthouse-48ca6c | Old Lighthouse by Polyfork (https://polyfork.dev/asset/old-lighthouse-48ca6c), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). Credited on the game's title screen. |
| Industrial Sunset 02 (Pure Sky) | `polyhaven:industrial_sunset_02_puresky` | Jarod Guest, Sergej Majboroda | CC0-1.0 | https://polyhaven.com/a/industrial_sunset_02_puresky | "Industrial Sunset 02 (Pure Sky)" by Jarod Guest and Sergej Majboroda (Poly Haven, https://polyhaven.com/a/industrial_sunset_02_puresky), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: 1K HDR selected, tonemapped JPEG background added, credit added to each file. |

## starters/space-shooter: adapted from bop-del/meridian-line (MIT)

Source: https://github.com/bop-del/meridian-line at commit bf4dc45a7d45c3f570650f2b8e8d6b189b6f94aa. Copyright (c) 2026 Boris Diebold; MIT, verified from its `LICENSE`, licence text in `starters/space-shooter/NOTICES.md`. Rewritten as new modules; no name, character, place, level, boss, dialogue, music, HUD or model taken.

| File here | File there | What changed |
|---|---|---|
| `starters/space-shooter/src/kit/rail/rail-camera.js` | `src/core/cameraRig.js` | Same rail-local damped springs, follow / look fractions, minimum-distance rule, bank roll, boost push and orbit pose; cinema layers, intro and feel registry removed; shake and hold view added |
| `starters/space-shooter/src/kit/rail/ship.js` | `src/core/rail.js`, rail / bounds / steering numbers in `src/config.js` | Rail speed easing toward base or boost and the ship's screen box, rewritten as one class with a boost meter and converging twin guns |
| `starters/space-shooter/src/game/trench.js` | `src/world/levels/foundry.js` (technique only) | Walls either side of a corridor with jitter, blooming HDR seams, beams across, light columns beyond, two lights riding with the ship; built once and merged per chunk, textures, sky and layout new |

Also in `starters/space-shooter/src/kit`, copied or adapted from `starters/flight` (and through it `starters/fps-three` and Claude-of-Duty): `core/*`, `render/render.js` (with the AO fix for transparent objects), `audio/*`, `textures/textures.js`, `fx/particles.js`, `world/scatter.js` (unchanged or lightly adapted), `rail/controls.js`, `hud/*`, `debug/api.js` (adapted). Details in `starters/space-shooter/NOTICES.md`.

## starters/space-shooter: assets from Patch's library (CC BY)

Downloaded from patch.gg, `web` variant as published (uncompressed GLB, vertex colours), one folder each under `starters/space-shooter/src/game/assets/`. All three are credited on the game's title screen.

| Asset | Patch id | Creator | Licence | URL | Credit |
|---|---|---|---|---|---|
| Agile Starfighter | `polyfork:agile-starfighter-89805f` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/agile-starfighter-89805f | Agile Starfighter by Polyfork (https://polyfork.dev/asset/agile-starfighter-89805f), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |
| Interceptor | `polyfork:interceptor-9d2289` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/interceptor-9d2289 | Interceptor by Polyfork (https://polyfork.dev/asset/interceptor-9d2289), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |
| Defense Turret | `polyfork:defense-turret-12ba8d` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/defense-turret-12ba8d | Defense Turret by Polyfork (https://polyfork.dev/asset/defense-turret-12ba8d), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |

Changed here at load (files untouched): merged, centred, turned, scaled, re-materialled over their vertex colours, glows and lights added.

## starters/survival: structure from VictorZakharov/void-harvest-game (MIT)

Source: https://github.com/VictorZakharov/void-harvest-game at commit 8d9109d. MIT, Copyright (c) 2025-2026 Victor Zakharov, verified from its `LICENSE` at that commit. Structure only, rewritten; no code, name, enemy, skill, item, HUD or art taken. The rest of `starters/survival` is `starters/topdown-shooter` (sources above and in its NOTICES) plus new code. canvas-vampire-survivors was not used. Details in `starters/survival/NOTICES.md`.

| File here | File there | What was taken |
|---|---|---|
| `starters/survival/src/kit/horde/spatial.js` | `js/systems/SpatialHash.js` | The per-frame uniform grid idea; rewritten with typed arrays and circle queries |
| `starters/survival/src/kit/round/round.js` | `js/entities/enemy-spawner.js` | Ring spawning inside the map bounds; kind mix and health rising with time; rewritten as a director in fractions of the round |
| `starters/survival/src/kit/gems/gems.js` | `js/entities/item-manager.js` | Experience dropped on death, pulled in by a magnet radius; rewritten, instanced |
| `starters/survival/src/kit/levelup/levelup.js`, `src/kit/arsenal/arsenal.js` | `js/skills.js` | Upgrades as data with a max level and an apply step, three offered per level; rewritten |

## starters/survival: assets from Patch's library (CC0)

Downloaded from patch.gg, `preview` variant, one folder each under `starters/survival/src/game/assets/`. The two GLBs were re-packed without meshopt compression by `games/caveman/scripts/decode-meshopt.mjs` (same geometry and textures). Credited on the title screen.

| Asset | Patch id | Creator | Licence | URL | Credit |
|---|---|---|---|---|---|
| Rock Face 01 | `polyhaven:rock_face_01` | Dario Barresi | CC0-1.0 | https://polyhaven.com/a/rock_face_01 | "Rock Face 01" by Dario Barresi (Poly Haven, https://polyhaven.com/a/rock_face_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| Dead Tree Trunk | `polyhaven:dead_tree_trunk` | Rob Tuytel | CC0-1.0 | https://polyhaven.com/a/dead_tree_trunk | "Dead Tree Trunk" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/dead_tree_trunk), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: as above. |
| Forest Leaves 02 | `polyhaven:forest_leaves_02` | Rob Tuytel | CC0-1.0 | https://polyhaven.com/a/forest_leaves_02 | "Forest Leaves 02" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/forest_leaves_02), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: JPEG maps selected, credit added to each file. 512 px base colour, normal and roughness used. |

## starters/runner: mechanics adapted from omsingh02/bunny (MIT) and juwalbose/ThreeJSEndlessRunner3D (MIT)

Sources, each verified from its `LICENSE` at the pinned commit (licence texts in `starters/runner/NOTICES.md`):
- https://github.com/omsingh02/bunny at commit 7d7ba83f1251f65e51f47cf453bc6e17b048fd47, MIT, Copyright (c) 2025-2026 Om Singh.
- https://github.com/juwalbose/ThreeJSEndlessRunner3D at commit 9c19dc865f1f8c4e1ba2225229fd8630b5b5ab6c, MIT, Copyright (c) 2017 Juwal Bose.

Ideas and numbers rewritten as new modules; no file copied, no name, character, model, HUD, achievement, art or sound taken.

| File here | File there | What was taken |
|---|---|---|
| `starters/runner/src/kit/runner/body.js` | bunny `assets/scripts/modules/PhysicsEngine.js`, `assets/scripts/game.js` (`moveLane`, `jump`) | Lane change as exponential damping toward the target lane; a jump as launch speed and gravity on elapsed time, so it plays the same at any frame rate. Slide, fast drop, buffered presses and stumble are new |
| `starters/runner/src/kit/runner/controls.js` | bunny `assets/scripts/modules/InputController.js` | Swipe rules: 50 px threshold, the longer axis wins, up jumps, a quick tap jumps. Fires on crossing the threshold, writes into the shared control map |
| `starters/runner/src/kit/runner/course.js`, `round.js` | bunny `game.js` (speed ramp), `modules/WorldManager.js` (`updateSpawning`, `createCollectible`) | Speed rising toward a cap; rows of obstacles at an interval that shrinks with speed; pickups kept out of blocked lanes. Laid out per round from a seed in track space instead of spawned on timers |
| `starters/runner/src/kit/runner/course.js` | ThreeJSEndlessRunner3D `src/endlessroller.js` (`addPathTree`) | A row never blocks every lane with something that cannot be jumped |

anafibnshahibul/Neon-Void-Runner-3D-Game (MIT, commit ae6d0f0) was read and nothing taken: its one script calls an external text-to-speech API with a key in the source.

Also in `starters/runner/src/kit`, copied or adapted from `starters/space-shooter` (and through it `starters/flight`, `starters/fps-three` and Claude-of-Duty): `core/*`, `render/render.js` (with the AO fix for transparent objects; a speed-blur pass added), `audio/*`, `textures/textures.js`, `fx/particles.js`, `world/scatter.js` (`loadGltf` and `<img>` texture loading added), `hud/*`, `debug/api.js`, `runner/controls.js` (from `rail/controls.js`). Details in `starters/runner/NOTICES.md`.

## starters/runner: assets from Patch's library (CC0 and CC BY)

Downloaded from patch.gg, `web` variant, one folder each under `starters/runner/src/game/assets/`. No meshopt or Draco. All four are credited on the game's title screen.

| Asset | Patch id | Creator | Licence | URL | Credit |
|---|---|---|---|---|---|
| Rogue hooded (the courier) | `kaykit:adventurers/characters/Rogue_Hooded.glb` | Kay Lousberg (KayKit) | CC0-1.0 | https://kaylousberg.itch.io/kaykit-adventurers | "Rogue hooded" by Kay Lousberg (KayKit, https://kaylousberg.itch.io/kaykit-adventurers), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×0.75 to real-world size, 132 animation clips added from KayKit Character Animations. Changed here: 120 of the 132 clips removed (12 kept), the green cloth in its palette texture recoloured to rust: 3.7 MB to 0.64 MB. |
| Basalt Column Outcrop | `polyfork:basalt-column-outcrop-f1339d` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/basalt-column-outcrop-f1339d | Basalt Column Outcrop by Polyfork (https://polyfork.dev/asset/basalt-column-outcrop-f1339d), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |
| Basalt Boulder | `polyfork:basalt-boulder-a1929c` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/basalt-boulder-a1929c | Basalt Boulder by Polyfork (https://polyfork.dev/asset/basalt-boulder-a1929c), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |
| Lava Rock Pile | `polyfork:lava-rock-pile-d56d19` | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/lava-rock-pile-d56d19 | Lava Rock Pile by Polyfork (https://polyfork.dev/asset/lava-rock-pile-d56d19), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |

The three Polyfork files are untouched; at load they are merged, centred, scaled and given a material over their vertex colours (the spire and rubble glow hot toward their base).

## starters/rhythm: timing and judging approach from ctbot000/rhythm-game (MIT)

Source: https://github.com/ctbot000/rhythm-game at commit 1a42d2e082cdf3890b4fca886484973db49df0e2. Copyright (c) 2026 CTBot000; MIT, verified from its `LICENSE`, licence text in `starters/rhythm/NOTICES.md`. Approach rewritten as new modules; no file or line copied, and no song, chart, name, synth patch, colour or HUD layout taken. The default song "Copper Static" and its chart are written for this repository.

| File here | File there | What was taken |
|---|---|---|
| `starters/rhythm/src/kit/rhythm/clock.js` | `js/game.js` (`songTimeAt`, `songTimeOfEvent`), `js/audio.js` (`latency`) | Song time from `AudioContext.currentTime` minus output latency; a press judged at its event `timeStamp` mapped onto that clock. Fallback sources, the late hand-over to audio and the bot's inverse mapping are new |
| `starters/rhythm/src/kit/rhythm/judge.js` | `js/chart.js` (`JUDGE`, `judgeFor`, `comboMultiplier`, `rawScoreForPerfectRun`, `gradeFor`) | Nested timing windows, a combo multiplier, the score normalised to 1,000,000, grades from weighted accuracy. Tiers, windows, values and grades are new |
| `starters/rhythm/src/kit/rhythm/round.js` | `js/game.js` (`_press`, `_update`, `_registerMiss`), `js/audio.js` (`playTimeline`, `_pump`) | Nearest idle note in the lane inside the outer window; a sweep for missed notes; a life meter; a look-ahead scheduler on the audio clock. Count-in, pass grade and the bot that presses through the lane controls are new |
| `starters/rhythm/src/kit/rhythm/chart.js` | `js/chart.js` (`buildChart`, `laneThresholds`) | The chart cut from the music events, parts in priority order with a minimum gap, lanes from each part's pitch quantiles. Written for a new pattern-based song format |
| `starters/rhythm/src/kit/rhythm/controls.js` | `js/game.js` (`LANE_KEYS`, `_laneForEvent`) | Lanes bound by `KeyboardEvent.code` with a `key` fallback |
| `starters/rhythm/src/kit/rhythm/highway.js` | `js/game.js` (`_burst`) | The idea of a ring and sparks at the receptor on a hit and a lane glow on a press; the 3D highway is new |

Also in `starters/rhythm/src/kit`, copied with `tools/vendor.mjs` from `starters/space-shooter` (and through it `starters/flight`, `starters/fps-three` and Claude-of-Duty): `core/*` (engine imports the lane controls), `render/render.js` (with the AO fix for transparent objects), `audio/*` (`at()` added for beat-timed voices), `fx/particles.js`, `hud/*` (readouts rewritten), `debug/api.js` (rhythm snapshot). Details in `starters/rhythm/NOTICES.md`.

## starters/fps-three: first-person arms and rifle (CC BY 4.0)

`starters/fps-three/src/kit/viewmodel/assets/arms-rifle.glb` is the default carbine's arms, rifle and clips (idle, draw, shot, reload, full reload). Details in `starters/fps-three/NOTICES.md`.

This work is based on "FPS AK-74m animations" (https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) by Cransh (https://sketchfab.com/ccransh) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

Taken from the mirror https://github.com/Ayush-Mohanty/FPS-Arms-3D (`Models/fps_ak-74m_animations/`; that repository says MIT, but the model's own `license.txt` and the glTF's `asset.extras` say CC-BY-4.0, which is what applies). Changed here: textures cut from 4K PNG to 1K WebP (metal-roughness map of the arms and the rifle's specular map dropped, the rifle's ORM map at 512), unused UV sets and tangents removed, meshes simplified to about 60% of their triangles, geometry and rotation keys quantized, walk, run and a second reload clip removed, clips renamed. Credited on the title screen.

## starters/fps-three: bare first-person arms (CC0)

`starters/fps-three/src/kit/viewmodel/assets/arms-bare.glb` is the skin arms behind the `ARMS_BARE` preset (bundled only by games that use it). Details in `starters/fps-three/NOTICES.md`.

| Asset | Author | Licence | URL | What changed |
|---|---|---|---|---|
| "fps arms (rigged only)" and its diffuse texture | para | CC0 1.0 | https://opengameart.org/content/fps-arms-rigged-only | FBX converted to glTF (mesh, skin, skeleton; no clips); the diffuse resized to 1024 px, its black atlas background filled from the skin islands, stored as WebP inside the GLB; welded, pruned, quantized (`KHR_mesh_quantization`): 1.45 MB to 0.26 MB. Posed in code (`bare-arms.js`). No credit required. |

## starters/platformer-2d and starters/topdown-shooter: pixel-art effects from patch-gg/pixelfx (MIT)

Source: https://github.com/patch-gg/pixelfx at commit 044e12a45dc9cc312cec50ee606dfc98afe5adc2. MIT, Copyright (c) 2026 Patch and Copyright (c) 2026 Hugo Duprez. Its NOTICE.md credits Hugo Duprez's Sprite Fusion pixel art VFX (https://www.spritefusion.com/pixel-art-vfx, MIT, Copyright (c) 2026 Hugo Duprez; `src/core/sim.js` and the effects that say so at their top adapt it) and rehan-remade/hollow-crown (MIT, `src/core/act.js`, not copied here). Copied with `tools/vendor.mjs`; its `LICENSE` and `NOTICE.md` go with each copy, in `src/kit/vendor/pixelfx/`. Not taken: the gallery and the Patch Pixel font in `gallery/fonts` (not MIT), the tools, the skill, and the npm package or any Patch installer.

| File here (under each starter's `src/kit/vendor/pixelfx/`) | File there | Starters | What changed |
|---|---|---|---|
| `LICENSE`, `NOTICE.md` | same | both | Nothing |
| `src/core/math.js`, `color.js`, `particles.js`, `shapes.js`, `sim.js`, `painter.js`, `font.js`, `fx.js`, `actor.js` | same | both | Nothing |
| `src/core/index.js` | same | both | The re-exports of `scene.js`, `act.js`, `rig.js`, `poses.js` and `chain.js` removed (those files were not copied; no effect used needs them) |
| `src/fx/spawn/poof.js` | same | platformer-2d | Nothing |
| `src/fx/pickups/collect-burst.js`, `src/fx/pickups/_lib.js` | same | both | Nothing |
| `src/fx/impacts/hit-spark.js` | same | both | Nothing |
| `src/fx/explosions/firework-burst.js`, `firework-rocket.js`, `_lib.js` | same | platformer-2d | Nothing |
| `src/fx/impacts/bullet-impact.js`, `src/fx/impacts/_lib.js` | same | topdown-shooter | Nothing |

The bridges that put the effects in each game were written here: `starters/platformer-2d/src/kit/pixelfx.js` (a view-sized pixel frame drawn over the LittleJS scene as two nearest-neighbour textures) and `starters/topdown-shooter/src/kit/fx/pixelfx.js` (one CanvasTexture per effect on an additive billboard, off by default). Details in each starter's `NOTICES.md`.

## Used as npm dependencies, not copied

| Package | Licence |
|---|---|
| [three](https://github.com/mrdoob/three.js) 0.180.0, bundled into every build | MIT |
| [vite](https://github.com/vitejs/vite) | MIT |
| [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | MIT |
| [playwright](https://github.com/microsoft/playwright) | Apache-2.0 |
| [pngjs](https://github.com/pngjs/pngjs) | MIT |

## Looked at, nothing taken

| Project | Why |
|---|---|
| [riba2534/claude-opus-5-5-demo](https://github.com/riba2534/claude-opus-5-5-demo) | No licence file. Linked and credited only. |
| [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT) | Referred to as the full-studio option. |
| GameGen-Verifier (MIT) | Referred to for deeper verification. |

## Downloaded assets in `games/caveman` (from Patch's free library, https://patch.gg)

Each file sits in its own folder under `games/caveman/src/game/assets/`. The three Poly Haven GLBs were re-packed without meshopt compression by `games/caveman/scripts/decode-meshopt.mjs` (same geometry and textures), because the artifact policy does not allow WebAssembly.

| Patch id | Title | Creator | Licence | Source | Credit |
|---|---|---|---|---|---|
| `polyhaven:boulder_01` | Boulder 01 (preview variant) | Rico Cilliers | CC0-1.0 | https://polyhaven.com/a/boulder_01 | "Boulder 01" by Rico Cilliers (Poly Haven, https://polyhaven.com/a/boulder_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| `polyhaven:rock_face_01` | Rock Face 01 (preview variant) | Dario Barresi | CC0-1.0 | https://polyhaven.com/a/rock_face_01 | "Rock Face 01" by Dario Barresi (Poly Haven, https://polyhaven.com/a/rock_face_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| `polyhaven:dead_tree_trunk` | Dead Tree Trunk (preview variant) | Rob Tuytel | CC0-1.0 | https://polyhaven.com/a/dead_tree_trunk | "Dead Tree Trunk" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/dead_tree_trunk), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| `polyhaven:snow_02` | Snow 02 (1K base colour, preview normal and roughness) | Rob Tuytel | CC0-1.0 | https://polyhaven.com/a/snow_02 | "Snow 02" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/snow_02), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: 1K JPEG maps selected, credit added to each file. |
| `ambientcg:EveningSkyHDRI042A` | Evening Sky HDRI 042 A (1K preview HDR) | ambientCG | CC0-1.0 | https://ambientcg.com/a/EveningSkyHDRI042A | "Evening Sky HDRI 042 A" by ambientCG (ambientCG, https://ambientcg.com/a/EveningSkyHDRI042A), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: 1K EXR converted to HDR, tonemapped JPEG background added, credit added to each file. |
| `polyfork:skull-and-bone-scatter-3dea4c` | Skull and Bone Scatter | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/skull-and-bone-scatter-3dea4c | Skull and Bone Scatter by Polyfork (https://polyfork.dev/asset/skull-and-bone-scatter-3dea4c), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published). |

## Downloaded assets in `games/caveman-v2` (from Patch's free library, https://patch.gg)

Files in `games/caveman-v2/src/game/assets/`. Each is Patch's plain (not meshopt) `web-lod1` or `web-lod2` GLB, repacked by `games/caveman-v2/scripts/shrink-glb.mjs`: geometry untouched, the three 1024 px PNG maps (base colour, normal, roughness) re-encoded as 512 px JPEG (16 px on the far rock, which borrows the near rock's maps). Credited in the game's README and on the title screen's controls line, though CC0 needs no credit.

| Patch id | File (variant) | Creator | Licence | Source | Credit |
|---|---|---|---|---|---|
| `polyhaven:rock_face_01` | `rock-face.glb` (web-lod1, 6,051 tris, 0.33 MB); `rock-face-far.glb` (web-lod2, 2,420 tris, 0.07 MB) | Dario Barresi | CC0-1.0 | https://polyhaven.com/a/rock_face_01 | "Rock Face 01" by Dario Barresi (Poly Haven, https://polyhaven.com/a/rock_face_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| `polyhaven:dead_tree_trunk_02` | `dead-trunk.glb` (web-lod2, 9,964 tris, 0.47 MB) | Jenelle van Heerden, Rico Cilliers | CC0-1.0 | https://polyhaven.com/a/dead_tree_trunk_02 | "Dead Tree Trunk 02" by Jenelle van Heerden and Rico Cilliers (Poly Haven, https://polyhaven.com/a/dead_tree_trunk_02), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |
| `polyhaven:tree_stump_01` | `stump.glb` (web-lod2, 4,920 tris, 0.36 MB) | Rob Tuytel | CC0-1.0 | https://polyhaven.com/a/tree_stump_01 | "Tree Stump 01" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/tree_stump_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. |

The bare arms are the kit's `arms-bare.glb` ("fps arms (rigged only)" by para, CC0), listed above under `starters/fps-three`.
