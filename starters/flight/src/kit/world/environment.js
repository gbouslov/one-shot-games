import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { assetBytes } from './scatter.js';

/**
 * Image-based light from an equirectangular HDR sky (an imported `?url`).
 * Finds the sun in the image (its brightest pixel) and returns the Y rotation
 * that puts it where the game's own sun is, so reflections and sky light come
 * from the same side as the direct light and the painted sky.
 *
 *   const env = await loadEnvironment(renderer, url, sunDir)
 *   scene.environment = env.texture; scene.environmentRotation.y = env.rotationY
 *
 * Written for this repository.
 */
export async function loadEnvironment(renderer, url, sunDir) {
  const loader = new HDRLoader().setDataType(THREE.FloatType);
  const parsed = loader.parse(await assetBytes(url));
  const hdr = new THREE.DataTexture(parsed.data, parsed.width, parsed.height, THREE.RGBAFormat, parsed.type);
  hdr.colorSpace = THREE.LinearSRGBColorSpace;
  hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
  hdr.generateMipmaps = false;
  hdr.flipY = true;
  hdr.needsUpdate = true;
  const { data, width, height } = parsed;
  let best = -1;
  let bi = 0;
  for (let i = 0; i < width * height; i++) {
    const l = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722;
    if (l > best) {
      best = l;
      bi = i;
    }
  }
  const col = bi % width;
  const u = (col + 0.5) / width;
  // three's equirect lookup: u = atan(dir.z, dir.x) / 2π + 0.5
  const phiHdr = (u - 0.5) * Math.PI * 2;
  const phiSun = Math.atan2(sunDir[2], sunDir[0]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose();
  hdr.dispose();
  return { texture, rotationY: phiHdr - phiSun, peak: best };
}
