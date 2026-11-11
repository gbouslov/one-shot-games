import * as THREE from 'three';
import { Board } from '../kit/td/board.js';
import { fbm } from '../kit/textures/textures.js';
import {
  splatTerrain, layerTexture, grassField, instanced, motes,
  rockGeometry, coniferGeometry, broadleafGeometry, shrubGeometry, mergeGeometries,
} from '../kit/world/nature.js';

/**
 * The valley. Draw the board as a picture: one character per 2 m cell.
 *   S spawn on the left edge   # road   G the shrine on the right edge
 *   . open ground (towers go here)   x blocked: boulders and trees
 * Or replace `map` with `generate: { rows, cols, minPathLength, seed }` for a random road.
 */
export const map = [
  '....................',
  '..x..........x......',
  'S######.............',
  '......#.......x.....',
  '......#..#######....',
  '.x....#..#.....#....',
  '......#..#.....#..x.',
  '......####.....#....',
  '...............####G',
  '..x.................',
  '.........x......x...',
  '....................',
];

const CELL = 2;

export function buildLevel(ctx) {
  const board = new Board({ map, cell: CELL, lead: 3, tail: 2.6 });
  const rng = ctx.rng.fork();
  const halfW = board.width / 2;
  const halfD = board.depth / 2;
  const seed = 7;

  // --- the ground's shape, baked to a grid so walkers can ask for it cheaply ---
  const EXT = [96, 72]; // terrain size in metres
  const RES = 0.25;
  const NX = Math.round(EXT[0] / RES) + 1;
  const NZ = Math.round(EXT[1] / RES) + 1;
  const pathDist = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = -EXT[0] / 2 + i * RES;
      const z = -EXT[1] / 2 + j * RES;
      // far from the board the exact distance does not matter
      const out = Math.max(Math.abs(x) - halfW, Math.abs(z) - halfD);
      pathDist[j * NX + i] = out > 14 ? 99 : board.distanceToPath(x, z);
    }
  }
  const sampleGrid = (arr, x, z) => {
    const fx = Math.max(0, Math.min(NX - 1.001, (x + EXT[0] / 2) / RES));
    const fz = Math.max(0, Math.min(NZ - 1.001, (z + EXT[1] / 2) / RES));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = arr[j * NX + i];
    const b = arr[j * NX + i + 1];
    const c = arr[(j + 1) * NX + i];
    const d = arr[(j + 1) * NX + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const dPath = (x, z) => sampleGrid(pathDist, x, z);
  const n2 = (x, z, s, o = 4, k = 0) => fbm(((x / s) % 1 + 1) % 1, ((z / s) % 1 + 1) % 1, 4, o, seed + k);
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** Raw height: a soft valley floor, the road sunk into it, hills rising behind and to the sides. */
  const rawHeight = (x, z) => {
    const dp = dPath(x, z);
    let h = (n2(x, z, 48, 4) - 0.5) * 0.5;
    h -= 0.2 * (1 - smooth(0.6, 1.4, dp));
    const sx = Math.max(0, Math.abs(x) - halfW - 0.6);
    const back = Math.max(0, -z - halfD - 0.4);
    const front = Math.max(0, z - halfD - 0.6);
    const rim = Math.hypot(sx, back);
    const hill = smooth(0, 15, rim) * (1.6 + 6 * n2(x, z, 64, 5, 3)) + smooth(4, 24, back) * 4;
    const lip = smooth(0, 6, front) * (0.6 + 1.6 * n2(x, z, 40, 4, 5));
    h += (hill + lip) * smooth(1.5, 6, dp);
    // the road keeps going out of the valley through a cut
    return h;
  };
  const hgrid = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) hgrid[j * NX + i] = rawHeight(-EXT[0] / 2 + i * RES, -EXT[1] / 2 + j * RES);
  const heightAt = (x, z) => sampleGrid(hgrid, x, z);

  // --- ground layers: meadow grass, dry grass, the road, rock ---
  const size = ctx.config.quality === 'low' ? 128 : 256;
  const layers = [
    { map: layerTexture(rng, { size, colors: ['#2f4a1c', '#466626', '#5f7f30', '#7c9640'], scale: 4, octaves: 4, blades: 0.25, flecks: [['#e6dc9a', 0.012], ['#d99a7a', 0.006]] }), scale: 3.4, roughness: 0.95 },
    { map: layerTexture(rng, { size, colors: ['#56622a', '#737a34', '#958f4a', '#b3a866'], scale: 4, octaves: 4, blades: 0.3 }), scale: 3.6, roughness: 0.95 },
    { map: layerTexture(rng, { size, colors: ['#5e4a33', '#755d42', '#8f7656', '#a68e6c'], scale: 4, octaves: 4, pebbles: 0.35 }), scale: 3.2, roughness: 0.9 },
    { map: layerTexture(rng, { size, colors: ['#4a443b', '#6a6253', '#8a8069', '#a89c82'], scale: 3, octaves: 5, cracks: 0.3, pebbles: 0.3 }), scale: 7, roughness: 0.82 },
  ];
  const segs = ctx.config.quality === 'low' ? [144, 108] : [256, 192];
  const terrain = splatTerrain(ctx, {
    width: EXT[0],
    depth: EXT[1],
    segments: segs,
    height: heightAt,
    layers,
    bump: 0.55,
    weights: (x, z, y, slope) => {
      const dp = dPath(x, z);
      const road = 1 - smooth(0.75, 1.25, dp + (n2(x, z, 9, 3, 9) - 0.5) * 0.5);
      const rock = smooth(0.22, 0.45, slope) + smooth(5, 9, y) * 0.5;
      const dry = smooth(0.45, 0.62, n2(x, z, 22, 4, 11)) + smooth(1.2, 2.4, dp) * 0.15 * (1 - smooth(0, 1, road));
      const grass = 1.0;
      return [grass * (1 - road) * (1 - Math.min(1, rock)), dry * (1 - road) * (1 - Math.min(1, rock)) * 0.9, road * 2.2, rock * (1 - road)];
    },
    tint: (x, z, y, slope, c) => {
      const dp = dPath(x, z);
      // darker, damper soil along the road's edges and in the low ground
      const edge = smooth(1.6, 1.0, dp) * smooth(0.6, 1.0, dp);
      const k = 1 - edge * 0.25 - smooth(0.4, -0.3, y) * 0.08;
      const hue = n2(x, z, 30, 3, 21) - 0.5;
      c.setRGB(k * (1 + hue * 0.2), k * (1 + hue * 0.08), k * (1 - hue * 0.12));
    },
  });

  // --- props ---
  const cellAt = (x, z) => board.toCell(x, z);
  const onBoard = (x, z) => Math.abs(x) < halfW && Math.abs(z) < halfD;
  const blockedCells = [];
  for (const [c, r, t] of board.each()) if (t === 'x') blockedCells.push(board.toWorld(c, r));
  const nearSpecial = (x, z, r) => (Math.hypot(x - gate.x, z - gate.z) < r + 3) || (Math.hypot(x - shrine.x, z - shrine.z) < r + 3.5);
  const gate = { x: board.spawnPoint.x + 1.2, z: board.spawnPoint.z };
  const shrine = { x: board.goalPoint.x, z: board.goalPoint.z };

  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const vcLeaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const vcRock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const update = [];

  // trees ring the valley; a few stand on blocked cells
  const treeWhere = (rng2) => {
    const x = rng2.range(-EXT[0] / 2 + 2, EXT[0] / 2 - 2);
    const z = rng2.range(-EXT[1] / 2 + 2, halfD + 7);
    if (onBoard(x, z) || dPath(x, z) < 3.2 || nearSpecial(x, z, 1)) return null;
    // nothing tall between the camera and the board
    if (z > halfD - 2 && Math.abs(x) < halfW + 8) return null;
    return [x, z];
  };
  for (let k = 0; k < 3; k++) {
    const geo = coniferGeometry(rng, { height: 5 + k * 1.2, radius: 1.5 + k * 0.2, tiers: 4 + k });
    instanced(ctx, { geometry: geo, material: vcLeaf, count: 36, place: (r) => {
      const at = treeWhere(r);
      if (!at) return null;
      return { x: at[0], y: heightAt(at[0], at[1]) - 0.2, z: at[1], s: r.range(0.75, 1.3), ry: r.range(0, 6.28) };
    } });
  }
  for (let k = 0; k < 2; k++) {
    const geo = broadleafGeometry(rng, { height: 3.6 + k, radius: 1.7 + k * 0.3, dark: k ? '#34421d' : '#2c3f1b', light: k ? '#9a8f3e' : '#7f8f3c' });
    instanced(ctx, { geometry: geo, material: vcLeaf, count: 22, place: (r) => {
      const at = treeWhere(r);
      if (!at) return null;
      return { x: at[0], y: heightAt(at[0], at[1]) - 0.15, z: at[1], s: r.range(0.8, 1.25), ry: r.range(0, 6.28) };
    } });
  }
  // on-board blocked cells: a boulder with a small tree or shrubs
  const boulder = rockGeometry(rng, { radius: 0.9, detail: 2, roughness: 0.3, squash: 0.75 });
  instanced(ctx, { geometry: boulder, material: vcRock, count: blockedCells.length, place: (r, i) => {
    const p = blockedCells[i];
    return { x: p.x + r.signed() * 0.2, y: heightAt(p.x, p.z) + 0.1, z: p.z + r.signed() * 0.2, s: r.range(0.9, 1.2), ry: r.range(0, 6.28) };
  } });
  const smallTree = coniferGeometry(rng, { height: 3.4, radius: 1.0, tiers: 4 });
  instanced(ctx, { geometry: smallTree, material: vcLeaf, count: blockedCells.length, place: (r, i) => {
    const p = blockedCells[i];
    if (i % 2) return { x: p.x + 0.6, y: heightAt(p.x + 0.6, p.z - 0.5), z: p.z - 0.5, s: r.range(0.8, 1.1), ry: r.range(0, 6.28) };
    return { x: p.x - 0.5, y: heightAt(p.x, p.z) - 0.1, z: p.z + 0.6, s: 0.6, ry: 0 };
  } });

  // rocks on the slopes and stones along the road's edge
  const rockA = rockGeometry(rng, { radius: 1, detail: 1, roughness: 0.32, squash: 0.6 });
  instanced(ctx, { geometry: rockA, material: vcRock, count: 70, place: (r) => {
    const x = r.range(-EXT[0] / 2 + 3, EXT[0] / 2 - 3);
    const z = r.range(-EXT[1] / 2 + 3, halfD + 6);
    if (onBoard(x, z) || dPath(x, z) < 2) return null;
    return { x, y: heightAt(x, z) - 0.2, z, s: r.range(0.4, 1.6), ry: r.range(0, 6.28), rx: r.signed() * 0.3 };
  } });
  const pebble = rockGeometry(rng, { radius: 0.18, detail: 1, roughness: 0.35, squash: 0.55, colors: ['#6a645a', '#a39b8c'] });
  instanced(ctx, { geometry: pebble, material: vcRock, count: 240, castShadow: false, place: (r) => {
    const d = r.range(0, board.length);
    const s = board.sample(d);
    const side = r.float() < 0.5 ? -1 : 1;
    const off = side * r.range(1.0, 1.5);
    const x = s.x + Math.cos(s.heading) * off;
    const z = s.z - Math.sin(s.heading) * off;
    const c = cellAt(x, z);
    if (c && board.at(c[0], c[1]) === '.' && Math.hypot(x - board.toWorld(...c).x, z - board.toWorld(...c).z) < 0.7) return null;
    return { x, y: heightAt(x, z) - 0.02, z, s: r.range(0.6, 1.8), ry: r.range(0, 6.28) };
  } });

  // shrubs, some flowering, near the road and around the board's edge
  const shrub = shrubGeometry(rng, { radius: 0.6 });
  const shrubF = shrubGeometry(rng, { radius: 0.55, flowers: '#e8c9e0' });
  for (const g of [shrub, shrubF]) {
    instanced(ctx, { geometry: g, material: vcLeaf, count: 60, place: (r) => {
      const x = r.range(-halfW - 6, halfW + 6);
      const z = r.range(-halfD - 4, halfD + 4);
      const dp = dPath(x, z);
      if (dp < 1.2 || nearSpecial(x, z, 0)) return null;
      const c = cellAt(x, z);
      // on buildable cells only near the corners, so towers have room
      if (c && board.at(c[0], c[1]) === '.') {
        const w = board.toWorld(...c);
        if (Math.max(Math.abs(x - w.x), Math.abs(z - w.z)) < 0.72) return null;
      }
      return { x, y: heightAt(x, z) - 0.05, z, s: r.range(0.5, 1.0), ry: r.range(0, 6.28) };
    } });
  }

  // grass everywhere but the road
  const grass = grassField(ctx, {
    count: ctx.config.q.grass,
    heightAt,
    clump: { blades: 9, height: 0.36, width: 0.034, spread: 0.2, base: '#1f2e10', tip: '#9cae52' },
    where: (r) => {
      const x = r.range(-halfW - 4, halfW + 4);
      const z = r.range(-halfD - 3, halfD + 3);
      if (dPath(x, z) < 1.15 || nearSpecial(x, z, -1.5)) return null;
      const y = heightAt(x, z);
      if (y > 3.5) return null;
      // thinner grass where the ground is dry
      if (n2(x, z, 22, 4, 11) > 0.55 && r.float() < 0.5) return null;
      return [x, z];
    },
    tintAt: (x, z, c) => {
      const dry = smooth(0.45, 0.62, n2(x, z, 22, 4, 11));
      c.setRGB(1 + dry * 0.35, 1 + dry * 0.1, 1 - dry * 0.25);
    },
  });
  update.push(grass.update);

  // wooden posts with lanterns along the road
  const lanterns = buildLanterns(ctx, board, heightAt, rng);
  update.push(lanterns.update);

  const gateObj = buildGate(ctx, gate, heightAt, board);
  update.push(gateObj.update);
  const shrineObj = buildShrine(ctx, shrine, heightAt);
  update.push(shrineObj.update);

  // fireflies over the meadow, violet dust at the gate
  const flies = motes(ctx, { count: ctx.config.quality === 'low' ? 60 : 160, area: [halfW + 4, halfD + 2], height: 2.2, base: 0.3, color: '#ffe39a', size: 0.16, drift: [0.12, 0.02, 0.05], opacity: 0.9 });
  update.push(flies.update);

  return {
    board,
    heightAt,
    terrain,
    gate,
    shrine,
    shrineLight: shrineObj.light,
    update: (dt) => { for (const u of update) u(dt); },
  };
}

