/**
 * The playtest for the top-down starter: every control in the README, pressed
 * for real, then a full round played by the game's own bot through the same
 * keys (window.__GAME__.debug.autoplay).
 *
 * Software WebGL can draw one frame a second while the shaders warm up, so each
 * check holds its input until the game has answered or a generous limit passes,
 * instead of a fixed number of milliseconds.
 */
const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));

/** Hold keys down until `done(snapshot)` or `ms` pass, then release them. */
async function holdUntil({ page, snap, sleep }, keys, done, ms = 15000) {
  const a = await snap();
  for (const k of keys) await page.keyboard.down(k);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(120);
    if (done(a, await snap())) break;
  }
  for (const k of keys) await page.keyboard.up(k);
  await sleep(150);
}

async function waitFor({ snap, sleep }, done, ms = 15000) {
  const a = await snap();
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (done(a, await snap())) return;
    await sleep(120);
  }
}

const dz = (a, b) => b.player.z - a.player.z;
const dx = (a, b) => b.player.x - a.player.x;

export default {
  start: 'click',
  timeout: 420,
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
      name: 'the mouse aims the player',
      run: async (t) => {
        await t.page.mouse.move(t.W * 0.85, t.H * 0.5, { steps: 3 });
        await waitFor(t, (a, b) => Math.abs(wrap(b.player.yaw - Math.PI / 2)) < 0.6);
      },
      expect: (a, b) => Math.abs(wrap(b.player.yaw - Math.PI / 2)) < 0.6,
      detail: (a, b) => +b.player.yaw.toFixed(2),
    },
    {
      name: 'holding the left button fires',
      run: async (t) => {
        await t.page.mouse.move(t.W * 0.85, t.H * 0.5);
        const a = await t.snap();
        await t.page.mouse.down();
        await waitFor(t, (x, b) => b.stats.shots >= a.stats.shots + 3);
        await t.page.mouse.up();
      },
      expect: (a, b) => b.stats.shots >= a.stats.shots + 2 && b.weapon.ammo < a.weapon.ammo,
      detail: (a, b) => ({ shots: b.stats.shots - a.stats.shots, ammo: b.weapon.ammo }),
    },
    {
      name: 'R reloads',
      run: async (t) => {
        await t.page.keyboard.press('r', { delay: 60 });
        await waitFor(t, (a, b) => !b.weapon.reloading && b.weapon.ammo === b.weapon.magazine, 30000);
      },
      expect: (a, b) => b.weapon.ammo === b.weapon.magazine && a.weapon.ammo < a.weapon.magazine,
      detail: (a, b) => [a.weapon.ammo, b.weapon.ammo],
    },
    {
      name: 'Space dashes',
      run: async (t) => {
        await t.page.keyboard.press('Space', { delay: 60 });
        await waitFor(t, (a, b) => b.player.dashes > a.player.dashes, 8000);
      },
      expect: (a, b) => b.player.dashes > a.player.dashes,
      detail: (a, b) => b.player.dashes,
    },
    {
      name: 'Q swaps the weapon',
      run: async (t) => {
        await t.page.keyboard.press('q', { delay: 60 });
        await waitFor(t, (a, b) => b.weapon.id !== a.weapon.id, 8000);
      },
      expect: (a, b) => b.weapon.id !== a.weapon.id,
      detail: (a, b) => [a.weapon.id, b.weapon.id],
    },
    {
      name: 'key 1 selects the first weapon',
      run: async (t) => {
        await t.page.keyboard.press('1', { delay: 60 });
        await waitFor(t, (a, b) => b.weapon.index === 0, 8000);
      },
      expect: (a, b) => b.weapon.index === 0,
      detail: (a, b) => b.weapon.id,
    },
  ],
  // the right stick aims and fires, the left stick walks
  touch: async ({ cdp, snap, sleep }) => {
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
    await t('touchStart', [{ x: 640, y: 220, id: 2 }]);
    for (let i = 1; i <= 5; i++) {
      await t('touchMove', [{ x: 640 + i * 14, y: 220, id: 2 }]);
      await sleep(50);
    }
    const b = await until((s) => s.stats.shots > a.stats.shots);
    await t('touchEnd', []);
    await t('touchStart', [{ x: 160, y: 220, id: 3 }]);
    for (let i = 1; i <= 5; i++) {
      await t('touchMove', [{ x: 160, y: 220 - i * 14, id: 3 }]);
      await sleep(50);
    }
    const c = await until((s) => s.player.z < b.player.z - 0.8);
    await t('touchEnd', []);
    const fired = b.stats.shots > a.stats.shots;
    const walked = c.player.z < b.player.z - 0.5;
    if (!fired || !walked) console.error('touch detail', { shots: [a.stats.shots, b.stats.shots], z: [b.player.z, c.player.z] });
    return fired && walked;
  },
};
