# Notices: starters/flight

Code and assets in this starter that came from elsewhere. The same rows are in `third_party/NOTICES.md`.

## arjunemirchandani/skyward-flight-simulator (MIT)

- Source: https://github.com/arjunemirchandani/skyward-flight-simulator
- Commit: 5fde882dc8fe33bd3067504c8181c85747b6fb60
- Licence: MIT, verified from the repository's `LICENSE` (text below)
- The source is one `index.html`. Nothing was copied whole; the parts below were rewritten as modules with new names, new tuning and a new scale (the source's world is 14 km and 340 u/s; this one is 7 km and 150 m/s).
- Not taken: the name, callsign, station and island names, radio chatter, missions, airfields, runways, landings and grading, logbook, weather, wind and turbulence, traffic, minimap, instrument panel, the ring course and its look, the HUD, the aircraft model, the sounds.

| File here (`starters/flight/src/`) | Part of `index.html` there | What changed |
|---|---|---|
| `kit/flight/model.js` | `updateFlight()` and its tunables (`MAX_SPEED`, `STALL_SPEED`, `THRUST_K`, `GRAVITY`, `PITCH_RATE`, `ROLL_RATE`, `YAW_RATE`, `BANK_TURN`) | Same control laws (rate controls with airspeed authority, self-levelling when upright, bank-to-turn coupling, throttle target plus gravity energy trade, stall sink and nose drop, soft boundary, ceiling). Reads a shared control map instead of a key set; wind, turbulence, ground roll, traffic and landing removed; rescaled. |
| `kit/flight/chase-camera.js` | `updateCamera()` chase mode | Same follow, partial roll blend, look-ahead and speed FOV; cockpit and close modes removed; ground clamp and a hold-on-crash view added. |
| `kit/world/heightfield.js` | `hash2`, `noise2`, `fbm`, `baseTerrain()` | Same continent-threshold islands, ridges only on land, surface detail; seeded, rescaled, sea at the map edge, baked into a grid with bilinear lookup and `maxAlong()`. Airfield levelling removed. |
| `kit/world/terrain.js` | `terrainColor()` (idea only) | Palette by height and slope now comes from the game; the low-sun shadow bake, cavity term and detail textures are new. |
| `kit/world/sky.js`, `kit/world/clouds.js` | sky dome, cloud billboards (ideas only) | Written new: horizon band, sun glow, high cloud layer, sun-lit cumulus texture. |

```
MIT License

Copyright (c) 2026 Arjune Mirchandani

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

## From this repository's `starters/fps-three` (itself partly from mshumer/Claude-of-Duty, MIT; see `third_party/NOTICES.md`)

| File here | File there | What changed |
|---|---|---|
| `kit/core/registry.js`, `kit/core/rng.js` | same | Unchanged (both originally Claude-of-Duty). |
| `kit/audio/dsp.js` | same | Unchanged (originally Claude-of-Duty). |
| `kit/textures/textures.js` | same | Unchanged. |
| `kit/render/render.js` | same | GTAO's normal/depth pass also hides sprites and transparent meshes (otherwise clouds, glows and trails draw dark rectangles in the sky). Worth porting back to fps-three. |
| `kit/core/engine.js` | same | Uses the flight control map instead of the FPS input; configurable near/far; `fastForward()` and `skipRender`; float-safe substep count. |
| `kit/core/config.js` | same | Flight quality tiers (terrain segments, cloud and particle counts). |
| `kit/audio/audio.js` | same | Gun voices removed; `tone`, `noiseHit`, `thud` exported; a running bed with `setBed()`; mute. |
| `kit/debug/api.js` | same | Snapshot and shots for a flight round. |

## Assets from Patch's library (patch.gg)

Each in its own folder under `src/game/assets/`, imported by `src/game/props.js` or `src/game/world.js` and inlined by the build. Files are as downloaded (sha256 checked against the API).

| Folder | Patch id | Title | Creator | Licence | Source URL | Variant used |
|---|---|---|---|---|---|---|
| `tree-broadleaf/tree_default.glb` | `kenney:nature-kit/tree_default.glb` | Tree default | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | src (9 KB, 114 triangles) |
| `tree-pine/tree_pineRoundA.glb` | `kenney:nature-kit/tree_pineRoundA.glb` | Tree pine round a | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | src |
| `tree-palm/tree_palmTall.glb` | `kenney:nature-kit/tree_palmTall.glb` | Tree palm tall | Kenney | CC0-1.0 | https://kenney.nl/assets/nature-kit | src |
| `lighthouse/old-lighthouse.glb` | `polyfork:old-lighthouse-48ca6c` | Old Lighthouse | Polyfork | CC-BY-4.0 | https://polyfork.dev/asset/old-lighthouse-48ca6c | web/src (0.33 MB, 2847 triangles) |
| `sky-hdri/industrial_sunset_02_puresky_1k_preview.hdr` | `polyhaven:industrial_sunset_02_puresky` | Industrial Sunset 02 (Pure Sky) | Jarod Guest, Sergej Majboroda | CC0-1.0 | https://polyhaven.com/a/industrial_sunset_02_puresky | preview (512 x 256 HDR, 0.52 MB), used only as image-based light |

Credit strings, as Patch gives them:

- "Tree default" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×2.5 to real-world size (calibrated on the camp bed (0.75 units; about 1.9 m)).
- "Tree pine round a" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×2.5 to real-world size (calibrated on the camp bed (0.75 units; about 1.9 m)).
- "Tree palm tall" by Kenney (Kenney, https://kenney.nl/assets/nature-kit), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: re-packed GLB, pivot moved to the bottom centre, credit added to the file, scaled ×2.5 to real-world size (calibrated on the camp bed (0.75 units; about 1.9 m)).
- Old Lighthouse by Polyfork (https://polyfork.dev/asset/old-lighthouse-48ca6c), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- "Industrial Sunset 02 (Pure Sky)" by Jarod Guest and Sergej Majboroda (Poly Haven, https://polyhaven.com/a/industrial_sunset_02_puresky), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: 1K HDR selected, tonemapped JPEG background added, credit added to each file.

Changes made here: the trees are scaled and re-tinted per instance in `props.js` (materials replaced by flat-shaded ones), the lighthouse is scaled ×2.4 with a lamp glow added above it, and the HDRI is rotated so its sun matches the game's. The CC BY lighthouse is credited on the title screen (`config.text.credits`).

## Written for this repository

`index.html`, `src/main.js`, `src/game/*.js`, `src/kit/flight/controls.js`, `autopilot.js`, `round.js`, `director.js`, `src/kit/world/water.js`, `environment.js`, `scatter.js`, `src/kit/fx/particles.js`, `src/kit/hud/*`, `playtest.plan.mjs`.

## three.js

`three` and its `examples/jsm` passes and loaders (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass, GLTFLoader, HDRLoader) are bundled from `node_modules/three` (r180, MIT), already listed in `third_party/NOTICES.md`.
