import * as THREE from 'three';

/**
 * BARE ARMS: poses a rigged arms mesh that ships with no clips ("fps arms (rigged
 * only)" by para, CC0) entirely in code, so it can hold the kit's coded items.
 *
 * Every frame, after the rig's additive layers (sway, bob, lag, swing, thrust,
 * throw, draw dip) have moved the arms root:
 *   1. the held item sits at its hold pose in the root's frame, so it carries
 *      every procedural layer; the right hand is placed so its fist closes on it
 *   2. the shoulders are pulled back toward where they were at rest in CAMERA
 *      space (body-fixed), so a swing bends the elbows instead of sliding a rigid mesh
 *   3. two-bone IK lays the upper arm and forearm from shoulder to wrist with the
 *      elbow toward a pole; the forearm takes part of the hand's roll
 *   4. the left hand closes on the shaft (two-handed holds) or the left arm
 *      folds away out of frame (one-handed holds)
 * Fingers are curled once at load: each joint turns toward the palm by `curl`.
 *
 * The rig's hand bones are not children of the forearms (Blender IK controls),
 * which is what lets the hand be placed freely and the arm solved to meet it.
 */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _s = new THREE.Vector3();
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

/**
 * Hold presets, in CAMERA space (metres; x right, y up, -z forward). `pos`/`rot`
 * place the item's origin (the centre of the right fist; its shaft runs along +Y).
 * `left`: null folds the left arm away, or { y, roll } closes the left fist on the
 * shaft `y` metres along it, turned `roll` radians round it.
 */
export const BARE_HOLDS = {
  // club, hatchet, knife, torch: fist low right, head up and forward, leaning in
  onehand: { pos: [0.15, -0.15, -0.33], aim: [-0.3, 0.72, -0.62], face: [0, 0.3, -1], left: null },
  // spear, staff: rear fist low right, front fist on the shaft, point at the centre
  twohand: { pos: [0.17, -0.17, -0.2], aim: [-0.51, 0.17, -0.84], face: [0, 1, 0.2], left: { y: 0.22, roll: 1.3 }, shoulderL: [0.05, -0.01, -0.12] },
  // javelin, stone: raised by the shoulder ready to throw
  thrown: { pos: [0.22, -0.1, -0.3], aim: [-0.12, 0.25, -0.96], face: [0, 1, 0], left: null },
};
BARE_HOLDS.club = BARE_HOLDS.onehand;
BARE_HOLDS.hatchet = BARE_HOLDS.onehand;
BARE_HOLDS.spear = BARE_HOLDS.twohand;

/**
 * Looks for the bare arms. `material` on the spec is a name or an object:
 *   'skin'   the CC0 skin texture as authored (the default)
 *   'hide'   weathered skin with hide strips bound spirally from the wrist up the forearm
 *   'leather' the same strips covering the forearm to the elbow, darker
 *   { tint, roughness, wrap: { color, from, to, turns }, map, mapRepeat }
 *            tint multiplies the skin; wrap binds strips from `from` to `to` along the
 *            forearm (0 elbow, 1 wrist), `color` multiplying the skin under them; map
 *            replaces the skin albedo (a Texture or URL, e.g. a CC0 leather from
 *            ambientCG imported with ?url) for fully clad arms
 */
export const BARE_MATERIALS = {
  skin: { tint: '#e8d4c8', roughness: 0.6 },
  hide: { tint: '#c49a80', roughness: 0.7, wrap: { color: '#6e5444', from: 0.4, to: 0.94, turns: 3 } },
  leather: { tint: '#b89078', roughness: 0.66, wrap: { color: '#6a4a34', from: 0.08, to: 0.96, turns: 5 } },
};

