---
name: build-from-pieces
description: Build a first-person browser game on the tested kit in starters/fps-three, writing only the game's own world, enemies, weapons, rules and look. Use after a design exists, or to find which piece does a job.
---

# Build from pieces

Read `games/<slug>/DESIGN.md`. Your code goes in `games/<slug>/src/game/`. Before you write any plumbing, check the table: it probably exists.

## What you write (`src/game/`)

| File | You decide | Calls |
|---|---|---|
| `rules.js` | title, controls text, waves, end screens | read by the round system |
| `world.js` | the place: returns `playerSpawn`, `playerYaw`, `enemySpawns`, `bounds` | `terrain`, `slab`, `ramp`, `rockGeometry`, `scatter` |
| `look.js` | sky, sun, fog, bloom, grade, motes | `skyDome`, `sunLight`, `motes`, `render.setLook` |
| `weapons.js` | stats, models, sounds | one object per weapon |
| `enemies.js` | stats, models, animation | one object per enemy |
| `sounds.js` | new voices, the air of the place | `kit/audio/dsp.js` |
| `shots.js` | named screenshots of what matters | used by `npm run capture` |
| `config.js` | field of view, movement feel, HUD colours | merged into the kit defaults |

Also set the `<title>` in `index.html`.

## What already exists (`src/kit/`)

| Need | Piece |
|---|---|
| Frame loop, fixed physics step | `core/engine.js` |
| Keyboard, mouse lock, drag-to-look fallback, touch | `core/input.js` |
| Deterministic randomness | `core/rng.js` (use `ctx.rng.fork()`, never `Math.random`, or captures stop being comparable) |
| Collision against any mesh, no tunnelling | `physics/` (BVH and swept capsule) |
| Walking, sprint, crouch, jump, coyote time, head bob, recoil, shake | `player/player.js` |
| Springs, easing, angle maths | `player/springs.js` |
| Hitscan, projectile, melee, reload, swap, splash, sticking | `weapons/weapons.js` |
| **First-person hands** that grip whatever is held: jointed gloved fingers, two-bone arms, sway, stride bob, turn lag, spring recoil, reload/draw clips, melee swing and throw layers | `viewmodel/` (from Claude-of-Duty). Set `model:` on a weapon; see "Held weapons" below |
| **Animated arms from a file** (rigged glTF arms with their own clips, default on the carbine) | `viewmodel/asset-arms.js`, `viewmodel/assets/arms-rifle.glb`. Set `viewmodel: { arms: 'asset', ... }` on a weapon |
| **Bare arms for primitive and melee games** (CC0 rigged skin arms, posed in code round a spear, club or hatchet, hide wraps) | `viewmodel/bare-arms.js`, `viewmodel/assets/arms-bare.glb`. `viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear' }`; see "Held weapons" |
| Finished firearms: carbine, compact, sidearm | `viewmodel/models/`, chosen with `model: 'carbine'` |
| Primitive held items: flint spear, root club, flint hatchet | `viewmodel/models/primitive.js`: `model: buildSpear` (or `buildClub`, `buildHatchet`) |
| Part builders for held objects: chamfered boxes, lathes, rods, tubes, extrusions, rails | `viewmodel/geometry.js`, `viewmodel/parts.js` |
| **Procedural PBR material library**: concrete, brick, plaster, tile, asphalt, sand, dirt, gravel, rusted/painted/brushed metal, corrugated, wood, fabric, burlap, foliage, rubber, glass, baked on the GPU with normal, roughness, edge wear and cavity grime | `materials/` (from Claude-of-Duty): `ctx.get('materials').get('wood', { tint: '#8a6a4a', scale: 0.5 })` |
| Enemy states, windup and stagger, melee and ranged, pathing with no navmesh | `enemies/` |
| Particles, tracers, ground marks, flash lights | `fx/fx.js` |
| Tiling procedural textures and normal maps | `textures/textures.js` |
| Terrain, boxes, ramps, rocks, scattered props, sky with sun, drifting motes | `world/builders.js` |
| Bloom, ambient occlusion, sun shafts, ACES or AgX, split-tone grade, contrast, vignette, shadows, dynamic resolution, shader prewarm | `render/render.js` (`setLook`) |
| Synth voices, explosive and impact sounds, noise banks | `audio/` |
| HUD, title and end screens, touch buttons | `hud/hud.js` |
| Waves, win, lose, restart, pause | `round/round.js` |
| The hooks the tools use | `debug/api.js` |