function buildLanterns(ctx, board, heightAt, rng) {
  const lib = ctx.get('materials');
  const wood = lib.get('wood', { tint: 0x8a6a4c, scale: 0.6 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2826', metalness: 0.8, roughness: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(3.5), toneMapped: false });
  const posts = [];
  const at = [0.16, 0.3, 0.47, 0.6, 0.76, 0.9];
  for (const k of at) {
    const s = board.sample(board.length * k);
    const side = posts.length % 2 ? 1 : -1;
    const x = s.x + Math.cos(s.heading) * side * 1.15;
    const z = s.z - Math.sin(s.heading) * side * 1.15;
    posts.push({ x, z, y: heightAt(x, z) });
  }
  const postGeo = new THREE.BoxGeometry(0.12, 1.6, 0.12);
  postGeo.translate(0, 0.8, 0);
  const armGeo = new THREE.BoxGeometry(0.42, 0.07, 0.07);
  armGeo.translate(0.18, 1.5, 0);
  const cageGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.24, 6, 1, true);
  cageGeo.translate(0.36, 1.3, 0);
  const lampGeo = new THREE.SphereGeometry(0.07, 8, 6);
  lampGeo.translate(0.36, 1.3, 0);
  const place = (r, i) => (i < posts.length ? { x: posts[i].x, y: posts[i].y - 0.05, z: posts[i].z, ry: r.range(0, 6.28) } : null);
  instanced(ctx, { geometry: mergeGeometries([postGeo, armGeo]), material: wood, count: posts.length, place });
  instanced(ctx, { geometry: cageGeo, material: iron, count: posts.length, place });
  instanced(ctx, { geometry: lampGeo, material: glow, count: posts.length, place, castShadow: false });
  return { update: () => {} };
}

/** A ruined stone gate the beetles crawl out of, with violet murk inside. */
function buildGate(ctx, gate, heightAt, board) {
  const lib = ctx.get('materials');
  const stone = lib.get('concrete', { tint: 0xb4aa9c, scale: 1.4 });
  const block = lib.get('brick', { tint: 0x9e958c, scale: 1.0 });
  const root = new THREE.Group();
  const y = heightAt(gate.x, gate.z);
  root.position.set(gate.x, y - 0.1, gate.z);
  // the path heads +x out of the gate on this map; face the gate along the path
  const s = board.sample(0.5);
  root.rotation.y = s.heading - Math.PI / 2;
  const m = (geo, mat, pos, rot = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(...pos);
    o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
    return o;
  };
  for (const side of [-1, 1]) {
    m(new THREE.BoxGeometry(0.9, 3.4, 0.9), block, [0, 1.7, side * 1.6]);
    m(new THREE.BoxGeometry(1.1, 0.3, 1.1), stone, [0, 3.5, side * 1.6]);
    m(new THREE.BoxGeometry(1.2, 0.5, 1.2), stone, [0, 0.25, side * 1.6]);
  }
  // a cracked lintel, one end fallen
  m(new THREE.BoxGeometry(0.8, 0.55, 2.4), stone, [0, 3.85, -0.5], [0.12, 0, 0.0]);
  m(new THREE.BoxGeometry(0.8, 0.5, 1.2), stone, [1.3, 0.3, 2.6], [0.3, 0.6, 0.2]);
  const murk = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: { time: { value: 0 }, pulse: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float time, pulse; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vUv * vec2(3.0, 4.0);
          float s = n(p + vec2(0.0, -time * 0.4)) * 0.6 + n(p * 2.1 + vec2(time * 0.2, -time * 0.7)) * 0.4;
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(1.0, 0.7, vUv.y);
          vec3 c = mix(vec3(0.05, 0.02, 0.09), vec3(0.55, 0.28, 1.0), s * s) * (1.0 + pulse * 2.0);
          gl_FragColor = vec4(c, edge * (0.55 + 0.35 * s));
        }`,
    }),
  );
  murk.position.set(-0.05, 1.7, 0);
  murk.rotation.y = Math.PI / 2;
  root.add(murk);
  ctx.scene.add(root);
  const dust = motes(ctx, { count: 50, area: [1.6, 1.6], height: 3, base: y, color: '#b98aff', size: 0.12, drift: [0.4, 0.15, 0], opacity: 0.8 });
  dust.points.position.set(gate.x, 0, gate.z);
  let pulse = 0;
  ctx.events.on('wave:start', () => { pulse = 1; });
  return {
    update: (dt) => {
      murk.material.uniforms.time.value += ctx.config.deterministic ? 0 : dt;
      pulse = Math.max(0, pulse - dt * 0.6);
      murk.material.uniforms.pulse.value = pulse;
      dust.update(dt);
    },
  };
}

/** The shrine at the end of the road: steps, four columns and the lamp. */
function buildShrine(ctx, shrine, heightAt) {
  const lib = ctx.get('materials');
  const stone = lib.get('concrete', { tint: 0xe2d8c6, scale: 1.4 });
  const block = lib.get('brick', { tint: 0xc0b6aa, scale: 1.0 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#a8743a', metalness: 1, roughness: 0.32 });
  const root = new THREE.Group();
  const y = heightAt(shrine.x, shrine.z);
  root.position.set(shrine.x + 1.2, y - 0.15, shrine.z);
  const m = (geo, mat, pos, rot = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(...pos);
    o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
    return o;
  };
  m(new THREE.CylinderGeometry(2.6, 2.8, 0.35, 12), stone, [0, 0.17, 0]);
  m(new THREE.CylinderGeometry(2.1, 2.2, 0.3, 12), stone, [0, 0.48, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    m(new THREE.CylinderGeometry(0.2, 0.24, 2.8, 8), block, [Math.cos(a) * 1.45, 2.0, Math.sin(a) * 1.45]);
  }
  m(new THREE.CylinderGeometry(1.95, 1.95, 0.25, 12), stone, [0, 3.5, 0]);
  m(new THREE.ConeGeometry(2.2, 1.1, 12), bronze, [0, 4.15, 0]);
  m(new THREE.CylinderGeometry(0.4, 0.5, 1.1, 8), stone, [0, 1.15, 0]);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf7a').multiplyScalar(5), toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), lampMat);
  lamp.position.set(0, 2.15, 0);
  root.add(lamp);
  const cage = m(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: '#3a2d1e', metalness: 0.9, roughness: 0.4, wireframe: true }), [0, 2.15, 0]);
  cage.castShadow = false;
  const light = new THREE.PointLight('#ffb867', 30, 16, 1.6);
  light.position.set(0, 2.2, 0);
  root.add(light);
  ctx.scene.add(root);
  const sparks = motes(ctx, { count: 40, area: [1.2, 1.2], height: 3.2, base: y + 1.6, color: '#ffd08a', size: 0.1, drift: [0, 0.35, 0], opacity: 0.9 });
  sparks.points.position.set(shrine.x + 1.2, 0, shrine.z);
  let t = 0;
  let hurt = 0;
  ctx.events.on('enemy:leaked', () => { hurt = 1; });
  return {
    light,
    update: (dt) => {
      t += ctx.config.deterministic ? 0 : dt;
      hurt = Math.max(0, hurt - dt * 1.5);
      const d = ctx.get('defense');
      const health = d.lives / d.economy.lives;
      const flicker = 1 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 17.1) * 0.03;
      light.intensity = (10 + 22 * health) * flicker * (1 - hurt * 0.7);
      lampMat.color.setRGB(5 * flicker * (0.4 + 0.6 * health), 4.0 * flicker * (0.35 + 0.65 * health), 2.4 * (0.3 + 0.7 * health));
      lamp.rotation.y += dt * 0.3;
      cage.rotation.y -= dt * 0.2;
      sparks.update(dt);
    },
  };
}
