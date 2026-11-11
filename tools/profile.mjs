#!/usr/bin/env node
/**
 * Frame times while actually playing. Reports the distribution and every hitch,
 * because a median hides the stalls that make a game feel broken, and counts
 * shader programs so a compile stall is visible. Follows mshumer/Claude-of-Duty
 * tools/profile.mjs (MIT).
 *
 *   npm run profile -- --game=games/x [--frames=300] [--q=high] [--gpu] [--w=1280] [--h=720] [--dpr=1]
 *
 * Without --gpu this measures software rendering: useful for comparing two builds
 * and for catching hitches, and not a statement about a player's frame rate.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { distFile, gameDir, launch, parseArgs, serve, waitReady, watchPage } from './lib/harness.mjs';

const args = parseArgs();
const dir = gameDir(args);
const FRAMES = Number(args.frames ?? 300);
const W = Number(args.w ?? 1280);
const H = Number(args.h ?? 720);
const server = await serve(distFile(dir));
const browser = await launch(args);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(args.dpr ?? 1) });
const faults = watchPage(page, server.url);

const t0 = Date.now();
await page.goto(`${server.url}/?look=drag&q=${args.q ?? 'high'}`, { waitUntil: 'domcontentloaded' });
await waitReady(page);
const bootMs = Date.now() - t0;
await page.addScriptTag({ content: readFileSync(join(import.meta.dirname, 'lib', 'bot-driver.js'), 'utf8') });
await page.evaluate(() => {
  window.__ENGINE__.input.captureGameplay = true;
  window.__GAME__.debug.restart();
});

const samples = await page.evaluate((n) => new Promise((done) => {
  const e = window.__ENGINE__;
  const r = e.ctx.get('render').renderer;
  const out = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    window.__BOT__.step(Math.min(0.1, dt / 1000));
    out.push({ dt, progs: r.info.programs?.length ?? 0, calls: r.info.render.calls, tris: r.info.render.triangles, heap: performance.memory ? performance.memory.usedJSHeapSize >> 20 : 0 });
    if (out.length >= n) done(out);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), FRAMES);

const warm = samples.slice(Number(args.warmup ?? 20));
const dts = warm.map((s) => s.dt).sort((a, b) => a - b);
const q = (p) => +dts[Math.min(dts.length - 1, Math.floor(dts.length * p))].toFixed(1);
const med = q(0.5);
const hitches = warm.map((s, i) => ({ frame: i, ms: +s.dt.toFixed(1), newPrograms: i ? s.progs - warm[i - 1].progs : 0, dt: s.dt })).filter((s) => s.dt > Math.max(2 * med, med + 8));
const renderer = await page.evaluate(() => window.__GAME__.snapshot().render.renderer);

await browser.close();
await server.close();
console.log(JSON.stringify({
  ok: faults.length === 0,
  renderer,
  software_rendered: /swiftshader|llvmpipe/i.test(renderer),
  bootMs,
  frames: warm.length,
  frameTimeMs: { p50: med, p90: q(0.9), p95: q(0.95), p99: q(0.99), max: q(1) },
  fps: { p50: +(1000 / med).toFixed(1), p99: +(1000 / q(0.99)).toFixed(1) },
  hitchCount: hitches.length,
  worstHitches: hitches.sort((a, b) => b.ms - a.ms).slice(0, 8).map(({ dt, ...h }) => h),
  programs: { start: warm[0].progs, end: warm[warm.length - 1].progs, compiledDuringPlay: warm[warm.length - 1].progs - warm[0].progs },
  drawCalls: { min: Math.min(...warm.map((s) => s.calls)), max: Math.max(...warm.map((s) => s.calls)) },
  triangles: { max: Math.max(...warm.map((s) => s.tris)) },
  heapMb: { start: warm[0].heap, end: warm[warm.length - 1].heap },
  faults: faults.slice(0, 6),
}, null, 2));
if (faults.length) process.exit(1);
