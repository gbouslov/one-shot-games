import * as THREE from 'three';
import { skyDome, sunLight, motes } from '../kit/world/builders.js';

/**
 * Sky, light, fog and grade: what the first second looks like.
 * See skills/make-it-look-great before changing this.
 */
export function createLook(ctx) {
  const sunDir = [-0.62, 0.2, -0.76];

  skyDome(ctx, {
    top: '#20304f',
    horizon: '#ee9659',
    ground: '#33241a',
    sunColor: '#ffbb7a',
    sunDir,
    sunSize: 0.0007,
    sunGlow: 70,
    horizonPower: 0.48,
    envIntensity: 0.55,
  });

  sunLight(ctx, { dir: sunDir, color: '#ffc38c', intensity: 3.6, range: 62 });
  ctx.scene.add(new THREE.HemisphereLight('#7f93c2', '#3d2a1c', 0.5));
  ctx.scene.fog = new THREE.FogExp2('#c98a62', 0.0125);

  // Light on the hands and the held weapon, fixed in view space: warm sunset key,
  // cool sky fill, a hot rim from the low sun behind, warm bounce off the dirt.
  ctx.get('weapons').viewLights?.set({ key: '#ffd2a0', fill: '#8fa6d6', rim: '#ffb070', bounce: '#c98a5a', sky: '#8a9cc8', ground: '#4a3424', intensity: 2.6 });

  ctx.get('render').setLook({
    exposure: 0.95,
    bloom: { strength: 0.32, radius: 0.6, threshold: 0.82 },
    ao: { radius: 0.8, intensity: 1 },
    sunDir,
    shafts: { strength: 1.4, color: '#ffc896', threshold: 1.2 },
    vignette: 0.42,
    grain: 0.028,
    saturation: 1.08,
    contrast: 1.06,
    shadows: '#c8d2ff',
    highlights: '#fff0dc',
  });

  const dust = motes(ctx, { count: 360, area: 26, height: 9, color: '#ffd5a2', size: 0.09, drift: [0.35, 0.06, 0.12], opacity: 0.55 });
  return { update: (dt) => dust.update(dt) };
}
