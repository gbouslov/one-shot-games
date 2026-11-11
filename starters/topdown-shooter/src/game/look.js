import * as THREE from 'three';
import { keyLight, motes, rain, skyDome } from '../kit/world/builders.js';

/**
 * Sky, light, fog, weather and grade: what the first second looks like.
 * Night in the rain. Cold moonlight from one side for shape and long shadows,
 * warm sodium pools from the lamps (level.js), and the keeper's headlamp
 * throwing a hard cone wherever you aim.
 */
export function createLook(ctx) {
  const moonDir = [-0.55, 0.75, -0.42];
  skyDome(ctx, { top: '#080b12', horizon: '#1d222c', ground: '#060708', sunColor: '#c4cde0', sunDir: moonDir, sunSize: 0.0006, sunGlow: 40, envIntensity: 0.45 });
  keyLight(ctx, { dir: moonDir, color: '#b4c0dc', intensity: 1.25, range: 34 });
  ctx.scene.add(new THREE.HemisphereLight('#465063', '#1a1612', 1.1));
  ctx.scene.fog = new THREE.FogExp2('#0c0f14', 0.016);
  ctx.scene.background = new THREE.Color('#06080b');

  // The headlamp: a spot light carried by the player, aimed where they aim.
  const player = ctx.get('player');
  const lampLight = new THREE.SpotLight('#ffe7c2', 420, 24, 0.5, 0.6, 1.5);
  lampLight.position.set(0.1, 1.85, 0.2);
  lampLight.target.position.set(0, 0, 6);
  if (ctx.config.q.shadowSize > 0) {
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.0006;
    lampLight.shadow.normalBias = 0.03;
    lampLight.shadow.camera.near = 0.4;
    lampLight.shadow.camera.far = 26;
  }
  player.root.add(lampLight, lampLight.target);
  // a little warm fill around the keeper, so the body never sinks into the dark
  if (ctx.config.quality !== 'low') {
    const fill = new THREE.PointLight('#ffcf9e', 3.2, 5, 2);
    fill.position.set(0, 2.2, 0.4);
    player.root.add(fill);
  }

  ctx.get('render').setLook({
    exposure: 1.35,
    tone: 'agx',
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.8 },
    ao: { radius: 0.9, intensity: 1 },
    sunDir: null,
    shafts: { strength: 0 },
    vignette: 0.42,
    grain: 0.03,
    saturation: 1.12,
    contrast: 1.1,
    shadows: '#d6dcea',
    highlights: '#fff0de',
  });

  const drops = rain(ctx, { count: ctx.config.quality === 'low' ? 700 : 1600, area: 20, height: 14, speed: 24, color: '#8fa6c4', opacity: 0.32 });
  const spores = motes(ctx, { count: 160, area: 20, height: 5, color: '#6ff5dc', size: 0.07, drift: [0.15, 0.12, 0.05], opacity: 0.6 });
  return {
    update(dt) {
      drops.update(dt);
      spores.update(dt);
    },
  };
}
