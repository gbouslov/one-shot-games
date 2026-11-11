# One-Shot Games, for Codex and other agents

Read `CLAUDE.md` in this folder: its rules and map apply to every agent.

**When someone asks for a game, open `skills/make-game/SKILL.md` and follow it.** Each step names another `skills/<name>/SKILL.md`. Read that file when you reach the step; `.agents/skills` and `.codex/skills` point to the same folder.

Differences from Claude Code:

- The critic and originality roles in `.claude/agents/` are plain instructions. Read the file and do the review yourself, or hand it to a sub-agent if yours supports that, and look at the screenshots with your image tool.
- `npm run receipts -- run` wraps Claude Code only. For a Codex run, take your wall clock with `npm run receipts -- stamp` and write token and cost figures into `receipts/runs.jsonl` only if your tool reported them.
- Publishing a Claude artifact needs a signed-in Claude Code session. From Codex, stop at `dist/index.html` and use the other hosts in `skills/package-artifact`.
