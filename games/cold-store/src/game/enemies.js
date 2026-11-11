import * as THREE from 'three';
import { assets } from '../assets/index.js';

/**
 * What came in on the last truck: the night shift, frozen and thawing.
 * Realistic rigged workers (MakeHuman, CC0, through Patch). The walkers move
 * with motion-captured clips (Quaternius Universal Animation Library, CC0,
 * retargeted onto these bodies at pack time); the crawler is posed by code. Skin tinted cold and grey-blue, eyes
 * milky, so the flashlight finds them; they make no light of their own.
 *   thawed       a worker in overalls, arms out, shuffling
 *   rimecrawler  a worker on all fours, low and fast
 *   foreman      the heavyset one in frozen hi-vis overalls and a hard hat
 */
const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head',
  'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

/** Bones by name, each with its rest rotation and its parent's rest frame. */
function rig(root) {
  root.updateMatrixWorld(true);
  const r = {};
  root.traverse((o) => {
    if (!o.isBone || !BONES.includes(o.name) || r[o.name]) return;
    const P = o.parent.getWorldQuaternion(new THREE.Quaternion());
    r[o.name] = { bone: o, rest: o.quaternion.clone(), P, Pi: P.clone().invert(), W: o.getWorldQuaternion(new THREE.Quaternion()) };
  });
  return r;
}
/** Rotate a bone in character space (+z forward, +y up, +x the body's left), on top of its parent. */
function pose(r, name, x = 0, y = 0, z = 0) {
  const b = r[name];
  if (!b) return;
  _q.setFromEuler(_e.set(x, y, z));
  b.bone.quaternion.copy(b.Pi).multiply(_q).multiply(b.P).multiply(b.rest);
}
/** Hang an object on a bone, upright in character space at rest. */
function attach(r, name, obj, x, y, z) {
  const b = r[name];
  const inv = b.W.clone().invert();
  obj.quaternion.copy(inv);
  obj.position.set(x, y, z).applyQuaternion(inv);
  b.bone.add(obj);
}

/** Thawed flesh: the skin texture drained of colour and cooled, with a pale cyan rim so they lift off the dark. */
// Frost: rime on whatever faces up (shoulders, scalp, the tops of the arms), broken up by a
// cheap hash so it reads as crystals, not paint. Shared by skin and clothes.
const FROST_GLSL = `
        float frostUp = smoothstep(0.25, 0.85, normalize(vNormal).y);
        vec2 fq = floor(gl_FragCoord.xy * 0.5);
        float fh = fract(sin(dot(fq, vec2(12.9898, 78.233))) * 43758.5453);
        float frostK = frostUp * (0.55 + 0.45 * fh);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.93, 1.0), frostK * 0.6);`;
function frozen(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), 0.7) * vec3(0.82, 0.9, 1.0);${FROST_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, frostK);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.32, 0.55, 0.7) * rimF * 0.35;`);
  };
  mat.customProgramCacheKey = () => 'frozen-skin';
}
/** Frozen cloth: frost on the up-facing folds, and a dark wet band where it is thawing. */
function frozenCloth(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>${FROST_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wet = (1.0 - frostUp) * smoothstep(0.2, -0.4, normalize(vNormal).y);
        diffuseColor.rgb *= 1.0 - wet * 0.35;
        roughnessFactor = mix(roughnessFactor, 0.32, wet);`);
  };
  mat.customProgramCacheKey = () => 'frozen-cloth';
}

function worker(id, { skin = '#8a97a1', suit = null, eyes = '#7fb4d8', anims = null } = {}) {
  const outer = new THREE.Group();
  const char = anims ? assets.character(id, { anims }) : null;
  const m = char ? char.object : assets.model(id);
  outer.add(m);
  outer.userData.char = char;
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = true;
    const mat = o.material.clone();
    const n = mat.name;
    if (n.endsWith('.body')) {
      mat.color.set(skin);
      mat.roughness = 0.38; // thawing: a wet sheen the flashlight catches
      frozen(mat);
    } else if (n.endsWith('.high-poly')) {
      // the eyes: milky, with a faint cold glint
      mat.color.set('#cfdde6');
      mat.emissive?.set(eyes);
      mat.emissiveIntensity = 0.25;
    } else if (n.includes('worksuit') && suit) {
      mat.color.set(suit);
      mat.roughness = 0.9;
      frozenCloth(mat);
    } else if (n.includes('worksuit')) {
      mat.color.set('#646d78'); // grimy, and cold
      mat.roughness = 0.85;
      frozenCloth(mat);
    } else {
      // undershirts and the rest: a pale shirt blooms white under the torch, so stain it
      mat.color.multiplyScalar(0.55).lerp(new THREE.Color('#5c6670'), 0.25);
      mat.roughness = Math.max(mat.roughness ?? 0.8, 0.85);
    }
    o.material = mat;
  });
  m.position.z = 0.12; // the rig stands 12 cm behind its origin
  outer.userData.rig = rig(m);
  outer.userData.inner = m;
  return outer;
}

