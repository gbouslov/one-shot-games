import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Load a GLB (an imported `?url`, inlined as a data URL in the build) and
 * scatter many copies of it as InstancedMeshes: one draw call per material,
 * however many copies. Per-instance colour lets one model read as a varied
 * forest.
 *
 *   const tpl = await loadModel(url)
 *   const group = scatter(tpl, transforms, { tint: (material, i, out) => out.set(...) })
 *     transforms: [{ x, y, z, s, ry }]
 *
 * Written for this repository.
 */
const loader = new GLTFLoader();
// Embedded images through <img>, never fetch(): a fetch of a blob: URL is blocked
// under the artifact page's connect-src policy (as starters/survival does).
loader.register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: 'img-textures' };
});

/**
 * Bytes of an imported asset. The build inlines assets as data: URLs, and a
 * Claude artifact's CSP blocks fetch() of data: URLs (connect-src), so decode
 * them here; in `npm run dev` the import is a real path and is fetched.
 */
export async function assetBytes(url) {
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(url)).arrayBuffer();
}

/** Models without external files or textures (a plain GLB). */
export async function loadModel(url) {
  const gltf = await loader.parseAsync(await assetBytes(url), '');
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** The whole glTF (scene, animations): for rigged, animated characters. */
export async function loadGltf(url) {
  return loader.parseAsync(await assetBytes(url), '');
}

export function scatter(template, transforms, { tint, castShadow = false, receiveShadow = false, material } = {}) {
  const group = new THREE.Group();
  const parts = [];
  template.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const mat = material ? material(src) : src.clone();
    parts.push({ geo, mat, src });
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geo, part.mat, transforms.length);
    transforms.forEach((t, i) => {
      e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
      q.setFromEuler(e);
      m.compose(p.set(t.x, t.y, t.z), q, s.set(t.s, t.s * (t.sy ?? 1), t.s));
      mesh.setMatrixAt(i, m);
      if (tint) mesh.setColorAt(i, tint(part.src, i, c) ?? c.set('#ffffff'));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
