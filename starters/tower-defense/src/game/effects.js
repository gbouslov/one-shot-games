import * as THREE from 'three';

/**
 * Particles and light at every moment of action, wired to the defense's events.
 * fx.burst / fx.flash / fx.mark come from kit/fx/fx.js. Pulse rings are drawn here.
 */
export function createEffects(ctx, level) {
  const fx = ctx.get('fx');
  const ev = ctx.events;

  // expanding frost rings for the bell
  const ringGeo = new THREE.RingGeometry(0.93, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#a9e4ff').multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    m.visible = false;
    m.renderOrder = 8;
    ctx.scene.add(m);
    return { m, t: 1, r: 1 };
  });
  let ringHead = 0;

  ev.on('tower:fire', ({ tower, from }) => {
    if (tower.def.kind === 'shell') {
      fx.burst(from, { count: 14, color: '#ffb060', speed: 3.2, life: 0.35, size: 0.22, gravity: 2, drag: 4, dir: [0, 1, 0], spread: 0.8 });
      fx.burst(from, { count: 6, color: '#4a423c', speed: 1.4, life: 1.4, size: 0.5, gravity: 1.2, additive: false, drag: 2, grow: 2, dir: [0, 1, 0], spread: 0.6 });
      fx.flash(from, { color: '#ff9a4a', intensity: 14, distance: 6, life: 0.12 });
    } else {
      fx.burst(from, { count: 5, color: '#ffe0a0', speed: 2.2, life: 0.18, size: 0.09, gravity: 0, drag: 6 });
    }
  });

  ev.on('enemy:hit', ({ at, color }) => {
    fx.burst(at, { count: 7, color: color ?? '#ffd58a', speed: 3.4, life: 0.28, size: 0.07, gravity: -6, drag: 2 });
    fx.burst(at, { count: 3, color: '#1a1512', speed: 2, life: 0.5, size: 0.06, gravity: -9, additive: false, drag: 1 });
  });

  ev.on('enemy:killed', ({ enemy, at }) => {
    const big = (enemy.def.radius ?? 0.4) > 0.6;
    const p = [at[0], at[1] + 0.35 * (enemy.def.scale ?? 1), at[2]];
    fx.burst(p, { count: big ? 22 : 12, color: '#15110e', speed: big ? 4 : 3, life: 0.8, size: big ? 0.14 : 0.09, gravity: -11, additive: false, drag: 1, dir: [0, 1, 0], spread: 1.1 });
    fx.burst(p, { count: big ? 26 : 14, color: enemy.def.id === 'mite' ? '#ff6a3a' : big ? '#c48aff' : '#ffb347', speed: big ? 3.4 : 2.6, life: 0.55, size: 0.1, gravity: 1.5, drag: 2.4 });
    fx.burst(p, { count: big ? 5 : 3, color: '#3b2f4a', speed: 0.8, life: 1.2, size: big ? 0.7 : 0.4, gravity: 0.6, additive: false, drag: 2, grow: 1.4 });
    fx.mark([at[0], at[1] + 0.03, at[2]], [0, 1, 0], { color: '#14100c', size: big ? 1.1 : 0.6 });
  });

  ev.on('shell:burst', ({ at, radius }) => {
    fx.burst([at[0], at[1] + 0.2, at[2]], { count: 30, color: '#ff8a3a', speed: 5, life: 0.4, size: 0.3, gravity: 1, drag: 3.5 });
    fx.burst([at[0], at[1] + 0.2, at[2]], { count: 18, color: '#ffd27a', speed: 7, life: 0.5, size: 0.06, gravity: -9, drag: 0.6, dir: [0, 1, 0], spread: 0.9 });
    fx.burst([at[0], at[1] + 0.4, at[2]], { count: 10, color: '#3f3833', speed: 1.6, life: 1.8, size: 0.9, gravity: 0.9, additive: false, drag: 1.6, grow: 2.2 });
    fx.burst([at[0], at[1] + 0.1, at[2]], { count: 14, color: '#8a7358', speed: 3, life: 0.9, size: 0.35, gravity: 0, additive: false, drag: 3, grow: 1.5, dir: [0, 0.15, 0], spread: 1 });
    fx.flash([at[0], at[1] + 0.8, at[2]], { color: '#ff8c40', intensity: 40, distance: radius * 4, life: 0.25 });
    fx.mark([at[0], at[1] + 0.02, at[2]], [0, 1, 0], { color: '#1d1610', size: radius * 0.9 });
  });

  ev.on('tower:pulse', ({ tower, range }) => {
    const r = rings[ringHead];
    ringHead = (ringHead + 1) % rings.length;
    r.t = 0;
    r.r = range;
    r.m.position.set(tower.x, tower.y + 0.15, tower.z);
    r.m.visible = true;
    fx.burst([tower.x, tower.y + 2.0, tower.z], { count: 12, color: '#bfeaff', speed: 2.4, life: 0.7, size: 0.08, gravity: -1.5, drag: 1.5 });
  });

  ev.on('tower:built', ({ tower }) => {
    fx.burst([tower.x, tower.y + 0.2, tower.z], { count: 18, color: '#9a8466', speed: 2.6, life: 0.9, size: 0.35, gravity: 0.2, additive: false, drag: 3, grow: 1.6, dir: [0, 0.1, 0], spread: 1 });
  });
  ev.on('tower:upgraded', ({ tower }) => {
    fx.burst([tower.x, tower.y + 2.2, tower.z], { count: 26, color: '#ffd27a', speed: 3, life: 0.8, size: 0.09, gravity: -2, drag: 1.6 });
  });

  ev.on('enemy:leaked', () => {
    const s = level.shrine;
    fx.burst([s.x + 1.2, 2.2, s.z], { count: 30, color: '#a77aff', speed: 4, life: 0.8, size: 0.14, gravity: -2, drag: 1.5 });
  });

  return {
    update(dt) {
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt * 1.8;
        if (r.t >= 1) {
          r.m.visible = false;
          continue;
        }
        const e = 1 - (1 - r.t) ** 3;
        r.m.scale.setScalar(Math.max(0.01, r.r * e));
        r.m.material.opacity = (1 - r.t) * 0.55;
      }
    },
  };
}
