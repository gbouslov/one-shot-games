import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, glowTexture } from '../textures/textures.js';

/**
 * Outdoor building blocks, all made in code:
 *   skyDome, sunLight, motes         sky with sun and environment light, the key light, drifting dust
 *   splatTerrain + layerTexture      heightfield blending up to four ground layers by height
 *   grassField                       instanced grass clumps that sway in the wind
 *   instanced                        any geometry scattered as one draw call
 *   rockGeometry, coniferGeometry, broadleafGeometry, shrubGeometry   vertex-coloured props
 * skyDome, sunLight, motes and rockGeometry follow starters/fps-three/src/kit/world/builders.js.
 */

// ------------------------------------------------------------------ sky --

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
varying vec3 vDir; uniform vec3 top, horizon, ground, sunColor, sunDir; uniform float sunSize, sunGlow, horizonPower;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(horizon, top, pow(h, horizonPower)) : mix(horizon, ground, pow(-h, 0.6));
  float a = max(dot(d, sunDir), 0.0);
  c += sunColor * (pow(a, sunGlow) * 0.55 + pow(a, 6.0) * 0.18 + smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.4, a) * 12.0);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function skyDome(ctx, { top = '#1b2a4a', horizon = '#e8955a', ground = '#2a2118', sunColor = '#ffc68a', sunDir = [0.5, 0.2, -0.8], sunSize = 0.0012, sunGlow = 90, horizonPower = 0.55, envIntensity = 0.7 }) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      ground: { value: new THREE.Color(ground) },
      sunColor: { value: new THREE.Color(sunColor) },
      sunDir: { value: new THREE.Vector3(...sunDir).normalize() },
      sunSize: { value: sunSize },
      sunGlow: { value: sunGlow },
      horizonPower: { value: horizonPower },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  const pmrem = new THREE.PMREMGenerator(ctx.get('render').renderer);
  const envScene = new THREE.Scene();
  envScene.add(mesh);
  const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  ctx.scene.environment = rt.texture;
  ctx.scene.environmentIntensity = envIntensity;
  envScene.remove(mesh);
  pmrem.dispose();
  ctx.scene.add(mesh);
  return mesh;
}

export function sunLight(ctx, { dir = [0.5, 0.35, -0.8], color = '#ffd2a0', intensity = 3, range = 30, target = [0, 0, 0], bias = -0.0005, normalBias = 0.04 }) {
  const light = new THREE.DirectionalLight(color, intensity);
  const d = new THREE.Vector3(...dir).normalize();
  light.position.copy(d).multiplyScalar(range * 2).add(new THREE.Vector3(...target));
  light.target.position.set(...target);
  const size = ctx.config.q.shadowSize;
  if (size > 0) {
    light.castShadow = true;
    light.shadow.mapSize.set(size, size);
    const c = light.shadow.camera;
    c.left = c.bottom = -range;
    c.right = c.top = range;
    c.near = 1;
    c.far = range * 4;
    light.shadow.bias = bias;
    light.shadow.normalBias = normalBias;
    light.shadow.radius = 3;
  }
  ctx.scene.add(light, light.target);
  return light;
}

