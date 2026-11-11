import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Building blocks for a level. Everything is geometry made in code.
 *   terrain()   heightfield with vertex colours, solid
 *   slab()      a solid box
 *   ramp()      a solid wedge you can walk up
 *   rockGeometry()  a displaced blob for rocks and boulders
 *   scatter()   instanced props placed on the ground, optionally solid
 *   skyDome()   gradient sky with a sun and an environment map for reflections
 *   sunLight()  directional light with a shadow frustum sized to the level
 *   motes()     drifting dust, embers, snow or spores around the player
 */

export function terrain(ctx, { size = 120, segments = 120, height, material, colorAt, surface = 'dirt' }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  if (colorAt) {
    const colors = new Float32Array(pos.count * 3);
    const n = geo.attributes.normal;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      colorAt(pos.getX(i), pos.getY(i), pos.getZ(i), n.getY(i), c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    material.vertexColors = true;
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  ctx.scene.add(mesh);
  ctx.get('physics').addStatic(mesh, surface);
  return mesh;
}

export function slab(ctx, { pos, size, material, rotY = 0, rotX = 0, rotZ = 0, surface = 'concrete', solid = true }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  if (solid) ctx.get('physics').addStatic(mesh, surface);
  return mesh;
}

/** A wedge rising along +Z from y=0 at z=-length/2 to y=height at z=+length/2. */
export function ramp(ctx, { pos, width, length, height, material, rotY = 0, surface = 'concrete' }) {
  const w = width / 2;
  const l = length / 2;
  const v = [
    -w, 0, -l, w, 0, -l, w, 0, l, -w, 0, l,
    -w, height, l, w, height, l,
  ];
  const idx = [
    0, 3, 2, 0, 2, 1, // bottom
    0, 1, 5, 0, 5, 4, // slope
    3, 4, 5, 3, 5, 2, // back
    0, 4, 3, // left
    1, 2, 5, // right
  ];
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  tri.setIndex(idx);
  const geo = tri.toNonIndexed();
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) * 0.25;
    uv[i * 2 + 1] = (p.getZ(i) + p.getY(i)) * 0.25;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  ctx.get('physics').addStatic(mesh, surface);
  return mesh;
}

export function rockGeometry(rng, { radius = 1, detail = 2, roughness = 0.28, squash = 0.75 } = {}) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, 1 + rng.signed() * roughness);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * squash, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Place `count` instances on the ground.
 * where(rng) returns [x, z] or null to skip; scale(rng) returns a number.
 */
export function scatter(ctx, { geometry, material, count, where, scale = () => 1, sink = 0.1, solid = false, surface = 'concrete', tilt = 0.15, castShadow = true }) {
  const physics = ctx.get('physics');
  const rng = ctx.rng.fork();
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const at = where(rng);
    if (!at) continue;
    const y = physics.groundHeight(at[0], at[1]);
    if (y === null) continue;
    const sc = scale(rng);
    e.set(rng.signed() * tilt, rng.range(0, Math.PI * 2), rng.signed() * tilt);
    q.setFromEuler(e);
    p.set(at[0], y - sink * sc, at[1]);
    s.setScalar(sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  if (solid) physics.addStatic(mesh, surface);
  return mesh;
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
varying vec3 vDir; uniform vec3 top, horizon, ground, sunColor, sunDir; uniform float sunSize, sunGlow, horizonPower;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(horizon, top, pow(h, horizonPower)) : mix(horizon, ground, pow(-h, 0.6));
  float a = max(dot(d, sunDir), 0.0);
  c += sunColor * (pow(a, sunGlow) * 0.55 + smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.4, a) * 12.0);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function skyDome(ctx, { top = '#1b2a4a', horizon = '#e8955a', ground = '#2a2118', sunColor = '#ffc68a', sunDir = [0.5, 0.2, -0.8], sunSize = 0.0012, sunGlow = 90, horizonPower = 0.55, environment = true, envIntensity = 0.7 }) {
  const dir = new THREE.Vector3(...sunDir).normalize();
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      ground: { value: new THREE.Color(ground) },
      sunColor: { value: new THREE.Color(sunColor) },
      sunDir: { value: dir },
      sunSize: { value: sunSize },
      sunGlow: { value: sunGlow },
      horizonPower: { value: horizonPower },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';

  if (environment) {
    const pmrem = new THREE.PMREMGenerator(ctx.get('render').renderer);
    const envScene = new THREE.Scene();
    envScene.add(mesh);
    const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
    ctx.scene.environment = rt.texture;
    ctx.scene.environmentIntensity = envIntensity;
    ctx.viewScene.environment = rt.texture;
    ctx.viewScene.environmentIntensity = envIntensity;
    envScene.remove(mesh);
    pmrem.dispose();
  }
  ctx.scene.add(mesh);
  return mesh;
}

export function sunLight(ctx, { dir = [0.5, 0.35, -0.8], color = '#ffd2a0', intensity = 3, range = 60, bias = -0.0004, normalBias = 0.03 }) {
  const light = new THREE.DirectionalLight(color, intensity);
  const d = new THREE.Vector3(...dir).normalize();
  light.position.copy(d).multiplyScalar(range * 1.6);
  light.target.position.set(0, 0, 0);
  const size = ctx.config.q.shadowSize;
  if (size > 0) {
    light.castShadow = true;
    light.shadow.mapSize.set(size, size);
    const c = light.shadow.camera;
    c.left = c.bottom = -range;
    c.right = c.top = range;
    c.near = 1;
    c.far = range * 3.6;
    light.shadow.bias = bias;
    light.shadow.normalBias = normalBias;
  }
  ctx.scene.add(light, light.target);
  return light;
}

export function motes(ctx, { count = 300, area = 30, height = 10, color = '#ffd9a8', size = 0.05, drift = [0.2, 0.05, 0.1], opacity = 0.7 } = {}) {
  const rng = ctx.rng.fork();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.range(-area, area);
    pos[i * 3 + 1] = rng.range(0, height);
    pos[i * 3 + 2] = rng.range(-area, area);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: glowTexture(32), alphaTest: 0.002, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  ctx.scene.add(pts);
  return {
    points: pts,
    update(dt) {
      const p = ctx.get('player').feet;
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        a[i * 3] += drift[0] * dt;
        a[i * 3 + 1] += drift[1] * dt;
        a[i * 3 + 2] += drift[2] * dt;
        if (a[i * 3] - p.x > area) a[i * 3] -= 2 * area;
        else if (a[i * 3] - p.x < -area) a[i * 3] += 2 * area;
        if (a[i * 3 + 2] - p.z > area) a[i * 3 + 2] -= 2 * area;
        else if (a[i * 3 + 2] - p.z < -area) a[i * 3 + 2] += 2 * area;
        if (a[i * 3 + 1] > height) a[i * 3 + 1] = 0;
        else if (a[i * 3 + 1] < 0) a[i * 3 + 1] = height;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