Each file opens with its API in a comment. Start there.

## Order of work

1. **Rules and a greybox world.** Spawn, one enemy type, one weapon. Build, playtest. Get one complete round working before anything else.
2. **Then the rest of the content.** Every enemy, every weapon.
3. **Models.** Compose from primitives and groups. Pivot limbs at the joint so `animate` can swing them. Silhouette matters more than detail. Use library materials (`ctx.get('materials').get(...)`) for every large surface; a flat-colour `MeshStandardMaterial` on a wall or a rock is what made the old caveman build look like plastic.
4. **Look comes later,** in `skills/make-it-look-great`.

## Held weapons: always in the hands

The player looks at the held weapon for the whole game; it is the single most judged object. Never build your own arm out of spheres and capsules: the kit's hands hold anything.

- **A firearm:** `model: 'carbine' | 'compact' | 'sidearm'`. Handling (pose, sway, recoil feel, reload clip) comes with it.
- **Anything else** (club, spear, axe, torch, bow, wand, tool): `model: (ctx, mats) => heldItem({...})` built from `viewmodel/geometry.js` pieces into an `Assembly`, plus `handling: 'onehand' | 'twohand' | 'thrown'`. The starter's `src/game/weapons.js` has a worked hatchet. Rules that make it read:
  - Units are metres. Item origin is the web of the right hand; `-Z` points away from the player, `+Y` up.
  - `gripR` / `gripL` are WRIST targets about 0.1 m behind the knuckles along `finger`; `back` is the back of the hand. `gripL: null` for one hand.
  - Give it 15+ pieces: bindings, wraps, pegs, notches, a bevelled head. Each `body.add(geo, materialKey, { x, y, z, rx, ry, rz })`.
  - Material keys: the gun keys in `viewmodel/materials.js` (`steel`, `steel_black`, `alu`, `polymer`, `rubber`, `brass`, `glove`, `sleeve`...) or your own, registered on the weapon: `materials: { haft: ['wood', { uvMode: 'triplanar', localSpace: true, scale: 0.12, tint: '#8a6a4a' }] }`.
  - **Re-skin the hands** for your world by registering `glove`, `glove_pad`, `glove_seam` and `sleeve` on any weapon (bare skin: `['rubber', { ...tint }]`; fur or hide: `['fabric', ...]`). Default is a tactical glove and sleeve.
  - Tune the pose with `pose: { hipPos, hipRot }` and look: `npm run capture -- --shots=held` (add a `held` shot that calls `ctx.get('weapons')._select(i, true)`, as the starter does).
