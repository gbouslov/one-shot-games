// Starts the engine, owns the round (title, playing, won, lost), drives time, and installs the
// hooks the tools use: window.__READY__, __GAME__.snapshot()/debug, and the capture handshake.
//
// Time: the engine runs fixed 1/60 s updates. This loop feeds it real time clamped to 0.1 s per
// frame, so a slow software-rendered page runs the game at half speed or better instead of the
// engine's own 50 ms clamp (a quarter speed at 5 fps). ?lockstep=1 hands stepping to __PUMP__.
import * as LJS from './engine.js';
import { seedRandom } from './rng.js';
import { updateInput, refreshInput, input } from './input.js';
import { audio, resumeAudio } from './audio.js';
import { fx, updateFx, clearFx, setupPost } from './fx.js';
import { createScreens } from './screens.js';

export const params = new URLSearchParams(location.search);
export const capture = params.get('capture') === '1';
export const lockstep = capture && params.get('lockstep') === '1';
export const quality = ['low', 'medium', 'high'].includes(params.get('q')) ? params.get('q') : 'high';
export const seed = Number(params.get('seed')) || (capture ? 1234 : (Date.now() % 1e9));

/** The round, shared with the game. The game calls round.win() / round.lose() and adds to round.score. */
export const round = {
  state: 'title',
  score: 0,
  elapsed: 0, // seconds of play this round
  endedAt: 0,
  info: {},
};

let game;
let screens;
const stats = { fps: 0 };

function setState(s, info = {}) {
  round.state = s;
  round.info = info;
  round.endedAt = performance.now();
  screens?.show(s, { ...info, score: round.score, time: round.elapsed });
}

export const control = {
  start() {
    round.score = 0;
    round.elapsed = 0;
    clearFx();
    input.setBot(input.botOn); // keep the bot if it was on
    game.start();
    setState('playing');
    game.onState?.('playing');
  },
  win(info) {
    if (round.state !== 'playing') return;
    setState('won', info);
    game.onState?.('won');
  },
  lose(info) {
    if (round.state !== 'playing') return;
    setState('lost', info);
    game.onState?.('lost');
  },
  toTitle() {
    setState('title');
  },
};

/**
 * game: {
 *   name, theme, text, touch, bindings,
 *   init(),                 build art, level, sounds (engine is running)
 *   start(),                a fresh round
 *   update(), render(), renderPost()   every update / frame; read round.state
 *   snapshot(),             extra fields for the tools
 *   bot(),                  each update while autoplay is on: write input.bot.*
 *   shots: { name: { hud?: false, apply() } }
 *   post: options for fx.setupPost, canvasSize: optional fixed vec2, clear: LJS colour
 * }
 */
export function boot(g) {
  game = g;
  seedRandom(seed);
  LJS.setShowSplashScreen(false);
  LJS.setTouchGamepadEnable(false);
  LJS.setInputWASDEmulateDirection(false); // the game binds its own keys in bindActions
  LJS.setTilesPixelated(false);
  LJS.setCanvasPixelated(false);
  LJS.setEngineManualStep(true);
  LJS.setCanvasMaxAspect(2.4);
  if (g.canvasSize) LJS.setCanvasFixedSize(g.canvasSize);
  if (g.clear) LJS.setCanvasClearColor(g.clear);

  if (capture) {
    // stable pictures: no transitions
    const s = document.createElement('style');
    s.textContent = '#ui .screen, #ui .hud { transition: none !important; animation: none !important; } #ui .cta { animation: none !important; }';
    document.head.appendChild(s);
  }

  const gameInit = () => {
    screens = createScreens({ theme: g.theme, text: g.text, touch: g.touch });
    g.init({ screens, quality });
    if (g.post !== false) setupPost(quality, g.post ?? {});
    setState('title');
  };

  const gameUpdate = () => {
    updateInput();
    if (input.botOn && round.state === 'playing') {
      g.bot?.();
      refreshInput(); // the bot's presses count this same update
    }
    if (round.state === 'playing') round.elapsed += 1 / 60;
    g.update();
    updateFx();
  };

  const root = document.getElementById('game');
  LJS.engineInit(gameInit, gameUpdate, () => {}, () => g.render?.(), () => g.renderPost?.(), [], root).then(afterInit);

  // starting a round: click, tap or Enter on the title and end cards
  const tryStart = () => {
    resumeAudio();
    g.onGesture?.();
    if (round.state === 'playing') return;
    control.start();
  };
  addEventListener('pointerdown', (e) => { if (e.target?.closest?.('.touch button')) return; tryStart(); });
  addEventListener('keydown', (e) => {
    resumeAudio();
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || (e.code === 'Space' && round.state !== 'playing')) tryStart();
  });
}

function installApi() {
  window.__GAME__ = {
    snapshot() {
      return {
        state: round.state,
        score: round.score,
        elapsed: +round.elapsed.toFixed(2),
        frame: LJS.frame,
        time: +LJS.time.toFixed(3),
        render: { renderer: 'webgl2d', drawCalls: Math.max(1, LJS.engineObjects.length), objects: LJS.engineObjects.length, quality, fps: +stats.fps.toFixed(1) },
        audio: { state: audio.state, played: audio.played },
        bot: input.botOn,
        ...(game.snapshot?.() ?? {}),
      };
    },
    debug: {
      restart: () => control.start(),
      lose: () => {
        if (round.state !== 'playing') control.start();
        control.lose({ reason: 'debug' });
      },
      win: () => {
        if (round.state !== 'playing') control.start();
        control.win({ reason: 'debug' });
      },
      autoplay: (on = true) => input.setBot(on),
      ...(game.debug ?? {}),
    },
  };

  window.__SHOTS__ = game.shots ?? {};
  window.__APPLY_SHOT__ = (name) => {
    const shot = game.shots?.[name];
    if (!shot) return { error: `unknown shot ${name}` };
    shot.apply();
    if (shot.state !== 'title') screens.hideAll();
    if (shot.hud === false) screens.hud.style.display = 'none';
    return { ok: true, shot: name };
  };
}

function afterInit() {
  installApi();
  let last = performance.now();
  let acc = 0;

  // n updates, one render
  const step = (n) => {
    if (n <= 0) return;
    LJS.setTimeScale(n);
    LJS.engineStep(1);
  };

  if (lockstep) {
    window.__LOCKSTEP__ = true;
    window.__PUMP__ = (n = 1) => new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        step(1);
        if (++i >= n) resolve(LJS.frame);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    window.__PRESENT__ = (n = 2) => new Promise((resolve) => {
      let i = 0;
      const tick = () => (++i >= n ? resolve(LJS.frame) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    step(1);
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__READY__ = true; }));
    return;
  }

  window.__LOCKSTEP__ = false;
  let frames = 0;
  const loop = (now) => {
    const raw = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.1, raw);
    last = now;
    if (raw > 0) stats.fps = stats.fps ? stats.fps * 0.9 + 0.1 / raw : 1 / raw;
    if (fx.freeze > 0) {
      fx.freeze -= dt;
      step(0);
    } else {
      acc += dt * 60;
      const n = Math.floor(acc + 0.2);
      acc -= n;
      step(n);
    }
    if (++frames === 3) window.__READY__ = true;
    requestAnimationFrame(loop);
  };
  window.__PUMP__ = (n = 1) => new Promise((resolve) => {
    let i = 0;
    const tick = () => (++i >= n ? resolve(LJS.frame) : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
  window.__PRESENT__ = window.__PUMP__;
  step(1);
  requestAnimationFrame(loop);
}
