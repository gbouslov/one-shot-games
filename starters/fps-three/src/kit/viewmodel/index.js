import * as THREE from 'three';
import { Viewmodel } from './viewmodel.js';
import { WeaponMaterials, ENV_OCCLUSION } from './materials.js';
import { buildRifle } from './models/rifle.js';
import { buildSmg } from './models/smg.js';
import { buildPistol } from './models/pistol.js';
import armsBare from './assets/arms-bare.glb?url';
import { BareArmsPose } from './bare-arms.js';
export { BARE_HOLDS, BARE_MATERIALS } from './bare-arms.js';
// Primitive held items for melee and caveman games: `model: buildSpear` etc.
export { buildSpear, buildClub, buildHatchet, PRIMITIVE_MATERIALS } from './models/primitive.js';

/**
 * First-person arms and held objects, from mshumer/Claude-of-Duty (MIT): gloved
 * hands with jointed fingers, two-bone arms welded to the grips, procedural PBR
 * with edge wear and cavity grime, and an additive animation stack (sway,
 * stride bob, turn lag, spring recoil, reload clips, ADS solved from the sight).
 *
 * A weapon definition in src/game/weapons.js chooses one of:
 *   model: 'carbine' | 'compact' | 'sidearm'     a finished firearm
 *   model: () => heldItem({...})                  anything else held in the hands
 * and a handling preset (pose, sway, recoil feel) with optional overrides:
 *   handling: 'carbine' | 'compact' | 'sidearm' | 'onehand' | 'twohand' | 'thrown'
 *
 * Geometry helpers for building held items are re-exported below. Units are
 * metres; weapon-local origin is the web of the right hand; -Z points away.
 */
export { Assembly, box, blob, latheZ, rodZ, tubeZ, dome, extrude, roundRect, ring, mergeAll } from './geometry.js';
export { Viewmodel, WeaponMaterials };

/** Pose and feel, taken from Claude-of-Duty's src/weapons/defs.js. */
const FIREARM = {
  carbine: {
    hipPos: [0.118, -0.185, -0.3], hipRot: [-0.05, 0.081, -0.135], adsCant: [0, 0, 0.004], eyeRelief: 0.115,
    sprintPos: [0.09, -0.262, -0.275], sprintRot: [-0.4, 0.6, 0.2],
    lowReadyPos: [0.112, -0.28, -0.289], lowReadyRot: [-0.46, 0.125, -0.09],
    swayScale: 1, bobScale: 1, adsTime: 0.22, viewFov: 0.86, rpm: 800,
    reloadTac: 2.1, reloadEmpty: 2.9, inspectTime: 3.2, drawTime: 0.62, holsterTime: 0.4,
    recoil: { pitch: 0.0085, yaw: 0.0022, kickBack: 0.019, kickUp: 0.0072, roll: 0.032, freq: 8.5, damping: 0.42 },
  },
  compact: {
    hipPos: [0.111, -0.163, -0.288], hipRot: [-0.05, 0.072, -0.131], adsCant: [0, 0, 0.005], eyeRelief: 0.104,
    sprintPos: [0.088, -0.24, -0.262], sprintRot: [-0.38, 0.58, 0.19],
    lowReadyPos: [0.108, -0.252, -0.276], lowReadyRot: [-0.44, 0.125, -0.085],
    swayScale: 0.92, bobScale: 0.95, adsTime: 0.185, viewFov: 0.88, rpm: 950,
    reloadTac: 1.85, reloadEmpty: 2.5, inspectTime: 2.9, drawTime: 0.52, holsterTime: 0.35,
    recoil: { pitch: 0.0058, yaw: 0.0026, kickBack: 0.0135, kickUp: 0.0052, roll: 0.026, freq: 10.5, damping: 0.4 },
  },
  sidearm: {
    hipPos: [0.115, -0.15, -0.34], hipRot: [-0.05, 0.066, -0.115], adsCant: [0, 0, 0.003], eyeRelief: 0.34,
    sprintPos: [0.09, -0.25, -0.28], sprintRot: [-0.42, 0.5, 0.14],
    lowReadyPos: [0.1, -0.26, -0.32], lowReadyRot: [-0.44, 0.105, -0.07],
    swayScale: 1.15, bobScale: 1.1, adsTime: 0.16, viewFov: 0.92, rpm: 460,
    reloadTac: 1.6, reloadEmpty: 2.2, inspectTime: 2.6, drawTime: 0.42, holsterTime: 0.3,
    recoil: { pitch: 0.0125, yaw: 0.0032, kickBack: 0.012, kickUp: 0.0105, roll: 0.018, freq: 9, damping: 0.45 },
  },
};

