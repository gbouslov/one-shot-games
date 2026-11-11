# Top-down shooter starter

A complete small twin-stick shooter in one HTML file, seen from above: move with one hand, aim with the other, hold the trigger, dash out of trouble. Waves of enemies route round cover through a shared flow field, stagger and fall when shot; health drops on the floor; five waves, then win, lose and restart. Real lights in the dark (a carried headlamp, pole lamps, muzzle flashes), procedural materials, bloom, ambient occlusion and a film grade. Sound and textures are generated in code.

```bash
npm run build -- --game=starters/topdown-shooter
npm run playtest -- --game=starters/topdown-shooter
npm run capture -- --game=starters/topdown-shooter --q=high
```

Make a game from it with `npm run new -- <slug> --from=starters/topdown-shooter`, then rewrite `src/game/`:

| `src/game/` | What it is |
|---|---|
| `rules.js` | Title, waves, drops, end screens |
| `level.js` | The place: walls, cover, lamps, where enemies come in |
| `look.js` | Sky, light, fog, weather, grade |
| `enemies.js` | Enemy kinds: stats and bodies (`humanoid()` from `kit/actors/rig.js`) |
| `weapons.js` | Guns: rate, damage, spread, pellets, magazine, feel |
| `config.js` | Camera angle and lead, player feel and body, HUD colours |
| `sounds.js` | Extra voices and the ambience |
| `shots.js` | Named screenshots for `npm run capture` |

The default game, **Sodium Yard**, is a night shift in a walled freight yard in the rain: hold out against the Hollows until dawn. It is original. Replace it.

## Controls

- WASD or arrows: move
- Mouse: aim (the view leans toward where you aim)
- Left button or F: fire (hold)
- Space or Shift: dash, with a moment of invulnerability
- R: reload (it also reloads by itself when empty)
- Q, right button, 1, 2: swap weapon
- Touch: the left half is a floating move stick, the right half a floating aim stick that fires once pushed past half way; DASH, RELOAD and SWAP buttons
- Enter or a click starts and restarts

URL options: `?q=low|medium|high` quality, `?seed=` the random seed.

## The kit (`src/kit/`)

The simulation runs on the ground plane (x, z): actors are circles, solids are rectangles and circles, height is only for drawing. That is why one kit serves a top-down camera and an over-the-shoulder one.

| Part | Job |
|---|---|
| `arena/` | Solids, collision, rays, line of sight, the flow field enemies follow |
| `actors/rig.js` | `humanoid(rng, {...})`: jointed bodies made in code, six draw calls each; `poseRig` walks, aims, reaches, staggers |
| `actors/player.js` | Twin-stick movement, dash with invulnerable frames, health |
| `camera/camera.js` | Top-down follow with aim lead and shake; a `'shoulder'` mode for third person |
| `weapons/weapons.js` | Hitscan guns with pellets, spread, magazines, tracers, muzzle flash and light |
| `enemies/enemies.js` | The horde: flow-field steering, separation, windup and hit, knockback, death and pooling |
| `pickups/pickups.js` | Things to walk over |
| `round/round.js` | Title, waves, breathers, win, lose, restart |
| `bot/autoplay.js` | Plays a round through the same keys a person presses |
| `world/builders.js` | Ground, sky, key light, lamps with beams, puddles, rain, motes |
| `render/`, `materials/`, `fx/`, `audio/` | From the first-person kit: AO, bloom, grade; procedural PBR surfaces; particles, tracers, flashes; procedural sound |
| `fx/pixelfx.js`, `vendor/pixelfx/` | Pixel-art effects from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT) used as light: a flare at the muzzle, sparks off walls, a burst in a pickup's colour, each painted into a CanvasTexture on an additive billboard. **Off by default** |

### Pixel effects: available, off

Pixel effects are available; they are off because they clash with the realistic look. Turn them on for a stylised game with `pixelfx: { enabled: true }` in `src/game/config.js` (or `?pixelfx=1`); `on: { fire, impact, pickup }` there swaps or drops each moment. The capture shots `fight-pixelfx` and `wall-pixelfx` show them next to `fight` and `wall`. Judged at `--q=high`: drawn additively they don't read as stickers, but next to the soft bloom, real lights and 3D tracers the crisp pixel crosses and sparks are small, grainy and add little; in a flat-shaded, neon or retro top-down game they would earn their place.

## What to rewrite for a new game

1. `rules.js`: the name, the line under it, the waves.
2. `level.js`: the place. Keep solids going through `arena.box`, `arena.solidRect` and `arena.solidCircle`, set `enemySpawns` outside the gaps, and keep `setField` larger than `setPlay` so enemies can walk in.
3. `enemies.js` and the player `rig` in `config.js`: new bodies from `humanoid()` (height, build, hunch, colours, glowing parts, `gear` for extra shapes).
4. `look.js`: time of day. Day: a bright `keyLight` and sky, no headlamp. Night: what is here.
5. `weapons.js`: the guns.

## Three sentences that should pick this starter

- "Make me a zombie twin-stick shooter."
- "A top-down game where a lighthouse keeper fights crabs on a stormy pier."
- "Twin-stick arena shooter, neon robots, one room, survive ten waves."

## Sources

- xMPon/undead-protocol (MIT, commit 145db1e): collision, flow field, the touch twin-stick overlay and the jointed-rig idea, ported to JavaScript. No names, HUD, maps or art.
- phoboslab/underrun (MIT, commit f933e29): the look reference for lights in darkness. No code taken.
- This repository's `starters/fps-three` kit: render, materials, audio, effects, engine.
- patch-gg/pixelfx (MIT, commit 044e12a, adapting Hugo Duprez's Sprite Fusion VFX, MIT): the pixel effect core and three effects (hit spark, bullet impact, collect burst) in `src/kit/vendor/pixelfx/`, unchanged but for a trimmed `index.js`.

Full file list: `NOTICES.md`.
