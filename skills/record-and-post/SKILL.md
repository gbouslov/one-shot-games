---
name: record-and-post
description: Record gameplay with sound, collect the measured time and cost of a run, and draft the post with the prompt. Use when a game is finished and ready to show.
---

# Record and post

## Capture

```bash
npm run record -- --game=games/<slug> --seconds=45 --fps=60
```

This plays the game frame by frame with a bot and writes `games/<slug>/video/gameplay.mp4` with the game's own sound. Stepping means the video is smooth even on a machine with no graphics card, at the price of waiting for it: budget about half a second to a second of real time per frame in software.

Watch the result (pull frames with `ffmpeg -i gameplay.mp4 -vf fps=1 frame-%02d.png` and read them).

- Length: the posts in the research ran 20 to 147 seconds. 45 to 75 is the plan.
- **The first second has to show the best thing.** Cut the opening with ffmpeg if the bot wanders first. Better still, adjust `tools/lib/bot-driver.js` for this game, or teleport the player at the start.
- **It needs sound,** which this produces. Check it isn't silent or clipped.
- The bot plays adequately and no more. For a hero clip, record yourself on a real machine with a screen recorder. It usually looks better, and that's honest footage.

## Receipts

```bash
npm run receipts -- report --game=<slug>
```

Use only what's there. Hours, tokens and dollars travel: "$550, 8 hours, 2.7M output tokens" was the line people quoted. If a run happened inside an interactive session, its cost may not be in the log; say what you measured and nothing more. **Never write a time saving, or a number, that this log can't back.** For the honest comparison, run the same prompt, model and settings once with this repo and once on a blank folder, count setup and repairs, and report both.

Credit the model truthfully, with the actual name and effort setting used.

## The post

Draft to `games/<slug>/POST.md`. Do not post. In order:

1. **Main post.** A concrete first line with one number you own, the game's premise, the video.
2. **First reply or main post: the play link.** Both placements worked in the research.
3. **Next reply: the exact prompt,** copied, not paraphrased. The prompt post is a second chance at reach: it did 15,944 views under one launch, and another 16,717 when someone else quoted it.
4. **A repair story** if something broke in an interesting way. It's the part only you have.

Rules for the text: what the viewer sees and can do, plain words, no hype adjectives, no claims you can't show. Add the tag for the model's maker only when true.

Before the post goes out, every link must return 200, opened logged out. See the sharing rules in `skills/package-artifact`.

If the game shipped in this repo, add a row to `gallery/games.json` and a recipe in `prompts/recipes/`.