/**
 * Held-item presets, written for this repository. The item's origin is the
 * right hand; tune hipPos/hipRot per item with `npm run capture -- --shots=held`.
 */
const HELD = {
  // club, axe, knife, torch: right hand only, head up and forward
  onehand: {
    // rx < 0 tips the head forward, rz > 0 leans it toward the screen centre
    hipPos: [0.2, -0.28, -0.42], hipRot: [-0.5, 0.12, 0.32], adsCant: [0, 0, 0], eyeRelief: 0.3,
    sprintPos: [0.2, -0.3, -0.3], sprintRot: [0.1, 0.4, -0.2],
    lowReadyPos: [0.2, -0.32, -0.34], lowReadyRot: [-0.2, 0.2, -0.2],
    swayScale: 1.2, bobScale: 1.25, adsTime: 0.25, viewFov: 1, rpm: 120,
    recoil: { pitch: 0.004, yaw: 0.002, kickBack: 0.01, kickUp: 0.004, roll: 0.02, freq: 7, damping: 0.5 },
  },
  // spear, staff, polearm, heavy tool: both hands on a long shaft
  twohand: {
    hipPos: [0.12, -0.2, -0.3], hipRot: [-0.02, 0.1, -0.1], adsCant: [0, 0, 0], eyeRelief: 0.3,
    sprintPos: [0.1, -0.27, -0.27], sprintRot: [-0.3, 0.55, 0.2],
    lowReadyPos: [0.11, -0.28, -0.29], lowReadyRot: [-0.4, 0.12, -0.08],
    swayScale: 1.1, bobScale: 1.1, adsTime: 0.25, viewFov: 1, rpm: 90,
    recoil: { pitch: 0.004, yaw: 0.002, kickBack: 0.02, kickUp: 0.004, roll: 0.01, freq: 7, damping: 0.5 },
  },
  // stone, javelin, sling: held high in the right hand, ready to throw
  thrown: {
    hipPos: [0.2, -0.17, -0.34], hipRot: [0.2, 0.1, -0.15], adsCant: [0, 0, 0], eyeRelief: 0.3,
    sprintPos: [0.2, -0.28, -0.3], sprintRot: [-0.1, 0.4, -0.1],
    lowReadyPos: [0.2, -0.3, -0.34], lowReadyRot: [-0.3, 0.2, -0.1],
    swayScale: 1.2, bobScale: 1.2, adsTime: 0.25, viewFov: 1, rpm: 90,
    recoil: { pitch: 0.003, yaw: 0.002, kickBack: 0.01, kickUp: 0.006, roll: 0.01, freq: 7, damping: 0.5 },
  },
};

/**
 * Rigged arms from a file (asset-arms.js). The asset is framed by its own spec
 * (`pos`, `rot`, `scale`, `fov`), so the hip pose is the identity and the springs
 * only add feel on top of the authored clips; the shot clip carries most of the kick.
 */
const ASSET = {
  asset: {
    hipPos: [0, 0, 0], hipRot: [0, 0, 0], adsCant: [0, 0, 0], eyeRelief: 0.1,
    sprintPos: [-0.02, -0.05, 0.03], sprintRot: [-0.3, 0.42, 0.16],
    lowReadyPos: [0, -0.06, 0.02], lowReadyRot: [-0.3, 0.1, -0.06],
    swayScale: 0.8, bobScale: 0.9, adsTime: 0.24, viewFov: 0.86, rpm: 600,
    recoil: { pitch: 0.005, yaw: 0.0016, kickBack: 0.011, kickUp: 0.004, roll: 0.018, freq: 9, damping: 0.45 },
  },
};

