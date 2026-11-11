/**
 * The contract the tools/ scripts use. It ships in the build on purpose: the
 * playtest exercises the exact file a player gets. Follows
 * starters/fps-three/src/kit/debug/api.js.
 *
 *   window.__READY__   true once the first frames have landed
 *   window.__GAME__    snapshot() and debug helpers
 *   window.__SHOTS__, __APPLY_SHOT__(name)   named camera setups for screenshots
 *   window.__PUMP__(n, fps), __PRESENT__(n)  hand-advance frames (?lockstep=1)
 */
import * as THREE from 'three';

export function installDebugApi(director, shots, { lockstep }) {
  window.__DIRECTOR__ = director;
  window.__GAME__ = {
    snapshot: () => director.snapshot(),
    debug: {
      restart: () => director.startRace(),
      lose: () => director.lose(),
      autoplay: (on = true) => director.setAutoplay(on),
      /** Simulate n seconds of game time without drawing (bots drive). */
      fastForward: (n) => director.fastForward(n),
    },
  };

  const tmp = { right: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  const kartFrame = (out, k, [x, y, z]) => {
    const s = k.state;
    k.forwardDir(tmp.fwd);
    tmp.fwd.y = 0;
    tmp.fwd.normalize();
    tmp.right.set(-tmp.fwd.z, 0, tmp.fwd.x);
    return out.copy(s.position).addScaledVector(tmp.right, x).addScaledVector(tmp.up, y).addScaledVector(tmp.fwd, z);
  };

  window.__SHOTS__ = shots;
  window.__APPLY_SHOT__ = (name) => {
    const shot = shots[name];
    if (!shot) return { error: `unknown shot ${name}` };
    if (shot.mode === 'race') {
      director.startRace();
      director.setAutoplay(true);
    }
    director.fastForward(shot.seconds ?? 0);
    // `until` keeps simulating until the player is doing the thing the shot is about.
    const wait = { drift: (s) => s.isDrifting && s.driftStage >= 2, boost: (s) => s.isBoosting }[shot.until];
    for (let t = 0; wait && t < 90 && !wait(director.karts[0].state); t += 0.1) director.fastForward(0.1);
    if (shot.camera) {
      const pos = new THREE.Vector3();
      const look = new THREE.Vector3();
      director.cameraOverride = (cam, d) => {
        const k = d.karts[0];
        cam.position.copy(kartFrame(pos, k, shot.camera.pos));
        cam.lookAt(kartFrame(look, k, shot.camera.look));
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
    window.__LOCKSTEP__ = true;
    window.__PUMP__ = (n = 1, fps = 60) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          director.step(performance.now(), 1 / fps);
          if (++i >= n) resolve(director.frame);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    window.__PRESENT__ = (n = 2) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => (++i >= n ? resolve(director.frame) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
  } else {
    window.__LOCKSTEP__ = false;
    window.__PUMP__ = (n = 1) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => (++i >= n ? resolve(director.frame) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
    window.__PRESENT__ = window.__PUMP__;
  }
  return { pump: window.__PUMP__, markReady: () => (window.__READY__ = true) };
}
