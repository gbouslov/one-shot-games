/**
 * The contract the tools/ scripts use. It ships in the build on purpose: the
 * playtest exercises the exact file a player gets. Adapted from
 * starters/flight/src/kit/debug/api.js (itself from starters/fps-three) for a
 * rail round.
 *
 *   window.__READY__   true once the first frames have landed
 *   window.__ENGINE__  the engine
 *   window.__GAME__    snapshot() and debug: restart(), lose(), autoplay(on), fastForward(s)
 *   window.__SHOTS__, __APPLY_SHOT__(name)   named setups for screenshots (src/game/shots.js)
 *   window.__PUMP__(n), __PRESENT__(n)       hand-advance frames (?lockstep=1)
 */
import * as THREE from 'three';

export function installDebugApi(engine, shots, { lockstep, game }) {
  const ctx = engine.ctx;
  const get = ctx.peek;

  const gl = get('render').renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  window.__ENGINE__ = engine;
  window.__GAME__ = {
    snapshot() {
      const r = get('round');
      const s = r.ship;
      const a = get('audio');
      const rs = get('render');
      return {
        state: r.state,
        score: r.score,
        frame: ctx.time.frame,
        elapsed: ctx.time.elapsed,
        roundTime: r.elapsed,
        distance: s.distance,
        courseLength: r.courseLength,
        hull: r.hull,
        kills: r.kills,
        enemies: r.enemies.length,
        enemyShots: r.shots.length,
        boss: r.boss ? { active: r.bossActive, open: r.boss.open, dead: r.boss.dead, nodes: r.boss.nodes.filter((n) => n.alive).length, core: r.boss.core.hp } : null,
        autoplay: r.autoplay,
        player: {
          x: s.offset.x, y: s.offset.y, bank: s.bank, pitch: s.pitch,
          speed: s.speed, boost: s.boost, boosting: s.boosting, shots: s.shots, dead: r.dead,
        },
        inputs: { ...s.inputs },
        touch: ctx.input.touchUsed,
        audio: { state: a.actx?.state ?? 'not-started', played: a.played, muted: a.muted },
        render: { renderer: rendererName, drawCalls: rs.drawCalls, triangles: rs.triangles, scale: rs.scale, quality: ctx.config.quality },
      };
    },
    debug: {
      restart: () => game.start(),
      lose: () => get('round').lose('debug'),
      autoplay: (on = true) => get('round').setAutoplay(on),
      fastForward: (s) => engine.fastForward(s),
    },
  };

  window.__SHOTS__ = shots;
  window.__APPLY_SHOT__ = (name) => {
    const shot = shots[name];
    if (!shot) return { error: `unknown shot ${name}` };
    const r = get('round');
    if (shot.state === 'playing') {
      game.start();
      r.setAutoplay(true);
    }
    if (shot.seconds) engine.fastForward(shot.seconds);
    if (shot.untilDistance !== undefined) {
      for (let t = 0; t < 200 && r.ship.distance < shot.untilDistance && r.state === 'playing'; t += 0.5) engine.fastForward(0.5);
    }
    if (shot.until) {
      for (let t = 0; t < 200 && !shot.until(r) && r.state === 'playing'; t += 0.1) engine.fastForward(0.1);
    }
    if (shot.after) engine.fastForward(shot.after);
    if (shot.camera) {
      const off = new THREE.Vector3();
      const look = new THREE.Vector3();
      ctx.cameraOverride = (cam, ship) => {
        cam.position.copy(off.set(...shot.camera.pos).add(ship.position));
        cam.up.set(0, 1, 0);
        cam.lookAt(look.set(...shot.camera.look).add(ship.position));
        if (shot.camera.fov) {
          cam.fov = shot.camera.fov;
          cam.updateProjectionMatrix();
        }
      };
    }
    if (shot.hud === false) document.getElementById('ui').style.display = 'none';
    return { ok: true, shot: name };
  };

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

  return { pump: window.__PUMP__, markReady: () => { window.__READY__ = true; } };
}
