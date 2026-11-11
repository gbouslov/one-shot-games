# Notices: starters/tower-defense

Every file here that was copied or adapted from somewhere else. Everything not listed was written for this repository.

## From this repository (starters/fps-three, MIT, commit e0e5c74 plus working-tree changes of 2026-11-10)

Copied with `node tools/vendor.mjs` from `starters/fps-three/src/kit`, unchanged unless noted.

| File here | File there | What changed |
|---|---|---|
| `src/kit/core/registry.js` | `src/kit/core/registry.js` | nothing |
| `src/kit/core/rng.js` | `src/kit/core/rng.js` | nothing |
| `src/kit/render/render.js` | `src/kit/render/render.js` | nothing |
| `src/kit/fx/fx.js` | `src/kit/fx/fx.js` | nothing |
| `src/kit/textures/textures.js` | `src/kit/textures/textures.js` | nothing |
| `src/kit/audio/audio.js`, `dsp.js`, `shot.js` | same paths | nothing |
| `src/kit/materials/` (whole folder) | `src/kit/materials/` | nothing |
| `src/kit/core/engine.js` | `src/kit/core/engine.js` (itself derived from mshumer/Claude-of-Duty, MIT) | rewritten smaller: no input, no fixed physics step; the defense runs its own fixed step |
| `src/kit/core/config.js` | `src/kit/core/config.js` | new quality tiers (grass counts), 60 Hz simulation step |
| `src/kit/debug/api.js` | `src/kit/debug/api.js` | snapshot and debug hooks for a defense game |
| `src/kit/world/nature.js` (`skyDome`, `sunLight`, `motes`, `rockGeometry`) | `src/kit/world/builders.js` | motes no longer follow a player; sky adds a wide halo; rocks are vertex coloured with moss on top. Terrain splatting, grass, trees and shrubs are new |

## djpav/threejs-tower-defense

- Repository: https://github.com/djpav/threejs-tower-defense
- Licence: MIT (LICENSE in the repository, copyright 2026 Djordje Pavlovic)
- Commit: dcb33e1

| File here | File there | What changed |
|---|---|---|
| `src/kit/td/mapgen.js` | `src/map/MapGenerator.ts`, `src/utils/MathUtils.ts` (mulberry32) | ported from TypeScript to JavaScript; the flow-field walker, organic serpentine fallback, zigzag last resort and grid validator kept; topology anchors and secondary branching paths left out; returns a grid the Board reads |
| `src/kit/td/defense.js` (`_target`) | `src/systems/CombatSystem.ts` (`findBestTarget`) | same idea (furthest along the path, strongest, nearest), rewritten for this data layout |
| `src/kit/td/defense.js` (`_moveEnemies`) | `src/entities/components/EnemyMovement.ts` (`WaypointMovement`) | walkers keep a distance along a smoothed path instead of a waypoint index |

Nothing else was taken from that repository: no names, art, levels, balance numbers or tower set. Its towers (arrow, cannon, frost, lightning, poison, sniper, tesla) are not reproduced; the default game's three towers, three enemies, map, words and numbers are original.

## three.js

`three` 0.180.0 (MIT) is bundled into the single HTML file by the build, including `three/addons` (EffectComposer, passes, GTAOPass, BufferGeometryUtils).