/** Drifting dust, pollen, embers or snow inside a box around the centre. */
export function motes(ctx, { count = 300, area = [30, 20], height = 8, base = 0, color = '#ffd9a8', size = 0.08, drift = [0.2, 0.05, 0.1], opacity = 0.7 } = {}) {
  const rng = ctx.rng.fork();
  const [ax, az] = Array.isArray(area) ? area : [area, area];
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.range(-ax, ax);
    pos[i * 3 + 1] = base + rng.range(0, height);
    pos[i * 3 + 2] = rng.range(-az, az);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: glowTexture(32), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  ctx.scene.add(pts);
  return {
    points: pts,
    update(dt) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        a[i * 3] += drift[0] * dt + Math.sin(i * 1.7 + a[i * 3 + 1]) * 0.06 * dt;
        a[i * 3 + 1] += drift[1] * dt;
        a[i * 3 + 2] += drift[2] * dt;
        if (a[i * 3] > ax) a[i * 3] -= 2 * ax;
        else if (a[i * 3] < -ax) a[i * 3] += 2 * ax;
        if (a[i * 3 + 2] > az) a[i * 3 + 2] -= 2 * az;
        else if (a[i * 3 + 2] < -az) a[i * 3 + 2] += 2 * az;
        if (a[i * 3 + 1] > base + height) a[i * 3 + 1] = base;
        else if (a[i * 3 + 1] < base) a[i * 3 + 1] = base + height;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// -------------------------------------------------------------- terrain --

function srgbByte(v) {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

/**
 * A tileable ground texture with height in alpha, for splatTerrain.
 *   colors   palette from low to high
 *   scale    feature count across the tile;  octaves  detail
 *   pebbles  0..1 raised stones;  cracks 0..1 dark seams;  blades 0..1 fine vertical streaks (grass)
 *   flecks   [[colour, density], ...] small specks (flowers, leaves, sparkle)
 */
export function layerTexture(rng, { size = 256, colors, scale = 6, octaves = 5, pebbles = 0, cracks = 0, blades = 0, flecks = [] }) {
  const seed = rng.int(1, 1 << 20);
  const pal = colors.map((h) => new THREE.Color(h));
  const fl = flecks.map(([h, dens]) => [new THREE.Color(h), dens]);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let h = fbm(u, v, scale, octaves, seed);
      let shade = 1;
      if (blades > 0) {
        const b = fbm(u, v, scale * 8, 2, seed + 5);
        h += (b - 0.5) * blades * 0.6;
        shade *= 1 - blades * 0.25 * (1 - b);
      }
      if (pebbles > 0) {
        const p = fbm(u, v, scale * 3, 2, seed + 11);
        const stone = Math.max(0, (p - 0.56) * 3.5) * pebbles;
        h = h * (1 - Math.min(1, stone)) + Math.min(1, stone) * (0.75 + p * 0.25);
        shade *= 1 + Math.min(1, stone) * 0.18;
      }
      if (cracks > 0) {
        const r = Math.abs(fbm(u, v, scale * 2, 3, seed + 91) * 2 - 1);
        const c = Math.max(0, 0.08 - r) * 12 * cracks;
        h -= c * 0.4;
        shade *= 1 - c * 0.6;
      }
      const t = Math.max(0, Math.min(1, (h - 0.3) / 0.4)) * (pal.length - 1);
      const i = Math.min(pal.length - 2, Math.floor(t));
      const f = t - i;
      let r = pal[i].r + (pal[i + 1].r - pal[i].r) * f;
      let g = pal[i].g + (pal[i + 1].g - pal[i].g) * f;
      let b = pal[i].b + (pal[i + 1].b - pal[i].b) * f;
      for (const [col, dens] of fl) {
        // soft-edged specks a few texels wide, never single hard pixels
        const n = fbm(u, v, size >> 4, 2, seed + 37 + Math.round(dens * 1000));
        const k = Math.max(0, Math.min(1, (n - (1 - dens * 6)) / 0.05));
        r += (col.r - r) * k;
        g += (col.g - g) * k;
        b += (col.b - b) * k;
        h += 0.06 * k;
      }
      const k = (y * size + x) * 4;
      data[k] = srgbByte(r * shade);
      data[k + 1] = srgbByte(g * shade);
      data[k + 2] = srgbByte(b * shade);
      data[k + 3] = Math.max(0, Math.min(255, Math.round(h * 255)));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A heightfield that blends four ground layers per pixel, sharpened by each
 * layer's height so stones poke through grass instead of fading into it.
 *
 *   splatTerrain(ctx, { width, depth, segments: [sx, sz], height(x, z),
 *     weights(x, z, y, slope) -> [a, b, c, d], tint(x, z, y, slope, color),
 *     layers: [{ map, scale, roughness }] x4, bump })
 */
export function splatTerrain(ctx, { width, depth, segments = [160, 100], height, weights, tint, layers, bump = 1.2, position = [0, 0, 0] }) {
  const geo = new THREE.PlaneGeometry(width, depth, segments[0], segments[1]);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i) + position[0], pos.getZ(i) + position[2]));
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const splat = new Float32Array(pos.count * 4);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + position[0];
    const y = pos.getY(i);
    const z = pos.getZ(i) + position[2];
    const slope = 1 - n.getY(i);
    const w = weights(x, z, y, slope);
    const s = w[0] + w[1] + w[2] + w[3] || 1;
    for (let k = 0; k < 4; k++) splat[i * 4 + k] = w[k] / s;
    c.setRGB(1, 1, 1);
    tint?.(x, z, y, slope, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 });
  const uniforms = {
    tL0: { value: layers[0].map }, tL1: { value: layers[1].map }, tL2: { value: layers[2].map }, tL3: { value: layers[3].map },
    sL: { value: new THREE.Vector4(...layers.map((l) => 1 / (l.scale ?? 3))) },
    rL: { value: new THREE.Vector4(...layers.map((l) => l.roughness ?? 0.95)) },
    bump: { value: bump },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWorldPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D tL0, tL1, tL2, tL3; uniform vec4 sL, rL; uniform float bump;
        varying vec4 vSplat; varying vec3 vWorldPos;
        vec4 gW; float gH;
        vec3 splatBump(vec3 surf_pos, vec3 surf_norm, float h, float fd) {
          vec3 sx = dFdx(surf_pos); vec3 sy = dFdy(surf_pos);
          vec2 dh = vec2(dFdx(h), dFdy(h)) * bump;
          vec3 r1 = cross(sy, surf_norm); vec3 r2 = cross(surf_norm, sx);
          float det = dot(sx, r1) * fd;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          return normalize(abs(det) * surf_norm - grad);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 wuv = vWorldPos.xz;
        vec4 s0 = texture2D(tL0, wuv * sL.x); vec4 s1 = texture2D(tL1, wuv * sL.y);
        vec4 s2 = texture2D(tL2, wuv * sL.z); vec4 s3 = texture2D(tL3, wuv * sL.w);
        vec4 hs = vec4(s0.a, s1.a, s2.a, s3.a);
        vec4 w = vSplat * (hs + 0.9);
        w = pow(max(w, vec4(1e-4)), vec4(3.5));
        w /= dot(w, vec4(1.0));
        gW = w; gH = dot(hs, w);
        // a second, much larger sample breaks up the tiling into patches
        float macro = texture2D(tL1, wuv * sL.y * 0.083 + 0.37).a;
        diffuseColor.rgb *= (s0.rgb * w.x + s1.rgb * w.y + s2.rgb * w.z + s3.rgb * w.w) * mix(0.78, 1.18, macro);`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = dot(rL, gW);')
      .replace('#include <normal_fragment_maps>', 'normal = splatBump(-vViewPosition, normal, gH, faceDirection);');
  };
  mat.customProgramCacheKey = () => 'splat-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position[0], 0, position[2]);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  ctx.scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- grass --

/** One clump of curved blades, normals pointing up so it lights like the ground under it. */
function clumpGeometry(rng, { blades = 7, height = 0.45, width = 0.05, spread = 0.16, base = '#2d3d17', tip = '#a3b259' }) {
  const parts = [];
  const cb = new THREE.Color(base);
  const ct = new THREE.Color(tip);
  for (let b = 0; b < blades; b++) {
    const h = height * rng.range(0.55, 1.15);
    const a = rng.range(0, Math.PI * 2);
    const ox = Math.cos(a) * rng.range(0, spread);
    const oz = Math.sin(a) * rng.range(0, spread);
    const lean = rng.range(0.15, 0.5);
    const face = rng.range(0, Math.PI * 2);
    const segs = 3;
    const pos = [];
    const col = [];
    const nrm = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = width * (1 - t * 0.92);
      const bend = lean * t * t * h;
      const y = h * t;
      const cx = ox + Math.cos(face) * bend;
      const cz = oz + Math.sin(face) * bend;
      const px = -Math.sin(face) * w;
      const pz = Math.cos(face) * w;
      pos.push(cx - px, y, cz - pz, cx + px, y, cz + pz);
      const c = cb.clone().lerp(ct, t ** 0.8);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      nrm.push(0, 1, 0, 0, 1, 0);
    }
    const idx = [];
    for (let s = 0; s < segs; s++) {
      const k = s * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

/**
 * Instanced grass. where(rng) -> [x, z] | null;  heightAt(x, z);  tintAt(x, z, color) optional.
 * Sways with a shared wind uniform; returns { mesh, update(dt) }.
 */
export function grassField(ctx, { count, where, heightAt, tintAt, clump = {}, wind = 1 }) {
  const rng = ctx.rng.fork();
  const geo = clumpGeometry(rng, clump);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
  const uni = { uTime: { value: 0 }, uWind: { value: wind } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.21) * 0.6 + sin(uTime * 3.1 + ip.x * 1.3) * 0.25;
        float k = transformed.y * transformed.y * uWind;
        transformed.x += sway * k * 0.35;
        transformed.z += sway * k * 0.18;`,
      );
  };
  mat.customProgramCacheKey = () => 'grass-field';
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const at = where(rng);
    if (!at) continue;
    const sc = rng.range(0.7, 1.35);
    e.set(0, rng.range(0, Math.PI * 2), 0);
    q.setFromEuler(e);
    p.set(at[0], heightAt(at[0], at[1]) - 0.02, at[1]);
    s.set(sc, sc * rng.range(0.8, 1.25), sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);
    c.setRGB(1, 1, 1);
    tintAt?.(at[0], at[1], c);
    c.multiplyScalar(rng.range(0.85, 1.12));
    mesh.setColorAt(placed, c);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  return { mesh, update: (dt) => { if (!ctx.config.deterministic) uni.uTime.value += dt; else uni.uTime.value = 1.3; } };
}

