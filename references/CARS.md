# Car models: licence-clean candidates for a browser racing game

Searched on 11 Nov 2026. Bar: CC0 or CC-BY 4.0 only, generic or invented designs, usable in a single-file three.js game. Nothing was downloaded. Prior sources and exclusions are in `references/ASSETS.md`.

## How this was checked, and what is not known

- **Sketchfab**: licence, author, face count, `isDownloadable` and tags come from the public `api.sketchfab.com/v3/models/<uid>` record of each model, the same data the model page shows. The licence label on all rows below reads "CC Attribution" and links to `creativecommons.org/licenses/by/4.0/`. Sketchfab requires a free login to download, as `ASSETS.md` already notes. Counts are **faces** (triangles) as Sketchfab reports them.
- **Not verifiable without downloading**: whether wheels are separate meshes (the Sketchfab record does not list node names), and the texture set. "PBR" below is Sketchfab's `pbrType` flag (metalness or specular workflow), not a look at the maps. Open each in `npm run assets -- sheet` after packing before trusting either.
- **Ranking is by metadata** (face count, PBR flag, finish of the design, how generic it is). I did not render them, so the order within the top five is a prior, not a verdict. Put them through `sheet` and look.
- **Poly Pizza** pages show licence, author and format but no triangle count, and do not say whether a login is needed to download.
- **Real-car lookalikes are left out on purpose**, even when the licence is fine. Excluded after reading the page: Cartoon Sports Car (RCC Design, tagged "porsche carrera"), Tiara GT '83 (AE86 homage), Negotiator '80 and Phoenix 455 '71 (period American police and muscle cars, "inspired by famous"), Destroyed Car 03 (Caprice), Mazda RX7 Stylised, Fiat Punto, Chevrolet C10, and every Porsche, BMW, Lamborghini and Toyota upload that dominates the Sketchfab like-count ranking.

## The table

Ranked by expected visual quality in a racing game. "Tris" is the source count, before `--tris` simplification.