- **Rigged arms from a file** (the starter's default carbine): one line on the weapon, `viewmodel: { arms: 'asset', url: armsRifle, ...ARMS_RIFLE }` with `import armsRifle from '../kit/viewmodel/assets/arms-rifle.glb?url'` and `ARMS_RIFLE` from `kit/viewmodel/index.js`. Gloved arms and a rifle with idle, shot, draw and reload clips (CC BY 4.0, Cransh; the credit line on the title screen comes from `viewmodel.credit`, keep it). Keep `model: 'carbine'` beside it: it is the fallback if the file fails. Delete the `viewmodel` line and the coded hands come back with no asset and no credit. Use it for any modern-firearm game; for primitive or melee games use the bare arms below. Other rigs: `kit/viewmodel/asset-arms.js` maps a clip-name table (`clips: { idle, fire, reload, reloadEmpty, draw, inspect }`) onto the kit's states and takes framing (`eye`, `scale`, `pos`, `rot`, `fov`, `ads`, `lightScale`, `materials`). Sway, bob, turn lag, recoil springs and jump/land still apply on top of the clips. Frame it with `npm run capture -- --shots=held,heldSide`.
- **Bare arms** (caveman, primitive, melee, survival): one line on the weapon, with `ARMS_BARE` and an item builder from `kit/viewmodel/index.js`:
  ```js
  import { ARMS_BARE, buildSpear, buildClub } from '../kit/viewmodel/index.js';
  { id: 'spear', kind: 'melee', strike: 'thrust', ..., viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear', material: 'hide' }, model: buildSpear },
  { id: 'club',  kind: 'melee', ...,                  viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'club',  material: 'hide' }, model: buildClub },
  ```
  The arms are "fps arms (rigged only)" by para, CC0 (no on-screen credit needed), 0.26 MB with their skin texture, bundled only when a weapon spreads `ARMS_BARE`. The rig has no clips; `viewmodel/bare-arms.js` closes the fists round the item, solves both arms with two-bone IK from shoulders pinned in camera space, and puts the left fist on the shaft for two-handed holds (it folds the left arm away for one-handed ones). So every procedural layer (idle sway, stride bob, turn lag, the melee `swing`, `strike: 'thrust'`, the `thrown` throw, the draw/lower dip) moves the item and bends the elbows: a body moving, not a mesh sliding.
  - `hold`: `'onehand'` / `'club'` / `'hatchet'` (fist low right, head up), `'twohand'` / `'spear'` (both fists, point at the centre), `'thrown'` (raised by the shoulder), or your own `{ pos, aim, face, left: null | { y, roll }, shoulderL }` in camera space (`BARE_HOLDS` has the numbers). `holdPose: { pos: [...] }` nudges a named hold.
  - `material`: `'skin'`, `'hide'` (tanned skin, hide bound wrist to mid-forearm), `'leather'` (bound to the elbow), or `{ tint, roughness, wrap: { color, from, to, turns }, map }` where `map` is a texture or `?url` import (a CC0 leather from ambientCG or Poly Haven) replacing the skin.
  - `curl` / `thumb` (joint angles of the fist), `pin` (0..1, how body-fixed the shoulders are), `pos` / `scale` / `fov` / `lightScale` as for any asset arms.
  - Any `heldItem` works in the bare fist: its origin is the fist centre with the shaft along `+Y`. Frame with `npm run capture` and a shot that `_select`s the weapon; freeze a strike for a shot by wrapping `w._animateHands` so it sets `w.swingT` to the same fraction each frame.
- Light on the hands is its own rig, fixed in view space: `ctx.get('weapons').viewLights.set({ key, fill, rim, bounce, sky, ground, intensity })` in `look.js`. Match its colours to the scene (firelight key at night, cool sky fill by day). If the weapon reads as a black silhouette, raise `intensity`.

## Worked translations

- A thrown spear: `kind: 'projectile'`, `gravity: -14`, `stick: 6`, a long thin model, `handling: 'thrown'`.
- A club: `kind: 'melee'`, longer `swing`, more `recoil.kick`, `handling: 'onehand'` (or bare arms: `model: buildClub` with `...ARMS_BARE, hold: 'club'`).
- A thrusting spear: `kind: 'melee'`, `strike: 'thrust'`, narrow `arc`, longer `range`, `model: buildSpear` with `...ARMS_BARE, hold: 'spear'`.
- A sling: a projectile with a slow `rate` and no `magazine`, `handling: 'thrown'`.
- A charging beast: raise `speed`, short `windup`, high `damage`; animate with a low head.
- A flyer: set `hover`.
- A boss: high `hp`, `stagger: 0`, bigger `radius`, its own wave.

## Changing the kit

Allowed when the game needs something the kit can't do, or you found a defect. Keep the change small, say what and why in your final report, and keep `debug/api.js` truthful, since the tools depend on it. If you replace `round.js` or change the shape of `__GAME__`, update `tools/playtest.mjs` so it still plays your game. A removed test is not a passed test.

## Other genres

There is no second starter yet. Make `games/<slug>/index.html` and `src/`, reuse `core/`, `audio/` and `textures/`, expose `window.__READY__` and a `__GAME__.snapshot()`, and write your own short playtest modelled on `tools/playtest.mjs`. The build, size gate, capture and record tools only need those hooks.

## More depth

`third_party/skills/` holds engine skills to read when you need them: `threejs-scene-setup`, `threejs-materials-lighting`, `game-feel`, `level-design`, `audio-design`.
