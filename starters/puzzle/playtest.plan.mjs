// The playtest for the match-three starter: arrow keys move the cursor, Space picks a piece up
// and an arrow swaps it, the mouse drags or clicks two neighbours, touch taps two neighbours.
// The round is won by the game's bot (debug.autoplay), which presses the same actions as the keys.
const idle = async ({ snap, sleep }) => {
  for (let i = 0; i < 150; i++) {
    const s = await snap();
    if (s.phase === 'idle') return s;
    await sleep(60);
  }
  return snap();
};
const press = (key) => async (t) => { await idle(t); await t.page.keyboard.press(key, { delay: 40 }); await t.sleep(250); };
const cellAt = (s, x, y) => ({ x: s.screen.x0 + x * s.screen.dx, y: s.screen.y0 + y * s.screen.dy });
const waitSwap = async (t, before) => {
  for (let i = 0; i < 60; i++) {
    const s = await t.snap();
    if (s.swaps > before) return;
    await t.sleep(50);
  }
};

export default {
  start: 'click',
  timeout: 240,
  inputs: [
    { name: 'ArrowRight moves the cursor right', run: press('ArrowRight'), expect: (a, b) => b.cursor.x === a.cursor.x + 1, detail: (a, b) => [a.cursor, b.cursor] },
    { name: 'ArrowUp moves the cursor up', run: press('ArrowUp'), expect: (a, b) => b.cursor.y === a.cursor.y + 1, detail: (a, b) => [a.cursor, b.cursor] },
    { name: 'ArrowLeft moves the cursor left', run: press('ArrowLeft'), expect: (a, b) => b.cursor.x === a.cursor.x - 1, detail: (a, b) => [a.cursor, b.cursor] },
    { name: 'ArrowDown moves the cursor down', run: press('ArrowDown'), expect: (a, b) => b.cursor.y === a.cursor.y - 1, detail: (a, b) => [a.cursor, b.cursor] },
    { name: 'Space picks up the piece under the cursor', run: press('Space'), expect: (a, b) => !a.grabbed && b.grabbed },
    {
      name: 'an arrow while holding swaps the piece',
      run: async (t) => { const a = await t.snap(); await t.page.keyboard.press('ArrowRight', { delay: 40 }); await waitSwap(t, a.swaps); },
      expect: (a, b) => b.swaps === a.swaps + 1 && !b.grabbed,
    },
    {
      name: 'dragging a piece onto its neighbour swaps them',
      run: async (t) => {
        const s = await idle(t);
        const p = cellAt(s, 1, 1);
        await t.page.mouse.move(p.x, p.y);
        await t.page.mouse.down();
        for (let i = 1; i <= 6; i++) { await t.page.mouse.move(p.x + (s.screen.dx * i) / 6, p.y, { steps: 1 }); await t.sleep(60); }
        await t.page.mouse.up();
        await waitSwap(t, s.swaps);
      },
      expect: (a, b) => b.swaps === a.swaps + 1,
    },
    {
      name: 'clicking one piece then its neighbour swaps them',
      run: async (t) => {
        const s = await idle(t);
        const p = cellAt(s, 5, 2);
        const q = cellAt(s, 5, 3);
        await t.page.mouse.click(p.x, p.y, { delay: 60 });
        await t.sleep(250);
        await t.page.mouse.click(q.x, q.y, { delay: 60 });
        await waitSwap(t, s.swaps);
      },
      expect: (a, b) => b.swaps === a.swaps + 1,
    },
  ],
  touch: async ({ page, snap, sleep }) => {
    let s;
    for (let i = 0; i < 150; i++) { s = await snap(); if (s.phase === 'idle') break; await sleep(60); }
    await sleep(300);
    const p = { x: s.screen.x0 + 3 * s.screen.dx, y: s.screen.y0 + 2 * s.screen.dy };
    await page.touchscreen.tap(p.x, p.y);
    await sleep(300);
    await page.touchscreen.tap(p.x + s.screen.dx, p.y);
    for (let i = 0; i < 60; i++) {
      if ((await snap()).swaps > s.swaps) return true;
      await sleep(50);
    }
    return false;
  },
};