export function bareMaterial(meshes, choice, pose) {
  const o = typeof choice === 'string' ? BARE_MATERIALS[choice] ?? BARE_MATERIALS.skin : { ...BARE_MATERIALS.skin, ...choice };
  for (const mesh of meshes) {
    const m = mesh.material;
    if (o.tint && m.color) m.color.set(o.tint);
    if (o.roughness !== undefined) m.roughness = o.roughness;
    m.metalness = 0;
    m.side = THREE.FrontSide;
    if (o.map) {
      // A game's own albedo over the whole arm (e.g. a CC0 leather from ambientCG).
      const map = typeof o.map === 'string' ? new THREE.TextureLoader().load(o.map) : o.map;
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      if (o.mapRepeat) map.repeat.set(o.mapRepeat, o.mapRepeat);
      m.map = map;
    }
    if (o.wrap && mesh.isSkinnedMesh) {
      // Strips as vertex colour: the strip colour multiplies the skin, edges go darker.
      const mask = wrapMask(mesh, pose, o.wrap);
      const c = new THREE.Color(o.wrap.color ?? '#a08060');
      const col = new Float32Array(mask.count * 3);
      for (let i = 0; i < mask.count; i++) {
        const k = mask.getX(i);
        const s = 1 - k + k * mask.getY(i);
        col[i * 3] = (1 - k + k * c.r) * s;
        col[i * 3 + 1] = (1 - k + k * c.g) * s;
        col[i * 3 + 2] = (1 - k + k * c.b) * s;
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      m.vertexColors = true;
    }
    m.needsUpdate = true;
  }
}

/** Per-vertex strip mask: x = on a strip, y = shade (darker at the strip edges). */
function wrapMask(mesh, pose, w) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones;
  const out = new Float32Array(pos.count * 2);
  const fore = new Set();
  const len = {};
  for (const sd of Object.values(pose.side)) {
    const j = bones.indexOf(sd.fore);
    if (j >= 0) { fore.add(j); len[j] = sd.foreEnd.position.length(); }
  }
  const v = new THREE.Vector3();
  const from = w.from ?? 0.4;
  const to = w.to ?? 1;
  const turns = w.turns ?? 7;
  for (let i = 0; i < pos.count; i++) {
    let best = -1;
    let wf = 0;
    let wMax = 0;
    for (let k = 0; k < 4; k++) {
      const wt = sw.getComponent(i, k);
      const j = si.getComponent(i, k);
      if (fore.has(j)) { wf += wt; if (wt > wMax) { wMax = wt; best = j; } }
    }
    out[i * 2 + 1] = 1;
    if (best < 0 || wf < 0.35) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[best]);
    const t = v.y / len[best];
    if (t < from || t > to) continue;
    // A bound wrap: solid hide with `turns` darker seams where the windings overlap,
    // spiralling round the forearm (the mesh is ~16 vertex rings per forearm).
    const phase = t * turns + Math.atan2(v.x, v.z) / (Math.PI * 2);
    const f = phase - Math.floor(phase);
    const seam = Math.min(f, 1 - f) < 0.12;
    out[i * 2] = Math.min(1, wf * 1.4);
    out[i * 2 + 1] = seam ? 0.55 : 1;
  }
  return new THREE.BufferAttribute(out, 2);
}

export class BareArmsPose {
  static material = bareMaterial;

