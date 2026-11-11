import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { puddles } from '../kit/world/builders.js';

/**
 * The place: a clearing of wet leaf litter on the edge of Corrow Fen, 60 by 60
 * metres, open enough to run circles in. Scanned rocks and two dead trees for
 * cover and silhouette, bog pools that mirror the lantern, reed beds, fallen
 * logs, a line of old way-lanterns (two still lit), and the chapel to the
 * north whose bell ends the night.
 *
 * Solids go through ctx.get('arena'); the swarm walks straight, so keep them few.
 */
const HALF = 30;

export function buildLevel(ctx, assets) {
  const arena = ctx.get('arena');
  const mats = ctx.get('materials');
  const rng = ctx.rng.fork();
  const q = ctx.config.q;
  const low = ctx.config.quality === 'low';

  arena.setPlay({ minX: -HALF, minZ: -HALF, maxX: HALF, maxZ: HALF });
  arena.setField({ minX: -HALF - 6, minZ: -HALF - 6, maxX: HALF + 6, maxZ: HALF + 6 });

  // --- the floor: scanned leaf litter, darkened and wet ---
  const tile = 3.2; // metres per repeat of the scan
  for (const t of Object.values(assets.leaves)) t.repeat.set(160 / tile, 160 / tile);
  const floor = new THREE.MeshStandardMaterial({
    map: assets.leaves.map,
    normalMap: assets.leaves.normalMap,
    roughnessMap: assets.leaves.roughnessMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: '#8a8478',
    roughness: 0.82,
    envMapIntensity: 0.9,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), floor);
  ground.receiveShadow = true;
  ctx.scene.add(ground);

  // big soft mud and water stains break up the repeat of the scan from above
  const stainMat = new THREE.MeshStandardMaterial({ map: blotTexture(), color: '#000000', transparent: true, opacity: 0.6, roughness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const stains = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), stainMat, 70);
  const m4 = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 70; i++) {
    const s = rng.range(2.5, 9);
    qn.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    m4.compose(v.set(rng.range(-HALF - 8, HALF + 8), 0.006, rng.range(-HALF - 8, HALF + 8)), qn, sc.set(s, 1, s * rng.range(0.5, 1)));
    stains.setMatrixAt(i, m4);
  }
  stains.receiveShadow = true;
  ctx.scene.add(stains);

  // bog pools: glossy black water that mirrors the lights
  const pools = [[-9, 6, 2.6], [11, -7, 2.1], [4, 14, 1.8], [-15, -12, 2.4], [19, 12, 1.6], [-21, 17, 1.9], [0, -19, 1.5], [24, -20, 2.2], [-3, -6, 1.1], [7, 4, 0.9]];
  const water = puddles(ctx, { list: pools, color: '#0b0f12', roughness: 0.04, opacity: 0.5 });
  // the sky is near black, so the water should mirror lights, not the grey of the env map
  water.children[0].material.envMapIntensity = 0.35;

  // --- scanned rocks: low cover and something to read the light on ---
  const rock = assets.rock;
  const rb = rock.geometry.boundingBox;
  const rockSize = Math.max(rb.max.x - rb.min.x, rb.max.z - rb.min.z);
  const rockGeo = rock.geometry.clone().translate(-(rb.min.x + rb.max.x) / 2, -rb.min.y, -(rb.min.z + rb.max.z) / 2);
  const rockMat = rock.material.clone();
  rockMat.color = new THREE.Color('#9a958c');
  const rocks = [[-6, -9, 2.4, 0.4], [9, 3, 1.8, 2.1], [-14, 3, 2.8, 4.0], [15, -14, 2.2, 1.2], [-4, 15, 2.0, 5.3], [22, 4, 3.0, 3.3], [-23, -6, 2.6, 0.9], [3, -24, 2.4, 2.7], [-22, 24, 2.8, 1.8], [25, 24, 2.2, 5.6]];
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rocks.forEach(([x, z, size, rot], i) => {
    const k = size / rockSize;
    qn.setFromAxisAngle(up, rot);
    m4.compose(v.set(x, -0.15, z), qn, sc.set(k, k * rng.range(0.7, 1.1), k));
    rockMesh.setMatrixAt(i, m4);
    arena.solidCircle(x, z, size * 0.36);
  });
  rockMesh.castShadow = rockMesh.receiveShadow = true;
  ctx.scene.add(rockMesh);

  // --- two dead trees: the silhouettes of the clearing ---
  if (!low) {
    const tr = assets.trunk;
    const tb = tr.geometry.boundingBox;
    // scale by the longest side: the scan may lie down or stand up
    const tall = Math.max(tb.max.x - tb.min.x, tb.max.y - tb.min.y, tb.max.z - tb.min.z);
    const trunkGeo = tr.geometry.clone().translate(-(tb.min.x + tb.max.x) / 2, -tb.min.y, -(tb.min.z + tb.max.z) / 2);
    const trunkMat = tr.material.clone();
    trunkMat.color = new THREE.Color('#8f8a82');
    const ex = tb.max.x - tb.min.x;
    const ez = tb.max.z - tb.min.z;
    for (const [x, z, h, rot] of [[-12, -16, 7, 0.6], [17, 9, 6, 2.4]]) {
      const m = new THREE.Mesh(trunkGeo, trunkMat);
      const k = h / tall;
      m.scale.setScalar(k);
      m.position.set(x, -0.05, z);
      m.rotation.y = rot;
      m.castShadow = m.receiveShadow = true;
      ctx.scene.add(m);
      // collision: a row of circles along the trunk's long side on the ground
      const len = Math.max(ex, ez) * k;
      const r = Math.max(0.35, Math.min(ex, ez) * k * 0.4);
      const [ax, az] = ex >= ez ? [Math.cos(rot), -Math.sin(rot)] : [Math.sin(rot), Math.cos(rot)];
      const n = Math.max(1, Math.ceil(len / (r * 2)));
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n - 0.5;
        arena.solidCircle(x + ax * f * len, z + az * f * len, r);
      }
    }
  }

  // --- fallen logs ---
  const bark = mats.get('wood', { tint: 0x4a3c2e, bake: { seed: 7 } });
  const logs = [[5, -12, 4.5, 0.3, 0.32], [-17, 10, 5.5, 1.9, 0.38], [12, 19, 3.8, 0.9, 0.28], [-26, -18, 4.2, 2.6, 0.34]];
  for (const [x, z, len, rot, r] of logs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 10).rotateZ(Math.PI / 2), bark);
    m.position.set(x, r * 0.8, z);
    m.rotation.y = rot;
    m.castShadow = m.receiveShadow = true;
    ctx.scene.add(m);
    // a row of circles is cheap collision for a log
    const n = Math.ceil(len / (r * 2));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n - 0.5;
      arena.solidCircle(x + Math.cos(rot) * f * len, z - Math.sin(rot) * f * len, r + 0.05);
    }
  }

  // --- reed beds and grass tufts: one instanced mesh of a clump ---
  const blades = [];
  const crng = ctx.rng.fork();
  for (let i = 0; i < 9; i++) {
    const h = crng.range(0.6, 1.4);
    const g = new THREE.ConeGeometry(0.03, h, 3).toNonIndexed();
    g.rotateX(crng.signed() * 0.25);
    g.rotateZ(crng.signed() * 0.25);
    g.translate(crng.signed() * 0.25, h / 2, crng.signed() * 0.25);
    const c = new THREE.Color().setHSL(crng.range(0.1, 0.16), crng.range(0.25, 0.4), crng.range(0.2, 0.32));
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) {
      const y = g.attributes.position.getY(k);
      const f = Math.min(1, y / h);
      col[k * 3] = c.r * (0.45 + f * 0.7);
      col[k * 3 + 1] = c.g * (0.45 + f * 0.7);
      col[k * 3 + 2] = c.b * (0.45 + f * 0.7);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    blades.push(g);
  }
  const clump = mergeGeometries(blades, false);
  const reedCount = low ? 140 : 320;
  const reeds = new THREE.InstancedMesh(clump, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), reedCount);
  let placed = 0;
  // thick round the pools, thinner elsewhere
  for (const [px, pz, pr] of pools) {
    for (let k = 0; k < 14 && placed < reedCount; k++) {
      const a = rng.range(0, Math.PI * 2);
      const d = pr * rng.range(1.1, 1.8);
      const s = rng.range(0.8, 1.5);
      qn.setFromAxisAngle(up, rng.range(0, 6));
      m4.compose(v.set(px + Math.cos(a) * d, 0, pz + Math.sin(a) * d), qn, sc.set(s, s, s));
      reeds.setMatrixAt(placed++, m4);
    }
  }
  while (placed < reedCount) {
    const s = rng.range(0.5, 1.1);
    qn.setFromAxisAngle(up, rng.range(0, 6));
    m4.compose(v.set(rng.range(-HALF - 10, HALF + 10), 0, rng.range(-HALF - 10, HALF + 10)), qn, sc.set(s, s, s));
    reeds.setMatrixAt(placed++, m4);
  }
  reeds.castShadow = !low;
  reeds.receiveShadow = true;
  ctx.scene.add(reeds);

  // --- the way-lanterns: posts along the old path; two still burn ---
  const post = mats.get('wood', { tint: 0x5a4a3a, bake: { seed: 11 } });
  const iron = new THREE.MeshStandardMaterial({ color: '#1d1c1a', roughness: 0.5, metalness: 0.7 });
  const lanterns = [];
  const way = [[-8, 2, false], [4.5, -0.5, true], [14, -9, false], [-16, -4, true], [2, 10, false]];
  for (const [x, z, lit] of way) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), post);
    pole.position.y = 1.3;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), post);
    arm.position.set(0.3, 2.5, 0);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.36, 6), iron);
    cage.position.set(0.55, 2.2, 0);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: lit ? new THREE.Color('#ffb05a').multiplyScalar(5) : new THREE.Color('#1a1612'), fog: false }));
    flame.position.copy(cage.position);
    for (const m of [pole, arm, cage]) m.castShadow = m.receiveShadow = true;
    g.add(pole, arm, cage, flame);
    g.position.set(x, 0, z);
    g.rotation.y = rng.range(0, 6);
    if (!lit) g.rotation.z = rng.signed() * 0.12; // the dead ones lean
    ctx.scene.add(g);
    arena.solidCircle(x, z, 0.2);
    if (lit && q.lamps) {
      const l = new THREE.PointLight('#ffaa55', 26, 13, 1.7);
      l.position.copy(cage.position);
      g.add(l);
      lanterns.push({ l, base: 26, seed: rng.range(0, 10) });
    }
  }

  // --- the chapel to the north, its window lit: where the bell will ring ---
  const stone = mats.get('brick', { tint: 0x6a6660, bake: { seed: 21 } });
  const chapel = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 12), stone);
  nave.position.y = 2.5;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5.2, 3.2, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.65), new THREE.MeshStandardMaterial({ color: '#23262a', roughness: 0.6 }));
  roof.position.y = 6.6;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 11, 3), stone);
  tower.position.set(0, 5.5, 7);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4, 4).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: '#23262a', roughness: 0.6 }));
  spire.position.set(0, 13, 7);
  const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb768').multiplyScalar(2.2) });
  for (const z of [-3, 0, 3]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), glass);
    w.position.set(3.51, 2.8, z);
    w.rotation.y = Math.PI / 2;
    chapel.add(w);
  }
  const belfry = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), glass);
  belfry.position.set(0, 9.2, 8.51);
  for (const m of [nave, roof, tower, spire]) m.castShadow = m.receiveShadow = true;
  chapel.add(nave, roof, tower, spire, belfry);
  chapel.position.set(-6, 0, -HALF - 11);
  chapel.rotation.y = 0.15;
  ctx.scene.add(chapel);

  // --- the treeline beyond the clearing: dark trunks fading into the fog ---
  const trunkCount = low ? 50 : 110;
  const pines = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.32, 9, 6).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.9 }), trunkCount);
  let trees = 0;
  for (let i = 0; i < trunkCount; i++) {
    const a = rng.range(0, Math.PI * 2);
    const side = rng.int(0, 3);
    const t = rng.range(-HALF - 12, HALF + 12);
    const d = HALF + rng.range(5, 16);
    const [x, z] = side === 0 ? [t, -d] : side === 1 ? [t, d] : side === 2 ? [-d, t] : [d, t];
    if (Math.hypot(x + 6, z + HALF + 11) < 10) continue;
    const s = rng.range(0.6, 1.4);
    qn.setFromAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), rng.signed() * 0.12);
    m4.compose(v.set(x, 0, z), qn, sc.set(s, rng.range(0.6, 1.3), s));
    pines.setMatrixAt(trees++, m4);
  }
  pines.count = trees;
  pines.castShadow = !low;
  ctx.scene.add(pines);

  return {
    playerSpawn: [0, 3],
    playerYaw: Math.PI,
    cameraHeading: 0,
    // on the title the view slides left, so the warden and the lit lamp sit right of the words
    titleOffset: [-6.5, -1],
    // [type, dx, dz] from the warden: what waits in the dark on the title screen
    titleCrowd: [
      ['mireling', 4.2, -2.5], ['mireling', 5.4, -0.6], ['mireling', 4.8, 1.8], ['skitter', 6.6, 0.9], ['mireling', 3.4, 3.6],
      ['bogman', 7.2, -3.4], ['mireling', 6.9, 3.2], ['skitter', 2.2, -4.4], ['wisp', 5.8, -2], ['mireling', 8.4, 0.2],
      ['mireling', 1.2, 4.6], ['skitter', -1.4, -4.8],
    ],
    update(dt) {
      const t = ctx.time.raw;
      for (const k of lanterns) k.l.intensity = k.base * (0.88 + Math.sin(t * 11 + k.seed) * 0.05 + Math.sin(t * 5.7 + k.seed * 2) * 0.07);
    },
  };
}

/** A ragged soft blot: many soft circles clustered round the middle. */
function blotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 1.4) * 42;
    const x = 64 + Math.cos(a) * d;
    const y = 64 + Math.sin(a) * d;
    const r = 6 + rnd() * 20;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return new THREE.CanvasTexture(c);
}
