import './kit/style.css';
import { RaceDirector } from './kit/race/director';
import { installDebugApi } from './kit/debug/api';

import config from './game/config.js';
import track from './game/track.js';
import racers from './game/racers.js';
import look from './game/look.js';
import shots from './game/shots.js';

/** mulberry32: ?seed= makes every Math.random call in the kit repeatable. */
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function showFailure(err) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;inset:0;margin:0;padding:2rem;color:#f88;background:#000;font:13px/1.5 monospace;white-space:pre-wrap;z-index:9999';
  box.textContent = `This game could not start.\n\n${err?.message ?? err}\n\nIt needs a browser with WebGL 2.`;
  document.body.appendChild(box);
}

function boot() {
  const params = new URLSearchParams(location.search);
  const capture = params.get('capture') === '1';
  const lockstep = capture && params.get('lockstep') === '1';
  const seed = params.has('seed') ? Number(params.get('seed')) : capture ? 20261110 : null;
  if (seed !== null && Number.isFinite(seed)) seedRandom(seed);
  const quality = params.get('q') ?? (matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');

  const director = new RaceDirector({
    canvas: document.getElementById('game'),
    ui: document.getElementById('ui'),
    config,
    track,
    racers,
    look,
    quality,
    deterministic: capture,
  });
  director.init();

  const api = installDebugApi(director, shots, { lockstep });
  const BOOT_FRAMES = 3;
  if (lockstep) {
    api.pump(BOOT_FRAMES).then(api.markReady);
  } else {
    let warm = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      director.step(now);
      if (++warm === BOOT_FRAMES) api.markReady();
    };
    requestAnimationFrame(loop);
  }
}

try {
  boot();
} catch (err) {
  console.error('[boot] failed', err);
  showFailure(err);
}
