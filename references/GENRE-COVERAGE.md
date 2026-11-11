# Genre coverage: what each kind of game needs, what the library has, what to pull

Measured 11 Nov 2026 against `assets/catalog.json` (92 assets) and Patch's live search API (58,994 CC0 / CC-BY-4.0 assets, no login). Counts are Patch search totals with AI-made assets hidden; "realistic" counts come from the `realistic` trait on the first 40 hits. Probe script: `npm run assets -- search`, or the raw API at `https://patch.gg/api/v1/assets/search?q=...&type=...&cap=...`.

## The one-line answer

**Props, materials, skies and ground are covered. Animated people and five car bodies are now packed.** Vehicle breadth and sound still have gaps. (Trees are the one static exception: Poly Haven's are 1–4 million triangles, so foliage stays coded.) Five gaps decide which games can reach the Saltline bar:

| # | Gap | What's on Patch today | Fix | Unlocks | State |
|---|---|---|---|---|---|
| 1 | **Realistic characters that move** | 331 realistic rigged humans (MakeHuman/MPFB, CC0) with **0** animation clips. All 129 animated characters are stylised Kenney/KayKit | Quaternius **Universal Animation Library** (CC0, 46 clips in the free tier) retargeted onto the MPFB skeleton at pack time: `tools/anim-retarget.mjs` | Every 3D genre with people: FPS enemies, samurai, third-person action, runner, survival, stealth, fighting | **Done 11 Nov.** `pack anims:` + `assets.character()`; Cold Chain's walkers walk, punch, flinch and die on clips, seen rendered (walk, reach and death read right; no twisted limbs) |
| 2 | **Vehicles** | Patch has no realistic drivable cars; aircraft **0**; helicopters 2 (stylised); spaceships 29 (stylised); boats 132 (mostly Kenney toys). Local library now has **five new car bodies** plus the existing wedge | Khronos CarConcept + no-login Objaverse-clean mirror, CC-BY-4.0; Smithsonian CC0 aircraft remains a future source | Racing, flight, driving, boats | **Car bodies covered 11 Nov:** `car-concept`, `v12-goblin`, `gourami-saloon`, `coupeox`, `offroad-buggy`, all B, under 40k tris each, CPU-rendered. First two have four tested wheel pivots; other three merge wheels by material. Browser rendering/handling and AAA finish remain unproven; aircraft and boats remain open. See `references/CAR-GARAGE.md` and the lit sheet |
| 3 | **Sound and music files** | SFX 659 (all ≤ 5 s, Kenney): footsteps 29, impacts, UI; **gunshots 0, ambience 0**. Music 1,812 (incompetech, CC-BY): horror 94, action 128, Japanese 0 | An audio pack step: ogg/mp3 → base64 → `decodeAudioData(ArrayBuffer)` (no fetch, fits the artifact policy). Keep gunshots procedural (kit `audio/shot.js`) | A real score and real footsteps in every game; horror ambience | **Music done 11 Nov** (`kind: audio`, 2 tracks packed, Cold Chain scored). Footsteps not wired |
| 4 | **Fire, smoke and explosion effects** | Sprites: fire 43, flames 18, smoke 120, explosions 181 (Kenney particle and smoke packs, CC0) | A sprite pack step plus flipbook support in the kit's particles | Burning village, explosions, muzzle smoke, campfires | **Done 11 Nov** with Unity Labs' CC0 Houdini flipbooks (better than Kenney's): `fire-flame`, `fireball`, `smoke-wispy`; Last Firing's brazier uses them |
| 5 | **Period dress and armour** | Armour **0**; robes 6 (MPFB); samurai 2 (stylised Polyfork) | Armour plates built in code and hung on bones (the Cold Chain hard hat already does this: `attach()` in `games/cold-store/src/game/enemies.js`) | Samurai, medieval, fantasy enemies on realistic bodies | Method proven on a hard hat |

## By genre

Library: what's packed in `assets/` now. Patch: what one `pack` command away holds (realistic unless marked). Gap: what blocks the Saltline bar.

| Genre (starter) | Library now | Patch, no login | Gap that blocks the bar |
|---|---|---|---|
| FPS: modern (`fps-three`) | Rigged AK arms, scanned machete, crowbar, pistol; warehouse and industrial props; 2 rigged workers | 328 MPFB humans; SimReady industrial (2,382); Poly Haven props | **Gap 1** (enemies walk by hand-written code today) |
| FPS: samurai / feudal | Nothing period-specific | Antique katana and katana stand (Poly Haven); thatch 8, roof tiles 42, wood planks 141; lanterns 9; bamboo 7; night skies 98; robes 6 | **Gaps 1, 4, 5**; no Japanese buildings (4 hits), so build them in code from the PBR materials |
| Horror | Cold Chain set | Night skies 98; horror music 94 | **Gaps 1, 3** (ambience) |
| Racing (`racing`) | Five new realistic-style car bodies, all B; two with four wheel pivots, plus the existing wedge | Patch cars 0 realistic; tyres (SimReady) | **Gap 2 partly covered:** bodies available; browser/handling check still required |
| Flight (`flight`) | Coded plane | Aircraft 0; rocks 49 | **Gap 2** |
| Space shooter (`space-shooter`) | Fighter models | Spaceships 29 (Polyfork, stylised, CC-BY) | None for a stylised look |
| Runner (`runner`) | Coded courier | 328 MPFB humans | **Gap 1** (Sprint, Jog, Jump, Roll are all in the free tier) |
| Survival / top-down / tower defense | Scans and coded enemies | 129 animated stylised characters, 198 animated stylised animals | None stylised; **gap 1** for realistic |
| Platformer / puzzle (2D) | Coded art | 30,686 sprites (Kenney) | None |
| Third-person action, stealth, fighting (no starter yet) | — | MPFB humans | **Gap 1**; the free tier has Crouch, Punch, Roll, Sword and Hit clips |
| Driving, open world (no starter) | Five new car bodies including saloon and buggy; see `references/CAR-GARAGE.md` | Rocks 49, grass 3 realistic; trees 30 on Poly Haven, but at 1–4 million triangles each they are unusable (`skills/asset-library`) | Vehicle bodies available; physics, wheel splitting for three bodies, plus coded or instanced foliage remain |

## Gap 1 in detail: realistic animated humans

- **Source.** Quaternius, Universal Animation Library, standard tier (cached at `.asset-cache/quaternius-ual/`, gitignored). CC0 per its `License.txt` ("CC0 1.0 Universal ... Public Domain Dedication"). Downloaded from OpenGameArt with no login (14.5 MB zip). The Godot GLB holds 46 clips on a 53-bone Rigify skeleton:
  - **Movement:** Idle, Walk, Walk_Formal, Jog, Sprint, Crouch_Idle, Crouch_Fwd, Jump (start, loop, land), Roll, Swim.
  - **Combat:** Sword_Idle, Sword_Attack, Punch_Jab, Punch_Cross, Pistol (idle, aim up, neutral and down, shoot, reload), Spell.
  - **Reactions:** Hit_Chest, Hit_Head, Death01.
  - **Actions:** Interact, PickUp, Push, Sitting, Driving, Fixing, Dance, Talking.
- **Target.** MPFB humans: 53 bones with game-engine names. The map is one to one (`DEF-upper_arm.L` → `upperarm_l`, and so on).
- **The retargeter.** `tools/anim-retarget.mjs` runs in node with no browser:
  1. It pose-matches the target's A-pose to the source's T-pose by bone direction.
  2. It transfers world-space rotation changes from rest every frame.
  3. It scales hip travel by the hip-height ratio (1.033 for human-0278, 1.006 for human-0440).
- **Checks run 11 Nov:**

| Clip (human-0278) | Bone direction error (mean / max) | Planted toe height | Rest toe height | Thigh swing |
|---|---|---|---|---|
| Walk_Loop | 0.01° / 0.03° | 1.7–3.9 cm | 2.4 cm | −15° to 48° |
| Jog_Fwd_Loop | 0.01° / 0.03° | 3.5–34.6 cm (airborne phase) | 2.4 cm | −40° to 77° |
| Idle_Loop | 0.01° / 0.03° | 1.1–1.3 cm | 2.4 cm | 23° to 26° (bent-knee stance, same as the source) |
| Sword_Attack | 0.01° / 0.03° | −0.4 to 2.8 cm | 2.4 cm | −42° to 47° |
| Death01 | 0.01° / 0.03° | 0 to 48 cm (ends on the floor) | 2.4 cm | 23° to 114° |

The direction error proves the maths is self-consistent. The toe heights prove feet stay on the floor without sinking or floating. **Neither proves it looks right**: twist (forearm roll) is not matched, and nobody has watched it render yet. That is the first check once the Mac memory hold lifts.

- **Size.** 6 clips: 577 KB JSON, **78 KB deflated**. The library already inflates light probes with `DecompressionStream`, so clips can ship the same way. One game needs about 6 to 10 clips.
- **More clips, same method.**
  - Universal Animation Library 2: CC0, 130+ clips, of which the free tier is about 70%.
  - 100STYLE: CC BY 4.0, 100 locomotion styles as BVH; three ships a BVH loader.
  - The CMU mocap database: 2,605 sequences. Its "free for all uses" wording is from secondary sources only, so read mocap.cs.cmu.edu before use.

## Pack list: run when the Mac memory hold lifts (or on the VPS)

In order of games unlocked per minute:

1. **Animation into the library.**
   - Add `kind: anims` to `tools/assets.mjs` (pack = retarget + deflate).
   - Add `assets.character(id, { clips })` to `assets/runtime/library.js` (SkinnedMesh copy + AnimationMixer).
   - Swap Cold Chain's hand-animated workers onto Walk_Loop, Punch_Cross, Hit_Chest and Death01, then capture `enemies` and `enemiesSide` to see it.
2. **Samurai kit.**
   - `pack polyhaven:antique_katana_01`, `ambientcg:ThatchedRoof001A`, `polyhaven:wood_planks_dirt`, `polyhaven:roof_tiles`, two `Lantern` scans, a Poly Haven night sky, Kenney `particle-pack/flame_0*` and `smoke-particles/blackSmoke0*`.
   - 3 MPFB men for ronin bodies, with coded armour plates.
3. **Audio step.** Pack 3 incompetech tracks (horror, action, ambient: CC-BY, credit line) and Kenney `impact-sounds` footsteps (CC0); kit playback through `decodeAudioData`.
4. **Vehicles.** Sketchfab is ruled out (it needs an account). Sources with no login are being searched; results go in `references/CARS.md`.
   - Car-body fill now completed via Khronos and HF mirror: five new bodies, source credits and CPU sheet in `references/CAR-GARAGE.md`. No Sketchfab download/login. Flight and boats still need their own fill; the five bodies alone do not establish AAA game quality.
5. **Second animation source.** UAL 2 free tier, for more combat and locomotion variety.
