import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { part, shapes as S } from '../kit/actors/rig.js';

/**
 * What climbs out of the fen. Four kinds and one old thing at the end, each a
 * single merged body with baked colours (one instanced draw for all of a kind)
 * and a separate glowing part (eyes, a lamp-core) the bloom picks up.
 *
 * Numbers: hp, speed (m/s), radius (m), damage per touch, xp (the gem it leaves),
 * mass (resists shoves), max (how many may be out at once), fly (height).
 */

/** Push each vertex out along its normal by a little smooth noise: peat, not plastic. */
function lumpy(geo, amount, seed = 1) {
  // displace the indexed shape along its own smooth normals; noise is a function
  // of position, so seam vertices move together and nothing cracks
  const g = geo;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = Math.sin(x * 7.1 + seed) * Math.sin(y * 6.3 + seed * 1.7) * Math.sin(z * 8.2 + seed * 2.3)
      + 0.5 * Math.sin(x * 15 + y * 13 + seed * 3.1);
    p.setXYZ(i, x + n.getX(i) * k * amount, y + n.getY(i) * k * amount, z + n.getZ(i) * k * amount);
  }
  g.computeVertexNormals();
  return g;
}

const body = (parts) => mergeGeometries(parts, false);
const eyes = (x, y, z, r = 0.045) => [part(S.sphere(r, 6, 5), '#ffffff', { pos: [-x, y, z] }), part(S.sphere(r, 6, 5), '#ffffff', { pos: [x, y, z] })];

