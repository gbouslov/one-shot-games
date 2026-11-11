import * as THREE from 'three';
import { skyDome, sunLight } from '../kit/world/nature.js';

/**
 * Sky, light, fog and grade: what the first second looks like. A low sun
 * behind the far hills rakes across the valley so every tower and beetle
 * throws a long shadow toward the camera; cool sky fill, warm bounce.
 * See skills/make-it-look-great before changing this.
 */
export function createLook(ctx) {
  // the sun stands low over the camera's left shoulder: lit faces toward us, shadows fall back and right
  const sunDir = [-0.62, 0.62, 0.48];

  skyDome(ctx, {
    top: '#283a63',
    horizon: '#f2a46a',
    ground: '#3a2c20',
    sunColor: '#ffbf80',
    sunDir,
    sunSize: 0.0009,
    sunGlow: 40,
    horizonPower: 0.42,
    envIntensity: 0.5,
  });

  sunLight(ctx, { dir: sunDir, color: '#ffd09a', intensity: 3.2, range: 30, target: [1, 0, 0] });
  ctx.scene.add(new THREE.HemisphereLight('#9fb4e6', '#5a4630', 0.9));
  ctx.scene.fog = new THREE.Fog('#c99a7a', 55, 150);

  ctx.get('render').setLook({
    exposure: 1.12,
    bloom: { strength: 0.42, radius: 0.55, threshold: 0.86 },
    ao: { radius: 1.1, intensity: 1 },
    vignette: 0.4,
    grain: 0.022,
    saturation: 1.1,
    contrast: 1.06,
    shadows: '#c4cfff',
    highlights: '#fff0da',
  });

  return { update: () => {} };
}
