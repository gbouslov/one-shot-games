import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../kit/core/rng.js';
import { fbm } from '../kit/textures/textures.js';

/**
 * The trench: a long canyon of steel blocks down -Z, built once at load and
 * merged per 240 m chunk (one draw call per material per chunk, culled by
 * the camera). Wall blocks of varied depth and height either side of the
 * flight box, ribs and ledges on the faces, cold light seams and warm
 * runoff strips that bloom, gantries across the top, a skyline of towers
 * behind the walls, light columns beyond them, a baked nebula sky with a
 * bright glow at the far end, exponential haze, and a light rig that travels
 * with the ship (a cold fill ahead, furnace light from below) plus a pool of
 * flash lights for explosions.
 *
 * The construction (blocks either side of a corridor at a half width with
 * jitter, HDR strips on the inner faces that bloom, beams across, light
 * columns and haze beyond, two point lights riding with the ship) follows
 * the trench levels in bop-del/meridian-line src/world/levels (MIT, commit
 * bf4dc45). The code, the panel textures, the sky and the layout are new.
 */
const CHUNK = 240;

/** Box with world-space UVs (so one texture tiles evenly over any size). */
function box(list, x, y, z, w, h, d, tile = 24) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    if (nx > 0.5) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else if (ny > 0.5) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  }
  list.push(g);
}

/** Steel panels: colour map and an emissive map of window dashes and faint grid lines. */
function panelTextures(rng, palette, size = 512) {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')];
  };
  const [cc, g] = mk();
  const [ce, e] = mk();
  const base = new THREE.Color(palette.steel);
  const dark = new THREE.Color(palette.steelDark);
  g.fillStyle = `#${dark.getHexString()}`;
  g.fillRect(0, 0, size, size);
  e.fillStyle = '#000';
  e.fillRect(0, 0, size, size);
  // Panels on a 16 px grid, merged into rectangles of random size.
  const cell = size / 16;
  const used = new Uint8Array(256);
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      if (used[j * 16 + i]) continue;
      let w = 1 + Math.floor(rng.float() * 4);
      let h = 1 + Math.floor(rng.float() * 3);
      w = Math.min(w, 16 - i);
      h = Math.min(h, 16 - j);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) used[(j + y) * 16 + i + x] = 1;
      const c = base.clone().lerp(dark, rng.float() * 0.55).offsetHSL(0, 0, (rng.float() - 0.5) * 0.04);
      g.fillStyle = `#${c.getHexString()}`;
      g.fillRect(i * cell + 1.5, j * cell + 1.5, w * cell - 3, h * cell - 3);
      // a bevel: light top edge, dark bottom edge
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(i * cell + 1.5, j * cell + 1.5, w * cell - 3, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(i * cell + 1.5, (j + h) * cell - 3.5, w * cell - 3, 2);
      // grime streaks
      if (rng.float() < 0.3) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(i * cell + rng.float() * w * cell, j * cell, 2 + rng.float() * 3, h * cell);
      }
      // lit details on some panels
      const r = rng.float();
      if (r < 0.16) {
        e.fillStyle = rng.float() < 0.6 ? palette.window : '#cfe6ff';
        const yy = j * cell + cell * (0.3 + rng.float() * 0.4);
        e.fillRect(i * cell + 5, yy, w * cell * (0.3 + rng.float() * 0.5), 2.5);
      } else if (r < 0.22) {
        e.fillStyle = palette.ember;
        e.fillRect(i * cell + 4, j * cell + 4, 3, 3);
      }
    }
  }
  // Faint cold grid lines on the major seams (the structure reads at distance).
  e.strokeStyle = 'rgba(110,160,255,0.38)';
  e.lineWidth = 1.5;
  for (let k = 0; k <= size; k += size / 4) {
    e.beginPath(); e.moveTo(k, 0); e.lineTo(k, size); e.stroke();
    e.beginPath(); e.moveTo(0, k); e.lineTo(size, k); e.stroke();
  }
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: tex(cc, true), emissiveMap: tex(ce, true) };
}

