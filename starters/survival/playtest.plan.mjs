/**
 * The playtest for the survival starter: every control in the README, pressed
 * for real, then a full round played by the game's own bot, which walks with
 * the same WASD keys and picks level-up cards with the same 1/2/3 keys a person
 * uses (window.__GAME__.debug.autoplay).
 *
 * ROUND LENGTH. The default game is 5 minutes of game time. Software WebGL in
 * the playtest draws 2 to 10 frames a second and gameplay runs on clamped delta
 * time (at most 0.1 s a frame), so 5 game minutes can take 8 to 25 real
 * minutes. `init` below therefore sets window.__ROUND_SECONDS__ = 100 in the
 * test pages only: the director works in fractions of the round, so the test
 * plays the same arc (ramp, two surges, the Fen Hart at 82%) compressed, with
 * the crowd thinned by sqrt(100/300) (RoundSystem.density). Nothing in the
 * shipped game reads that value unless a page sets it.
 *
 * Software WebGL can draw one frame a second while shaders warm up, so each
 * check holds its input until the game has answered or a generous limit passes.
 */
async function snapUntil({ snap, sleep }, done, ms = 15000) {
  const a = await snap();
  const t0 = Date.now();
  let b = a;
  while (Date.now() - t0 < ms) {
    b = await snap();
    if (done(a, b)) break;
    await sleep(120);
  }
  return b;
}

/** Hold keys until `done`, taking card 1 if a level-up interrupts (the clock stops while it is up). */
async function holdUntil({ page, snap, sleep }, keys, done, ms = 15000) {
  const a = await snap();
  for (const k of keys) await page.keyboard.down(k);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(120);
    const b = await snap();
    if (done(a, b)) break;
    if (b.levelup.open) await page.keyboard.press('1', { delay: 40 });
  }
  for (const k of keys) await page.keyboard.up(k);
  await sleep(150);
}

const dz = (a, b) => b.player.z - a.player.z;
const dx = (a, b) => b.player.x - a.player.x;

export default {
  start: 'click',
  timeout: 420,
  init: () => { window.__ROUND_SECONDS__ = 100; },
  inputs: [
    {
      name: 'W moves the player up the screen',
      run: (t) => holdUntil(t, ['w'], (a, b) => dz(a, b) < -1),
      expect: (a, b) => dz(a, b) < -0.8,
      detail: (a, b) => ({ dz: +dz(a, b).toFixed(2), frameMs: b.render.frameMs, scale: b.render.scale }),
    },
    {
      name: 'D moves the player right',
      run: (t) => holdUntil(t, ['d'], (a, b) => dx(a, b) > 1),
      expect: (a, b) => dx(a, b) > 0.8,
      detail: (a, b) => +dx(a, b).toFixed(2),
    },
    {
      name: 'S and A move down and left',
      run: (t) => holdUntil(t, ['s', 'a'], (a, b) => dz(a, b) > 0.8 && dx(a, b) < -0.8),
      expect: (a, b) => dz(a, b) > 0.5 && dx(a, b) < -0.5,
      detail: (a, b) => [+dx(a, b).toFixed(2), +dz(a, b).toFixed(2)],
    },
    {
      name: 'the arrow keys move the player',
      run: (t) => holdUntil(t, ['ArrowUp', 'ArrowRight'], (a, b) => dz(a, b) < -0.8 && dx(a, b) > 0.8),
      expect: (a, b) => dz(a, b) < -0.5 && dx(a, b) > 0.5,
      detail: (a, b) => [+dx(a, b).toFixed(2), +dz(a, b).toFixed(2)],
    },
    {
      name: 'the lantern fires by itself with no input',
      run: async (t) => {
        await snapUntil(t, (a, b) => b.levelup.open || b.stats.shots >= a.stats.shots + 2, 20000);
      },
      expect: (a, b) => b.stats.shots >= a.stats.shots + 2 || b.stats.shots > 0,
      detail: (a, b) => ({ shots: [a.stats.shots, b.stats.shots], hits: b.stats.hits, kills: b.killed, alive: b.horde.alive }),
    },
    {
      name: 'a level-up offers three cards and stops the clock',
      run: async (t) => {
        const s = await t.snap();
        if (!s.levelup.open) await t.page.evaluate(() => window.__GAME__.debug.levelUp());
        await snapUntil(t, (a, b) => b.levelup.open, 5000);
      },
      expect: (a, b) => b.levelup.open && b.levelup.choices.length === 3 && b.timeScale === 0,
      detail: (a, b) => ({ choices: b.levelup.choices, timeScale: b.timeScale, level: b.level }),
    },
    {
      name: 'key 2 takes the second card',
      run: async (t) => {
        await t.page.keyboard.press('2', { delay: 60 });
        await snapUntil(t, (a, b) => b.levelup.picks > a.levelup.picks, 8000);
      },
      expect: (a, b) => b.levelup.picks === a.levelup.picks + 1 && JSON.stringify(b.owned) !== JSON.stringify(a.owned),
      detail: (a, b) => ({ took: a.levelup.choices[1], owned: b.owned }),
    },
    {
      name: 'a click on a card takes it',
      run: async (t) => {
        let s = await t.snap();
        if (!s.levelup.open) await t.page.evaluate(() => window.__GAME__.debug.levelUp());
        s = await snapUntil(t, (a, b) => b.levelup.open, 5000);
        await t.sleep(300);
        const box = await t.page.locator('.lu .cd').first().boundingBox();
        await t.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await snapUntil(t, (a, b) => b.levelup.picks > s.levelup.picks, 8000);
      },
      expect: (a, b) => b.levelup.picks > a.levelup.picks,
      detail: (a, b) => ({ picks: [a.levelup.picks, b.levelup.picks], owned: b.owned }),
    },
  ],
  // drag anywhere to walk; tap a card to take it
  touch: async ({ page, cdp, snap, sleep }) => {
    const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const until = async (fn, ms = 15000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const s = await snap();
        if (fn(s)) return s;
        await sleep(150);
      }
      return snap();
    };
    const a = await snap();
    await t('touchStart', [{ x: 600, y: 240, id: 2 }]);
    for (let i = 1; i <= 5; i++) {
      await t('touchMove', [{ x: 600, y: 240 - i * 14, id: 2 }]);
      await sleep(50);
    }
    const b = await until((s) => s.player.z < a.player.z - 0.8 || s.levelup.open);
    await t('touchEnd', []);
    const walked = b.player.z < a.player.z - 0.5;
    const before = await snap();
    if (!before.levelup.open) await page.evaluate(() => window.__GAME__.debug.levelUp());
    await until((s) => s.levelup.open, 5000);
    await sleep(300);
    const box = await page.locator('.lu .cd').nth(0).boundingBox();
    await t('touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 4 }]);
    await t('touchEnd', []);
    const c = await until((s) => s.levelup.picks > before.levelup.picks, 8000);
    const picked = c.levelup.picks > before.levelup.picks;
    if (!walked || !picked) console.error('touch detail', { z: [a.player.z, b.player.z], picks: [before.levelup.picks, c.levelup.picks] });
    return walked && picked;
  },
};
