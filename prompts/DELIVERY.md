# The standard ending

End every game prompt with this. It is what turns a good first draft into a file you can share. It's assembled from what worked: "one standalone page file", "no runtime requests", "no audio files, generate every sound in code", "after each system, play it yourself, screenshot it and fix what looks wrong".

```text
Deliver one standalone HTML file under 3 MB with everything embedded and no external requests of any kind. Generate every sound and every texture in code. Make it small in scope and finished: a win, a loss and a restart. If pointer lock is refused, fall back to drag to look. Support touch. Wrap every localStorage call in try/catch. Start audio on the first click. After each system, play it yourself in a headless browser, look at the screenshots and fix what looks wrong. Do not stop until a stranger could play a full round without hitting a bug.
```

Inside this repo, `skills/make-game` already enforces all of it, so you don't need the clause. It's for when you paste a prompt into a chat or a blank folder.
