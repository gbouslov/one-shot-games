#!/usr/bin/env node
/**
 * Retarget humanoid animation clips from Quaternius's Universal Animation Library
 * (CC0, Rigify "DEF-" bones) onto a MakeHuman/MPFB character from the library
 * (CC0, 53 game-engine bones: pelvis, spine_01..., upperarm_l...). Runs at pack time,
 * in node, with no browser: three's maths only.
 *
 *   node tools/anim-retarget.mjs --src=<UAL .glb> --dst=assets/models/human-0278.glb \
 *        --clips=Walk_Loop,Jog_Fwd_Loop,Idle_Loop --out=<file.json> [--fps=30] [--check]
 *
 * Method:
 *   1. Pose-match the rests: the target is A-pose with bent elbows, the source a T-pose.
 *      Walking the target's bones parents-first, each bone is turned so the direction
 *      to its mapped child matches the source's rest direction.
 *   2. Every frame, each source bone's world rotation change from its rest is applied to
 *      the matched target rest, then turned back into a local rotation under the
 *      target's own parent. Hip translation is scaled by the hip-height ratio.
 *   3. --check measures, per frame and bone, the angle between the target's bone
 *      direction and the source's. The rest match makes it near zero when the maths is right.
 * Output: THREE.AnimationClip JSON per clip; track names are `<target bone>.quaternion`
 * and `pelvis.position`, so an AnimationMixer on the packed character plays them.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';

import { fileURLToPath } from 'node:url';

// UAL (Rigify DEF-) -> MPFB (game-engine) bone names. 53 to 53.
const MAP = { root: 'Root', 'DEF-hips': 'pelvis', 'DEF-spine.001': 'spine_01', 'DEF-spine.002': 'spine_02', 'DEF-spine.003': 'spine_03', 'DEF-neck': 'neck_01', 'DEF-head': 'head' };
for (const [s, d] of [['L', 'l'], ['R', 'r']]) {
  Object.assign(MAP, {
    [`DEF-shoulder.${s}`]: `clavicle_${d}`, [`DEF-upper_arm.${s}`]: `upperarm_${d}`, [`DEF-forearm.${s}`]: `lowerarm_${d}`, [`DEF-hand.${s}`]: `hand_${d}`,
    [`DEF-thigh.${s}`]: `thigh_${d}`, [`DEF-shin.${s}`]: `calf_${d}`, [`DEF-foot.${s}`]: `foot_${d}`, [`DEF-toe.${s}`]: `ball_${d}`,
  });
  for (const f of ['index', 'middle', 'pinky', 'ring']) for (const i of [1, 2, 3]) MAP[`DEF-f_${f}.0${i}.${s}`] = `${f}_0${i}_${d}`;
  for (const i of [1, 2, 3]) MAP[`DEF-thumb.0${i}.${s}`] = `thumb_0${i}_${d}`;
}
// The child whose direction defines each bone's aim (target names).
const AIM = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'head' };
for (const d of ['l', 'r']) {
  Object.assign(AIM, { [`clavicle_${d}`]: `upperarm_${d}`, [`upperarm_${d}`]: `lowerarm_${d}`, [`lowerarm_${d}`]: `hand_${d}`, [`hand_${d}`]: `middle_01_${d}`, [`thigh_${d}`]: `calf_${d}`, [`calf_${d}`]: `foot_${d}`, [`foot_${d}`]: `ball_${d}` });
  for (const f of ['index', 'middle', 'pinky', 'ring', 'thumb']) for (const i of [1, 2]) AIM[`${f}_0${i}_${d}`] = `${f}_0${i + 1}_${d}`;
}
const INV = Object.fromEntries(Object.entries(MAP).map(([s, d]) => [d, s]));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** A skeleton: bones parents-first, each with its rest local TRS and the static world matrix above the top bone. */
async function skeleton(file, names) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const set = new Set(joints);
  const parentOf = new Map();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const bones = joints.filter((j) => names(j.getName()));
  const depth = (j) => { let k = 0; let p = parentOf.get(j); while (p && set.has(p)) { k++; p = parentOf.get(p); } return k; };
  bones.sort((a, b) => depth(a) - depth(b));
  const byName = new Map();
  for (const j of bones) {
    const p = parentOf.get(j);
    const above = p && !set.has(p) ? new THREE.Matrix4().fromArray(p.getWorldMatrix()) : null;
    byName.set(j.getName(), {
      name: j.getName(), node: j, parent: p && set.has(p) ? p.getName() : null, above,
      t: new THREE.Vector3(...j.getTranslation()), r: new THREE.Quaternion(...j.getRotation()), s: new THREE.Vector3(...j.getScale()),
    });
  }
  return { doc, root, bones: [...byName.values()], byName };
}