/** Nebula and stars baked into a small equirectangular texture, with the far glow. */
function skyTexture(palette, seed) {
  const W = 512;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  // Written as sRGB bytes; the texture is decoded to linear when sampled.
  const a = new THREE.Color(palette.nebulaA).convertLinearToSRGB();
  const b = new THREE.Color(palette.nebulaB).convertLinearToSRGB();
  const sp = new THREE.Color(palette.space).convertLinearToSRGB();
  const rng = new Rng(seed);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const n = fbm(u, v * 0.5, 4, 4, seed);
      const m = fbm(u + 0.3, v * 0.5 + 0.2, 8, 3, seed + 11);
      const band = Math.exp(-(((v - 0.42) * 3.2) ** 2));
      const neb = Math.max(0, n - 0.42) * 2.2 * band;
      const r = sp.r + a.r * neb + b.r * neb * m * 1.6;
      const gg = sp.g + a.g * neb + b.g * neb * m * 1.6;
      const bb = sp.b + a.b * neb + b.b * neb * m * 1.6;
      const k = (y * W + x) * 4;
      data[k] = Math.min(255, r * 255);
      data[k + 1] = Math.min(255, gg * 255);
      data[k + 2] = Math.min(255, bb * 255);
      data[k + 3] = 255;
    }
  }
  // (Stars are drawn in the shader: a texel here would be a blurred square on screen.)
  rng.float();
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function skyDome(palette, config) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tSky: { value: skyTexture(palette, config.worldSeed * 977 + 5) },
      glowDir: { value: new THREE.Vector3(...config.sunDir).normalize() },
      glow: { value: new THREE.Color(palette.farGlow) },
      fog: { value: new THREE.Color(palette.fog) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tSky; uniform vec3 glowDir, glow, fog; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec2 uv = vec2(atan(d.x, -d.z) / 6.2831853 + 0.5, acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
        vec3 c = texture2D(tSky, uv).rgb;
        c *= 1.5;
        // Pin-sharp stars from a hashed direction grid.
        vec3 q = d * 420.0;
        vec3 id = floor(q);
        float h = fract(sin(dot(id, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float s = step(0.9975, h) * smoothstep(0.55, 0.1, length(fract(q) - 0.5));
        c += vec3(0.85, 0.9, 1.0) * s * (0.6 + 2.0 * fract(h * 911.0));
        float g = max(dot(d, glowDir), 0.0);
        c += glow * (pow(g, 600.0) * 3.0 + pow(g, 80.0) * 0.35 + pow(g, 12.0) * 0.05);
        // haze near the horizon so the walls fade into it
        c = mix(c, fog * 1.2, smoothstep(0.3, 0.0, abs(d.y)) * 0.5);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

/** Open column of light, fading toward the top, additive. */
function columnGeometry(color) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 10, 4, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const k = Math.pow(1 - p.getY(i), 1.6);
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildTrench(ctx, config, rules, palette) {
  const T = config.trench;
  const hw = T.halfWidth;
  const FLOOR = T.floor;
  const SL = T.segment;
  const q = ctx.config.q;
  const rng = new Rng(config.worldSeed * 7919 + 1);
  const scene = ctx.scene;
  const group = new THREE.Group();
  scene.add(group);

  scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity);
  scene.background = new THREE.Color(palette.space);
  const sky = skyDome(palette, config);
  scene.add(sky);

  // ---- materials
  const tex = panelTextures(rng, palette);
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissiveMap, emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.35 });
  const floorTex = panelTextures(new Rng(config.worldSeed + 99), { ...palette, steel: palette.floor, window: palette.ember });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex.map, emissiveMap: floorTex.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.48, metalness: 0.45 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#3a4458', roughness: 0.45, metalness: 0.6 });
  const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.seam).multiplyScalar(palette.seamGlow), toneMapped: false });
  const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.ember).multiplyScalar(palette.emberGlow), toneMapped: false });
  const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = columnGeometry(palette.beam);

  // ---- geometry, chunk by chunk
  const end = rules.boss.at + rules.boss.ahead + 80;
  const chunks = [];
  for (let z0 = 120; z0 > -end; z0 -= CHUNK) {
    const L = { wall: [], floor: [], trim: [], seam: [], ember: [] };
    const beams = [];
    for (let z = z0; z > z0 - CHUNK + 1; z -= SL) {
      const zc = z - SL / 2;
      for (const side of [-1, 1]) {
        // Main wall block: inner face at hw (+ a little outward jitter), varied height and depth.
        const depth = 16 + rng.float() * 18;
        const face = hw + rng.float() * 1.5;
        const top = 26 + rng.float() * 46;
        box(L.wall, side * (face + depth / 2), (FLOOR + top) / 2, zc, depth, top - FLOOR, SL - 0.6);
        // A setback tower behind, sometimes much taller: the skyline.
        if (rng.float() < 0.7) {
          const d2 = 14 + rng.float() * 22;
          const t2 = top + 12 + rng.float() * (rng.float() < 0.3 ? 110 : 40);
          const zz = zc + (rng.float() - 0.5) * 20;
          box(L.wall, side * (face + depth + d2 / 2 + rng.float() * 6), (FLOOR + t2) / 2, zz, d2, t2 - FLOOR, SL * (0.5 + rng.float() * 0.4));
        }
        // Low ledge along the foot of the wall.
        if (rng.float() < 0.6) {
          const lh = 3 + rng.float() * 7;
          box(L.trim, side * (face - 1.4), FLOOR + lh / 2, zc + (rng.float() - 0.5) * 10, 2.8, lh, SL * (0.4 + rng.float() * 0.5));
        }
        // Ribs at the bay joints, full height.
        box(L.trim, side * (face - 0.6), (FLOOR + top) / 2, z - 0.3, 1.2, top - FLOOR, 1.6);
        if (rng.float() < 0.35) {
          const vh = 8 + rng.float() * 20;
          box(L.seam, side * (face - 1.25), FLOOR + 6 + rng.float() * 10 + vh / 2, z - 0.3, 0.1, vh, 0.25);
        }
        // Cold seams on the face; warm runoff low down.
        const sx = side * (face - 0.06);
        box(L.seam, sx, -2 + rng.float() * 26, zc, 0.14, 0.3, SL * (0.5 + rng.float() * 0.35));
        if (rng.float() < 0.55) box(L.seam, sx, 14 + rng.float() * 16, zc + (rng.float() - 0.5) * 12, 0.14, 0.24, SL * (0.3 + rng.float() * 0.4));
        if (rng.float() < 0.6) box(L.ember, sx, FLOOR + 1.5 + rng.float() * 3, zc, 0.16, 0.35, SL * (0.4 + rng.float() * 0.5));
        // Wall-top lip catches the key light.
        box(L.trim, side * (face + depth / 2), top + 0.6, zc, depth + 1, 1.2, SL - 0.6);
        // Light columns beyond the walls.
        if (rng.float() < 0.28) beams.push([side * (hw + 40 + rng.float() * 90), zc + (rng.float() - 0.5) * 30, 1.4 + rng.float() * 2]);
      }
      // Floor plate and guide dashes.
      box(L.floor, 0, FLOOR - 1, zc, hw * 2 + 6, 2, SL);
      for (const x of [-7, 7]) for (let k = 0; k < 3; k++) box(L.ember, x, FLOOR + 0.05, zc - SL / 2 + 10 + k * 20, 0.3, 0.12, 6);
      box(L.seam, 0, FLOOR + 0.05, zc, 0.3, 0.1, SL * 0.9);
    }
    // A gantry across the top in most chunks.
    if (rng.float() < 0.75) {
      const gz = z0 - 30 - rng.float() * (CHUNK - 60);
      const gy = 22 + rng.float() * 18;
      box(L.trim, 0, gy, gz, hw * 2 + 30, 2.6, 3.2);
      box(L.trim, 0, gy - 2.2, gz, hw * 2 + 30, 0.6, 1.4);
      box(L.seam, 0, gy - 1.35, gz + 1.65, hw * 2 + 20, 0.22, 0.1);
    }
    const cg = new THREE.Group();
    const add = (list, mat) => {
      if (!list.length) return;
      const g = mergeGeometries(list, false);
      for (const x of list) x.dispose();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      cg.add(m);
    };
    add(L.wall, wallMat);
    add(L.floor, floorMat);
    add(L.trim, trimMat);
    add(L.seam, seamMat);
    add(L.ember, emberMat);
    for (const [x, z, r] of beams) {
      const m = new THREE.Mesh(beamGeo, beamMat);
      m.position.set(x, FLOOR - 10, z);
      m.scale.set(r, 360, r);
      m.renderOrder = 2;
      m.updateMatrix();
      m.matrixAutoUpdate = false;
      cg.add(m);
    }
    group.add(cg);
    chunks.push(cg);
  }

  // ---- lights
  const hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemi);
  const key = new THREE.DirectionalLight(palette.key, palette.keyIntensity);
  key.position.set(-0.3, 0.85, 0.4).multiplyScalar(100);
  const rim = new THREE.DirectionalLight(palette.rim, palette.rimIntensity);
  rim.position.set(0.85, 0.15, -0.5).multiplyScalar(100);
  scene.add(hemi, key, key.target, rim, rim.target);
  const cold = new THREE.PointLight(palette.coldFill, 520, 150, 1.6);
  const furnace = new THREE.PointLight(palette.furnace, 300, 110, 1.6);
  scene.add(cold, furnace);
  const flashes = Array.from({ length: Math.max(1, Math.min(3, q.lights - 1)) }, () => {
    const l = new THREE.PointLight('#ff8a3a', 0, 70, 1.4);
    l.userData.t = 0;
    scene.add(l);
    return l;
  });
  let nextFlash = 0;

  return {
    group,
    flash(pos, color, power = 1) {
      const l = flashes[nextFlash++ % flashes.length];
      l.position.copy(pos);
      l.color.set(color);
      l.userData.power = 1500 * power;
      l.userData.t = 0;
      l.intensity = l.userData.power;
    },
    update(dt, time, camera, ship) {
      sky.position.copy(camera.position);
      const a = ship.anchor;
      key.target.position.copy(a);
      key.position.copy(a).add(new THREE.Vector3(-30, 85, 40));
      rim.target.position.copy(a);
      rim.position.copy(a).add(new THREE.Vector3(85, 15, -50));
      cold.position.set(a.x, a.y + 6, a.z - 34);
      furnace.position.set(a.x, FLOOR + 4, a.z - 22);
      // Breathing furnace and a slow surge in the seams.
      const surge = 0.5 + 0.5 * Math.sin(time * 0.9);
      furnace.intensity = 300 * (0.85 + 0.15 * Math.sin(time * 1.7) + 0.06 * Math.sin(time * 4.3));
      seamMat.color.set(palette.seam).multiplyScalar(palette.seamGlow * (0.92 + 0.08 * surge));
      beamMat.opacity = 0.45 + 0.1 * Math.sin(time * 2.1);
      for (const l of flashes) {
        if (l.intensity <= 0) continue;
        l.userData.t += dt;
        l.intensity = Math.max(0, l.userData.power * Math.exp(-l.userData.t * 5));
        if (l.intensity < 5) l.intensity = 0;
      }
    },
  };
}
