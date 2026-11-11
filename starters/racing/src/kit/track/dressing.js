/**
 * Scene dressing a game can add on top of a built track, from src/game/look.js
 * `dress()`: tree belts in the outfield, flag strings over the road, and sunlit
 * dust that drifts around the camera. All instanced, all procedural.
 *
 *   const trees = scatterTrees(ctx, { count: 260, near: 14, far: 140, palette: [...] });
 *   bunting(ctx, { at: [0.02, 0.05], colors: [...] });
 *   const dust = sunDust(ctx, { count: 500, color: 0xffd9a0 });   // returns { update(dt, camera) }
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function painted(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Off-road distance (m) from the barrier line at a world XZ, and the ground height there. */
function clearance(track, x, z, tmp) {
  tmp.set(x, 0, z);
  const q = track.query(tmp);
  return { d: Math.abs(q.lateral) - q.wallHalfWidth, y: q.groundY };
}

/**
 * Belts of broadleaf trees and tall poplars in the outfield.
 * @param {{ count?: number, near?: number, far?: number, seed?: number, palette?: number[], trunk?: number, poplarShare?: number }} o
 */
export function scatterTrees({ scene, track }, o = {}) {
  const r = rng(o.seed ?? 7);
  const count = o.count ?? 240;
  const near = o.near ?? 14;
  const far = o.far ?? 150;
  const palette = (o.palette ?? [0x5b6b2a, 0x7a7a2c, 0x9a6a24, 0x4f5e2a, 0xa8562a]).map((c) => new THREE.Color(c));
  const trunkCol = o.trunk ?? 0x4a3524;

  const broad = mergeGeometries([
    painted(new THREE.CylinderGeometry(0.22, 0.34, 3, 6).translate(0, 1.5, 0), trunkCol),
    painted(new THREE.IcosahedronGeometry(2.4, 1).scale(1, 0.85, 1).translate(0, 4.4, 0), 0xffffff),
    painted(new THREE.IcosahedronGeometry(1.6, 1).translate(1.1, 5.6, 0.4), 0xeeeeee),
  ]);
  const poplar = mergeGeometries([
    painted(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 5).translate(0, 1.1, 0), trunkCol),
    painted(new THREE.ConeGeometry(1.3, 8.5, 7).translate(0, 6.3, 0), 0xffffff),
  ]);
  // Trunks keep their colour; canopies take the instance colour.
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });

  // Place along the track so the belts frame the road rather than fill the map.
  const spots = [];
  const tmp = new THREE.Vector3();
  const s = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3(), halfWidth: 0, wallHalfWidth: 0, t: 0 };
  for (let tries = 0; spots.length < count && tries < count * 12; tries++) {
    track.sample(r(), s);
    const side = r() < 0.5 ? -1 : 1;
    const out = s.wallHalfWidth + near + Math.pow(r(), 1.6) * (far - near);
    const x = s.position.x + s.binormal.x * side * out + (r() - 0.5) * 6;
    const z = s.position.z + s.binormal.z * side * out + (r() - 0.5) * 6;
    const c = clearance(track, x, z, tmp);
    if (c.d < near) continue;
    const ground = track.heightAt(x, z);
    spots.push({ x, y: ground, z, poplar: r() < (o.poplarShare ?? 0.3) });
  }

  const group = new THREE.Group();
  group.name = 'treeBelts';
  for (const kind of ['broad', 'poplar']) {
    const list = spots.filter((p) => (kind === 'poplar') === p.poplar);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(kind === 'poplar' ? poplar : broad, mat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    list.forEach((p, i) => {
      const k = 0.75 + r() * 0.6;
      sc.set(k, k * (0.85 + r() * 0.35), k);
      q.setFromEuler(e.set(0, r() * Math.PI * 2, 0));
      m.compose(tmp.set(p.x, p.y - 0.3, p.z), q, sc);
      mesh.setMatrixAt(i, m);
      col.copy(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.85 + r() * 0.3);
      mesh.setColorAt(i, col);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = kind === 'poplar' ? 'poplarBelt' : 'treeBelt';
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

/**
 * Strings of pennant flags hung across the road between two poles.
 * @param {{ at: number[], colors?: number[], height?: number, flags?: number }} o  `at` = track t of each string
 */
export function bunting({ scene, track }, o) {
  const colors = (o.colors ?? [0xf4efe0, 0xd2452a, 0xffb25e, 0x2f4858]).map((c) => new THREE.Color(c));
  const per = o.flags ?? 26;
  const height = o.height ?? 6.5;
  const total = o.at.length * per;
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.32, 0, 0, 0.32, 0, 0, 0, -0.75, 0], 3));
  flagGeo.computeVertexNormals();
  const flagMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 });
  const flags = new THREE.InstancedMesh(flagGeo, flagMat, total);
  flags.name = 'buntingFlags';
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, height + 0.6, 6).translate(0, (height + 0.6) / 2, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, o.at.length * 2);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1612 });
  const group = new THREE.Group();
  group.name = 'bunting';
  const s = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3(), halfWidth: 0, wallHalfWidth: 0, t: 0 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();
  let fi = 0;
  o.at.forEach((t, si) => {
    track.sample(t, s);
    const w = s.wallHalfWidth + 0.8;
    a.copy(s.position).addScaledVector(s.binormal, -w);
    b.copy(s.position).addScaledVector(s.binormal, w);
    a.y = track.heightAt(a.x, a.z);
    b.y = track.heightAt(b.x, b.z);
    poles.setMatrixAt(si * 2, m.makeTranslation(a.x, a.y, a.z));
    poles.setMatrixAt(si * 2 + 1, m.makeTranslation(b.x, b.y, b.z));
    const yaw = Math.atan2(s.binormal.x, s.binormal.z) - Math.PI / 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const pts = [];
    for (let k = 0; k <= 32; k++) {
      const u = k / 32;
      p.lerpVectors(a, b, u);
      p.y += height - Math.sin(Math.PI * u) * 1.4;
      pts.push(p.clone());
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let k = 0; k < per; k++) {
      const u = (k + 0.5) / per;
      p.lerpVectors(a, b, u);
      p.y += height - Math.sin(Math.PI * u) * 1.4;
      m.compose(p, q, one);
      flags.setMatrixAt(fi, m);
      flags.setColorAt(fi, colors[k % colors.length]);
      fi++;
    }
  });
  flags.castShadow = true;
  poles.castShadow = true;
  group.add(flags, poles);
  scene.add(group);
  return group;
}

