# Artifact rules

From Claude Code's [artifact documentation](https://code.claude.com/docs/en/artifacts) and the [sharing article](https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts), read 10 Nov 2026. Check them again before depending on an edge case.

| Rule | Exact effect |
|---|---|
| Who can publish | Pro, Max, Ultra, Team, Enterprise, signed in with `/login`. Sessions using an API key, gateway token or cloud credential cannot. |
| Unattended runs | Off by default under `claude -p`, the Agent SDK and the GitHub Action. A batch run can build a game but cannot publish it. |
| Shape | One self-contained page, no backend. Relative links do not resolve. `.html`, `.htm` or `.md`, UTF-8. |
| Size | The rendered page must be 16 MiB or smaller. |
| Scripts | Only from cdnjs, unpkg, the Tailwind and jQuery CDNs, and jsDelivr `/npm/`. Everything else is inlined. |
| Fonts | Only from Google Fonts. |
| Images | External images are blocked. Use data URIs or generate them. |
| Network | `fetch`, XHR and WebSocket reach only the page's own origin and the Google Fonts hosts. |
| Downloads | The page can't start a download without the downloads capability. |
| Sharing | New artifacts are private. Public links need no sign-in. On Team and Enterprise, public sharing is off until an Owner enables External sharing. |
| Updating | Republishing the same file keeps the URL. Each publish is a version. |

## What a working game looks like

One public game, Saltline, is a single HTML page of 1,464,373 bytes with three.js r180 pasted inline, no CDN, sound and textures generated in code, and a drag-to-look fallback when pointer lock fails. Another maker's game fitted "a single 3 MB HTML file". A third reached 27.8 MB, which the artifact limit would refuse.

This repo builds to about 0.6 MB before your game content, and gates at 3 MB.

## What isn't known

- The exact content policy header isn't published. `tools/lib/harness.mjs` approximates it from the rules above.
- Whether import maps from an approved CDN run under that policy.
- Whether pointer lock is granted inside a real artifact page. The kit works either way, and the playtest covers the refused path.
- Whether X shows a preview card for an artifact link.
