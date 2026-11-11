import { Assembly, box, latheZ, rodZ, extrude, ring, dome } from '../geometry.js';

/**
 * Primitive held items, written for this repository: a flint spear, a root club and
 * a hatchet, each a `heldItem` the coded hands or the bare asset arms (ARMS_BARE) hold.
 * Use with `model: buildSpear` (or buildClub, buildHatchet) on a weapon definition.
 *
 * Item space: origin at the centre of the right fist, the shaft runs along +Y
 * through it (head or point up +Y), -Z faces away from the player.
 *
 * Each builder registers its surface keys (PRIMITIVE_MATERIALS) unless the game's
 * own `materials` already has that key, so a game can retint any of them.
 */
const LOCAL = { uvMode: 'triplanar', localSpace: true, weather: [0, 0, 0, 0.6], macro: [0.55, 0.05, 0.07, 0.06] };
const MATTE = { cloth: [0, 1, 0, 0], three: { physical: true, sheen: 0.04, sheenRoughness: 0.95, sheenColor: 0x1a120c, specularIntensity: 0.14 } };

export const PRIMITIVE_MATERIALS = {
  haft: ['wood', { ...LOCAL, scale: 0.4, tint: '#7a5a3e' }],
  haft_dark: ['wood', { ...LOCAL, scale: 0.4, tint: '#4a3424' }],
  flint: ['concrete', { ...LOCAL, scale: 0.035, tint: '#3c3a42', roughness: [0.42, 0.08, 0.3] }],
  sinew: ['fabric', { ...LOCAL, ...MATTE, scale: 0.012, tint: '#8a7658' }],
  hide: ['fabric', { ...LOCAL, ...MATTE, scale: 0.03, tint: '#3e2818' }],
  ochre: ['fabric', { ...LOCAL, ...MATTE, scale: 0.02, tint: '#6a2210' }],
  bone: ['plaster', { ...LOCAL, scale: 0.03, tint: '#8a8272' }],
};

/** Sinew lashing: crossed turns around a shaft along Y between y0 and y1. */
function lash(body, y0, y1, r, mat = 'sinew', turns = 7) {
  for (let i = 0; i < turns; i++) {
    const t = i / (turns - 1);
    const tilt = (i % 2 ? 1 : -1) * 0.22;
    body.add(ring(r, 0.0024, 16, 5), mat, { y: y0 + (y1 - y0) * t, rz: i * 0.7, ry: ((i % 3) - 1) * 0.12, rx: Math.PI / 2 + tilt });
  }
}

/** A hide wrap where a fist closes: overlapping bands with a tied-off tail. */
function gripWrap(body, r, y0, n = 8) {
  for (let i = 0; i < n; i++) {
    body.add(rodZ(r + 0.0032, r + 0.0026, 0.016, 16), 'hide', { y: y0 + i * 0.0165, rz: i * 0.5, ry: (i % 2 ? 0.06 : -0.06), rx: Math.PI / 2 });
  }
  body.add(box(0.008, 0.07, 0.003, 0.001), 'hide', { x: r + 0.004, y: y0 - 0.03, z: 0.006, rz: 0.12 });
}

/** A knapped flint leaf: two crossed bevelled plates read as a faceted point. */
function flintLeaf(len, width, thick) {
  const pts = [[0, 0], [width * 0.45, len * 0.12], [width * 0.5, len * 0.32], [width * 0.36, len * 0.6], [width * 0.14, len * 0.88], [0, len], [-width * 0.15, len * 0.86], [-width * 0.38, len * 0.58], [-width * 0.5, len * 0.3], [-width * 0.42, len * 0.1]];
  return extrude(pts, thick, { bevel: thick * 0.42, bevelSegments: 1 });
}

/** Register the surfaces above on the weapon materials, unless the game already has the key. */
function surfaces(mats) {
  if (!mats?.register) return;
  for (const [k, def] of Object.entries(PRIMITIVE_MATERIALS)) {
    if (!mats.extraDefs?.[k] && !mats.cache?.has(k)) mats.register(k, def);
  }
}

const item = (id, body, tip, gripL = null) => ({
  id, label: id, body, moving: {}, rhandPose: 'grip', lhandPose: 'clamp',
  nodes: { muzzle: tip, sight: [0, 0.06, 0], gripR: { pos: [0.022, -0.005, 0.085], finger: [0, -0.12, -0.99], back: [1, 0.05, 0] }, gripL },
});

