// Playtest plan for the flight starter (run by tools/lib/playtest-genre.mjs).
// Every control in the README gets a check here, pressed through Playwright's
// real keyboard and checked against the flight model's state. The round is
// won by the game's own bot (debug.autoplay), which holds the same key codes
// in the same control map the keyboard writes. Software WebGL draws a few
// frames a second and game time is clamped to 0.1 s a frame, so holds are
// measured in game seconds and the round timeout is generous.

const until = async (t, fn, ms) => {
  const t0 = Date.now();
  for (;;) {
    const s = await t.snap();
    if (fn(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await t.sleep(100);
  }
};
const turn = (a, b) => Math.atan2(Math.sin(b.player.heading - a.player.heading), Math.cos(b.player.heading - a.player.heading));
/** Hold keys for `game` seconds of game time (frames are slow and uneven). */
const hold = async (t, keys, game, cap = 60000) => {
  for (const k of keys) await t.page.keyboard.down(k);
  const a = await t.snap();
  await until(t, (s) => s.roundTime - a.roundTime >= game, cap);
  for (const k of keys) await t.page.keyboard.up(k);
};
const level = (t) => until(t, (s) => Math.abs(s.player.bank) < 0.06, 60000);
const r3 = (v) => +v.toFixed(3);

export default {
  start: 'click',
  timeout: 1200,
  inputs: [
    {
      name: 'S pulls the nose up',
      run: (t) => hold(t, ['s'], 0.35),
      expect: (a, b) => b.player.pitch > a.player.pitch + 0.12,
      detail: (a, b) => ({ before: r3(a.player.pitch), after: r3(b.player.pitch) }),
    },
    {
      name: 'W pushes the nose down',
      run: (t) => hold(t, ['w'], 0.25),
      expect: (a, b) => b.player.pitch < a.player.pitch - 0.1,
      detail: (a, b) => ({ before: r3(a.player.pitch), after: r3(b.player.pitch) }),
    },
    {
      name: 'D rolls right',
      run: (t) => hold(t, ['d'], 0.3),
      expect: (a, b) => b.player.bank > a.player.bank + 0.15,
      detail: (a, b) => ({ before: r3(a.player.bank), after: r3(b.player.bank) }),
    },
    {
      name: 'A rolls left',
      run: (t) => hold(t, ['a'], 0.5),
      expect: (a, b) => b.player.bank < a.player.bank - 0.15,
      detail: (a, b) => ({ before: r3(a.player.bank), after: r3(b.player.bank) }),
    },
    {
      name: 'hands off, the wings level themselves',
      run: (t) => level(t),
      expect: (a, b) => Math.abs(a.player.bank) > 0.1 && Math.abs(b.player.bank) < 0.06,
      detail: (a, b) => ({ before: r3(a.player.bank), after: r3(b.player.bank) }),
    },
    {
      name: 'E yaws the nose right',
      run: (t) => hold(t, ['e'], 0.5),
      expect: (a, b) => turn(a, b) > 0.05,
      detail: (a, b) => ({ turn: r3(turn(a, b)) }),
    },
    {
      name: 'Q yaws the nose left',
      run: async (t) => {
        await level(t);
        await hold(t, ['q'], 0.6);
      },
      expect: (a, b) => turn(a, b) < -0.05,
      detail: (a, b) => ({ turn: r3(turn(a, b)) }),
    },
    {
      name: 'F lowers the throttle',
      run: (t) => hold(t, ['f'], 0.4),
      expect: (a, b) => b.player.throttle < a.player.throttle - 0.1,
      detail: (a, b) => ({ before: r3(a.player.throttle), after: r3(b.player.throttle) }),
    },
    {
      name: 'Shift raises the throttle',
      run: (t) => hold(t, ['Shift'], 0.3),
      expect: (a, b) => b.player.throttle > a.player.throttle + 0.08,
      detail: (a, b) => ({ before: r3(a.player.throttle), after: r3(b.player.throttle) }),
    },
    {
      name: 'R raises the throttle',
      run: (t) => hold(t, ['r'], 0.3),
      expect: (a, b) => b.player.throttle > a.player.throttle + 0.08,
      detail: (a, b) => ({ before: r3(a.player.throttle), after: r3(b.player.throttle) }),
    },
    {
      name: 'M mutes the sound',
      run: async (t) => {
        await t.page.keyboard.press('m', { delay: 60 });
        await t.sleep(200);
      },
      expect: (a, b) => b.audio.muted && !a.audio.muted,
    },
    {
      name: 'M again unmutes',
      run: async (t) => {
        await t.page.keyboard.press('m', { delay: 60 });
        await t.sleep(200);
      },
      expect: (a, b) => !b.audio.muted,
    },
  ],
  // Touch: drag the floating stick in the left half to the right; the plane banks right.
  touch: async ({ page, cdp, snap, sleep }) => {
    const box = await page.locator('#stick-zone').boundingBox();
    if (!box) return false;
    const x = box.x + box.width * 0.4;
    const y = box.y + box.height * 0.6;
    const a = await snap();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await sleep(100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 50, y, id: 1 }] });
    const t1 = Date.now();
    let b = a;
    while (b.roundTime - a.roundTime < 0.3 && Date.now() - t1 < 60000) {
      await sleep(150);
      b = await snap();
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return b.touch && b.state === 'playing' && b.player.bank > a.player.bank + 0.1;
  },
};
