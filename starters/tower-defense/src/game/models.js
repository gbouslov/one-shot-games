import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Crowd } from '../kit/td/crowd.js';
import { rockGeometry, paint, jitter } from '../kit/world/nature.js';
import { Rng } from '../kit/core/rng.js';

/**
 * What the towers and enemies look like. Everything is geometry made in code
 * with the procedural material library (ctx.get('materials')).
 *
 *   tower(ctx, def, level) -> Object3D, with userData:
 *       head    rotated to face the target (yaw)
 *       muzzle  where shots leave from
 *       onFire()            recoil, swing, flash
 *       update(dt, tower)   idle animation
 *   crowd(ctx, defs, max)  -> the instanced enemy renderer (kit/td/crowd.js)
 */

let M = null;
function mats(ctx) {
  if (M) return M;
  const lib = ctx.get('materials');
  M = {
    stone: lib.get('concrete', { tint: 0xd9cfc0, scale: 1.6 }),
    stoneDark: lib.get('concrete', { tint: 0x9d958a, scale: 1.2 }),
    block: lib.get('brick', { tint: 0xb7aea6, scale: 1.1 }),
    wood: lib.get('wood', { tint: 0xc9a27a, scale: 0.9 }),
    woodDark: lib.get('wood', { tint: 0x7d6046, scale: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c08c46', metalness: 1, roughness: 0.36 }),
    iron: new THREE.MeshStandardMaterial({ color: '#3a3836', metalness: 0.85, roughness: 0.5 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#9b6a3a', metalness: 1, roughness: 0.3 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#7c2b22', roughness: 0.85, side: THREE.DoubleSide }),
    clothBlue: new THREE.MeshStandardMaterial({ color: '#2d4f6e', roughness: 0.85, side: THREE.DoubleSide }),
    ember: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(3), toneMapped: false }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(4), toneMapped: false }),
    ice: new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe0ff').multiplyScalar(2.6), toneMapped: false }),
    boltTip: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd58a').multiplyScalar(3), toneMapped: false }),
  };
  return M;
}

function mesh(geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (scale) m.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** A ring of crenellations (merlons) around a radius. */
function merlons(r, y, n, size) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = new THREE.BoxGeometry(size[0], size[1], size[2]);
    b.rotateY(-a);
    b.translate(Math.cos(a) * r, y + size[1] / 2, Math.sin(a) * r);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

/** A stone plinth every tower stands on: a chamfered octagon with a lip. */
function plinth(m, r = 0.92) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.36, 8), m.stoneDark, { pos: [0, 0.14, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.94, 0.12, 8), m.stone, { pos: [0, 0.38, 0] }));
  return g;
}

function spire(ctx, def, level) {
  const m = mats(ctx);
  const root = new THREE.Group();
  root.add(plinth(m));
  const h = 1.5 + level * 0.45;
  root.add(mesh(new THREE.CylinderGeometry(0.5, 0.62, h, 8), m.block, { pos: [0, 0.44 + h / 2, 0] }));
  // timber bands around the shaft
  for (let i = 0; i <= level; i++) root.add(mesh(new THREE.CylinderGeometry(0.64 - i * 0.03, 0.64 - i * 0.03, 0.09, 8), m.woodDark, { pos: [0, 0.6 + i * 0.55, 0] }));
  const top = 0.44 + h;
  root.add(mesh(new THREE.CylinderGeometry(0.78, 0.6, 0.18, 8), m.stone, { pos: [0, top + 0.06, 0] }));
  root.add(mesh(merlons(0.68, top + 0.15, 8, [0.22, 0.24, 0.16]), m.stone, {}));

  const head = new THREE.Group();
  head.position.y = top + 0.3;
  const yoke = new THREE.Group();
  head.add(yoke);
  yoke.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8), m.iron, { pos: [0, 0.02, 0] }));
  yoke.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 1.15), m.wood, { pos: [0, 0.2, 0.08] }));
  // bow limbs swept back, brass tipped
  for (const s of [-1, 1]) {
    const limb = mesh(new THREE.BoxGeometry(0.62, 0.07, 0.07), m.woodDark, { pos: [s * 0.32, 0.22, 0.52], rot: [0, s * 0.42, 0] });
    yoke.add(limb);
    yoke.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), m.brass, { pos: [s * 0.6, 0.22, 0.4] }));
  }
  yoke.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), m.iron, { pos: [0, 0.3, 0.2], rot: [Math.PI / 2, 0, 0] }));
  yoke.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 6), m.boltTip, { pos: [0, 0.3, 0.74], rot: [Math.PI / 2, 0, 0], shadow: false }));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.3, 0.8);
  yoke.add(muzzle);
  root.add(head);

  // a brazier on upgraded spires, a banner at the top level
  let flame = null;
  if (level >= 1) {
    const b = mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.14, 8), m.iron, { pos: [0.5, top + 0.42, -0.5] });
    root.add(b);
    flame = mesh(new THREE.ConeGeometry(0.08, 0.22, 6), m.flame, { pos: [0.5, top + 0.58, -0.5], shadow: false });
    root.add(flame);
  }
  if (level >= 2) {
    root.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), m.woodDark, { pos: [-0.55, top + 0.75, -0.45] }));
    const flag = mesh(new THREE.PlaneGeometry(0.5, 0.34, 6, 1), m.cloth, { pos: [-0.3, top + 1.22, -0.45], shadow: true });
    root.add(flag);
    root.userData.flag = flag;
  }
  let kick = 0;
  let t = 0;
  root.userData = {
    ...root.userData,
    head,
    muzzle,
    onFire: () => { kick = 1; },
    update: (dt, tower) => {
      t += dt;
      kick = Math.max(0, kick - dt * 7);
      yoke.position.z = -kick * 0.16;
      if (flame) flame.scale.set(1, 0.85 + Math.sin(t * 13) * 0.15, 1);
      if (root.userData.flag) root.userData.flag.rotation.y = Math.sin(t * 2.3) * 0.25;
      rise(root, tower, dt);
    },
  };
  return root;
}

