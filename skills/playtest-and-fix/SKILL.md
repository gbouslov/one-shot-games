---
name: playtest-and-fix
description: Play a built game in a headless browser, look at what happened and repair it. Use after every meaningful build, when a game has a bug, or before calling a game finished.
---

# Playtest and fix

The tools tell you whether it runs. You decide whether it works.

## The loop

```bash
npm run build -- --game=games/<slug>
npm run playtest -- --game=games/<slug>
```

Then, every time:

1. Read the failed checks in the output.
2. **Open every PNG in `games/<slug>/playtest/` with your image reader.** Do this even when everything passes.
3. Ask of each image: can I see the game I designed? Is the weapon or hand visible and sensible? Are enemies recognisable, on the ground, not clipping? Is the HUD readable? Is anything black, white, enormous or missing?
4. Fix the most serious problem. Rebuild, re-run.

Stop when every check passes, the images match `DESIGN.md` and each "done means" line has been demonstrated.

## What the playtest does

It loads the final single file under the artifact's content rules, then uses a real keyboard and mouse: click to start, walk, sprint, jump, drag to look, fire, reload, swap to each weapon, then play a clean full round to the end, aiming at enemies and shooting. After that it restarts, loses on purpose, restarts again, and checks the game in a sandboxed iframe, with pointer lock, on a touch screen and straight from disk.

Any console error, uncaught exception or request to another host fails the run.

## Reading common failures

| Symptom | Usual cause | Look at |
|---|---|---|
| Round is lost by the bot on every attempt (it gets 3) | Enemies too strong, or the player can't see them | `report.json` round stats, the fight screenshot |
| Bot wins but with no hits on one enemy type | Aim height wrong, capsule doesn't match the model | `radius`, `height`, `hover` in the definition |
| Enemies stand still | No path: spawn points on unwalkable cells or `bounds` too small | `world.js` `enemySpawns` and `bounds` |
| Black screen with HUD | Lights, exposure or fog colour | `look.js`; capture a shot with the HUD off |
| Weapon is invisible or huge | Model outside the view camera, or `hold` wrong | the fight screenshot |
| Falls through the ground | Mesh not added with `physics.addStatic`, or `userData.solid = false` | `world.js` |
| Screenshot passes but looks empty | Camera inside something | `playerSpawn` height |
| `external request` fault | A library or font from a CDN | inline it; see `skills/package-artifact` |
| Everything times out | Infinite loop, or software rendering at too high a quality | build with `--no-minify`; keep `--q=low` |

For a readable stack trace: `npm run build -- --game=games/<slug> --no-minify`.

## Honest limits

- A bot winning means the game can be won by a bot. Say so; don't claim it's fun.
- On a machine with no GPU the tools use software WebGL at a low frame rate. Frame times then tell you about hitches and regressions, and nothing about a player's experience. Run `npm run profile -- --gpu` on real hardware before quoting frames per second.
- If you change gameplay, run the whole thing again. A previous pass does not carry over.

## Regression checks

To prove a change altered nothing visually:

```bash
npm run capture -- --game=games/<slug> --out=shots/before
# make the change, rebuild
npm run capture -- --game=games/<slug> --out=shots/after
npm run diff -- --a=games/<slug>/shots/before --b=games/<slug>/shots/after --write-diff
```

The diff exits non-zero if pixels moved. Hitches and shader compiles show up in `npm run profile`.
