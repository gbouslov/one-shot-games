import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Jointed characters made in code. Limbs hang off pivot groups at the joint, so
 * animation is setting rotations: no skinning, no skeleton, nothing to load.
 * The idea and the gait-by-distance rule come from the character rigs in
 * xMPon/undead-protocol src/render/procgen.ts (MIT); the builder is new.
 *
 * Each segment's parts are merged into one geometry with vertex colours, so a
 * whole body is six draw calls (legs, arms, torso, head, glow) whatever its detail.
 *
 *   const rig = humanoid(rng, { height, build, hunch, colors, head, glow, gear })
 *   poseRig(rig, { phase, stride, hold, reach, lean, t })
 *   rig.flash(0..1)   hit flash
 */

const _c = new THREE.Color();

/** One part: a geometry, a colour, and a transform inside its segment. */
function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (scale) g.scale(...scale);
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(...pos);
  _c.set(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  // A soft top-lit gradient baked into the colour: reads as form under any light.
  const pa = g.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pa.getY(i));
    maxY = Math.max(maxY, pa.getY(i));
  }
  for (let i = 0; i < n; i++) {
    const k = 0.82 + 0.18 * ((pa.getY(i) - minY) / Math.max(1e-3, maxY - minY));
    col[i * 3] = _c.r * k;
    col[i * 3 + 1] = _c.g * k;
    col[i * 3 + 2] = _c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}

const SHAPES = {
  capsule: (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sphere: (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h),
  /** the top `cut` (0..1) of a sphere: hair, helmets, caps */
  dome: (r, cut = 0.5, w = 12, h = 6) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI * cut),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
};

export const shapes = SHAPES;
export { part };

function segment(parts, material) {
  const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A humanoid, about `height` metres tall, facing +z.
 *   build    0.8 thin .. 1.4 heavy
 *   hunch    0 upright .. 1 doubled over
 *   colors   { skin, top, bottom, boots, accent, glow }
 *   head     'bare' | 'hood' | 'helmet' | 'cap'
 *   glow     [{ seg: 'head'|'upper', pos, r }]   emissive bits (eyes, lamps, growths)
 *   gear     (add) => {}  extra parts: add('upper'|'head'|'armR'..., geometry, color, opts)
 */
export function humanoid(rng, { height = 1.8, build = 1, hunch = 0, colors = {}, head = 'bare', glow = [], glowColor = '#ffd27a', glowIntensity = 4, gear = null, roughness = 0.78 } = {}) {
  const c = { skin: '#b08a72', top: '#3d4652', bottom: '#2a2f38', boots: '#1d1b1a', accent: '#6b5a45', ...colors };
  const s = height / 1.8;
  const bw = build;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0.05 });
  material.emissive = new THREE.Color(0, 0, 0);

  const legLen = 0.86;
  const hipY = legLen + 0.06;
  const segs = { legL: [], legR: [], armL: [], armR: [], upper: [], head: [] };
  const add = (seg, geo, color, opts) => segs[seg].push(part(geo, color, opts));

  for (const seg of ['legL', 'legR']) {
    add(seg, SHAPES.capsule(0.1 * bw, 0.34), c.bottom, { pos: [0, -0.24, 0] });
    add(seg, SHAPES.capsule(0.085 * bw, 0.34), c.bottom, { pos: [0, -0.62, 0.02] });
    add(seg, SHAPES.box(0.15 * bw, 0.1, 0.27), c.boots, { pos: [0, -0.86, 0.05] });
  }
  const torsoH = 0.56;
  add('upper', SHAPES.capsule(0.21 * bw, 0.2), c.bottom, { pos: [0, 0.06, 0], scale: [1.15, 1, 0.8] });
  add('upper', SHAPES.capsule(0.25 * bw, torsoH - 0.2), c.top, { pos: [0, 0.36, 0], scale: [1.12, 1, 0.78] });
  add('upper', SHAPES.cyl(0.07, 0.08, 0.12), c.skin, { pos: [0, torsoH + 0.12, 0] });
  for (const seg of ['armL', 'armR']) {
    add(seg, SHAPES.sphere(0.1 * bw, 8, 6), c.top, { pos: [0, -0.02, 0] });
    add(seg, SHAPES.capsule(0.075 * bw, 0.24), c.top, { pos: [0, -0.18, 0] });
    add(seg, SHAPES.capsule(0.065 * bw, 0.22), c.skin, { pos: [0, -0.46, 0] });
    add(seg, SHAPES.sphere(0.06, 6, 5), c.skin, { pos: [0, -0.62, 0.01] });
  }
  add('head', SHAPES.sphere(0.15, 12, 10), c.skin, { pos: [0, 0.1, 0], scale: [0.95, 1.1, 1] });
  if (head === 'hood') {
    add('head', SHAPES.sphere(0.175, 12, 8), c.accent, { pos: [0, 0.13, -0.03], scale: [1, 1.12, 1.08] });
  } else if (head === 'helmet') {
    add('head', new THREE.SphereGeometry(0.178, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), c.accent, { pos: [0, 0.13, 0] });
  } else if (head === 'cap') {
    add('head', new THREE.SphereGeometry(0.163, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), c.accent, { pos: [0, 0.14, 0] });
    add('head', SHAPES.box(0.2, 0.025, 0.12), c.accent, { pos: [0, 0.16, 0.14] });
  }
  gear?.(add, SHAPES, c);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(s);
  group.add(body);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.12 * bw, hipY, 0);
  legR.position.set(0.12 * bw, hipY, 0);
  legL.add(segment(segs.legL, material));
  legR.add(segment(segs.legR, material));

  const upper = new THREE.Group();
  upper.position.y = hipY;
  upper.rotation.x = hunch * 0.55;
  upper.add(segment(segs.upper, material));

  const headG = new THREE.Group();
  headG.position.y = torsoH + 0.2;
  headG.rotation.x = -hunch * 0.35;
  headG.add(segment(segs.head, material));
  upper.add(headG);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.3 * bw, torsoH - 0.02, 0);
  armR.position.set(0.3 * bw, torsoH - 0.02, 0);
  armL.add(segment(segs.armL, material));
  armR.add(segment(segs.armR, material));
  upper.add(armL, armR);
  body.add(legL, legR, upper);

  // Emissive bits: a basic material brighter than 1 so bloom catches it.
  let glowMat = null;
  if (glow.length) {
    glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor).multiplyScalar(glowIntensity), fog: false });
    const bySeg = {};
    for (const gl of glow) (bySeg[gl.seg ?? 'head'] ??= []).push(part(SHAPES.sphere(gl.r ?? 0.03, 6, 5), '#ffffff', { pos: gl.pos, scale: gl.scale }));
    const parents = { head: headG, upper, armL, armR };
    for (const [seg, list] of Object.entries(bySeg)) {
      const m = new THREE.Mesh(mergeGeometries(list, false), glowMat);
      parents[seg].add(m);
    }
  }

  // Socket for a held weapon, between the hands at chest height.
  const socket = new THREE.Group();
  socket.position.set(0.1, torsoH - 0.12, 0.34);
  upper.add(socket);

  const rig = {
    group, body, upper, head: headG, armL, armR, legL, legR, socket, material, glowMat,
    hunch, height, phase: rng.range(0, Math.PI * 2), seed: rng.float(),
    flash(k) {
      material.emissive.setRGB(k * 1.6, k * 1.4, k * 1.2);
    },
    dispose() {
      group.traverse((o) => o.geometry?.dispose());
      material.dispose();
      glowMat?.dispose();
    },
  };
  return rig;
}

