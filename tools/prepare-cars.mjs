// Small, reproducible source cleanup before `assets.mjs pack file:`.
// Usage: node tools/prepare-cars.mjs <car-concept|v12-goblin|gourami-saloon> <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { metalRough, prune, simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [id, input, output] = process.argv.slice(2);
if (!id || !input || !output) throw new Error('Needs car id, input GLB and output GLB');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();
let changed = 0;
if (id === 'car-concept') {
  // Embedded images have no names: identify the shared trademark map by its
  // documented License material, then detach every use (also emissive logos).
  const texture = root.listMaterials().find(m => m.getName() === 'License')?.getBaseColorTexture();
  if (!texture) throw new Error('Expected CarConcept License texture');
  for (const m of root.listMaterials()) {
    if (m.getBaseColorTexture() === texture) {
      m.setBaseColorTexture(null).setBaseColorFactor([0.12, 0.12, 0.12, 1]);
      changed++;
    }
    if (m.getEmissiveTexture() === texture) {
      m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
      changed++;
    }
  }
  texture.dispose();
  // Fine flake normals alias after texture reduction; keep a smooth car finish.
  for (const material of root.listMaterials()) {
    if (material.getName().startsWith('Paint ')) {
      material.setNormalTexture(null).setRoughnessFactor(Math.max(0.22, material.getRoughnessFactor()));
    }
  }
  for (const wheel of root.listNodes().filter(n => /^Wheel(Front|Rear)[LR]$/.test(n.getName()))) {
    const spin = doc.createNode(wheel.getName() + 'Spin');
    for (const child of wheel.listChildren()) {
      const materials = child.getMesh()?.listPrimitives().map(p => p.getMaterial()?.getName()) ?? [];
      if (materials.includes('Tireside')) child.setName(wheel.getName() + 'Tire');
      if (materials.some(name => ['Tireside', 'Tiretread', 'Rim1', 'Rim2', 'Disc'].includes(name))) {
        spin.addChild(child);
      }
    }
    wheel.addChild(spin);
  }
  // This tiny feature alone retains 8.6k triangles even after simplification.
  // Spend those triangles on visible body curvature instead.
  root.listNodes().find(node => node.getName() === 'BodyWindshieldWipers')?.dispose();
} else if (id === 'v12-goblin' || id === 'gourami-saloon') {
  const materialNames = id === 'v12-goblin'
    ? ['car_shadow', 'clearcoat'] : ['Background', 'FloorTiles', 'FloorChrome', 'FloorColour'];
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      if (materialNames.includes(p.getMaterial()?.getName())) {
        p.dispose();
        changed++;
      }
    }
  }
} else throw new Error(`Unknown cleanup: ${id}`);
if (!changed) throw new Error('No expected source surfaces found');
// Current three.js does not read the retired specular/glossiness extension.
// Convert its real textures instead of shipping a silently black player car.
if (id === 'v12-goblin') {
  await doc.transform(metalRough());
  // The legacy coat is an opaque black duplicate shell in modern renderers.
  // Replace it with a real clearcoat on the existing body, not layered geometry.
  const clearcoat = doc.createExtension(KHRMaterialsClearcoat);
  root.listMaterials().find(m => m.getName() === 'car_body')
    .setExtension('KHR_materials_clearcoat', clearcoat.createClearcoat()
      .setClearcoatFactor(0.8).setClearcoatRoughnessFactor(0.15));
}
await doc.transform(prune());
if (id === 'car-concept') {
  // Budget the visible panels before interiors and rim details. A uniform
  // 15% reduction made the glossy exterior wavy in the source comparison.
  await MeshoptSimplifier.ready;
  await doc.transform(weld());
  const ratios = { 'Paint 1 Carmine': 0.42, 'Paint 2 Carmine': 0.3,
    Glass: 0.18, Rim1: 0.06, Rim2: 0.08, Tireside: 0.4, Tiretread: 0.4 };
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const name = primitive.getMaterial()?.getName() ?? '';
      simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier,
        ratio: ratios[name] ?? 0.04, error: name.startsWith('Paint ') ? 0.002 : 0.08 });
    }
  }
  await doc.transform(prune());
}
await io.write(output, doc);
console.log(JSON.stringify({ id, changed, output }));