function buildThawed() {
  return worker('human-0278', { anims: 'anims-human-0278' });
}

function buildForeman() {
  const g = worker('human-0440', { suit: '#b88216', skin: '#87939d', anims: 'anims-human-0440' });
  g.scale.setScalar(1.3);
  const r = g.userData.rig;
  const hat = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#c99a12', roughness: 0.55 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  dome.scale.set(1, 0.85, 1.12);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.012, 24), shell);
  brim.position.set(0, 0.005, 0.03);
  const frost = new THREE.Mesh(new THREE.SphereGeometry(0.137, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3.2),
    new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.25, transparent: true, opacity: 0.55 }));
  frost.scale.copy(dome.scale);
  for (const o of [dome, brim, frost]) {
    o.castShadow = true;
    hat.add(o);
  }
  attach(r, 'head', hat, 0, 0.13, 0.01);
  return g;
}

function buildCrawler() {
  const g = worker('human-0278', { skin: '#8e9ba5' });
  const r = g.userData.rig;
  g.userData.inner.position.y = -0.52;
  g.userData.inner.scale.set(1, 0.9, 1.22); // lower and longer than a man on all fours
  pose(r, 'pelvis', 1.42, 0, 0);
  g.userData.crawl = true;
  return g;
}

const NUDGED = ['spine_01', 'spine_02', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'neck_01'];
/** Add a small rotation, in character space, on top of whatever the clip set this frame. */
function nudge(r, name, x = 0, y = 0, z = 0) {
  const b = r[name];
  if (!b) return;
  _q.setFromEuler(_e.set(x, y, z));
  b.bone.quaternion.premultiply(b.P).premultiply(_q).premultiply(b.Pi);
}

/**
 * Clip playback for the walkers. e.state picks the clip; the move clip's speed
 * follows how fast the body is actually travelling, so feet don't skate.
 *   move     the locomotion clip, and the ground speed (m/s) it covers at 1x
 *   impact   seconds into Punch_Cross where the fist lands
 */
function animateClips(e, dt, t, { move = 'Jog_Fwd_Loop', stride = 3.0, impact = 0.45 } = {}) {
  const c = e.model.userData.char;
  const atk = e.def.attack;
  const scale = e.model.scale.x;
  switch (e.state) {
    case 'dying':
      c.play('Death01', { loop: false, fade: 0.12 });
      break;
    case 'stagger':
      c.play('Hit_Chest', { loop: false, fade: 0.06, speed: 0.33 / Math.max(0.12, e.def.stagger) });
      break;
    case 'windup':
      c.play('Punch_Cross', { loop: false, fade: 0.1, speed: impact / atk.windup });
      break; // the lunge nudge below throws the body and both hands forward over the punch
    case 'strike':
      break; // the punch carries through its follow-through
    default: {
      const moving = e.moved > 0.2;
      if (moving) {
        const a = c.play(move, { fade: 0.25 });
        a.timeScale = Math.min(1.6, Math.max(0.5, e.moved / (stride * scale)));
      } else {
        c.play('Idle_Loop', { fade: 0.3 });
      }
    }
  }
  // The mixer only writes a bone when its clip value changes, so put back the
  // clip's own pose before updating; otherwise last frame's nudges pile up.
  const r = e.model.userData.rig;
  const st = (e.st ??= { reach: 0, saved: new Map() });
  for (const [b, q] of st.saved) b.quaternion.copy(q);
  c.update(dt);
  if (e.state === 'dying') return;
  for (const n of NUDGED) {
    const b = r[n]?.bone;
    if (!b) continue;
    if (!st.saved.has(b)) st.saved.set(b, new THREE.Quaternion());
    st.saved.get(b).copy(b.quaternion);
  }
  // still thawing: a hunched, lurching shamble with the arms hanging low and loose, one side
  // stiff; on the wind-up the whole body lunges forward with both hands out
  const reach = e.state === 'chase' || e.state === undefined ? 1 : 0;
  st.reach += (reach - st.reach) * Math.min(1, dt * 6);
  const lungeT = e.state === 'windup' ? 1 : 0;
  st.lunge = (st.lunge ?? 0) + (lungeT - (st.lunge ?? 0)) * Math.min(1, dt * 10);
  if (st.reach > 0.01) {
    const k = st.reach;
    const lurch = Math.sin(t * 5.2 + e.id) * 0.14;
    nudge(r, 'spine_01', 0.34 * k, 0, lurch * k);
    nudge(r, 'spine_02', 0.2 * k, 0.08 * k, 0);
    nudge(r, 'upperarm_l', 0.12 * k, 0, 0.3 * k);
    nudge(r, 'upperarm_r', 0.28 * k, 0, -0.18 * k);
    nudge(r, 'lowerarm_l', -0.45 * k, 0, 0);
    nudge(r, 'lowerarm_r', -0.1 * k, 0, 0);
  }
  if (st.lunge > 0.01) {
    const k = st.lunge;
    nudge(r, 'spine_01', 0.42 * k, 0, 0);
    nudge(r, 'upperarm_l', -1.05 * k, 0, 0.1 * k);
    nudge(r, 'upperarm_r', -1.05 * k, 0, -0.1 * k);
  }
  // the head hangs to one side and twitches
  const tw = Math.sin(t * 17 + e.id) > 0.93 ? 0.35 : 0;
  nudge(r, 'neck_01', -0.12, Math.sin(t * 0.6 + e.id) * 0.12, 0.28 + tw);
}