export const HANDLING = { ...FIREARM, ...HELD, ...ASSET };

/**
 * Rig settings for kit/viewmodel/assets/arms-rifle.glb: gloved arms and a rifle,
 * "FPS AK-74m animations" by Cransh, CC-BY-4.0 (credit it; see NOTICES.md). Its
 * authored camera is an FBX node that looks down +X; 0.34 brings it to metres.
 */
export const ARMS_RIFLE = {
  clips: { idle: 'idle', fire: 'fire', reload: 'reload', reloadEmpty: 'reloadEmpty', draw: 'draw' },
  eye: 'Camera',
  eyeForward: '+x',
  scale: 0.34,
  // Hip framing: the rifle enters from the bottom right and points up at the centre,
  // both gloves on it. Measured on `npm run capture -- --shots=held`.
  pos: [0.14, 0.0, -0.15],
  rot: [0.22, 0.26, -0.22],
  fov: 60,
  // Aim: the authored camera already sits behind the iron sights; lift onto the axis.
  ads: { pos: [-0.007, 0.026, 0], rot: [0, 0, 0] },
  // Real albedos under the kit's bright view rig: 0.6 of the light, matte the steel.
  lightScale: 0.6,
  materials: { ak74m: { metalness: 0.3, roughness: 1.3, color: '#8a8a8a' } },
  doubleSided: ['arms'],
  muzzle: 'auto',
  credit: 'Arms and rifle: "FPS AK-74m animations" by Cransh (sketchfab.com/ccransh), CC BY 4.0',
};

/**
 * Bare arms for primitive and melee games: "fps arms (rigged only)" by para
 * (opengameart.org/content/fps-arms-rigged-only), CC0, with its CC0 skin texture,
 * repacked to 0.26 MB. The rig has no clips: bare-arms.js closes the fists, solves
 * the arms to the held item and pins the shoulders, so the kit's procedural layers
 * (sway, bob, lag, swing, thrust, throw, draw dip) read as a body moving. One line:
 *
 *   viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear', material: 'hide' },
 *   model: buildSpear,                    // or buildClub, buildHatchet, or (ctx, mats) => heldItem(...)
 *
 *   hold      'onehand' | 'twohand' | 'thrown' | 'club' | 'hatchet' | 'spear', or
 *             { pos, rot, left: null | { y, roll } } in camera space (see BARE_HOLDS)
 *   holdPose  overrides merged onto the named hold, e.g. { pos: [0.2, -0.25, -0.38] }
 *   material  'skin' | 'hide' | 'leather' | { tint, roughness, wrap, wrapMap } (BARE_MATERIALS)
 *   curl, thumb  finger and thumb joint angles of the fist; pin: how body-fixed the shoulders are
 * Imported only where a weapon spreads it, so a game without it never bundles the file.
 */
export const ARMS_BARE = {
  url: armsBare,
  bare: BareArmsPose,
  hand: 'handR',
  // The rig's origin is the base of the neck; the eye sits ~0.17 m above it.
  pos: [0, -0.165, 0.07],
  rot: [0, 0, 0],
  scale: 1.06,
  fov: 62,
  hold: 'onehand',
  material: 'skin',
  lightScale: 0.6,
};

/** The finished firearms. Each call builds a fresh model. */
export const MODELS = {
  carbine: () => buildRifle(),
  compact: () => buildSmg(),
  sidearm: () => ({ ...buildPistol(), lhandPose: 'cup' }),
};

/**
 * Wrap an Assembly into something the hands can hold.
 *   body      Assembly with the item's geometry (material keys: register them first)
 *   gripR     { pos, finger, back } wrist target for the right hand, in item space
 *   gripL     same for the left hand, or null for a one-handed item
 *   tip       [x,y,z] where projectiles leave and where flashes and sparks start
 *   rhandPose / lhandPose: 'grip' | 'wrap' | 'clamp' | 'cup' | 'open' | 'pinch'
 * A wrist target sits about 0.1 m behind the knuckles along `finger`.
 */
