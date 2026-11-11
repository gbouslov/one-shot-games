import * as THREE from 'three';

/**
 * Procedural surface textures: tileable fractal noise to colour and normal
 * maps, generated on the CPU at load. No image files, nothing to fetch.
 *
 *   const { map, normalMap, roughnessMap } = surface(rng, {
 *     size: 256, scale: 6, octaves: 5, colors: ['#3b3128', '#6d5b48'],
 *     crack: 0.4, speckle: 0.2, normal: 2.2, roughness: [0.8, 1], repeat: 8,
 *   });
 */

function latticeHash(ix, iy, period, seed) {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let n = x * 374761393 + y * 668265263 + seed * 2147483647;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function periodicNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = latticeHash(ix, iy, period, seed);
  const b = latticeHash(ix + 1, iy, period, seed);
  const c = latticeHash(ix, iy + 1, period, seed);
  const d = latticeHash(ix + 1, iy + 1, period, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(u, v, period, octaves, seed, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let p = period;
  for (let i = 0; i < octaves; i++) {
    sum += periodicNoise(u, v, p, seed + i * 17) * amp;
    norm += amp;
    amp *= gain;
    p *= 2;
  }
  return sum / norm;
}

function hexToLinear(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

function toSrgbByte(v) {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

function makeTexture(data, size, srgb, repeat) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function surface(rng, opts = {}) {
  const {
    size = 256,
    scale = 6,
    octaves = 5,
    colors = ['#3b3128', '#6d5b48'],
    crack = 0,
    speckle = 0.1,
    streak = 0,
    normal = 2,
    roughness = [0.75, 1],
    repeat = 4,
  } = opts;

  const seed = rng.int(1, 1 << 20);
  const pal = colors.map(hexToLinear);
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const norm = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let h = fbm(u, v, scale, octaves, seed);
      if (crack > 0) {
        const r = Math.abs(fbm(u, v, scale * 2, 3, seed + 91) * 2 - 1);
        h -= crack * Math.max(0, 0.11 - r) * 5;
      }
      if (streak > 0) h += streak * (fbm(u, v * 0.2, scale * 3, 2, seed + 33) - 0.5);
      const fine = periodicNoise(u, v, size >> 1, seed + 7);
      h += (fine - 0.5) * speckle * 0.3;
      height[y * size + x] = h;

      const t = Math.max(0, Math.min(1, (h - 0.32) / 0.36)) * (pal.length - 1);
      const i = Math.min(pal.length - 2, Math.floor(t));
      const f = t - i;
      const k = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) color[k + c] = toSrgbByte(pal[i][c] + (pal[i + 1][c] - pal[i][c]) * f);
      color[k + 3] = 255;

      const rv = roughness[0] + (roughness[1] - roughness[0]) * (1 - Math.min(1, h * 1.4));
      rough[k] = 0;
      rough[k + 1] = Math.round(rv * 255); // three reads roughness from G
      rough[k + 2] = 0;
      rough[k + 3] = 255;
    }
  }

  // Sobel over the wrapped height field.
  const at = (x, y) => height[(((y + size) % size) * size) + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const nx = -dx * normal;
      const ny = -dy * normal;
      const len = Math.hypot(nx, ny, 1);
      const k = (y * size + x) * 4;
      norm[k] = Math.round((nx / len) * 127 + 128);
      norm[k + 1] = Math.round((ny / len) * 127 + 128);
      norm[k + 2] = Math.round((1 / len) * 127 + 128);
      norm[k + 3] = 255;
    }
  }

  return {
    map: makeTexture(color, size, true, repeat),
    normalMap: makeTexture(norm, size, false, repeat),
    roughnessMap: makeTexture(rough, size, false, repeat),
  };
}

/** A material from surface() settings; pass three material options in `material`. */
export function surfaceMaterial(rng, opts = {}) {
  const tex = surface(rng, opts);
  return new THREE.MeshStandardMaterial({ ...tex, metalness: 0, ...(opts.material ?? {}) });
}

/** A soft round sprite for particles and glows. */
export function glowTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = (1 - d) ** 2;
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
