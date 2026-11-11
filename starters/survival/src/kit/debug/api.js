/**
 * The contract the tools/ scripts use. It ships in the build on purpose: the
 * playtest exercises the exact file a player gets. Follows the first-person
 * kit's debug/api.js; the snapshot is shaped for a ground-plane shooter.
 *
 *   window.__READY__   true once the first frames have landed
 *   window.__ENGINE__  the engine
 *   window.__GAME__    snapshot() and debug helpers (restart, lose, autoplay)
 *   window.__SHOTS__, __APPLY_SHOT__(name)   named setups for screenshots
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
      const p = get('player');
      const ar = get('arsenal');
      const h = get('horde');
      const r = get('round');
      const lu = get('levelup');
      const a = get('audio');
      const rs = get('render');
      const kinds = {};
      for (const n of h.alive) kinds[n.def.id] = (kinds[n.def.id] ?? 0) + 1;
      return {
        state: r.state,
        score: r.score,
        killed: r.killed,
        elapsed: r.elapsed,
        duration: r.duration,
        clock: Math.max(0, r.duration - r.elapsed),
        frame: ctx.time.frame,
        timeScale: ctx.time.scale,
        player: {
          x: p.x, z: p.z, yaw: p.yaw, health: p.health, maxHealth: p.maxHealth, speed: p.speed, pickup: p.pickup, dead: p.dead,
        },
        level: lu.level,
        xp: lu.xp,
        next: lu.next,
        levelup: { open: lu.open, picks: lu.picks, choices: lu.choices.map((o) => `${o.kind}:${o.id}`) },
        owned: ar.owned.map((o) => ({ id: o.def.id, level: o.level })),
        stats: { ...ar.stats },
        horde: { alive: h.alive.length, kinds, spawned: h.stats.spawned, boss: h.boss ? { type: h.boss.def.id, hp: Math.round(h.boss.hp), maxHp: Math.round(h.boss.maxHp) } : null },
        gems: get('gems').items.length,
        pickups: get('pickups').items.length,
        pixelfx: get('pixelfx') ? { enabled: get('pixelfx').enabled, ...get('pixelfx').stats } : null,
        input: { mode: ctx.input.mode, move: { ...ctx.input.move }, fire: ctx.input.fire },
        audio: { state: a.actx?.state ?? 'not-started', played: a.played },
        render: { renderer: rendererName, drawCalls: rs.drawCalls, triangles: rs.triangles, scale: rs.scale, quality: ctx.config.quality, frameMs: Math.round(rs.frameMs ?? 0) },
      };
    },
    debug: {
      restart: () => get('round').start(),
      lose: () => {
        const p = get('player');
        p.invuln = 0;
        p.applyDamage(1e6, null);
      },
      autoplay: (on = true) => get('bot').setEnabled(!!on),
      damagePlayer: (n) => { get('player').invuln = 0; get('player').applyDamage(n, null); },
      killAll: () => { for (const e of [...get('horde').alive]) get('horde').damage(e, 1e6, 0, 1, 1); },
      spawn: (type, x, z) => get('horde').spawn(type, x, z),
      /** Earn exactly one level, which opens the choice of three. */
      levelUp: () => get('levelup').force(),
      /** Jump the clock to `seconds` of game time (captures, checks). */
      setClock: (seconds) => { get('round').elapsed = seconds; },
    },
  };

  window.__SHOTS__ = shots;
  window.__APPLY_SHOT__ = (name) => {
    const shot = shots[name];
    if (!shot) return { error: `unknown shot ${name}` };
    const cam = get('camera');
    if (shot.play) get('round').start();
    else if (!shot.title) get('hud').hideScreen();
    if (shot.hud === false) document.getElementById('ui').style.display = 'none';
    shot.apply?.(ctx);
    if (shot.pos) {
      cam.scripted = true;
      ctx.input.frozen = !shot.play;
      ctx.camera.position.set(...shot.pos);
      ctx.camera.rotation.set(0, 0, 0, 'YXZ');
      ctx.camera.lookAt(...shot.look);
    } else cam.snap();
    if (shot.fov) {
      ctx.camera.fov = shot.fov;
      ctx.camera.updateProjectionMatrix();
    }
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
