---
name: model-drop-arena
description: Run the same game prompts across several models, get every result playable, and produce a side-by-side page and cost table. Use the day a new model is released, or whenever someone wants models compared on a game.
---

# Model-drop arena

The repeatable format with the clearest evidence behind it: **same original game, two models, both playable, with the bills.** "$3.40 and 4 minutes against $23.46 and 113 minutes" tells a viewer something a benchmark score does not.

Timing from past launches: first-hour posts came from people with early access. Between about 2 and 9 hours after a launch, a vivid concept still breaks out, including from very small accounts. By about 4 hours the generic version of an idea has stopped working, so never lead with a clone. See `references/what-spreads.md`.

## Before the launch

Have three original concepts ready in `prompts/originals/`, so no time goes on choosing. Do a dry run on the current model, and write down the clock time. If it takes more than two hours, cut a game, not a check.

## Run

Hold everything fixed except the variable you're testing: same prompt, same repo state, same effort setting, same finish line. Change one thing at a time. Comparing model and team size together tells you nothing.

For each model, in its own clean copy of the repo:

```bash
npm run receipts -- run --game=<concept>-<model> --model=<model-id> --budget=<cap> "<prompt>"
```

That wraps `claude -p ... --output-format json`, which reports `total_cost_usd`. Always pass a budget: past runs ran from under $1 to over $500. For a model outside Claude Code, run it through its own CLI and log what it reports with `npm run receipts -- stamp`; leave a figure blank rather than estimate it. Artifacts can't be published from `-p` runs, so publishing comes after, by hand.

Long runs belong in the background, one after another or on separate machines, watching usage.

## Judge

Give every result the same treatment: `npm run playtest`, `npm run capture`, then you read the images. Record per model whether it runs, whether a full round is winnable, whether the design was honoured, and how it looks, plus repairs needed to get there.

Report failures. A model that produced a broken game at a low price is a finding, and leaving it out misleads.

## The page

Write `arena/<date>/index.html`: one self-contained page, one row per concept, one column per model. Each cell has the screenshot, a play link, minutes, dollars, and a note on anything that went wrong. Put the exact prompt at the top. Embed screenshots as data URIs, because artifact pages can't reach other hosts or use relative links. Link each game to its own published page. Build this page by hand for what this run actually showed; there is no template.

Cost table, from `npm run receipts -- report`:

| Model | Effort | Minutes | Dollars | Input tokens | Output tokens | Playable? | Repairs |
|---|---|---|---|---|---|---|---|

## The posts

Lead with the two bills and split-screen gameplay with sound. Drafts only, following `skills/record-and-post`. Nothing is posted without the person's say-so.
