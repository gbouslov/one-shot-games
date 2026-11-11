/**
 * An in-page player for video and profiling. It presses the same input the
 * game reads, turning at a human rate so footage does not look robotic.
 * Follows the injected driver idea in mshumer/Claude-of-Duty tools/demo-driver.js (MIT).
 */
(() => {
  const TURN_PER_SEC = 3.2;
  const wrap = (a) => {
    let d = a % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  const held = new Set();
  const set = (input, code, on) => {
    if (on && !held.has(code)) {
      held.add(code);
      input.virtual(code, true);
    } else if (!on && held.has(code)) {
      held.delete(code);
      input.virtual(code, false);
    }
  };

  let t = 0;
  window.__BOT__ = {
    step(dt = 1 / 60) {
      const e = window.__ENGINE__;
      const input = e.input;
      const s = window.__GAME__.snapshot();
      if (s.state !== 'playing') {
        for (const c of [...held]) set(input, c, false);
        return s.state;
      }
      t += dt;
      const eye = s.player.eye;
      let best = null;
      let bestD = Infinity;
      for (const n of s.enemies) {
        const d = Math.hypot(n.x - eye[0], n.z - eye[2]);
        if (d < bestD) { bestD = d; best = n; }
      }

      let firing = false;
      let dYaw = Math.sin(t * 0.7) * 0.25 * dt * 4;
      let dPitch = -s.player.pitch * dt * 2;
      if (best) {
        const tx = best.x - eye[0];
        const tz = best.z - eye[2];
        const ty = best.y + best.height * 0.62 - eye[1];
        dYaw = wrap(Math.atan2(-tx, -tz) - s.player.yaw);
        dPitch = Math.atan2(ty, Math.hypot(tx, tz)) - s.player.pitch;
        firing = Math.hypot(dYaw, dPitch) < Math.max(0.035, 0.5 / Math.max(1, bestD));
        const max = TURN_PER_SEC * dt;
        const k = Math.min(1, max / (Math.hypot(dYaw, dPitch) || 1));
        dYaw *= k;
        dPitch *= k;
      }
      const sens = e.config.sensitivity;
      input._rawLook.x += -dYaw / sens;
      input._rawLook.y += -dPitch / sens;

      set(input, 'KeyF', firing);
      set(input, 'KeyW', !best || bestD > 16);
      set(input, 'KeyS', !!best && bestD < 7);
      set(input, 'KeyA', !!best && Math.sin(t * 0.9) > 0.25);
      set(input, 'KeyD', !!best && Math.sin(t * 0.9) < -0.25);
      return s.state;
    },
  };
})();
