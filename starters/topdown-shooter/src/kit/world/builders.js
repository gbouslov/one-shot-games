import * as THREE from 'three';
import { glowTexture } from '../textures/textures.js';

/**
 * Building blocks for a ground-plane level. Everything is geometry made in code.
 *   ground()     the floor, any material, receiving shadows
 *   skyDome()    gradient sky with a moon or sun and an environment map
 *   keyLight()   a directional light with a shadow frustum sized to the level
 *   lamp()       a pole light: a pool of light, a hazy beam, a hot bulb, flicker
 *   puddles()    flat glossy patches that catch every light in the scene
 *   rain()       streaks falling around the camera's focus
 *   motes()      drifting dust, spores, embers or snow around the player
 * skyDome, keyLight and motes follow src/kit/world/builders.js in starters/fps-three.
 */

export function ground(ctx, { size = 120, material, y = 0 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  ctx.scene.add(mesh);
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

export function skyDome(ctx, { top = '#0b1020', horizon = '#26324a', ground = '#07080b', sunColor = '#b9c8ff', sunDir = [0.4, 0.5, -0.7], sunSize = 0.0009, sunGlow = 60, horizonPower = 0.5, environment = true, envIntensity = 0.5 }) {
  const dir = new THREE.Vector3(...sunDir).normalize();
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
    envScene.remove(mesh);
    pmrem.dispose();
  }
  ctx.scene.add(mesh);
  return mesh;
}

export function keyLight(ctx, { dir = [0.4, 0.8, -0.5], color = '#a9b9ff', intensity = 0.8, range = 34, bias = -0.0005, normalBias = 0.04 }) {
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

/**
 * A pole lamp: pole, arm, head with a hot lens, a spot light pooling on the
 * ground, a faint beam in the air, and an optional flicker.
 */
export function lamp(ctx, { x, z, height = 5.2, color = '#ffb46b', intensity = 60, distance = 16, angle = 0.95, rotY = 0, arm = 1.1, flicker = 0, poleMaterial, beam = 0.018, rng = ctx.rng.fork() }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const poleMat = poleMaterial ?? new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, height, 8), poleMat);
  pole.position.y = height / 2;
  pole.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 10), poleMat);
  base.position.y = 0.15;
  const armM = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, arm), poleMat);
  armM.position.set(0, height - 0.05, arm / 2);
  armM.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.56), poleMat);
  head.position.set(0, height - 0.08, arm);
  head.castShadow = true;
  const c = new THREE.Color(color);
  const lensMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(6), fog: false });
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.48).rotateX(Math.PI / 2), lensMat);
  lens.position.set(0, height - 0.15, arm);
  g.add(pole, base, armM, head, lens);

  // Real light where the quality tier allows it; otherwise a painted pool of light
  // on the ground, which costs one quad instead of a per-pixel light everywhere.
  let spot = null;
  if (ctx.config.q.lamps !== false) {
    spot = new THREE.SpotLight(c, intensity, distance, angle, 0.65, 1.6);
    spot.position.set(0, height - 0.2, arm);
    spot.target.position.set(0, 0, arm + 0.3);
    g.add(spot, spot.target);
  } else {
    const r = Math.tan(angle * 0.75) * height * 1.6;
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(64), color: c.clone().multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3 }),
    );
    pool.position.set(0, 0.02, arm + 0.3);
    g.add(pool);
  }

  // beam: a soft cone of lit air under the lamp
  let beamMesh = null;
  if (beam > 0) {
    const r = Math.tan(angle * 0.62) * (height - 0.2);
    const geo = new THREE.ConeGeometry(r, height - 0.2, 24, 1, true);
    geo.translate(0, -(height - 0.2) / 2, 0);
    // Lit air: brightest near the lamp, fading to nothing at the ground and at
    // the cone's silhouette, so it reads as volume and never as a solid cone.
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: c.clone().multiplyScalar(beam * 10) }, opacity: { value: 1 }, len: { value: height - 0.2 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform float len;
        void main(){ vY = -position.y / len; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float h = pow(1.0 - clamp(vY,0.0,1.0), 1.4) * 0.85 + 0.15 * (1.0 - clamp(vY,0.0,1.0));
        gl_FragColor = vec4(color * f * h * opacity, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    mat.opacity = 1;
    beamMesh = new THREE.Mesh(geo, mat);
    beamMesh.position.set(0, height - 0.2, arm);
    beamMesh.renderOrder = 5;
    g.add(beamMesh);
  }
  // halo around the lens
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: c.clone().multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.setScalar(1.9);
  halo.position.set(0, height - 0.24, arm);
  g.add(halo);
  ctx.scene.add(g);

  let t = rng.range(0, 10);
  let dropout = 0;
  return {
    group: g,
    light: spot,
    update(dt) {
      if (!flicker) return;
      t += dt;
      if (dropout > 0) dropout -= dt;
      else if (rng.float() < flicker * dt) dropout = rng.range(0.04, 0.22);
      const k = dropout > 0 ? 0.12 : 0.92 + Math.sin(t * 31) * 0.04 + Math.sin(t * 7.3) * 0.04;
      if (spot) spot.intensity = intensity * k;
      lensMat.color.copy(c).multiplyScalar(6 * k);
      halo.material.opacity = k;
      if (beamMesh) beamMesh.material.uniforms.opacity.value = k;
    },
  };
}

/** Glossy dark patches on the ground: they mirror the lamps and muzzle flashes. */
export function puddles(ctx, { list, color = '#101215', roughness = 0.05, opacity = 0.45, rng = ctx.rng.fork() }) {
  // Semi-transparent so the ground shows through as a darker, glossier patch:
  // a black mirror reads as a hole from above.
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.0, envMapIntensity: 1.5, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const group = new THREE.Group();
  for (const [x, z, r] of list) {
    const geo = new THREE.CircleGeometry(1, 40);
    const pos = geo.attributes.position;
    const stretch = rng.range(1, 1.6);
    const p1 = rng.range(0, 6);
    const p2 = rng.range(0, 6);
    for (let i = 1; i < pos.count; i++) {
      const a = Math.atan2(pos.getY(i), pos.getX(i));
      const k = 1 + Math.sin(a * 2 + p1) * 0.16 + Math.sin(a * 3 + p2) * 0.09;
      pos.setXY(i, pos.getX(i) * k * r * stretch, pos.getY(i) * k * r);
    }
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.012, z);
    m.rotation.y = rng.range(0, Math.PI);
    m.receiveShadow = true;
    group.add(m);
  }
  ctx.scene.add(group);
  return group;
}

