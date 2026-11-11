import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * ASSET ARMS: a rigged first-person arms glTF on the kit's viewmodel.
 *
 * The coded Claude-of-Duty hands (hands.js) are the zero-asset fallback. A weapon
 * definition opts in with one line:
 *
 *   viewmodel: { arms: 'asset', url: armsRifle, clips: { idle: 'idle', fire: 'fire',
 *                reload: 'reload', reloadEmpty: 'reloadEmpty', draw: 'draw' } }
 *
 * `url` is a GLB imported with `?url` (Vite inlines it). Everything else is optional:
 *   clips      kit state -> clip name, or { name, speed }. States: idle (loops), fire,
 *              reload, reloadEmpty, draw, inspect. Missing states fall back to the
 *              procedural layers (a reload with no clip dips the hands out of frame).
 *   eye        node whose frame is the authored camera (default: none, scene origin)
 *   eyeForward which local axis of `eye` looks forward: '-z' (glTF) or '+x' (FBX)
 *   scale, pos, rot   framing in camera space, applied after the eye re-base
 *   fov        viewmodel camera field of view while this weapon is held (default 60)
 *   ads        { pos, rot } framing at full aim (the hip framing is `pos` / `rot`)
 *   lightScale how much of the view light rig this weapon takes (real albedos want ~0.6)
 *   doubleSided material names left double-sided (open sleeve ends); others become front-sided
 *   credit     attribution line; the HUD shows every weapon's credit on its screens
 *   muzzle     'auto' (the forward-most vertex, glued to its bone) or { bone, pos }
 *   hand       bone that holds `held` (bare arms): `held: (ctx, mats) => heldItem()`,
 *              placed with `heldPos` / `heldRot` / `heldScale` in that bone's frame
 *   tint, light  multiply every albedo / set envMapIntensity
 *   materials  { [materialName]: { color, metalness, roughness, normalScale } } retunes,
 *              because the kit's view light rig is bright and metals glare under it
 *   skin       material override for every arms mesh
 *   bare       a poser class for a rig with no clips (ARMS_BARE passes BareArmsPose from
 *              bare-arms.js): fists, grip, IK and pinned shoulders in code; with it come
 *              `hold`, `holdPose`, `material`, `curl`, `thumb`, `pin` (see bare-arms.js)
 *
 * The rig's additive layers (sway, bob, turn lag, spring recoil, jump and land)
 * still drive `vm.rig`; the clips play inside it, so both stack.
 */

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

function dataBytes(url) {
  if (url.startsWith('data:')) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return Promise.resolve(out.buffer);
  }
  return fetch(url).then((r) => r.arrayBuffer());
}

function loader() {
  const l = new GLTFLoader();
  // Embedded images go through <img>, never fetch(): a page's connect-src may refuse
  // blob: fetches, while img-src data:/blob: is allowed in artifacts.
  l.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    return { name: 'ow-img-textures' };
  });
  return l;
}

const FORWARD = {
  // rotation that turns the eye node's frame into a three camera frame (-Z forward)
  '-z': new THREE.Quaternion(),
  '+x': new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
};

export class AssetArms {
  /** @returns {Promise<AssetArms>} */
  static async load(ctx, spec, mats) {
    const gltf = await loader().parseAsync(await dataBytes(spec.url), '');
    return new AssetArms(ctx, spec, gltf, mats);
  }

