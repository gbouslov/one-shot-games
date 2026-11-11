#!/usr/bin/env node
/**
 * Play the built single file for real: keyboard and mouse, in a headless browser,
 * under the artifact's content rules. Grew from the movement-and-fire smoke test
 * in mshumer/Claude-of-Duty tools/playtest.mjs (MIT).
 *
 *   npm run playtest -- --game=games/x [--q=low] [--gpu] [--timeout=300] [--seed=1] [--attempts=3] [--verbose]
 *
 * Writes <game>/playtest/report.json and screenshots, prints the report, and
 * exits non-zero if any check failed. Read the screenshots; passing checks only
 * prove the game runs, never that it looks good.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { distFile, gameDir, launch, parseArgs, serve, sleep, waitInPage, waitReady, watchPage, wrapAngle } from './lib/harness.mjs';

const args = parseArgs();
const dir = gameDir(args);
const file = distFile(dir);
const outDir = join(dir, 'playtest');
mkdirSync(outDir, { recursive: true });

const W = Number(args.w ?? 960);
const H = Number(args.h ?? 540);
const TIMEOUT_S = Number(args.timeout ?? 300);
const Q = args.q ?? (args.gpu ? 'high' : 'low');
const DRAG_SENS = 0.0048;
const SEED = Number(args.seed ?? 20261109);
const MAX_ATTEMPTS = Number(args.attempts ?? 3);

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass: !!pass, detail });
  console.error(`${pass ? 'pass' : 'FAIL'}  ${name}${detail !== undefined ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};

const snap = (p) => p.evaluate(() => window.__GAME__.snapshot());

/** Colour variety and brightness spread of a PNG: a blank canvas scores near zero. */
function imageStats(path) {
  const png = PNG.sync.read(readFileSync(path));
  const seen = new Set();
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 16) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    seen.add((r >> 3) << 10 | (g >> 3) << 5 | (b >> 3));
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l;
    sum2 += l * l;
    n++;
  }
  const mean = sum / n;
  return { colours: seen.size, mean: +mean.toFixed(1), stddev: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1) };
}

async function shoot(page, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path });
  const stats = imageStats(path);
  check(`screenshot ${name} is not blank`, stats.colours > 40 && stats.stddev > 6, stats);
}

