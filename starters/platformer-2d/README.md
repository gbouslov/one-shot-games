# platformer-2d

A side-scrolling platformer that builds to one HTML file of about 0.26 MB. The default game, **Sparkwright**, is a small brass robot climbing a ridge at sundown: run, jump, gather sunseeds, hop on bramblebugs, light lantern posts as checkpoints, and wake the beacon at the far end to win. Three hits or falls and the round is lost.

The look is a dusk scene: a banded sky with a low sun, three parallax backdrops (mountains, pine hills, a forest), terrain painted in code with lit moss edges, grass, roots and stones, additive glows on everything that gives off light, drifting motes, squash and stretch, dust, sparks, hit stop, screen shake, and a glow, vignette and colour-fringe post pass at `?q=high`.

The moments of action are pixel-art effects from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT), recoloured to the dusk in `src/game/effects.js`: a violet poof with gold stars when a bug is stomped, a gold collect burst for a sunseed, the same burst in amber when a lantern lights, a rose hit flare along the blow when the robot is hurt, and a firework rocket and two shells when the beacon wakes. `src/kit/pixelfx.js` draws them at 32 pixels a tile, nearest-neighbour, over the scene, stepped on the game's own updates so hit stop freezes them too. Any of the 244 pixelfx effects can be added the same way: vendor its file and its category's `_lib.js` into `src/kit/vendor/pixelfx/src/fx/`, then `pfx.spawn(effect, worldPos, { palette })`.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Run | ← → or A D | ◀ ▶ buttons, bottom left |
| Jump (hold for higher) | Space, ↑, W or Z | ▲ button, bottom right |
| Start or restart | click, tap, Enter | tap |

## Sources

| What | From | Licence | Commit |
|---|---|---|---|
| Engine (`src/kit/vendor/littlejs.esm.min.js`, unchanged) | KilledByAPixel/LittleJS `dist/littlejs.esm.min.js` | MIT | 9712ac4 |
| Player controller ideas (coyote time, buffered and held jump, landing sound) | KilledByAPixel/LittleJS `examples/platformer/gameCharacter.js` | MIT | 9712ac4 |
| Camera follow, parallax and particle usage patterns | KilledByAPixel/LittleJS `examples/platformer/game.js`, `gameLevel.js`, `gameEffects.js` | MIT | 9712ac4 |
| Pixel effects (`src/kit/vendor/pixelfx/`: core plus poof, collect burst, hit spark, firework burst, firework rocket; unchanged but for a trimmed `index.js`) | patch-gg/pixelfx `src/core`, `src/fx` (adapting Hugo Duprez's Sprite Fusion VFX, MIT) | MIT | 044e12a |

All art, the level, sounds, music and the HUD are written for this starter. No image or sound files. Details in `NOTICES.md`.

## Layout

```
src/kit/       engine glue every game from this starter shares (genre-neutral)
  engine.js      re-exports LittleJS
  boot.js        round states, time loop, ?seed ?q ?capture ?lockstep, window.__GAME__ hooks
  input.js       actions bound to keys; keyboard, touch buttons and the bot press the same actions
  screens.js     title / won / lost cards and the HUD layer, in HTML
  fx.js          particles, shake, hit stop, flash, floating text, post pass by quality
  pixelfx.js     pixelfx effects in world space: one pixel frame over the view, stepped with the game
  vendor/pixelfx the pixelfx core and the effects used, with its LICENSE and NOTICE.md
  art.js         canvas-drawn sprite atlas and painting helpers
  audio.js       ZzFX effects with a play counter, a small generative music loop
  rng.js         seeded Math.random
src/game/      the default game: rewrite these
  config.js      movement tuning and the palette
  level.js       the level as pieces: ground, rocks, ledges, brambles, seeds, bugs, checkpoints, beacon
  art.js         every sprite, the terrain painter and the three backdrops
  entities.js    Player, Bug, Seed, Lantern, Beacon
  game.js        wiring, camera, sky, the bot, title text, theme
  hud.js         the HUD HTML and CSS
  effects.js     which pixel effect, palette and place for each moment (stomp, seed, hurt, lantern, beacon)
  sounds.js      ZzFX lists and the music chords
  shots.js       named set-ups for npm run capture
playtest.plan.mjs  every control checked with real keys; the bot wins a round
```

## What to rewrite for a new game

1. `src/game/config.js`: the palette first (sky, backdrops, soil, moss, hero), then the movement numbers.
2. `src/game/art.js`: the hero, enemy, pickup and goal sprites; `paintTerrain` for the ground material; the three backdrop painters.
3. `src/game/level.js`: the pieces. Keep pits at 3 tiles or less and steps at 2 or less, or the bot in `game.js` cannot finish it.
4. `src/game/entities.js`: what the enemy does, what a pickup gives, what wins.
5. `game.js` `text` and `theme` for the title and end cards, `sounds.js` for the sounds and music.
6. `effects.js`: the palettes for the new scene, or other pixelfx effects for the game's own moments.

Keep `src/kit` as it is unless a game needs a capability it lacks.

## Three sentences that should pick this starter

- "Make a platformer about a lantern spirit crossing a flooded city."
- "A side-scroller where a fox collects acorns and stomps on beetles before winter."
- "One level of a jump-and-run on the moon, with low gravity and a rocket at the end."

## Checks

```bash
npm run build -- --game=starters/platformer-2d      # 0.26 MB
npm run playtest -- --game=starters/platformer-2d   # 31 checks
npm run capture -- --game=starters/platformer-2d --q=high
```
