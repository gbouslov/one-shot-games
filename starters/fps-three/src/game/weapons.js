import * as THREE from 'three';
import { Assembly, box, latheZ, rodZ, extrude, heldItem, ARMS_RIFLE } from '../kit/viewmodel/index.js';
import armsRifle from '../kit/viewmodel/assets/arms-rifle.glb?url';

/**
 * The loadout. Three examples, one of each kind the framework supports:
 *   carbine   rigged animated arms and rifle from a file (kit/viewmodel/asset-arms.js),
 *             hitscan; the coded carbine on `model` is the fallback
 * and two held by the kit's coded gloved hands (kit/viewmodel, from Claude-of-Duty):
 *   pulse     the compact model, firing a slow glowing round that bursts
 *   hatchet   a held item built here from geometry helpers, melee
 * Replace stats, sounds and the held item; see skills/build-from-pieces.
 */

const hot = new THREE.MeshStandardMaterial({ color: '#201008', emissive: '#ff9838', emissiveIntensity: 3 });

function pulseRound() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), hot);
  m.castShadow = false;
  return m;
}

/**
 * A hatchet: ash handle with a leather wrap and a forged head. Item space:
 * origin at the right hand's thumb web, the handle runs down -Y through the
 * fist, the head sits above the hand, the edge faces -Z (away from the player).
 */
function hatchet() {
  const body = new Assembly('hatchet');
  // handle: a slightly swelled shaft along Y (latheZ builds along Z, so turn it)
  // profile pairs are [distance along the shaft, radius]
  const shaft = latheZ([[0, 0], [0.004, 0.0145], [0.12, 0.0158], [0.3, 0.0138], [0.4, 0.0165], [0.44, 0.012], [0.44, 0]], 18);
  body.add(shaft, 'haft', { y: -0.13, rx: -Math.PI / 2 });
  // leather wrap where the fist closes
  for (let i = 0; i < 7; i++) {
    body.add(rodZ(0.0172, 0.0172, 0.014, 18), 'wrap', { y: -0.06 + i * 0.017, rx: Math.PI / 2, ry: i * 0.4 });
  }
  // forged head: a tapered wedge with a bearded edge, eye collar around the haft
  const headShape = [[-0.03, 0.03], [0.02, 0.03], [0.1, 0.06], [0.112, 0.0], [0.1, -0.075], [0.05, -0.02], [-0.03, -0.02]];
  const head = extrude(headShape, 0.018, { bevel: 0.003 });
  body.add(head, 'steel', { y: 0.23, z: 0.005, ry: Math.PI / 2 });
  body.add(box(0.034, 0.05, 0.04, 0.004), 'steel', { y: 0.235, z: 0.01 });
  body.add(box(0.03, 0.03, 0.03, 0.003), 'steel_black', { y: 0.235, z: 0.04 });
  return heldItem({
    id: 'hatchet',
    body,
    tip: [0, 0.24, -0.1],
    // Wrist target ~0.1 m behind the knuckles: the fist closes round the wrap.
    gripR: { pos: [0.022, -0.005, 0.085], finger: [0, -0.12, -0.99], back: [1, 0.05, 0] },
    gripL: null,
    rhandPose: 'grip',
  });
}

export const weapons = [
  {
    id: 'carbine', name: 'AR carbine', kind: 'hitscan', auto: true,
    damage: 22, rate: 9, magazine: 30, reserve: 210, reload: 2.1,
    spread: 0.012, range: 180, headMultiplier: 1.9,
    recoil: { pitch: 0.0085, yaw: 0.0045, kick: 1.2 },
    sound: ['shot', { profile: 'medium' }],
    flashColor: '#ffc680', flashIntensity: 26,
    tracer: { color: '#ffd9a0', width: 0.016, life: 0.06 },
    // Rigged gloved arms and rifle from a file (CC-BY-4.0, credited on the title
    // screen and in NOTICES.md). Delete this line for the coded hands on `model`.
    viewmodel: { arms: 'asset', url: armsRifle, ...ARMS_RIFLE },
    model: 'carbine',
  },
  {
    id: 'pulse', name: 'Pulse', kind: 'projectile', auto: false,
    damage: 40, rate: 1.4, magazine: 6, reserve: 30, reload: 1.85,
    recoil: { pitch: 0.03, yaw: 0.008, kick: 3 },
    sound: ['shot', { profile: 'heavy' }],
    flashColor: '#ffa050', flashIntensity: 40,
    projectile: {
      speed: 30, gravity: -11, radius: 0.12, life: 5, build: pulseRound,
      splash: { radius: 5, damage: 70, color: '#ffae5e' },
      trail: { color: '#ff9e50', size: 0.18 },
    },
    model: 'compact',
  },
  {
    id: 'hatchet', name: 'Hatchet', kind: 'melee', auto: true,
    damage: 55, rate: 2.3, magazine: 0, range: 2.6, arc: 1.4, delay: 0.16, swing: 0.42,
    recoil: { pitch: 0.012, yaw: 0.012, kick: 0.2 },
    sound: ['swing', {}],
    impact: { color: '#ffe0b0', count: 6 },
    model: hatchet,
    handling: 'onehand',
    // Material keys used above: library surface + options (kit/materials/library.js).
    materials: {
      haft: ['wood', { uvMode: 'triplanar', localSpace: true, scale: 0.12, tint: '#8a6a4a' }],
      wrap: ['fabric', { uvMode: 'triplanar', localSpace: true, scale: 0.05, tint: '#4a3426' }],
    },
  },
];
