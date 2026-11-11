import * as THREE from 'three';
import { loadModel, scatter } from '../kit/world/scatter.js';
import { glowTexture } from '../kit/textures/textures.js';
import { Rng } from '../kit/core/rng.js';
// Ready-made models (credits in NOTICES.md). Imported as URLs so the build inlines them.
import broadleafUrl from './assets/tree-broadleaf/tree_default.glb?url';
import pineUrl from './assets/tree-pine/tree_pineRoundA.glb?url';
import palmUrl from './assets/tree-palm/tree_palmTall.glb?url';
import lighthouseUrl from './assets/lighthouse/old-lighthouse.glb?url';

/**
 * Island dressing: palms on the beaches, broadleaf trees on the lower slopes,
 * round pines higher up, and one lighthouse on a headland near the start with
 * its lamp lit for the evening. Placement is deterministic from the world seed.
 * The tree models are pastel; each instance is re-tinted here to the palette.
 */
export async function buildProps(ctx, field, config, course, palette) {
  const q = ctx.config.q;
  const rng = new Rng(config.worldSeed * 104729 + 3);
  const [broadleaf, pine, palm, lighthouse] = await Promise.all([broadleafUrl, pineUrl, palmUrl, lighthouseUrl].map(loadModel));

  const want = { low: 1100, medium: 2600, high: 4200 }[ctx.config.quality] ?? 2000;
  const lists = { broadleaf: [], pine: [], palm: [] };
  const half = field.size / 2 - 50;
  const slopeAt = (x, z) => Math.hypot(field.at(x + 6, z) - field.at(x - 6, z), field.at(x, z + 6) - field.at(x, z - 6)) / 12;
  const placed = [];
  for (let tries = 0; tries < want * 30 && placed.length < want; tries++) {
    // Clumps: most trees sit near another one.
    let x;
    let z;
    const prev = placed.length && rng.float() < 0.7 ? rng.pick(placed) : null;
    if (prev) {
      x = prev.x + rng.range(-45, 45);
      z = prev.z + rng.range(-45, 45);
    } else {
      x = rng.range(-half, half);
      z = rng.range(-half, half);
    }
    const h = field.at(x, z);
    if (h < 1.6) continue;
    const slope = slopeAt(x, z);
    if (slope > 0.75) continue;
    const ry = rng.range(0, Math.PI * 2);
    const tilt = () => rng.range(-0.06, 0.06);
    let t = null;
    if (h < 9) {
      // The models are about 1.5 m tall; trees here are 11 to 19 m, a little
      // larger than life so a forest reads from a few hundred metres up.
      if (rng.float() < 0.5) lists.palm.push((t = { x, y: h - 0.3, z, s: rng.range(7.5, 10), ry, rx: tilt(), rz: tilt() }));
    } else if (h < 150) {
      lists.broadleaf.push((t = { x, y: h - 0.5, z, s: rng.range(7, 10.5), ry, rx: tilt(), rz: tilt() }));
    } else if (h < 330 && slope < 0.6) {
      lists.pine.push((t = { x, y: h - 0.5, z, s: rng.range(9, 13), ry }));
    }
    if (t) placed.push(t);
  }

  const leaf = [new THREE.Color(palette.forest), new THREE.Color(palette.grass), new THREE.Color('#47662f'), new THREE.Color('#5a6f2c')];
  const pineLeaf = [new THREE.Color('#24402a'), new THREE.Color('#2e4a2a'), new THREE.Color('#1f3a2c')];
  const palmLeaf = [new THREE.Color('#5d8a35'), new THREE.Color('#6f913b'), new THREE.Color('#4f7a2e')];
  const trunk = new THREE.Color('#6b5240');
  const isLeaf = (m) => m.color && m.color.g > m.color.r;
  const tinter = (set) => (m, i, out) => (isLeaf(m) ? out.copy(set[i % set.length]) : out.copy(trunk));
  const flat = (src) => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, flatShading: true, side: src.side });

  const group = new THREE.Group();
  group.name = 'props';
  group.add(scatter(broadleaf, lists.broadleaf, { tint: tinter(leaf), material: flat }));
  group.add(scatter(pine, lists.pine, { tint: tinter(pineLeaf), material: flat }));
  group.add(scatter(palm, lists.palm, { tint: tinter(palmLeaf), material: flat }));

  // Lighthouse on the coastal point nearest the first legs of the course.
  const near = [course.start.pos, course.gates[0].pos, course.gates[1].pos];
  let best = null;
  for (let i = 0; i < 4000; i++) {
    const a = near[i % near.length];
    const x = a.x + rng.range(-700, 700);
    const z = a.z + rng.range(-700, 700);
    const h = field.at(x, z);
    if (h < 6 || h > 40 || slopeAt(x, z) > 0.35) continue;
    let sea = 0;
    for (let k = 0; k < 12; k++) if (field.at(x + Math.cos(k * 0.5236) * 90, z + Math.sin(k * 0.5236) * 90) < 0) sea++;
    if (sea < 3) continue;
    const score = sea - Math.hypot(x - a.x, z - a.z) / 300;
    if (!best || score > best.score) best = { x, z, h, score };
  }
  if (best) {
    const lh = lighthouse;
    lh.scale.setScalar(2.4);
    lh.position.set(best.x, best.h - 1, best.z);
    lh.rotation.y = rng.range(0, Math.PI * 2);
    lh.traverse((o) => {
      if (o.isMesh) o.castShadow = q.shadowSize > 0;
    });
    group.add(lh);
    const box = new THREE.Box3().setFromObject(lh);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: '#ffd28a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    lamp.position.set(best.x, box.max.y - 4.5, best.z);
    lamp.scale.setScalar(22);
    group.add(lamp);
    group.userData.lighthouse = lh.position.clone();
  }
  group.userData.counts = { broadleaf: lists.broadleaf.length, pine: lists.pine.length, palm: lists.palm.length };
  return group;
}
