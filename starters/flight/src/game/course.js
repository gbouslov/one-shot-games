import * as THREE from 'three';
import { glowTexture } from '../kit/textures/textures.js';
import { Rng } from '../kit/core/rng.js';

/**
 * The course: ten octagonal lantern gates strung between the islands.
 * Placement is deterministic from the seed: each leg tries several bearings
 * and keeps the one that runs past the most coastline without crossing high
 * ground, and every gate sits high enough that the straight line to the next
 * one clears the land by at least `height[0]` metres.
 */
export function buildCourse(ctx, field, rules, sunDir, worldSeed = 11) {
  const rng = new Rng(worldSeed * 7919 + 17);
  const R = rules.course;
  const sunHeading = Math.atan2(sunDir[0], -sunDir[2]);
  const ground = (x, z) => Math.max(0, field.at(x, z));
  // Start over open water on the far side from the sun, with low ground ahead,
  // so the first legs fly into the light.
  let heading = sunHeading - 0.25;
  let start = null;
  let bestStart = -Infinity;
  for (let a = 0; a < 24; a++) {
    for (const r of [1500, 1800, 2100]) {
      const ang = sunHeading + Math.PI + (a / 24 - 0.5) * 2.2;
      const s = new THREE.Vector3(Math.sin(ang) * r, 0, -Math.cos(ang) * r);
      if (field.at(s.x, s.z) > -5) continue;
      const ahead = new THREE.Vector3(s.x + Math.sin(heading) * 600, 0, s.z - Math.cos(heading) * 600);
      const score = -field.maxAlong(s, ahead) / 40 + coastNear(field, ahead) - Math.abs(r - 1800) / 600;
      if (score > bestStart) {
        bestStart = score;
        start = s;
      }
    }
  }
  start ??= new THREE.Vector3(-700, 0, 1700);
  const coast = (x, z) => coastNear(field, { x, z });

  const pts = [];
  let p = start.clone();
  for (let i = 0; i < R.gates; i++) {
    let best = null;
    for (let c = 0; c < 9; c++) {
      const h = heading + (c / 8 - 0.5) * 2 * R.turn;
      const len = rng.range(R.spacing[0], R.spacing[1]);
      const q = new THREE.Vector3(p.x + Math.sin(h) * len, 0, p.z - Math.cos(h) * len);
      const hi = field.maxAlong(p, q);
      const r = Math.hypot(q.x, q.z);
      // Prefer coastline, a low leg, staying inside the map, and heading back toward the middle late on.
      let score = coast(q.x, q.z) * 2 - hi / 90 - Math.max(0, r - 2000) / 150;
      if (i >= R.gates / 2) score -= q.distanceTo(start) / 2500;
      score += rng.range(0, 0.4);
      if (!best || score > best.score) best = { score, q, h };
    }
    pts.push(best.q);
    heading = best.h;
    p = best.q;
  }

  // Heights: high enough that each straight leg clears the ground.
  const all = [start, ...pts];
  const legMax = [];
  for (let i = 1; i < all.length; i++) legMax.push(field.maxAlong(all[i - 1], all[i]));
  for (let i = 0; i < pts.length; i++) {
    const need = Math.max(legMax[i], legMax[i + 1] ?? 0);
    pts[i].y = need + rng.range(R.height[0], R.height[1]);
  }
  // High enough to fly straight on for a while before the first gate's line is needed.
  const h0 = Math.atan2(pts[0].x - start.x, -(pts[0].z - start.z));
  const runOn = new THREE.Vector3(start.x + Math.sin(h0) * 1400, 0, start.z - Math.cos(h0) * 1400);
  start.y = Math.max(legMax[0] + R.height[0], field.maxAlong(start, runOn) + 60, 120);

  const gates = pts.map((pos, i) => {
    const prev = i === 0 ? start : pts[i - 1];
    const next = pts[i + 1];
    const din = new THREE.Vector3().subVectors(pos, prev).normalize();
    const n = din.clone();
    if (next) n.add(new THREE.Vector3().subVectors(next, pos).normalize());
    n.y *= 0.5;
    n.normalize();
    return { pos, normal: n, radius: R.radius, index: i };
  });

  const view = buildGateMeshes(ctx, gates);
  return {
    gates,
    start: { pos: start, heading: Math.atan2(pts[0].x - start.x, -(pts[0].z - start.z)) },
    group: view.group,
    update: view.update,
    burst: view.burst,
    reset: view.reset,
  };
}

/** 1+ when the point has both land and sea within 320 m (a coastline), else 0. */
function coastNear(field, p) {
  let n = 0;
  for (let a = 0; a < 8; a++) {
    const h = field.at(p.x + Math.cos(a * 0.785) * 320, p.z + Math.sin(a * 0.785) * 320);
    if (h > 4) n++;
  }
  return n > 0 && n < 8 ? 1 + Math.min(n, 8 - n) * 0.25 : 0;
}

function buildGateMeshes(ctx, gates) {
  const group = new THREE.Group();
  group.name = 'gates';
  const glow = glowTexture(64);
  const items = [];
  for (const g of gates) {
    const root = new THREE.Group();
    root.position.copy(g.pos);
    root.lookAt(g.pos.clone().add(g.normal));
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.45, metalness: 0.6, emissive: new THREE.Color('#ffb35c'), emissiveIntensity: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(g.radius, 0.75, 6, 8), frameMat);
    ring.rotation.z = Math.PI / 8;
    root.add(ring);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3) });
    const spriteMat = new THREE.SpriteMaterial({ map: glow, color: '#ffb866', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    const lampGeo = new THREE.SphereGeometry(1.15, 10, 8);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(Math.cos(a) * g.radius, Math.sin(a) * g.radius, 0);
      root.add(lamp);
      const s = new THREE.Sprite(spriteMat);
      s.scale.setScalar(11);
      s.position.copy(lamp.position);
      root.add(s);
    }
    group.add(root);
    items.push({ root, frameMat, lampMat, spriteMat, passed: 0, base: g.pos.y });
  }

  const reset = () => {
    for (const it of items) {
      it.passed = 0;
      it.root.visible = true;
      it.root.scale.setScalar(1);
    }
  };

  const burst = (i) => {
    if (items[i]) items[i].passed = 0.0001;
  };

  const update = (dt, time, next) => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.passed > 0) {
        it.passed += dt;
        const k = Math.min(1, it.passed / 0.7);
        it.root.scale.setScalar(1 + k * 0.6);
        it.spriteMat.opacity = 0.9 * (1 - k);
        it.lampMat.color.setRGB(3 * (1 - k) + 0.1, 3.2 * (1 - k) + 0.1, 2 * (1 - k) + 0.1);
        if (k >= 1) it.root.visible = false;
        continue;
      }
      const active = i === next;
      const pulse = active ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
      it.frameMat.emissiveIntensity = active ? 0.9 + pulse * 1.4 : i < next + 3 ? 0.3 : 0.15;
      const b = active ? 3.5 + pulse * 2.5 : i < next + 3 ? 1.6 : 0.9;
      it.lampMat.color.setRGB(1.0 * b, 0.82 * b, 0.55 * b);
      it.spriteMat.opacity = active ? 0.65 + pulse * 0.35 : 0.3;
      it.root.position.y = it.base + Math.sin(time * 0.8 + i) * 0.6;
    }
  };
  return { group, update, burst, reset };
}
