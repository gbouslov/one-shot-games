# Prompts

Prompts that produced real games and scenes, quoted exactly as their authors posted them, each with its source. Times and costs are what the author reported. "Not stated" means they did not say.

Every recipe was graded in the reference audit of 10 Nov 2026 (`references/AUDIT.md`): **A** produced a game at the bar, **B** carries a technique worth using. The twelve graded C (named-game clones, toys, a deleted source, an advert) are out of this index; the one useful line among them, the follow-up "eh looks basic, make it hdr", now lives in `skills/make-it-look-great`.

- Own concepts, not yet run, are in [`originals/`](originals/).
- End anything you paste elsewhere with [`DELIVERY.md`](DELIVERY.md).

## What the prompts that worked have in common

- **Short and demanding.** One or two sentences, with a high bar.
- **A delivery clause.** One file, no external requests, every sound generated in code. This is what makes a run end in something shareable.
- **A self-check.** "After each system, play it yourself, screenshot it and fix what looks wrong."
- **A premise, not a genre.** The ones people repeated had an idea you could say in a sentence.

## Recipes

| Grade | Recipe | What to use | Author | Model | Time and cost |
|---|---|---|---|---|---|
| A | [One sentence, a first-person shooter](recipes/01-short-fps.md) | The whole prompt, especially "make it small in scope (like a tiny level)". It produced the bar | @felixrieseberg | Claude Fable 5.2 | $550, 8 hours, 2.7M output tokens (author report, autonomous run) |
| B | [A loop where every system feeds the next, with a self-check](recipes/02-systems-feed-each-other.md) | The loop-and-feed structure and the "a stranger plays for 10 minutes" stop rule; not its city-crime setting | @ericmaskfr | Claude Fable 5.2 | 2 hours 14 minutes on a $200 plan (author report) |
| B | [A scene with a strict delivery clause](recipes/04-boat-standalone-page.md) | "No text of any kind inside the scene" | @MengTo | Claude Opus 5.5 | not stated |
| B | [One vivid sentence, a boss fight](recipes/05-boss-in-one-line.md) | A model-comparison seed; the scale contrast as a concept test | @RoundtableSpace | Gemini 4 Argon; Muse Wonder | not stated |
| B | [Three words, one strong image](recipes/07-night-train.md) | The model-drop-arena seed; add a player verb before building a game from it | @EnvolDev | not stated | not stated |
| B | [Your own character, a real skeleton](recipes/10-rig-a-character.md) | The personal-input pattern and the explicit animation list | @bonsaixbt | Claude Opus 5.5 | not stated |
| B | [Build in numbered steps](recipes/11-stepwise-shooter.md) | The step structure for a model comparison with per-model cost | @slash1sol | GPT-6 Astra; Claude Opus 5.5; Kimi K3.1 Pro | $2.55 Astra, $1.93 Opus, $0.31 Kimi (author report) |
| B | [A check with no fixes allowed](recipes/13-asset-check.md) | "Don't fix anything yet" as the opening of a playtest report | @rewind02 | not stated | not stated |
| B | [Find what is too close to an existing game](recipes/14-originality-review.md) | The source of `skills/design-brief`'s originality check | @vibelancer | Claude Code | not stated |
| C, one line kept | [Two prompts](recipes/17-archival-block-world-two-step.md) | Only the second prompt, rejecting the first look ("eh looks basic, make it hdr"); the first names an existing game | @RezAIT00 | Claude Fable 5.2, extra high | not stated |
