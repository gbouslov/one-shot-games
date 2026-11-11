/**
 * The playtest for every starter that is not first-person. tools/playtest.mjs
 * hands over here when the game folder has a `playtest.plan.mjs`.
 *
 * The game exposes (src/kit/debug or its own main.js):
 *   window.__READY__                      true once the first frames have drawn
 *   window.__GAME__.snapshot()            { state: 'title'|'playing'|'won'|'lost', score,
 *                                           frame, render: { renderer, drawCalls },
 *                                           audio: { state, played }, ...anything the plan reads }
 *   window.__GAME__.debug.restart()       a fresh round, state 'playing'
 *   window.__GAME__.debug.lose()          end the round as a loss
 *   window.__GAME__.debug.autoplay(on)    optional: the game's own bot plays through the SAME
 *                                         input path the keyboard uses, until the round is won
 *
 * The plan (`export default { ... }` in playtest.plan.mjs):
 *   inputs: [{ name, run: async (t) => {...}, expect: (before, after) => bool, detail?: (b, a) => any }]
 *             real keyboard, mouse or touch through Playwright; checked against two snapshots
 *   play:   async (t) => {}   optional real-input bot that tries to win; otherwise autoplay is used
 *   touch:  async (t) => bool optional check that a touch screen can play (defaults to: a tap starts)
 *   timeout: seconds allowed for the round (default 240)
 *   start:  'click' | 'key:<Key>'  how the title is dismissed (default click)
 *   init:   () => {}           optional, runs in the page before the game loads
 *   seed:   number             optional round seed (default 20261110); say in the plan why, and
 *                              what share of seeds the bot wins, so a pinned seed hides nothing
 * `t` is { page, snap, sleep, W, H, frame? } and, inside play(), also `deadline` (ms timestamp).
 */
import { pathToFileURL } from 'node:url';
import { launch, serve, sleep, waitInPage, waitReady, watchPage } from './harness.mjs';

