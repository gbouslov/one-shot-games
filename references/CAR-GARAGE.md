# Five car bodies ready to pick

The new ids are `car-concept`, `v12-goblin`, `gourami-saloon`, `coupeox`, and `offroad-buggy`. All are CC-BY-4.0. Use `assets.credits()` in the game: their full lines include author, original model URL, licence URL and modifications. The pack step now accepts `--credit` and preserves it in the catalog. The generated [credits](../assets/CREDITS.md) hold the same lines.

See [the lit garage sheet](audit/cars-1111/garage-sheet.jpg), [the eight-candidate sheet](audit/cars-1111/candidates.jpg), and [machine-readable wheel hints](../assets/cars.json). The baseline wedge appears in the garage sheet for comparison; it is not counted as a new body.

## Use a body

```sh
npm run assets -- add car-concept construction_yard asphalt_02 --game=games/<slug>
```

```js
const car = assets.model('car-concept');
scene.add(car);
// Source front is +Z; turn the whole car by PI if your controller drives -Z.
```

`assets.model` returns an independent hierarchy with shared geometry/materials. Both steerable cars retain their source hierarchy and pivots. No physics controller is bundled: these are bodies for the game's existing vehicle controller.

## Spin and steer the two articulated bodies

CarConcept has `WheelFrontL`, `WheelFrontR` for steering and `WheelFrontLSpin`, `WheelFrontRSpin`, `WheelRearLSpin`, `WheelRearRSpin` for spinning. Brake pads stay still while the tyre, rim and disc spin. Source door pivots remain available.

CarConcept's triangle budget is weighted toward the exterior. The small windshield-wiper mesh alone retained 8.6k triangles after simplification; it is omitted to preserve the painted panels. This produces 37,933 triangles at 1,340 KB GLB, with about 24k triangles in the two main paint materials. A uniform reduction had spent only about 9k triangles there and visibly damaged reflections. Both packed and original-source renders were opened to make that tradeoff.

V12 has `bone_suspension_FL`, `bone_suspension_FR` for steering and `bone_rotation_FL`, `bone_rotation_FR`, `bone_rotation_BL`, `bone_rotation_BR` for spinning. Its front is -Z. Source wheels include both tyre and rim children; brake branches remain separate.

These sources rotate their local frames. Bind model-space axes into each node's local frame once, before placing or turning the whole car. Set an absolute angle each frame:

```js
function joint(model, name, modelAxis) {
  const node = model.getObjectByName(name);
  if (!node) throw new Error(`Missing car joint ${name}`);
  model.updateMatrixWorld(true);
  const rest = node.quaternion.clone();
  const axis = new THREE.Vector3(...modelAxis)
    .applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()))
    .applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()).invert());
  const rotation = new THREE.Quaternion();
  return angle => node.quaternion.copy(rest)
    .multiply(rotation.setFromAxisAngle(axis.normalize(), angle));
}
const steerL = joint(car, 'WheelFrontL', [0, 1, 0]);
const spinL = joint(car, 'WheelFrontLSpin', [1, 0, 0]);
// In the game's update: steerL(steerRadians); spinL(distance / wheelRadius);
```

The other three bodies have wheel geometry merged by material. They can move as complete bodies, but cannot spin four independent wheels without splitting geometry. `offroad-buggy`'s `1 BAN` is all four tyres, not one wheel. Do not animate it as one wheel.

## Source scale matters

CarConcept is already approximately metre-sized (4.36 m long). The mirror normalizes the other sources; display floors made V12 and Gourami especially tiny. Floors were removed before packing. Suggested game scales in `assets/cars.json`: V12 ×10, Gourami ×12.5, Coupeox ×4.8, buggy ×3.2. These are chosen plausible game sizes, not surveyed real-world dimensions.

## What the renders and checks establish

All eight candidates were packed and rendered; the best four mirror bodies were retained beside CarConcept. All five receive B under the existing ASSETS.md bar: useful game bodies with specific visual limits, rather than a claim to AAA finish. Individual reasons are in the regenerated skill table.

The existing `node tools/assets.mjs sheet` built its HTML but Chromium could not start its enforced sandbox in this runtime. A native browser new-page request was also rejected by automatic approval policy. No sandbox/config change or browser shim bypass was attempted. The shown images are real packed-GLB renders in official Blender 4.5.9 LTS, Cycles CPU, one model at a time, 20 samples at 640×640. `tools/assets-cpu-sheet.py` reproduces them.

`node tools/check-cars.mjs` executes the actual library/three.js GLB loader, decodes embedded images with sharp in Node, measures loaded geometry and tests eight wheel pivots plus clone isolation. [Its result](audit/cars-1111/runtime-check.json) is distinct from WebGL verification. Browser render/handling and the independent conductor check remain open; no running racing game was edited.

## Dropped after rendering

| Candidate | Grade | Why left out |
|---|---|---|
| generic-race-car | B | Usable open roadster, but the selected bodies cover the requested set better; source says invented, so no brand verdict is implied |
| fancy-car | B | Attractive vintage traffic body, but limited realism at close range and uncertain historical likeness; lower value than the selected four |
| bryan-car-candidate | C | Unidentified black van; source text does not establish an invented design, and the render does not resolve its real-model likeness |
| car-scan-candidate | C | Damaged scan with broken geometry and captured ground; unsuitable as a drivable hero body |

Earlier exclusions are recorded in [the shortlist](CAR-SHORTLIST.md): Testarossa tag, Ferrari/game-derived RC-13, Hilux-based pickup, Hot Wheels tag, disappeared demolition source, known marques/film props, and the duplicate wedge source. Rejected packs made during this run were moved into the ignored cache, not left as selectable catalog entries.
