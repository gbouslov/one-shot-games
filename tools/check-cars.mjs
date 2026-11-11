// Actual library/three.js parsing and wheel checks, with sharp decoding the
// embedded images in Node. This is deliberately not a WebGL rendering test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import sharp from 'sharp';
import { createLibrary } from '../assets/runtime/library.js';

globalThis.self = globalThis;
let images = 0;
globalThis.createImageBitmap = async blob => {
  const { info, data } = await sharp(Buffer.from(await blob.arrayBuffer()))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  images++;
  return { width: info.width, height: info.height, data, close() {} };
};
const ids = ['car-concept', 'v12-goblin', 'gourami-saloon', 'coupeox', 'offroad-buggy'];
const catalog = JSON.parse(readFileSync('assets/catalog.json')).assets;
const entries = {};
for (const id of ids) {
  const entry = catalog.find(a => a.id === id);
  const file = readFileSync('assets/' + entry.file);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
  assert(!(json.extensionsRequired ?? []).some(x => /draco|meshopt|basisu/.test(x)), id);
  assert(!(json.extensionsUsed ?? []).includes('KHR_materials_pbrSpecularGlossiness'), id);
  assert(entry.tris <= 40000 && entry.inline_kb < 8000, id + ' budget');
  assert.equal(entry.bytes, file.length, id + ' bytes');
  entries[id] = { ...entry, data: file.toString('base64') };
}
const lib = await createLibrary(entries);
const report = { kind: 'Node library parse; CPU bitmap decode; no WebGL', images, models: [] };
for (const id of ids) {
  const first = lib.model(id), second = lib.model(id);
  first.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(first);
  const size = bounds.getSize(new THREE.Vector3()).toArray();
  let sceneTris = 0;
  first.traverse(o => { if (o.isMesh) sceneTris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  assert(sceneTris <= 40000, id + ' actual scene triangles');
  const wheelNames = id === 'car-concept'
    ? ['WheelFrontLSpin', 'WheelFrontRSpin', 'WheelRearLSpin', 'WheelRearRSpin']
    : id === 'v12-goblin' ? ['bone_rotation_FL', 'bone_rotation_FR', 'bone_rotation_BL', 'bone_rotation_BR'] : [];
  for (const name of wheelNames) {
    const wheel = first.getObjectByName(name), other = second.getObjectByName(name);
    assert(wheel && other, id + ' wheel ' + name);
    const before = wheel.getWorldPosition(new THREE.Vector3());
    const untouched = other.quaternion.clone();
    wheel.rotateOnAxis(new THREE.Vector3(1, 0, 0), 0.7);
    first.updateMatrixWorld(true);
    assert(before.distanceTo(wheel.getWorldPosition(new THREE.Vector3())) < 1e-6, name + ' stable pivot');
    assert(other.quaternion.equals(untouched), name + ' independent clones');
  }
  report.models.push({ id, size_m: size, actual_scene_tris: sceneTris, wheel_groups_checked: wheelNames,
    sha256: createHash('sha256').update(readFileSync('assets/' + entries[id].file)).digest('hex') });
}
const credits = lib.credits();
for (const entry of Object.values(entries)) assert(credits.includes(entry.credit), entry.id + ' complete credit');
report.credits = credits;
writeFileSync('references/audit/cars-1111/runtime-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, models: report.models.length, images, wheel_groups: 8,
  actual_scene_tris: report.models.map(m => [m.id, m.actual_scene_tris]) }));
