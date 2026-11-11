#!/usr/bin/env node
/**
 * Build a game into one HTML file, then run the size gate.
 *   npm run build                        the FPS starter
 *   npm run build -- --game=games/x      any game folder
 *   npm run build -- --no-minify         readable stack traces while debugging
 *   npm run dev -- --game=games/x        live dev server on 127.0.0.1:5173
 */
import { build, createServer } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { join } from 'node:path';
import { checkBuild } from './size-gate.mjs';
import { gameDir, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const root = gameDir(args);

// The licence's Required Notice. Every built game carries it in the file and shows it for the first
// few seconds on screen, so a shared game always says what made it. Change the name here only.
const CREDIT = 'Built with One-Shot Games';
const credit = {
  name: 'credit-line',
  transformIndexHtml: (html) =>
    html
      .replace('<head>', `<head>\n<!-- ${CREDIT}. Licensed under PolyForm Noncommercial 1.0.0. -->\n<meta name="generator" content="${CREDIT}">`)
      .replace(
        '</body>',
        `<div id="osg-credit" style="position:fixed;left:10px;bottom:8px;z-index:2147483647;font:11px/1.3 system-ui,sans-serif;color:#fff;opacity:.55;text-shadow:0 1px 2px #000;pointer-events:none;transition:opacity 1.2s">${CREDIT}</div>` +
          `<script>setTimeout(function(){var c=document.getElementById('osg-credit');if(c){c.style.opacity=0;setTimeout(function(){c.remove()},1300)}},6000)</script>\n</body>`,
      ),
};
const shared = { root, configFile: false, plugins: [viteSingleFile(), credit], publicDir: false };

if (args.dev) {
  const server = await createServer({ ...shared, server: { host: '127.0.0.1', port: Number(args.port ?? 5173) } });
  await server.listen();
  server.printUrls();
} else {
  await build({
    ...shared,
    logLevel: 'warn',
    build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', sourcemap: false, minify: !args['no-minify'], chunkSizeWarningLimit: 20000 },
  });
  const report = checkBuild(join(root, 'dist'), args);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