/** Ash spear, 1.6 m: a flint leaf point bound with sinew 0.66 m above the fist. */
export function buildSpear(ctx, mats) {
  surfaces(mats);
  const body = new Assembly('spear');
  const r = 0.0165;
  const H = 0.66;
  body.add(latheZ([[0, 0], [0.006, 0.013], [0.4, 0.0152], [1.0, r], [1.45, 0.0158], [1.56, 0.0146], [1.58, 0]], 18), 'haft', { y: H - 1.58, rx: -Math.PI / 2 });
  for (const [y, s, a] of [[0.27, 1.12, 0.3], [0.47, 1.05, 2.6], [-0.26, 1.12, 1.2], [-0.5, 1.1, 4]]) body.add(dome(r * s * 0.8, 10, 0.5), 'haft_dark', { y, x: Math.cos(a) * r * 0.5, z: Math.sin(a) * r * 0.5, ry: Math.PI / 2 - a });
  gripWrap(body, r, -0.07);
  body.add(rodZ(r + 0.0008, r + 0.0008, 0.022, 18), 'ochre', { y: 0.12, rx: Math.PI / 2 });
  body.add(rodZ(r + 0.0008, r + 0.0008, 0.009, 18), 'ochre', { y: 0.16, rx: Math.PI / 2 });
  body.add(latheZ([[0, 0.0152], [0.05, 0.021], [0.1, 0.019], [0.125, 0.012], [0.128, 0]], 16), 'haft', { y: H - 0.085, rx: -Math.PI / 2 });
  lash(body, H - 0.07, H + 0.03, 0.021, 'sinew', 10);
  const leaf = flintLeaf(0.27, 0.082, 0.02);
  body.add(leaf, 'flint', { y: H - 0.02 });
  body.add(leaf, 'flint', { y: H - 0.02, ry: Math.PI / 2, sx: 0.5, sz: 0.8 });
  body.add(box(0.005, 0.12, 0.003, 0.001), 'hide', { x: 0.024, y: H - 0.12, z: 0.004, rz: 0.08 });
  body.add(rodZ(0.008, 0.008, 0.018, 10), 'bone', { x: 0.029, y: H - 0.185, rx: Math.PI / 2 });
  // The support hand closes 0.3 m up the shaft.
  return item('spear', body, [0, H + 0.27, 0], { pos: [-0.022, 0.3, 0.085], finger: [0, -0.12, -0.99], back: [-1, 0.05, 0] });
}

/** Root club: a thin wrapped grip swelling to a knotted head set with flint teeth. */
export function buildClub(ctx, mats) {
  surfaces(mats);
  const body = new Assembly('club');
  const r = 0.0172;
  body.add(latheZ([[0, 0], [0.006, 0.016], [0.12, r], [0.24, 0.022], [0.34, 0.034], [0.43, 0.046], [0.5, 0.05], [0.545, 0.044], [0.57, 0.028], [0.58, 0]], 20), 'haft', { y: -0.13, rx: -Math.PI / 2 });
  for (const [y, , ry] of [[0.31, 0, 0.4], [0.34, 0, 1.9], [0.38, 0, 3.6], [0.28, 0, 5]]) body.add(dome(0.02, 10, 0.55), 'haft_dark', { x: Math.cos(ry) * 0.04, z: Math.sin(ry) * 0.04, y, ry: -ry + Math.PI / 2 });
  const tooth = extrude([[0, 0], [0.012, 0.004], [0.004, 0.034], [-0.01, 0.006]], 0.006, { bevel: 0.0018 });
  const toothOut = tooth.clone().rotateX(Math.PI / 2 - 0.3);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    body.add(toothOut, 'flint', { x: Math.sin(a) * 0.04, z: Math.cos(a) * 0.04, y: 0.31 + (i % 2) * 0.05, ry: a });
  }
  body.add(tooth, 'flint', { y: 0.435, x: 0.006, rz: 0.1, sx: 1.4, sy: 1.3 });
  lash(body, 0.28, 0.37, 0.041, 'sinew', 5);
  body.add(rodZ(0.031, 0.034, 0.02, 18), 'ochre', { y: 0.21, rx: Math.PI / 2 });
  gripWrap(body, r, -0.075, 9);
  body.add(ring(0.03, 0.0035, 16, 6), 'hide', { y: -0.16, x: 0.02, ry: Math.PI / 2 });
  body.add(rodZ(0.019, 0.02, 0.012, 14), 'bone', { y: -0.125, rx: Math.PI / 2 });
  return item('club', body, [0, 0.42, -0.05]);
}

/** Hatchet: a flint head lashed into a split haft. */
export function buildHatchet(ctx, mats) {
  surfaces(mats);
  const body = new Assembly('hatchet');
  const r = 0.015;
  body.add(latheZ([[0, 0], [0.004, 0.0145], [0.12, 0.0158], [0.3, 0.0138], [0.4, 0.0165], [0.44, 0.012], [0.44, 0]], 18), 'haft', { y: -0.12, rx: -Math.PI / 2 });
  gripWrap(body, r, -0.07, 8);
  const head = extrude([[-0.03, 0.03], [0.02, 0.032], [0.1, 0.055], [0.114, 0.0], [0.1, -0.06], [0.05, -0.02], [-0.03, -0.022]], 0.02, { bevel: 0.005, bevelSegments: 1 });
  body.add(head, 'flint', { y: 0.25, z: 0.005, ry: Math.PI / 2 });
  lash(body, 0.215, 0.285, 0.02, 'sinew', 6);
  return item('hatchet', body, [0, 0.26, -0.1]);
}
