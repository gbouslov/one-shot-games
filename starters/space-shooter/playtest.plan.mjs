// Playtest plan for the space-shooter starter (run by tools/lib/playtest-genre.mjs).
// Every control in the README gets a check here, pressed through Playwright's
// real keyboard and mouse and checked against the ship's state. The round is
// won by the game's own bot (debug.autoplay), which holds the same key codes in
// the same control map the keyboard writes. Software WebGL draws a few frames a
// second and game time is clamped to 0.1 s a frame, so holds are measured in
// game seconds and the round timeout is generous.

const until = async (t, fn, ms) => {
  const t0 = Date.now();
  for (;;) {
    const s = await t.snap();
    if (fn(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await t.sleep(100);
  }
};
/** Hold keys for `game` seconds of game time (frames are slow and uneven). */
const hold = async (t, keys, game, cap = 60000) => {
  for (const k of keys) await t.page.keyboard.down(k);
  const a = await t.snap();
  await until(t, (s) => s.roundTime - a.roundTime >= game, cap);
  for (const k of keys) await t.page.keyboard.up(k);
};
/** Let the ship drift back toward the centre of the box first, so a move has room. */
const centre = async (t, axis) => {
  const s = await t.snap();
  const v = s.player[axis];
  if (Math.abs(v) < 4) return;
  const key = axis === 'x' ? (v > 0 ? 'ArrowLeft' : 'ArrowRight') : (v > 0 ? 'ArrowDown' : 'ArrowUp');
  await t.page.keyboard.down(key);
  await until(t, (x) => Math.abs(x.player[axis]) < 2, 30000);
  await t.page.keyboard.up(key);
};
const r2 = (v) => +v.toFixed(2);
const steer = (name, key, axis, sign) => ({
  name,
  run: async (t) => {
    await centre(t, axis);
    await hold(t, [key], 0.3);
  },
  expect: (a, b) => sign * (b.player[axis] - a.player[axis]) > 1.5,
  detail: (a, b) => ({ before: r2(a.player[axis]), after: r2(b.player[axis]) }),
});

export default {
  start: 'click',
  timeout: 1500,
  inputs: [
    steer('ArrowRight steers right', 'ArrowRight', 'x', 1),
    steer('ArrowLeft steers left', 'ArrowLeft', 'x', -1),
    steer('ArrowUp climbs', 'ArrowUp', 'y', 1),
    steer('ArrowDown dives', 'ArrowDown', 'y', -1),
    steer('D steers right', 'd', 'x', 1),
    steer('A steers left', 'a', 'x', -1),
    steer('W climbs', 'w', 'y', 1),
    steer('S dives', 's', 'y', -1),
    {
      name: 'steering right banks the ship',
      run: (t) => hold(t, ['ArrowRight'], 0.25),
      expect: (a, b) => b.player.bank < -0.1,
      detail: (a, b) => ({ bank: r2(b.player.bank) }),
    },
    {
      name: 'Space fires',
      run: (t) => hold(t, [' '], 0.4),
      expect: (a, b) => b.player.shots >= a.player.shots + 2,
      detail: (a, b) => ({ shots: b.player.shots - a.player.shots }),
    },
    {
      name: 'holding the mouse button fires',
      run: async (t) => {
        await t.page.mouse.move(t.W * 0.75, t.H * 0.3);
        await t.page.mouse.down();
        const a = await t.snap();
        await until(t, (s) => s.roundTime - a.roundTime >= 0.4, 60000);
        await t.page.mouse.up();
      },
      expect: (a, b) => b.player.shots >= a.player.shots + 2 && b.state === 'playing',
      detail: (a, b) => ({ shots: b.player.shots - a.player.shots, state: b.state }),
    },
    {
      name: 'Shift boosts the rail speed',
      run: (t) => hold(t, ['Shift'], 0.6),
      expect: (a, b) => b.player.speed > a.player.speed + 6 && b.player.boost < a.player.boost,
      detail: (a, b) => ({ speed: [r2(a.player.speed), r2(b.player.speed)], boost: [r2(a.player.boost), r2(b.player.boost)] }),
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
  // Touch: drag the floating stick to the right and the ship moves right; hold FIRE and it fires.
  touch: async ({ page, cdp, snap, sleep }) => {
    const box = await page.locator('#stick-zone').boundingBox();
    if (!box) return false;
    const x = box.x + box.width * 0.4;
    const y = box.y + box.height * 0.6;
    const a = await snap();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await sleep(100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y, id: 1 }] });
    const t1 = Date.now();
    let b = a;
    while (b.roundTime - a.roundTime < 0.35 && Date.now() - t1 < 60000) {
      await sleep(150);
      b = await snap();
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const fire = await page.locator('#action-pad .fire').boundingBox();
    if (!fire) return false;
    const fx = fire.x + fire.width / 2;
    const fy = fire.y + fire.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fx, y: fy, id: 2 }] });
    const t2 = Date.now();
    let c = b;
    while ((c.roundTime - b.roundTime < 0.4 || c.player.shots <= b.player.shots) && c.roundTime - b.roundTime < 1.5 && Date.now() - t2 < 60000) {
      await sleep(150);
      c = await snap();
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const ok = c.touch && c.state === 'playing' && b.player.x > a.player.x + 1.5 && c.player.shots > b.player.shots;
    if (!ok) console.log('touch check:', JSON.stringify({ state: c.state, touch: c.touch, x: [a.player.x, b.player.x], shots: [b.player.shots, c.player.shots], t: [a.roundTime, b.roundTime, c.roundTime] }));
    return ok;
  },
};
