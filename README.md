# One-Shot Games

**Games made by coding agents, the prompts behind them, and a head start for your agent to make its own.**

| Play | Made with | By | The prompt |
|---|---|---|---|
| [Saltline](https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp) | Claude Fable 5.2 | [@felixrieseberg](https://x.com/felixrieseberg/status/2119925633564463609) | [`You know, you should also build me a FPS. Insanely detailed quality pls...`](prompts/recipes/01-short-fps.md) |
| [What the Water Keeps](https://what-the-water-keeps.vercel.app) | Claude Fable 5.2 | [@kevin_t_ngo](https://x.com/kevin_t_ngo/status/2119868968307695818) | not shared |
| [I Would Have Gotten Away With It](https://i-would-have-gotten-away-with-it.netlify.app) | Claude Fable 5.2 | [@emollick](https://x.com/emollick/status/2119876449494540554) | not shared |
| [The Clockmaker's Heart](https://claude.ai/artifact/6MjtQjf4ee1ZZjEpafaEpa) | Claude Fable 5.2 | [@felixrieseberg](https://x.com/felixrieseberg/status/2119925633564463609) | not shared |
| [Tidewright](https://claude.ai/artifact/JTgyEMn7sn1q2riWrMb7D4) | Claude Fable 5.2 | [@felixrieseberg](https://x.com/felixrieseberg/status/2119925633564463609) | not shared |
| [WONTFIX](https://wontfix-game.netlify.app/) | Claude Opus | [@emollick](https://x.com/emollick/status/2115981377652822479) | not shared |
| [Tidebreaker](https://tidebreaker.vercel.app) | Claude Opus 5.5 | [@chongdashu](https://x.com/chongdashu/status/2109452512160039063) | not shared |
| [Skyhold](http://skyhold-ten.vercel.app) | Claude Opus 5.5 | [@0xbobaaa](https://x.com/0xbobaaa/status/2108495368585371666) | not shared |

[80 playable games](gallery/README.md) · [22 prompts that worked, with what they cost](prompts/README.md)

## Build yours

```bash
git clone <this repo> && cd one-shot-games
npm install
npx playwright install chromium
claude    # or: codex
```

Then type:

```text
make me a caveman FPS
```

Your agent picks the closest recipe, writes a one-page design, builds on tested parts so it only has to write your game, plays it in a headless browser, looks at the screenshots, fixes what is broken, packs it into one HTML file you can share, records gameplay with sound, and drafts the post.

Any idea works. Each genre below has a starter: a finished small game that passes a real playtest, which your agent rewrites into yours. Ideas outside these genres start from the nearest one.

| Genre | Starter | A sentence that picks it |
|---|---|---|
| First-person shooter, horror, exploration | [`fps-three`](starters/fps-three) | make me a caveman FPS |
| 2D platformer | [`platformer-2d`](starters/platformer-2d) | a side-scroller where a fox stomps beetles before winter |
| Match-three puzzle | [`puzzle`](starters/puzzle) | a match-three in a witch's potion cabinet |
| Kart racing | [`racing`](starters/racing) | make me a kart racer on a volcano island |
| Flight, air races | [`flight`](starters/flight) | fly a little delivery plane between lighthouses before the storm arrives |
| On-rails space shooter | [`space-shooter`](starters/space-shooter) | a starfighter run through a canyon on an alien moon, with a big boss at the end |
| Endless runner | [`runner`](starters/runner) | a fox running a frozen river at night, dodging cracks and leaping over logs |
| Survival, survivors-like hordes | [`survival`](starters/survival) | a lighthouse keeper outlasts crabs coming out of the sea all night |
| Top-down / twin-stick shooter | [`topdown-shooter`](starters/topdown-shooter) | a lighthouse keeper fights crabs on a stormy pier |
| Tower defense | [`tower-defense`](starters/tower-defense) | make me a tower defense in a mushroom forest |

## What your agent gets

- **A working game per genre** ([`starters/`](starters)): the first-person one has gloved hands and assembled weapons, mouse look with a drag fallback for embedded pages, touch controls, hitscan, projectile and melee weapons, and enemies that find their way to you. Every starter has sound and textures made in code, a title, win and lose screens, touch input and a bot that can win a round. Each is one HTML file of 0.2 to 1.1 MB.
- **Eight skills** ([`skills/`](skills)) that run the job: designing, building, playtesting, making it look great, packing, recording, and comparing models the day a new one drops.
- **Tools that measure** ([`tools/`](tools)): a real keyboard-and-mouse playtest of the final file, reproducible screenshots, frame-time profiling, pixel diffs, a size gate, frame-stepped video with sound, and a cost log.
- **What worked for other people** ([`prompts/`](prompts), [`gallery/`](gallery), [`references/`](references)): exact prompts with their sources, and the patterns behind the games that spread.

## Try a starter by itself

```bash
npm run build -- --game=starters/racing      # starters/racing/dist/index.html, one file
npm run playtest -- --game=starters/racing   # plays a full round and prints what passed
open starters/racing/dist/index.html
```

## Time and cost of a run

Every run is stamped and priced in [`receipts/runs.jsonl`](receipts/runs.jsonl) (`npm run receipts -- report`). The worked example is [`games/cold-store`](games/cold-store), a horror FPS in a cold-storage warehouse, made with Claude Code on Claude Opus 5.5 from one sentence:

| Pass | Wall time | Cost at API list prices | What it added |
|---|---|---|---|
| First build | 50.7 min | $9.56 (main session $8.54, four review sub-agents $1.02) | warehouse, racking, flashlight, rigged enemies, three waves, playtest 37/37 |
| Second pass | 54.5 min | $8.13 | minimap, compass, objective, named radio, segmented health, scoped SMG |

Times run from the first stamp to the final playtest that passed. Cost counts the tokens between those stamps.

## Rules this repo keeps

- Original games only. Genres and mechanics are fair; names, characters, art and levels of existing games are not.
- Vendored code keeps its own licence (MIT, BSD, Apache or CC0), listed in [`third_party/NOTICES.md`](third_party/NOTICES.md). Models, textures and sounds are CC0 or CC-BY, credited in [`assets/CREDITS.md`](assets/CREDITS.md).
- Other people's games are linked, never copied.

## Going bigger

For a full studio workflow with many specialist agents, use [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios); this repo works beside it as the fast path to a playable file. For Godot, Unity, Unreal and other engines, use [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills). This repo is the fast lane to one playable browser game.

## Licence

Free for non-commercial use under [PolyForm Noncommercial 1.0.0](LICENSE). A game you share must keep the credit line named in `LICENSE`. Selling a game, or using this repo at work, needs a commercial licence: open an issue to ask.
