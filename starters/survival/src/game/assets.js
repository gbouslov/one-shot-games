import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Downloaded CC0 assets from Patch's free library (Poly Haven scans; credits in
 * NOTICES.md and third_party/NOTICES.md). Vite inlines each file as a data URL;
 * GLBs are parsed from bytes and images go through <img>, so nothing is fetched
 * from the network. The GLBs were repacked without meshopt compression
 * (games/caveman/scripts/decode-meshopt.mjs), because the artifact page blocks
 * WebAssembly.
 */
import rockUrl from './assets/rockface/rock_face_01.glb?url';
import trunkUrl from './assets/trunk/dead_tree_trunk.glb?url';
import leavesColorUrl from './assets/leaves/forest_leaves_02_baseColor_preview.jpg?url';
import leavesNormalUrl from './assets/leaves/forest_leaves_02_normal_preview.jpg?url';
import leavesRoughUrl from './assets/leaves/forest_leaves_02_roughness_preview.jpg?url';

async function bytes(url) {
  if (url.startsWith('data:')) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(url)).arrayBuffer();
}

function gltfLoader() {
  const loader = new GLTFLoader();
  // embedded images through <img>, never fetch(): fetch of a blob: URL breaks under the artifact policy
  loader.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    return { name: 'img-textures' };
  });
  return loader;
}

/** The first mesh in a GLB, baked to world space, with its bounding box measured. */
async function loadMesh(url) {
  const gltf = await gltfLoader().parseAsync(await bytes(url), '');
  let mesh = null;
  gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  return { geometry, material: mesh.material };
}

function texture(url, colorSpace) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = colorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export async function loadAssets() {
  const [rock, trunk] = await Promise.all([loadMesh(rockUrl), loadMesh(trunkUrl)]);
  const leaves = {
    map: texture(leavesColorUrl, THREE.SRGBColorSpace),
    normalMap: texture(leavesNormalUrl, THREE.NoColorSpace),
    roughnessMap: texture(leavesRoughUrl, THREE.NoColorSpace),
  };
  return { rock, trunk, leaves };
}
