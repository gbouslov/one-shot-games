# Sources beyond Sketchfab: what a script can pull today, with no login

Researched 11 Nov 2026. Read first and not repeated: `ASSETS.md`, `CARS.md`, `GENRE-COVERAGE.md`. Nothing here was downloaded into the repo. I fetched metadata files, README pages, HEAD requests and 3 thumbnails into a scratch folder, nothing else.

**Grades** follow `ASSETS.md`: A holds up beside the bar's frames, B is good or stylised-usable, C skip. **Grades from metadata or thumbnails are marked "unrendered"**: put them through `npm run assets -- sheet` before anyone builds on them.

## The finding in one paragraph

**The Sketchfab models in `CARS.md` can be had with no login.** A Hugging Face user, `codepawl`, publishes cleaned GLB mirrors of Objaverse (CC0 and CC-BY only), Google Poly, Smithsonian, NASA and 100STYLE, each with a per-item licence, author and source URL in `metadata.jsonl`. Its Objaverse pack includes V12 Goblin and the Comrade1280 and Zhabotinsky cars from `CARS.md`. A script reads one JSONL, then fetches a single GLB with a plain `GET`. **Realistic AAA cars with separate wheels are still not solved**: nothing found is better than B. Realistic zombies, aircraft, mocap, explosion flipbooks, firearm recordings and cinematic music are solved.

## Top 10, ranked

| # | Source | Gap | Licence | Login | Grade | First asset to pull |
|---|---|---|---|---|---|---|
| 1 | **codepawl/objaverse-clean-glb** (HF mirror of Objaverse 1.0, 6,015 models) | cars, aircraft, boats, zombies, animals, armour | CC-BY-4.0 (5,976), CC0 (39), per item | No | **B** (A- on the zombie, unrendered for cars) | `zombie-73ef58af` (rigged, 10 clips, 4.8k tris) |
| 2 | **Unity Labs VFX flipbooks** (28 Houdini sequences) | fire, smoke, explosions | CC0 | No | **A-** on method (resolution not stated on the page) | `Explosion02HD-flipbooks.zip` (15 MB) |
| 3 | **codepawl/100style-glb** (810 mocap clips, 100 locomotion styles) | humanoid animation | CC-BY-4.0 | No | **A** (real mocap, 60 fps) | the `skeleton/` clips, retargeted with `tools/anim-retarget.mjs` |
| 4 | **Smithsonian Open Access 3D** (1,937 CC0 3D records via API, 3,451 in the mirror) | aircraft, space hardware, history, skulls | CC0 | No (`api_key=DEMO_KEY`) | **B+** (accurate scans, heavy) | `bell-x-1`, `1903-wright-flyer` |
| 5 | **OpenGameArt CC0 firearm sound packs** | gunshots, reloads, wood and melee impacts | CC0 | No (needs a browser User-Agent) | **B** (real recordings, uneven) | `the-free-firearm-sound-library` |
| 6 | **Scott Buckley music library** | music: cinematic, horror, sci-fi | CC-BY-4.0 | No | **A** | `Aphelion.mp3` |
| 7 | **NASA 3D Resources** (and its GLB mirror) | spacecraft, rovers, suits, Ingenuity helicopter | "free and without copyright" | No | **B** | `Ingenuity Mars Helicopter` |
| 8 | **codepawl/google-poly-glb** (9,971 models) | stylised cars, boats, planes, props | CC-BY-3.0 | No | **C+**, stylised | `airplane-8cidd9k8wha` |
| 9 | **SFXMint CC0 sound effects** (7,335, AI-made) | ambience, foley, UI | CC0 | No | **B-** (AI-made; disclosure needed) | `catalog.csv`, then one MP3 |
| 10 | **Open Source Avatars (ToxSam)** (300+ VRM) | stylised humanoids | CC0 | No | **B-** | `100Avatars R1` set |

