---
name: add-starter
description: Turn an open-licence reference game, or a genre with no starter yet, into a tested starter under starters/<name> that builds to one HTML file and passes npm run playtest. Use when a genre is missing, or to rebuild a starter on better code.
---

# Add a starter

A starter is a complete, small, good-looking game in one genre that an agent rewrites into a new game from one sentence. `starters/fps-three` is the model: a tested kit in `src/kit/`, a replaceable default game in `src/game/`.

## 1. Pick the source

Read `references/AUDIT.md` (genres and sources) and open the screenshots in `references/audit/genres/`. Take code only under MIT, BSD, Apache-2.0 or CC0, verified from the LICENSE file, pinned to a commit. Copy with `node tools/vendor.mjs --from=<clone> --to=starters/<name>/src/kit <paths>` and record every copied or adapted file in `third_party/NOTICES.md` (file here, file there, what changed). No licence file means read it, copy nothing.

What to take from a source: the part graded as its best (feel, physics, AI, a shader, a level structure). What to write yourself: anything named after or shaped like an existing game.

## 2. Folder

```
starters/<name>/
  index.html            <canvas id="game">, <div id="ui">, one module script
  src/main.js           boots the kit and the game, installs the debug hooks
  src/kit/              engine pieces this genre needs, tested, genre-neutral
  src/game/             the default game: rules, level, look, entities, sounds, config, shots
  playtest.plan.mjs     the inputs to press and how to win a round
  README.md             what it is, its sources and licences, what to rewrite, three sentences to try
```

A 3D starter copies what it needs from `starters/fps-three/src/kit` (render with AO, shafts and grade; materials library; audio; textures; core engine, input, rng) rather than importing across folders, because `npm run new` copies one folder.

## 3. Hooks the tools rely on

- `window.__READY__ = true` after the first frames.
- `window.__GAME__.snapshot()` returns at least `{ state: 'title'|'playing'|'won'|'lost', score, frame, render: { renderer, drawCalls }, audio: { state, played } }` plus whatever the plan checks (player position, speed, lap, wave, health).
- `window.__GAME__.debug`: `restart()`, `lose()`, and `autoplay(on)` (a bot that plays through the same input path as the keyboard and can win a round), unless the plan has its own `play()`.
- `?seed=` seeds the RNG; `?q=low|medium|high` picks quality; `?capture=1&lockstep=1` with `window.__SHOTS__`, `__APPLY_SHOT__(name)`, `__PUMP__(n)`, `__PRESENT__(n)` so `npm run capture` works (copy `starters/fps-three/src/kit/debug/api.js`).
- Title screen over the live scene; click, tap or Enter starts; won and lost screens; click restarts.
- Sound made in code with Web Audio, resumed on the first input; count plays in `audio.played`.
- Touch: on-screen controls or gestures that can play the game.
- Artifact rules: no network, no external files or fonts, everything inline; `npm run size` under 3 MB.

## 4. The plan

```js
// playtest.plan.mjs
export default {
  start: 'click',
  timeout: 240,
  inputs: [
    { name: 'ArrowRight steers right', run: async ({ page, sleep }) => { await page.keyboard.down('ArrowRight'); await sleep(700); await page.keyboard.up('ArrowRight'); },
      expect: (a, b) => b.player.heading !== a.player.heading, detail: (a, b) => b.player.heading - a.player.heading },
  ],
  touch: async ({ page, snap, sleep }) => { /* tap a control, compare snapshots */ return true; },
};
```

Optional: `init: () => {...}` runs in every page before the game loads (stub `requestPointerLock` if the source grabs the pointer, which closes a headless page).

**Time must not depend on frame rate.** Software WebGL in the playtest draws 2 to 10 frames a second; a countdown or spawn timer that counts frames stalls for a minute. Drive gameplay from clamped delta time (max 0.1 s per frame), and give `?capture=1&lockstep=1` a fixed step, as `fps-three/src/kit/core/engine.js` does.

Every control in the README gets an input check. `tools/lib/playtest-genre.mjs` adds the rest: boot, title, start, audio, a full round won, screenshots, end screen, restart, lose, sandboxed iframe, touch, file://, no errors or external requests.

## 5. The bar

It must look like the best of its genre, not like a tutorial. Before calling it done:
- `npm run build -- --game=starters/<name>` and `npm run playtest -- --game=starters/<name>` pass.
- `npm run capture -- --game=starters/<name> --q=high`, then open every PNG next to the best reference screenshot for the genre. Light with a direction, materials that read, particles at the moment of action, a grade, a HUD with real typography, something moving in the first frame.
- The default game is original: no name, character, art or level from an existing game.

## 6. Route to it

Add the starter to the table in `skills/make-game/SKILL.md`, to `README.md` and to `CLAUDE.md`, with the sentence that should pick it.
