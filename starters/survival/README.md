# Survival starter (survivors-like)

A complete small survivors-like in one HTML file, seen from above: you only walk; your weapons fire by themselves. A horde that grows by the minute comes from every side, fallen enemies leave experience shards that fly to you, every level stops the clock and offers three upgrades, and a mini-boss arrives near the end. Outlast the clock to win; lose at zero health. A few hundred enemies are drawn with one instanced mesh per kind and kept apart by a spatial hash, so it holds up on software WebGL. Real lights in the dark (a carried lantern, way-lamps, lightning), scanned rocks and trees, rain, bloom and a film grade. Sound is generated in code.

```bash
npm run build -- --game=starters/survival
npm run playtest -- --game=starters/survival
npm run capture -- --game=starters/survival --q=high
```

Make a game from it with `npm run new -- <slug> --from=starters/survival`, then rewrite `src/game/`:

| `src/game/` | What it is |
|---|---|
| `rules.js` | Title, round length, the director (how many, how fast, which kinds, surges, the boss), level curve, drops, end screens |
| `enemies.js` | Enemy kinds: stats and bodies (merged parts with baked colours, plus a glowing part), the boss and its charge |
| `weapons.js` | Auto-weapons and charms, one row of numbers per level, and the evolution |
| `level.js` | The place: ground, cover, pools, lamps, the horizon |
| `look.js` | Sky, moonlight, the carried light, fog, weather, grade |
| `config.js` | Camera, player feel and body, pickup reach, HUD colours and labels |
| `sounds.js` | Weapon voices, level-up, boss, the ambience |
| `assets.js` | The downloaded scans (see Sources) |
| `shots.js` | Named screenshots for `npm run capture` |

The default game, **Peatlight**, is a wet night on the edge of a fen: when the way-lamps go out the peat walks, and a lamp-warden has to keep the lantern burning for five minutes until the chapel bell. Enemies: mirelings (peat clots, the crowd), skitters (fast bone scuttlers), lampmoths (flying, weaving), peat giants (slow and heavy) and the Fen Hart (the mini-boss that lowers its antlers and charges). Weapons: Lamp Bolt (shots at the nearest), Ember Ring (orbiting coals; evolves into Hearth Ring with the Oilskin Coat), Bell Toll (a shove ring), Storm Call (lightning); charms: Oilskin Coat (health, mending), Lodestone (pickup reach, speed). It is original. Replace it.

## Controls

- WASD or arrows: walk (your weapons aim and fire by themselves)
- 1, 2, 3, or a click on a card: take a level-up
- Touch: drag anywhere to walk; tap a card
- Enter or a click starts and restarts

URL options: `?q=low|medium|high` quality, `?seed=` the random seed.

## The kit (`src/kit/`)

The simulation runs on the ground plane (x, z): actors are circles, solids are rectangles and circles.

| Part | Job |
|---|---|
| `horde/` | The swarm: instanced bodies per kind, one instanced shadow for all, spatial-hash separation, touch damage, hit flash and shove, sink-away deaths, an optional charge (windup, run, recover) for bosses |
| `gems/` | Experience shards: instanced crystals and glows, magnet pull, tiers by value, a cap that folds new value into old shards |
| `arsenal/` | Auto-weapons by behaviour (`bolt`, `orbit`, `pulse`, `strike`), passives as per-level totals, the options a level-up can offer, evolutions |
| `levelup/` | Experience curve, the three-card choice that stops the clock, keys / click / tap all ending in `choose(i)` |
| `round/round.js` | Title, the clock, the spawn director in fractions of the round, surges, the boss, win at the bell, lose, restart |
| `bot/autoplay.js` | Plays a round through the same keys a person presses, cards included |
| `hud/hud.js` | Clock, experience bar, level, kills, what you carry, boss bar, banners, screens |
| `arena/`, `actors/`, `camera/`, `world/`, `pickups/` | From the top-down starter: solids and collision, the jointed player body, the follow camera, sky / key light / rain / motes / puddles, floor pickups |
| `render/`, `materials/`, `fx/`, `audio/` | From the first-person kit: AO, bloom, grade; procedural PBR surfaces; particles, tracers, flashes; procedural sound |
| `fx/pixelfx.js`, `vendor/pixelfx/` | Pixel-art effects from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT). Off by default |

## What to rewrite for a new game

1. `rules.js`: the name, the round length (`seconds`), the director curves and mix, the surges, the boss.
2. `enemies.js`: new bodies and numbers. Keep `max` per kind honest: total on screen is the sum.
3. `weapons.js`: new auto-weapons from the four behaviours, two or three charms, one evolution.
4. `level.js` and `look.js`: the place and the time of day.
5. `config.js`: the player's body and the HUD words.

The playtest plays a 100-second round (`init` in `playtest.plan.mjs` sets `window.__ROUND_SECONDS__`), because software WebGL is slow; the director works in fractions of the round, so the same arc plays compressed. The game itself is 5 minutes.

## Three sentences that should pick this starter

- "Make me a survival game where you are a lighthouse keeper and crabs come out of the sea all night."
- "A survivors-like with auto-firing weapons, hordes and level-ups, set in a haunted orchard."
- "Bullet-heaven roguelite: survive ten minutes against swarms of robots, pick an upgrade every level."

## Sources

- This repository's `starters/topdown-shooter` (itself on xMPon/undead-protocol, MIT, 145db1e, and the `starters/fps-three` kit on mshumer/Claude-of-Duty, MIT, d9b237b): the whole base.
- VictorZakharov/void-harvest-game (MIT, commit 8d9109d): the structure of a survivors-like (ring spawner that ramps, experience with a magnet, three upgrades per level, a spatial hash), rewritten. No names, enemies, items or art.
- patch-gg/pixelfx (MIT, 044e12a), vendored and off.
- Scans from Poly Haven via Patch, CC0: Rock Face 01 (Dario Barresi), Dead Tree Trunk and Forest Leaves 02 (Rob Tuytel).

Full file list: `NOTICES.md`.