| # | Model | Author | Licence (as shown) | Tris | PBR | Wheels separate? | Format / login | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | [Fictional supercar, V12 Goblin](https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786) | ollitei | CC Attribution (4.0) | 86,623 | specular flag | not verified | Sketchfab download (glTF), login | An invented design from 2012, tagged "fictional". No interior. Best silhouette in the set, so the one to try first. Pack with `--tris=25000` |
| 2 | [Vintage Racing Car](https://sketchfab.com/3d-models/vintage-racing-car-0b4cd62e8620486f9b62c32d87d3ed0e) | SpatialNeglect | CC Attribution (4.0) | 85,977 | metalness flag | not verified | Sketchfab, login | Tagged pbr and 4k, made for a competition, also sold on Fab (the author's own listing). Generic open-wheel look; check the render for a real marque on the nose before packing |
| 3 | [Futuristic racing car, "Molnia"](https://sketchfab.com/3d-models/futuristic-racing-car-molnia-738a78a4c9154614b90029bf8bb80d61) | TuppsM | CC Attribution (4.0) | 18,330 | metalness flag | hovercar, so no wheels | Sketchfab, login | Blender plus Substance Painter, one animation. Already game-weight. Fits a futuristic or hover racer, not a wheeled one |
| 4 | [Generic passenger car pack](https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5) | Comrade1280 | CC Attribution (4.0) | 69,312 for 10 cars (about 6,000 to 7,950 each) | metalness flag | not verified | Sketchfab, login | Sedan, wagon, hatchback, compact, coupe, minivan, sport, pickup, SUV, offroad, six colours each. The page says "minimum to none similarities to real life cars and completely trademark claim proof". Best source for a full grid plus traffic from one pack |
| 5 | [Future Car](https://sketchfab.com/3d-models/future-car-hliAt7xc6YU2XjXh5G4lzmQwFmR) | 3DHaupt | CC Attribution (4.0) | 130,636 | metalness flag | rigged in Blender, so likely | Sketchfab, login | Staff-picked concept car with a garage-scene history. Heavy: pack with `--tris=30000`. Page text and tags reference a pit-stop scene |
| 6 | [Fairheaven LT '80](https://sketchfab.com/3d-models/fairheaven-lt-80-low-poly-model-e2678da920cc4be68dbc193727919ffb) | Daniel Zhabotinsky | CC Attribution (4.0) | 19,709 | metalness flag | not verified | Sketchfab, login | Page: "inspired by generic CAFE downsized American sedans", tagged generic. Author gives explicit permission to modify and ship in a digital product. A cop variant (19,505 tris) is on a sibling page |
| 7 | [Kiri '86](https://sketchfab.com/3d-models/kiri-86-low-poly-model-5c17c582ef9549798f694b660feea42a) | Daniel Zhabotinsky | CC Attribution (4.0) | 20,319 | metalness flag | not verified | Sketchfab, login | "Typical compact Japanese sedan from the 80s", textured interior. Good as an AI-traffic car |
| 8 | [Sci-Fi Buggy](https://sketchfab.com/3d-models/sci-fi-buggy-085bd97876a64eacbc041299ac945e9c) | TiyaMakes | CC Attribution (4.0) | 161,879 | metalness flag | not verified | Sketchfab, login | Offroad or rally buggy, invented. Too heavy as is; needs `--tris=30000` and a look at what simplification does to the cage |
| 9 | [Toy Car (glTF-Sample-Assets)](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ToyCar) | Guido Odendahl (car), Eric Chadwick (scene) | CC0 1.0, per the model's README | not stated | yes: clearcoat, transmission, sheen | not stated | `.glb` direct from GitHub, no login | Already on the "yes, as needed" list in `ASSETS.md`. A toy, so it suits a kart or arcade game. Carries eight cameras, which the packer should drop |
| 10 | [Car Hatchback](https://poly.pizza/m/BG0KAhmGDt) and [Sports Car](https://poly.pizza/m/1mkmFkAz5v) | Kay Lousberg; Quaternius | Public Domain (CC0) | not shown | no (flat colour) | not stated | Poly Pizza, FBX or glTF; login not stated on page | Stylised low poly. Use for kart, arcade and traffic. Quaternius also has a [Cars Pack](https://quaternius.com/packs/cars.html): 8 models, CC0, FBX/OBJ/Blend, "not textured", no login |
| 11 | [Kenney Car Kit](https://kenney.nl/assets/car-kit) and [Racing Kit](https://kenney.nl/assets/racing-kit) | Kenney | Creative Commons CC0 | not stated; 45 and 110 files | no (flat) | typically yes in Kenney kits, not confirmed | Click-through download, "Continue without donating", no login | Already reachable through Patch as `patch:kenney:racing-kit/...`. The stylised racing default in `SKILL.md`; no new work needed |
| 12 | [CarConcept (glTF-Sample-Assets)](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) | Darmstadt Graphics Group, Eric Chadwick | CC BY 4.0 International (README credit block) | not stated | yes: clearcoat, iridescence, transmission, variants | doors and parts are named, pivoted meshes | `.glb` from GitHub, no login | The best-built web car here, but it **carries Khronos and 3D Commerce logos** (trademarks), and it derives from a Sketchfab upload by Unity Fan whose page now shows "Free Standard", not CC0, despite the CC0 line in its description. Use only with the logo textures replaced, and credit DGG. Lowest-priority pick |

Also a fit but lower value: [Shvan '92 panel van](https://sketchfab.com/3d-models/shvan-92-low-poly-model-09d718c9cf72401b8534d265a06a803f) (23,045 tris, "generic panel van") and [LCT 3000 '95 box truck](https://sketchfab.com/3d-models/lct-3000-95-low-poly-model-663a0953c038434a918cb85725c88ffa) (18,947, "generic Japanese small-cabin truck"), both Zhabotinsky, CC Attribution. Good as traffic.

## Poly Haven

One car and it is a prop, not a racer: [Covered Car](https://polyhaven.com/a/covered_car), CC0, author MP, 12,592 polys, PBR (diffuse, ARM, normal), glTF and no login, textures up to 8k. A car under a tarp, so it works as scenery in a garage or junkyard level only. `ASSETS.md` already lists it.

## Excluded after reading the page

| Model | Reason |
|---|---|
| Poly Pizza Buggy (Nick Slough), 80s Car (Nick Ladd), CAR Model (Ignition Labs), Red Car (J-Toastie) | Licence reads "Creative Commons Attribution" and, where the page links it, goes to CC BY **3.0**. The rule here is 4.0 only |
| Poly Pizza Dodge Charger, Camaro, Nissan GTR, Rolls Royce, Mazda RX-7, Range Rover, Hilux | Real brands |
| Sketchfab "FREE Concept Car 004" (Unity Fan) | Description says CC0, but the licence shown on the page is "Free Standard" and the model is 406,469 tris |
| Sketchfab CC0 filter | No usable car came back for "car", "sports car", "concept car" or "formula car". The CC0 results were museum scans and animals. CC0 cars exist only on Poly Pizza, Quaternius, Kenney and Khronos |
| OpenGameArt | The search page answered 403 to the fetch, so nothing was verified. Not listed |
| Sketchfab cars with 100k to 3.5M tris (Destroyed Car scans, SDC, Black Snow, Martin Trafas) | Real brands or raw scans, and past the 8 MB asset budget in `SKILL.md` |

## Recommendation

1. Pack first: #4 the Comrade1280 pack (ten generic cars at about 7k tris, one download covers the player car, rivals and traffic), then #1 V12 Goblin as the hero car and #6 Fairheaven LT '80 as a second playable, with #3 Molnia if the game is a hover racer.
2. How: download each one by hand from its page while logged in to Sketchfab (an account is the only blocker), then `npm run assets -- pack file:<path.glb> --id=<id> --licence=CC-BY-4.0 --author="<author>" --page=<model page URL> --tris=20000`, then `npm run assets -- sheet --ids=<id>` and open `references/audit/assets/<id>.jpg` to confirm the look, the wheels as separate nodes and the absence of any logo.
3. For a stylised kart game skip Sketchfab and use the Kenney racing kit through Patch, or CC0 Quaternius and Kay Lousberg cars, which need no credit.
