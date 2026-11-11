#!/usr/bin/env node
/**
 * The numbers for the post: minutes, tokens, dollars. One JSON line per event in
 * receipts/runs.jsonl. Never invent an entry; a run that was not logged has no number.
 *
 *   npm run receipts -- run --game=x --model=<model-id> [--budget=20] "<prompt>"
 *       runs `claude -p <prompt> --output-format json` and logs cost, usage and wall clock
 *   npm run receipts -- ingest --game=x --file=result.json [--model=m] [--wall=seconds]
 *       logs the JSON that `claude -p --output-format json` already wrote
 *   npm run receipts -- stamp --game=x setup|first-play|repair|final-play ["note"]
 *       marks a moment in a run done by hand or inside a session
 *   npm run receipts -- session --game=x --file=<transcript.jsonl>[,<more.jsonl>] [--from=ISO] [--to=ISO]
 *       prices an interactive Claude Code session (or a sub-agent's transcript) from the
 *       token usage it recorded, at API list prices, and logs it as a run. --from/--to
 *       default to the game's first and last stamps when the transcript spans other work.
 *   npm run receipts -- report [--game=x]
 *       per-game minutes between stamps and total logged cost
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const [cmd, ...rest] = args._;
const dir = join(ROOT, 'receipts');
const file = join(dir, 'runs.jsonl');
mkdirSync(dir, { recursive: true });

// API list prices in USD per million tokens. Cache reads are 0.1x input (readMul adjusts where a
// model differs), cache writes 1.25x input for 5 minutes and 2x for 1 hour.
const PRICES_AS_OF = '2026-11-03';
const PRICES = {
  'claude-opus-5-5': { in: 4, out: 20, readMul: 0.5 }, // reads $0.20
  'claude-sonnet-5-5': { in: 2, out: 10, readMul: 0.5 }, // reads $0.10
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-fable-5-2': { in: 8, out: 40, readMul: 0.25 }, // reads $0.20
};

const readRows = () => (existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

const write = (row) => {
  const line = { at: new Date().toISOString(), ...row };
  appendFileSync(file, `${JSON.stringify(line)}\n`);
  console.log(JSON.stringify(line));
};

const fromResult = (j, extra) => ({
  kind: 'run',
  total_cost_usd: j.total_cost_usd ?? null,
  session_id: j.session_id ?? null,
  num_turns: j.num_turns ?? null,
  duration_ms: j.duration_ms ?? null,
  usage: j.usage ?? null,
  model_usage: j.modelUsage ?? null,
  is_error: j.is_error ?? null,
  ...extra,
});

if (cmd === 'run') {
  const prompt = rest.join(' ');
  if (!prompt) throw new Error('give the prompt as the last argument');
  const cli = ['-p', prompt, '--output-format', 'json'];
  if (args.model) cli.push('--model', args.model);
  if (args.budget) cli.push('--max-budget-usd', String(args.budget));
  const t0 = Date.now();
  const res = spawnSync('claude', cli, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit'] });
  const wall = (Date.now() - t0) / 1000;
  if (res.error) throw res.error;
  let parsed = null;
  try { parsed = JSON.parse(res.stdout); } catch { /* recorded below */ }
  write(parsed
    ? fromResult(parsed, { game: args.game ?? null, model: args.model ?? null, wall_seconds: wall })
    : { kind: 'run', game: args.game ?? null, model: args.model ?? null, wall_seconds: wall, error: 'output was not JSON', exit_code: res.status });
} else if (cmd === 'ingest') {
  const j = JSON.parse(readFileSync(args.file, 'utf8'));
  write(fromResult(j, { game: args.game ?? null, model: args.model ?? null, wall_seconds: args.wall ? Number(args.wall) : null }));
} else if (cmd === 'session') {
  if (!args.game || !args.file) throw new Error('session needs --game and --file');
  const stamps = readRows().filter((r) => r.kind === 'stamp' && r.game === args.game).map((r) => Date.parse(r.at));
  const from = args.from ? Date.parse(args.from) : (stamps.length ? Math.min(...stamps) : -Infinity);
  const to = args.to ? Date.parse(args.to) : (stamps.length > 1 ? Math.max(...stamps) : Infinity);
  // Each content block of one API response is its own line, carrying the usage as it stood when
  // that block was written: keep the last (largest) snapshot per response id.
  const seen = new Map();
  for (const f of String(args.file).split(',')) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!line.includes('"usage"')) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const m = j.message;
      const t = Date.parse(j.timestamp);
      if (j.type !== 'assistant' || !m?.usage || !m.id || !(t >= from && t <= to)) continue;
      const prev = seen.get(m.id);
      if (!prev || (m.usage.output_tokens ?? 0) >= (prev.usage.output_tokens ?? 0)) seen.set(m.id, { model: m.model, usage: m.usage, t: prev ? Math.min(prev.t, t) : t });
    }
  }
  const byModel = {};
  let first = Infinity;
  let last = -Infinity;
  for (const { model, usage: u, t } of seen.values()) {
    first = Math.min(first, t);
    last = Math.max(last, t);
    const row = (byModel[model] ??= { requests: 0, input: 0, output: 0, cache_read: 0, cache_write_5m: 0, cache_write_1h: 0 });
    row.requests++;
    row.input += u.input_tokens ?? 0;
    row.output += u.output_tokens ?? 0;
    row.cache_read += u.cache_read_input_tokens ?? 0;
    const w5 = u.cache_creation?.ephemeral_5m_input_tokens;
    const w1 = u.cache_creation?.ephemeral_1h_input_tokens;
    if (w5 === undefined && w1 === undefined) row.cache_write_5m += u.cache_creation_input_tokens ?? 0;
    else { row.cache_write_5m += w5 ?? 0; row.cache_write_1h += w1 ?? 0; }
  }
  let cost = 0;
  for (const [model, r] of Object.entries(byModel)) {
    const p = PRICES[model];
    if (!p) throw new Error(`no list price for ${model}; add it to PRICES`);
    r.cost_usd = +((r.input * p.in + r.output * p.out + r.cache_read * p.in * 0.1 * (p.readMul ?? 1)
      + r.cache_write_5m * p.in * 1.25 + r.cache_write_1h * p.in * 2) / 1e6).toFixed(4);
    cost += r.cost_usd;
  }
  if (!seen.size) throw new Error('no priced messages in that window');
  write({
    kind: 'run', source: 'transcript', game: args.game, total_cost_usd: +cost.toFixed(2),
    wall_seconds: Math.round((last - first) / 1000), model_usage: byModel, prices_as_of: PRICES_AS_OF,
  });
} else if (cmd === 'stamp') {
  if (!args.game || !rest[0]) throw new Error('stamp needs --game and a phase');
  write({ kind: 'stamp', game: args.game, phase: rest[0], note: rest[1] ?? null });
} else if (cmd === 'report') {
  const rows = existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const games = {};
  for (const r of rows) {
    if (args.game && r.game !== args.game) continue;
    const g = (games[r.game ?? 'unknown'] ??= { cost_usd: 0, runs: 0, wall_seconds: 0, stamps: [] });
    if (r.kind === 'run') {
      g.cost_usd += r.total_cost_usd ?? 0;
      g.runs++;
      g.wall_seconds += r.wall_seconds ?? 0;
    } else {
      g.stamps.push({ phase: r.phase, at: r.at });
    }
  }
  for (const g of Object.values(games)) {
    g.cost_usd = +g.cost_usd.toFixed(2);
    if (g.stamps.length > 1) {
      const a = Date.parse(g.stamps[0].at);
      g.stamps = g.stamps.map((s) => ({ ...s, minutes_from_start: +((Date.parse(s.at) - a) / 60000).toFixed(1) }));
    }
  }
  console.log(JSON.stringify(games, null, 2));
} else {
  console.error('commands: run, ingest, stamp, report');
  process.exit(1);
}
