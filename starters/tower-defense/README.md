# Tower defense starter

A complete three.js tower defense that builds to one HTML file. The default game, **Lamps of Mossvale**, is a valley at dusk: beetles of living shadow crawl out of a ruined gate along a winding road toward the last lit shrine, and you raise towers on the open ground to stop them over eight nights. Low sun, long shadows, ambient occlusion, bloom on every lamp and shell, a film grade, swaying grass, fireflies, sound made in code.

## Controls

| Input | Does |
|---|---|
| `1` `2` `3` or click a tower card | pick a tower (again to put it down) |
| click or tap open ground | build the picked tower there |
| click or tap a tower | select it: its card shows Upgrade and Sell |
| `U` | upgrade the selected tower |
| `S` (or Delete) | sell the selected tower for 70% back |
| `Space` / `Enter` or the gold button | call the next wave now; pays gold for the seconds left on the clock |
| `F` or the speed button | game speed 1x, 2x, 4x |
| `Esc`, right click | put down the tower, clear the selection |

Waves also come on their own when the clock runs out. Touch plays the same way: tap a card, tap the ground.

## What is where

```
src/kit/            genre machinery, tested; change it only for a defect or a missing capability
  td/defense.js     round state, gold, lives, waves, towers, enemies, projectiles (fixed 60 Hz step x game speed)
  td/board.js       the map: ASCII grid -> cells, the smoothed road, distance along it
  td/mapgen.js      seeded random roads (flow-field walker, serpentine and zigzag fallbacks)
  td/controls.js    controls.act(): mouse, touch, keyboard, HUD buttons and the bot all go through it
  td/bot.js         autoplay: ranks cells by road coverage, follows a build order, calls waves early
  td/crowd.js       every enemy drawn with a few instanced meshes per type; health bars
  td/camera.js      three-quarter view fitted to the board; slow drift on the title
  td/hud.js         HUD and screens in the DOM, restyled from config.hud
  world/nature.js   sky, sun, splat terrain, grass, trees, rocks, shrubs, motes
  render/ materials/ fx/ audio/ textures/   shared with starters/fps-three
src/game/           the default game: rewrite all of it
  config.js         towers, enemies, waves, economy, bot build order, words on screen
  level.js          the map picture, the terrain's shape and ground layers, props, the gate and the shrine
  models.js         tower and enemy meshes
  effects.js        particles and light on fire, hit, kill, blast, pulse, build, leak
  look.js           sky, sun, fog, bloom, grade
  sounds.js         every sound, synthesised
  shots.js          staged screenshots for npm run capture
playtest.plan.mjs   every control pressed for real; the round is won by debug.autoplay
```

## Rewrite for a new game

1. `src/game/config.js`: rename the towers (`kind` is `bolt`, `shell` or `pulse`), enemies and waves; set gold and lives; change every word in `hud.words`.
2. `src/game/level.js`: redraw `map` (S, #, G, ., x) or use `generate: { rows, cols, minPathLength, seed }` in the `Board`; change the ground layer colours, the props, and replace the gate and shrine with the new start and goal.
3. `src/game/models.js`: new tower and enemy meshes. A tower returns `userData.head` (turns to aim), `muzzle`, `onFire`, `update`. An enemy is a list of instanced parts with `anim` body, legsA, legsB, glow or spin.
4. `src/game/look.js`: time of day, sun direction, fog, grade. `src/game/sounds.js`: the voices named in its header.
5. `src/game/shots.js`: stage the moments worth a screenshot; `bot.order` in config if the tower count changes.

Then `npm run build`, `npm run playtest`, `npm run capture -- --q=high` and look at every frame.

## Sentences that should pick this starter

- "make me a tower defense in a mushroom forest"
- "a game where I build turrets on a space station to stop alien swarms walking the corridors"
- "defend a candy castle from marching gingerbread soldiers by placing cannons along the road"

## Sources

- `starters/fps-three` kit in this repository (MIT): render, materials, fx, audio, textures, rng, registry, sky and sun builders.
- djpav/threejs-tower-defense, MIT, commit dcb33e1: the map generator (ported), the targeting rule and path following (rewritten). No names, art, levels, towers or numbers from it.
- three.js 0.180.0, MIT, bundled.

Every copied or adapted file is listed in [NOTICES.md](NOTICES.md).