export const enemies = [
  {
    // a knee-high clot of wet peat with two pale-green eyes; they come in hundreds
    id: 'mireling',
    name: 'Mireling',
    hp: 10,
    speed: 2.1,
    radius: 0.42,
    damage: 6,
    xp: 1,
    mass: 1,
    max: 220,
    height: 0.95,
    scale: [0.85, 1.15],
    blood: '#2a2015',
    glow: '#c9ff7a',
    glowIntensity: 3.2,
    rim: '#6f8296',
    rimStrength: 0.4,
    gait: 4,
    waddle: 0.14,
    squash: 0.07,
    body: (THREE, rng) => ({
      roughness: 0.38,
      geometry: body([
        part(lumpy(S.sphere(0.42, 14, 10), 0.06, 2), '#2b2119', { pos: [0, 0.44, 0], scale: [1, 1.12, 0.95] }),
        part(lumpy(S.sphere(0.24, 10, 8), 0.04, 5), '#382b20', { pos: [0, 0.86, 0.12] }),
        part(S.cone(0.09, 0.3, 5), '#46512f', { pos: [0.22, 0.3, 0.18], rot: [Math.PI, 0, 0.4] }),
        part(S.cone(0.07, 0.24, 5), '#46512f', { pos: [-0.25, 0.36, 0.1], rot: [Math.PI, 0, -0.3] }),
        part(S.sphere(0.16, 8, 6), '#4b5833', { pos: [0.1, 0.78, -0.16], scale: [1.4, 0.6, 1] }),
        part(S.cone(0.1, 0.32, 5), '#1f1813', { pos: [0.24, 0.1, 0], rot: [0, 0, -2.2] }),
        part(S.cone(0.1, 0.32, 5), '#1f1813', { pos: [-0.24, 0.1, 0], rot: [0, 0, 2.2] }),
        part(S.cone(0.1, 0.3, 5), '#1f1813', { pos: [0, 0.1, -0.26], rot: [-2.2, 0, 0] }),
      ]),
      glow: body(eyes(0.085, 0.9, 0.31)),
    }),
  },
  {
    // a pale, long-legged scuttler of bone and bark; fast, fragile, comes sideways
    id: 'skitter',
    name: 'Skitter',
    hp: 6,
    speed: 4.3,
    radius: 0.4,
    damage: 5,
    xp: 1,
    mass: 0.6,
    max: 90,
    height: 0.5,
    scale: [0.9, 1.1],
    blood: '#3a3328',
    glow: '#ff6a3c',
    glowIntensity: 4,
    gait: 7,
    bob: 0.04,
    waddle: 0.06,
    wobble: 0.55,
    turn: 12,
    body: (THREE, rng) => {
      const parts = [
        part(lumpy(S.sphere(0.32, 12, 8), 0.03, 7), '#b9ae98', { pos: [0, 0.36, -0.05], scale: [1, 0.45, 1.45] }),
        part(S.sphere(0.16, 10, 8), '#a39883', { pos: [0, 0.36, 0.42], scale: [1.1, 0.7, 1] }),
        part(S.box(0.5, 0.04, 0.08), '#8f846f', { pos: [0, 0.48, -0.1] }),
        part(S.box(0.4, 0.04, 0.08), '#8f846f', { pos: [0, 0.47, -0.3] }),
      ];
      // six legs: up and out from the body, then down to the mud
      for (const side of [-1, 1]) {
        for (const [i, z] of [0.25, -0.05, -0.35].entries()) {
          const splay = 0.5 + i * 0.15;
          parts.push(part(S.cyl(0.03, 0.025, 0.5, 5), '#cfc4ad', { pos: [side * 0.38, 0.5, z], rot: [0, 0, side * -0.9 * splay - side * 0.3] }));
          parts.push(part(S.cyl(0.025, 0.012, 0.55, 5), '#7c725f', { pos: [side * 0.68, 0.28, z + 0.04], rot: [0, 0, side * 0.35] }));
        }
      }
      return { roughness: 0.5, geometry: body(parts), glow: body([...eyes(0.06, 0.42, 0.55, 0.03), ...eyes(0.11, 0.39, 0.5, 0.022)]) };
    },
  },
  {
    // a moth the size of a dog, wings like wet sacking, carrying a cold light under it
    id: 'wisp',
    name: 'Lampmoth',
    hp: 8,
    speed: 3.3,
    radius: 0.38,
    damage: 7,
    xp: 2,
    mass: 0.5,
    max: 60,
    height: 0.6,
    fly: 1.25,
    scale: [0.9, 1.1],
    blood: '#2b3440',
    glow: '#8fdcff',
    glowIntensity: 3.6,
    gait: 2,
    bob: 0,
    waddle: 0.35,
    squash: 0.12,
    wobble: 0.9,
    body: (THREE, rng) => ({
      roughness: 0.7,
      geometry: body([
        part(S.capsule(0.12, 0.35), '#2a2a2c', { pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0] }),
        part(lumpy(S.sphere(0.5, 10, 6), 0.03, 3), '#4b4a44', { pos: [0.42, 0.16, -0.05], scale: [1, 0.06, 0.62], rot: [0, 0.35, 0.2] }),
        part(lumpy(S.sphere(0.5, 10, 6), 0.03, 4), '#4b4a44', { pos: [-0.42, 0.16, -0.05], scale: [1, 0.06, 0.62], rot: [0, -0.35, -0.2] }),
        part(S.box(0.02, 0.02, 0.3), '#1a1a1a', { pos: [0.06, 0.18, 0.4], rot: [0.4, 0.3, 0] }),
        part(S.box(0.02, 0.02, 0.3), '#1a1a1a', { pos: [-0.06, 0.18, 0.4], rot: [0.4, -0.3, 0] }),
      ]),
      glow: body([part(S.sphere(0.13, 10, 8), '#ffffff', { pos: [0, -0.12, -0.05] }), ...eyes(0.05, 0.16, 0.25, 0.025)]),
    }),
  },
  {
    // a peat-giant, twice your height, roots for arms and a split glowing in its chest
    id: 'bogman',
    name: 'Peat Giant',
    hp: 80,
    speed: 1.35,
    radius: 0.78,
    damage: 14,
    xp: 6,
    mass: 3.5,
    max: 24,
    height: 2.3,
    scale: [0.95, 1.1],
    blood: '#1d1610',
    glow: '#ffae4a',
    glowIntensity: 4,
    rim: '#6f8296',
    rimStrength: 0.4,
    gait: 1.6,
    bob: 0.09,
    waddle: 0.1,
    turn: 4,
    body: (THREE, rng) => ({
      roughness: 0.42,
      geometry: body([
        part(lumpy(S.capsule(0.2, 0.6), 0.04, 1), '#231b14', { pos: [-0.28, 0.48, 0] }),
        part(lumpy(S.capsule(0.2, 0.6), 0.04, 2), '#231b14', { pos: [0.28, 0.48, 0] }),
        part(lumpy(S.sphere(0.62, 14, 10), 0.09, 3), '#2a2018', { pos: [0, 1.35, 0.05], scale: [1.05, 1.05, 0.85] }),
        part(lumpy(S.sphere(0.4, 12, 8), 0.06, 4), '#3e4a2a', { pos: [0, 1.82, -0.12], scale: [1.4, 0.55, 1] }),
        part(lumpy(S.sphere(0.24, 10, 8), 0.04, 6), '#2f251b', { pos: [0, 1.95, 0.35] }),
        part(lumpy(S.capsule(0.13, 0.95), 0.05, 7), '#2a2018', { pos: [-0.72, 1.05, 0.15], rot: [0.25, 0, 0.18] }),
        part(lumpy(S.capsule(0.13, 0.95), 0.05, 8), '#2a2018', { pos: [0.72, 1.05, 0.15], rot: [0.25, 0, -0.18] }),
        part(S.cone(0.08, 0.5, 5), '#1a140f', { pos: [-0.78, 0.36, 0.3], rot: [Math.PI, 0, 0.2] }),
        part(S.cone(0.08, 0.5, 5), '#1a140f', { pos: [0.78, 0.36, 0.3], rot: [Math.PI, 0, -0.2] }),
        part(S.cone(0.05, 0.4, 4), '#4b5833', { pos: [0.3, 1.7, -0.3], rot: [0.6, 0, 0.5] }),
        part(S.cone(0.05, 0.36, 4), '#4b5833', { pos: [-0.25, 1.72, -0.32], rot: [0.7, 0, -0.4] }),
      ]),
      glow: body([
        ...eyes(0.09, 1.98, 0.56, 0.05),
        part(S.sphere(0.07, 6, 5), '#fff', { pos: [0.05, 1.5, 0.55], scale: [0.6, 2.2, 0.6] }),
        part(S.sphere(0.06, 6, 5), '#fff', { pos: [-0.04, 1.25, 0.58], scale: [0.6, 2, 0.6] }),
        part(S.sphere(0.05, 6, 5), '#fff', { pos: [0.1, 1.05, 0.56], scale: [0.6, 1.6, 0.6] }),
      ]),
    }),
  },
  {
    // the mini-boss: a stag of bog-oak and bone, antlers wider than a cart, that lowers its head and runs you down
    id: 'hart',
    name: 'The Fen Hart',
    boss: true,
    hp: 1400,
    speed: 2.1,
    radius: 1.5,
    damage: 22,
    xp: 40,
    mass: 14,
    max: 1,
    height: 3.2,
    scale: [1, 1],
    blood: '#211910',
    glow: '#b6ffd8',
    glowIntensity: 4.5,
    rim: '#7f93a8',
    rimStrength: 0.45,
    gait: 1.3,
    bob: 0.12,
    waddle: 0.05,
    turn: 3,
    touchCooldown: 0.9,
    charge: { every: 5.5, windup: 1.0, time: 1.1, speed: 10 },
    body: (THREE, rng) => {
      const bone = '#d4c8ae';
      const hide = '#2a2219';
      const moss = '#3f4b2a';
      const parts = [
        part(lumpy(S.sphere(1, 16, 12), 0.08, 9), hide, { pos: [0, 2.0, -0.1], scale: [0.85, 0.78, 1.6] }),
        part(lumpy(S.sphere(0.7, 12, 8), 0.06, 10), moss, { pos: [0, 2.6, -0.3], scale: [1.1, 0.4, 1.6] }),
        part(S.cyl(0.32, 0.42, 1.3, 8), hide, { pos: [0, 2.7, 1.25], rot: [0.85, 0, 0] }),
        part(lumpy(S.sphere(0.42, 12, 8), 0.04, 11), '#3a2f24', { pos: [0, 3.25, 1.85], scale: [0.8, 0.85, 1.5] }),
        part(S.cone(0.2, 0.5, 6), '#1e1813', { pos: [0, 3.05, 2.45], rot: [Math.PI / 2 + 0.3, 0, 0] }),
      ];
      // legs: thick and knotted
      for (const [x, z] of [[-0.55, 1.0], [0.55, 1.0], [-0.55, -1.2], [0.55, -1.2]]) {
        parts.push(part(lumpy(S.cyl(0.17, 0.12, 1.5, 7), 0.03, x + z), hide, { pos: [x, 0.95, z] }));
        parts.push(part(S.cyl(0.13, 0.16, 0.25, 7), '#14100c', { pos: [x, 0.12, z + 0.05] }));
      }
      // antlers: two branching racks of pale bone
      for (const side of [-1, 1]) {
        const base = [side * 0.22, 3.55, 1.75];
        parts.push(part(S.cyl(0.07, 0.1, 1.2, 6), bone, { pos: [base[0] + side * 0.35, base[1] + 0.45, base[2] - 0.1], rot: [-0.3, 0, side * -0.75] }));
        parts.push(part(S.cyl(0.05, 0.07, 1.1, 6), bone, { pos: [base[0] + side * 1.05, base[1] + 0.95, base[2] - 0.3], rot: [-0.2, 0, side * -1.2] }));
        parts.push(part(S.cyl(0.03, 0.05, 0.8, 5), bone, { pos: [base[0] + side * 0.55, base[1] + 1.15, base[2] - 0.05], rot: [0.2, 0, side * -0.15] }));
        parts.push(part(S.cyl(0.03, 0.05, 0.75, 5), bone, { pos: [base[0] + side * 1.35, base[1] + 1.45, base[2] - 0.4], rot: [-0.3, 0, side * -0.35] }));
        parts.push(part(S.cyl(0.025, 0.04, 0.6, 5), bone, { pos: [base[0] + side * 1.75, base[1] + 1.1, base[2] - 0.5], rot: [0, 0, side * -1.6] }));
        parts.push(part(S.cyl(0.025, 0.04, 0.55, 5), bone, { pos: [base[0] + side * 0.95, base[1] + 0.35, base[2] + 0.3], rot: [1.1, 0, side * -0.5] }));
        // moss hanging off the rack
        parts.push(part(S.cone(0.06, 0.5, 4), moss, { pos: [base[0] + side * 1.1, base[1] + 0.6, base[2] - 0.3], rot: [Math.PI, 0, 0] }));
      }
      // ribs showing through the hide
      for (let i = 0; i < 4; i++) {
        for (const side of [-1, 1]) parts.push(part(S.box(0.06, 0.7, 0.12), bone, { pos: [side * 0.8, 2.0, -0.6 + i * 0.4], rot: [0, 0, side * 0.25] }));
      }
      const glow = [...eyes(0.24, 3.35, 2.25, 0.07)];
      for (let i = 0; i < 3; i++) for (const side of [-1, 1]) glow.push(part(S.sphere(0.06, 6, 5), '#fff', { pos: [side * 0.82, 2.0, -0.4 + i * 0.4], scale: [0.5, 1.8, 0.5] }));
      return { roughness: 0.5, geometry: body(parts), glow: body(glow) };
    },
  },
];