/** Rain streaks that fall in a box around the camera's focus. */
export function rain(ctx, { count = 1400, area = 22, height = 14, speed = 22, color = '#9fb3cc', opacity = 0.35, slant = [0.18, 0.06] } = {}) {
  const rng = ctx.rng.fork();
  const pos = new Float32Array(count * 6);
  const drops = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    drops[i * 3] = rng.range(-area, area);
    drops[i * 3 + 1] = rng.range(0, height);
    drops[i * 3 + 2] = rng.range(-area, area);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  ctx.scene.add(lines);
  const len = 0.5;
  return {
    lines,
    update(dt) {
      const f = ctx.get('camera').target;
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        let x = drops[i * 3] + slant[0] * speed * dt;
        let y = drops[i * 3 + 1] - speed * dt;
        let z = drops[i * 3 + 2] + slant[1] * speed * dt;
        if (y < 0) y += height;
        if (x - f.x > area) x -= 2 * area;
        else if (x - f.x < -area) x += 2 * area;
        if (z - f.z > area) z -= 2 * area;
        else if (z - f.z < -area) z += 2 * area;
        drops[i * 3] = x;
        drops[i * 3 + 1] = y;
        drops[i * 3 + 2] = z;
        const k = i * 6;
        a[k] = x;
        a[k + 1] = y;
        a[k + 2] = z;
        a[k + 3] = x - slant[0] * len;
        a[k + 4] = y + len;
        a[k + 5] = z - slant[1] * len;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function motes(ctx, { count = 300, area = 22, height = 6, color = '#ffd9a8', size = 0.06, drift = [0.2, 0.05, 0.1], opacity = 0.7 } = {}) {
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
      const p = ctx.get('camera').target;
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
