# Notices: starters/runner

Code and assets in this starter that came from elsewhere. The same rows are in `third_party/NOTICES.md`.

## omsingh02/bunny (MIT)

- Source: https://github.com/omsingh02/bunny
- Commit: 7d7ba83f1251f65e51f47cf453bc6e17b048fd47
- Licence: MIT, verified from the repository's `LICENSE` at that commit (text below)
- Taken: lane logic, jump arc and pacing ideas and numbers, rewritten as new modules. No file was copied.
- Not taken: the name, the bunny, the meadow, the treats, the procedural models, the achievements and toasts, the HUD and menus, the music and sound design, analytics, storage and the PWA parts.

| File here (`starters/runner/src/`) | File there | What changed |
|---|---|---|
| `kit/runner/body.js` | `assets/scripts/modules/PhysicsEngine.js` (`updateLane`, `updateJump`), `assets/scripts/game.js` (`moveLane`, `jump`) | Lane change as exponential damping toward the target lane (bunny: lambda 30 over 2-unit lanes; here 16 over 2.2 m lanes); a jump defined by launch speed and gravity, on elapsed time. Rewritten on a fixed step in track space; height and air time set the arc. Slide, the fast drop when sliding in the air, buffered presses, the stumble and the event list are new. |
| `kit/runner/controls.js` | `assets/scripts/modules/InputController.js` (`setupSwipeGestures`, `handleSwipe`) | 50 px swipe threshold, the longer axis wins, swipe up jumps, a quick tap jumps. Here a swipe fires as soon as it crosses the threshold and writes a tap into the shared control map (with swipe down to slide). |
| `kit/runner/round.js` (`speedAt`), `kit/runner/course.js` | `assets/scripts/game.js` (speed toward a difficulty cap), `assets/scripts/modules/WorldManager.js` (`updateSpawning`, `createCollectible`) | Speed rising toward a cap; obstacles at an interval that shrinks as you speed up; pickups kept out of lanes an obstacle blocks. Here the course is laid out once per round from a seed, in track space, by distance and travel time instead of timers. |

```
MIT License

Copyright (c) 2025-2026 Om Singh

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

## juwalbose/ThreeJSEndlessRunner3D (MIT)

- Source: https://github.com/juwalbose/ThreeJSEndlessRunner3D
- Commit: 9c19dc865f1f8c4e1ba2225229fd8630b5b5ab6c
- Licence: MIT, verified from the repository's `LICENSE` at that commit (text below)
- Taken: one pacing rule, from `src/endlessroller.js` (`addPathTree`): a row blocks one lane and sometimes a second, never all of them. In `kit/runner/course.js` a row never blocks every lane with something that cannot be jumped. No code copied.
- Not taken: the rolling-sphere world, the ball, the trees, the explosion, the scene.

```
MIT License

Copyright (c) 2017 Juwal Bose

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

## anafibnshahibul/Neon-Void-Runner-3D-Game (MIT): read, nothing taken

Commit ae6d0f0d7e392e8a1815f8b61199268505941dbc, MIT (Copyright (c) 2026 Anaf Ibn Shahibul), verified from its `LICENSE`. Its single script (`js/main.js`) spawns boxes at random x and calls an external text-to-speech and text API with a key embedded in the source; nothing in it beats what the kit already does, so nothing was copied.

## From this repository's `starters/space-shooter` (itself from `starters/flight`, `starters/fps-three` and mshumer/Claude-of-Duty, MIT; see `third_party/NOTICES.md`)

| File here | File there | What changed |
|---|---|---|
| `kit/core/registry.js`, `kit/core/rng.js` | same | Unchanged (both originally Claude-of-Duty). |
| `kit/audio/dsp.js`, `kit/audio/audio.js` | same | Unchanged. |
| `kit/textures/textures.js`, `kit/fx/particles.js` | same | Unchanged. |
| `kit/core/engine.js` | same | Imports `../runner/controls.js`. |
| `kit/core/config.js` | same | Runner quality tiers: shadows on medium and high, speed blur, view distance, scatter density. |
| `kit/render/render.js` | same | The AO fix that keeps sprites, points and transparent meshes out of GTAO's normal pass kept; a radial speed-blur pass and `setSpeed()` added (written here). |
| `kit/world/scatter.js` | same | `loadGltf()` added (scene and clips); embedded images load through `<img>` (as `starters/survival` does), because `fetch()` of a `blob:` URL is blocked by the artifact page's policy. |
| `kit/runner/controls.js` | `kit/rail/controls.js` | Presses counted as edges (`take()`), so a tap between two slow frames still counts; swipes instead of a stick; the mouse button removed. |
| `kit/hud/hud.js`, `kit/hud/hud.css` | `kit/hud/*` | Screens, toast and change-only writes kept; the readouts (cinders and chain, distance and goal bar, hearts), the serif display face and the warm palette are new. |
| `kit/debug/api.js` | same | Snapshot for a runner round, `god(on)`, shots placed in track space. |