  constructor(ctx, spec, gltf, mats) {
    this.spec = spec;
    this.scene = gltf.scene;
    this.root = new THREE.Object3D();
    this.root.name = 'ow-asset-arms';
    this.frame = new THREE.Object3D(); // eye re-base
    this.root.add(this.frame);
    this.frame.add(this.scene);

    // ---- materials: sRGB albedo, linear data maps, viewmodel-friendly ------------
    this.meshes = [];
    const tint = spec.tint ? new THREE.Color(spec.tint) : null;
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // skinned bounds are bind-pose bounds; never cull the hands
      o.castShadow = false;
      o.receiveShadow = true;
      const isArm = spec.armsMesh ? spec.armsMesh.test?.(o.material?.name ?? '') : false;
      if (spec.skin && (isArm || !spec.armsMesh)) o.material = spec.skin;
      const m = o.material;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      for (const k of ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) m[k].colorSpace = THREE.NoColorSpace;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = 8;
      if (tint && m.color) m.color.multiply(tint);
      if (spec.light !== undefined) m.envMapIntensity = spec.light;
      // Per-material retune for the kit's view light rig: { [materialName]: { color, metalness, roughness } }
      const o2 = spec.materials?.[m.name];
      if (o2) {
        if (o2.color !== undefined) m.color.set(o2.color);
        if (o2.metalness !== undefined) m.metalness = o2.metalness;
        if (o2.roughness !== undefined) m.roughness = o2.roughness;
        if (o2.normalScale !== undefined) m.normalScale.setScalar(o2.normalScale);
      }
      // Double-sided only where the open end of a sleeve can show (spec.doubleSided names those).
      if (spec.doubleSided && !spec.doubleSided.includes(m.name)) m.side = THREE.FrontSide;
      this.meshes.push(o);
    });

    // ---- clips -----------------------------------------------------------------
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = {};
    this.durations = {};
    for (const [state, ref] of Object.entries(spec.clips ?? {})) {
      if (!ref) continue;
      const name = typeof ref === 'string' ? ref : ref.name;
      const speed = typeof ref === 'string' ? 1 : ref.speed ?? 1;
      const clip = gltf.animations.find((a) => a.name === name);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.timeScale = speed;
      if (state !== 'idle') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[state] = a;
      this.durations[state] = clip.duration / speed;
    }
    this.current = null;
    this.idle = this.actions.idle ?? null;
    if (this.idle) this.idle.play();
    this.mixer.update(0);

    // ---- the eye re-base: authored camera -> kit camera ----------------------------
    this.scene.updateMatrixWorld(true);
    const eye = spec.eye ? this.scene.getObjectByName(spec.eye) : null;
    if (eye) {
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      eye.matrixWorld.decompose(p, q, _v);
      _m.compose(p, q, new THREE.Vector3(1, 1, 1)).invert();
      _m.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(FORWARD[spec.eyeForward ?? '-z']));
      this.frame.matrixAutoUpdate = false;
      this.frame.matrix.copy(_m);
    }
    const s = spec.scale ?? 1;
    this.root.scale.setScalar(s);
    // Hip and aim framings of the root, in camera space.
    this.hipPos = new THREE.Vector3().fromArray(spec.pos ?? [0, 0, 0]);
    this.hipQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray([...(spec.rot ?? [0, 0, 0]), 'XYZ']));
    this.adsPos = new THREE.Vector3().fromArray(spec.ads?.pos ?? [0, 0, 0]);
    this.adsQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray([...(spec.ads?.rot ?? [0, 0, 0]), 'XYZ']));
    this.aim(0);
    this.root.updateMatrixWorld(true);

    // ---- a held object on a hand bone (bare arms) -----------------------------
    this.hand = spec.hand ? this.scene.getObjectByName(spec.hand) : null;
    this.heldNode = null;
    // A rig with no clips, posed in code round the held item: `bare` is the poser
    // class (BareArmsPose in bare-arms.js, passed by ARMS_BARE so a game without
    // bare arms never bundles it).
    this.pose = null;
    if (spec.bare) {
      const Pose = spec.bare;
      this.pose = new Pose(this, spec);
      this.pose.bind();
      this.hand = this.scene.getObjectByName('handR');
      Pose.material(this.meshes, spec.material ?? 'skin', this.pose);
    }
    this.anchor = null; // set by the viewmodel: the camera-tracking anchor

    // ---- the muzzle, glued to the bone that carries it -----------------------------
    this.muzzleBone = null;
    this.muzzleLocal = new THREE.Vector3();
    if (spec.muzzle && spec.muzzle !== 'auto') {
      this.muzzleBone = this.scene.getObjectByName(spec.muzzle.bone);
      this.muzzleLocal.fromArray(spec.muzzle.pos ?? [0, 0, 0]);
    } else if (!spec.hand) {
      this._findMuzzle();
    }
  }

  /** Parent a kit-built held item (an Object3D) to the hand bone. */
  attachHeld(obj) {
    if (!this.hand) return;
    const sp = this.spec;
    this.heldNode = obj;
    if (this.pose) {
      // The fist's own grip frame, measured on the rig: the item lands in the closed hand.
      this.pose.heldLocal(_m).decompose(obj.position, obj.quaternion, obj.scale);
      this.hand.add(obj);
      return;
    }
    // Cancel the bone's world scale so the item is authored in metres of camera space.
    this.root.updateMatrixWorld(true);
    this.hand.matrixWorld.decompose(_v, _q, this._hs = new THREE.Vector3());
    const rootScale = this.root.matrixWorld.getMaxScaleOnAxis();
    obj.scale.setScalar((sp.heldScale ?? 1) * rootScale / this._hs.x);
    if (sp.heldPos) obj.position.fromArray(sp.heldPos).multiplyScalar(1 / this._hs.x * rootScale);
    if (sp.heldRot) obj.rotation.fromArray(sp.heldRot);
    this.hand.add(obj);
  }

  _findMuzzle() {
    // Forward-most vertex across every skinned mesh, in camera space. The arms
    // never reach past the muzzle on a long gun; for anything else pass { bone, pos }.
    this.root.updateMatrixWorld(true);
    let best = Infinity;
    let bestBone = null;
    for (const mesh of this.meshes) {
      if (!mesh.isSkinnedMesh) continue;
      const pos = mesh.geometry.attributes.position;
      const si = mesh.geometry.attributes.skinIndex;
      const sw = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < pos.count; i += 2) {
        mesh.getVertexPosition(i, _v);
        _v.applyMatrix4(mesh.matrixWorld);
        if (_v.z < best) {
          best = _v.z;
          let wMax = -1;
          let j = 0;
          for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > wMax) { wMax = sw.getComponent(i, k); j = si.getComponent(i, k); }
          bestBone = mesh.skeleton.bones[j];
          this._muzzleWorldAtLoad = _v.clone();
        }
      }
    }
    if (bestBone) {
      this.muzzleBone = bestBone;
      this.muzzleLocal.copy(this._muzzleWorldAtLoad);
      bestBone.worldToLocal(this.muzzleLocal);
    }
  }

  /** Blend the root between the hip framing (t = 0) and the aim framing (t = 1). */
  aim(t) {
    this.root.position.lerpVectors(this.hipPos, this.adsPos, t);
    this.root.quaternion.slerpQuaternions(this.hipQuat, this.adsQuat, t);
  }

  /** Kit state -> clip length in seconds (0 when the rig has no clip for it). */
  has(state) {
    return !!this.actions[state];
  }

  play(state) {
    const a = this.actions[state];
    if (!a) return 0;
    if (this.current && this.current !== a) this.current.fadeOut(0.08);
    a.reset().setEffectiveWeight(1).fadeIn(state === 'fire' ? 0.02 : 0.08).play();
    if (this.idle && state !== 'idle') this.idle.fadeOut(state === 'fire' ? 0.02 : 0.08);
    this.current = a;
    return this.durations[state];
  }

  /** Back to the idle loop (end of a clip, weapon switch). */
  stop(fade = 0.12) {
    if (this.current && this.current !== this.idle) this.current.fadeOut(fade);
    this.current = null;
    if (this.idle) this.idle.reset().setEffectiveWeight(1).fadeIn(fade).play();
  }

  update(dt) {
    // A one-shot clip that ran out hands back to idle by itself.
    if (this.current && this.current !== this.idle && !this.current.isRunning()) this.stop(0.1);
    this.mixer.update(dt);
    if (this.pose && this.anchor) this.pose.update(this.anchor);
  }

  muzzleWorld(out) {
    if (this.heldNode?.userData.tip) {
      this.heldNode.updateWorldMatrix(true, false);
      return out.fromArray(this.heldNode.userData.tip).applyMatrix4(this.heldNode.matrixWorld);
    }
    if (!this.muzzleBone) return out.set(0, 0, -0.6).applyMatrix4(this.root.matrixWorld);
    this.muzzleBone.updateWorldMatrix(true, false);
    return out.copy(this.muzzleLocal).applyMatrix4(this.muzzleBone.matrixWorld);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) o.material[k]?.dispose();
      o.material.dispose();
    });
    this.root.removeFromParent();
  }
}