// ---------------------------------------------------------------- props --

/** Scatter one geometry as a single instanced mesh. place(rng, i) -> { x, y, z, s, ry, rx?, rz?, color? } | null */
export function instanced(ctx, { geometry, material, count, place, castShadow = true, receiveShadow = true }) {
  const rng = ctx.rng.fork();
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i++) {
    const o = place(rng, n);
    if (!o) continue;
    e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    q.setFromEuler(e);
    p.set(o.x, o.y, o.z);
    if (Array.isArray(o.s)) s.set(...o.s);
    else s.setScalar(o.s ?? 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    if (o.color) mesh.setColorAt(n, c.set(o.color));
    else if (mesh.instanceColor) mesh.setColorAt(n, c.setRGB(1, 1, 1));
    n++;
  }
  mesh.count = n;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  return mesh;
}

function paint(geo, fn) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function jitter(geo, rng, amount) {
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [rng.signed() * amount, rng.signed() * amount * 0.5, rng.signed() * amount]);
    const j = seen.get(key);
    pos.setXYZ(i, pos.getX(i) + j[0], pos.getY(i) + j[1], pos.getZ(i) + j[2]);
  }
  return geo;
}

export function rockGeometry(rng, { radius = 1, detail = 2, roughness = 0.28, squash = 0.7, colors = ['#5d5850', '#8a847a'], moss = '#4f5f2c' } = {}) {
  let geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, 1 + rng.signed() * roughness);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * squash, pos.getZ(i) * k);
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  const a = new THREE.Color(colors[0]);
  const b = new THREE.Color(colors[1]);
  const mc = new THREE.Color(moss);
  const n = geo.attributes.normal;
  let i = 0;
  paint(geo, (x, y, z, c) => {
    const up = n.getY(i++);
    c.copy(a).lerp(b, Math.max(0, Math.min(1, 0.5 + y / radius * 0.6)));
    if (up > 0.55) c.lerp(mc, Math.min(1, (up - 0.55) * 2.4));
  });
  return geo;
}

