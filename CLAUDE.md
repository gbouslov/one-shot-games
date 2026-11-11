# One-Shot Games

This repo turns one sentence into a playable, shareable browser game.

**When someone asks for a game, load `skills/make-game` and follow it.** Any phrasing counts: "make me a caveman FPS", "build a game where you are the haunted house", "one-shot something with boats".

## How to work here

- **Decide, don't ask.** Pick the genre, starter, look and scope yourself. Stop only for a choice that costs real money, publishes something or needs the person's own material.
- **Build small and finish.** A tiny level that is complete, polished and fun beats a large one that is not. "Make it small in scope" is the most useful phrase in the prompt bank.
- **Write only the game.** Your code goes in `games/<slug>/src/game/`. Change `src/kit/` only for a defect or a capability the game truly needs, and say which.
- **Never build what the player sees.** Buildings, props, weapons, characters and effects come from professional asset packs in the library; game code places, lights and scripts them. Coded geometry is only for invisible colliders and blockout. If the library has no environment kit for the setting, source one first (`skills/asset-library`). Ruling of 11 Nov 2026, after Last Firing shipped as textured boxes: "we should NEVER be building components/assets ourself basically".
- **The bar is a frame from the reference game, side by side.** A critic score against our own last build is not the bar, and a deadline never lowers it.
- **Judgment is yours; measurement belongs to the tools.** Choosing, designing, writing and judging what looks good are your job. Build, size, playtest, capture, profile and record are `npm run` commands. Don't write a generator that templates a game.
- **Passing checks prove it runs. Only your eyes prove it's good.** Open the screenshots.
- **Original games only.** No name, character, art, level or look from an existing game. `skills/design-brief` checks this before any code.
- **A game's title is its own.** Don't put another company's mark (a model, a studio, an engine) in a game's title; say it in descriptive text instead ("made with Claude Code"). Product, site and domain names are decided outside this repo, and Claude in them is allowed.
- **Never state a time or cost you did not measure.** Numbers come from `npm run receipts`.

## Map

| Where | What |
|---|---|
| `skills/` | `make-game` and the skills it calls. `.claude/skills` points here |
| `.claude/agents/` | `visual-critic`, `originality-checker` |
| `starters/` | One tested base per genre: `fps-three`, `platformer-2d`, `puzzle`, `racing`, `flight`, `runner`, `space-shooter`, `survival`, `topdown-shooter`, `tower-defense`. `src/kit` is tested parts, `src/game` is the game. `make-game` says which to pick |
| `games/<slug>/` | Games made here, created with `npm run new -- <slug>` |
| `tools/` | `build`, `size-gate`, `playtest`, `capture`, `imagediff`, `profile`, `record`, `receipts` |
| `prompts/` | Recipes that worked, with sources, and original concepts |
| `gallery/` | Playable games by other people. Links only |
| `references/` | Artifact rules, what spreads, the map of larger repos |
| `third_party/` | Licences for everything vendored, plus engine skills to read when useful |

## Commands

```bash
npm run new -- <slug> --from=starters/<s> # copy a starter to games/<slug> (default fps-three)
npm run build -- --game=games/<slug>     # one HTML file, then the size gate
npm run playtest -- --game=games/<slug>  # real input, full round, report and screenshots
npm run capture -- --game=games/<slug>   # named shots at high quality
npm run profile -- --game=games/<slug>   # frame times and hitches
npm run record -- --game=games/<slug>    # gameplay video with sound
npm run receipts -- stamp --game=<slug> first-play
npm run receipts -- session --game=<slug> --file=<transcript.jsonl>  # price the session at API rates
```

With no `--game`, tools use `starters/fps-three`. The browser is Playwright's own Chromium with a throwaway profile. Software WebGL is the default; add `--gpu` on a machine with a graphics card.
