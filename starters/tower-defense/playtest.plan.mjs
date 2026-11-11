/**
 * Playtest plan for the tower-defense starter (run by tools/lib/playtest-genre.mjs).
 * Every control in the README is pressed for real here; the full round is won
 * by debug.autoplay, which plays through the same controls.act() path.
 */
const key = (code) => async ({ page, sleep }) => {
  await page.keyboard.press(code, { delay: 40 });
  await sleep(150);
};

export default {
  start: 'click',
  timeout: 240,
  inputs: [
    {
      name: 'key 2 picks the second tower',
      run: key('Digit2'),
      expect: (a, b) => b.tool === 1,
      detail: (a, b) => ({ before: a.tool, after: b.tool }),
    },
    {
      name: 'Escape puts the tower down',
      run: key('Escape'),
      expect: (a, b) => a.tool === 1 && b.tool === null,
    },
    {
      name: 'key 1 then a click on open ground builds a tower',
      run: async ({ page, snap, sleep }) => {
        await page.keyboard.press('Digit1');
        await sleep(100);
        const s = await snap();
        await page.mouse.move(s.hint.x, s.hint.y);
        await sleep(100);
        await page.mouse.click(s.hint.x, s.hint.y);
        await sleep(200);
      },
      expect: (a, b) => b.towers.length === a.towers.length + 1 && b.gold < a.gold,
      detail: (a, b) => ({ towers: [a.towers.length, b.towers.length], gold: [a.gold, b.gold] }),
    },
    {
      name: 'clicking a tower selects it',
      run: async ({ page, snap, sleep }) => {
        await page.keyboard.press('Escape');
        const s = await snap();
        const t = s.towers[0];
        await page.mouse.click(t.x, t.y);
        await sleep(200);
      },
      expect: (a, b) => !!b.selected && b.selected.id === b.towers[0].id,
      detail: (a, b) => b.selected,
    },
    {
      name: 'U upgrades the selected tower',
      run: key('KeyU'),
      expect: (a, b) => b.selected?.level === (a.selected?.level ?? -9) + 1 && b.gold < a.gold,
      detail: (a, b) => ({ level: [a.selected?.level, b.selected?.level], gold: [a.gold, b.gold] }),
    },
    {
      name: 'S sells the selected tower for a refund',
      run: key('KeyS'),
      expect: (a, b) => b.towers.length === a.towers.length - 1 && b.gold > a.gold,
      detail: (a, b) => ({ towers: [a.towers.length, b.towers.length], gold: [a.gold, b.gold] }),
    },
    {
      name: 'F changes the game speed',
      run: key('KeyF'),
      expect: (a, b) => b.speed !== a.speed,
      detail: (a, b) => [a.speed, b.speed],
    },
    {
      name: 'Space calls the first wave',
      run: key('Space'),
      expect: (a, b) => b.wave === a.wave + 1,
      detail: (a, b) => [a.wave, b.wave],
    },
    {
      name: 'the called wave walks the road',
      run: async ({ sleep }) => { await sleep(2500); },
      expect: (a, b) => b.enemies.length > 0 && b.roundTime > a.roundTime,
      detail: (a, b) => ({ enemies: b.enemies.length, t: [a.roundTime, b.roundTime] }),
    },
  ],
  touch: async ({ page, snap, sleep }) => {
    const card = await page.locator('.card').first().boundingBox();
    await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
    await sleep(200);
    const a = await snap();
    if (a.tool !== 0 || !a.hint) return false;
    await page.touchscreen.tap(a.hint.x, a.hint.y);
    await sleep(300);
    const b = await snap();
    return b.towers.length === a.towers.length + 1;
  },
};