function kiln(ctx, def, level) {
  const m = { ...mats(ctx) };
  m.ember = m.ember.clone(); // each kiln glows on its own shot
  const root = new THREE.Group();
  root.add(plinth(m, 0.98));
  const h = 0.9 + level * 0.18;
  root.add(mesh(new THREE.CylinderGeometry(0.78, 0.9, h, 10), m.stone, { pos: [0, 0.44 + h / 2, 0] }));
  for (let i = 0; i < 2 + level; i++) root.add(mesh(new THREE.TorusGeometry(0.84 - i * 0.03, 0.035, 6, 20), m.iron, { pos: [0, 0.6 + i * 0.28, 0], rot: [Math.PI / 2, 0, 0] }));
  // glowing firebox mouths around the base
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    root.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 0.06), m.ember, { pos: [Math.sin(a) * 0.86, 0.66, Math.cos(a) * 0.86], rot: [0, a, 0], shadow: false }));
  }
  const top = 0.44 + h;
  const head = new THREE.Group();
  head.position.y = top;
  const turret = new THREE.Group();
  head.add(turret);
  turret.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.16, 10), m.woodDark, { pos: [0, 0.08, 0] }));
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.42, 0);
  barrel.rotation.x = 0.75;
  barrel.add(mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.95, 14), m.iron, { pos: [0, 0.25, 0] }));
  barrel.add(mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 18), m.brass, { pos: [0, 0.72, 0], rot: [Math.PI / 2, 0, 0] }));
  barrel.add(mesh(new THREE.CircleGeometry(0.29, 16), m.ember, { pos: [0, 0.725, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.85, 0);
  barrel.add(muzzle);
  turret.add(barrel);
  // trunnion cheeks
  for (const s of [-1, 1]) turret.add(mesh(new THREE.BoxGeometry(0.12, 0.42, 0.5), m.wood, { pos: [s * 0.45, 0.32, 0] }));
  root.add(head);
  if (level >= 1) root.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7 + level * 0.2, 8), m.stoneDark, { pos: [-0.55, top + 0.3, -0.45] }));

  let kick = 0;
  root.userData = {
    head,
    muzzle,
    onFire: () => { kick = 1; },
    update: (dt, tower) => {
      kick = Math.max(0, kick - dt * 3.5);
      barrel.position.y = 0.42 - kick * 0.12;
      barrel.scale.setScalar(1 + kick * 0.05);
      m.ember.color.setRGB(3 + kick * 3, 1.2 + kick * 1.6, 0.35 + kick);
      rise(root, tower, dt);
    },
  };
  return root;
}

function bellGeometry() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 0.12 + 0.24 * t ** 2.2 + (t > 0.9 ? (t - 0.9) * 0.6 : 0);
    pts.push(new THREE.Vector2(r, -t * 0.55));
  }
  pts.push(new THREE.Vector2(0.0, -0.55));
  const g = new THREE.LatheGeometry(pts.reverse(), 20);
  return g;
}

