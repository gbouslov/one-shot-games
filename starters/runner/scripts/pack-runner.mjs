// Keep only the clips the runner uses from KayKit's Rogue_Hooded (CC0, via Patch), prune, write.
// Step 1 of 2 for src/game/assets/courier/rogue-hooded-runner.glb (then recolor.mjs).
//   node starters/runner/scripts/pack-runner.mjs <Rogue_Hooded.glb> <out.glb>
// Needs @gltf-transform/core, /extensions, /functions installed where NODE_TOOLS points
// (default: the repo's .scratch/tools, which is not committed).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_TOOLS ?? new URL('../../../.scratch/tools/package.json', import.meta.url));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { prune, dedup } = require('@gltf-transform/functions');

const KEEP = new Set(['Idle_A', 'Running_A', 'Running_B', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Jump_Full_Short', 'Dodge_Forward', 'Hit_A', 'Death_A', 'Cheering', 'Crouching']);
const [inFile, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.readBinary(new Uint8Array(fs.readFileSync(inFile)));
for (const a of doc.getRoot().listAnimations()) {
  if (KEEP.has(a.getName())) continue;
  for (const s of a.listSamplers()) s.dispose();
  for (const c of a.listChannels()) c.dispose();
  a.dispose();
}
// Accessors no longer used by anything (the disposed clips' keyframes).
for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().filter((p) => p.propertyType !== 'Root').length === 0) acc.dispose();
await doc.transform(prune({ keepLeaves: true }), dedup());
fs.writeFileSync(out, await io.writeBinary(doc));
console.log('kept', doc.getRoot().listAnimations().map((a) => a.getName()).join(','), fs.statSync(out).size, 'bytes');
