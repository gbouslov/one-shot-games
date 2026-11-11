# Runner starter: The Cinder Causeway

A 3D lane runner. A hooded courier carries the last ember along a causeway of
basalt column tops over a sea of fire at dusk, to relight the dark beacon at
its far end. Three lanes; change lane, jump and slide past four kinds of
obstacle (basalt spires to dodge, heaps of hot rock to jump or dodge, cracks of
fire across the road to jump, fallen columns at head height to slide under);
pick up cinders, which chain into a rising score. The road bends and rises and
dips; the pace climbs from 13 to 27 m/s. Reach 1,500 m to win; three hits and
the ember goes out. About 75 seconds a run.

Low copper sun ahead with light shafts and a long shadow behind you, glowing
lava below, ash haze, rising embers, a volcano on the horizon, a rim-lit
animated courier with a lantern trail, speed lines and edge speed blur, a
serif HUD, and a title screen over the live scene. One HTML file, about 1.9 MB,
no network.

## Controls

| Key | Does |
|---|---|
| Left / Right arrow, or A / D | change lane |
| Up arrow, W or Space | jump |
| Down arrow or S | slide (in the air: drop fast, then slide) |
| M | sound on / off |
| Click, tap, Enter or Space | start, and run again from the end screen |
| Touch | swipe left / right to change lane, up (or a quick tap) to jump, down to slide |

## Files

```
src/game/          the default game: rewrite these for a new game
  config.js        title and words, credits, scenery seed
  rules.js         goal distance, hearts, speed ramp, lanes / jump / slide, the path's bends and hills, obstacle kinds, course patterns, bot timing
  look.js          palette (sky, haze, lava, stone, glows) and the render grade
  world.js         the land along the track: causeway (hex tops, curbs, walls, lane seams), lava, sky and sun, scenery, braziers, beacon, volcano, embers in the air, lights
  art.js           obstacles (spire, rubble, fissure, arch) and the cinders
  courier.js       the runner: model, clips, lantern, rim light, trail, footfalls
  sounds.js        one-shot voices and the bed (lava roar, wind with speed), all Web Audio
  shots.js         named camera setups for npm run capture
  assets/          ready-made models, one folder each (credits in NOTICES.md)
src/kit/           tested parts; change only for a defect or a new capability
  core/            engine loop (clamped dt, 120 Hz fixed step, fastForward), registry, config, rng
  runner/track.js  the path: bends and hills as sine terms, sampled per metre; track space (s, x, y) to world
  runner/body.js   lanes, jump arc, slide, fast drop, buffered presses, stumble
  runner/course.js lays out a round from a seed: rows of obstacles, pickups (lines, jump arcs, slide lines)
  runner/round.js  states, speed ramp, hits and hearts, pickups and chains, milestones, win and lose, events
  runner/bot.js    autoplay: reads the rows ahead, picks a lane, times jumps and slides, taps the keyboard's codes
  runner/camera.js chase camera in track space; title orbit; win and lose views
  runner/controls.js one control map for keyboard, swipes and bot; presses counted as edges
  runner/director.js presentation: places the runner and obstacles, particles, speed lines and blur, sound bed, screens, start / restart
  fx/              particle pools and ribbons, speed lines
  render/render.js AO (with the fix that keeps glows and sprites out of it), sun shafts, speed blur, bloom, grade, dynamic resolution
  audio/           Web Audio voices and DSP
  hud/             HUD, title / won / lost screens, CSS
  debug/api.js     window.__GAME__ for the tools
scripts/           how the courier model was cut down and recoloured from Patch's file
```

## What to rewrite for a new game

1. `config.js`: the title and words, the credits.
2. `rules.js`: `goal` and `hearts` are the win and the loss (an obstacle kind with `fatal: true` ends the run at once). `speed` is the ramp. `track` shapes the path: more and bigger `bends` for a winding road, bigger `hills` for a roller coaster, none for a straight sprint. `obstacles` are boxes in track space (lanes or full width, depth, from / to height): low ones are jumped, high ones slid under, tall ones dodged. `course.patterns` say which come, how many lanes each blocks, and from what distance; `course.gap` is the spacing in seconds of running.
3. `look.js`: the palette and grade. A night city wants cold haze and neon seams; a desert canyon wants pale sky, a white sun and sand stone.
4. `world.js` for a different place (a rooftop line, a mountain ridge, a pier, the back of a giant): keep `update()`, `flash()`, `sunDir` and `goalView`.
5. `art.js` for different obstacles and pickups; `courier.js` for a different runner. Any CC0 or CC-BY GLB without meshopt compression works; credit it in `NOTICES.md` and, for CC-BY, on the title screen (`config.text.credits`).

Keep every name, character and place original: no characters, tracks, cities or temples from another game.

## Sentences that should pick this starter

- "make me an endless runner where you dodge, jump and slide down a winding road to reach a finish line"
- "a three-lane runner along a crumbling cliff path at sunset, collecting coins and ducking under fallen logs"
- "a fast arcade runner across a floating city's rooftops, swipe to switch lanes and jump the gaps"

## Tools

```bash
npm run build -- --game=starters/runner --limit-mb=8
npm run playtest -- --game=starters/runner      # real keys for every control and swipes on a touch screen, then the bot wins a round
npm run capture -- --game=starters/runner --q=high
```

`?q=low|medium|high` picks quality (low drops post-processing and shadows), `?seed=` seeds the course and effects. The land is built from `worldSeed`, so it is the same on every run; the course is laid out fresh each round. Game time runs on clamped delta time with a fixed step, and collisions are tested in track space each step, so a slow machine plays in slow motion and every obstacle stays fair.

## Sources

Lane damping, jump arc, swipe rules and pacing adapted from omsingh02/bunny (MIT, commit 7d7ba83); the rule that a row never blocks every lane from juwalbose/ThreeJSEndlessRunner3D (MIT, commit 9c19dc8). Render (with the AO fix for transparent objects), audio, textures, particles, the debug contract, HUD and controls from `starters/space-shooter`. The courier is KayKit's "Rogue hooded" by Kay Lousberg (CC0), recoloured; the spire, boulder and rubble are by Polyfork (CC BY 4.0); all from Patch's library. Every name, the causeway, the course, the beacon and the look are new. File-by-file record in `NOTICES.md`.