**Sources that unlock a whole genre at once:**
- **#1 plus the asset index.** Zombie survival, a racing game with a generic hero car, a helicopter or jet flight game and a boat game all become buildable. `codepawl/asset-index` is one table of 37,668 assets from 6 libraries, with sizes in metres and a rigged flag. Its Megascans rows point at Fab (excluded here), so filter them out.
- **#3.** Third-person action, stealth, runner and fighting games each need 6 to 10 clips on the realistic MPFB bodies. `GENRE-COVERAGE.md` names this as gap 1, and 100STYLE is far larger than Universal Animation Library's 46 clips.
- **#2 with #5.** A burning-village or war-zone game gets real fire and real gunshots, the two things that read as cheap when coded.

## How the codepawl mirrors work (read before #1, #3, #4, #7, #8)

- **What they are.** One HF account repackaging public datasets: `objaverse-clean-glb`, `google-poly-glb`, `smithsonian-3d-glb`, `nasa-3d-glb`, `100style-glb`, `asset-index`. Each README states a filter and a licence; each `metadata.jsonl` has one row per item. Page: https://huggingface.co/datasets/codepawl/objaverse-clean-glb
- **Fetch pattern, verified by HEAD (HTTP 302, no token):** `https://huggingface.co/datasets/codepawl/objaverse-clean-glb/resolve/main/<path>` where `<path>` comes from the row's `files.engine`, for example `engine/zombie-73ef58af/zombie-73ef58af.glb`. Metadata: `.../resolve/main/metadata.jsonl` (8.7 MB for Objaverse, 12.6 MB for Poly, 4.9 MB for Smithsonian).
- **Use the `engine/` tier, not `objects/`.** `objects/` is meshopt-compressed, which needs a WebAssembly decoder; `ASSETS.md` says the artifact policy blocks that. `engine/` has no meshopt and no quantization, so `tools/assets.mjs pack file:` can re-quantize it. Sizes run 0.2 to 11 MB per model before packing.
- **Licence quote** (README of `objaverse-clean-glb`): "Each model keeps its own licence (CC BY 4.0 or CC0 1.0). CC BY requires credit: name the author, link the model and the licence, and say it was changed." Upstream, Objaverse's README says individual objects are CC-BY 4.0 (721K), CC-BY-NC, CC-BY-NC-SA, CC-BY-SA and CC0 (3.5K): https://huggingface.co/datasets/allenai/objaverse
- **Two risks to decide on, not hide.**
  - **Origin is Sketchfab.** No login is needed here, but the uploader on Sketchfab chose the licence. The owner's ruling was about logins; whether CC-BY models that originated on Sketchfab are acceptable is his call. Each row carries `source_url` and `author_url` for the credit line.
  - **Provenance is thin.** The mirror's own filters work from names, tags and descriptions ("not a legal review", its README says). A model uploaded without the rights to it can pass. Check the `source_url` page of every model before it ships, and drop anything with a real manufacturer or franchise.

## Gap 1: vehicles

**Cars.** Honest result: the best no-login cars are B. Pool counts from the Objaverse-clean metadata: 432 in `cars-vehicles`, 87 of them 4k to 90k tris with a car-like title. The list below is unrendered (the one thumbnail I opened for the V12 was washed out and showed nothing usable).

| Model (id in `objaverse-clean-glb`) | Author | Tris | Note |
|---|---|---|---|
| `fictional-supercar-v12-goblin-0a20e49a` | ollitei | 86,623 | Invented 2012 design; needs `--tris=40000`. Same model as `CARS.md` #1 |
| `retrowave-lowpoly-car-remake-81c1d168` | BetelgeuseMan | 29,514 | Fits a 60k budget as is |
| `70s-italian-concept-car-669ba289` | Daniel Zhabotinsky | 11,102 | Same author as `CARS.md` #6 and #7 |
| `generic-town-bus-14fe03d7`, `kenworth-w-900-a-1973-timber-carrier-7457a672` | own.guest, eightismore | 55,527, 18,741 | Traffic. Kenworth is a real marque: do not ship |

