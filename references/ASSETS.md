# Asset sources: licences, grades, sizes

Every source the asset library could draw from, read and graded on 10 Nov 2026. The library itself is `assets/` (the catalogue is `assets/catalog.json`), the step that packs and inlines it is `tools/assets.mjs`, and the one-page guide a model reads is `skills/asset-library/SKILL.md`.

**Grades** use the same bar as `references/AUDIT.md`:
- **A**: holds up beside the bar's frames (`audit/felix-*.jpg`) at first-person distance.
- **B**: good, and usable in a stylised game or as background.
- **C**: skip.

**Screenshots** are our own renders, made with `npm run assets -- sheet` on software WebGL, lit by one HDRI from the library. They are in `audit/assets/<id>.jpg` and labelled with the source's asset id.

## How the bar was made, and the other route

The bar, "Saltline", is 3.6 MB of HTML. 1.9 MB of that is a base64 copy of an older version of itself, and three.js r180 is bundled in. It has no glTF and no base64 model data: its rifle, gloves, textures and sounds are all generated in code. Claude-of-Duty's guns come from about 40 coded part builders, which lane 1 has already taken into `kit/`. That route looks right, but every game pays for it again in hours of generation and tuning.

This lane adds the other route: **ready-made scans, compressed once and dropped in with one command.** A scanned barrel is a few hundred KB and costs nothing to "write".

## What fits in one artifact

| Fact | Number | Source |
|---|---|---|
| Artifact page limit | 16 MiB (16.78 MB) | `references/artifact-rules.md` |
| This lane's target for a game | 12 MB | brief |
| Engine, kit and game code | about 0.65 MB | `npm run build` of the starter |
| Base64 overhead | ×4/3 | every byte is inlined as text |
| **Asset budget per game** | **about 8 MB of packed files** (10.7 MB once inlined) | `games/asset-demo` measured 11.71 MB in total |

**Format choices, and why.** The artifact's content policy, as `tools/lib/harness.mjs` approximates it, has no `wasm-unsafe-eval`. That rules out Draco, meshopt and KTX2/Basis, since all three need a WebAssembly decoder at runtime. The library therefore ships:

- **Geometry**: quantized (`KHR_mesh_quantization`). three's GLTFLoader decodes it natively, and it is about half the size of float geometry.
- **Textures**: WebP. Normal maps are encoded at a higher quality. Images decode through `createImageBitmap(Blob)`, never through a URL, because the policy has no `blob:` in `connect-src` and three's default `ImageBitmapLoader` would `fetch()` one.
- **Skies**: two files.
  - The background is an sRGB WebP of the HDRI, scaled so the bright sky sits just under white; the loader scales it back.
  - A 256×128 RGBE light probe, deflated and inflated in the browser with `DecompressionStream`, drives reflections and ambient light. The sun is found at pack time and stored, so a game can aim its shadow-casting light where the sky's sun is.

Nothing in this chain uses `fetch`, a `blob:` URL load, `eval` or WebAssembly. `games/asset-demo` passes the playtest's artifact policy check.

## Patch: the main search-and-fetch layer

