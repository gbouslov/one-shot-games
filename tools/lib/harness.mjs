// Shared plumbing for the tools. Browser flags and the capture handshake follow
// mshumer/Claude-of-Duty tools/ (MIT). See third_party/NOTICES.md.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
    else out._.push(a);
  }
  return out;
}

/** The game folder: --game=path, or $GAME, or the FPS starter. */
export function gameDir(args) {
  const dir = resolve(ROOT, args.game ?? process.env.GAME ?? 'starters/fps-three');
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`no index.html in ${dir}`);
  return dir;
}

export function distFile(dir) {
  const file = join(dir, 'dist', 'index.html');
  if (!existsSync(file)) throw new Error(`no build at ${file}. Run: npm run build`);
  return file;
}

/**
 * Launch Playwright's bundled Chromium with a throwaway profile. Default is
 * software WebGL (SwiftShader), which works anywhere; --gpu uses the real GPU.
 */
export async function launch(args = {}) {
  const flags = ['--ignore-gpu-blocklist', '--force-color-profile=srgb', '--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];
  // Software rendering needs vsync pacing: without it frames queue up and starve the page.
  if (!args.gpu) flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else {
    flags.push('--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-gpu');
    // Headless Chromium on macOS falls back to SwiftShader unless ANGLE is told to use Metal.
    if (process.platform === 'darwin') flags.push('--use-angle=metal');
  }
  return chromium.launch({ headless: !args.headed, args: flags });
}

/**
 * The rules a Claude artifact page runs under, as published: inline code, scripts
 * only from the listed CDNs, no images from elsewhere, network only to itself and
 * Google Fonts. The real header is not public, so this is a close approximation.
 */
export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.tailwindcss.com https://code.jquery.com https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
  'media-src data: blob:',
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
].join('; ');

/** Serve one built HTML file under the artifact rules, plus a sandboxing wrapper page. */
export async function serve(file, { csp = ARTIFACT_CSP } = {}) {
  const html = readFileSync(file);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/frame') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style><iframe id="f" sandbox="allow-scripts" src="/?${url.searchParams}"></iframe>`);
      return;
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** Collect everything that counts as a page fault. */
export function watchPage(page, base) {
  const faults = [];
  page.on('pageerror', (e) => faults.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') faults.push(`console.error: ${m.text()}`);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('file:')) faults.push(`external request: ${u}`);
  });
  page.on('requestfailed', (r) => faults.push(`request failed: ${r.url()}`));
  return faults;
}

/**
 * Poll a function in the page. Playwright's own waitForFunction uses eval, which
 * the artifact content rules correctly block.
 */
export async function waitInPage(target, fn, timeout = 120000) {
  const t0 = Date.now();
  for (;;) {
    const ok = await target.evaluate(fn).catch(() => false);
    if (ok) return true;
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${fn}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const waitReady = (target, timeout) => waitInPage(target, () => window.__READY__ === true, timeout);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
