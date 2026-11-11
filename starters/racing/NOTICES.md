# Notices: starters/racing

Code in this starter adapted from open-licence projects. The lead merges this file into `third_party/NOTICES.md`.

## bridge-mind/turbo-kart-rush

- Source: https://github.com/bridge-mind/turbo-kart-rush
- Commit: 6c0456c7642447eae29e0832e7e542fec07ec07d
- Licence: MIT, verified from the repository's `LICENSE` (text below)
- Copied with `node tools/vendor.mjs --from=.scratch/src/genres/turbo-kart-rush/src --to=starters/racing/src/kit ...`
- Not taken: the game name, the track definitions (`src/track/tracks/*`), the character roster (`src/kart/roster.ts`), the menus, character and track select, loading screen, pause menu, results screen and their stylesheet.

| File here (`starters/racing/src/`) | File there (`src/`) | What changed |
|---|---|---|
| `kit/core/types.ts` | `core/types.ts` | Item type names renamed (see below). Added optional `CharacterDef.number`, `TrackDefinition.sponsors`, `.title`, `.roadRoughness`, `EnvironmentDef.clouds`. |
| `kit/core/constants.ts` | `core/constants.ts` | `GAME_TITLE` is set by the game through `setGameTitle()` instead of a fixed product name. |
| `kit/core/events.ts` | `core/events.ts` | Event names follow the item renames (`item:orbBounce`, `item:shock`, `item:cometLaunch`, `kart:overdriveStart/End`). |
| `kit/core/math.ts` | `core/math.ts` | Unchanged. |
| `kit/kart/Kart.ts` | `kart/Kart.ts` | Item renames; the invincibility visual is a mint pulse instead of a cycling rainbow; header comment no longer names another game. |
| `kit/kart/KartModel.ts` | `kart/KartModel.ts` | Race number comes from `CharacterDef.number` instead of the roster index (the roster is no longer imported). |
| `kit/kart/InputManager.ts` | `kart/InputManager.ts` | Added `virtual`, a third input device (touch controls and the autoplay bot) merged with keyboard and gamepad. |
| `kit/ai/AIDriver.ts` | `ai/AIDriver.ts` | Item renames; added `fullThrottle` (no rubber-band speed cap) for the autoplay bot. |
| `kit/items/ItemManager.ts` | `items/ItemManager.ts` | Item renames; new item table without the leader-seeking and shrink-everyone items; pickups are faceted crystals with a glowing core instead of question-mark boxes; softer pickup shader. |
| `kit/items/itemVisuals.ts` | `items/itemVisuals.ts` | Rewritten: every icon and 3D mesh is new art (oil slick, puck, drone, comet crystal, nitro canister, hex core, contact mine, shock rings). Cache helpers and exports kept. |
| `kit/track/Track.ts`, `Centerline.ts`, `TerrainField.ts` | `track/…` | Unchanged. |
| `kit/track/textures.ts` | `track/textures.ts` | Neon billboard words changed to generic words. |
| `kit/track/builders/props.ts` | `track/builders/props.ts` | Sponsor boards can come from `TrackDefinition.sponsors`; comment no longer names another game. |
| `kit/track/builders/road.ts` | `track/builders/road.ts` | Road roughness can come from `TrackDefinition.roadRoughness`. |
| `kit/track/builders/sky.ts` | `track/builders/sky.ts` | Added an optional fbm cloud layer lit from the sun side. |
| `kit/track/builders/{animated,barriers,context,decor,landmarks,terrain}.ts` | same | Unchanged. |
| `kit/audio/AudioEngine.ts` | `audio/AudioEngine.ts` | Item renames; counts one-shot sounds in `played`; exposes `state`, `output`, `context`. |
| `kit/audio/sfx.ts`, `music.ts` | same | Item renames only (`buildOverdriveJingle`). |
| `kit/audio/engine.ts`, `synth.ts` | same | Unchanged. |
| `kit/fx/ParticleSystem.ts` | `fx/ParticleSystem.ts` | Item renames; slick and projectile particle colours follow the new art. |
| `kit/fx/PostFX.ts` | `fx/PostFX.ts` | Bloom, AO and light shafts switchable per quality; added GTAO, the sun-shaft pass and a display grade (the last two after `starters/fps-three/src/kit/render/render.js`); `setLook()`, `setSunDirection()`, `calm`. |
| `kit/fx/shaders.ts` | `fx/shaders.ts` | Unchanged. |
| `kit/race/RaceManager.ts` | `game/RaceManager.ts` | Unchanged. |
| `kit/race/FollowCamera.ts` | `game/FollowCamera.ts` | Chase distance, height and field of view brought in closer; item rename. |
| `kit/ui/HUD.ts` | `ui/HUD.ts` | Item labels and colours for the new items. Restyled entirely by `kit/style.css`. |
| `kit/ui/Minimap.ts`, `dom.ts`, `toast.ts` | `ui/…` | Unchanged. |
| `kit/race/director.js` | `game/Game.ts` | Adapted: menus, loading and pause removed; title over an attract race; won/lost by finishing place; autoplay bot through the input device; fixed-step `step()` for lockstep captures; quality presets; `fastForward()`. |

Item renames applied across the kit (identifiers, strings and comments): banana → slick, green shell → bolt (puck), red shell → seeker, blue shell → comet, mushroom → nitro, golden mushroom → gold_nitro, star → overdrive, lightning → shock, bob-omb → mine, shell → orb.

Written for this repository (no outside source): `index.html`, `src/main.js`, `src/game/*`, `src/kit/debug/api.js` (after `starters/fps-three/src/kit/debug/api.js`), `src/kit/ui/screens.js`, `src/kit/track/dressing.js`, `src/kit/style.css`, `playtest.plan.mjs`.

### Licence text

```
MIT License

Copyright (c) 2026 BridgeMind

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

## three.js

`three` and its `examples/jsm` post-processing passes (EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, GTAOPass, BufferGeometryUtils) are bundled from `node_modules/three` (r180, MIT), already listed in `third_party/NOTICES.md`.
