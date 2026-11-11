# Receipt: night-camp (fresh session, asset-library skill only)

Run on 10 Nov 2026 at 22:02 CT, logged in `receipts/runs.jsonl` (session `170369db-1fd1-45ea-b8ca-679e1a83e24d`).

```
claude -p <prompt> --output-format json --model claude-opus-5-5 --permission-mode acceptEdits \
  --allowedTools "Bash(npm run:*)" Read Write Edit Glob Grep Skill --max-budget-usd 25
```

Result: 7.7 min wall clock, $1.89 at list API price, 44 turns, build 6.83 MB, frame at `games/night-camp/shots/hero.png` (git-ignored; rebuild with `npm run capture -- --game=games/night-camp --shots=hero`).

## The prompt, verbatim

Use the asset-library skill (skills/asset-library/SKILL.md) to dress a new scene with ready-made assets. Read that skill and only the files it points you to; do not browse assets/ or references/.

The scene: a forest clearing at night where a lone guard keeps watch by a fire, played first-person, holding a machete. Make it with `npm run new -- night-camp` and write only in games/night-camp/src/game/. It needs a night sky, a ground material, at least 10 placed props (a fire with a light in it), and the machete in the hands. At least two of the assets must be ones you find and pack yourself with the skill's Patch search (not already in the skill's table). Keep the round playable (the starter's enemies and waves can stay).

When it builds under 12 MB (`npm run build -- --game=games/night-camp --limit-mb=12`), capture one frame with `npm run capture -- --game=games/night-camp --shots=hero` (make the `hero` shot in shots.js look at the camp), look at it, fix anything clearly wrong once, and stop. Don't commit. End with one line: the build size and the path of the screenshot.