export function coniferGeometry(rng, { height = 5, radius = 1.5, tiers = 4, trunk = '#4a3424', dark = '#1d2f1f', light = '#4f6b38' } = {}) {
  const parts = [];
  const tr = new THREE.CylinderGeometry(0.1 * radius, 0.16 * radius, height * 0.35, 6);
  tr.translate(0, height * 0.175, 0);
  const tc = new THREE.Color(trunk);
  tr.computeVertexNormals();
  parts.push(paint(tr, (x, y, z, c) => c.copy(tc)));
  const d = new THREE.Color(dark);
  const l = new THREE.Color(light);
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const r = radius * (1 - k * 0.72);
    const h = height * 0.42 * (1 - k * 0.3);
    const y0 = height * (0.22 + k * 0.55);
    const cone = new THREE.ConeGeometry(r, h, 9, 2, true);
    jitter(cone, rng, r * 0.12);
    cone.translate(0, y0 + h / 2, 0);
    soften(cone, 0, y0, 0, 0.6);
    parts.push(paint(cone, (x, y, z, c) => {
      const f = (y - y0) / h;
      c.copy(d).lerp(l, Math.max(0, Math.min(1, f * 0.8 + 0.15 + (x + z) * 0.06)));
    }));
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

export function broadleafGeometry(rng, { height = 4, radius = 1.8, lumps = 6, trunk = '#4d3826', dark = '#2c3f1b', light = '#7f8f3c' } = {}) {
  const parts = [];
  const tr = new THREE.CylinderGeometry(0.12, 0.22, height * 0.6, 6);
  tr.translate(0, height * 0.3, 0);
  tr.computeVertexNormals();
  const tc = new THREE.Color(trunk);
  parts.push(paint(tr.toNonIndexed(), (x, y, z, c) => c.copy(tc)));
  const d = new THREE.Color(dark);
  const l = new THREE.Color(light);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const rr = radius * rng.range(0.45, 0.7);
    const blob = new THREE.IcosahedronGeometry(rr, 1);
    jitter(blob, rng, rr * 0.18);
    const cx = Math.cos(a) * radius * 0.45;
    const cz = Math.sin(a) * radius * 0.45;
    const cy = height * rng.range(0.62, 0.9);
    blob.translate(cx, cy, cz);
    soften(blob, cx * 0.5, cy - rr * 0.3, cz * 0.5, 0.25);
    parts.push(paint(blob.toNonIndexed(), (x, y, z, c) => c.copy(d).lerp(l, Math.max(0, Math.min(1, (y - cy + rr) / (2 * rr) * 0.9 + 0.05)))));
  }
  const top = new THREE.IcosahedronGeometry(radius * 0.7, 1);
  jitter(top, rng, radius * 0.1);
  top.translate(0, height * 0.98, 0);
  soften(top, 0, height * 0.8, 0, 0.25);
  parts.push(paint(top.toNonIndexed(), (x, y, z, c) => c.copy(d).lerp(l, Math.max(0, Math.min(1, (y - height * 0.6) / (radius * 1.2))))));
  return mergeGeometries(parts);
}

