#!/usr/bin/env node
/**
 * Put frames next to each other in one labelled image, so a look is judged
 * against its reference and not from memory. Needs ffmpeg.
 *
 *   node tools/side-by-side.mjs --out=references/audit/side-by-side.png --cols=3 \
 *     "Before=a.jpg" "After=b.png" "Bar=c.jpg" ...
 *
 * Each argument is Label=path. Frames are scaled to 640x360 and laid out in rows.
 */
import { spawnSync } from 'node:child_process';
import { parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const cols = Number(args.cols ?? 2);
const cells = args._.map((a) => {
  const i = a.indexOf('=');
  return { label: a.slice(0, i), path: a.slice(i + 1) };
});
if (!args.out || !cells.length) {
  console.error('usage: node tools/side-by-side.mjs --out=file.png [--cols=N] Label=path ...');
  process.exit(2);
}
const W = Number(args.w ?? 640);
const H = Number(args.h ?? 360);
const inputs = cells.flatMap((c) => ['-i', c.path]);
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
const scaled = cells.map((c, i) =>
  `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
  `drawbox=x=0:y=0:w=iw:h=34:color=black@0.6:t=fill,` +
  `drawtext=text='${esc(c.label)}':x=12:y=8:fontsize=20:fontcolor=white[c${i}]`
);
const rows = Math.ceil(cells.length / cols);
const layout = [];
for (let i = 0; i < cells.length; i++) layout.push(`${(i % cols) * W}_${Math.floor(i / cols) * H}`);
const filter = `${scaled.join(';')};${cells.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${cells.length}:layout=${layout.join('|')}:fill=black[out]`;
const res = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', args.out], { encoding: 'utf8' });
if (res.status !== 0) {
  console.error(res.stderr);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, out: args.out, cells: cells.length, size: `${cols * W}x${rows * H}` }));
