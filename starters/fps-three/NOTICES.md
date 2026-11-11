# Notices for starters/fps-three

The kit's code from mshumer/Claude-of-Duty (MIT) is listed in `third_party/NOTICES.md`.

## First-person arms and rifle (CC BY 4.0)

File: `src/kit/viewmodel/assets/arms-rifle.glb`, used by the default carbine (`src/game/weapons.js`, `viewmodel: { arms: 'asset', ... }`).

This work is based on "FPS AK-74m animations" (https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) by Cransh (https://sketchfab.com/ccransh) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

- Where it came from: the mirror https://github.com/Ayush-Mohanty/FPS-Arms-3D, folder `Models/fps_ak-74m_animations/` (`scene.gltf`, `scene.bin`, `scene_0..6.png`, `license.txt`). The repository is labelled MIT; the model's own licence file and the glTF's `asset.extras` say CC-BY-4.0, and that is the licence that applies.
- What was changed: textures reduced from 4096 px PNG to 1024 px WebP (the rifle's metal-roughness-occlusion map to 512 px); the arms' metal-roughness map and the rifle's specular map and `KHR_materials_specular` removed in favour of constant factors; the second and third UV sets and the tangents removed; meshes simplified to about 60% of their triangles; positions, normals, UVs, weights and rotation keys quantized (`KHR_mesh_quantization`); the walk, run and second reload clips removed; the remaining clips renamed `idle`, `draw`, `fire`, `reload`, `reloadEmpty`. 103 MB of source became a 1.47 MB GLB.
- Where it is credited: one small line on the title, pause and end screens (from the weapon's `viewmodel.credit`), this file, `README.md` and `third_party/NOTICES.md`.

A game that keeps this asset must keep the credit. A game that removes the `viewmodel` line from the carbine falls back to the coded hands and needs no credit.

## Bare first-person arms (CC0)

File: `src/kit/viewmodel/assets/arms-bare.glb`, used by any weapon that spreads `ARMS_BARE` (`src/kit/viewmodel/index.js`); not bundled otherwise, and not used by the default game.

"fps arms (rigged only)" by para, https://opengameart.org/content/fps-arms-rigged-only, CC0 1.0 (public domain dedication). No credit is required; it is given here anyway.

- Where it came from: the OpenGameArt page's archive (`FPS ARMS RIG 1.fbx` and its diffuse texture `new_diff.png`).
- What was changed: the FBX converted to glTF with three's FBXLoader and GLTFExporter (geometry, skin and skeleton; no clips); the placeholder material replaced by the CC0 diffuse, resized to 1024 px, its black atlas background filled outward from the skin islands so mipmaps do not darken the fingers, and stored as WebP; vertices welded and indexed, unused data pruned, positions, normals, UVs and weights quantized (`KHR_mesh_quantization`). 1.45 MB (plus a 100 KB JPEG) became a 0.26 MB GLB. The pose, fists, grips and wraps are made in code at run time (`src/kit/viewmodel/bare-arms.js`).
- The repack script is `.scratch/arms/pack-bare.mjs` (not committed); the inputs it read are `assets/arms-bare/arms-bare.glb` and `assets/arms-bare/arms-bare-skin.jpg`.