export async function runGenrePlaytest({ dir, file, plan, args, check, shoot, report }) {
  const W = Number(args.w ?? 960);
  const H = Number(args.h ?? 540);
  const Q = args.q ?? (args.gpu ? 'high' : 'low');
  const server = await serve(file);
  const realBrowser = await launch(args);
  // plan.init runs in every page before the game's own scripts (e.g. a stub for
  // requestPointerLock, which closes a headless page in some engines).
  const withInit = async (page) => {
    if (plan.init) await page.addInitScript(plan.init);
    return page;
  };
  const browser = {
    newPage: async (o) => withInit(await realBrowser.newPage(o)),
    newContext: async (o) => {
      const c = await realBrowser.newContext(o);
      const np = c.newPage.bind(c);
      c.newPage = async () => withInit(await np());
      return c;
    },
    close: () => realBrowser.close(),
  };
  const snap = (p) => p.evaluate(() => window.__GAME__.snapshot());
  const waitFor = async (page, fn, ms, step = 60) => {
    const t0 = Date.now();
    for (;;) {
      const s = await snap(page);
      if (fn(s)) return s;
      if (Date.now() - t0 > ms) return null;
      await sleep(step);
    }
  };
  const start = async (page) => {
    if (plan.start?.startsWith('key:')) await page.keyboard.press(plan.start.slice(4), { delay: 60 });
    else await page.mouse.click(W / 2, H / 2);
  };
  report.quality = Q;
  report.viewport = `${W}x${H}`;

  try {
    /* 1. boot, input, a full round, end, restart, lose */
    {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      const faults = watchPage(page, server.url);
      const t0 = Date.now();
      await page.goto(`${server.url}/?q=${Q}&seed=${args.seed ?? plan.seed ?? 20261110}`, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      report.boot_ms = Date.now() - t0;
      let s = await snap(page);
      report.renderer = s.render?.renderer ?? null;
      check('page boots to the title screen', s.state === 'title', s.state);
      check('the renderer is drawing', (s.render?.drawCalls ?? 1) > 0, s.render);
      await shoot(page, '01-title');
      await start(page);
      s = await waitFor(page, (x) => x.state === 'playing', 5000);
      check('starting from the title begins the round', !!s, s?.state);
      s = await snap(page);
      check('audio context is running after the first input', s.audio?.state === 'running', s.audio?.state);

      const t = { page, snap: () => snap(page), sleep, W, H };
      for (const input of plan.inputs ?? []) {
        const a = await snap(page);
        await input.run(t);
        const b = await snap(page);
        check(input.name, !!input.expect(a, b), input.detail ? input.detail(a, b) : undefined);
      }
      await shoot(page, '02-play');

      await page.evaluate(() => window.__GAME__.debug.restart());
      await waitFor(page, (x) => x.state === 'playing', 3000);
      const timeout = (plan.timeout ?? 240) * 1000;
      const r0 = Date.now();
      let midShot = false;
      if (plan.play) {
        const deadline = r0 + timeout;
        const playing = plan.play({ ...t, deadline });
        // a mid-round frame for the eyes, whoever is playing
        const watcher = (async () => {
          await sleep(Math.min(8000, timeout / 3));
          const x = await snap(page).catch(() => null);
          if (x?.state === 'playing') { await shoot(page, '03-mid-round'); midShot = true; }
        })();
        await Promise.all([playing, watcher]);
      } else {
        const has = await page.evaluate(() => typeof window.__GAME__.debug.autoplay === 'function');
        check('the game has a bot to play a round (debug.autoplay)', has);
        if (has) {
          await page.evaluate(() => window.__GAME__.debug.autoplay(true));
          await sleep(Math.min(8000, timeout / 3));
          const x = await snap(page);
          if (x.state === 'playing') { await shoot(page, '03-mid-round'); midShot = true; }
        }
      }
      const end = await waitFor(page, (x) => x.state !== 'playing', Math.max(1000, timeout - (Date.now() - r0)), 200);
      await page.evaluate(() => window.__GAME__.debug.autoplay?.(false)).catch(() => {});
      const last = end ?? (await snap(page));
      report.round = { state: last.state, score: last.score, seconds_real: +((Date.now() - r0) / 1000).toFixed(1) };
      check('a full round is played to a win', last.state === 'won', report.round);
      check('a mid-round screenshot was taken', midShot);
      check('sounds were played', (last.audio?.played ?? 0) > 5, last.audio?.played);
      await shoot(page, '04-end-screen');

      await start(page);
      const again = await waitFor(page, (x) => x.state === 'playing', 5000);
      check('the end screen restarts the round', !!again);
      await page.evaluate(() => window.__GAME__.debug.lose());
      const lost = await waitFor(page, (x) => x.state === 'lost', 5000);
      check('losing shows the lose screen', !!lost);
      await start(page);
      const back = await waitFor(page, (x) => x.state === 'playing', 5000);
      check('restart works after a loss', !!back);
      check('no console errors, page errors or external requests', faults.length === 0, faults.slice(0, 8));
      report.faults = faults;
      await page.close();
    }

    /* 2. inside a sandboxed iframe, the way a Claude artifact is shown */
    {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      const faults = watchPage(page, server.url);
      await page.goto(`${server.url}/frame?q=low`, { waitUntil: 'domcontentloaded' });
      const frame = await (await page.waitForSelector('iframe')).contentFrame();
      await waitReady(frame);
      if (plan.start?.startsWith('key:')) {
        await page.mouse.click(W / 2, H / 2);
        await page.keyboard.press(plan.start.slice(4), { delay: 60 });
      } else await page.mouse.click(W / 2, H / 2);
      const ok = await waitInPage(frame, () => window.__GAME__.snapshot().state === 'playing', 8000).then(() => true, () => false);
      check('sandboxed iframe: the round starts', ok);
      const real = faults.filter((f) => !f.includes('Blocked pointer lock'));
      check('sandboxed iframe: no errors', real.length === 0, real.slice(0, 8));
      await page.close();
    }

    /* 3. a touch screen */
    {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
      const page = await context.newPage();
      const faults = watchPage(page, server.url);
      await page.goto(`${server.url}/?q=low`, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await page.touchscreen.tap(422, 195);
      const started = await waitInPage(page, () => window.__GAME__.snapshot().state === 'playing', 8000).then(() => true, () => false);
      check('touch: a tap starts the round', started);
      if (plan.touch && started) {
        const cdp = await context.newCDPSession(page);
        const ok = await plan.touch({ page, cdp, snap: () => snap(page), sleep, W: 844, H: 390 });
        check('touch: the game can be played by touch', !!ok);
      }
      check('touch: no errors', faults.length === 0, faults.slice(0, 8));
      await context.close();
    }

    /* 4. straight from disk */
    {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      const faults = watchPage(page, 'file:');
      await page.goto(`${pathToFileURL(file).href}?q=low`, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      check('opens from a local file with no server', (await snap(page)).state === 'title');
      check('local file: no errors', faults.length === 0, faults.slice(0, 8));
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}
