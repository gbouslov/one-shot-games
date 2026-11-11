---
name: package-artifact
description: Pack a game into one self-contained HTML file that runs as a Claude artifact or on any static host, and check it obeys the rules. Use when a game is ready to share, or when something fails only once embedded.
---

# Package as one file

```bash
npm run build -- --game=games/<slug>
npm run playtest -- --game=games/<slug>
```

The build inlines everything into `games/<slug>/dist/index.html` and runs the size gate. Full rules are in `references/artifact-rules.md`. The ones that break games:

| Rule | What to do |
|---|---|
| One page, 16 MiB at most | Budget 3 MB. Generate art and sound in code. |
| Scripts only from a few CDNs | Inline everything, as this build does. Whether an import map from a CDN runs under the policy is untested, so don't depend on it. |
| Network only to the page's own origin | No leaderboard servers, no remote assets, no multiplayer. |
| Pointer lock may be refused | The kit falls back to drag-to-look. The playtest proves this in a sandboxed iframe. Don't remove it. |
| Storage may throw | Wrap every `localStorage` read and write in try/catch and have a default. |
| Audio needs a click | Create sound from the first user gesture: `audio.unlock()` already does. |
| No downloads, no relative links | Keep everything inside the page. |

If you add a third-party library, bundle it with the game and record it in `third_party/NOTICES.md`. MIT, BSD, Apache or CC0 only.

## Publishing is the person's decision

Prepare everything; do not publish without being told to. When they say yes:

**As a Claude artifact.** Needs an interactive Claude Code session signed in with `/login` on a Pro, Max, Ultra, Team or Enterprise plan. API keys and `claude -p` runs cannot publish. Publish `dist/index.html`. New artifacts are private: the person shares it from the header, and on Team and Enterprise public sharing needs an Owner to enable it. Republishing the same file keeps the URL.

**Several games.** Make one small hub page with a card per game linking to each artifact, the way the "Three Games" hub did it, because relative links do not resolve.

**Other hosts** when an artifact won't do: `vercel deploy`, Netlify, Cloudflare Pages, GitHub Pages, or itch.io (zip with `index.html`). All accept this file unchanged. Size limits differ.

**Before any post goes out**, open each link logged out and confirm it returns 200 and plays.

## After publishing

Say which of these you actually verified: loads in the real host, pointer lock works there, sound plays, phone layout. The local playtest approximates the artifact's rules; the real page is the proof.