function animateCrawler(e, dt, t) {
  const r = e.model.userData.rig;
  const moving = e.moved > 0.2;
  const ph = t * 13 + e.id;
  const s = moving ? Math.sin(ph) * 0.45 : 0;
  // pelvis pitched forward; legs back under it with knees down, arms planted
  pose(r, 'thigh_l', -1.2 - s, 0, 0.1);
  pose(r, 'thigh_r', -1.2 + s, 0, -0.1);
  pose(r, 'calf_l', 1.5, 0, 0);
  pose(r, 'calf_r', 1.5, 0, 0);
  const lunge = e.state === 'windup' ? -0.5 : e.state === 'strike' ? 0.6 : 0;
  pose(r, 'upperarm_l', -1.3 + s + lunge, 0, -0.72);
  pose(r, 'upperarm_r', -1.3 - s + lunge, 0, 0.72);
  pose(r, 'lowerarm_l', 0.15, 0, 0);
  pose(r, 'lowerarm_r', 0.15, 0, 0);
  pose(r, 'hand_l', -1.2, 0, 0);
  pose(r, 'hand_r', -1.2, 0, 0);
  pose(r, 'spine_03', -0.2, 0, 0);
  pose(r, 'neck_01', -1.0, Math.sin(t * 3 + e.id) * 0.25, 0);
  e.model.userData.inner.position.y = -0.52 + (moving ? Math.abs(Math.sin(ph)) * 0.04 : 0);
}

export const enemies = [
  {
    id: 'thawed', hp: 75, speed: 3.3, radius: 0.4, height: 1.8, headFrom: 0.88, stagger: 0.18,
    blood: '#7a1a14', spawnColor: '#9fd0ff', hitColor: 0xd0e4ff, telegraphHz: 120,
    attack: { kind: 'melee', range: 1.8, damage: 8, windup: 0.5, cooldown: 1.2, recover: 0.3 },
    deathHold: 3.2,
    build: buildThawed, animate: (e, dt, t) => animateClips(e, dt, t),
  },
  {
    id: 'rimecrawler', hp: 40, speed: 5.6, radius: 0.45, height: 0.85, headFrom: 0.7, stagger: 0.1,
    blood: '#7a1a14', spawnColor: '#9fd0ff', hitColor: 0xd0e4ff, telegraphHz: 300,
    attack: { kind: 'melee', range: 1.4, damage: 7, windup: 0.3, cooldown: 1.0, recover: 0.3 },
    build: buildCrawler, animate: animateCrawler,
  },
  {
    id: 'foreman', hp: 320, speed: 2.4, radius: 0.6, height: 2.3, headFrom: 0.9, stagger: 0,
    blood: '#7a1a14', spawnColor: '#ffb35a', hitColor: 0xffd0a0, telegraphHz: 80,
    attack: { kind: 'melee', range: 2.4, damage: 24, windup: 0.7, cooldown: 1.7, recover: 0.5 },
    deathHold: 3.2,
    build: buildForeman, animate: (e, dt, t) => animateClips(e, dt, t, { move: 'Walk_Loop', stride: 1.4, impact: 0.45 }),
  },
];
