---
name: make-it-look-great
description: Raise a working browser game from programmer art to something people stop scrolling for. Use after a game plays correctly, when a game looks flat or empty, or when someone says it looks basic.
---

# Make it look great

The game has one second to earn the next ten. Every top game post in the research led with gameplay video, so the first frame is the thumbnail and the argument. When a viewer's first reaction is "wait, that's made with code?", the post carries itself.

One sharp second prompt from the wild: "eh looks basic, make it hdr". Be that harsh with your own work.

## The bar

`references/audit/felix-*.jpg` are frames from the best one-shot browser FPS we know of; `references/AUDIT.md` lists what makes it read as AAA. Put your capture next to `felix-06-hands.jpg` and `felix-11-dock.jpg` and be honest about the gap. In that game: the held weapon has hundreds of parts and real specular, the hands grip it, light has a direction and shafts, fog separates distance, nothing on screen is a bare primitive, and the grade is cool in the shadows and warm in the highlights.

## The pass, in this order

Capture first, then work from what you see: `npm run capture -- --game=games/<slug>`. Open every PNG.

### 0. The held weapon and hands (`weapons.js`)

The most-looked-at object in the game. It must use the kit's hands (`model:`), have a real silhouette and use library materials. Capture `held` and look at it alone: knuckles, bindings and wear should be readable. See "Held weapons" in `skills/build-from-pieces`.

### 1. Light (`look.js`)

- **One strong direction.** A low sun gives long shadows and warm rim light; a single torch in the dark gives fear. Avoid noon.
- **Two temperatures.** Warm key, cool fill, or the reverse. Set the hemisphere light to the opposite colour from the sun.
- **Exposure and tone.** Bright things should roll off, not clip. If the picture is grey, lower the fill before adding contrast.
- **Something that glows.** One emissive accent per area, and let bloom catch it. Set emissive above 1 so the bloom threshold reads it.
- **Shafts and contact shadow.** `render.setLook({ sunDir, shafts: { strength, color, threshold }, ao: { radius, intensity } })`. Shafts need a bright light source with dark shapes in front of it (trees, pillars, a doorway); place some. AO runs at quality high.
- **Grade like film.** `setLook({ tone: 'agx' | 'aces', contrast: 1.05-1.15, shadows: '#c8d2ff', highlights: '#fff0dc', saturation })`: cool shadows, warm highlights, then reverse it if the scene is cold.
- **Light the hands** to match: `ctx.get('weapons').viewLights.set({...})`.

### 2. Air

- **Fog is depth.** Match the fog colour to the horizon, then raise density until distant shapes turn into silhouettes.
- **Motes.** Dust, embers, snow, spores: `motes()`. Without them still air looks like a render.
- **Sky is half the frame.** Horizon glow, a sun or moon you can see, a colour that is a decision.

### 3. Surfaces

- **Start from the material library:** `ctx.get('materials').get(name, { tint, scale, uvMode: 'triplanar' })` with `name` from `kit/materials/library.js` (concrete, brick, plaster, tile, asphalt, sand, dirt, gravel, metal_rust, metal_painted, metal_brushed, corrugated, wood, fabric, burlap, foliage, rubber, glass). These carry normal, roughness, edge wear and grime. For something the library lacks, `surface()` with a palette of two to four close colours. Keep normals gentle: strong normal maps read as noise.
- **Density at human scale.** The bar has a prop every couple of metres: crates, cables, posts, bins, signs, stones, bones, bundles. Build three to five reusable props and `scatter` them.
- Break up flat ground with vertex colour variation and scattered small props.
- Make silhouettes readable against the sky: tall shapes on the horizon, a clear skyline.

### 3b. Downloaded assets (Patch's free library)

Real scanned rocks, logs, trees and skies beat coded primitives for density. Search `https://patch.gg/api/v1/assets/search?q=<need>&type=model|material|hdri`, then read `/assets/<id>` for `license`, `credit` and `variants[].files[]`. Take only CC0 or CC BY, and never run Patch's installer. What the first games here learned:
- **No meshopt or Draco.** The artifact page blocks WebAssembly, so those decoders fail. Pick plain GLBs, or repack (`games/caveman/scripts/decode-meshopt.mjs`); quantized meshes load fine.
- **Mind the triangles.** One scanned boulder can be 66,000 triangles. Software WebGL and weak laptops stall at around 500,000 in view. Use few hero scans near the camera, instanced copies further out, and fewer at `q=low`.
- **Never collide against scanned meshes.** Give each prop a cheap invisible box or capsule for collision; boot hangs otherwise.
- **Scale by the bounding box.** Measure it after loading and scale by the axis you mean (a log scaled by its height came out 73 m long).
- **Textures at 512 to 1K** and an HDRI at 1K or less, for light and reflections; a visible sky usually looks better painted in code.
- **Credit every asset:** a row in `third_party/NOTICES.md`, the game's README, and a credits line on the title screen for CC BY.

### 4. Feel at the moment of action

This is where a game feels expensive. Change these and watch the video, not the numbers.

- **Firing:** muzzle flash, a light pulse on nearby surfaces, recoil, a tracer, a layered sound.
- **Hits:** hit marker, burst of particles in the enemy's colour, the enemy flashes and staggers, a distinct sound. A headshot should feel different.
- **Kills:** a bigger burst and a fall, never a pop-out. Consider a short slow-down on the last enemy of a wave: `ctx.time.scale`.
- **Being hurt:** red at the edges, direction marker, screen shake, a low thump.
- **Movement:** footsteps, landing dip, sprint widening the field of view.
- **Explosions:** flash, shake scaled by distance, debris, smoke that lingers, ground scorch.

Most of these are already wired. Tune the numbers in your definitions until each action is clear with the sound off, and better with it on.

### 5. The first second

- The title screen is drawn over the live scene, so point the starting view at the best thing you have.
- Something should be moving in frame one.
- Then the second beat: the camera finds the first enemy, the first thing explodes, the world does something.
- Choose the opening of the video here, not when recording.

### 6. Sound

Generate everything in code. Keep a bed of air under the whole game (`ambient` in `sounds.js`). The main action needs at least three layers: a transient, a body, and a tail. Footsteps change on different ground. Silence before something scary is a tool.

## Keep it fast

- Stay near 150,000 triangles and 200 draw calls. Use `scatter` (instanced) for anything repeated.
- Keep real-time shadows to one light.
- Run `npm run profile`. New shader programs during play mean hitches: `render.prewarm` compiles what exists at load, so create materials before the game starts. As Claude-of-Duty found, a good median can hide 700 ms stalls, so read p99 and the hitch list.
- Stay under the budget in `npm run size`. Three megabytes is comfortable; it has never been the constraint for code-generated art.

## Judge it

Hand the captures to the `visual-critic` agent, with the design's look line. Fix its worst finding first. If it's the same complaint twice, your fix was too timid.

Re-run `npm run playtest` when finished: polish breaks things.
