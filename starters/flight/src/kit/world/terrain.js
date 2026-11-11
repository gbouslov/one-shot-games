import * as THREE from 'three';
import { surface } from '../textures/textures.js';

/**
 * Terrain mesh from a heightfield grid (createIslands). Colour per vertex from
 * the game's palette function, then two bakes that make terrain read from the
 * air at a low sun:
 *  - sun shadow: march from every vertex toward the sun over the grid, with a
 *    soft penumbra, so ridges throw long evening shadows across the valleys
 *  - cavity: vertices lower than their neighbours darken a little
 * Shadowed ground goes toward a cool tint instead of black (sky fill).
 * A tiling detail texture (colour and normal) breaks up the vertex colour up close.
 *
 *   buildTerrain(field, { palette: (h, slope, out) => out.set(...), sunDir, rng, shadowTint })
 *
 * Written for this repository. The slope-and-height palette idea follows the
 * flight source's terrainColor(); see NOTICES.md.
 */
export function buildTerrain(field, { palette, sunDir, rng, shadowTint = [0.5, 0.52, 0.64], detailRepeat = 260, detail = true } = {}) {
  const { grid, n, size, cell } = field;
  const segs = n - 1;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sun = new THREE.Vector3(...sunDir).normalize();
  const tint = new THREE.Color().setRGB(...shadowTint); // linear multiplier, not a display colour
  const c = new THREE.Color();
  const lit = new THREE.Color();

  // PlaneGeometry rotated -90° about X: vertex (i, j) has x = -size/2 + i*cell,
  // z = -size/2 + j*cell, which matches the grid layout exactly.
  const H = (i, j) => grid[Math.min(segs, Math.max(0, j)) * n + Math.min(segs, Math.max(0, i))];

  const horiz = Math.hypot(sun.x, sun.z) || 1;
  const sx = sun.x / horiz;
  const sz = sun.z / horiz;
  const rise = sun.y / horiz; // metres up per metre across

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const h = grid[k];
      pos.setY(k, h);
      const dx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell);
      const dz = (H(i, j + 1) - H(i, j - 1)) / (2 * cell);
      const slope = Math.min(1, Math.hypot(dx, dz));
      palette(h, slope, c);

      // Sun shadow with a soft edge.
      let light = 1;
      if (h > -4) {
        const x0 = -size / 2 + i * cell;
        const z0 = -size / 2 + j * cell;
        let d = cell * 0.7;
        for (let s = 0; s < 46 && light > 0; s++) {
          const x = x0 + sx * d;
          const z = z0 + sz * d;
          const ray = h + 2 + d * rise;
          if (ray > 900) break;
          const g = field.at(x, z);
          const clear = (ray - g) / (d * 0.06 + 6);
          light = Math.min(light, Math.max(0, Math.min(1, clear + 0.5)));
          d += cell * (0.6 + s * 0.08);
        }
      }
      // Cavity.
      const avg = (H(i + 1, j) + H(i - 1, j) + H(i, j + 1) + H(i, j - 1)) / 4;
      const cav = THREE.MathUtils.clamp(1 + (h - avg) * 0.02, 0.8, 1.06);

      lit.copy(c).multiply(tint);
      c.lerp(lit, 1 - light);
      c.multiplyScalar(cav);
      colors[k * 3] = c.r;
      colors[k * 3 + 1] = c.g;
      colors[k * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const matOpts = { vertexColors: true, roughness: 0.93, metalness: 0 };
  if (detail && rng) {
    const tex = surface(rng, {
      size: 256, scale: 8, octaves: 5, colors: ['#e0dacf', '#f2eee6', '#ffffff'],
      crack: 0.15, speckle: 0.5, normal: 2.0, roughness: [0.85, 1], repeat: detailRepeat,
    });
    matOpts.map = tex.map;
    matOpts.normalMap = tex.normalMap;
    matOpts.normalScale = new THREE.Vector2(0.3, 0.3);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(matOpts));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/**
 * The heightfield as a single-channel texture for the water shader, encoded
 * as (h + range) / (2 * range), so sea level is 0.5.
 */
export function heightTexture(field, range = 40) {
  const { grid, n } = field;
  const data = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) data[k] = Math.round(THREE.MathUtils.clamp((grid[k] + range) / (2 * range), 0, 1) * 255);
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