  /**
   * @param {object} arms  AssetArms (root, frame, scene)
   * @param {object} spec  hold, holdPose, pin, curl, thumb, pole, gripOffset ([x,y,z] m, item in fist)
   */
  constructor(arms, spec) {
    this.arms = arms;
    const scene = arms.scene;
    const get = (n) => scene.getObjectByName(n);
    const hold = typeof spec.hold === 'object' ? spec.hold : BARE_HOLDS[spec.hold ?? 'onehand'] ?? BARE_HOLDS.onehand;
    this.hold = { ...hold, ...(spec.holdPose ?? {}) };
    this.pin = spec.pin ?? 0.8;
    this.side = {};
    for (const s of ['R', 'L']) {
      const sd = {
        s,
        clavicle: get(`clavicle${s}`),
        upper: get(`upper_arm${s}`),
        fore: get(`forearm${s}`),
        foreEnd: get(`forearm${s}_end`),
        hand: get(`hand${s}`),
        thumb: [1, 2, 3].map((i) => get(`thumb0${i}${s}`)),
        fingers: FINGERS.map((f) => [1, 2, 3].map((i) => get(`f_${f}0${i}${s}`))),
      };
      if (!sd.clavicle || !sd.upper || !sd.fore || !sd.hand) throw new Error(`bare arms: missing ${s} bones`);
      this.side[s] = sd;
    }
    // Rest state, in the arms scene's own frame.
    scene.updateWorldMatrix(true, true);
    this.bones = [];
    scene.traverse((o) => { if (o.isBone) this.bones.push(o); });
    for (const sd of Object.values(this.side)) this._measure(sd);
    // Move the item within the fist: [x, y, z] metres in item space.
    if (spec.gripOffset) {
      const R = this.side.R;
      R.gripBasis.multiply(new THREE.Matrix4().makeTranslation(...spec.gripOffset));
      R.gripInv = R.gripBasis.clone().invert();
    }
    this._curl(spec.curl ?? [1.35, 1.55, 1.0], spec.thumb ?? [1.15, 0.85, 0.8]);
    // Rest pose after the curl: every frame starts from it.
    this.rest = this.bones.map((o) => [o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
    this.poleR = new THREE.Vector3(...(spec.pole ?? [0.55, -0.8, 0.25])).normalize();
    this.poleL = this.poleR.clone().multiply(new THREE.Vector3(-1, 1, 1));
    this.item = new THREE.Matrix4();
    this.itemSet = false;
    this.leftOff = !this.hold.left;
  }

  /** Hand-local axes and the fist centre, measured on the rest pose. */
  _measure(sd) {
    const hw = sd.hand.matrixWorld;
    const inv = _m.copy(hw).invert();
    const loc = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
    const k = sd.fingers.map((f) => loc(f[0]));
    const knuckles = k.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / k.length);
    const F = knuckles.clone().normalize(); // wrist -> knuckles
    const A = k[3].clone().sub(k[0]).normalize(); // index -> pinky
    // Palm normal: F x A for the right hand, A x F for the mirrored left.
    const N = sd.s === 'R' ? new THREE.Vector3().crossVectors(F, A) : new THREE.Vector3().crossVectors(A, F);
    N.normalize();
    A.addScaledVector(F, -A.dot(F)).normalize();
    sd.F = F;
    sd.A = A;
    sd.N = N;
    // Hand-local units per metre of the arms scene (the rig is authored at 0.1 scale).
    const sceneScale = new THREE.Vector3().setFromMatrixScale(this.arms.scene.matrixWorld).x;
    sd.unit = sceneScale / new THREE.Vector3().setFromMatrixScale(hw).x;
    // Fist centre: just behind the knuckle line, a shaft radius plus the fingers into the palm.
    sd.fist = knuckles.clone().addScaledVector(F, -0.012 * sd.unit).addScaledVector(N, 0.03 * sd.unit);
    // The grip frame in hand space: +Y toward the thumb (out of the top of the fist),
    // +X away from the palm (the back of the hand side for the right hand), Z = X x Y.
    const Y = A.clone().negate();
    const X = sd.s === 'R' ? N.clone().negate() : N.clone();
    X.addScaledVector(Y, -X.dot(Y)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
    sd.gripBasis = new THREE.Matrix4().makeBasis(X, Y, Z);
    sd.gripBasis.setPosition(sd.fist);
    sd.gripBasis.scale(new THREE.Vector3(sd.unit, sd.unit, sd.unit)); // item metres -> hand units
    sd.gripInv = sd.gripBasis.clone().invert();
    // Rest forearm-to-hand rotation, for the forearm twist.
    sd.fore.getWorldQuaternion(_q);
    sd.hand.getWorldQuaternion(_q2);
    sd.foreToHand = _q.clone().invert().multiply(_q2);
  }

  /**
   * Close both fists: each finger joint turns toward the palm. The hinge axes are
   * all measured on the open rest pose first (once a knuckle has turned, a later
   * joint's direction is already past the palm normal and the cross product flips).
   */
  _curl(curl, thumb) {
    for (const sd of Object.values(this.side)) {
      sd.hand.updateWorldMatrix(true, true);
      const handQ = sd.hand.getWorldQuaternion(new THREE.Quaternion());
      const Nw = sd.N.clone().applyQuaternion(handQ);
      const jobs = [];
      const hinge = (bone, angle) => {
        if (!bone) return;
        const bq = bone.getWorldQuaternion(new THREE.Quaternion());
        const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(bq);
        const axis = new THREE.Vector3().crossVectors(dir, Nw);
        if (axis.lengthSq() < 1e-8) return;
        jobs.push([bone, axis.normalize().applyQuaternion(bq.invert()), angle]); // bone-local
      };
      for (const chain of sd.fingers) chain.forEach((b, i) => hinge(b, curl[i]));
      // The thumb folds toward the palm and across the front of the fingers.
      sd.thumb.forEach((b, i) => hinge(b, thumb[i]));
      for (const [bone, axis, angle] of jobs) bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
      sd.hand.updateWorldMatrix(false, true);
    }
  }

  /** Item-in-hand transform (hand-bone local), for attachHeld. */
  heldLocal(out) {
    return out.copy(this.side.R.gripBasis);
  }

  /**
   * Called once the arms root has its hip framing (camera space), before any rig
   * layer: the hold pose in the scene's frame, and the body-fixed shoulders.
   */
  bind() {
    const arms = this.arms;
    arms.root.updateMatrix();
    arms.root.updateMatrixWorld(true);
    // camera space -> scene space at the hip framing
    _m.copy(arms.root.matrix).multiply(arms.frame.matrix);
    const camToScene = _m.clone().invert();
    const h = this.hold;
    const itemCam = new THREE.Matrix4();
    if (h.aim) {
      // aim: where the shaft (+Y) points; face: where the item's front (-Z) faces
      const Y = new THREE.Vector3(...h.aim).normalize();
      const Z = new THREE.Vector3(...(h.face ?? [0, 0, -1])).negate();
      const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
      Z.crossVectors(X, Y).normalize();
      itemCam.makeBasis(X, Y, Z);
    } else {
      itemCam.makeRotationFromEuler(new THREE.Euler(...(h.rot ?? [0, 0, 0]), 'XYZ'));
    }
    itemCam.setPosition(...h.pos);
    this.item.copy(camToScene).multiply(itemCam);
    // Item metres stay scene metres: drop the root's scale from the hold.
    _s.setFromMatrixScale(this.item);
    this.item.scale(_t.set(1 / _s.x, 1 / _s.y, 1 / _s.z));
    // Shoulders in the root's parent space (camera space at rest).
    arms.scene.updateWorldMatrix(true, true);
    const sceneInv = arms.scene.matrixWorld.clone().invert();
    const toCam = arms.root.matrix.clone().multiply(arms.frame.matrix).multiply(arms.scene.matrix);
    for (const sd of Object.values(this.side)) {
      sd.shoulderCam = new THREE.Vector3().setFromMatrixPosition(sd.clavicle.matrixWorld).applyMatrix4(sceneInv).applyMatrix4(toCam);
      // A two-handed hold turns the torso: that shoulder comes forward (camera metres).
      const off = h[`shoulder${sd.s}`];
      if (off) sd.shoulderCam.add(new THREE.Vector3(...off));
    }
    this.itemSet = true;
  }

  /**
   * Pose the arms for this frame, after the rig layers have moved the root.
   * `anchor` is the camera-tracking viewmodel anchor (the shoulders' frame).
   */
  update(anchor) {
    if (!this.itemSet) return;
    const arms = this.arms;
    const scene = arms.scene;
    for (const [o, p, q, s] of this.rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
    scene.updateMatrixWorld(true);
    const sceneW = scene.matrixWorld;
    const anchorW = anchor.matrixWorld;

    // ---- 1. the right hand closes on the item --------------------------------
    const R = this.side.R;
    const itemW = _m.copy(sceneW).multiply(this.item);
    const handW = this._handFromItem(R, itemW, null);
    // ---- 2. body-fixed shoulders -----------------------------------------------
    for (const sd of Object.values(this.side)) this._pinShoulder(sd, anchorW);
    // ---- 3. right arm --------------------------------------------------------------
    this._reach(R, handW, this.poleR);
    // ---- 4. left arm ------------------------------------------------------------
    const L = this.side.L;
    if (this.leftOff) {
      // Fold the whole left arm and hand into the shoulder, out of frame.
      L.clavicle.scale.setScalar(1e-4);
      L.clavicle.updateMatrixWorld(true);
      L.hand.parent.updateWorldMatrix(true, false);
      L.hand.position.copy(L.hand.parent.worldToLocal(_a.setFromMatrixPosition(L.clavicle.matrixWorld)));
      L.hand.scale.setScalar(1e-4);
      L.hand.updateMatrixWorld(true);
    } else {
      const lw = this.hold.left;
      // The item as it ended up (the hand may have been pulled back into reach).
      R.hand.updateMatrixWorld(true);
      const held = arms.heldNode;
      if (held) {
        held.updateMatrixWorld(true);
        this._reach(L, this._handFromItem(L, held.matrixWorld, lw), this.poleL);
      }
    }
  }

  /** Where a hand bone goes so its fist holds `itemW` (the left one `y` up the shaft). */
  _handFromItem(sd, itemW, left) {
    const out = new THREE.Matrix4().copy(itemW);
    if (left) {
      out.multiply(_m2.makeTranslation(0, left.y, 0));
      out.multiply(_m2.makeRotationY(left.roll ?? 0));
    }
    out.multiply(sd.gripInv);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    out.decompose(pos, quat, scale);
    return { pos, quat, scale: scale.x };
  }

  _pinShoulder(sd, anchorW) {
    const parent = sd.clavicle.parent;
    sd.clavicle.updateWorldMatrix(true, false);
    _a.setFromMatrixPosition(sd.clavicle.matrixWorld);
    _b.copy(sd.shoulderCam).applyMatrix4(anchorW);
    _a.lerp(_b, this.pin);
    parent.updateWorldMatrix(true, false);
    sd.clavicle.position.copy(parent.worldToLocal(_a));
    sd.clavicle.updateMatrixWorld(true);
  }

  /** Two-bone IK, shoulder to wrist; the hand is placed at the wrist, pulled into reach. */
  _reach(sd, hand, poleScene) {
    const up = sd.upper;
    const fo = sd.fore;
    up.updateWorldMatrix(true, true);
    const a = _a.setFromMatrixPosition(up.matrixWorld);
    const b = _b.setFromMatrixPosition(fo.matrixWorld);
    const c = _c.setFromMatrixPosition(sd.foreEnd.matrixWorld);
    const l1 = a.distanceTo(b);
    const l2 = b.distanceTo(c);
    // pull the wrist into reach
    const t = _t.copy(hand.pos);
    const d0 = t.distanceTo(a);
    const max = (l1 + l2) * 0.985;
    if (d0 > max) t.sub(a).multiplyScalar(max / d0).add(a);
    const d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(max, t.distanceTo(a)));
    // pole in world: the scene's rotation applied to the scene-space pole
    const sceneQ = this.arms.scene.getWorldQuaternion(new THREE.Quaternion());
    const pole = poleScene.clone().applyQuaternion(sceneQ);
    const dir = t.clone().sub(a).normalize();
    const side = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const elbow = a.clone().addScaledVector(dir, cosA * l1).addScaledVector(side, sinA * l1);
    this._aim(up, b.clone().sub(a).normalize(), elbow.clone().sub(a).normalize());
    fo.updateWorldMatrix(true, true);
    const b2 = new THREE.Vector3().setFromMatrixPosition(fo.matrixWorld);
    const c2 = new THREE.Vector3().setFromMatrixPosition(sd.foreEnd.matrixWorld);
    this._aim(fo, c2.sub(b2).normalize(), t.clone().sub(b2).normalize());
    // Forearm twist: take 60% of the roll the hand wants about the forearm axis.
    fo.updateWorldMatrix(true, true);
    const foQ = fo.getWorldQuaternion(new THREE.Quaternion());
    const want = hand.quat.clone().multiply(sd.foreToHand.clone().invert()); // forearm orientation the hand implies
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(foQ);
    const x0 = new THREE.Vector3(1, 0, 0).applyQuaternion(foQ);
    const x1 = new THREE.Vector3(1, 0, 0).applyQuaternion(want);
    x1.addScaledVector(axis, -x1.dot(axis));
    if (x1.lengthSq() > 1e-6) {
      x1.normalize();
      const ang = Math.atan2(new THREE.Vector3().crossVectors(x0, x1).dot(axis), x0.dot(x1));
      this._rotateWorld(fo, axis, ang * 0.6);
    }
    fo.updateWorldMatrix(false, true);
    // The hand at the wrist, with the requested orientation.
    const shift = t.clone().sub(hand.pos);
    const hb = sd.hand;
    const parent = hb.parent;
    parent.updateWorldMatrix(true, false);
    _m.compose(hand.pos.clone().add(shift), hand.quat, _s.setScalar(hand.scale));
    _m2.copy(parent.matrixWorld).invert().multiply(_m);
    _m2.decompose(hb.position, hb.quaternion, hb.scale);
    hb.updateMatrixWorld(true);
  }

  /** Turn `bone` in world space so that unit direction `from` points along `to`. */
  _aim(bone, from, to) {
    _q.setFromUnitVectors(from, to);
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const newW = _q.clone().multiply(boneQ);
    bone.quaternion.copy(parentQ.invert().multiply(newW));
    bone.updateMatrixWorld(true);
  }

  _rotateWorld(bone, axis, angle) {
    _q.setFromAxisAngle(axis, angle);
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(_q.clone().multiply(boneQ)));
  }
}
