// Playtest plan for the runner starter (run by tools/lib/playtest-genre.mjs).
// Every control in the README gets a check here, pressed through Playwright's
// real keyboard and checked against the runner's state. Hits are switched off
// (debug.god) while the controls are checked, so a stray obstacle cannot end
// the round between two checks; they are on again for the full round, which
// the game's own bot wins (debug.autoplay) by tapping the same key codes in
// the same control map the keyboard writes. Software WebGL draws a few frames
// a second and game time is clamped to 0.1 s a frame, so waits are measured
// in game time and the round timeout is generous. The course is rebuilt from
// the seed every round; the bot is meant to win any of them (measured: 20 of 20
// courses over seeds 1-4, fast-forwarded at 10 frames a second, the slowest
// the clamp allows, with no hits).

const until = async (t, fn, ms = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await t.snap();
    if (fn(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await t.sleep(80);
  }
};
const settle = (t) => until(t, (s) => !s.player.airborne && !s.player.sliding && Math.abs(s.player.x - s.player.lane * 2.2) < 0.2);
const press = async (t, key) => {
  await t.page.keyboard.press(key, { delay: 40 });
};
const r2 = (v) => +v.toFixed(2);

// Nothing else moves the runner between lanes while these run (no bot), so the
// order walks centre -> right -> centre -> left -> centre and each check
// starts with room to move.
const lane = (name, key, dir) => ({
  name,
  run: async (t) => {
    await t.page.evaluate(() => window.__GAME__.debug.god(true));
    const a = await settle(t);
    await press(t, key);
    await until(t, (x) => x.player.lane !== a.player.lane);
    await settle(t);
  },
  expect: (a, b) => b.player.lane === a.player.lane + dir && Math.sign(b.player.x - a.player.x) === dir && b.state === 'playing',
  detail: (a, b) => ({ lane: [a.player.lane, b.player.lane], x: [r2(a.player.x), r2(b.player.x)] }),
});

const act = (name, key, field) => ({
  name,
  run: async (t) => {
    await settle(t);
    const a = await t.snap();
    await press(t, key);
    await until(t, (x) => x.player[field] > a.player[field]);
  },
  expect: (a, b) => b.player[field] > a.player[field],
  detail: (a, b) => ({ [field]: [a.player[field], b.player[field]] }),
});

export default {
  start: 'click',
  timeout: 900,
  inputs: [
    lane('ArrowRight moves one lane right', 'ArrowRight', 1),
    lane('ArrowLeft moves one lane left', 'ArrowLeft', -1),
    lane('A moves one lane left', 'a', -1),
    lane('D moves one lane right', 'd', 1),
    act('ArrowUp jumps', 'ArrowUp', 'jumps'),
    act('W jumps', 'w', 'jumps'),
    act('Space jumps', ' ', 'jumps'),
    {
      name: 'a jump leaves the ground',
      run: async (t) => {
        await settle(t);
        await press(t, 'ArrowUp');
        await until(t, (x) => x.player.y > 0.8, 20000);
      },
      expect: (a, b) => b.player.y > 0.8 && b.player.airborne,
      detail: (a, b) => ({ y: r2(b.player.y) }),
    },
    act('ArrowDown slides', 'ArrowDown', 'slides'),
    act('S slides', 's', 'slides'),
    {
      name: 'the run speeds up with distance',
      run: async (t) => {
        const a = await t.snap();
        await until(t, (x) => x.distance > a.distance + 25, 60000);
      },
      expect: (a, b) => b.player.speed > a.player.speed && b.distance > a.distance,
      detail: (a, b) => ({ speed: [r2(a.player.speed), r2(b.player.speed)], distance: [r2(a.distance), r2(b.distance)] }),
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
        await t.page.evaluate(() => window.__GAME__.debug.god(false));
      },
      expect: (a, b) => !b.audio.muted,
    },
  ],
  // Touch: swipe right changes lane, swipe up jumps, swipe down slides.
  touch: async ({ page, cdp, snap, sleep }) => {
    await page.evaluate(() => window.__GAME__.debug.god(true));
    const waitFor = async (fn, ms = 30000) => {
      const t0 = Date.now();
      let s = await snap();
      while (!fn(s) && Date.now() - t0 < ms) { await sleep(100); s = await snap(); }
      return s;
    };
    const swipe = async (dx, dy) => {
      const x = 422;
      const y = 220;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await sleep(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * 0.5, y: y + dy * 0.5, id: 1 }] });
      await sleep(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy, id: 1 }] });
      await sleep(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    let a = await waitFor((s) => !s.player.airborne && !s.player.sliding);
    const dir = a.player.lane >= 1 ? -1 : 1;
    await swipe(dir * 140, 0);
    const b = await waitFor((s) => s.player.laneChanges > a.player.laneChanges);
    await waitFor((s) => !s.player.airborne && !s.player.sliding);
    await swipe(0, -140);
    const c = await waitFor((s) => s.player.jumps > b.player.jumps);
    await waitFor((s) => !s.player.airborne && !s.player.sliding);
    const c2 = await snap();
    await swipe(0, 140);
    const d = await waitFor((s) => s.player.slides > c2.player.slides);
    const ok = d.touch && d.state === 'playing' && b.player.laneChanges > a.player.laneChanges && c.player.jumps > b.player.jumps && d.player.slides > c2.player.slides;
    if (!ok) console.log('touch check:', JSON.stringify({ state: d.state, touch: d.touch, swipes: d.swipes, lanes: [a.player.laneChanges, b.player.laneChanges], jumps: [b.player.jumps, c.player.jumps], slides: [c2.player.slides, d.player.slides] }));
    return ok;
  },
};