- **Trademark.** Drop `jaguar-xj220-1991`, `2000-jaguar-xj-sport`, `car-49-mercury`, `studebaker-car-model`, `blade-runner-car`, `the-fifth-element-korben-s-taxi` and `retro-wave-lotus-espirit`. They are real marques or film props.
- **Wheels separate?** Not stated in any metadata. Open each GLB's node list after the pack step.
- **Already known and unchanged:** Khronos `CarConcept` (CC-BY 4.0, https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) and `ToyCar` (CC0). Both load straight from GitHub with no login. CarConcept is the best-looking body I can name, at a size the budget may not take.
- **Quaternius and Kenney car packs** stay the stylised fallback (CC0, https://quaternius.com/faq.html: "All models are under the CC0 License"). Quaternius packs `cars`, `ships`, `spaceships`, `animatedtanks`, `publictransport` are listed on https://quaternius.com/. Downloads are drive or itch click-throughs, so a script cannot pull them.
- **CC-BY 3.0 is allowed by the goal text**, which `CARS.md` excluded. That opens the Google Poly mirror (#8) and Poly Pizza's older cars. Both are low-poly and stylised.

**Aircraft.** Four routes, best first.
- **Smithsonian (#4).** `1903 Wright Flyer`, `Bell X-1`, `Orbiter Space Shuttle OV-103 Discovery`, two Apollo 11 command modules. API, no key beyond the public demo one: `https://api.si.edu/openaccess/api/v1.0/search?q=online_media_type:"3D Models"+AND+Bell+X-1&api_key=DEMO_KEY`. Licence field in the record: `metadata_usage.access: "CC0"`. Direct file from the record, e.g. `https://3d-api.si.edu/content/document/3d_package:6c69a6bb-55e6-4356-8725-120ff7f8d652/resources/bell_x1_low_resolution.glb` (32.8 MB). The 953 KB Bell X-1 file is Draco-compressed, which needs a decoder at pack time. `DEMO_KEY` is rate-limited, so a bulk pull wants a free api.data.gov key (an email sign-up). Grade B+: real scans, real proportions, 150k tris and textures to cut. CC0 covers copyright only, so keep the Smithsonian name and any logos out of the game.
- **Objaverse-clean.** `mi-24-hind-004d6814` (4,237 tris, 1 clip), `attack-helicopter-concept-8980af71` (3,114), `low-poly-apache-gunship-035ed0b9` (2,907), `stylized-ww1-plane-c4edeb0e` (7,692, animated), `war-plane-b487f112` (101,596), `jet-fighter-ba8c9ca8` (41,276). I opened the jet's thumbnail: an F-15E with a unit number and a roundel. **Real insignia and a real type: needs repainting or skip.** Grade B, helicopters stylised-leaning.
- **NASA (#7).** Only one aircraft (`X-57`) and the Mars helicopter in the 227-model list. Models are spacecraft, rovers and suits. https://github.com/nasa/NASA-3D-Resources says "These assets are free and without copyright." There is no licence file in the repo (the licence API returns 404), and the `codepawl/nasa-3d-glb` README warns that the NASA insignia and some patch textures sit on named models. Files are `.3ds`, `.obj`, `.blend`, so use the GLB mirror.
- **Poly Haven and Khronos.** No aircraft.

**Boats.**
- **Poly Haven, CC0, A:** `dutch_ship_large_01` (110,616 polys), `dutch_ship_large_02` (96,506), `dutch_ship_medium` (69,162), `ship_pinnace` (183,837, rigged). Found through `https://api.polyhaven.com/assets?t=models&c=ships`. Already on Patch, so `npm run assets -- pack patch:polyhaven:dutch_ship_medium` works. Sailing ships only. They need simplifying to fit the budget.
- **Objaverse-clean:** `wooden-boat-55118b23` (1,880 tris), `u-boat-eae3d9b1` (5,678), `ship-b1167087` (7,704). Grade B-.
- **Modern speedboats, yachts, patrol boats:** nothing realistic found. Kenney `watercraft-kit` is the stylised fallback.

**SimReady (already graded in `ASSETS.md`).** Vehicle content is forklifts (`vehicle_forklift_blue_c01`, red b01, c01) and tilt trucks only. No cars. Also on HF as GLB: `codepawl/simready-glb`, 2,595 models.

## Gap 2: characters, creatures, animation

**Zombies and creatures.** The mirror's search answered this where Patch could not (`GENRE-COVERAGE.md`: zombies 10 on Patch, all stylised).
- `zombie-73ef58af` (pxltiger, 4,824 tris, **10 clips**, CC-BY-4.0). **I opened the thumbnail: a gaunt, textured, realistic humanoid.** Unrendered in-engine, but the best realistic zombie in this pass. Grade A-. Rig is likely not MPFB, so its own clips are what you get.
- `zombie-warrior-2457028a` (9,499 tris, 3 clips), `zombie-4bd337e8` (3,264, 3 clips), `fuse-female-zombie-1-98415df5` (21,519 tris, 1 clip; Fuse-origin, check its description).
- Animals with clips: 174 of 513 in `animals-pets`. Examples: `tiger-01d68503` (15,330 tris), `great-white-shark-b67415aa` (5,098), `hummingbird-flying-4e6d591f`.
- **Poly Haven** has one creature (`street_rat`, 14,286 polys, CC0, already in the library per `ASSETS.md`). Nothing else.

**Armour and historical figures.** Thin. Objaverse-clean has `leather-armor-0693e6cb` (40,257 tris, Blueprint Games), `lion-armor-e6c95315`, and 137 items in `cultural-heritage-history`. Smithsonian has skulls, busts and costumes (scans, not game armour). **Still best done as coded plates on MPFB bodies**, as `GENRE-COVERAGE.md` gap 5 says.

**Stylised humanoids (CC0).** Open Source Avatars (#10): 300+ VRM avatars (ToxSam collections 100Avatars R1 to R3) on Arweave, plus a 4,260-avatar gallery site. Quote from https://github.com/ToxSam/osa-gallery: "100Avatars R1, R2, R3 - 300+ avatars ... Use however you want, no attribution needed." VRM files load in three.js with `@pixiv/three-vrm`. Anime-leaning; fine for stylised.

**Humanoid animation (beyond UAL 1 and 2, 100STYLE and CMU).**
- **100STYLE as GLB (#3).** https://huggingface.co/datasets/codepawl/100style-glb , CC-BY-4.0 (README: "Credit: The 100STYLE Dataset - Ian Mason"). Upstream page says "This work is licensed under a Creative Commons Attribution 4.0 International License": https://www.ianxmason.com/100style/ . 810 clips: forwards and backwards walk and run, sidesteps, idle and transitions in 100 styles. **`skeleton/` is the bare 23-joint source skeleton with root motion**, which is what `tools/anim-retarget.mjs` needs. Fingers are not captured. 6.85 GB for `engine/`, so pull single clips, never the repo.
- **Ready Player Me Animation Library: excluded.** https://github.com/readyplayerme/animation-library LICENSE: "The Animations are licensed for use with Ready Player Me Avatars. Any use ... with avatars or characters other than those from Ready Player Me is prohibited" and "You may not redistribute".
- **Mixamo, AMASS, LAFAN1, HumanML3D:** excluded (Adobe terms, non-commercial or no-derivatives).
- **CMU mocap:** I could not read a licence sentence on mocap.cs.cmu.edu (the FAQ and info pages returned no wording on use). Still unverified; skip it, 100STYLE covers locomotion.

## Gap 3: sound and music

**Rule of thumb for this repo: nothing that forbids passing the raw file on.** That excludes the following, each read this pass.
- **BBC Sound Effects** (https://sound-effects.bbcrewind.co.uk/licensing): "use them in your own personal/educational projects, or licence them for use". Non-commercial without a paid licence. **Excluded.**
- **Pixabay** (https://pixabay.com/service/license): "You cannot sell or distribute Content ... on a Standalone basis." Audio is named explicitly. This repo is a distributor of the files. **Excluded.**
- **Mixkit:** the official licence text could not be read; secondary sources say not to "redistribute them without making significant changes". **Excluded as unverified.**
- **Sonniss, Zapsplat, Epidemic:** already excluded or no-redistribution.
- **Freesound:** CC0 download needs a login, as `ASSETS.md` says. The API needs a token. **Not scriptable.** The one login-free route into its clips is the LAION dump below.

**Usable.**
- **OpenGameArt CC0 SFX (#5).** Fetch works only with a browser User-Agent (default curl returns 403). Each page shows "License(s): CC0" and a direct file link:
  - https://opengameart.org/content/the-free-firearm-sound-library (Ben Jaszczak et al., `Prepared SFX Library.7z`, real firearm recordings)
  - https://opengameart.org/content/gunshot-sounds (Tabasco, `sounds.zip`)
  - https://opengameart.org/content/gun-reload-sounds (SpringySpringo, WAV)
  - https://opengameart.org/content/35-wooden-crackshitsdestructions and https://opengameart.org/content/3-melee-sounds (impacts)
  - https://opengameart.org/content/100-cc0-sfx-2 and https://opengameart.org/content/80-cc0-rpg-sfx (rubberduck; footsteps, doors, ambient loops, creature sounds)
  - **Grade B.** Quality is uneven by author, so audition each before it ships. Ambience beyond rubberduck's loops is thin.
- **SFXMint (#9).** `flreey/sfxmint-cc0-sound-effects` on HF: README says "7,335 sound effects ... released under CC0 1.0". **"Every sound is AI-generated"** (Stable Audio 3), and the README says Steam and itch.io require disclosing AI-generated content. `catalog.csv` links each MP3 and WAV on sfxmint.com. Grade B-, same provenance caution as `ASSETS.md` gives Scenario.
- **Freesound LAION-640k commercial subsets** (`benjamin-paine/freesound-laion-640k-commercial-16khz-*`). 403,146 clips in the full set, per-clip `license` label (CC0-1.0, CC-BY-4.0, CC-BY-3.0, and others), `username` and `freesound_id` for credit. **Filter to the first three labels yourself**: the set also carries `CC-Sampling+`. Single clips come through the datasets-server rows API with no login. **Two problems: 16 kHz audio, and no text labels, so finding "a rifle shot" is a guess.** Grade C for effects. Useful for noise beds only.
- **Wikimedia Commons audio:** the gunshot files checked were CC BY-SA, which is out. **Excluded.**

**Music.**
- **Scott Buckley (#6).** https://www.scottbuckley.com.au/library/ : "All music is licensed under Creative Commons Attribution 4.0 ... free to use, as long as you credit me", "for filmmakers, game designers and media artists". Direct MP3 on each track page, for example `https://www.scottbuckley.com.au/library/wp-content/uploads/2026/04/Aphelion.mp3`. Orchestral and cinematic, which incompetech's catalogue lacks. Credit line required in the game. Grade A.
- **OGA CC0 music** exists in bulk but is uneven; read each page.

## Gap 4: VFX flipbooks

**Unity Labs VFX image sequences (#2).** https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks . Quote: "Here are some image sequences we want to share with you under CC0 license." The page does not say which of the 28 are CC0; the blanket sentence covers the list, but the page also says "we release some of these sequences", so confirm against a second copy before a release. **Download is a plain GET, no login**, three forms per sequence (flipbook sheets, EXR frames, TGA frames):

`https://unity3d.com/files/labs/downloads/vfx/assets01/<Name>/<Name>-flipbooks.zip`

HEAD checks, all HTTP 200 `application/zip`: `Explosion02HD` 15.3 MB, `FireBall01` 5.9 MB, `WispySmoke01` 4.6 MB. Names: `Explosion00`, `Explosion01`, `Explosion01-nofire`, `Explosion02HD`, `FireBall01` to `04`, `Flame02`, `Flame03`, `SmallFlame01-temperature`, `WispySmoke01` to `03b`, `DiscSmoke01`, `CandleSmoke01`, `Cloud01` to `04`. Made in Houdini in 2016, so volumetric looking, not cartoon. **Frame size, grid and alpha are not stated on the page**; read one zip before promising a look. Kenney's flame and smoke sprites (already on Patch) stay the fallback.

Others looked at and dropped: OGA "2D Explosion Animations" (stylised), itch.io pixel explosions (64 px), the paid Gumroad realistic pack ($10, not free). itch.io has no login-free download API.

## Gap 5: anything else that visibly raises quality

- **Poly Haven models and materials:** already the base. Nothing to add. Its tree models stay unusable at 1 to 17 million polys, as `GENRE-COVERAGE.md` says (pine_tree_01 is 17.4M).
- **NVIDIA SimReady (HF):** `nvidia/simready-assets`, CC-BY-4.0 (tag `license:cc-by-4.0`), 1.4M downloads, USD source. `codepawl/simready-glb` gives GLB. Warehouse, factory and medical props, no vehicles bar forklifts. Already on Patch. For indoor, industrial and medical levels it remains the strongest source.
- **Photogrammetry building kits, modular interiors, decals:** found none that are CC0 and scriptable beyond Poly Haven, ambientCG and Kenney. `codepawl/plateau-city-glb` (Japan's government city models, CC-BY-4.0) is a real-city source, but I did not read its terms or look at it.
- **The Base Mesh** (https://thebasemesh.com): "1250+ Base Meshes 100% Free. CC0 License." Untextured sculpting bases. **Grade C for this bar.**
- **Blender Studio** (https://studio.blender.org/terms-and-conditions): "all digital content ... 3D data is available under the Creative Commons Attribution 4.0." Production character and prop files sit behind a Blender Studio account, and they are `.blend`. **Not scriptable, stylised. Skipped.**
- **three.js examples/models/gltf:** 48 files, **no licence file** (the folder README returns 404). `Soldier.glb` and `Xbot.glb` are Mixamo, `ferrari.glb` is a real marque. **Excluded.**
- **Wikimedia Commons 3D:** about 11,860 hits, mostly `.stl`, mixed licences. **Skipped.**
- **Godot, Bevy, Mozilla Hubs samples:** not opened. Their demo assets are mostly low-poly. Low expected value.

## Sources checked and ruled out, with the reason

| Source | Reason |
|---|---|
| BBC Sound Effects | personal or educational use only without a paid licence |
| Pixabay, Mixkit | standalone redistribution restrictions |
| Ready Player Me animations | only for RPM avatars, no redistribution |
| Freesound direct | login for CC0 download, API token |
| three.js examples models | no licence file, Mixamo and real-brand files |
| Blender Studio production files | account-gated `.blend` |
| Objaverse++ (`cyzhou/objaverse-plus-plus`) | the HF API returned an auth error, so unverified |
| Wikimedia Commons audio and 3D | CC BY-SA, STL |
| Objaverse raw (`allenai/objaverse`) | 90k of 798k are NC or SA. **Never fetch it raw**: use the clean mirror, or filter its metadata's `license` to cc0 and cc-by yourself |

## The three moves

1. **Build a local index from the three codepawl JSONL files and pack a vehicle and creature shortlist.** Pull `objaverse-clean-glb/metadata.jsonl` (8.7 MB) and filter by `license`, `category` and `triangles`. Then `pack file:` the `engine/` GLB of `zombie-73ef58af`, `fictional-supercar-v12-goblin`, `retrowave-lowpoly-car-remake`, `70s-italian-concept-car`, `mi-24-hind` and `wooden-boat`, and run `sheet` on all six. About 20 minutes of agent time. It settles in one look whether cars reach B or only C. The owner makes the one call this needs: are Sketchfab-origin CC-BY models acceptable without a login.
2. **Add the two missing kit steps with sources that have no catch.** A flipbook particle step fed by Unity's `Explosion02HD`, `FireBall01` and `WispySmoke01`, and an audio pack step fed by the OGA firearm library and two Scott Buckley tracks (the `decodeAudioData` plan in `GENRE-COVERAGE.md` pack list 3). About 30 minutes each.
3. **Retarget 100STYLE onto the MPFB bodies and fetch two Smithsonian aircraft.** The retargeter already passes its checks on Universal Animation Library, so the `skeleton/` clips are a data change, not a new tool. Add Bell X-1 and the Wright Flyer as the first realistic aircraft for the `flight` starter. About 30 minutes.

**Not agent time:** the owner's yes or no on Sketchfab-origin models (move 1), a free api.data.gov key if the Smithsonian pull goes past a handful of items, and a person looking at every sheet before any of this ships.
