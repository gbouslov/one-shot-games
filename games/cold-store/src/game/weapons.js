import { Assembly, heldItem } from '../kit/viewmodel/index.js';

/**
 * The loadout, all on the kit's coded gloved hands (both hands on every firearm):
 *   smg      compact 9 mm with a 3x magnifying optic (kit scope: the lens renders a zoomed
 *            view) and a weapon light on the rail (world.js hangs the light on it)
 *   pistol   the guard's service pistol
 *   machete  the scanned machete (CC0), one hand; empty body, the scan is attached in world.js
 */
function machete() {
  return heldItem({
    id: 'machete',
    body: new Assembly('machete'),
    tip: [0, 0.6, -0.08],
    gripR: { pos: [0.022, -0.005, 0.085], finger: [0, -0.12, -0.99], back: [1, 0.05, 0] },
    gripL: null,
    rhandPose: 'grip',
  });
}

export const weapons = [
  {
    id: 'smg', name: 'Compact', hudName: 'KV-9 Compact', hudTag: 'LIGHT', calibre: '9×19', silhouette: 'smg',
    kind: 'hitscan', auto: true,
    damage: 22, rate: 13, magazine: 32, reserve: 256, reload: 1.85,
    spread: 0.012, range: 160, headMultiplier: 2.2,
    recoil: { pitch: 0.008, yaw: 0.005, kick: 1.15 },
    sound: ['shot', { profile: 'medium' }],
    flashColor: '#ffc680', flashIntensity: 28,
    tracer: { color: '#ffd9a0', width: 0.014, life: 0.05 },
    model: 'compact', handling: 'compact',
    scope: { zoom: 3, res: 384 },
  },
  {
    id: 'pistol', name: 'Pistol', hudName: 'P-12 Service', calibre: '9×19', silhouette: 'pistol',
    kind: 'hitscan', auto: false,
    damage: 38, rate: 5, magazine: 15, reserve: 60, reload: 1.5,
    spread: 0.008, range: 120, headMultiplier: 2.5,
    recoil: { pitch: 0.014, yaw: 0.004, kick: 1.4 },
    sound: ['shot', { profile: 'light' }],
    flashColor: '#ffc680', flashIntensity: 22,
    tracer: { color: '#ffd9a0', width: 0.012, life: 0.05 },
    model: 'sidearm', handling: 'sidearm',
  },
  {
    id: 'machete', name: 'Machete', hudMode: 'MELEE', silhouette: 'blade', kind: 'melee', auto: true,
    damage: 75, rate: 2.2, magazine: 0, range: 2.7, arc: 1.4, delay: 0.15, swing: 0.44,
    recoil: { pitch: 0.012, yaw: 0.014, kick: 0.25 },
    sound: ['swing', {}],
    impact: { color: '#ffe6c0', count: 8 },
    model: machete,
    handling: 'onehand',
  },
];