/**
 * Pose a rig for this frame.
 *   phase   gait phase in radians (advance by distance travelled, not time)
 *   stride  0 standing .. 1 full stride
 *   hold    0..1 arms up holding a weapon to the front
 *   reach   0..1 arms raised toward the target (a lunge)
 *   lean    forward lean in radians
 *   t       seconds, for idle sway
 */
export function poseRig(rig, { phase = rig.phase, stride = 0, hold = 0, reach = 0, lean = 0, t = 0, recoil = 0 }) {
  const sw = Math.sin(phase);
  const legSwing = 0.62 * stride;
  rig.legL.rotation.x = sw * legSwing;
  rig.legR.rotation.x = -sw * legSwing;
  const bob = Math.abs(Math.cos(phase)) * 0.05 * stride;
  rig.body.position.y = bob;
  const idle = Math.sin(t * 1.7 + rig.seed * 9) * 0.03;
  rig.upper.rotation.x = rig.hunch * 0.55 + lean + idle;
  rig.upper.rotation.y = Math.sin(phase) * 0.12 * stride * (1 - hold);
  rig.upper.rotation.z = Math.sin(t * 1.1 + rig.seed * 5) * 0.025;

  const armSwing = 0.5 * stride * (1 - hold) * (1 - reach);
  const reachX = -1.35 + Math.sin(t * 3 + rig.seed * 7) * 0.12;
  rig.armL.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-sw * armSwing, -1.15, hold), reachX, reach);
  rig.armR.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(sw * armSwing, -1.4 + recoil * 0.25, hold), reachX - 0.1, reach);
  rig.armL.rotation.z = THREE.MathUtils.lerp(0.06, -0.55, hold) * (1 - reach) + reach * -0.1;
  rig.armR.rotation.z = THREE.MathUtils.lerp(-0.06, 0.12, hold) * (1 - reach) + reach * 0.1;
  rig.armL.rotation.y = hold * 0.5;
}

/** A soft round contact shadow under a character, for when real shadows are off or too soft. */
let _blobGeo = null;
let _blobMat = null;
export function blobShadow(radius = 0.55, opacity = 0.55) {
  if (!_blobGeo) {
    const size = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    _blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    _blobMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -4 });
  }
  const m = new THREE.Mesh(_blobGeo, _blobMat);
  m.scale.setScalar(radius * 2);
  m.position.y = 0.015;
  m.renderOrder = 1;
  return m;
}
