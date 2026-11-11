import * as THREE from 'three';
import { ground, lamp, puddles } from '../kit/world/builders.js';

/**
 * The place: a walled freight yard at night, 40 by 32 metres, four gaps in the
 * wall where they come in, containers and barriers to fight around, a rail spur
 * across the south end, and five sodium lamps (one failing).
 *
 * Returns where the player starts, where enemies enter, and an update for the
 * lamps. Solids go through ctx.get('arena') so what you see is what blocks.
 */
const W = 20; // half width (x)
const D = 16; // half depth (z)
const WALL = 0.6;
const WALL_H = 2.8;

export function buildLevel(ctx) {
  const arena = ctx.get('arena');
  const mats = ctx.get('materials');
  const rng = ctx.rng.fork();

  arena.setPlay({ minX: -W + WALL / 2, minZ: -D + WALL / 2, maxX: W - WALL / 2, maxZ: D - WALL / 2 });
  arena.setField({ minX: -W - 9, minZ: -D - 9, maxX: W + 9, maxZ: D + 9 });

  // poured concrete slabs, rain-dark and glossy: the joints read from above
  const tarmac = mats.get('concrete_floor', { roughness: [0.5, -0.04, 0.1], tint: 0x8f8c88, scale: 4 });
  ground(ctx, { size: 140, material: tarmac });
  const concrete = mats.get('concrete', { tint: 0xb4b0a8 });
  const barrierMat = mats.get('concrete', { tint: 0xd8d2c4, scale: 1.6 });
  const rust = mats.get('metal_rust');
  const crateMat = mats.get('wood', { tint: 0xc9a77c });
  // Painted steel: mostly paint, so it keeps its colour in the dark instead of
  // mirroring a black sky.
  const paintedSteel = { three: { metalness: 0.25 } };
  const containers = [
    mats.get('corrugated', { tint: 0xb8452f, bake: { seed: 3 }, ...paintedSteel }),
    mats.get('corrugated', { tint: 0x3a6f98, bake: { seed: 5 }, ...paintedSteel }),
    mats.get('corrugated', { tint: 0x6f8446, bake: { seed: 7 }, ...paintedSteel }),
    mats.get('corrugated', { tint: 0xc98d33, bake: { seed: 9 }, ...paintedSteel }),
  ];

  // --- the perimeter wall, with four gaps ---
  const gaps = {
    north: [-2.2, 2.2],
    west: [-2.2, 2.2],
    east: [-2.2, 2.2],
    south: [-15.5, -11.5],
  };
  const wallRun = (x0, z0, x1, z1) => {
    const w = Math.max(WALL, Math.abs(x1 - x0));
    const d = Math.max(WALL, Math.abs(z1 - z0));
    arena.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d, h: WALL_H, material: concrete });
    // a coping strip on top so the wall has a cap and a silhouette
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), barrierMat);
    cap.position.set((x0 + x1) / 2, WALL_H + 0.07, (z0 + z1) / 2);
    cap.castShadow = true;
    ctx.scene.add(cap);
  };
  // north (z = -D) and south (z = +D) along x
  wallRun(-W, -D, gaps.north[0], -D);
  wallRun(gaps.north[1], -D, W, -D);
  wallRun(-W, D, gaps.south[0], D);
  wallRun(gaps.south[1], D, W, D);
  // west (x = -W) and east (x = +W) along z
  wallRun(-W, -D, -W, gaps.west[0]);
  wallRun(-W, gaps.west[1], -W, D);
  wallRun(W, -D, W, gaps.east[0]);
  wallRun(W, gaps.east[1], W, D);
  // gate posts with hazard paint at every gap
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 });
  const post = (x, z) => arena.box({ x, z, w: 0.7, d: 0.7, h: WALL_H + 0.5, material: hazard, solid: false });
  post(gaps.north[0], -D); post(gaps.north[1], -D);
  post(gaps.south[0], D); post(gaps.south[1], D);
  post(-W, gaps.west[0]); post(-W, gaps.west[1]);
  post(W, gaps.east[0]); post(W, gaps.east[1]);

  // --- containers: the big cover ---
  const container = (x, z, along, mat, stack = 1) => {
    const len = 6.06;
    const wid = 2.44;
    const h = 2.6;
    arena.box({ x, z, w: along === 'x' ? len : wid, d: along === 'x' ? wid : len, h, material: mat });
    for (let i = 1; i < stack; i++) arena.box({ x, z, w: along === 'x' ? len : wid, d: along === 'x' ? wid : len, h, y: h * i, material: containers[(containers.indexOf(mat) + i) % containers.length], solid: false });
    // door end: two dark bars so a container reads as a container from above
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? 0.06 : 0.08, h * 0.92, along === 'x' ? 0.08 : 0.06), rust);
      bar.position.set(x + (along === 'x' ? (len / 2 + 0.02) : s * 0.5), h * 0.48, z + (along === 'x' ? s * 0.5 : (len / 2 + 0.02)));
      ctx.scene.add(bar);
    }
  };
  container(-10.5, -8, 'x', containers[0], 2);
  container(11.5, 5.5, 'z', containers[1]);
  container(13, -9.5, 'x', containers[2]);
  container(-13.5, 6.5, 'z', containers[3], 2);

  // --- jersey barriers ---
  const jersey = (x, z, rotY) => {
    const geo = jerseyGeometry();
    const m = new THREE.Mesh(geo, barrierMat);
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    m.castShadow = m.receiveShadow = true;
    ctx.scene.add(m);
    const along = Math.abs(Math.sin(rotY)) < 0.5;
    if (along) arena.solidRect(x - 1.5, z - 0.35, x + 1.5, z + 0.35);
    else arena.solidRect(x - 0.35, z - 1.5, x + 0.35, z + 1.5);
  };
  jersey(-3.5, -4, 0);
  jersey(0.2, -4, 0);
  jersey(5, 2.5, Math.PI / 2);
  jersey(-6.5, 3, Math.PI / 2);
  jersey(2.5, 9.5, 0);

  // --- crates and barrels: small cover and detail ---
  const crate = (x, z, s = 1.15, y = 0, rot = 0) => arena.box({ x, z, w: s, d: s, h: s, y, material: crateMat, solid: y === 0, rotY: rot });
  crate(-4.2, 7.2); crate(-3, 7.4, 1.0, 0, 0.3); crate(-4.0, 7.3, 0.9, 1.15, 0.2);
  crate(7.6, -4.6); crate(8.6, -5.4, 1.0, 0, -0.2);
  crate(16.5, 12.5); crate(17.3, 13.4, 0.9); crate(16.6, 12.6, 0.95, 1.15, 0.4);
  crate(-17.4, -12.8); crate(-16.4, -13.5, 1.0, 0, 0.25);

  const barrelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.92, 14);
  const barrelMats = [mats.get('metal_painted', { tint: 0x2b5d8a, bake: { seed: 13, tintA: 0x2b5d8a, tintB: 0x1c3a58 } }), rust, mats.get('metal_painted', { tint: 0xa3341f, bake: { seed: 17, tintA: 0x9c3a24, tintB: 0x5c2216 } })];
  const barrel = (x, z) => {
    const m = new THREE.Mesh(barrelGeo, rng.pick(barrelMats));
    m.position.set(x, 0.46, z);
    m.rotation.y = rng.range(0, 6);
    m.castShadow = m.receiveShadow = true;
    ctx.scene.add(m);
    arena.solidCircle(x, z, 0.34);
  };
  for (const [x, z] of [[8.2, 8.4], [8.9, 8.9], [8.4, 9.6], [-8.4, -1.6], [-9.1, -1.0], [15.8, -3.4], [-15.8, -3.6], [-1.4, -11.5], [-0.7, -12.1]]) barrel(x, z);

  // --- the rail spur: two rails on sleepers across the south end, no collision ---
  const sleeper = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.12, 2.5), mats.get('wood', { tint: 0x5a4a3a, bake: { seed: 23 } }), 70);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) {
    m4.makeRotationY(rng.signed() * 0.03);
    m4.setPosition(-W - 10 + i * 0.86, 0.06, 12.4);
    sleeper.setMatrixAt(i, m4);
  }
  sleeper.receiveShadow = true;
  ctx.scene.add(sleeper);
  const railMat = new THREE.MeshStandardMaterial({ color: '#8d8f94', roughness: 0.28, metalness: 0.95 });
  for (const dz of [-0.72, 0.72]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(62, 0.13, 0.09), railMat);
    rail.position.set(0, 0.17, 12.4 + dz);
    rail.castShadow = true;
    ctx.scene.add(rail);
  }

  // --- painted lines: a bay grid that says "loading yard" from above ---
  const paint = new THREE.MeshStandardMaterial({ color: '#d9c48a', roughness: 0.75, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -1 });
  const line = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), paint);
    m.position.set(x, 0.01, z);
    m.receiveShadow = true;
    ctx.scene.add(m);
  };
  for (let i = -3; i <= 3; i++) line(i * 4.2, -12.5, 0.14, 5);
  line(0, -10, 29.5, 0.14);
  line(0, 6.8, 0.14, 8);
  line(0, 2.8, 12, 0.14);

  // --- oil and water stains, and loose debris, so the floor is not one value ---
  const stainGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const stainMat = new THREE.MeshStandardMaterial({ map: stainTexture(), color: '#000000', transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const stains = new THREE.InstancedMesh(stainGeo, stainMat, 46);
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 46; i++) {
    const s = rng.range(0.8, 3.4);
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    m4.compose(new THREE.Vector3(rng.range(-W, W), 0.008, rng.range(-D, D)), q, sc.set(s, 1, s * rng.range(0.5, 1)));
    stains.setMatrixAt(i, m4);
  }
  stains.receiveShadow = true;
  ctx.scene.add(stains);
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), 160);
  const e3 = new THREE.Euler();
  const cols = ['#5e5b55', '#7a756c', '#3d3c3a', '#8a7f6b', '#4c5258'];
  for (let i = 0; i < 160; i++) {
    const s = rng.range(0.05, 0.22);
    e3.set(rng.signed() * 0.3, rng.range(0, 6), rng.signed() * 0.3);
    q.setFromEuler(e3);
    m4.compose(new THREE.Vector3(rng.range(-W - 6, W + 6), s * 0.3, rng.range(-D - 6, D + 6)), q, sc.set(s * rng.range(0.6, 2.5), s * 0.6, s));
    debris.setMatrixAt(i, m4);
    debris.setColorAt(i, new THREE.Color(rng.pick(cols)));
  }
  debris.castShadow = debris.receiveShadow = true;
  ctx.scene.add(debris);

  // --- wet ground ---
  puddles(ctx, { list: [[-1, 1.5, 1.8], [6.5, -1, 1.2], [-8, 10.5, 1.5], [3.5, -8.5, 1.4], [14.5, 1, 1.1], [-14.5, -1.5, 1.3], [-5.5, -12.5, 1.0], [9.5, 12.8, 1.6]] });

  // --- the lamps ---
  const lampMat = mats.get('metal_painted', { tint: 0x3a3d42, bake: { seed: 31, tintA: 0x3a3d42, tintB: 0x24262a } });
  const lamps = [
    lamp(ctx, { x: -16.8, z: -12.6, rotY: 0.8, poleMaterial: lampMat, rng }),
    lamp(ctx, { x: 16.8, z: -12.6, rotY: -0.8, poleMaterial: lampMat, rng }),
    lamp(ctx, { x: -16.8, z: 12.2, rotY: 2.4, poleMaterial: lampMat, rng, flicker: 1.6 }),
    lamp(ctx, { x: 16.8, z: 14.6, rotY: -2.4, poleMaterial: lampMat, rng }),
    lamp(ctx, { x: 2.2, z: -1.2, rotY: 3.6, poleMaterial: lampMat, rng, intensity: 70, color: '#ffa95c' }),
  ];
  for (const l of lamps) arena.solidCircle(l.group.position.x, l.group.position.z, 0.24);

  // --- beyond the wall: dark sheds and a fence line, so the edge is not a void ---
  const shed = mats.get('corrugated', { tint: 0x4a5058, bake: { seed: 41 }, ...paintedSteel });
  for (const [x, z, w, d, h] of [[-30, -12, 10, 8, 6], [30, 10, 9, 12, 7], [-28, 22, 14, 6, 5], [26, -25, 16, 6, 6], [-8, -27, 10, 5, 5], [10, 27, 12, 5, 6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shed);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    ctx.scene.add(m);
  }

  return {
    playerSpawn: [0, 6],
    playerYaw: Math.PI,
    cameraHeading: 0,
    // just outside each gap; the flow field walks them in
    enemySpawns: [[0, -D - 5], [0, -D - 7], [-W - 5, 0], [-W - 6, 2], [W + 5, 0], [W + 6, -2], [-13.5, D + 5], [-13.5, D + 7]],
    prewarm: { walker: 12, runner: 8, brute: 2 },
    update(dt) {
      for (const l of lamps) l.update(dt);
    },
  };
}