function bell(ctx, def, level) {
  const m = mats(ctx);
  const root = new THREE.Group();
  root.add(plinth(m, 0.86));
  const h = 1.7 + level * 0.25;
  // two A-frames joined by a crossbeam
  for (const s of [-1, 1]) {
    for (const k of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(0.12, h + 0.2, 0.12), m.wood, { pos: [s * 0.52, 0.44 + h / 2, k * 0.22], rot: [k * 0.2, 0, 0] }));
  }
  root.add(mesh(new THREE.BoxGeometry(1.3, 0.14, 0.16), m.woodDark, { pos: [0, 0.44 + h, 0] }));
  root.add(mesh(new THREE.ConeGeometry(0.95, 0.4, 4), m.woodDark, { pos: [0, 0.44 + h + 0.27, 0], rot: [0, Math.PI / 4, 0] }));
  const swing = new THREE.Group();
  swing.position.y = 0.44 + h - 0.05;
  const scale = 1 + level * 0.12;
  const b = mesh(bellGeometry(), m.bronze, { scale });
  swing.add(b);
  const clapper = mesh(new THREE.OctahedronGeometry(0.09, 0), m.ice, { pos: [0, -0.5 * scale, 0], shadow: false });
  swing.add(clapper);
  root.add(swing);
  // frost crystals growing from the plinth
  for (let i = 0; i < 2 + level * 2; i++) {
    const a = (i / (2 + level * 2)) * Math.PI * 2 + 0.3;
    root.add(mesh(new THREE.OctahedronGeometry(0.12, 0), m.ice, { pos: [Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7], scale: [0.7, 1.8, 0.7], rot: [0, a, 0.25], shadow: false }));
  }
  if (level >= 2) root.add(mesh(new THREE.PlaneGeometry(0.42, 0.7), m.clothBlue, { pos: [0, 0.44 + h - 0.45, 0.24], shadow: true }));
  let ring = 0;
  let t = 0;
  root.userData = {
    head: null,
    muzzle: clapper,
    onFire: () => { ring = 1; },
    update: (dt, tower) => {
      t += dt;
      ring = Math.max(0, ring - dt * 1.4);
      swing.rotation.x = Math.sin(t * 9) * 0.45 * ring * ring;
      clapper.scale.setScalar(1 + ring * 0.8);
      rise(root, tower, dt);
    },
  };
  return root;
}

/** Newly built towers grow out of the ground for a quarter second. */
function rise(root, tower, dt) {
  if (!tower) return;
  const k = Math.min(1, (tower.built ?? 1) / 0.3);
  const e = 1 - (1 - k) ** 3;
  root.scale.set(0.8 + 0.2 * e, e, 0.8 + 0.2 * e);
}

const BUILDERS = { spire, kiln, bell };

export const models = {
  tower(ctx, def, level) {
    const b = BUILDERS[def.id] ?? spire;
    const obj = b(ctx, def, level);
    obj.name = `tower-${def.id}`;
    return obj;
  },

  crowd(ctx, defs, max) {
    const rng = new Rng(0xbee71e);
    const chitin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.35 });
    const leg = new THREE.MeshStandardMaterial({ color: '#17120f', roughness: 0.6 });
    const glowAmber = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3.2), toneMapped: false });
    const glowRed = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a3a').multiplyScalar(3.2), toneMapped: false });
    const glowViolet = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c48aff').multiplyScalar(2.6), toneMapped: false });
    const moss = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });

    const parts = {};
    for (const id of Object.keys(defs)) {
      if (id === 'mite') {
        parts[id] = [
          { geometry: beetleBody(rng, { len: 0.62, wid: 0.42, high: 0.3, shell: '#3b1d18', belly: '#120c0a', y: 0.3 }), material: chitin, anim: 'body' },
          { geometry: eyes(0.62, 0.3, 0.05), material: glowRed, anim: 'glow', shadow: false },
          ...legPair(0.6, 0.44, 0.3, leg),
        ];
      } else if (id === 'shell') {
        const rock = rockGeometry(rng, { radius: 0.5, detail: 1, roughness: 0.25, squash: 0.62, colors: ['#4a463f', '#6f6a5e'], moss: '#55692c' });
        rock.translate(0, 0.62, -0.06);
        parts[id] = [
          { geometry: beetleBody(rng, { len: 0.86, wid: 0.62, high: 0.36, shell: '#1c1a17', belly: '#0d0b0a', y: 0.36 }), material: chitin, anim: 'body' },
          { geometry: rock, material: moss, anim: 'body' },
          { geometry: eyes(0.86, 0.34, 0.06), material: glowViolet, anim: 'glow', shadow: false },
          ...legPair(0.82, 0.62, 0.36, leg),
        ];
      } else {
        parts[id] = [
          { geometry: beetleBody(rng, { len: 0.78, wid: 0.5, high: 0.34, shell: '#24282a', belly: '#100e0d', y: 0.34, seam: true }), material: chitin, anim: 'body' },
          { geometry: mergeGeometries([eyes(0.78, 0.34, 0.055), seamGlow(0.78, 0.34)]), material: glowAmber, anim: 'glow', shadow: false },
          ...legPair(0.76, 0.52, 0.34, leg),
        ];
      }
    }
    return new Crowd(ctx, parts, max, { barColor: '#f2c15a', barWidth: 0.85 });
  },
};

