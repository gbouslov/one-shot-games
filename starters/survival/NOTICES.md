# Notices for starters/survival

The base is this repository's `starters/topdown-shooter` (copied whole with `node tools/vendor.mjs` at commit 216676e, working tree), whose own sources are listed in `starters/topdown-shooter/NOTICES.md` and `third_party/NOTICES.md`: mshumer/Claude-of-Duty (MIT, d9b237b) through `starters/fps-three`, xMPon/undead-protocol (MIT, 145db1e), patch-gg/pixelfx (MIT, 044e12a), three.js (MIT). The lead merges the rows below into `third_party/NOTICES.md`.

## From VictorZakharov/void-harvest-game (MIT)

Source: https://github.com/VictorZakharov/void-harvest-game at commit 8d9109d. MIT, Copyright (c) 2025-2026 Victor Zakharov, verified from its `LICENSE` at that commit (read through the GitHub API). Structure only, rewritten: no code copied, and no name, enemy, skill, item, biome, HUD, icon or art taken.

| File here | File there | What was taken |
|---|---|---|
| `src/kit/horde/spatial.js` | `js/systems/SpatialHash.js` | The idea: clear a uniform grid every frame, bucket by cell, query the cells a shape covers. Rewritten with typed-array linked lists and circle queries |
| `src/kit/round/round.js` (the director) | `js/entities/enemy-spawner.js` | Spawning on a ring around the player, on angles that keep the point inside the map; the kind mix and enemy health rising with time. Rewritten in fractions of the round, with a live-count target, a rate limit, surges and a boss |
| `src/kit/gems/gems.js` | `js/entities/item-manager.js` | Experience orbs dropped on death and pulled in by a magnet radius. Rewritten as instanced crystals with tiers and a cap that folds new value into old gems |
| `src/kit/levelup/levelup.js`, `src/kit/arsenal/arsenal.js` | `js/skills.js` | Upgrades as data with a max level and an apply step, three offered per level. Rewritten: four auto-weapon behaviours, passives as per-level totals, one evolution |

canvas-vampire-survivors (said to be MIT) was not opened and nothing was taken from it: it imitates a commercial game.

## Assets from Patch's free library (CC0)

Downloaded from patch.gg (`/api/v1/assets/<id>`, licence and credit read there), smallest `preview` variant, one folder each under `src/game/assets/`. The two GLBs were meshopt-compressed; they were re-packed into plain GLBs with `games/caveman/scripts/decode-meshopt.mjs` (same geometry and textures) because the artifact page blocks WebAssembly. Credited on the title screen although CC0 does not require it.

| Folder | Patch id | Title | Creator | Licence | Credit |
|---|---|---|---|---|---|
| `rockface/rock_face_01.glb` | `polyhaven:rock_face_01` | Rock Face 01 (preview, 20,174 triangles) | Dario Barresi | CC0-1.0 | "Rock Face 01" by Dario Barresi (Poly Haven, https://polyhaven.com/a/rock_face_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added. Changed here: meshopt decoded |
| `trunk/dead_tree_trunk.glb` | `polyhaven:dead_tree_trunk` | Dead Tree Trunk (preview, 101,802 triangles) | Rob Tuytel | CC0-1.0 | "Dead Tree Trunk" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/dead_tree_trunk), licensed CC0 1.0 Universal. Changed by Patch: as above. Changed here: meshopt decoded; drawn twice, not at `?q=low` |
| `leaves/forest_leaves_02_*_preview.jpg` | `polyhaven:forest_leaves_02` | Forest Leaves 02 (512 px base colour, normal, roughness) | Rob Tuytel | CC0-1.0 | "Forest Leaves 02" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/forest_leaves_02), licensed CC0 1.0 Universal. Changed by Patch: JPEG maps selected, credit added to each file |

## Changed from the top-down starter

| File | What changed |
|---|---|
| `src/kit/core/input.js` | `pick1`..`pick3` (1/2/3) replace the weapon slots; `config.touch: 'move'` makes the whole screen one floating move stick, with no aim stick or buttons |
| `src/kit/actors/player.js` | `faceMove` (turn to the walk direction, no aim), `dash: false`, `hold` for the arm pose |
| `src/kit/fx/pixelfx.js` | The fire flare reads its position from the `weapon:fire` event instead of a gun muzzle |
| `src/kit/hud/hud.js` | Rewritten for the genre: clock, experience bar, level, kills, what you carry, boss bar |
| `src/kit/round/round.js` | Rewritten: clock, director, surges, boss, win at the bell |
| `src/kit/bot/autoplay.js` | Rewritten: kites a loop, sweeps experience, picks cards with 1/2/3 |
| `src/kit/debug/api.js` | Snapshot for the genre (clock, level, cards, owned, horde); `levelUp()` and `setClock()` |

## Written for this starter

`src/kit/horde/horde.js`, `src/kit/horde/spatial.js`, `src/kit/gems/gems.js`, `src/kit/arsenal/arsenal.js`, `src/kit/levelup/levelup.js`, `src/main.js`, everything in `src/game/`, `playtest.plan.mjs`.

`src/kit/enemies/` and `src/kit/weapons/` (the top-down horde and guns) came along with the copy and are not imported; delete them in a new game.
