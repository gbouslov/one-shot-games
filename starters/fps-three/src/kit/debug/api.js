/**
 * The contract the tools/ scripts use. It ships in the build on purpose: the
 * playtest exercises the exact file a player gets.
 *
 *   window.__READY__   true once the first frames have landed
 *   window.__ENGINE__  the engine
 *   window.__GAME__    snapshot() and debug helpers
 *   window.__SHOTS__, __APPLY_SHOT__(name)   named camera setups for screenshots
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
      const w = get('weapons');
      const e = get('enemies');
      const r = get('round');
      const a = get('audio');
      const rs = get('render');
      let peak = 0;
      if (a.analyser) {
        const buf = new Float32Array(a.analyser.fftSize);
        a.analyser.getFloatTimeDomainData(buf);
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
      }
      return {
        state: r.state,
        wave: r.wave,
        waves: r.rules.waves.length,
        queued: r.queue.length,
        elapsed: r.elapsed,
        frame: ctx.time.frame,
        player: {
          x: p.feet.x, y: p.feet.y, z: p.feet.z, yaw: p.yaw, pitch: p.pitch,
          eye: [p.eye.x, p.eye.y, p.eye.z], forward: [p.forward.x, p.forward.y, p.forward.z],
          health: p.health, speed: p.speed, grounded: p.grounded, sprinting: p.sprinting, dead: p.dead,
        },
        weapon: { id: w.current.def.id, kind: w.current.def.kind, ammo: Number.isFinite(w.current.ammo) ? w.current.ammo : -1, magazine: w.current.def.magazine, reloading: w.reloading > 0, slots: w.slots.length },
        stats: { ...w.stats, projectiles: w.projectiles.length },
        enemies: e.alive.map((n) => ({ id: n.id, type: n.def.id, x: n.x, y: n.y, z: n.z, hp: n.hp, state: n.state, height: n.def.height })),
        input: { mode: ctx.input.mode, pointerLocked: ctx.input.pointerLocked, lockEverWorked: ctx.input.lockEverWorked },
        audio: { state: a.actx?.state ?? 'not-started', played: a.played, peak },
        render: { renderer: rendererName, drawCalls: rs.drawCalls, triangles: rs.triangles, scale: rs.scale, quality: ctx.config.quality, programs: rs.renderer.info.programs?.length ?? 0 },
      };
    },
    debug: {
      restart: () => get('round').start(),
      damagePlayer: (n) => get('player').applyDamage(n, null),
      killAll: () => { for (const e of [...get('enemies').alive]) get('enemies').damage(e, 1e6, [e.x, e.y + 1, e.z], [0, 0, 1], false); },
      teleport: (x, y, z, yaw) => {
        const p = get('player');
        p.character.teleport(x, y, z);
        p.feet.set(p.character.position.x, p.character.position.y, p.character.position.z);
        p.prevFeet.copy(p.feet);
        if (yaw !== undefined) p.yaw = yaw;
      },
    },
  };

  window.__SHOTS__ = shots;
  window.__APPLY_SHOT__ = (name) => {
    const shot = shots[name];
    if (!shot) return { error: `unknown shot ${name}` };
    const p = get('player');
    ctx.input.frozen = true;
    p.scriptedCamera = true;
    get('hud').hideScreen();
    if (shot.hud === false) document.getElementById('ui').style.display = 'none';
    ctx.camera.position.set(...shot.pos);
    ctx.camera.rotation.set(0, 0, 0, 'YXZ');
    ctx.camera.lookAt(...shot.look);
    if (shot.fov) {
      ctx.camera.fov = shot.fov;
      ctx.camera.updateProjectionMatrix();
    }
    shot.apply?.(ctx);
    return { ok: true, shot: name };
  };

  const snapBoot = () => { window.__READY__ = true; };

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

  return { pump: window.__PUMP__, markReady: snapBoot };
}
