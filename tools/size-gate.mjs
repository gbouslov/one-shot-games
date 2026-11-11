#!/usr/bin/env node
/**
 * Does this build fit the one-file rules?
 *   one HTML file, nothing else beside it
 *   under the budget (default 3 MB; a Claude artifact's hard limit is 16 MiB)
 *   no script, stylesheet or image loaded from anywhere else
 *   no network calls to other hosts
 *
 *   npm run size -- --game=games/x [--limit-mb=3]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameDir, parseArgs } from './lib/harness.mjs';

const HARD_LIMIT = 16 * 1024 * 1024;

const BANNED = [
  { what: 'external script tag', re: /<script[^>]+src=["']?(?!data:)[^"'\s>]+/gi },
  { what: 'external stylesheet', re: /<link[^>]+rel=["']?stylesheet[^>]*>/gi },
  { what: 'external image tag', re: /<img[^>]+src=["']?https?:/gi },
  { what: 'css import', re: /@import\s+(?:url\()?["']?https?:/gi },
  { what: 'css url to another host', re: /url\(["']?https?:\/\/(?!www\.w3\.org)/gi },
  { what: 'fetch to another host', re: /\bfetch\(\s*["'`]https?:/gi },
  { what: 'websocket', re: /new\s+WebSocket\(/g },
  { what: 'XMLHttpRequest to another host', re: /\.open\(\s*["'`](?:GET|POST)["'`]\s*,\s*["'`]https?:/gi },
];

export function checkBuild(distDir, args = {}) {
  const limit = Number(args['limit-mb'] ?? 3) * 1000 * 1000;
  const problems = [];
  const files = readdirSync(distDir).filter((f) => !f.endsWith('.map'));
  if (files.length !== 1 || files[0] !== 'index.html') problems.push(`expected only index.html, found: ${files.join(', ')}`);
  const file = join(distDir, 'index.html');
  const bytes = statSync(file).size;
  if (bytes > HARD_LIMIT) problems.push(`${bytes} bytes is over the 16 MiB artifact limit`);
  else if (bytes > limit) problems.push(`${bytes} bytes is over the ${limit} byte budget`);
  const html = readFileSync(file, 'utf8');
  for (const { what, re } of BANNED) {
    const m = html.match(re);
    if (m) problems.push(`${what}: ${m[0].slice(0, 100)}`);
  }
  return { ok: problems.length === 0, file: 'dist/index.html', bytes, mb: +(bytes / 1e6).toFixed(3), budget_mb: limit / 1e6, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  const report = checkBuild(join(gameDir(args), 'dist'), args);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