/**
 * Rubber laid down by years of racing: dark tyre streaks through every corner,
 * on the line a driver would take (outside, apex, outside), plus a few braking
 * marks before the corners. One draw call.
 * @param {{ seed?: number, darkness?: number, minTurn?: number }} o
 */
export function skidMarks({ scene, track }, o = {}) {
  const r = rng(o.seed ?? 5);
  const N = 900;
  const len = track.length;
  const s0 = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3(), halfWidth: 0, wallHalfWidth: 0, t: 0 };
  const s1 = { ...s0, position: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3() };
  // signed turn per sample (+ = right)
  const turn = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    track.sample(i / N, s0);
    track.sample((i + 1) / N, s1);
    turn[i] = Math.atan2(s0.tangent.x * s1.tangent.z - s0.tangent.z * s1.tangent.x, s0.tangent.x * s1.tangent.x + s0.tangent.z * s1.tangent.z);
  }
  const smooth = new Float32Array(N);
  const W = 14;
  for (let i = 0; i < N; i++) {
    let acc = 0;
    for (let k = -W; k <= W; k++) acc += turn[(i + k + N) % N];
    smooth[i] = acc / (2 * W + 1);
  }
  const minTurn = o.minTurn ?? 0.0035;
  const verts = [];
  const alphas = [];
  const idx = [];
  const strip = (i0, i1, lateralAt, width, alpha) => {
    const base = verts.length / 3;
    const steps = i1 - i0;
    for (let k = 0; k <= steps; k++) {
      const i = (i0 + k + N) % N;
      track.sample(i / N, s0);
      const lat = lateralAt(k / steps, s0.halfWidth);
      const fade = Math.sin(Math.PI * (k / steps));
      for (const side of [-1, 1]) {
        const l = lat + side * width * 0.5;
        verts.push(s0.position.x + s0.binormal.x * l, s0.position.y + 0.025, s0.position.z + s0.binormal.z * l);
        alphas.push(alpha * fade);
      }
      if (k < steps) {
        const a = base + k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  };
  for (let i = 0; i < N; ) {
    if (Math.abs(smooth[i]) < minTurn) {
      i++;
      continue;
    }
    let j = i;
    while (j < N && Math.abs(smooth[j]) >= minTurn * 0.7) j++;
    const dir = Math.sign(smooth[i]); // + right turn: apex on the right
    const pad = 10;
    const a = i - pad;
    const b = j + pad;
    const lines = 2 + Math.floor(r() * 3);
    for (let n = 0; n < lines; n++) {
      const off = (r() - 0.5) * 2.2;
      const width = 0.22 + r() * 0.12;
      for (const wheel of [-0.55, 0.55]) {
        strip(a, b, (u, hw) => dir * (Math.cos(Math.PI * 2 * u) * -0.55 * hw) * 0.95 + off + wheel, width, 0.28 + r() * 0.25);
      }
    }
    // braking marks, straight, before the corner
    const brakeLen = 18 + Math.floor(r() * 14);
    for (const wheel of [-0.55, 0.55]) strip(a - brakeLen, a, (u, hw) => -dir * 0.5 * hw + wheel + (r() - 0.5) * 0.02, 0.24, 0.3);
    i = j + 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.55, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float alpha;\nvarying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = alpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vAlpha * ' + (o.darkness ?? 1).toFixed(2) + ';');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'skidMarks';
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Pollen and dust hanging in low sunlight, kept in a box around the camera.
 * @returns {{ update(dt: number, camera: THREE.Camera): void, points: THREE.Points }}
 */
export function sunDust({ scene }, o = {}) {
  const r = rng(o.seed ?? 11);
  const count = o.count ?? 500;
  const box = o.box ?? 26;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * box;
    pos[i * 3 + 1] = r() * box * 0.35;
    pos[i * 3 + 2] = (r() - 0.5) * box;
    vel[i * 3] = (r() - 0.5) * 0.25;
    vel[i * 3 + 1] = (r() - 0.3) * 0.12;
    vel[i * 3 + 2] = (r() - 0.5) * 0.25;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: dotTexture(),
    color: o.color ?? 0xffd9a0,
    size: o.size ?? 0.09,
    transparent: true,
    opacity: o.opacity ?? 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'sunDust';
  scene.add(points);
  const half = box / 2;
  const wrap = (v, c) => {
    const d = v - c;
    return d > half ? v - box : d < -half ? v + box : v;
  };
  return {
    points,
    update(dt, camera) {
      const c = camera.position;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        pos[k] = wrap(pos[k] + vel[k] * dt, c.x);
        pos[k + 1] = pos[k + 1] + vel[k + 1] * dt;
        if (pos[k + 1] - c.y > box * 0.3) pos[k + 1] -= box * 0.55;
        if (pos[k + 1] - c.y < -3) pos[k + 1] += box * 0.4;
        pos[k + 2] = wrap(pos[k + 2] + vel[k + 2] * dt, c.z);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