[Patch](https://patch.gg) runs an open HTTP API over 58,994 assets, every one CC0 (43,457) or CC-BY-4.0 (15,537). Each asset comes with its licence evidence, a ready credit line and SHA-256 file hashes. No login is needed. Read on 10 Nov 2026 from `GET https://patch.gg/api/v1/assets/facets`; docs at https://docs.patch.gg/llms.txt.

- **Sources:**
  - Kenney 36,003
  - Amazon Berkeley Objects 7,498
  - Polyfork 3,070
  - ambientCG 2,637
  - Poly Haven 2,383
  - NVIDIA SimReady 2,382
  - KayKit 1,890
  - incompetech music 1,443
  - Scenario (AI-made) 1,059
  - Patch's own 337
  - OpenGameArt 284
- **Types:** 21,468 models, 30,686 sprites, 2,906 materials, 1,432 HDRIs, 659 sounds, 1,812 music tracks.

`tools/assets.mjs` uses it directly over HTTP. We did not use the `@patchgg/cli` installer or `pch agent install`, which adds an MCP server to every agent on the machine.

- `npm run assets -- search <words> [--type=model|material|hdri] [--real] [--ai=any]` searches. AI-made assets are hidden unless asked for.
- `npm run assets -- pack patch:<id>`:
  - reads the asset, refuses any licence other than CC0-1.0 or CC-BY-4.0, and picks the `web` variant (or `src`);
  - downloads each file and **checks its SHA-256 against Patch's**;
  - packs it through the same quantize + WebP pipeline;
  - records Patch's credit line, the upstream source and the AI flag in the catalogue and in `assets/CREDITS.md`.
- Patch's own `preview` variants use meshopt, which needs a WebAssembly decoder the artifact policy blocks, so they are never used.

**Patch graded per type, against the bar.** Our renders are in `audit/assets/`.

| Type, source on Patch | Grade | Evidence | Notes |
|---|---|---|---|
| Models: **Poly Haven** (2,383 across types) | **A** | `Barrel_01.jpg`, `fire_hydrant.jpg`, `korean_fire_extinguisher_01.jpg` | The same scans as Poly Haven direct. Patch moves the pivot to bottom centre, which is good for props. **Keep held weapons direct from Poly Haven**, because the grip offsets assume the original pivot |
| Models: **NVIDIA SimReady** (2,382) | **A** | `box_cardboard_a01.jpg`, `pallet_b01.jpg` | Measured, clean warehouse and industrial props. CC-BY 4.0, so a credit line is required. Raw files are huge (13–65 MB, 2K textures, some 100k–670k tris) but pack small: a 13 MB pallet becomes 126 KB, a 9 MB box 36 KB. Skip the 100k+ tri items |
| Models: **Amazon Berkeley Objects** (7,498) | **B** | `B07DC168ZT.jpg` | Real product scans of furniture and household items, CC-BY. Many carry **brand marks** (the sample chair has a logo), so check each render. Heavy (75k+ tris); simplify to 12k |
| Models: **Kenney** (36,003), **KayKit** (1,890), **Polyfork** (3,070) | **C for this bar, B for stylised games** | `city-kit-industrial_shipping-container-a.jpg`, `medieval-hexagon_decoration_props_barrel.jpg`, `wooden-crate-e46521.jpg` | Clean flat-shaded low poly at 16–17 KB packed each: hundreds fit in one game. The right default for stylised genres (platformer, tower defence, kart, top-down). Polyfork is CC-BY |
| Models: **Scenario** (1,059, AI-made) | **B-** | `asset_aSmc3vuynxuvC958oTqVC92j.jpg` | Stylised sci-fi crate, plausible at a glance. Raw files are bloated (up to 1.26M tris). AI-made assets are CC-BY here, but provenance is weaker: the model that made them was trained on unknown data, and an "original games only" repo should not lean on them. **Hidden by default** in our search (`--ai=any` to see them); use only when nothing else fits |
| Models: weapons and characters | **C** | search results | "assault rifle" returns 1 hit (AI-made, 1.26M tris). "rifle" returns low-poly Polyfork and Kenney toys plus the Poly Haven bolt-action. "first person arms" and "fps hands" return **0**. Keep the scanned CC0 rifle and the kit's coded guns and gloves |
| Materials: Poly Haven and ambientCG (2,906) | **A** | `brick_wall_10.jpg`, `asphalt_02.jpg` | Patch serves 1K JPEG maps with a packed ARM. That is the same as our direct path at 1024 px, and every map is tileable PBR |
| HDRIs (1,432) | **A for light, B for backdrop** | `kloofendal_38d_partly_cloudy_puresky.jpg`, `belfast_sunset.jpg` | Patch serves a **1K** HDR plus a 1024×512 tonemapped background, so a photographed horizon (buildings, trees) is visibly soft on screen. Use **pure-sky** HDRIs from Patch (clouds hide the softness), or Poly Haven direct at 2K when the skyline matters |
| Sounds (659) and music (1,812, incompetech) | not graded this pass | — | The library has no audio step yet; the kit's sounds are generated in code |

## The sources

The licence column quotes the page we read, on 10 Nov 2026.

| Source | Licence, page read | Login to download? | Grade | Our screenshot | Typical size after packing | Take? |
|---|---|---|---|---|---|---|
| **Poly Haven** models | CC0. polyhaven.com/license: "You can redistribute them, share them around, include them when sharing your own work, or even in a product you sell." | No (open API) | **A**: photoscanned props, weapons and tools; holds up at arm's length | `audit/assets/Barrel_01.jpg`, `bolt_action_rifle_7_62.jpg`, `metal_tool_chest.jpg`, `portable_generator.jpg` | Props at 512 px: 55–516 KB, median 269 KB. Hero items at 1024 px: 245–1,542 KB, median 354 KB | **Yes**: 36 models |
| **Poly Haven** textures | CC0 (same page) | No | **A**: scanned, true-scale (each records its real tile size) | `audit/assets/asphalt_02.jpg`, `factory_brick.jpg`, `rusty_metal_02.jpg` | 1024 px colour + normal + ORM: 37–911 KB, median 533 KB. At 512 px, about a quarter of that | **Yes**: 18 |
| **Poly Haven** HDRIs | CC0 (same page) | No | **A**: real skies with real light; background, reflections and sun from one file | `audit/assets/construction_yard.jpg`, `the_sky_is_on_fire.jpg`, `satara_night.jpg` | 2048 px background + probe: 109–653 KB, median 200 KB | **Yes**: 9 |
| **ambientCG** materials (and HDRIs) | CC0 1.0. docs.ambientcg.com/license: "You can copy, modify, distribute and perform the assets, even for commercial purposes, all without asking permission." | No (open API, zip) | **A**: same class as Poly Haven, with more bricks, tiles and ground | `audit/assets/Concrete049.jpg`, `Bricks113A.jpg`, `Ground111.jpg`, `Metal063.jpg` | 1024 px: 279–882 KB | **Yes**: 4 so far; the pack step reads its zips |
| **Khronos glTF-Sample-Assets** | Per model; read each README. CC0: Lantern, WaterBottle, BoomBox, FlightHelmet, SciFiHelmet, Corset, Avocado, SheenChair, ToyCar. CC-BY 4.0 with credit: ABeautifulGame, StainedGlassLamp, IridescenceLamp, GlassHurricaneCandleHolder, CarConcept, ChronographWatch, CesiumMan, Fox | No (GitHub) | **B**: well made, but test objects, not a set | `audit/assets/khronos_lantern.jpg`, `khronos_water_bottle.jpg` | 116–219 KB at 512 px | **Yes, the CC0 ones, as needed**: 2 so far. **Never DamagedHelmet** (built on a CC BY-NC model), DragonAttenuation (Stanford, non-commercial) or Sponza (Crytek licence). Several CC-BY models carry Khronos, DGG or Cesium logos, which are trademarks |
| **Kenney** | CC0. kenney.nl/support: "all game assets on the asset pages are public domain licensed (CC0)… Attribution is not required." | No, but the download link is behind a script | **C for this bar, B for stylised games**: flat-shaded low poly | none: the download is a browser click-through, so not scripted this pass | Packs are small (10–100 KB per model) | **Later, for stylised genres.** Don't repackage a whole pack (the author asks) |
| **Quaternius** | CC0. quaternius.com/faq.html: "All models are under the CC0 License… can be used for free without the need for attribution" | No, but hosted on drives behind a click | **C for this bar, B stylised**: the Ultimate Gun Pack is low poly with flat colours | none (same reason) | about the same as Kenney | **Later, for stylised genres** |
| **KayKit** (free tier) | CC0. kaylousberg.itch.io/kaykit-dungeon-remastered: "Free for personal and commercial use, no attribution required. (CC0 Licensed)." The Extra and Source tiers are paid | No, but itch click-through | **B stylised**: dungeon, city and character kits | none | small | **Later**, free tier only; check each pack's own page |
| **Sketchfab** (downloadable CC0 / CC-BY) | The uploader picks the licence. sketchfab.com/licenses. Take CC0, and CC-BY with credit. Never ND, NC, SA, or the Standard/Editorial store licences ("may not… distribute… as a stand-alone file") | **Yes**: account and API token | **A** at the top: the best FPS arms and modern rifles found anywhere are here | Our renders of GitHub mirrors: `audit/assets/hk416_candidate.jpg`, `m4a1_candidate.jpg`, `gloves_candidate.jpg`, `ak74m_arms_candidate.jpg` | Rifles 1.3–2.4 MB at 1024 px. Rigged arms 0.4 MB. An animated arms-and-rifle set is 6.4 MB (too big for one game) | **Not this pass.** No account here. Byte-for-byte GitHub mirrors exist, but see the rifle and arms notes below |
| **Freesound** | Per sound: CC0, CC-BY, CC-BY-NC, plus legacy Sampling+. freesound.org/help/faq/ | **Yes**: "make sure you are logged into your registered account" | n/a (audio) | n/a | n/a | **Not this pass** (login). CC0 and CC-BY only when it happens; never NC or Sampling+ |
| **OpenGameArt** | Per asset: CC0, CC-BY, OGA-BY, CC-BY-SA, GPL, LGPL. opengameart.org/content/faq (the page answered 403 to our fetch; read from secondary sources) | No | **B at best**: a few good CC0 items (LonesomeDucky's AKM, Mk2 grenade, derringer) | none committed | 50–500 KB | **Per asset**, CC0, CC-BY or OGA-BY only. **Never SA or GPL**, which would pull the game itself under copyleft |
| **Sonniss GDC bundles** | Sonniss licence. sonniss.com/gdc-bundle-license/: "Licensee may not distribute, publish, sub-license or otherwise supply the sound effects as sound effects" | Account on the page | n/a | n/a | n/a | **No, not in the repo.** A shipped game may use them, but this repo would be redistributing raw files |
| **Mixamo** (Adobe) | Adobe terms. The community FAQ says the only thing not allowed is to "distribute the raw character and animation files" (Adobe's own page answered 403) | Adobe ID | n/a | n/a | n/a | **No**: no raw redistribution, and this repo is the redistribution |
| **Fab / Quixel Megascans** (Epic) | Fab Standard License: may not "resell or redistribute the asset for free on a standalone basis" | Epic account | (A, but excluded) | n/a | n/a | **No**: no standalone redistribution, so nothing can be committed |
| **Poly Pizza** | Per model: CC0, or CC-BY 3.0 for the old Google Poly archive (the site answered 403; read from secondary sources) | No | **C for this bar**: low poly | none | small | Later, stylised only, per model |
| **Smithsonian Open Access 3D** | CC0 per item; others are "Usage conditions apply" (si.edu answered 403; secondary) | No | B: museum scans, few game props | none | varies | Later, only items marked CC0 |
| Textures.com, CGTrader free, TurboSquid free, Free3D | Redistribution prohibited, or the asset must be "not extractable". A base64 asset in a shared HTML file is extractable | — | — | — | — | **No** |

## Rifles and arms: the hard part

The brief asks for a hero rifle and gloved first-person arms. What exists, ranked (full search notes are in the handoff):

| Item | Licence | Grade | Problem | Used? |
|---|---|---|---|---|
| Poly Haven **Bolt Action Rifle 7.62** (scan, 20k tris) | CC0 | **A** as a scan | It is a vintage scoped bolt-action, not a modern carbine | **Yes: the demo's hero rifle**, in the kit's hands |
| Poly Haven **Service Pistol**, **Hatchet**, Machete, Stick Grenade, Crowbar, Sledgehammer, Baseball Bat | CC0 | A | none | Pistol and hatchet in the demo; the rest are in the library |
| "HK 416 A7" (r4m, Sketchfab, GitHub mirror) | CC-BY 4.0 | A | **Carries a real manufacturer's logo on the receiver**; the texture needs painting out before it can ship | No (render only: `hk416_candidate.jpg`) |
| "Assault rifle M4A1" (bobeer) | CC-BY 4.0 | A- | Maker-style markings; an optic styled on a real brand; 2.4 MB | No |
| **"Gloves for fps game"** (bobeer), rigged, 47 joints, no clips | CC-BY 4.0 | **A** | Rigged but unposed. Needs grip poses written against the kit's hand rig | No (render only: `gloves_candidate.jpg`). **The next lane's best upgrade** |
| "FPS AK-74m animations" (ccransh): arms and gun, 8 clips | CC-BY 4.0 | A- | 6.4 MB packed. The upstream gun's licence is unconfirmed (its source left Sketchfab) | No |
| Robin Lamb low-poly rifle and hands (OGA) | CC0 | C | 492 tris, untextured | No |
| Quaternius / Kenney guns | CC0 | C for this bar | Flat-shaded toys | No |

**CC0 FPS arms do not exist at this quality.** The CC0 search on Sketchfab returned no arms at all. So the demo keeps the kit's procedural gloved hands (from Claude-of-Duty, MIT), which grip whatever item a game gives them, and puts scanned weapons in them. The arms are code; everything they hold, and everything in the world, is a scan.

## What is in the library now

87 verified favourites, 29 MB on disk against a cap of about 300 MB:
- 37 fetched through Patch (5 of them by the fresh-session receipt);
- 44 from Poly Haven direct (the held weapons, plus the first batch, made before Patch was found);
- 4 from ambientCG;
- 2 from Khronos.

The four viewmodel candidates, the branded ABO chair and the AI-made crate were rendered for grading and then dropped. Run `npm run assets -- list` for the current list, or read the short table in `skills/asset-library/SKILL.md`. Everything else is one `search` away on Patch: **the repo keeps favourites, not a mirror.**

Grow it with one command per asset:
- `npm run assets -- pack patch:<id>` (the default)
- `npm run assets -- pack polyhaven:<id>`
- `npm run assets -- pack ambientcg:<id>`
- `npm run assets -- pack file:<path> --licence=CC0|CC-BY-4.0 --author=… --page=…` (refuses anything else)

Every entry records its source page, licence, authors, date read, size in metres, triangles and packed bytes.
