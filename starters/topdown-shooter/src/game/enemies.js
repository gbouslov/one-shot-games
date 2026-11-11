import { humanoid } from '../kit/actors/rig.js';

/**
 * What comes over the fence. The Hollows: grey, rain-soaked, with eyes that
 * glow a cold teal the lamps never warm. Three kinds, so a wave has a shape:
 * a crowd that walks, a few that sprint, one big enough to stop you.
 *
 * Numbers: hp, speed (m/s), radius (m), damage per hit, reach past touching (m),
 * windup before a hit lands (s), cooldown after (s), score, mass (resists shoves).
 */
const RAGS = ['#3a3f45', '#463f37', '#2f3833', '#4b4440', '#353a4a', '#514a42'];
const EYES = '#5ff2d8';

const HAIR = ['#1d1a17', '#2e2620', '#3d3a36', '#151515'];

function eyes(y = 0.11, spread = 0.055, z = 0.13) {
  return [{ seg: 'head', pos: [-spread, y, z], r: 0.026 }, { seg: 'head', pos: [spread, y, z], r: 0.026 }];
}

/** Small glowing nodules on the shoulders and back: they read from above. */
function growths(rng, n) {
  const out = [];
  const side = rng.float() < 0.5 ? -1 : 1;
  for (let i = 0; i < n; i++) out.push({ seg: 'upper', pos: [side * rng.range(0.12, 0.26), rng.range(0.5, 0.66), rng.range(-0.18, 0.02)], r: rng.range(0.025, 0.045) });
  return out;
}

export const enemies = [
  {
    id: 'walker',
    hp: 60,
    speed: 2.3,
    radius: 0.42,
    damage: 12,
    reach: 0.45,
    windup: 0.42,
    cooldown: 0.9,
    score: 100,
    mass: 1,
    height: 1.75,
    blood: '#2b1414',
    spark: '#7ff7e2',
    glow: '#5ff2d8',
    prewarm: 12,
    reachPose: 0.55,
    rig: (rng) => humanoid(rng, {
      height: rng.range(1.66, 1.86),
      build: rng.range(0.86, 1.05),
      hunch: rng.range(0.25, 0.5),
      head: rng.float() < 0.4 ? 'hood' : 'bare',
      colors: { skin: rng.pick(['#8d9590', '#9a9a8c', '#7f8a86']), top: rng.pick(RAGS), bottom: '#23262a', boots: '#18181a', accent: rng.pick(RAGS) },
      glow: [...eyes(), ...growths(rng, 2)],
      glowColor: EYES,
      glowIntensity: 4,
      roughness: 0.62,
      gear: (add, s, c) => {
        // matted hair or a torn collar, so heads differ from above
        if (rng.float() < 0.6) add('head', s.dome(0.158, 0.5), rng.pick(HAIR), { pos: [0, 0.13, -0.01] });
        add('upper', s.box(0.5, 0.12, 0.34), c.top, { pos: [0, 0.6, -0.02], rot: [0.2, 0, rng.signed() * 0.2] });
        // a fungal crust over one shoulder
        const side = rng.float() < 0.5 ? -1 : 1;
        add('upper', s.sphere(0.12, 8, 6), '#4d5a55', { pos: [0.2 * side, 0.6, -0.06], scale: [1.2, 0.7, 1.1] });
      },
    }),
  },
  {
    id: 'runner',
    hp: 30,
    speed: 5.1,
    radius: 0.36,
    damage: 8,
    reach: 0.4,
    windup: 0.26,
    cooldown: 0.7,
    score: 150,
    mass: 0.7,
    height: 1.5,
    gait: 2.0,
    turn: 10,
    blood: '#2b1414',
    spark: '#7ff7e2',
    glow: '#5ff2d8',
    prewarm: 8,
    reachPose: 0.2,
    rig: (rng) => humanoid(rng, {
      height: rng.range(1.55, 1.7),
      build: 0.82,
      hunch: 0.85,
      head: 'bare',
      colors: { skin: '#a3a89e', top: '#2d3236', bottom: '#1f2225', boots: '#141416', accent: '#2d3236' },
      glow: eyes(0.1, 0.05, 0.13),
      glowColor: EYES,
      glowIntensity: 7,
      roughness: 0.55,
    }),
  },
  {
    id: 'brute',
    hp: 340,
    speed: 1.75,
    radius: 0.78,
    damage: 26,
    reach: 0.55,
    windup: 0.62,
    cooldown: 1.3,
    score: 600,
    mass: 3.2,
    height: 2.5,
    gait: 1.6,
    turn: 4,
    blood: '#2b1414',
    spark: '#7ff7e2',
    glow: '#5ff2d8',
    prewarm: 2,
    reachPose: 0.25,
    rig: (rng) => humanoid(rng, {
      height: 2.45,
      build: 1.55,
      hunch: 0.45,
      head: 'bare',
      colors: { skin: '#7a827f', top: '#3d3a36', bottom: '#2a2724', boots: '#1a1918', accent: '#3d3a36' },
      glow: [
        ...eyes(0.11, 0.06, 0.13),
        { seg: 'upper', pos: [0.18, 0.5, 0.24], r: 0.07 },
        { seg: 'upper', pos: [-0.1, 0.3, 0.26], r: 0.05 },
        { seg: 'upper', pos: [0.22, 0.62, -0.16], r: 0.06 },
        { seg: 'armL', pos: [0, -0.3, 0.07], r: 0.045 },
      ],
      glowColor: EYES,
      glowIntensity: 5,
      roughness: 0.6,
      gear: (add, s) => {
        // growths: lumps across the shoulders
        add('upper', s.sphere(0.16, 8, 6), '#5d6662', { pos: [0.22, 0.6, -0.05] });
        add('upper', s.sphere(0.12, 8, 6), '#5d6662', { pos: [-0.2, 0.66, -0.08] });
        add('upper', s.sphere(0.1, 8, 6), '#5d6662', { pos: [0.05, 0.7, -0.15] });
      },
    }),
  },
];
