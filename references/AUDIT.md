# Reference audit

Every reference this repo points at, graded against one bar, with a screenshot, its best part and whether we take it. Written 10 Nov 2026. Screenshots are in `references/audit/`.

**Grades**
- **A**: AAA-looking in motion. Holds up beside the bar.
- **B**: good parts worth taking (a mechanic, a look, a technique, open-licence code).
- **C**: junk for this repo: broken, dead, trivial, ugly, or built on someone else's game.

## 1. The bar: Felix Rieseberg's one-shot FPS (Claude Fable 5.2)

| | |
|---|---|
| Where | Public artifact `claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp`, posted on X on 9 Nov 2026 with a 72-second video |
| What we could see | The video, from the post's public media. 18 frames, one every 4 s: `audit/felix-contact.jpg`; full frames `audit/felix-01-interior.jpg`, `felix-06-hands.jpg`, `felix-11-dock.jpg`, `felix-13-weapon.jpg` |
| What we couldn't see | The running game. In Playwright's own Chromium with a throwaway profile, the artifact URL redirects to a Cloudflare bot check ("Performing security verification"), which we did not try to get around. No source or licence is published, so nothing of it is copied |
| Grade | **A**: the bar |

What makes it read as AAA, frame by frame:
1. **The held weapon is the hero.** A rifle with a few hundred parts: rail teeth, vented handguard, a boxy holographic sight with a lit lens, a flashlight, a suppressor, rain beads on the metal. Dark gunmetal with real specular highlights and bevelled edges. It fills the lower right third.
2. **Gloved hands that grip.** Two-tone tactical gloves with knuckle pads and a sleeve cuff; the support hand wraps the handguard. The hands are not the strongest part (the near hand in `felix-06-hands.jpg` is a rounded block with stripes), but they hold the weapon convincingly and are lit like it.
3. **Light with direction and air.** A low sun behind cranes, god rays through warehouse doors, fog that separates near from far, wet ground that reflects the sky, contact darkening in every corner.
4. **Density.** A container port: stacked containers, a ship hull with a painted name, gantry cranes, hazard stripes, cable drums, pallets, signage. Nothing is a bare primitive.
5. **A strong grade.** Teal shadows, warm highlights, crushed blacks, a slight film look.
6. **A quiet HUD.** Compass strip, objective, ammo and health in thin type, radio subtitles.

## 2. The failed build: "Ember & Bone" (the caveman FPS from the previous starter)

