/**
 * The contract the tools/ scripts use (follows starters/fps-three/src/kit/debug/api.js).
 * It ships in the build on purpose: the playtest exercises the file a player gets.
 *
 *   window.__READY__   true once the first frames have landed
 *   window.__GAME__    snapshot() and debug helpers (restart, lose, autoplay, gold, wave)
 *   window.__SHOTS__, __APPLY_SHOT__(name)   named scene setups for screenshots
 *   window.__PUMP__(n), __PRESENT__(n)       hand-advance frames (?lockstep=1)
 */
export function installDebugApi(engine, shots, { lockstep }) {
  const ctx = engine.ctx;
  const get = ctx.peek;
  const gl = get('render').renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  window.__ENGINE__ = engine;
  window.__GAME__ = {
    snapshot() {
      const d = get('defense');
      const c = get('controls');
      const a = get('audio');
      const rs = get('render');
      const bot = get('bot');
      // the bot's favourite open cell for the first tower type, in screen pixels
      let hint = null;
      if (d.state === 'playing' && bot) {
        const spot = bot.rank(0)[0];
        if (spot) hint = { c: spot.c, r: spot.r, ...c.screenOf(spot.c, spot.r) };
      }
      return {
        state: d.state,
        score: d.score,
        frame: ctx.time.frame,
        wave: d.wave,
        waves: d.waves.length,
        cleared: d.cleared,
        countdown: +d.countdown.toFixed(2),
        lives: d.lives,
        gold: d.gold,
        kills: d.kills,
        leaked: d.leaked,
        speed: d.speed,
        tool: c.tool,
        selected: d.selected ? { id: d.selected.id, level: d.selected.level, c: d.selected.c, r: d.selected.r } : null,
        towers: d.towers.map((t) => ({ id: t.id, type: t.def.id, level: t.level, c: t.c, r: t.r, ...c.screenOf(t.c, t.r), shots: t.shots })),
        enemies: d.enemies.filter((e) => !e.dead).map((e) => ({ id: e.id, type: e.def.id, d: +e.d.toFixed(2), hp: +e.hp.toFixed(1) })),
        missiles: d.missiles.length,
        hint,
        roundTime: +d.roundTime.toFixed(2),
        audio: { state: a.actx?.state ?? 'not-started', played: a.played },
        render: { renderer: rendererName, drawCalls: rs.drawCalls, triangles: rs.triangles, scale: rs.scale, quality: ctx.config.quality },
      };
    },
    debug: {
      restart: () => get('defense').start(),
      lose: () => get('defense').lose(),
      win: () => get('defense').win(),
      autoplay: (on = true) => get('bot').set(!!on),
      gold: (n) => { get('defense').gold += n; },
      callWave: () => get('defense').callWave(),
    },
  };

  window.__SHOTS__ = shots;
  window.__APPLY_SHOT__ = (name) => {
    const shot = shots[name];
    if (!shot) return { error: `unknown shot ${name}` };
    const hud = get('hud');
    if (shot.hud === false) {
      hud.forceHidden = true;
      document.getElementById('ui').style.display = 'none';
    }
    shot.apply?.(ctx);
    get('camera').setShot?.(shot);
    return { ok: true, shot: name };
  };

  const markReady = () => { window.__READY__ = true; };

  if (lockstep) {
    engine.start = function start() { this._running = true; };
    window.__LOCKSTEP__ = true;
    /** Advance exactly n engine frames of 1/fps game time each. */
    window.__PUMP__ = (n = 1, fps = 60) => new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        engine.step(performance.now(), 1 / fps);
        if (++i >= n) resolve(ctx.time.frame);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    window.__PRESENT__ = (n = 2) => new Promise((resolve) => {
      let i = 0;
      const tick = () => (++i >= n ? resolve(ctx.time.frame) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
  } else {
    window.__LOCKSTEP__ = false;
    window.__PUMP__ = (n = 1) => new Promise((resolve) => {
      let i = 0;
      const tick = () => (++i >= n ? resolve(ctx.time.frame) : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    window.__PRESENT__ = window.__PUMP__;
  }
  return { pump: window.__PUMP__, markReady };
}