## Assets from Patch's library (patch.gg)

Each in its own folder under `src/game/assets/`, imported with `?url` and inlined by the build. `web` variant; no meshopt or Draco.

| Folder | Patch id | Title | Creator | Licence | Source URL | Variant used |
|---|---|---|---|---|---|---|
| `courier/rogue-hooded-runner.glb` | `kaykit:adventurers/characters/Rogue_Hooded.glb` | Rogue hooded | Kay Lousberg (KayKit) | CC0-1.0 | https://kaylousberg.itch.io/kaykit-adventurers | web (3.72 MB, 7185 triangles, 132 clips), reduced here to 0.64 MB |
| `outcrop/basalt-column-outcrop-f1339d.glb` | `polyfork:basalt-column-outcrop-f1339d` | Basalt Column Outcrop | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/basalt-column-outcrop-f1339d | web (0.05 MB, 408 triangles) |
| `boulder/basalt-boulder-a1929c.glb` | `polyfork:basalt-boulder-a1929c` | Basalt Boulder | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/basalt-boulder-a1929c | web (0.08 MB, 718 triangles) |
| `rubble/lava-rock-pile-d56d19.glb` | `polyfork:lava-rock-pile-d56d19` | Lava Rock Pile | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/lava-rock-pile-d56d19 | web (0.10 MB, 866 triangles) |

Credit strings, as Patch gives them:

- "Rogue hooded" by Kay Lousberg (KayKit, https://kaylousberg.itch.io/kaykit-adventurers), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×0.75 to real-world size (calibrated on its Barbarian (2.4 units, 1.8 m), on KayKit's character scale), 132 animation clips added from KayKit Character Animations (same rig, matched by bone name).
- Basalt Column Outcrop by Polyfork (https://polyfork.dev/asset/basalt-column-outcrop-f1339d), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- Basalt Boulder by Polyfork (https://polyfork.dev/asset/basalt-boulder-a1929c), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- Lava Rock Pile by Polyfork (https://polyfork.dev/asset/lava-rock-pile-d56d19), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).

Changes made here:
- The courier file: 120 of the 132 clips removed (kept: Idle_A, Running_A, Running_B, Jump_Start, Jump_Idle, Jump_Land, Jump_Full_Short, Dodge_Forward, Hit_A, Death_A, Cheering, Crouching), unused data pruned, and the green cloth in its palette texture recoloured to rust (hue shift of green texels), by `scripts/pack-runner.mjs` then `scripts/recolor.mjs` (gltf-transform and sharp; the output is byte-for-byte reproducible from Patch's `web` file). At load: scaled to 1.75 m, turned to face down the road, a rim of light added to its material, a lantern added to its left hand.
- The Polyfork files are untouched. At load (`src/game/art.js`, `src/game/world.js`) each is merged, centred, scaled to its role and given a material over its vertex colours; the spire and rubble glow hot toward their base.

All four are credited on the title screen (`config.text.credits`).

## Written for this repository

`index.html`, `src/main.js`, `src/game/*.js`, `src/kit/runner/track.js`, `round.js`, `course.js`, `bot.js`, `camera.js`, `director.js` (the parts not noted above), `src/kit/fx/speedlines.js`, the speed-blur pass in `src/kit/render/render.js`, `playtest.plan.mjs`.

## three.js

`three` and its `examples/jsm` passes, loaders and utilities (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass, GLTFLoader, BufferGeometryUtils) are bundled from `node_modules/three` (r180, MIT), already listed in `third_party/NOTICES.md`.
