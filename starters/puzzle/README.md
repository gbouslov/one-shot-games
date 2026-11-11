# puzzle

A match-three that builds to one HTML file of about 0.2 MB. The default game, **Glowtide**, is a tidepool at night: swap two neighbouring creatures to line up three or more of a kind, and reach 2,000 points before your 20 swaps run out. Lines of four and five score bonuses, and cascades chain. While the title is up, the board plays itself quietly behind it.

The look is a deep-water scene: a painted seabed, light from the surface, caustics and bubbles, glass pieces with a lit rim and inner glow, bursts, shake, hit stop and floating score text, and a glow and vignette post pass at `?q=high`.

## Controls

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move the cursor | arrows or WASD | | |
| Pick up, then swap | Space, Z or X, then an arrow | drag a piece onto a neighbour, or click one then the other | tap one then its neighbour, or drag |
| Start or restart | click, Enter | click | tap |

## Sources

| What | From | Licence | Commit |
|---|---|---|---|
| Engine (`src/kit/vendor/littlejs.esm.min.js`, unchanged) | KilledByAPixel/LittleJS `dist/littlejs.esm.min.js` | MIT | 9712ac4 |
| The match scan, with every match removed at once | KilledByAPixel/LittleJS `examples/puzzle/game.js` | MIT | 9712ac4 |
| `src/kit/` | this repo's `starters/platformer-2d/src/kit`, unchanged | MIT | |

All art, sounds, music and the HUD are written for this starter. There are no image or sound files. Details are in `NOTICES.md`.

## Layout

```
src/kit/       the same LittleJS glue as platformer-2d (round states, input, screens, fx, art, audio, rng)
src/game/      the default game: rewrite these
  config.js      rules (board size, kinds, swaps, target, scoring, timings), the six piece kinds, the palette
  board.js       the rules with no drawing: matches, gravity, refills, move search. Pure functions, reused by the bot
  art.js         every piece sprite, the glass board and the seabed backdrop
  game.js        animation of the rules, input, the bot, title and end text, theme
  hud.js         the HUD HTML and CSS
  sounds.js      ZzFX lists and the music
  shots.js       named set-ups for npm run capture: title, board, match, cascade
playtest.plan.mjs  every control checked with real keys, mouse and touch; the bot wins a round
```

## What to rewrite for a new game

1. `src/game/config.js`: the kinds (name, colours, glow) and the palette, then the rules. If you change the board size, swaps or target, run the bot over a few seeds: the target must stay reachable.
2. `src/game/art.js`: one painter per kind, the board and the backdrop.
3. `src/game/board.js` only to change the rules themselves (special pieces, blockers, a different match shape).
4. `game.js` `text` and `theme` for the title and end cards, and `sounds.js` for the sounds.

Keep `src/kit` as it is unless a game needs a capability it lacks.

## Three sentences that should pick this starter

- "A match-three in a witch's potion cabinet."
- "Swap gemstones in a mine cart before the lantern runs out."
- "A cosy puzzle where you line up teacups to fill a café's orders."

## Checks

```bash
npm run build -- --game=starters/puzzle
npm run playtest -- --game=starters/puzzle
npm run capture -- --game=starters/puzzle --q=high
```
