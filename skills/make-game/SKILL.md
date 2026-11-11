---
name: make-game
description: Turn one sentence into a finished, playable, shareable browser game. Use whenever someone asks for a game in any words, such as "make me a caveman FPS", "build a game about...", or "one-shot a game". Runs design, build, playtest, polish, packaging, recording and the post.
---

# Make a game

Someone said one sentence. Deliver a game they can play and a link-ready file, without asking anything you can decide yourself.

Work in order. Each step has its own skill: read it when you reach the step. Ask only about things that cost real money, publish something or need the person's own files.

## 0. Start the clock

```bash
npm run receipts -- stamp --game=<slug> setup "<their exact sentence>"
```

Pick a short lowercase slug. Keep their sentence verbatim: it is the acceptance test for everything after.

## 1. Decide and design

Read `prompts/README.md` and pick the closest recipe. Before you promise a look, check the genre's row in `references/GENRE-COVERAGE.md`: it says what the library can show at the realistic bar (props, materials, skies, rigged humans) and what it can't yet (animated realistic people, real cars and aircraft, recorded sound). Design around a gap rather than discovering it at the critic. Then pick the starter:

| They want | Start from | Engine |
|---|---|---|
| First-person anything: shooter, horror, exploration, melee, survival | `starters/fps-three` | three.js |
| Side-scrolling platformer, any 2D run-and-jump | `starters/platformer-2d` | LittleJS |
| Match-three, swap or grid puzzle | `starters/puzzle` | LittleJS |
| Racing, karts, any vehicle on a track | `starters/racing` | three.js |
| Flying: planes, gliders, dragons, air races, anything with pitch and roll | `starters/flight` | three.js |
| Endless runners: lanes, jump, slide, dodge, run to a goal | `starters/runner` | three.js |
| On-rails shooters: starfighter trench runs, rail shooters, a boss at the end | `starters/space-shooter` | three.js |
| Top-down or twin-stick shooter, aimed by hand | `starters/topdown-shooter` | three.js |
| Survival against hordes: auto-weapons, experience, level-up choices, outlast the clock | `starters/survival` | three.js |
| Tower defense, lane or path strategy | `starters/tower-defense` | three.js |
| Anything else | The nearest starter above (camera and engine first, rules second); rewrite `src/game/` | |

Each starter's `README.md` lists what its `src/game/` files do. Its `src/kit/` is tested: change it only for a defect, and say which.

Follow **`skills/design-brief`** to write `games/<slug>/DESIGN.md`: one page, original, small.

```bash
npm run new -- <slug> --from=starters/<starter>
```

Write `DESIGN.md` into the new folder.

## 2. Build on the pieces

Follow **`skills/build-from-pieces`**. You write the world, enemies, weapons, rules and look. The kit supplies the rest. Get to a playable round before adding anything. In a first-person game, a modern firearm keeps the starter's animated asset arms (`viewmodel: { arms: 'asset', ... }`, credit line included); anything primitive or melee uses the bare arms preset instead (`viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear', material: 'hide' }` with `model: buildSpear` or `buildClub`; CC0, no credit line).

```bash
npm run build -- --game=games/<slug>
npm run receipts -- stamp --game=<slug> first-play
```

## 3. Playtest and fix

Follow **`skills/playtest-and-fix`** until every check passes and the screenshots show the game you designed. Stamp each repair round: `npm run receipts -- stamp --game=<slug> repair "<what broke>"`. What broke and how you found it is part of the story, so keep it.

## 4. Make it look great

Follow **`skills/make-it-look-great`**. Do this after it plays, and re-run the playtest afterwards. Most of a game's reach is decided by its first second on screen.

Then hand the screenshots to the `visual-critic` agent, fix what it finds, and repeat until it has no serious complaint, or three rounds have passed. One owner makes the changes, in sequence; the Claude-of-Duty project reports that this beat parallel agents.

## 5. Pack it

Follow **`skills/package-artifact`**: one HTML file, inside the rules, tested embedded.

```bash
npm run receipts -- stamp --game=<slug> final-play
```

Price the run inside a Claude Code session: `npm run receipts -- session --game=<slug> --file=<this session's transcript .jsonl>` (under `~/.claude/projects/<folder>/`; a sub-agent's is in `<session>/subagents/`). It counts the tokens recorded between the game's first and last stamp, at API list prices.

## 6. Record and draft the post

Follow **`skills/record-and-post`**: gameplay video with sound, measured time and cost, post text and the exact prompt. Stop before anything is published: posting and public links are the person's call.

## Finish

Reply with: the path to `dist/index.html`, the video path, the best screenshot, the measured time and cost, what broke along the way and what you did not verify. Say plainly if a check failed.

## Two or more models at once

If they asked to compare models, or a new model just came out, use **`skills/model-drop-arena`** instead of running this once.