// Genre starters bring their own plan: the inputs to press and how to win.
const planFile = join(dir, 'playtest.plan.mjs');
if (existsSync(planFile)) {
  const { runGenrePlaytest } = await import('./lib/playtest-genre.mjs');
  const plan = (await import(pathToFileURL(planFile).href)).default;
  const report = { game: dir.split('/').slice(-2).join('/'), plan: 'playtest.plan.mjs' };
  let crashed = null;
  try {
    await runGenrePlaytest({ dir, file, plan, args, check, shoot, report });
  } catch (e) {
    crashed = e;
    check('playtest ran to completion', false, e.message);
  }
  report.passed = checks.filter((c) => c.pass).length;
  report.failed = checks.filter((c) => !c.pass).length;
  report.ok = report.failed === 0 && !crashed;
  report.checks = checks;
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const { checks: _omit, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  process.exit(report.ok ? 0 : 1);
}

const server = await serve(file);
const browser = await launch(args);
const report = { game: dir.split('/').slice(-2).join('/'), quality: Q, viewport: `${W}x${H}` };

async function waitFor(fn, ms, page, step = 60) {
  const t0 = Date.now();
  for (;;) {
    const s = await snap(page);
    if (fn(s)) return s;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

/* ---------- 1. the full round with real input ---------------------------- */
async function roundPhase() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const faults = watchPage(page, server.url);
  const t0 = Date.now();
  await page.goto(`${server.url}/?look=drag&q=${Q}&seed=${SEED}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  report.boot_ms = Date.now() - t0;

  let s = await snap(page);
  report.renderer = s.render.renderer;
  check('page boots to the title screen', s.state === 'title', s.state);
  check('WebGL2 context is live', !!s.render.renderer && s.render.drawCalls > 0, s.render);
  await shoot(page, '01-title');

  await page.mouse.click(W / 2, H / 2);
  s = await waitFor((x) => x.state === 'playing', 5000, page);
  check('clicking the title starts the round', !!s, s?.state);
  s = await snap(page);
  check('audio context is running after the click', s.audio.state === 'running', s.audio.state);

  await page.evaluate(() => {
    window.__FRAMES__ = [];
    let last = performance.now();
    const tick = (now) => { window.__FRAMES__.push(now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  // Walk.
  const a = await snap(page);
  await page.keyboard.down('w');
  await sleep(1400);
  await page.keyboard.down('Shift');
  await sleep(900);
  const sprinting = await snap(page);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  const b = await snap(page);
  const moved = Math.hypot(b.player.x - a.player.x, b.player.z - a.player.z);
  check('W moves the player', moved > 1, `${moved.toFixed(2)} m`);
  check('Shift sprints', sprinting.player.sprinting && sprinting.player.speed > 6, `${sprinting.player.speed.toFixed(2)} m/s`);

  // Jump.
  await waitFor((x) => x.player.grounded, 4000, page);
  const before = await snap(page);
  await page.keyboard.press('Space', { delay: 80 });
  let peak = before.player.y;
  const j0 = Date.now();
  while (Date.now() - j0 < 1600) {
    const x = await snap(page);
    peak = Math.max(peak, x.player.y);
    await sleep(30);
  }
  check('Space jumps', peak - before.player.y > 0.4, `${(peak - before.player.y).toFixed(2)} m`);

  // Drag to look.
  const c = await snap(page);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down();
  await page.mouse.move(W / 2 + 80, H / 2, { steps: 4 });
  await page.mouse.up();
  await sleep(400);
  const d = await snap(page);
  check('dragging turns the view', Math.abs(wrapAngle(d.player.yaw - c.player.yaw)) > 0.15, `${wrapAngle(d.player.yaw - c.player.yaw).toFixed(3)} rad`);
  check('drag-to-look mode is active', d.input.mode === 'drag', d.input.mode);

  // Each weapon kind.
  await page.keyboard.down('f');
  await waitFor((x) => x.stats.shots >= 4, 8000, page);
  await page.keyboard.up('f');
  const e = await snap(page);
  check('firing spends ammo', e.weapon.ammo < e.weapon.magazine && e.stats.shots > 0, e.weapon);
  await page.keyboard.press('r', { delay: 80 });
  const reloaded = await waitFor((x) => x.weapon.ammo === x.weapon.magazine, 12000, page);
  check('R reloads', !!reloaded, reloaded?.weapon);

  const kinds = new Set([e.weapon.kind]);
  // Every slot after the first, then back to 1 (a two-weapon loadout skips key 3).
  const slots = e.weapon.slots ?? 3;
  for (const key of [...Array.from({ length: Math.max(0, slots - 1) }, (_, i) => String(i + 2)), '1']) {
    const w0 = await snap(page);
    await page.keyboard.press(key, { delay: 80 });
    const w1 = await waitFor((x) => x.weapon.id !== w0.weapon.id, 4000, page);
    check(`key ${key} switches weapon`, !!w1, w1?.weapon.id);
    if (!w1) continue;
    kinds.add(w1.weapon.kind);
    if (w1.weapon.kind !== 'hitscan') {
      await sleep(900);
      await page.keyboard.press('f', { delay: 120 });
      if (w1.weapon.kind === 'projectile') {
        const flying = await waitFor((x) => x.stats.projectiles > 0, 3000, page, 20);
        check('projectile weapon launches a projectile', !!flying);
      } else {
        const swung = await waitFor((x) => x.stats.shots > w1.stats.shots, 3000, page, 20);
        check('melee weapon swings', !!swung);
      }
      await sleep(500);
    }
  }
  report.weapon_kinds_tested = [...kinds];

  // The round from a clean start, aiming with drag and shooting with F, until it ends.
  await page.evaluate(() => window.__GAME__.debug.restart());
  await waitFor((x) => x.state === 'playing' && x.wave === 0, 3000, page);
  let fightShot = false;
  let healthLow = 100;
  let lastFiring = false;
  let aimedAtFrame = 0;
  let lastClosing = false;
  let lastLog = 0;
  let lastHits = 0;
  let lastHitAt = Date.now();
  let dragging = false;
  const released = async () => { if (dragging) { await page.mouse.up(); dragging = false; } };
  let cursorX = W / 2;
  let cursorY = H / 2;
  const roundStart = Date.now();
  let attempts = 1;
  for (;;) {
    s = await snap(page);
    healthLow = Math.min(healthLow, s.player.health);
    if (s.state === 'lost' && attempts < MAX_ATTEMPTS && Date.now() - roundStart < TIMEOUT_S * 1000) {
      // The bot is a mediocre player on a slow machine; a loss is only a failure if it keeps happening.
      attempts++;
      healthLow = 100;
      await page.evaluate(() => window.__GAME__.debug.restart());
      await waitFor((x) => x.state === 'playing' && x.wave === 0 && !x.player.dead, 3000, page);
      lastHitAt = Date.now();
      continue;
    }
    if (s.state !== 'playing' || Date.now() - roundStart > TIMEOUT_S * 1000) break;

    const eye = s.player.eye;
    let best = null;
    let bestScore = Infinity;
    for (const n of s.enemies) {
      const dist = Math.hypot(n.x - eye[0], n.z - eye[2]);
      if (dist < bestScore) { bestScore = dist; best = n; }
    }
    if (args.verbose && Date.now() - lastLog > 2000) {
      lastLog = Date.now();
      console.error(JSON.stringify({ t: Math.round(s.elapsed), wave: s.wave, hp: Math.round(s.player.health), ammo: s.weapon.ammo, hits: s.stats.hits, pos: [s.player.x, s.player.z].map(Math.round), yaw: +s.player.yaw.toFixed(2), pitch: +s.player.pitch.toFixed(2), enemies: s.enemies.map((n) => `${n.type[0]} ${Math.round(n.x)},${n.y.toFixed(1)},${Math.round(n.z)} ${n.state} ${Math.round(n.hp)}`) }));
    }
    let firing = false;
    if (best) {
      const tx = best.x - eye[0];
      const tz = best.z - eye[2];
      const ty = best.y + best.height * 0.62 - eye[1];
      const wantYaw = Math.atan2(-tx, -tz);
      const wantPitch = Math.atan2(ty, Math.hypot(tx, tz));
      const dYaw = wrapAngle(wantYaw - s.player.yaw);
      const dPitch = wantPitch - s.player.pitch;
      const error = Math.hypot(dYaw, dPitch);
      firing = error < Math.max(0.03, 0.5 / Math.max(1, bestScore));

      // A correction only shows up a frame or two later; sending more before then overshoots.
      if (error > 0.012 && s.frame >= aimedAtFrame + 2) {
        aimedAtFrame = s.frame;
        const px = Math.max(-120, Math.min(120, (-dYaw / DRAG_SENS) * 0.85));
        const py = Math.max(-120, Math.min(120, (-dPitch / DRAG_SENS) * 0.85));
        if (!dragging || cursorX + px < 20 || cursorX + px > W - 20 || cursorY + py < 20 || cursorY + py > H - 20) {
          await released();
          cursorX = W / 2;
          cursorY = H / 2;
          await page.mouse.move(cursorX, cursorY);
          await page.mouse.down();
          dragging = true;
          // past the small dead zone that separates a tap from a drag
          await page.mouse.move(cursorX + 6, cursorY);
          cursorX += 6;
        }
        cursorX += px;
        cursorY += py;
        await page.mouse.move(cursorX, cursorY);
      }

      if (!fightShot && bestScore < 16 && error < 0.2) {
        await shoot(page, '02-fight');
        fightShot = true;
      }
    }
    // Go after whatever is out of reach or has not been hit lately, as a person would.
    if (s.stats.hits !== lastHits) {
      lastHits = s.stats.hits;
      lastHitAt = Date.now();
    }
    const closing = !!best && bestScore > 6 && (bestScore > 13 || Date.now() - lastHitAt > 3000);
    if (closing !== lastClosing) {
      if (closing) await page.keyboard.down('w');
      else await page.keyboard.up('w');
      lastClosing = closing;
    }
    if (firing !== lastFiring) {
      if (firing) await page.keyboard.down('f');
      else await page.keyboard.up('f');
      lastFiring = firing;
    }
    await sleep(25);
  }
  await released();
  await page.keyboard.up('f');
  await page.keyboard.up('w');

  const end = await snap(page);
  report.round = { state: end.state, attempts, seconds_real: +((Date.now() - roundStart) / 1000).toFixed(1), seconds_game: +end.elapsed.toFixed(1), kills: end.stats.kills, shots: end.stats.shots, hits: end.stats.hits, lowest_health: +healthLow.toFixed(1), waves: end.waves };
  check('scripted round is won', end.state === 'won', report.round);
  check('every wave spawned and died', end.stats.kills >= 8 && end.enemies.length === 0, end.stats.kills);
  check('fight screenshot was taken', fightShot);
  check('sounds were played', end.audio.played > 20, end.audio.played);
  await shoot(page, '03-end-screen');

  const frames = await page.evaluate(() => window.__FRAMES__);
  const sorted = frames.slice(30).sort((x, y) => x - y);
  const q = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1);
  report.frame_ms = { count: sorted.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
  report.software_rendered = /swiftshader|llvmpipe/i.test(report.renderer);

  // Restart and lose.
  await page.mouse.click(W / 2, H / 2);
  const restarted = await waitFor((x) => x.state === 'playing' && x.player.health === 100, 5000, page);
  check('clicking the end screen restarts', !!restarted);
  await page.evaluate(() => window.__GAME__.debug.damagePlayer(9999));
  const lost = await waitFor((x) => x.state === 'lost', 5000, page);
  check('dying shows the lose screen', !!lost);
  await page.mouse.click(W / 2, H / 2);
  const again = await waitFor((x) => x.state === 'playing' && !x.player.dead, 5000, page);
  check('restart works after a loss', !!again);

  check('no console errors, page errors or external requests', faults.length === 0, faults.slice(0, 8));
  report.faults = faults;
  await page.close();
}

/* ---------- 2. inside a sandboxed iframe, the way embeds refuse things ---- */
async function sandboxPhase() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const faults = watchPage(page, server.url);
  await page.goto(`${server.url}/frame?q=low`, { waitUntil: 'domcontentloaded' });
  const handle = await page.waitForSelector('iframe');
  const frame = await handle.contentFrame();
  await waitReady(frame);
  await page.mouse.click(W / 2, H / 2);
  await waitInPage(frame, () => window.__GAME__.snapshot().state === 'playing', 8000);
  await waitInPage(frame, () => window.__GAME__.snapshot().input.mode === 'drag', 8000).catch(() => {});
  const a = await frame.evaluate(() => window.__GAME__.snapshot());
  check('sandboxed iframe: pointer lock refused, game falls back to drag', a.input.mode === 'drag' && !a.input.pointerLocked, a.input);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down();
  await page.mouse.move(W / 2 + 90, H / 2 + 10, { steps: 5 });
  await page.mouse.up();
  await sleep(500);
  const b = await frame.evaluate(() => window.__GAME__.snapshot());
  check('sandboxed iframe: drag still turns the view', Math.abs(wrapAngle(b.player.yaw - a.player.yaw)) > 0.15, `${wrapAngle(b.player.yaw - a.player.yaw).toFixed(3)} rad`);
  // Chrome itself logs this line when a sandbox refuses the lock; it is the expected path here.
  const real = faults.filter((f) => !f.includes('Blocked pointer lock'));
  check('sandboxed iframe: no errors', real.length === 0, real.slice(0, 8));
  await page.close();
}

/* ---------- 3. real pointer lock, when the browser allows it -------------- */
async function lockPhase() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const faults = watchPage(page, server.url);
  await page.goto(`${server.url}/?q=low`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.mouse.click(W / 2, H / 2);
  await sleep(1200);
  const a = await snap(page);
  report.pointer_lock = a.input;
  check('direct page: the game has a working look mode after the first click', a.input.pointerLocked || a.input.mode === 'drag', a.input);
  check('direct page: no errors', faults.length === 0, faults.slice(0, 8));
  await page.close();
}

/* ---------- 4. on a touch screen ------------------------------------------ */
async function touchPhase() {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage();
  const faults = watchPage(page, server.url);
  await page.goto(`${server.url}/?q=low`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.touchscreen.tap(422, 195);
  await waitInPage(page, () => window.__GAME__.snapshot().state === 'playing', 8000);
  const box = await page.locator('button[data-c=KeyF]').boundingBox();
  check('touch: on-screen buttons appear', !!box);
  const a = await snap(page);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const fired = await waitFor((x) => x.stats.shots > a.stats.shots, 5000, page, 20);
  check('touch: the fire button fires', !!fired);

  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const b = await snap(page);
  await touch('touchStart', 560, 200);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', 560 + i * 15, 200);
    await sleep(60);
  }
  await touch('touchEnd');
  await sleep(500);
  const c = await snap(page);
  check('touch: dragging the right side turns the view', Math.abs(wrapAngle(c.player.yaw - b.player.yaw)) > 0.15, `${wrapAngle(c.player.yaw - b.player.yaw).toFixed(3)} rad`);

  await touch('touchStart', 120, 200);
  for (let i = 1; i <= 5; i++) {
    await touch('touchMove', 120, 200 - i * 12);
    await sleep(60);
  }
  await sleep(900);
  const d = await snap(page);
  await touch('touchEnd');
  const moved = Math.hypot(d.player.x - c.player.x, d.player.z - c.player.z);
  check('touch: dragging the left side walks', moved > 0.5, `${moved.toFixed(2)} m`);
  check('touch: no errors', faults.length === 0, faults.slice(0, 8));
  await context.close();
}

/* ---------- 5. opened straight from disk ---------------------------------- */
async function filePhase() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const faults = watchPage(page, 'file:');
  await page.goto(`${pathToFileURL(file).href}?q=low`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  check('opens from a local file with no server', (await snap(page)).state === 'title');
  check('local file: no errors', faults.length === 0, faults.slice(0, 8));
  await page.close();
}

let crashed = null;
try {
  await roundPhase();
  await sandboxPhase();
  await lockPhase();
  await touchPhase();
  await filePhase();
} catch (e) {
  crashed = e;
  check('playtest ran to completion', false, e.message);
} finally {
  await browser.close();
  await server.close();
}

report.passed = checks.filter((c) => c.pass).length;
report.failed = checks.filter((c) => !c.pass).length;
report.ok = report.failed === 0 && !crashed;
report.checks = checks;
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const { checks: _omit, ...summary } = report;
console.log(JSON.stringify(summary, null, 2));
process.exit(report.ok ? 0 : 1);
