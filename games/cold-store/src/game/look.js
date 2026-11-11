import * as THREE from 'three';
import { motes } from '../kit/world/builders.js';
import { sunLight } from '../kit/world/builders.js';
import { assets } from '../assets/index.js';

/**
 * Night, inside. The night HDRI gives reflections and a faint ambient only (no
 * background: there is a roof). A cold moon comes through the skylight strips as hard
 * shafts; the player's flashlight (world.js) is the key light. Fog is dense and blue,
 * so the beam and the shafts have something to light.
 */
export const SKY = 'rooftop_night';

export function createLook(ctx) {
  assets.sky(ctx, SKY, { exposure: 1, env: 1.0, background: false });
  ctx.scene.background = new THREE.Color('#05070b');

  const moonDir = [-0.35, 0.86, -0.38];
  sunLight(ctx, { dir: moonDir, color: '#8fb0e8', intensity: 5.5, range: 26 });
  ctx.scene.add(new THREE.HemisphereLight('#4a628c', '#241c16', 1.5));
  ctx.scene.fog = new THREE.FogExp2('#18243a', 0.024);

  ctx.get('weapons').viewLights?.set({ key: '#eef2ff', fill: '#6a7ea6', rim: '#ffb35a', bounce: '#3a4256', sky: '#5a6a8a', ground: '#22222a', intensity: 2.8, hemi: 1.1 });

  ctx.get('render').setLook({
    exposure: 1.45,
    bloom: { strength: 0.42, radius: 0.65, threshold: 1.0 },
    ao: { radius: 0.8, intensity: 1.35 },
    sunDir: moonDir,
    shafts: { strength: 0.9, color: '#9fc0ff', threshold: 0.9 },
    vignette: 0.55,
    grain: 0.04,
    saturation: 0.92,
    contrast: 1.18,
    shadows: '#7f9ad8',
    highlights: '#fff0e0',
  });

  // breath-fog and ice dust hanging in the air: visible only where a light catches it
  const dust = motes(ctx, { count: 700, area: 22, height: 8, color: '#dbe8ff', size: 0.045, drift: [0.06, 0.02, 0.04], opacity: 0.55 });
  // cold mist rolling along the aisle floors (Unity Labs smoke flipbook, CC0), faint and slow
  const mist = [];
  for (const x of [-9.2, -0.8, 7.6, 15]) {
    for (let i = 0; i < 4; i++) {
      const size = 2.6 + (i % 2) * 0.8;
      const m = assets.flipbook('smoke-wispy', { size, fps: 6, phase: (i * 0.29 + x * 0.07) % 1, color: '#c4d8ec', intensity: 2.2, opacity: 0.3, upright: true });
      // centred 0.4 m up, so the puff hugs the floor: a layer, not a column
      m.object.position.set(x + Math.sin(i * 2.3) * 0.6, 0.4 - size / 2, 9 - i * 6.2);
      ctx.scene.add(m.object);
      mist.push(m);
    }
  }
  return { update: (dt) => { dust.update(dt); for (const m of mist) m.update(dt); } };
}
