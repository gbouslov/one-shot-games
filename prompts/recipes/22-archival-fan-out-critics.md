# The prompt that made a 55k-line shooter

**Status:** Archival: names an existing game

| | |
|---|---|
| Source | [@mattshumer_](https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md) |
| Model | not named in the README |
| What it made | A first-person shooter of about 55k lines, generated with no art assets. Best critic score 5.05 of 10, by its own report |
| Time and cost | not stated |
| Reach | repo 3,512 stars, 537 forks |

## The prompt, exactly as posted

```text
I want you to build a first-person shooter at the level of the most recent Call of Duty games. It should be utterly perfect, visually beautiful, with every single thing done at AAA quality—from textures to physics to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the game is utterly perfect. You should /loop on each item and have a separate sub-agent check it visually to ensure it looks triple A. That separate sub-agent should be a really harsh critic, and if it doesn't look triple A, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual Call of Duty game. It should literally compare them side by side blind and say which one looks better. Do this in ThreeJS. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

## How to use it

Most of this repo’s starter derives from that project. Its README reports that one sequential owner beat parallel agents, and that the harsh-critic loop moved its score from 3.59 to 5.05. Keep the critic. Drop the named target.

This prompt names an existing game. It is kept as a record of what was asked. Rewrite it as an original design before building anything from it: `skills/design-brief` does that.
