# Notices: starters/space-shooter

Code and assets in this starter that came from elsewhere. The same rows are in `third_party/NOTICES.md`.

## bop-del/meridian-line (MIT)

- Source: https://github.com/bop-del/meridian-line
- Commit: bf4dc45a7d45c3f570650f2b8e8d6b189b6f94aa
- Licence: MIT, verified from the repository's `LICENSE` at that commit (text below)
- Taken: the rail camera and the trench construction technique, rewritten as new modules with new tuning. No file was copied whole.
- Not taken: the name, every character, place, level, boss, faction and line of dialogue, the story and comms, the three levels and their scripts, the music and sound design, the HUD and screens, the ship and enemy models, the weapons, bombs, charge shot, barrel roll, escorts, pickups and difficulty modes.

| File here (`starters/space-shooter/src/`) | File there | What changed |
|---|---|---|
| `kit/rail/rail-camera.js` | `src/core/cameraRig.js` | Same rail-local critically damped springs, follow and look fractions of the ship offset, look-ahead, never-inside-or-ahead-of-the-ship rule, roll into the bank, boost push-in and the slow orbit pose for the title. Cinema layers, intro flythrough, death-cam blends and the feel registry removed; a smooth shake and a hold view added. |
| `kit/rail/ship.js` | `src/core/rail.js` (rail speed ramp) and the rail, bounds and steering numbers in `src/config.js` (base speed 40, bounds 14 x 8, steer speeds 32 / 23) | The rail as an anchor down -Z whose speed eases toward base or boost; the ship steering inside a screen box around it. Rewritten: one class, boost meter, twin guns that converge on an aim point that leads the offset. |
| `game/trench.js` | `src/world/levels/foundry.js` (technique only) | Wall blocks either side of a corridor at a half width with outward jitter and varied height, HDR light seams on the inner faces that bloom, warm runoff strips low down, beams across the top, additive light columns beyond the walls, a cold fill light ahead of and a furnace light under the ship that travel with it. Written new: built once and merged per chunk instead of streamed, world-space panel textures with window dashes and grid lines drawn in code, the setback skyline, the baked nebula sky with the far glow, the layout. |

```
MIT License

Copyright (c) 2026 Boris Diebold

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

## From this repository's `starters/flight` (itself partly from `starters/fps-three` and mshumer/Claude-of-Duty, MIT; see `third_party/NOTICES.md`)

| File here | File there | What changed |
|---|---|---|
| `kit/core/registry.js`, `kit/core/rng.js` | same | Unchanged (both originally Claude-of-Duty). |
| `kit/audio/dsp.js` | same | Unchanged (originally Claude-of-Duty). |
| `kit/audio/audio.js` | same | Unchanged (from fps-three, adapted in flight). |
| `kit/textures/textures.js` | same | Unchanged (from fps-three). |
| `kit/render/render.js` | same | Unchanged: flight's copy, whose GTAO normal/depth pass hides points, sprites and transparent or non-depth-writing meshes, so glows, trails, bolts' halos and the sky are never drawn as dark slabs. |
| `kit/fx/particles.js` | same | Unchanged. |
| `kit/world/scatter.js` | same | Unchanged (only `loadModel` is used). |
| `kit/core/engine.js` | same | Imports `../rail/controls.js` instead of the flight controls. |
| `kit/core/config.js` | same | Rail-shooter quality tiers (no shadows; chunk, light and particle counts), FOV 68, far 3000. |
| `kit/rail/controls.js` | `kit/flight/controls.js` | The mouse button writes Space (fire); touch layout is a steering stick plus FIRE and BOOST buttons. |
| `kit/hud/hud.js`, `kit/hud/hud.css` | `kit/hud/*` | Screens, toast and type scale kept; readouts (score, run or target bar, hull, boost, two reticles) and the cold palette are new; end screens fade in after a beat. |
| `kit/debug/api.js` | same | Snapshot and shots for a rail round. |

## Assets from Patch's library (patch.gg)

Each in its own folder under `src/game/assets/`, imported by `src/game/art.js` and inlined by the build. Files are the `web` variant as published (uncompressed GLB, no meshopt, no textures; vertex colours).

| Folder | Patch id | Title | Creator | Licence | Source URL | Variant used |
|---|---|---|---|---|---|---|
| `fighter/agile-starfighter-89805f.glb` | `polyfork:agile-starfighter-89805f` | Agile Starfighter | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/agile-starfighter-89805f | web (0.43 MB, 3707 triangles) |
| `raider/interceptor-9d2289.glb` | `polyfork:interceptor-9d2289` | Interceptor | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/interceptor-9d2289 | web (0.41 MB, 3570 triangles) |
| `turret/defense-turret-12ba8d.glb` | `polyfork:defense-turret-12ba8d` | Defense Turret | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/defense-turret-12ba8d | web (0.08 MB, 636 triangles) |

Credit strings, as Patch gives them:

- Agile Starfighter by Polyfork (https://polyfork.dev/asset/agile-starfighter-89805f), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- Interceptor by Polyfork (https://polyfork.dev/asset/interceptor-9d2289), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- Defense Turret by Polyfork (https://polyfork.dev/asset/defense-turret-12ba8d), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).

Changes made here (in `src/game/art.js`, at load; the files are untouched): each model is merged into one centred mesh, turned nose-down -Z, scaled, given a metal finish over its vertex colours and a hit flash; engine glows, running lights, a bracket for the turret and a light on the player's ship are added. All three are credited on the title screen (`config.text.credits`).

## Written for this repository

`index.html`, `src/main.js`, `src/game/*.js` (except the technique noted for `trench.js`), `src/kit/rail/round.js`, `bot.js`, `director.js`, `src/kit/fx/bolts.js`, `playtest.plan.mjs`.

## three.js

`three` and its `examples/jsm` passes, loaders and utilities (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass, GLTFLoader, BufferGeometryUtils) are bundled from `node_modules/three` (r180, MIT), already listed in `third_party/NOTICES.md`.
