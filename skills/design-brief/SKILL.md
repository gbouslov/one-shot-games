---
name: design-brief
description: Write a one-page original design for a browser game and check it does not borrow from an existing game. Use before building any game, and to rewrite a prompt that names an existing game into an original one.
---

# Design brief

Write `games/<slug>/DESIGN.md`. One page. It is the contract for everything after it.

## Read the genre sheet first

`third_party/studio-genres/chipsets/<genre>.md` (69 genres, from Claude-Code-Game-Studios, MIT) gives the camera, the default rules with why and when to break them, the feel rules, three feel variants and what never belongs in a one-shot. Pick the closest sheet (`chipsets.yaml` lists them; `mashups.md` covers two-genre prompts) and let its defaults answer what you would otherwise guess. `art-direction.md` beside it is the one-page form for the look line: mood, camera and scale, shape and value, palette roles, where detail goes, one signature detail. Its table of looks names commercial games: use it for direction, then run the originality check below.

## Decide these yourself

1. **The sentence.** Their words, verbatim, at the top.
2. **The premise in one line someone would repeat to a friend.** Concept beats genre: the games that spread were a boat through eight dreamlike worlds, a reversed haunted-mansion mystery, a ticket queue turned into horror. Generic clones stopped spreading within hours of a model launch (`references/what-spreads.md`).
3. **The first second.** What is on screen and moving in the very first frame of the video? If you cannot picture it, the idea is not sharp yet.
4. **The one verb.** What the player does most. Then the two that support it.
5. **The loop.** Do, reward, escalate. Say how each system feeds the next.
6. **Scope, cut hard.** One place. Two or three enemy types. Two or three weapons or tools. A round that ends in under five minutes, with a win, a loss and a restart.
7. **The look in five words,** and a palette of four colours. Time of day, weather, the one thing that glows.
8. **Sound.** The air of the place, and what the main action sounds like.
9. **What done means.** Three things a stranger must be able to do, written so the playtest can check them.
10. **Every word the player reads.** Write the tagline, wave banners and end screens now, under one rule. Player text is an objective ("HOLD THE DOCK"), a direction ("CONTACT – WEST"), a count ("WAVE 2/3 · 6 LEFT", "LAP 2/3") or a named person on a radio ("Dispatch: Motion in aisle 3."). No puns on the title or the job, no two-beat poetic lines ("The lights come back. The cold holds."), no vague "something" or "they" as the subject, no clichés. Every end screen shows numbers. The first two games' text was read on 11 Nov 2026 as "AI slop"; the before-and-after table is in `references/WORDING.md`.

## Originality check, before any code

Go through the design with this order of steps, adapted from a prompt by @vibelancer:

1. List every mechanic, name, asset, character, level and visual signature that matches a specific existing game.
2. For each one, propose an original replacement that keeps the genre feel.
3. Rewrite the design with only the originals.

Genres and mechanics are free: first-person, waves, block-building and capture-the-flag belong to no one. Names, characters, logos, music, level layouts and distinctive art do. "In the style of [named game]" is out, and so is a title that echoes one.

If the request names an existing game, don't refuse and don't copy it. Identify what the person actually likes about it, and design an original game that delivers that. Say in one line what you changed. Files marked archival in `prompts/recipes/` get the same treatment.

For an independent read, give the design to the `originality-checker` agent.

## The page

```markdown
# <Title>
> <their exact sentence>

**Premise:** ...
**First second:** ...
**Verb, and two more:** ...
**Loop:** ...
**Scope:** place / enemies / tools / round length
**Look:** five words; palette
**Sound:** ...
**Done means:** 1. ... 2. ... 3. ...
**Originality:** what was changed, or "nothing matched"
```
