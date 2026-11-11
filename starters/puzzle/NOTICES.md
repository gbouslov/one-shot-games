# Notices: puzzle

Every file here that was copied or adapted from another project. Everything not listed was written for this repo.

| File here | File there | Source repo | Licence | Commit | What changed |
|---|---|---|---|---|---|
| `src/kit/vendor/littlejs.esm.min.js` | `dist/littlejs.esm.min.js` | https://github.com/KilledByAPixel/LittleJS | MIT (Copyright (c) 2021 Frank Force) | 9712ac4cd76e8d5eb77da21004687b63f7856fc1 | Nothing. Copied with `tools/vendor.mjs`. |
| `src/kit/vendor/LICENSE` | `LICENSE` | same | MIT | same | Nothing. |
| `src/kit/*.js` | | this repo's `starters/platformer-2d/src/kit` | MIT | | Identical copy of the platformer's kit; see its `NOTICES.md` for what that kit adapted. |
| `src/game/board.js` (match scan) | `examples/puzzle/game.js` | same as the engine | MIT | same | Adapted, not copied: the row and column scan and the rule that every match is removed at once, so L and T shapes clear together. Gravity, refills, move search, scoring and the bot are new. |

The example's sprite sheet and sounds were not copied. All art is painted in code in `src/game/art.js`; sounds are ZzFX lists in `src/game/sounds.js`.