Its frames were read for this audit and are kept out of the repo (it was a person's own run). Built in 90 minutes on the old starter; passed 36 of 39 playtest checks. **Grade C against the bar.** Exactly what makes it amateur:

| Part | What is on screen | Why it fails |
|---|---|---|
| Hands | A sphere for the palm, four capsules for fingers, a cylinder for the forearm, one flat brown material | No knuckles, no thumb pad, no wrist, no skin detail, no separation between fingers; it reads as a toy mitten. The fist does not close around anything |
| Weapons | The sling is a bowl on a stick; the spear and club are single cylinders and boxes | No silhouette worth looking at, no wear, no binding detail, flat colour |
| Materials | Every surface is one `MeshStandardMaterial` colour, no texture | No grain, no edge wear, no cavity dirt; wood, hide and stone all read as painted plastic |
| Viewmodel lighting | The hand is lit the same dull brown from every angle | No key or rim, so it never separates from the background |
| Framing | The hand floats mid-right with a gap below it; in the fight shot a teepee clips through the camera | The arm doesn't come from the shoulder, and the camera has no near-geometry check |
| World | Cone-stack trees, one-colour teepee, a bone arch made of tubes | Low density, no props at human scale, nothing reads up close |
| What it got right | A campfire with warm bloom against blue snow, glowing eyes in the treeline, snowfall | Mood and colour story are good; the problem is the objects |

Source of the hands: `src/game/weapons.js` built its own arm from `SphereGeometry`, `CapsuleGeometry` and `CylinderGeometry` because the starter shipped weapons with no hands at all.

## 3. The previous starter (`starters/fps-three` before this audit)

**Grade B-.** Solid engine (physics, input with drag fallback, enemies, round, audio, tools) but a thin slice of its source for looks:
- Weapons were 3 to 5 boxes and cylinders each, with **no hands**.
- Materials were flat colours or 256-pixel canvas noise.
- Render was bloom plus a vignette grade; one shadow map; no ambient occlusion, no light shafts, no split-tone grade.

## 4. mshumer/Claude-of-Duty (MIT, commit d9b237b)

`audit/cod-weapon.jpg`, `cod-hero.jpg`, `cod-sunset.jpg`, `cod-interior.jpg`: captured from a fresh clone built here, on software WebGL at quality high (each frame took about 3 minutes to render). **Grade B+**: the best open-licence agent-written FPS we found, but its own README says critics still picked the real thing every time.

| Its part | In motion | Taken now? |
|---|---|---|
| Viewmodel: gloved hands with jointed fingers, seams, pads, sleeve; two-bone arms welded to grips; sway, stride bob, turn lag, spring recoil, reload/inspect/draw clips, ADS solved from the sight | Best part of the repo. The left hand wraps the handguard; reloads move the magazine through the hand | **Yes, whole** (`kit/viewmodel/`) |
| Weapon models: carbine, compact, sidearm assembled from ~40 part builders (rails, optic, muzzle devices, bolts, magazines) | Real silhouettes, 7-9 draw calls each | **Yes**, renamed generically |
| Procedural material library: 19 surfaces baked on the GPU at boot (concrete, brick, plaster, asphalt, sand, dirt, gravel, rusted/painted/brushed metal, corrugated, wood, fabric, burlap, foliage, rubber, glass), triplanar, parallax, edge wear and cavity grime from vertex masks | Surfaces read as material, not colour | **Yes, whole** (`kit/materials/`) |
| Render: cascaded shadows, GTAO, TAA, motion blur, Karis bloom, EV100 exposure, AgX, procedural LUT | Strong, but costs seconds per frame on software WebGL and is coupled to its sky and world | **Partly**: ambient occlusion (three's GTAO pass), sun shafts, AgX option and a split-tone grade, written into `kit/render/render.js` |
| Sky: atmospheric scattering, clouds, volumetrics | Good | Not yet: the next lane's best upgrade |
| World kit: modular buildings with real wall thickness, hundreds of instanced props | Dense urban street | Not yet: urban games should take it |
| AI: skinned soldiers, navmesh, cover, ragdolls | Mannequin-like at distance | No: our enemy kit is lighter and genre-neutral |
| Tools: capture, baseline, imagediff, profile, playtest | Exactly what a one-shot needs | Already taken in v1 |

## 5. Our starter after the rebuild

What changed in `starters/fps-three`, and the caveman re-run on it, are in `HANDOFF.md`; `audit/side-by-side.png` puts the old caveman, the new one and the bar in one image.

## 6. The gallery: 90 games graded, 23 kept

Every entry got a screenshot; the kept ones are committed as `audit/gallery/NN-*.jpg`, and the removed ones stay out of the repo, since many show other companies' characters. How we saw them: 22 live in Playwright's Chromium on software WebGL, 60 from the post's video thumbnail (all 31 Claude-artifact links stop at the same bot check, and many heavy WebGL pages draw nothing without a GPU), 8 dead. Seven have no image at all. **Result: A 3, B 18, C 69.** The 67 removed rows are listed with reasons below; `gallery/games.json` now carries the grade, genre, best part and what to take for each kept game.

**A: at the bar**

| Game | Shot | Best part | Take |
|---|---|---|---|
| Saltline (the bar) | `gallery/02-saltline.jpg` | Photoreal container port at golden hour | Everything; section 1 |
| What the Water Keeps | `gallery/06-what-the-water-keeps.jpg` | Painterly golden-hour boat ride: backlit pier, mist, light shafts on water | Low sun and haze; one slow verb through a sequence of dream worlds |
| Turbo Tails kart racer | `gallery/51-turbo-tails-kart-racer.jpg` | Sunlit island track with lava, balloons, sailboats; reads like a console kart game | The fly-over opening and holiday-island palette: the look target for `racing` |

**B: one part worth taking** (the most useful ten)

| Game | Best part | Take | Code |
|---|---|---|---|
| Riposte (48) | The most complete open browser FPS here: classes, attachments, mobile | Weapon handling and mobile controls to read | MIT (code only; name, logo, music, soldier animations and some sounds excluded) |
| Moss (69) | About 590,000 leaves grown in code | The foliage technique, for survival and nature scenes | MIT |
| Bottle Studio (38) | Studio-lit glass with see-through liquid and bokeh in one file | Glass and studio lighting | MIT |
| Tidebreaker (13) | One storm-lit giant as the whole level | Set-piece creature as level; cold rain palette with warm accents | none |
| Boring Forest (73) | Water glints, forest light shafts, fireflies | Skipping stones as the whole hook | none |
| I Would Have Gotten Away With It (25) | You are the culprit in an inked night manor | Reversed-premise design | none |
| WONTFIX (17) | Your own work tickets become horror audio logs | Personal-input premise | MIT (voices need a paid API) |
| Skyhold (28) | An island that tilts under what you build | Physics-as-rule, one daily island for everyone | none |
| Five-style world (10) | One terrain, five render styles on keys 1-5 | Flip looks before polishing | none |
| Pallet Panic (85) | A warehouse you wreck with a forklift | Physics destruction as the toy | none |

**C: removed** (67): dead links 0, 1, 12, 16, 24, 30, 60, 86; clones of a named game or its look 4, 7, 9, 11, 18, 27, 35, 37, 43, 47, 53, 56, 63, 76, 77, 84; a repost of the bar 72; not a game or trivial 3, 5, 8, 14, 15, 19, 20, 21, 31, 32, 33, 34, 36, 39, 41, 42, 45, 49, 50, 55, 57, 58, 59, 62, 64, 65, 66, 67, 68, 70, 75, 78, 79, 80, 81, 82, 83, 87; unseen 40, 44, 52, 61. Entries 88 and 89 (same author as the bar, never seen: their post shows only the bar's video) stay, marked `unseen`, to check by hand.

Genres across the 90: other 45, racing 8, puzzle 7, FPS 6, flight 4, platformer 4, top-down shooter 4, sandbox/voxel 4, strategy 3, horror 2, runner 1, survival 1, rhythm 1. None for sailing or sports.

## 7. Prompt recipes: 22 graded, 10 kept

| Grade | Recipes |
|---|---|
| A | 01 one-sentence FPS (it made the bar) |
| B | 02 systems feed each other (keep the loop, drop the crime-series setting); 04 delivery clause ("no text inside the scene"); 05 boss in one line; 07 night train (arena seed); 10 rig your own character; 11 numbered steps; 13 check with no fixes; 14 originality review; originals `caveman-fps.md` and `concepts.md` (two concept lines sit too close to Skyhold and Tidebreaker; rewrite before use) |
| C | 03 pelican benchmark (not a game); 06 survivors (an advert); 08 jelly (source deleted); 09 sailing ship (a scene); 12 winter driving (not a one-shot); 15, 16, 18, 19, 20, 21, 22 (archival, named-game clones). 17 keeps one line: the follow-up "eh looks basic, make it hdr" |

`prompts/README.md` now indexes only A and B. The C files still sit in `prompts/recipes/` because deleting files needs a person's approval this lane did not have; the exact command is in `HANDOFF.md`.

## 8. The two studio repos

**Donchitos/Claude-Code-Game-Studios** (MIT, commit abc0de7). **Grade B** for knowledge, **C** for its agents here.
- Skip all 49 agents: each opens by asking clarifying questions and "May I write this to [filepath]?" before every write, which breaks this repo's decide-don't-ask rule. The art and QA roles are job descriptions; `qa-tester.md` is mostly Godot, Unity and Unreal test templates. Our `visual-critic` and `originality-checker` already judge more sharply.
- Worth taking: the 69 genre sheets in `.claude/genres/chipsets/` with `sources.md` (camera, default rules with "why" and "break it when", feel rules, a "never in a one-shot" list); `.claude/genres/art-direction.md` (one-page art-direction form); `.claude/engines/web/scaffold/src/hook.ts` (a deterministic test hook: `press`, `hold`, `step(n)`, injectable clock); `one-shot-2c-self-check.md` (every look word the person used mapped to the shot that shows it); `rules/skill-authoring.md` ("a check that cannot report that it did not run is not a check"). The genre builder lanes read the sheets for their genres; vendoring them whole is the next lane's job.

**gamedev-skills/awesome-gamedev-agent-skills** (Apache-2.0, commit dcf3bbb). **Grade B.** Five skills already in `third_party/skills/`. Next to add: `disciplines/camera-systems`, `game-ai`, `procedural-gen`, `input-systems` (high); `physics-tuning`, `ai-behavior-trees-utility-ai`, `shader-programming`, `performance-optimization`, `game-ui-ux` and the matching `genres/*` (medium). Skip save systems (artifacts have no storage), Phaser 4 skills unless a starter needs them, and every non-browser engine.

## 9. Genres we can support, and their sources

64 open-licence candidates across 22 genre slots; 56 ran in Playwright's Chromium on software WebGL; screenshots in `audit/genres/<genre>--<repo>.jpg`. Licences read from each LICENSE file, commits pinned. **21 slots have a usable base**, against a floor of 6.

| Genre | Base (licence, commit) | Grade | Shot | Runner-up |
|---|---|---|---|---|
| First-person shooter | this repo's `starters/fps-three` on mshumer/Claude-of-Duty (MIT, d9b237b) | B+ | `audit/cod-weapon.jpg` | Mugen87/dive (MIT, 7176136) for bot AI |
| Top-down / twin-stick shooter | xMPon/undead-protocol (MIT, 145db1e) | B | `genres/shooter-thirdperson--undead-protocol.jpg` | phoboslab/underrun (MIT, f933e29) for lights in darkness |
| Third-person shooter | undead-protocol + a follow camera (simondevyoutube ThirdPersonCamera, MIT) | B | same | |
| Survival / survivors-like | VictorZakharov/void-harvest-game (MIT, 8d9109d) | B | | undead-protocol |
| Tower defense | djpav/threejs-tower-defense (MIT, dcb33e1) | B | | victorqribeiro/towerDefense (MIT) level generator |
| Racing / kart | bridge-mind/turbo-kart-rush (MIT, 6c0456c), 892 KB built | A | `genres/racing--turbo-kart-rush.jpg` | bridge-mind/turbo-kart-rally (MIT, c52aca3), A |
| Flight | arjunemirchandani/skyward-flight-simulator (MIT, 5fde882) | A | `genres/flight--skyward-flight-simulator.jpg` | none licensed |
| Space, on rails | bop-del/meridian-line (MIT, bf4dc45) | A | `genres/space--meridian-line.jpg` | none |
| Sailing | three.js r180 ocean example (MIT) + viachm/windsurf-simulator (MIT, 770eb3b) | B | `genres/sailing--three-webgl_shaders_ocean.jpg` | hammadshakeelai/Boat-Chase (MIT) |
| Endless runner | omsingh02/bunny (MIT, 7d7ba83) | B | `genres/runner--bunny.jpg` | |
| Platformer 2D | KilledByAPixel/LittleJS `examples/platformer` (MIT, 9712ac4) | B | `genres/platformer-2d--LittleJS-platformer.jpg` | ourcade Phaser 3 template (code only) |
| Puzzle, match-3 | LittleJS `examples/puzzle` (MIT, 9712ac4) | B | `genres/puzzle--LittleJS-puzzle.jpg` | gabrielecirulli/2048 (MIT), structure only |
| Arcade, breakout | LittleJS `examples/breakout` (MIT, 9712ac4) | B | `genres/arcade-breakout--LittleJS-breakout.jpg` | |
| Shoot-'em-up | selenebun/bullethell (MIT game code, 75173f8), ported off p5.js (LGPL) | B | `genres/arcade-shmup--bullethell.jpg` | |
| Top-down action-adventure | devshareacademy/phaser-zelda-like-tutorial (MIT code, 63b62db) | B | | art licence unconfirmed: code only |
| Roguelike | nluqo/broughlike-tutorial stage 8 (MIT, b91218d) | B | `genres/roguelike--broughlike-tutorial.jpg` | ondras/rot.js (BSD-3) |
| Strategy / RTS | alandaitch/imperios-1800-2100 (MIT, 30e7ff7) | A (look) | `genres/strategy-rts--imperios-1800-2100.jpg` | needs three 0.185 for its foliage |
| Rhythm | ctbot000/rhythm-game (MIT, 1a42d2e), audio made in code | B | `genres/rhythm--ctbot-rhythm-game.jpg` | |
| Card | emollick/flipside (MIT, 763b210) | A | `genres/card--flipside--run.jpg` | Subterfugus/duskspire (MIT) |
| Sports, car-soccer | pemmyz/js_carballgame (MIT, 8043dcc) | weak B | `genres/sports--js_carballgame.jpg` | |
| Sandbox / voxel | three.js r180 voxel example (MIT) | B | `genres/sandbox--three-webgl_geometry_minecraft.jpg` | bridge-mind/voxelcraft, systems only |

**No usable open-licence base:** 3D platformer (build from fps-three with a third-person camera), asteroids (assemble on LittleJS), free-flight space dogfight, any sport beyond car-soccer. Rejected on licence: HueJumper2k (GPL-3.0), TheAviator (no licence). pmndrs/racing-game is MIT but 34 MB of React.

**Traps found behind MIT code**, so every starter takes code and never names or art: the kart drivers copy a famous kart franchise's characters; undead-protocol's HUD imitates a famous zombie mode; flipside's scoring echoes a commercial deckbuilder; voxelcraft copies a famous block game's UI; the gauntlet and racer sprites are arcade rips; one rhythm game ships a film soundtrack.

**What the starters are built on:** two engines cover almost every genre. three.js 0.180 (already in the repo) runs 14 of the bases unchanged; LittleJS (MIT, one 515 KB file with WebGL 2D, physics, particles, ZzFX sound and a post pass) covers the 2D genres. Phaser is needed only for the zelda-like.

Which of these became tested starters, with their playtest results, is in `HANDOFF.md`.
