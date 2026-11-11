# Racing starter: Amberline GP

A three-lap kart race on a hillside circuit at sundown. Eight karts, drifting
with three mini-turbo stages, boost pads, hop jumps, eight pickup items, a
3-2-1 start with a launch boost, positions, laps, wrong-way detection and
respawns. The title screen sits over a live race between eight bots; finishing
in the top three wins the round. One HTML file, about 1.1 MB, no network.

## Controls

| Key | Does |
|---|---|
| W or ↑ | throttle (holding it through the whole countdown spins you out; press it just before GO for a launch boost) |
| A D or ← → | steer |
| S or ↓ | brake, then reverse |
| Space or Shift | hop; hold while steering to drift, release for a mini-turbo |
| E, Ctrl or Enter | use the held item (hold S to throw it backwards) |
| Q | look back |
| M | mute |
| Click, tap or Enter | start, and race again from the end screen |
| Touch | ◀ ▶ steer, DRIFT, ITEM; the throttle is held for you after GO; both steer buttons brake |
| Gamepad | RT throttle, LT brake, left stick steer, A or RB drift, X or LB item, Y look back |

## Files

```
src/game/         the default game: rewrite these for a new game
  config.js       title, words, which racer you drive, laps, rival skill, the place that wins
  track.js        the circuit: control points, widths, item rows, boost pads, light, sky, clouds, colours, sponsors
  racers.js       eight racers: names, colours, weight class, stats
  look.js         exposure, bloom, AO, light shafts, grade, and dress(): tree belts, bunting, sun dust
  shots.js        named camera setups for npm run capture
src/kit/          tested parts; change only for a defect or a new capability
  race/director.js  renderer, scene, lights, round flow, fixed-step loop, bot hook, quality presets
  race/RaceManager.ts  countdown, checkpoints, laps, places, finish, respawn
  race/FollowCamera.ts chase camera with drift lean, look-back, shake, countdown swoop
  kart/           arcade physics, kart and driver model, input (keyboard, gamepad, virtual)
  ai/AIDriver.ts  racing line, drifting, item use, rubber-banding, recovery
  track/          centerline, terrain, road, barriers, decor, landmarks, sky, props; dressing.js
  items/          pickups, roulette, projectiles, hazards and their art
  audio/          engine voices, effects bank, crowd, music sequencer (all Web Audio)
  fx/             GPU particles; post: AO, sun shafts, bloom, speed lines, grade
  ui/             HUD, minimap, title and end screens, touch controls
  debug/api.js    window.__GAME__ for the tools
```

## What to rewrite for a new game

1. `config.js`: the title, tagline, laps, `difficulty`, `winPlace`.
2. `track.js`: a new loop of 14 to 26 control points, 850 to 1450 m long, sections at least 3.5 road widths apart, gentle hills (y). Pick a `theme` for the decor set (`grassland`, `desert`, `snow`, `neon`), then the sky, sun, fog, clouds and palette. Place `itemBoxRows` and `boostPads` as fractions of the lap.
3. `racers.js`: eight original racers.
4. `look.js`: the grade and the dressing; `dress()` can add any meshes and return `{ update(dt, camera) }`.
5. Item art lives in `src/kit/items/itemVisuals.ts`; restyle it when the setting calls for it (a sea race wants buoys and flares, not oil cans). The item table is `ITEM_TABLE` in `ItemManager.ts`.

Keep every name, character, item and track original. Do not copy a known kart series' items or courses: no fruit peels, turtle shells, mushrooms, invincibility stars or rainbow roads.

## Sentences that should pick this starter

- "make me a kart racer on a volcano island"
- "a go-kart race through a snowy mountain village at night"
- "racing game where hamsters drive bumper cars around a kitchen table"

## Tools

```bash
npm run build -- --game=starters/racing
npm run playtest -- --game=starters/racing      # real keys for every control, then the bot wins a full race
npm run capture -- --game=starters/racing --q=high
```

`?q=low|medium|high` picks quality (low hides ground cover, drops shadows and post), `?seed=` makes the grid and items repeatable. Game time runs on clamped delta time, so a slow machine plays in slow motion rather than skipping; on software WebGL a full three-lap playtest takes several real minutes.

## Sources

Built on bridge-mind/turbo-kart-rush (MIT, commit 6c0456c): kart physics, AI, track builder, items system, audio, particles and post-processing. Every name, character, item design and the circuit are new. File-by-file record in `NOTICES.md`.