/** A beetle: domed wing cases, a thorax and a head, vertex coloured dark to glossy. */
function beetleBody(rng, { len, wid, high, shell, belly, y }) {
  const parts = [];
  const sc = new THREE.Color(shell);
  const bc = new THREE.Color(belly);
  const abdomen = new THREE.SphereGeometry(1, 18, 12);
  abdomen.scale(wid / 2, high / 2, len / 2);
  abdomen.translate(0, y, -len * 0.08);
  jitter(abdomen, rng, 0.006);
  parts.push(paint(abdomen, (px, py, pz, c) => {
    c.copy(bc).lerp(sc, Math.max(0, Math.min(1, (py - y + high * 0.2) / (high * 0.6))));
    // the split between the wing cases
    if (Math.abs(px) < wid * 0.03 && py > y) c.multiplyScalar(0.4);
  }));
  const thorax = new THREE.SphereGeometry(1, 12, 8);
  thorax.scale(wid * 0.36, high * 0.36, len * 0.18);
  thorax.translate(0, y * 0.95, len * 0.36);
  parts.push(paint(thorax, (px, py, pz, c) => c.copy(sc).multiplyScalar(0.7)));
  const head = new THREE.SphereGeometry(1, 10, 8);
  head.scale(wid * 0.24, high * 0.26, len * 0.12);
  head.translate(0, y * 0.88, len * 0.52);
  parts.push(paint(head, (px, py, pz, c) => c.copy(bc)));
  // mandibles
  for (const s of [-1, 1]) {
    const mnd = new THREE.ConeGeometry(wid * 0.05, len * 0.18, 5);
    mnd.rotateX(Math.PI / 2);
    mnd.rotateY(s * -0.35);
    mnd.translate(s * wid * 0.1, y * 0.8, len * 0.64);
    parts.push(paint(mnd, (px, py, pz, c) => c.copy(bc)));
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

function eyes(len, y, r) {
  const parts = [];
  for (const s of [-1, 1]) {
    const e = new THREE.SphereGeometry(r, 8, 6);
    e.translate(s * len * 0.12, y * 0.98, len * 0.57);
    parts.push(e.toNonIndexed());
  }
  return mergeGeometries(parts);
}

function seamGlow(len, y) {
  const g = new THREE.BoxGeometry(0.025, 0.02, len * 0.62);
  g.translate(0, y + len * 0.2, -len * 0.08);
  return g.toNonIndexed();
}

/** Two tripods of legs (front-left, mid-right, back-left and the mirror) for the scuttle. */
function legPair(len, wid, y, material) {
  const make = (sides) => {
    const parts = [];
    for (const [s, k] of sides) {
      const z = len * (0.25 - k * 0.25);
      const upper = new THREE.BoxGeometry(wid * 0.55, 0.035, 0.035);
      upper.translate(s * wid * 0.45, y * 0.9 + 0.05, z);
      upper.rotateZ(0);
      const lower = new THREE.BoxGeometry(0.035, y * 1.05, 0.035);
      lower.translate(s * wid * 0.74, y * 0.45, z + (1 - k) * 0.05);
      parts.push(upper.toNonIndexed(), lower.toNonIndexed());
    }
    return mergeGeometries(parts);
  };
  return [
    { geometry: make([[-1, 0], [1, 1], [-1, 2]]), material, anim: 'legsA' },
    { geometry: make([[1, 0], [-1, 1], [1, 2]]), material, anim: 'legsB' },
  ];
}
