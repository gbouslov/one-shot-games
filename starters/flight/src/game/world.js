import * as THREE from 'three';
import { createIslands } from '../kit/world/heightfield.js';
import { buildTerrain, heightTexture } from '../kit/world/terrain.js';
import { createWater } from '../kit/world/water.js';
import { createSky } from '../kit/world/sky.js';
import { createClouds } from '../kit/world/clouds.js';
import { loadEnvironment } from '../kit/world/environment.js';
import { palette as P } from './look.js';
// CC0 HDRI (credit in NOTICES.md), inlined by the build.
import skyHdrUrl from './assets/sky-hdri/industrial_sunset_02_puresky_1k_preview.hdr?url';

/**
 * The world: an archipelago at golden hour. Islands from the seed, terrain
 * with baked evening shadows, a sea with shallows and sun glitter, a sky with
 * high cloud, a few cumulus, a low warm sun and haze that matches the horizon.
 */
export async function buildWorld(ctx, config) {
  const { scene, rng } = ctx;
  const q = ctx.config.q;
  const W = config.world;
  const sunDir = config.sunDir;
  const sun3 = new THREE.Vector3(...sunDir).normalize();

  const field = createIslands({ size: W.size, segments: q.terrainSegments, seed: config.worldSeed, land: W.land, relief: W.relief, lift: W.lift, featureSize: W.featureSize });

  const c = new THREE.Color();
  const sand = new THREE.Color(P.sand);
  const wet = new THREE.Color(P.wetSand);
  const grass = new THREE.Color(P.grass);
  const dry = new THREE.Color(P.dryGrass);
  const forest = new THREE.Color(P.forest);
  const rock = new THREE.Color(P.rock);
  const cliff = new THREE.Color(P.cliff);
  const palette = (h, slope, out) => {
    if (h < 0.8) out.copy(wet);
    else if (h < 3) out.copy(wet).lerp(sand, (h - 0.8) / 2.2);
    else if (h < 9) out.copy(sand).lerp(dry, (h - 3) / 6);
    else {
      const t = THREE.MathUtils.smoothstep(h, 14, 120);
      out.copy(dry).lerp(grass, Math.min(1, (h - 9) / 10)).lerp(forest, t * 0.85);
      if (h > 210) out.lerp(rock, Math.min(1, (h - 210) / 140));
    }
    if (slope > 0.5 && h > 2) out.lerp(cliff, Math.min(1, (slope - 0.5) * 2.4));
    return out;
  };
  const terrain = buildTerrain(field, { palette, sunDir, rng: rng.fork(), detailRepeat: Math.round(W.size / 22) });
  scene.add(terrain);

  const skyColours = { zenith: P.zenith, horizon: P.horizon, glow: P.glow, sun: P.sun };
  const water = createWater({ heightTex: heightTexture(field), size: W.size, sunDir, deep: P.deep, shallow: P.shallow, sand: P.sand, foam: P.foam, ...skyColours });
  scene.add(water.mesh);

  const sky = createSky({ sunDir, haze: P.hazeSun, cloud: P.cloud, cloudShadow: P.cloudShadow, cloudCover: 0.48, ...skyColours });
  scene.add(sky.mesh);

  const clouds = createClouds(rng.fork(), { count: q.clouds, area: W.size * 1.1, base: 520, top: 820, color: P.cumulus });
  scene.add(clouds.group);

  // Light: a low warm sun, cool sky fill from above, warm bounce from below.
  const sun = new THREE.DirectionalLight(P.sunLight, P.sunIntensity);
  sun.position.copy(sun3).multiplyScalar(500);
  scene.add(sun, sun.target);
  if (q.shadowSize > 0) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const s = sun.shadow.camera;
    s.left = -40;
    s.right = 40;
    s.top = 40;
    s.bottom = -40;
    s.near = 1;
    s.far = 1200;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
  }
  const hemi = new THREE.HemisphereLight(P.skyFill, P.groundFill, P.fill);
  scene.add(hemi);

  // Image-based light from a real sunset sky (CC0 HDRI), turned so its sun
  // sits where ours is: reflections on the paint and canopy, soft sky light.
  const env = await loadEnvironment(ctx.get('render').renderer, skyHdrUrl, sunDir);
  scene.environment = env.texture;
  scene.environmentRotation.set(0, env.rotationY, 0);
  scene.environmentIntensity = P.envIntensity;

  scene.fog = new THREE.FogExp2(new THREE.Color(P.hazeSun), P.fogDensity);
  const hazeSun = new THREE.Color(P.hazeSun);
  const hazeAway = new THREE.Color(P.hazeAway);
  const camDir = new THREE.Vector3();

  return {
    field,
    sun,
    sky,
    water,
    terrain,
    update(dt, time, camera, focus) {
      sky.update(camera, time);
      water.update(time);
      clouds.update(time);
      // Haze is warm toward the sun, cooler away from it; the sky's horizon follows.
      camera.getWorldDirection(camDir);
      const k = Math.max(0, (camDir.x * sun3.x + camDir.z * sun3.z) / (Math.hypot(camDir.x, camDir.z) * Math.hypot(sun3.x, sun3.z) || 1));
      scene.fog.color.copy(hazeAway).lerp(hazeSun, k * k);
      sky.uniforms.uHaze.value.copy(scene.fog.color);
      if (sun.castShadow && focus) {
        sun.target.position.copy(focus);
        sun.position.copy(focus).addScaledVector(sun3, 500);
        sun.target.updateMatrixWorld();
      }
    },
  };
}
