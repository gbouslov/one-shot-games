# Flight starter: Last Light Circuit

A light sport plane over an archipelago at golden hour. Fly ten lantern gates
strung between the islands before the clock runs out; crash into the land or
the sea three times, or run out of time, and the round is lost. Chase camera,
arcade flight that still feels like a plane (banking turns the nose, climbs
cost speed, stalls drop the nose), a quiet HUD, and a title screen over a live
attract lap flown by the bot. One HTML file, about 2 MB, no network.

## Controls

| Key | Does |
|---|---|
| W / S | nose down / nose up |
| A / D | roll left / right (let go and the wings level themselves) |
| Q / E | rudder: yaw the nose left / right |
| R or Shift | more throttle |
| F | less throttle |
| M | sound on / off |
| Click, tap, Enter or Space | start, and fly again from the end screen |
| Touch | drag anywhere in the left half: a floating stick (right rolls right, down pulls the nose up); + and − on the right are the throttle |

Ctrl is not used for throttle on purpose: Ctrl+W and Ctrl+S are browser shortcuts.

## Files

```
src/game/          the default game: rewrite these for a new game
  config.js        title and words, credits, sun direction, world seed, island shape
  rules.js         lives, clock pace, flight model overrides, bot settings, gate count / size / spacing
  look.js          palette (sky, haze, sea, land, light) and the render grade
  world.js         islands, terrain colours, sea, sky, cumulus, sun and fill light, HDRI sky light, haze
  course.js        where the gates go (seeded, follows coastlines, clears the ground) and how they look
  props.js         palms, broadleaf and pine trees scattered by height; the lighthouse with its lamp
  plane.js         the aircraft model (lathe and extrusions, vertex-painted), prop disc, wingtips
  sounds.js        one-shot voices and the engine/wind bed, all Web Audio
  shots.js         named camera setups for npm run capture
  assets/          ready-made models and the sky HDRI, one folder each (credits in NOTICES.md)
src/kit/           tested parts; change only for a defect or a new capability
  core/            engine loop (clamped dt, 120 Hz fixed step, fastForward), registry, config, rng
  flight/model.js  the flight model: rates, authority, self-levelling, bank turn, energy trade, stall
  flight/controls.js  one control map for keyboard, touch stick and bot (each a source)
  flight/autopilot.js the bot: bank-to-turn, climb to the gate, terrain look-ahead, overshoot recovery
  flight/round.js  states, clock, lives, gate crossing, crashes, respawns, events
  flight/chase-camera.js  chase view with partial roll and speed FOV
  flight/director.js  presentation: plane, camera, trails, bursts, crash spray, sound bed, screens
  world/           heightfield islands, terrain with baked low-sun shadows, sea shader, sky shader,
                   cumulus billboards, HDRI environment, GLB scatter (InstancedMesh)
  fx/particles.js  particle pools and ribbon trails
  render/render.js AO, sun shafts, bloom, grade, dynamic resolution (from fps-three)
  audio/           Web Audio voices and DSP (from fps-three)
  hud/             HUD, next-gate marker, title / won / lost screens, CSS
  debug/api.js     window.__GAME__ for the tools
```

## What to rewrite for a new game

1. `config.js`: the title and words, `sunDir` (time of day), `worldSeed` (a new archipelago and course), the island shape in `world`.
2. `rules.js`: gate count, radius and spacing, lives, the clock pace (`paceMetresPerSecond`), the flight model (`flight`: top speed, stall speed, rates).
3. `look.js`: the palette and grade. A noon game wants a high sun, white light, blue haze; a storm wants grey haze, low exposure, no glitter.
4. `course.js` for a different objective (rings over a canyon, checkpoints over a city, balloons to pop); keep each gate `{ pos, normal, radius }` and the round still works.
5. `plane.js` for a different aircraft (a seaplane, a biplane, a dragon); keep `userData.tips` and `userData.update`.
6. `props.js` and `assets/` to dress the land differently. Any CC0 or CC-BY GLB without textures works with `scatter()`; credit it in `NOTICES.md` and, for CC-BY, on the title screen (`config.text.credits`).

Keep every name, place and aircraft original: no real airline liveries, no named aircraft types, no callsigns or places from another game.

## Sentences that should pick this starter

- "make me a flying game where you race a seaplane through gates over tropical islands"
- "a paper-plane glider that has to thread hoops through a canyon at sunrise"
- "fly a little delivery plane between lighthouses before the storm arrives"

## Tools

```bash
npm run build -- --game=starters/flight --limit-mb=8
npm run playtest -- --game=starters/flight      # real keys for every control, touch stick, then the bot wins a round
npm run capture -- --game=starters/flight --q=high
```

`?q=low|medium|high` picks quality (low drops shadows, post and some trees), `?seed=` seeds effects. The islands and the course come from `worldSeed`, so they are the same on every run. Game time runs on clamped delta time, so a slow machine plays in slow motion rather than skipping.

## Sources

Flight model and island-terrain technique adapted from arjunemirchandani/skyward-flight-simulator (MIT, commit 5fde882). Render, audio, textures, rng and the debug contract from `starters/fps-three`. Trees (Kenney, CC0), lighthouse (Polyfork, CC BY 4.0) and the sky HDRI (Poly Haven, CC0) from Patch's library. Every name, the course, the plane and the look are new. File-by-file record in `NOTICES.md`.
