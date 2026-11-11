// The playtest for the platformer starter: every control in the README gets a check through real
// keys, and a round is won by the game's own bot (debug.autoplay), which presses the same actions.
// Software WebGL can run slowly, so each check waits on the game's state, never on a fixed time.
const settle = async ({ snap, sleep }) => {
  for (let i = 0; i < 80; i++) {
    const s = await snap();
    if (s.player.grounded && Math.abs(s.player.vy) < 0.01) return s;
    await sleep(60);
  }
  return snap();
};

/** hold a key until the robot has run `dist` tiles that way, or 5 s */
const run = (key, dist) => async (t) => {
  const a = await settle(t);
  await t.page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const s = await t.snap();
    if (Math.abs(s.player.x - a.player.x) >= dist) break;
    await t.sleep(40);
  }
  await t.page.keyboard.up(key);
};

/** press a jump key, hold it, and record the highest point reached before landing */
let rise = 0;
const jump = (key) => async (t) => {
  const a = await settle(t);
  await t.page.keyboard.down(key);
  let top = a.player.y;
  let left = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const s = await t.snap();
    top = Math.max(top, s.player.y);
    if (!s.player.grounded) left = true;
    if (left && s.player.grounded) break;
    await t.sleep(30);
  }
  await t.page.keyboard.up(key);
  rise = top - a.player.y;
};

const dx = (a, b) => +(b.player.x - a.player.x).toFixed(2);

export default {
  start: 'click',
  timeout: 240,
  inputs: [
    { name: 'ArrowRight runs right', run: run('ArrowRight', 2), expect: (a, b) => dx(a, b) > 1.5, detail: dx },
    { name: 'ArrowLeft runs left', run: run('ArrowLeft', 1.5), expect: (a, b) => dx(a, b) < -1, detail: dx },
    { name: 'D runs right', run: run('KeyD', 1.5), expect: (a, b) => dx(a, b) > 1, detail: dx },
    { name: 'A runs left', run: run('KeyA', 1), expect: (a, b) => dx(a, b) < -0.7, detail: dx },
    { name: 'Space jumps at least two tiles', run: jump('Space'), expect: () => rise > 2, detail: () => +rise.toFixed(2) },
    { name: 'ArrowUp jumps', run: jump('ArrowUp'), expect: () => rise > 2, detail: () => +rise.toFixed(2) },
    { name: 'W jumps', run: jump('KeyW'), expect: () => rise > 2, detail: () => +rise.toFixed(2) },
    { name: 'Z jumps', run: jump('KeyZ'), expect: () => rise > 2, detail: () => +rise.toFixed(2) },
  ],
  touch: async ({ page, cdp, snap, sleep }) => {
    const box = async (c) => page.locator(`button[data-c=${c}]`).boundingBox();
    const right = await box('right');
    const jumpBtn = await box('jump');
    if (!right || !jumpBtn) return false;
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const a = await snap();
    await touch('touchStart', right.x + right.width / 2, right.y + right.height / 2);
    for (let i = 0; i < 100; i++) {
      await sleep(50);
      if ((await snap()).player.x - a.player.x > 1) break;
    }
    await touch('touchEnd');
    const b = await snap();
    await sleep(400);
    const c = await snap();
    await touch('touchStart', jumpBtn.x + jumpBtn.width / 2, jumpBtn.y + jumpBtn.height / 2);
    let top = c.player.y;
    for (let i = 0; i < 60; i++) {
      await sleep(50);
      const s = await snap();
      top = Math.max(top, s.player.y);
      if (top - c.player.y > 1.5) break;
    }
    await touch('touchEnd');
    return b.player.x - a.player.x > 0.8 && top - c.player.y > 1;
  },
};
