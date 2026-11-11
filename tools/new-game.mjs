#!/usr/bin/env node
/**
 * Copy a starter to games/<slug>/ so the starter stays clean.
 *   npm run new -- caveman-fps [--from=starters/fps-three]
 */
import { cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const slug = args._[0];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run new -- <lowercase-slug> [--from=starters/fps-three]');
  process.exit(1);
}
const from = resolve(ROOT, args.from ?? 'starters/fps-three');
const to = join(ROOT, 'games', slug);
if (existsSync(to)) {
  console.error(`${to} already exists`);
  process.exit(1);
}
// Run output and local scratch (downloads, probes) never travel into a new game.
const SKIP = new Set(['dist', 'playtest', 'shots', 'video', 'node_modules', '.scratch', '.dl', 'capture']);
cpSync(from, to, { recursive: true, filter: (src) => !SKIP.has(src.split('/').pop()) });
console.log(JSON.stringify({ ok: true, game: `games/${slug}`, write_here: `games/${slug}/src/game/` }));
