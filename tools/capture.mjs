#!/usr/bin/env node
/**
 * Reproducible screenshots of a built game. Each named shot (src/game/shots.js)
 * gets a fresh page and an exact frame count, so two runs can be compared with
 * `npm run diff`. Follows capture.mjs and baseline.mjs in mshumer/Claude-of-Duty (MIT).
 *
 *   npm run capture -- --game=games/x [--shots=hero,enemies] [--out=shots/base]
 *                      [--w=1280] [--h=720] [--settle=30] [--q=high] [--gpu]
 *   npm run capture -- --list
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { distFile, gameDir, launch, parseArgs, serve, waitReady, watchPage } from './lib/harness.mjs';

const args = parseArgs();
const dir = gameDir(args);
const file = distFile(dir);
const W = Number(args.w ?? 1280);
const H = Number(args.h ?? 720);
const SETTLE = Number(args.settle ?? 30);
const Q = args.q ?? 'high';
const outDir = resolve(dir, args.out ?? 'shots');

const server = await serve(file);
const browser = await launch(args);
const report = { ok: true, game: dir.split('/').slice(-2).join('/'), size: `${W}x${H}`, quality: Q, outDir: args.out ?? 'shots', shots: [] };

try {
  const probe = await browser.newPage({ viewport: { width: 320, height: 180 } });
  await probe.goto(`${server.url}/?capture=1&lockstep=1&q=low`, { waitUntil: 'domcontentloaded' });
  await waitReady(probe);
  const names = await probe.evaluate(() => Object.keys(window.__SHOTS__ ?? {}));
  await probe.close();

  if (args.list) {
    console.log(JSON.stringify(names));
  } else {
    mkdirSync(outDir, { recursive: true });
    const wanted = args.shots ? String(args.shots).split(',').map((s) => s.trim()) : names;
    for (const name of wanted) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const faults = watchPage(page, server.url);
      const t0 = Date.now();
      try {
        await page.goto(`${server.url}/?capture=1&lockstep=1&q=${Q}`, { waitUntil: 'domcontentloaded' });
        await waitReady(page);
        const applied = await page.evaluate((s) => window.__APPLY_SHOT__(s), name);
        await page.evaluate((n) => window.__PUMP__(n), SETTLE);
        await page.evaluate(() => window.__PRESENT__(2));
        await page.screenshot({ path: join(outDir, `${name}.png`), type: 'png', timeout: 120000 });
        const ok = !applied?.error && faults.length === 0;
        if (!ok) report.ok = false;
        report.shots.push({ shot: name, ok, ms: Date.now() - t0, faults, error: applied?.error });
      } catch (e) {
        report.ok = false;
        report.shots.push({ shot: name, ok: false, error: e.message });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (!args.list) {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