/** Forward kinematics: world quaternion and position of every bone, from local rotations (and optional local positions). */
function fk(sk, localR, localT = new Map()) {
  const W = new Map();
  const P = new Map();
  for (const b of sk.bones) {
    const q = localR.get(b.name) ?? b.r;
    const t = localT.get(b.name) ?? b.t;
    if (b.parent) {
      const pq = W.get(b.parent);
      W.set(b.name, pq.clone().multiply(q));
      P.set(b.name, t.clone().applyQuaternion(pq).add(P.get(b.parent)));
    } else {
      const m = (b.above ?? new THREE.Matrix4()).clone().multiply(new THREE.Matrix4().compose(t, q, b.s));
      const pos = new THREE.Vector3(); const rot = new THREE.Quaternion(); const sc = new THREE.Vector3();
      m.decompose(pos, rot, sc);
      W.set(b.name, rot);
      P.set(b.name, pos);
    }
  }
  return { W, P };
}

/** Retarget clips from `src` (UAL glb path) onto `dst` (MPFB glb path). Returns { clips, report, hipScale, fps }. */
export async function retarget({ src: srcFile, dst: dstFile, clips = null, fps = 30, check = false }) {
  const FPS = fps;
  const args = { src: srcFile, dst: dstFile, clips: clips ? clips.join(',') : null, check };
  const src = await skeleton(args.src, (n) => n in MAP);
  const dst = await skeleton(args.dst, (n) => n in INV);
  const missing = Object.values(MAP).filter((n) => !dst.byName.has(n));
  if (missing.length) console.error('target lacks bones:', missing.join(' '));

  // 1. Pose-match the target's rest to the source's rest, by bone direction.
  const srcRest = fk(src, new Map());
  const dir = (fkr, a, b) => fkr.P.get(b).clone().sub(fkr.P.get(a)).normalize();
  const matched = new Map(dst.bones.map((b) => [b.name, b.r.clone()]));
  for (const b of dst.bones) {
    const aim = AIM[b.name];
    if (!aim || !dst.byName.has(aim)) continue;
    const cur = fk(dst, matched);
    const want = dir(srcRest, INV[b.name], INV[aim]);
    const have = dir(cur, b.name, aim);
    const R = new THREE.Quaternion().setFromUnitVectors(have, want);
    const world = R.multiply(cur.W.get(b.name));
    const parentW = b.parent ? cur.W.get(b.parent) : (() => { const r = new THREE.Quaternion(); (b.above ?? new THREE.Matrix4()).decompose(new THREE.Vector3(), r, new THREE.Vector3()); return r; })();
    matched.set(b.name, parentW.clone().invert().multiply(world));
  }
  const dstRest = fk(dst, matched);
  const hipScale = dst.byName.get('pelvis') ? fk(dst, new Map()).P.get('pelvis').y / srcRest.P.get('DEF-hips').y : 1;

  // 2. Sample each source clip and transfer world-space rotation deltas.
  const wanted = args.clips ? String(args.clips).split(',') : null;
  const anims = src.root.listAnimations().filter((a) => !wanted || wanted.includes(a.getName()));
  const sampleTrack = (sampler, t, size) => {
    const ins = sampler.getInput().getArray();
    const outs = sampler.getOutput().getArray();
    let i = 0;
    while (i < ins.length - 1 && ins[i + 1] < t) i++;
    const j = Math.min(i + 1, ins.length - 1);
    const f = j === i ? 0 : Math.min(1, Math.max(0, (t - ins[i]) / (ins[j] - ins[i])));
    const a = Array.from(outs.slice(i * size, i * size + size));
    const b = Array.from(outs.slice(j * size, j * size + size));
    if (size === 4) return new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), f);
    return new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), f);
  };

  const out = [];
  const report = [];
  for (const anim of anims) {
    const ch = new Map();
    let dur = 0;
    for (const c of anim.listChannels()) {
      const n = c.getTargetNode()?.getName();
      if (!(n in MAP)) continue;
      ch.set(`${n}|${c.getTargetPath()}`, c.getSampler());
      dur = Math.max(dur, c.getSampler().getInput().getMax([])[0]);
    }
    const frames = Math.max(2, Math.round(dur * FPS) + 1);
    const times = [];
    const rot = new Map(dst.bones.map((b) => [b.name, []]));
    const hip = [];
    let errSum = 0; let errMax = 0; let errN = 0;
    const feet = []; const swing = []; const rest0 = fk(dst, new Map()).P.get('ball_l')?.y ?? 0;
    for (let k = 0; k < frames; k++) {
      const t = Math.min(dur, k / FPS);
      times.push(+t.toFixed(4));
      const sR = new Map(); const sT = new Map();
      for (const b of src.bones) {
        const r = ch.get(`${b.name}|rotation`); if (r) sR.set(b.name, sampleTrack(r, t, 4));
        const p = ch.get(`${b.name}|translation`); if (p) sT.set(b.name, sampleTrack(p, t, 3));
      }
      const sW = fk(src, sR, sT);
      const dR = new Map();
      const dW = new Map();
      for (const b of dst.bones) {
        const s = INV[b.name];
        const delta = sW.W.get(s).clone().multiply(srcRest.W.get(s).clone().invert());
        const world = delta.multiply(dstRest.W.get(b.name));
        dW.set(b.name, world);
        const parentW = b.parent ? dW.get(b.parent) : (() => { const r = new THREE.Quaternion(); (b.above ?? new THREE.Matrix4()).decompose(new THREE.Vector3(), r, new THREE.Vector3()); return r; })();
        const local = parentW.clone().invert().multiply(world).normalize();
        dR.set(b.name, local);
        rot.get(b.name).push(...local.toArray().map((v) => +v.toFixed(5)));
      }
      // hip translation: source hip offset from rest, in the target pelvis's parent space
      const pb = dst.byName.get('pelvis');
      const off = sW.P.get('DEF-hips').clone().sub(srcRest.P.get('DEF-hips')).multiplyScalar(hipScale);
      const pW = dW.get(pb.parent);
      const tLocal = pb.t.clone().add(off.applyQuaternion(pW.clone().invert()));
      hip.push(...tLocal.toArray().map((v) => +v.toFixed(5)));
      if (args.check) {
        const dF = fk(dst, dR, new Map([['pelvis', tLocal]]));
        for (const [a, c] of Object.entries(AIM)) {
          if (!dst.byName.has(a) || !dst.byName.has(c)) continue;
          const e = THREE.MathUtils.radToDeg(dir(dF, a, c).angleTo(dir(sW, INV[a], INV[c])));
          errSum += e; errN++; errMax = Math.max(errMax, e);
        }
        // physical sanity the direction check cannot fake: where the feet are, how far the legs swing
        feet.push(Math.min(dF.P.get('ball_l').y, dF.P.get('ball_r').y));
        swing.push(dir(dF, 'thigh_l', 'calf_l').angleTo(new THREE.Vector3(0, -1, 0)) * Math.sign(dir(dF, 'thigh_l', 'calf_l').z));
      }
    }
    const tracks = dst.bones.map((b) => ({ name: `${b.name}.quaternion`, type: 'quaternion', times, values: rot.get(b.name) }));
    tracks.push({ name: 'pelvis.position', type: 'vector', times, values: hip });
    out.push({ name: anim.getName(), duration: +dur.toFixed(4), tracks, uuid: anim.getName(), blendMode: 2500 });
    report.push({ clip: anim.getName(), seconds: +dur.toFixed(2), frames, ...(args.check ? { meanDirErrDeg: +(errSum / errN).toFixed(2), maxDirErrDeg: +errMax.toFixed(2), lowestToeY: +Math.min(...feet).toFixed(3), highestLowToeY: +Math.max(...feet).toFixed(3), restToeY: +rest0.toFixed(3), thighSwingDeg: [+THREE.MathUtils.radToDeg(Math.min(...swing)).toFixed(0), +THREE.MathUtils.radToDeg(Math.max(...swing)).toFixed(0)] } : {}) });
  }
    return { clips: out, report, hipScale: +hipScale.toFixed(3), fps: FPS };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }));
  if (!args.src || !args.dst) {
    console.error('usage: --src=<UAL glb> --dst=<MPFB glb> [--clips=a,b] [--out=file.json] [--fps=30] [--check]');
    process.exit(1);
  }
  const r = await retarget({ src: args.src, dst: args.dst, clips: args.clips ? String(args.clips).split(',') : null, fps: Number(args.fps ?? 30), check: !!args.check });
  if (args.out) writeFileSync(args.out, JSON.stringify({ source: 'Quaternius Universal Animation Library (CC0)', target: args.dst, fps: r.fps, clips: r.clips }));
  console.log(JSON.stringify({ ok: true, clips: r.report.length, hipScale: r.hipScale, report: r.report, out: args.out ?? null }, null, 1));
}
