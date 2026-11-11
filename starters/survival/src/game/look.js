import * as THREE from 'three';
import { keyLight, motes, rain, skyDome } from '../kit/world/builders.js';

/**
 * Sky, light, fog, weather and grade: what the first second looks like.
 * A wet night on the fen. Cold moonlight from one side for shape and long
 * shadows (the key light follows you, so its shadow map stays sharp), a warm
 * storm lantern in the warden's hand for the pool you fight in, green marsh
 * lights drifting low, rain, and lightning now and then that shows the whole
 * clearing for a blink.
 */
export function createLook(ctx) {
  const q = ctx.config.q;
  const moonDir = [-0.5, 0.78, -0.38];
  skyDome(ctx, { top: '#070a10', horizon: '#1a2026', ground: '#050606', sunColor: '#c8d2e4', sunDir: moonDir, sunSize: 0.0006, sunGlow: 40, envIntensity: 0.5 });
  const moon = keyLight(ctx, { dir: moonDir, color: '#aebbd6', intensity: 1.15, range: 22 });
  const hemi = new THREE.HemisphereLight('#3f4a5a', '#16130f', 1.0);
  ctx.scene.add(hemi);
  ctx.scene.fog = new THREE.FogExp2('#0a0d10', 0.018);
  ctx.scene.background = new THREE.Color('#05070a');

  // the storm lantern: a warm point light at the warden's left hand
  const player = ctx.get('player');
  const lantern = new THREE.PointLight('#ffc27a', 34, 15, 1.6);
  lantern.position.set(-0.35, 1.0, 0.25);
  player.root.add(lantern);

  ctx.get('render').setLook({
    exposure: 1.4,
    tone: 'agx',
    bloom: { strength: 0.62, radius: 0.6, threshold: 0.78 },
    ao: { radius: 0.9, intensity: 1 },
    sunDir: null,
    shafts: { strength: 0 },
    vignette: 0.46,
    grain: 0.035,
    saturation: 1.1,
    contrast: 1.12,
    shadows: '#cfd8e6',
    highlights: '#fff0dc',
  });

  const drops = rain(ctx, { count: ctx.config.quality === 'low' ? 700 : 1700, area: 22, height: 14, speed: 23, color: '#8ea4c0', opacity: 0.3 });
  const lights = motes(ctx, { count: 90, area: 22, height: 2.2, color: '#9dffb0', size: 0.11, drift: [0.12, 0.05, -0.08], opacity: 0.75 });

  const rng = ctx.rng.fork();
  let next = rng.range(8, 16);
  let flash = 0;
  const base = { moon: moon.intensity, hemi: hemi.intensity };
  const off = new THREE.Vector3(...moonDir).normalize().multiplyScalar(36);
  return {
    update(dt) {
      drops.update(dt);
      lights.update(dt);
      // the moon's shadow box travels with the view
      const t = ctx.get('camera').target;
      moon.position.set(t.x + off.x, off.y, t.z + off.z);
      moon.target.position.set(t.x, 0, t.z);
      // lightning: two quick pulses, then thunder a moment later
      next -= dt;
      if (next <= 0) {
        next = rng.range(14, 28);
        flash = 1;
        setTimeout(() => ctx.get('audio').play('thunder'), 600);
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 3.2);
        const k = flash > 0.55 ? flash : flash * (0.6 + 0.4 * Math.sin(flash * 40));
        moon.intensity = base.moon + k * 4;
        hemi.intensity = base.hemi + k * 2.2;
      } else {
        moon.intensity = base.moon;
        hemi.intensity = base.hemi;
      }
      // the lantern breathes a little, like a real flame
      lantern.intensity = 34 * (0.93 + Math.sin(ctx.time.raw * 13) * 0.03 + Math.sin(ctx.time.raw * 7.3) * 0.04);
      void q;
    },
  };
}