export function shrubGeometry(rng, { radius = 0.7, dark = '#27391a', light = '#6d8236', flowers = null } = {}) {
  const parts = [];
  const d = new THREE.Color(dark);
  const l = new THREE.Color(light);
  for (let i = 0; i < 4; i++) {
    const r = radius * rng.range(0.5, 0.8);
    const b = new THREE.IcosahedronGeometry(r, 1);
    jitter(b, rng, r * 0.2);
    b.scale(1, 0.75, 1);
    const bx = rng.signed() * radius * 0.5;
    const bz = rng.signed() * radius * 0.5;
    b.translate(bx, r * 0.5, bz);
    soften(b, bx, 0, bz, 0.3);
    parts.push(paint(b.toNonIndexed(), (x, y, z, c) => {
      c.copy(d).lerp(l, Math.max(0, Math.min(1, y / (radius * 1.1))));
      if (flowers && rng.float() < 0.08) c.set(flowers);
    }));
  }
  return mergeGeometries(parts);
}

/** Foliage normals point away from the clump's heart, so leaves shade as soft masses instead of facets. */
function soften(geo, cx, cy, cz, up = 0.3) {
  const p = geo.attributes.position;
  const n = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    v.y += up;
    v.normalize();
    n[i * 3] = v.x;
    n[i * 3 + 1] = v.y;
    n[i * 3 + 2] = v.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}

export { paint, jitter, mergeGeometries };
