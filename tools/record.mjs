#!/usr/bin/env node
/**
 * Record gameplay frame by frame, with the game's own sound, into an MP4.
 *
 * The page runs in lockstep: one engine frame is one video frame, so the result
 * is smooth at any frame rate even on a machine with no GPU. Sound is rendered
 * afterwards by replaying the logged sound events through the same voices in an
 * OfflineAudioContext, so every hit lands on its frame. The stepped approach
 * comes from mshumer/Claude-of-Duty tools/demo.mjs (MIT); it needs ffmpeg.
 *
 *   npm run record -- --game=games/x [--seconds=20] [--fps=30] [--w=1280] [--h=720] [--q=high]
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { distFile, gameDir, launch, parseArgs, serve, waitReady, watchPage } from './lib/harness.mjs';

const args = parseArgs();
const dir = gameDir(args);
const FPS = Number(args.fps ?? 30);
const SECONDS = Number(args.seconds ?? 20);
const W = Number(args.w ?? 1280);
const H = Number(args.h ?? 720);
const FRAMES = Math.round(FPS * SECONDS);
const outDir = join(dir, 'video');
mkdirSync(outDir, { recursive: true });
const silent = join(outDir, 'silent.mp4');
const wav = join(outDir, 'track.wav');
const out = join(outDir, args.out ?? 'gameplay.mp4');

if (spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('ffmpeg is required for recording');
  process.exit(1);
}

const server = await serve(distFile(dir));
const browser = await launch(args);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const faults = watchPage(page, server.url);

await page.goto(`${server.url}/?capture=1&lockstep=1&look=drag&q=${args.q ?? 'high'}`, { waitUntil: 'domcontentloaded' });
await waitReady(page);
await page.addScriptTag({ content: readFileSync(join(import.meta.dirname, 'lib', 'bot-driver.js'), 'utf8') });
const startFrame = await page.evaluate(() => {
  const e = window.__ENGINE__;
  e.ctx.get('audio').log = [];
  e.input.captureGameplay = true;
  window.__GAME__.debug.restart();
  return e.time.frame;
});

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
let lastState = 'playing';
for (let i = 0; i < FRAMES; i++) {
  lastState = await page.evaluate((dt) => window.__BOT__.step(dt), 1 / FPS);
  await page.evaluate((fps) => window.__PUMP__(1, fps), FPS);
  await page.evaluate(() => window.__PRESENT__(1));
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92, timeout: 120000 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % FPS === 0) console.error(`frame ${i}/${FRAMES}  ${lastState}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));

const audio = await page.evaluate(async ({ startFrame, frames, fps }) => {
  const a = window.__ENGINE__.ctx.get('audio');
  const log = a.log.map((ev) => ({ ...ev, frame: ev.frame - startFrame }));
  const { sampleRate, left, right } = await a.renderLog(log, frames, fps);
  const pcm = new Int16Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    pcm[i * 2] = Math.max(-1, Math.min(1, left[i])) * 32767;
    pcm[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 32767;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { sampleRate, b64: btoa(bin), events: log.length };
}, { startFrame, frames: FRAMES, fps: FPS });

const data = Buffer.from(audio.b64, 'base64');
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(audio.sampleRate, 24);
header.writeUInt32LE(audio.sampleRate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(wav, Buffer.concat([header, data]));

const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
const final = await page.evaluate(() => window.__GAME__.snapshot());
await browser.close();
await server.close();
if (mux.status === 0) { unlinkSync(silent); unlinkSync(wav); }

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,duration', '-of', 'json', out]);
const report = {
  ok: mux.status === 0 && faults.length === 0,
  out: out.split('/').slice(-4).join('/'),
  frames: FRAMES,
  fps: FPS,
  sound_events: audio.events,
  real_seconds: Math.round((Date.now() - t0) / 1000),
  game_state_at_end: lastState,
  kills: final.stats.kills,
  streams: probe.status === 0 ? JSON.parse(probe.stdout.toString()).streams : null,
  faults: faults.slice(0, 6),
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
