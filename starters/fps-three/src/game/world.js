import * as THREE from 'three';
import { fbm, surface, surfaceMaterial } from '../kit/textures/textures.js';
import { ramp, rockGeometry, scatter, slab, terrain } from '../kit/world/builders.js';

/**
 * The level. Returns where the player starts, where enemies enter and the area
 * the pathing grid should cover. This default is a sunset basin with standing
 * stones; replace it with your game's place.
 */
const TERRAIN_SIZE = 260;

function groundHeight(x, z) {
  const u = x / TERRAIN_SIZE + 0.5;
  const v = z / TERRAIN_SIZE + 0.5;
  const rolling = (fbm(u, v, 9, 4, 11) - 0.5) * 3.2;
  const d = Math.hypot(x, z);
  const rim = THREE.MathUtils.smoothstep(d, 42, 96) * 8 * fbm(u, v, 5, 3, 3) * 1.6;
  const flat = THREE.MathUtils.smoothstep(d, 7, 16);
  return rolling * flat + rim;
}

export function buildWorld(ctx) {
  const rng = ctx.rng.fork();

  const groundTex = surface(rng, { size: 256, scale: 9, octaves: 5, colors: ['#d8d2c8', '#ffffff'], speckle: 0.25, normal: 0.9, roughness: [0.85, 1], repeat: 90 });
  const groundMat = new THREE.MeshStandardMaterial({ ...groundTex, metalness: 0 });
  const low = new THREE.Color('#6f4f38');
  const high = new THREE.Color('#a57c55');
  const cliff = new THREE.Color('#4d3f39');
  terrain(ctx, {
    size: TERRAIN_SIZE,
    segments: 180,
    height: groundHeight,
    material: groundMat,
    surface: 'dirt',
    colorAt: (x, y, z, ny, out) => {
      const t = THREE.MathUtils.clamp(fbm(x / TERRAIN_SIZE + 0.5, z / TERRAIN_SIZE + 0.5, 10, 3, 5) * 1.5 - 0.25, 0, 1);
      out.copy(low).lerp(high, t);
      if (ny < 0.9) out.lerp(cliff, (0.9 - ny) * 5);
    },
  });

  const stone = surfaceMaterial(rng, { size: 256, scale: 5, octaves: 6, colors: ['#37302c', '#6c5d52', '#8c7c6c'], crack: 0.3, speckle: 0.2, normal: 1.1, roughness: [0.72, 0.98], repeat: 1 });
  const glow = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff9838', emissiveIntensity: 3.2 });

  const standingStones = [
    [-13, -9, 0.3], [11, -14, -0.4], [15, 6, 0.9], [-8, 14, -0.8],
    [-22, 4, 0.2], [24, -5, 1.2], [3, -24, 0.1], [-4, 26, 0.5],
    [-27, -18, -0.5], [28, 17, 0.7],
  ];
  for (const [x, z, rot] of standingStones) {
    const h = rng.range(4.2, 7.2);
    const y = groundHeight(x, z);
    slab(ctx, { pos: [x, y + h / 2 - 0.3, z], size: [rng.range(1.5, 2.4), h, rng.range(1.1, 1.8)], material: stone, rotY: rot, rotZ: rng.signed() * 0.05 });
    const strip = slab(ctx, { pos: [x, y + h * 0.68, z], size: [0.08, 0.9, 0.08], material: glow, rotY: rot, solid: false });
    strip.castShadow = false;
    strip.translateZ(0.72);
    strip.translateX(rng.signed() * 0.3);
  }

  // A raised platform with a ramp up, so verticality exists from the start.
  slab(ctx, { pos: [0, 1.2, -13], size: [9, 2.4, 6], material: stone, surface: 'concrete' });
  ramp(ctx, { pos: [0, 0, -7.2], width: 4.5, length: 5.6, height: 2.42, material: stone, rotY: Math.PI });

  const rocks = rockGeometry(rng, { radius: 1, detail: 2, roughness: 0.3, squash: 0.68 });
  const clearOfCentre = (r) => {
    const x = r.range(-52, 52);
    const z = r.range(-52, 52);
    return Math.hypot(x, z) > 9 ? [x, z] : null;
  };
  scatter(ctx, { geometry: rocks, material: stone, count: 44, where: clearOfCentre, scale: (r) => r.range(0.9, 2.1), sink: 0.25, solid: true });
  scatter(ctx, { geometry: rockGeometry(rng, { radius: 0.28, detail: 1, roughness: 0.3 }), material: stone, count: 220, where: clearOfCentre, scale: (r) => r.range(0.5, 1.6), sink: 0.05, castShadow: false });

  return {
    playerSpawn: [0, groundHeight(0, 6) + 0.2, 6],
    playerYaw: 0,
    enemySpawns: [
      [-30, -24], [30, -22], [-33, 8], [33, 10], [-14, -33], [14, -34], [-24, 28], [24, 30], [0, 34],
    ],
    bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 46, cell: 1, agentRadius: 0.42, agentHeight: 1.7, maxStep: 0.9 },
  };
}
