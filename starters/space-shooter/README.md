# Space-shooter starter: The Long Seam

An on-rails space shooter. A strike fighter dives the length of a lit steel
trench cut through a drifting ore barge, steering inside the screen while the
rail carries it forward. Raider craft fly in, hold in front and shoot back;
guns on the trench walls track the ship; girders cross the trench to be flown
over or under. At the far end the reactor heart closes the trench: break its
four armoured nodes, the shutters open, destroy the core to win. Lose when the
hull runs out. About 90 seconds a run. Rail chase camera, glowing bolts with
bloom, explosions with hot debris and a flash of real light, a quiet HUD, and
a title screen over the live trench. One HTML file, about 2 MB, no network.

## Controls

| Key | Does |
|---|---|
| W A S D or arrow keys | steer inside the screen (up climbs, down dives) |
| Space, or hold the mouse button | fire (twin guns, they converge on the far reticle) |
| Shift | boost: the rail runs faster while the meter lasts |
| M | sound on / off |
| Click, tap, Enter or Space | start, and fly again from the end screen |
| Touch | drag anywhere in the left half: a floating stick steers; FIRE and BOOST buttons on the right |

## Files

```
src/game/          the default game: rewrite these for a new game
  config.js        title and words, credits, trench width and floor, far-glow direction, model scales
  rules.js         hull, ship speeds and guns, enemy stats, the script (waves, wall guns, girders by distance), the target at the end
  look.js          palette (sky, haze, steel, light seams, fire) and the render grade
  trench.js        the trench: wall blocks, ribs, light seams, gantries, skyline, light columns, nebula sky, haze, travelling lights, flash lights
  art.js           the player's fighter, raider craft, wall guns, girders and the reactor heart (models from assets/, glows added)
  sounds.js        one-shot voices and the engine/air bed, all Web Audio
  shots.js         named camera setups for npm run capture
  assets/          ready-made models, one folder each (credits in NOTICES.md)
src/kit/           tested parts; change only for a defect or a new capability
  core/            engine loop (clamped dt, 120 Hz fixed step, fastForward), registry, config, rng
  rail/ship.js     the rail (base / boost speed, stop at the end) and the ship in its screen box, banking, guns, aim point
  rail/round.js    states, script runner, craft / turret / boss behaviour, bolts, hits, damage, score, events
  rail/bot.js      the autoplay bot: dodges bolts, clears girders, lines up the lead on the best target, fires
  rail/rail-camera.js  chase camera in rail-local space; orbit and hold views
  rail/controls.js one control map for keyboard, mouse, touch and bot (each a source)
  rail/director.js presentation: ship and enemy visuals, bolts, explosions, shake, sound bed, screens, start / restart
  fx/              particle pools, bolt streaks, glowing orbs, hot debris
  render/render.js AO (with the fix that keeps glows and sprites out of it), sun shafts, bloom, grade, dynamic resolution
  audio/           Web Audio voices and DSP
  hud/             HUD, reticles, title / won / lost screens, CSS
  debug/api.js     window.__GAME__ for the tools
```

## What to rewrite for a new game

1. `config.js`: the title and words, the trench's width and floor (`trench`), the credits.
2. `rules.js`: the `script` is the level. Each event fires at a rail distance: a `wave` of craft (formation, side they come from, how long they stay), `turrets` on the walls, a `bar` across the trench. Then the `boss` (where the rail stops, node positions and health, core health, fire rates) and the ship (`ship`: speeds, box size, fire rate, boost).
3. `look.js`: the palette and grade. A desert canyon wants warm haze, sand-coloured walls, a white sun; an ice moon wants blue haze and white seams.
4. `trench.js` for a different place (a canyon of rock, a city of towers, the inside of a pipe): keep `update()` and `flash()`.
5. `art.js` for different ships and enemies. Any CC0 or CC-BY GLB without meshopt compression works; credit it in `NOTICES.md` and, for CC-BY, on the title screen (`config.text.credits`). A new enemy kind needs a behaviour in `kit/rail/round.js` and a visual in `art.enemy()`.

Keep every name, ship and place original: no ships, factions, pilots, trenches or bosses from a film or another game.

## Sentences that should pick this starter

- "make me an on-rails space shooter where you fly down a trench and blow up a reactor at the end"
- "a starfighter run through a canyon on an alien moon, shooting drones and gun towers, with a big boss at the end"
- "a rail shooter where you pilot a tiny ship through a giant space station's ventilation shafts"

## Tools

```bash
npm run build -- --game=starters/space-shooter --limit-mb=8
npm run playtest -- --game=starters/space-shooter      # real keys, mouse and touch for every control, then the bot wins a round
npm run capture -- --game=starters/space-shooter --q=high
```

`?q=low|medium|high` picks quality (low drops post-processing), `?seed=` seeds effects. The trench is built from `worldSeed`, so it is the same on every run. Game time runs on clamped delta time, so a slow machine plays in slow motion rather than skipping.

## Sources

Rail camera and trench construction technique adapted from bop-del/meridian-line (MIT, commit bf4dc45). Render (with the AO fix for transparent objects), audio, textures, particles, controls and the debug contract from `starters/flight` (and through it `starters/fps-three`). Ship, raider and turret models by Polyfork (CC BY 4.0) from Patch's library. Every name, the trench, the script, the boss and the look are new. File-by-file record in `NOTICES.md`.
