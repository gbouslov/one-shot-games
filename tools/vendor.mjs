#!/usr/bin/env node
/**
 * Copy files from a cloned open-licence repository into this one, unchanged,
 * and print the commit they came from so third_party/NOTICES.md can record it.
 *
 *   node tools/vendor.mjs --from=<clone dir> --to=<dest dir> <path> [<path> ...]
 *
 * Each <path> is relative to --from and may be a file or a folder (copied whole).
 * Patches made afterwards are listed in NOTICES under "What changed".
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from './lib/harness.mjs';

const args = parseArgs();
if (!args.from || !args.to || !args._.length) {
  console.error('usage: node tools/vendor.mjs --from=<clone> --to=<dest> <path>...');
  process.exit(2);
}
const from = resolve(args.from);
const to = resolve(args.to);
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', from, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {}

// --exclude=a,b skips any file whose name is listed (dev pages, local scripts).
const exclude = new Set(String(args.exclude ?? '').split(',').filter(Boolean));
const copied = [];
for (const rel of args._) {
  const src = join(from, rel);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const dest = join(to, args.flatten ? rel.split('/').pop() : rel);
  mkdirSync(dirname(dest), { recursive: true });
  // A folder is replaced whole, so re-vendoring never leaves stale files behind.
  if (statSync(src).isDirectory()) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, filter: (p) => !exclude.has(basename(p)) });
  copied.push(rel);
}
console.log(JSON.stringify({ from, commit, to, copied }, null, 2));
