import * as THREE from 'three';
import { fbm } from '../textures/textures.js';

/**
 * Fair-weather cumulus as clusters of soft billboards. The texture is shaded
 * light at the top and dark at the base; the material colour is the sun's,
 * so at a low sun the tops glow warm and the bases go lavender in the haze.
 *
 *   const clouds = createClouds(rng, { count, area, base, top, color, shade })
 *   scene.add(clouds.group); clouds.update(time)
 *
 * Written for this repository (the soft billboard approach follows the flight
 * source's cloud deck; see NOTICES.md).
 */
function cloudTexture(rng, size = 128) {
  const data = new Uint8Array(size * size * 4);
  const seed = rng.int(1, 1 << 16);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = u - 0.5;
      const dy = (v - 0.55) * 1.3;
      const r = Math.hypot(dx, dy) * 2;
      const n = fbm(u, v, 4, 5, seed);
      const a = Math.max(0, Math.min(1, (1 - r) * 1.6 + (n - 0.5) * 1.4 - 0.15));
      // canvas rows go down; v = 0 is the top of the image (DataTexture flipY false: v=0 is bottom)
      const lit = 0.55 + 0.45 * Math.min(1, v * 1.25 + (n - 0.5) * 0.4);
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(255 * Math.max(0, Math.min(1, lit)));
      data[k + 3] = Math.round(255 * a * a);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createClouds(rng, { count = 24, area = 6000, base = 520, top = 760, color = '#ffd2a6', size = [180, 360], keepOut = null } = {}) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const tex = cloudTexture(rng);
  const mats = [0.85, 1, 1.12].map(
    (b) => new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(b), transparent: true, depthWrite: false, fog: true }),
  );
  for (let i = 0; i < count; i++) {
    let cx;
    let cz;
    let tries = 0;
    do {
      cx = rng.range(-area / 2, area / 2);
      cz = rng.range(-area / 2, area / 2);
    } while (keepOut && keepOut(cx, cz) && ++tries < 12);
    const cy = rng.range(base, top);
    const puffs = rng.int(3, 6);
    const s = rng.range(size[0], size[1]);
    for (let j = 0; j < puffs; j++) {
      const sp = new THREE.Sprite(mats[rng.int(0, 2)]);
      const w = s * rng.range(0.6, 1.1);
      sp.scale.set(w * 1.5, w, 1);
      sp.position.set(cx + rng.range(-s, s) * 0.8, cy + rng.range(-0.15, 0.25) * s, cz + rng.range(-s, s) * 0.5);
      group.add(sp);
    }
  }
  return {
    group,
    update(time) {
      group.position.x = Math.sin(time * 0.01) * 20 + time * 0.8;
    },
  };
}
