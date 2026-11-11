---
name: asset-library
description: Dress a browser game with ready-made, licence-clean assets (photoscanned props, held weapons and tools, PBR ground and wall materials, HDRI skies, stylised kits) from a verified favourites table or a live search of Patch's ~59,000 CC0/CC-BY assets, inlined into the one HTML file. Use whenever a scene, prop, surface, sky or held weapon would otherwise be modelled in code, or a game looks flat, empty or "programmer art".
---

# Asset library

Ready-made beats code. A scanned barrel takes one line and arrives with real wear and real light. Coding one costs time and tokens, and it still reads as a toy. Don't open `assets/`: everything you need is below or one search away.

## The four steps

1. **Pick from the favourites.** Use [The table](#the-table) at the end, or the genre defaults just below. They are verified, rendered and sized. Hold to the budget: a game can add about **8,000 KB** in total (the KB column) and stay under 12 MB. One sky, 2–4 materials, one to three held items and 12–20 props fit.
2. **Search Patch for anything missing, by need.** No login is needed.
   ```bash
   npm run assets -- search snowy ground --type=material
   npm run assets -- search wooden crate --real        # realistic only; AI-made results are hidden by default
   npm run assets -- search sunset puresky --type=hdri
   npm run assets -- pack patch:<id from the search>  # fetch, check hash and licence, compress, catalogue
   npm run assets -- sheet --ids=<new id>             # then LOOK at references/audit/assets/<id>.jpg
   ```
   Pack options:
   - Props get `--tex=512 --tris=12000`.
   - Hero items get `--tex=1024`.
   - The `raw MB` that search prints is before packing: a 13 MB SimReady pallet packs to 126 KB.
   - The new id is the part after the first colon, e.g. `patch:simready:pallet_b01` becomes `pallet_b01`.
3. **Add** them to the game, in one command. It rewrites `src/assets/` and prints `inline_kb`:
   ```bash
   npm run assets -- add <id> <id> ... --game=games/<slug>
   ```
   - `id@512` caps that asset's textures for this game only, about a quarter of the KB.
   - `id~3000` caps its triangles. Use it for any prop placed more than three times. Keep the whole scene **under about 250k triangles**: the playtest's software renderer misses its timing checks above that, and weak laptops do too. The playtest prints `triangles`.
   - `remove <id>` takes one out.
4. **Use** them from any file in `src/game/`. The import resolves after every asset has decoded, so code can stay synchronous:
   ```js
   import { assets } from '../assets/index.js';
   ```

## Genre defaults

Ids in backticks are already in the library. `patch:` ids need one `pack` first.

| Genre or place | Sky | Ground / walls | Props |
|---|---|---|---|
| Urban or military yard (realistic) | `kloofendal_38d_partly_cloudy_puresky` (day), `the_sky_is_on_fire` (sunset) | `asphalt_02`, `factory_brick`, `concrete_floor_worn_001`, `container_side` | `concrete_road_barrier`, `Barrel_01`, `barrel_03`, `wooden_military_crate`, `ammo_box`, `metal_jerrycan`, `pallet_b01` + `box_cardboard_a01`, `portable_generator`, `street_lamp_01`, `fire_hydrant` |
| Forest camp, survival, night (realistic) | `satara_night`, `qwantani_dusk_2` | `forrest_ground_01`, `brown_mud_leaves_01`, `rock_wall_08` | `tree_stump_01`, `rock_07` (scale ×5–15), `barrel_stove`, `wooden_crate_01`, `wooden_bucket_01`, `old_tyre`. Held: `machete`, `hatchet` |
| Winter | `snowy_park_01` | `snow_02`, `rock_wall_08` | crates, barrels, `propane_tank` |
| Interior, horror, warehouse | `rooftop_night` (light only, `background: false`) | `plastered_wall_02`, `painted_concrete`, `weathered_planks`, `metal_plate` | `steel_frame_shelves_01`, `metal_tool_chest`, `cardboard_box_01`, `medical_box`, `security_light`, `patch:simready:pallet_a01` |
| Kart or arcade racing (stylised) | `kloofendal_48d_partly_cloudy_puresky` | `patch:kenney:racing-kit/roadCurved.glb` and its siblings (search "racing kit") | Kenney racing-kit pieces, about 15 KB each |
| Racing or driving (realistic bodies) | `construction_yard` | `asphalt_02`, `concrete_road_barrier`, `old_tyre` | `car-concept`, `v12-goblin`, `gourami-saloon`, `coupeox`, `offroad-buggy`; all B, CC-BY-4.0. First two have working wheel pivots; see Cars below |
| Dungeon or top-down (stylised) | none, or a night sky for light | `patch:kaykit:dungeon/wall.gltf` (modular, 3 m) | KayKit dungeon props: `patch:kaykit:dungeon/coin.gltf` and the rest (search "kaykit dungeon") |
| Tower defence (stylised) | `qwantani_afternoon_puresky` | grass or ground material | `patch:kenney:tower-defense-kit/tower-round-base.glb` and its siblings |
| Space station (stylised) | — | — | `patch:kenney:space-station-kit/*` (search "space station") |

**Never search for:**
- **Trees**: Poly Haven trees are 1–4 million triangles. Use stumps and rocks, or the starters' coded foliage.
- **Big rock scans**: `boulder_01` and similar won't simplify below about 54k triangles (2 MB). Scale `rock_07` up instead.
- **FPS arms**: there are none.
- **Modern rifles**: there is one hit, AI-made at 1.26M triangles.
- **Realistic cars on Patch, realistic aircraft, gunshot or ambience sounds**: Patch has none (measured 11 Nov 2026). Cars are now packed from other sources below; see `references/GENRE-COVERAGE.md` for the remaining gaps.

The kit's gloved hands plus `bolt_action_rifle_7_62`, `service_pistol` or the melee scans cover first person.

## The calls

`ctx` is the kit's context in the FPS starter, or `{ scene, renderer, physics? }` in any other three.js game.

| Call | Does |
|---|---|
| `assets.sky(ctx, 'construction_yard', { rotate, exposure, env })` | Sets the background, plus reflections and ambient on the world and the hands. Returns `{ sunDir, sunColor, elevation }`. Aim the shadow-casting sun with `sunDir`. `rotate` (radians) turns the sky to put the sun where the shot wants it |
| `assets.material('asphalt_02', { size: [1, 1] })` | A `MeshStandardMaterial` whose textures repeat at true scale on UVs measured in **metres**. On 0–1 UVs, pass `size: [w, h]` of the surface instead. Options: `tint`, `roughness`, `normalScale` |
| `assets.place(ctx, 'Barrel_01', { at: [x, y, z], rotY, scale, surface })` | Adds a copy to the scene with a box collider. Options: `solid: false` for small clutter, `collider: 'mesh'` for exact. `at: [x, z]` sits it on the ground, but that rebuilds physics, so pass `y` on flat levels. The lowest point always sits on `y`, so rotated props don't sink. Props under 0.6 m cast no sun shadow unless you pass `shadow: true` |
| `assets.instance(ctx)` | Call **once, after the last `place`**. It turns every repeated prop into one instanced draw call per part. In the demo it cut draw calls from 312 to 207 |
| `assets.model('hatchet', { keep, drop })` | A bare copy (shared geometry) to position yourself |
| `assets.parts(id)` | The part names, for assets that ship **variants side by side** (marked in the table): `keep: 'aged'`, `drop: 'rust'`, `keep: /_a$/` |
| `assets.held(ctx, itemId, 'bolt_action_rifle_7_62', { pos, rot })` | Puts a scan in the kit's first-person gloved hands. See the recipe below |
| `assets.character('human-0278', { anims: 'anims-human-0278' })` | A rigged person who plays motion-captured clips: `{ object, play(name, { fade, loop, speed }), update(dt), clips }`. Call `update(dt)` every frame. See "Characters" below |
| `assets.flipbook('fire-flame', { size, fps, phase, intensity, color, opacity, upright, loop })` | A camera-facing animated sprite (fire, smoke, explosions): `{ object, update(dt), restart() }`. Add `object` to the scene, call `update(dt)` every frame. Give a row of fires different `phase` values |
| `assets.sound('music-spacial-winds')` | A decoded `AudioBuffer`. Play it from `ambient()` or a voice in `src/game/sounds.js` (`actx.createBufferSource()`), so the recorder hears it too |
| `assets.credits()` | One line naming the sources. Put it in `rules.controls` or the title screen. **Required for CC-BY assets** |

## Recipe: dress a level (FPS starter)

```js
// look.js
const sun = assets.sky(ctx, 'construction_yard', { rotate: 1.55 });
sunLight(ctx, { dir: sun.sunDir, color: '#ffe2bd', intensity: 3.4, range: 34 });
ctx.get('render').setLook({ sunDir: sun.sunDir, /* ... */ });

// world.js: ground with UVs in metres
const geo = new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2);
const uv = geo.attributes.uv;
for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 240, uv.getY(i) * 240);
const ground = new THREE.Mesh(geo, assets.material('asphalt_02', { size: [1, 1] }));
ground.receiveShadow = true;
ctx.scene.add(ground);
ctx.get('physics').addStatic(ground, 'concrete');

assets.place(ctx, 'concrete_road_barrier', { at: [-6, 0, 4], rotY: Math.PI / 2, surface: 'concrete' });
assets.place(ctx, 'fire_hydrant', { at: [2, 0, 8], keep: 'aged' });
```

Walls and buildings are boxes wearing a library material. `games/asset-demo/src/game/world.js` has `metreBox()` (box UVs in metres) and the full working level.

**Composition beats count.** Put clusters of three to six props where the opening camera looks, as cover with a story: crate, ammo cans, fuel. Don't sprinkle them evenly. Add a `PointLight` inside anything that should glow (brazier, lamp).

## Recipe: a scanned weapon in the hands (FPS starter)

In `weapons.js`, give the item an **empty** body and say where the hands go. Then attach the scan in `buildWorld`:

```js
import { Assembly, heldItem } from '../kit/viewmodel/index.js';
const rifle = () => {
  const it = heldItem({ id: 'rifle', body: new Assembly('rifle'), tip: [0, 0.027, -0.95],
    gripR: { pos: [0.026, 0.058, 0.118], finger: [0.05, -0.62, -0.78], back: [1, 0.03, 0.04] },
    gripL: { pos: [-0.095, 0, -0.34], finger: [0.8977, -0.3267, -0.2955], back: [-0.2784, -0.7648, 0.581] } });
  it.nodes.sight = [0, 0.067, -0.09];
  return it;
};
// weapons: [{ id: 'rifle', kind: 'hitscan', model: rifle, handling: 'carbine', ... }]

// world.js
assets.held(ctx, 'rifle', 'bolt_action_rifle_7_62', { pos: [0, -0.02, -0.36], rot: [0, Math.PI / 2, 0] });
assets.held(ctx, 'sidearm', 'service_pistol', { keep: /_a$/, pos: [0, -0.026, -0.0185], rot: [0, Math.PI / 2, 0] });
assets.held(ctx, 'hatchet', 'hatchet', { rot: [0, Math.PI, 0] });
```

- Item space puts the origin at the right hand's thumb web, with -Z away from the player.
- Library weapons point their muzzle along **+X**, so `rot: [0, PI/2, 0]` aims them down -Z.
- `held()` tones the scan's albedo to 0.4, because the kit's view lamps run about 4× hot for its dark procedural gloves. Leave the view-light `intensity` near 1.5, or the gloves go black.
- `games/asset-demo/src/game/weapons.js` has the pistol and hatchet grips.

**Melee scans** (`hatchet`, `machete`, `crowbar_01`, `baseball_bat`, `sledgehammer_01`) stand along +Y with the handle's end near y = 0.
- Hold them exactly like the demo's hatchet:
  - `heldItem` with `handling: 'onehand'` and the hatchet's `gripR`;
  - then `assets.held(ctx, id, id, { rot: [0, Math.PI, 0] })`, which turns the edge away.
- **Add no x tilt:** the `onehand` pose already tips the head forward, and an extra tilt lays the blade across the screen.
- Long blades (the 0.76 m machete): try `scale: 0.8` with `pos: [0, -0.05, 0]`. That's untested, so capture `held` and look.

**Night scenes.** Night HDRIs give almost no light. Keep the sky for its stars, then add:
- a cool moon `DirectionalLight` at about 0.4;
- warm `PointLight`s (fire 15–25, lamps 6–10);
- `exposure` about 1.3.

Otherwise everything past the fire's reach goes black.

## Characters: realistic people (added 11 Nov 2026)

- **Bodies.** Patch has 328 realistic rigged humans (MakeHuman/MPFB, CC0, 53 bones, game-engine names: `pelvis`, `spine_01`, `upperarm_l`...). Find them with `npm run assets -- search human overalls --real` and pack with `--tex=512 --tris=14000` (about 0.7 MB each). `assets.model(id)` now copies rigged models with their own skeleton.
- **Movement: real clips (11 Nov 2026).** `npm run assets -- pack anims:.asset-cache/quaternius-ual/AnimationLibrary_Godot_Standard.glb --onto=<body id> --clips=Idle_Loop,Walk_Loop,Jog_Fwd_Loop,Punch_Cross,Sword_Idle,Sword_Attack,Hit_Chest,Death01` retargets Quaternius's CC0 Universal Animation Library (46 clips: walk, jog, sprint, crouch, sword, punch, pistol, hit, death...) onto one body, about 80 KB for 7 clips. Packed now: `anims-human-0278`, `anims-human-0440`, `anims-human-0411` (has the sword clips). Then `assets.character(id, { anims })`.
  - **Working example:** `animateClips()` in `games/cold-store/src/game/enemies.js` maps the kit's `e.state` to clips (chase → walk/jog with speed matched to ground speed, windup → Punch_Cross, stagger → Hit_Chest, dying → Death01) and layers a hunch and reaching arms on top with `nudge()`.
  - **Gotcha:** three's mixer only writes a bone when its clip value changes, so any code rotation added on top piles up frame after frame. Restore the clip pose before `update(dt)` (the example keeps `st.saved`).
  - **Death:** set `deathHold: 3.2` on the enemy def; the kit then skips its tip-over, keeps calling `animate` with `state === 'dying'`, and sinks the body after the hold.
  - Code posing (`rig()`, `pose()`) still works for poses no clip has (the Cold Chain crawler).
- **Costume.** Armour, helmets and hats are code meshes hung on bones with `attach()`. Patch has no armour.
- Tint skin and clothes per enemy type through the material names (`<id>.body`, `<id>.male_worksuit01`...), and keep eyes faintly emissive so the flashlight finds them.

## Fire, smoke and sound (added 11 Nov 2026)

- **Flipbooks** (`kind: flipbook`): Unity Labs' CC0 Houdini sequences. Packed: `fire-flame` (64-frame rolling flame, additive, 45 KB), `fireball` (a burst, play with `loop: false`), `smoke-wispy` (alpha, 346 KB). More in `.asset-cache/unity-vfx/` and at `https://unity3d.com/files/labs/downloads/vfx/assets01/<Name>/<Name>-flipbooks.zip` (Explosion00-02, FireBall01-04, Flame02-03, WispySmoke01-03, Cloud01-04). Pack: `npm run assets -- pack flipbook:<sheet.tga> --id=... --cols=8 --rows=8 --blend=additive|alpha --licence=CC0 --author=... --page=...`. Example: the brazier in `games/kiln-yard/src/game/world.js`.
- **Audio** (`kind: audio`): `npm run assets -- pack patch:incompetech:<id> --kbps=48 [--seconds=90]` makes a mono MP3 (about 6 KB a second at 48 kbps). Packed: `music-spacial-winds` (horror bed, 146 s, 859 KB), `music-asian-drums` (taiko drums, 948 KB). Patch search: `type=music` (incompetech, CC BY: credit comes through `assets.credits()`). Gunshots stay procedural (kit `audio/shot.js`). Example: `ambient()` in `games/cold-store/src/game/sounds.js`.

## Other genres

The same three steps work in any three.js game, passing `{ scene, renderer }` as `ctx`:
- a racing track: asphalt plus barriers plus tyres;
- a survival camp: forest ground, a stump, a brazier;
- a top-down yard;
- a horror interior: plaster, shelves, a night sky.

`place` skips colliders when there is no `physics`.

## Cars: five bodies (11 Nov 2026)

- **Pick:** `car-concept` (coupe with interior), `v12-goblin` (fictional supercar), `gourami-saloon` (luxury traffic), `coupeox` (futuristic coupe), `offroad-buggy` (cage and weathered tyres). Every one is **B**, with a specific reason in the table. All are under 40k triangles at 1024 px. [Lit sheet](../../references/audit/cars-1111/garage-sheet.jpg).
- **Drive:** `assets.model(id)` gives the complete body. CarConcept is 4.36 m long, front **+Z**. The mirror models are normalized: suggested scales V12 ×10, Gourami ×12.5, Coupeox ×4.8, buggy ×3.2. These scales are chosen game sizes, not measured real dimensions.
- **Animate:** CarConcept steering nodes `WheelFrontL/R`; spin nodes `WheelFrontLSpin`, `WheelFrontRSpin`, `WheelRearLSpin`, `WheelRearRSpin` keep the brake pads still. V12 front is **-Z**, steering `bone_suspension_FL/FR`, spin `bone_rotation_FL/FR/BL/BR`. Other three bodies merge wheels by material: no four independent wheel pivots. [Exact recipe and limits](../../references/CAR-GARAGE.md), [machine-readable hints](../../assets/cars.json).
- **Credit:** all five are CC-BY-4.0. Their `--credit` lines name the author, original URL, licence URL and modifications; `assets.credits()` now preserves complete recorded credits. The source cleanup is reproducible with `tools/prepare-cars.mjs`.
- **Checked:** eight source candidates CPU-rendered, five kept. Actual library parser decoded 56 images and tested eight wheel pivots with independent clones (`node tools/check-cars.mjs`). The existing WebGL sheet launch was blocked by Chromium sandbox availability; the shown sheet uses `tools/assets-cpu-sheet.py` in Blender CPU. A CPU render does not prove browser rendering or game handling.

## Rules

- **Licences.** Everything here is CC0 or CC-BY, recorded per asset in `assets/catalog.json` and `assets/CREDITS.md`. Always show `assets.credits()` somewhere in the game.
- **Patch picks.** Prefer CC0 over CC-BY when both fit. CC-BY (SimReady, Amazon Berkeley Objects, Polyfork) is fine because `assets.credits()` carries the credit. Prefer `realistic` + `pbr` for the realistic look and Kenney or KayKit for stylised games, never mixed in one scene. AI-made (Scenario) only when nothing else fits. Amazon Berkeley Objects scans can show brand logos, so look at the sheet render before using one.
- **Growing the library.** To add a new asset, `npm run assets -- pack patch:<id>` (or `polyhaven:<id>` / `ambientcg:<id>` direct), then `npm run assets -- sheet --ids=<id>` and look at `references/audit/assets/<id>.jpg`. `file:` packs need `--licence=CC0|CC-BY-4.0 --author --page`, and the tool refuses anything else. **Never NC, ND, SA, editorial, store licences or ripped game assets.** Sources and what is excluded, with reasons, are in `references/ASSETS.md`.
- **Direct CC-BY credits:** pass `--credit="<title> by <author>, <source URL>, CC BY 4.0 (<licence URL>). Modified: <changes>."` to `pack file:`. It is retained in the catalog, generated credits and runtime `assets.credits()` output.
- **No time or size claims you didn't measure.** `add` prints `inline_kb`, and `npm run build -- --game=games/<slug> --limit-mb=12` gives the truth.
- Then refresh this table: `npm run assets -- list --skill`.

## The table

<!-- table:start -->

**Models** (x × y × z metres, y up; KB = added to the HTML)

| id | size | KB | use |
|---|---|---|---|
| `car-concept` | 2.54×1.15×4.36 | 1786 | B: convincing coupe with interior; simplified reflections. Four steering/Spin groups; +Z forward (CC-BY-4.0: credit) |
| `coupeox` | 1.00×0.27×0.51 | 644 | B: distinctive coupe silhouette; plain opaque glass. Wheels grouped by material; scale x4.8 (CC-BY-4.0: credit) |
| `gourami-saloon` | 0.15×0.11×0.41 | 1047 | B: convincing luxury silhouette and wheels; glossy panels. Wheels merged; scale x12.5 (CC-BY-4.0: credit) |
| `offroad-buggy` | 0.49×0.37×1.00 | 2926 | B: detailed cage and weathered tyres; angular tubing. Wheels merged in tyre mesh; scale x3.2 (CC-BY-4.0: credit) |
| `v12-goblin` | 0.23×0.12×0.48 | 1279 | B: strong supercar silhouette; no interior. Four source wheel pivots; -Z forward; scale x10 (CC-BY-4.0: credit) |
| `human-0278` | 1.13×1.76×0.47 | 887 | Man in work overalls, rigged |
| `human-0411` | 1.06×1.69×0.46 | 673 | East Asian man, rigged; ronin body under coded armour |
| `human-0440` | 1.08×1.73×0.47 | 929 | Heavyset man in overalls, rigged |
| `zombie-gaunt` | 0.80×1.00×0.18 | 2120 | Realistic zombie with its own idle, walk, run, attack and two falls (CC-BY-4.0: credit) |
| `baseball_bat` | 0.06×0.91×0.06 | 327 | Wooden bat |
| `bolt_action_rifle_7_62` | 1.23×0.20×0.07 | 2056 | Hero rifle: scoped bolt-action, worn wood. Muzzle +X; see SKILL held recipe |
| `crowbar_01` | 0.04×0.56×0.13 | 342 | Crowbar, vertical |
| `hatchet` | 0.03×0.29×0.10 | 421 | One-hand axe, head up, edge +Z |
| `machete` | 0.04×0.76×0.06 | 695 | Long blade, vertical |
| `service_pistol` | 0.30×0.28×0.03 | 1211 | Sidearm. Two variants: keep /_a$/ (wood grips) or /_b$/ (taped). Muzzle +X |
| `sledgehammer_01` | 0.21×1.01×0.09 | 343 | Two-hand hammer, 1 m |
| `stick_grenade` | 0.08×0.38×0.08 | 472 | Stick grenade, thrown item |
| `chochin-lantern` | 0.65×1.00×0.65 | 326 | Hanging red lantern (CC-BY-4.0: credit) |
| `paper-lantern` | 0.66×1.00×0.66 | 86 | Hanging paper lantern (CC-BY-4.0: credit) |
| `torii-gate` | 0.07×0.73×1.00 | 213 | A shrine gate (CC-BY-4.0: credit) |
| `ammo_box` | 0.09×0.18×0.26 | 200 | Steel ammo can |
| `Barrel_01` | 0.56×0.88×0.56 | 210 | Red hazard oil drum |
| `barrel_03` | 0.63×0.93×0.64 | 144 | Blue steel drum |
| `barrel_stove` | 0.59×0.86×0.59 | 360 | Rusty drum brazier; add a PointLight inside for fire |
| `box_cardboard_a01` | 0.70×0.51×0.52 | 48 | Taped shipping box, SimReady (CC-BY), 36 KB: cheap filler (CC-BY-4.0: credit) |
| `box_cardboard_a02` | 0.70×0.52×0.51 | 52 | Second shipping box, SimReady (CC-BY) (CC-BY-4.0: credit) |
| `brass_pot_01` | 0.30×0.29×0.30 | 151 | Brass cooking pot |
| `cardboard_box_01` | 0.39×0.34×0.52 | 357 | Taped cardboard box |
| `cement_bag` | 0.46×0.18×0.70 | 74 | Cement sack, stackable (0.18 m) |
| `concrete_road_barrier` | 1.54×0.83×0.64 | 394 | Jersey barrier, 1.5 m: the cover block |
| `dead_tree_trunk_02` | 4.05×1.05×1.05 | 525 | Fallen trunk, 3 m: a seat by a fire, cover in a forest |
| `exterior_aircon_unit` | 1.80×0.93×0.37 | 675 | Wall AC unit. Two variants: keep "rusted" or drop "rusted" |
| `fern_02` | 1.97×0.43×1.72 | 301 | Fern clump (alpha-cut leaves) |
| `fire_hydrant` | 0.88×0.80×0.32 | 403 | Hydrant. Two variants: keep "aged" or drop "aged" |
| `folding_wooden_stool` | 0.53×0.44×0.55 | 295 | Folding wooden stool |
| `garden_gloves_01` | 0.23×0.08×0.30 | 975 | A pair of work gloves lying flat (a prop, not FP hands) |
| `khronos_lantern` | 15.49×25.66×4.63 | 292 | Hanging lantern on a post (Khronos sample) |
| `khronos_water_bottle` | 0.11×0.26×0.11 | 154 | Steel water bottle (Khronos sample) |
| `korean_fire_extinguisher_01` | 0.28×0.66×0.37 | 503 | Fire extinguisher on a stand |
| `medical_box` | 0.53×0.10×0.35 | 232 | Green first-aid case: the health pickup |
| `metal_jerrycan` | 0.35×0.46×0.17 | 434 | Red steel fuel can |
| `metal_tool_chest` | 0.69×0.65×0.41 | 472 | Red tool chest |
| `metal_trash_can` | 1.78×0.91×0.56 | 629 | Galvanised bin. Two variants: keep "rust" or drop "rust" |
| `old_military_crate` | 1.81×0.30×0.98 | 408 | Flat military crate. Two variants: keep "_a" (closed) / "_b" (open) |
| `old_tyre` | 0.60×0.60×0.17 | 201 | Worn tyre; stack flat with rot [-PI/2,0,0] |
| `pallet_a01` | 1.20×0.21×0.80 | 169 | Euro pallet, SimReady (CC-BY) (CC-BY-4.0: credit) |
| `pallet_b01` | 1.21×0.21×1.00 | 167 | Square pallet, SimReady (CC-BY); stack boxes on it at y 0.21 (CC-BY-4.0: credit) |
| `plastic_crate_01` | 0.30×0.26×0.41 | 687 | Red milk crate (heavy for its size) |
| `portable_generator` | 0.82×0.58×0.56 | 720 | Yellow site generator |
| `propane_tank` | 0.34×0.55×0.34 | 254 | Red gas bottle |
| `rock_07` | 0.17×0.14×0.32 | 410 | Hand-size stone; scale up 5-15x for boulders |
| `security_light` | 0.32×0.53×0.42 | 276 | Wall floodlight housing |
| `steel_frame_shelves_01` | 10.97×21.41×5.02 | 190 | Steel shelving, 2.1 m |
| `street_lamp_01` | 0.70×3.87×0.39 | 413 | Cast-iron street lamp, 3.9 m; add a PointLight at y 3.6 |
| `tree_stump_01` | 1.43×0.57×1.59 | 538 | Cut stump with roots, 1.5 m |
| `utility_box_02` | 0.92×1.12×0.43 | 271 | Green electrical cabinet, against a wall |
| `wooden_bucket_01` | 0.37×0.55×0.34 | 262 | Wooden bucket with handle |
| `wooden_crate_01` | 0.82×0.35×0.41 | 288 | Small lidded wooden crate |
| `wooden_crate_02` | 0.53×0.46×1.17 | 259 | Long wooden crate with rope handles |
| `wooden_military_crate` | 1.24×0.47×0.52 | 502 | Long military crate, iron straps |
| `city-kit-industrial_shipping-container-a` | 1.86×1.74×4.11 | 22 | Kenney low-poly shipping container (stylised games) |
| `medieval-hexagon_decoration_props_barrel` | 1.21×1.27×1.21 | 21 | KayKit low-poly barrel (stylised games) |
| `wooden-crate-e46521` | 0.60×0.60×0.60 | 23 | Polyfork low-poly crate, vertex colour (CC-BY) (CC-BY-4.0: credit) |
| `wedge-concept-car` | 1.00×0.24×0.51 | 667 | Hero car for racing (CC-BY-4.0: credit) |
| `antique_katana_01` | 0.09×1.00×0.09 | 467 | Katana, for a first-person blade |

**Materials** (one tile in metres)

| id | tile | KB | use |
|---|---|---|---|
| `metal_plate` | 0.5×0.5 | 503 | Diamond tread plate |
| `weathered_planks` | 2×2 | 196 | Grey weathered planks: decks, piers |
| `asphalt_02` | 3×3 | 1187 | Weathered cracked asphalt: yards, roads |
| `brown_mud_leaves_01` | 1.3×1.3 | 1214 | Mud with leaves |
| `cobblestone_floor_08` | 2×2 | 747 | Cobblestones |
| `concrete_floor_worn_001` | 3×3 | 180 | Plain worn concrete; cheap (135 KB) |
| `forrest_ground_01` | 2×2 | 1152 | Forest floor, leaves and twigs |
| `gravel_concrete` | 2.12×2.12 | 836 | Exposed-aggregate concrete |
| `Ground111` | 2.8×2.8 | 1027 | Dry ground (ambientCG) |
| `snow_02` | 2×2 | 464 | Trodden snow |
| `sparse_grass` | 2×2 | 1049 | Patchy grass on dirt |
| `Metal063` | 2×2 | 372 | Painted metal (ambientCG) |
| `rusty_metal_02` | 1×1 | 330 | Rusted painted steel |
| `roof_tiles` | 2×2 | 854 | Clay roof tiles |
| `ThatchedRoof001A` | 2×2 | 860 | Thatch for village roofs |
| `Cardboard001` | 2×2 | 40 | Cardboard 001 |
| `brick_wall_10` | 1.9×1.9 | 451 | Dark red brick wall |
| `Bricks113A` | 2×2 | 462 | Brick (ambientCG) |
| `Concrete049` | 1.1×1.1 | 1176 | Board-formed concrete |
| `container_side` | 1.94×1.94 | 49 | Painted corrugated steel (green); very cheap (37 KB) |
| `corrugated_iron` | 1.12×1.12 | 356 | Galvanised corrugated sheet |
| `factory_brick` | 1.5×1.5 | 1035 | Dark factory brick |
| `painted_concrete` | 2×2 | 508 | Green painted concrete, chipped |
| `plastered_wall_02` | 2.23×2.23 | 269 | White plaster |
| `red_brick_03` | 1×1 | 761 | Red brick |
| `rock_wall_08` | 1.8×1.8 | 711 | Stacked stone wall |
| `wood_planks_dirt` | 2×2 | 332 | Weathered planks for walls and floors |

**Skies** (sun elevation)

| id | sun | KB | use |
|---|---|---|---|
| `belfast_sunset` | 2.1° | 159 | Sunset over fields; sun 2 deg (Patch 1K: soft horizon) |
| `construction_yard` | 33° | 414 | Afternoon, apartment blocks around: urban yards |
| `industrial_sunset_puresky` | 3.5° | 146 | Hazy sunset, no ground; sun 3.5 deg |
| `kloofendal_38d_partly_cloudy_puresky` | 37.3° | 129 | Partly cloudy day, no ground; sun 37 deg (Patch, 1K) |
| `kloofendal_48d_partly_cloudy_puresky` | 48.5° | 190 | Clean midday sky, no ground: any outdoor level |
| `qwantani_afternoon_puresky` | 41.5° | 93 | Clear afternoon, no ground; sun 41 deg (Patch, 1K) |
| `qwantani_dusk_2` | 12° | 202 | Dusk over grassland; sun 12 deg |
| `qwantani_late_afternoon_puresky` | 19° | 95 | Warm late afternoon, no ground; sun 19 deg (Patch, 1K) |
| `rooftop_night` | 10.5° | 267 | Night rooftop under floodlights |
| `satara_night` | -3.5° | 870 | Night savanna, warm lamps |
| `snowy_park_01` | -6.3° | 329 | Overcast snowy park |
| `the_sky_is_on_fire` | 4.9° | 233 | Vivid pink-orange sunset over water; sun 5 deg |
| `urban_street_01` | 48.5° | 456 | Overcast-ish street with trees |

<!-- table:end -->