/** The classic road-barrier profile, extruded 3 m along x. */
function jerseyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.33, 0);
  s.lineTo(0.33, 0);
  s.lineTo(0.33, 0.08);
  s.lineTo(0.2, 0.3);
  s.lineTo(0.1, 0.82);
  s.lineTo(-0.1, 0.82);
  s.lineTo(-0.2, 0.3);
  s.lineTo(-0.33, 0.08);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  geo.translate(0, 0, -1.5);
  geo.rotateY(Math.PI / 2);
  return geo;
}

function stainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // a ragged blot: many soft circles clustered round the middle
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 1.5) * 40;
    const x = 64 + Math.cos(a) * d;
    const y = 64 + Math.sin(a) * d;
    const r = 6 + rnd() * 18;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

let _hz = null;
function hazardTexture() {
  if (_hz) return _hz;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d6a21e';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#16161a';
  for (let i = -64; i < 128; i += 22) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 11, 0);
    g.lineTo(i + 11 + 64, 64);
    g.lineTo(i + 64, 64);
    g.closePath();
    g.fill();
  }
  _hz = new THREE.CanvasTexture(c);
  _hz.colorSpace = THREE.SRGBColorSpace;
  _hz.wrapS = _hz.wrapT = THREE.RepeatWrapping;
  _hz.repeat.set(1, 3);
  return _hz;
}