export function heldItem({ id = 'held', body, gripR, gripL = null, tip = [0, 0, -0.4], rhandPose = 'grip', lhandPose = 'clamp', moving = {} }) {
  return {
    id,
    label: id,
    body,
    moving,
    rhandPose,
    lhandPose,
    nodes: { muzzle: tip, sight: [0, 0.06, 0], gripR, gripL },
  };
}

/**
 * Light for the hands and the held item, fixed in VIEW space so they read the
 * same whichever way the player faces: key, fill, rim, warm bounce, sky fill.
 * Directions and the idea follow Claude-of-Duty's render/index.js rig. A game
 * sets the mood with set({ key, fill, rim, bounce, sky, ground, intensity }).
 */
export class ViewLightRig {
  constructor(viewScene) {
    // Claude-of-Duty ran this rig at 2.0 / 0.6 / 1.0 / 0.5 behind an auto-exposure
    // pass that lifts the whole frame; this kit renders at fixed exposure, so the
    // same directions carry about four times the light. Gun albedos are
    // physically dark (anodised alloy is ~0.03 linear) and go black without it.
    this.key = new THREE.DirectionalLight(0xffe8c4, 8);
    this.fill = new THREE.DirectionalLight(0x9ec4ff, 2.4);
    this.rim = new THREE.DirectionalLight(0xffd7a8, 4);
    this.bounce = new THREE.DirectionalLight(0xffb87a, 2);
    this.hemi = new THREE.HemisphereLight(0x8fb6ff, 0x36302a, 1.4);
    this.dirs = [
      [this.key, new THREE.Vector3(-0.45, 0.75, 0.55).normalize()],
      [this.fill, new THREE.Vector3(0.6, -0.15, 0.5).normalize()],
      [this.rim, new THREE.Vector3(0.2, 0.35, -0.9).normalize()],
      [this.bounce, new THREE.Vector3(-0.2, -0.86, 0.47).normalize()],
    ];
    this.base = this.dirs.map(([l]) => l.intensity);
    this.scale = 1;
    for (const [l] of this.dirs) viewScene.add(l, l.target);
    viewScene.add(this.hemi);
    viewScene.environmentIntensity = ENV_OCCLUSION * 2.5;
    this._v = new THREE.Vector3();
  }

  /** Colours as CSS strings or numbers; `intensity` scales the four lamps together. */
  set({ key, fill, rim, bounce, sky, ground, intensity, hemi, env } = {}) {
    if (key !== undefined) this.key.color.set(key);
    if (fill !== undefined) this.fill.color.set(fill);
    if (rim !== undefined) this.rim.color.set(rim);
    if (bounce !== undefined) this.bounce.color.set(bounce);
    if (sky !== undefined) this.hemi.color.set(sky);
    if (ground !== undefined) this.hemi.groundColor.set(ground);
    if (hemi !== undefined) this.hemi.intensity = hemi;
    if (intensity !== undefined) this.scale = intensity;
    if (env !== undefined) this.key.parent && (this.key.parent.environmentIntensity = env);
    return this;
  }

  /**
   * Re-aim every lamp from view space into world space. `weaponScale` is the held
   * weapon's own light response (asset arms with real albedos want less than the
   * kit's physically dark coded guns); it multiplies the game's `intensity`.
   */
  update(anchor, weaponScale = 1) {
    this.dirs.forEach(([l], i) => { l.intensity = this.base[i] * this.scale * weaponScale; });
    for (const [l, d] of this.dirs) {
      this._v.copy(d).applyQuaternion(anchor.quaternion);
      l.position.copy(anchor.position).addScaledVector(this._v, 5);
      l.target.position.copy(anchor.position);
      l.target.updateMatrixWorld();
    }
  }
}
