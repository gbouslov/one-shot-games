import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Loader for the asset library (assets/, see skills/asset-library/SKILL.md).
 * Copied into games/<slug>/src/assets/ by `npm run assets -- add`.
 *
 * Runs under the artifact content policy: no fetch, no blob: or data: URLs
 * loaded through the network stack, no WebAssembly. Bytes come from base64
 * strings; images decode through createImageBitmap(Blob); the light probe
 * inflates through DecompressionStream.
 *
 *   assets.model(id)                       a fresh copy, in metres, shadows on
 *   assets.place(ctx, id, { at, rotY, scale, solid, collider, surface })
 *   assets.material(id, { repeat | size, tint, roughness })
 *   assets.sky(ctx, id, { exposure, env, background, rotate })   -> { sunDir, sunColor, elevation }
 *   assets.held(ctx, itemId, id, { pos, rot, scale })            a model in the first-person hands
 *   assets.credits()                       one line naming every source
 */

function bytesOf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function bitmap(bytes, type, flip = false) {
  return createImageBitmap(new Blob([bytes], { type }), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
    imageOrientation: flip ? 'flipY' : 'from-image',
  });
}

/** GLTFLoader plugin: decode embedded images with createImageBitmap, never a URL. */
class BitmapImages {
  constructor(parser) {
    this.name = 'one_shot_bitmap_images';
    parser.loadImageSource = function loadImageSource(sourceIndex) {
      if (this.sourceCache[sourceIndex] !== undefined) return this.sourceCache[sourceIndex].then((t) => t.clone());
      const def = this.json.images[sourceIndex];
      const promise = this.getDependency('bufferView', def.bufferView)
        .then((view) => bitmap(new Uint8Array(view), def.mimeType))
        .then((img) => {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          tex.userData.mimeType = def.mimeType;
          return tex;
        });
      this.sourceCache[sourceIndex] = promise;
      return promise;
    };
  }
}

const loader = new GLTFLoader().register((parser) => new BitmapImages(parser));

function parseGLB(bytes) {
  return new Promise((resolve, reject) => loader.parse(bytes.buffer, '', resolve, reject));
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function rgbeToHalf(rgbe, w, h) {
  const out = new Uint16Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const e = rgbe[i * 4 + 3];
    const f = e ? Math.pow(2, e - 136) : 0;
    out[i * 4] = THREE.DataUtils.toHalfFloat(rgbe[i * 4] * f);
    out[i * 4 + 1] = THREE.DataUtils.toHalfFloat(rgbe[i * 4 + 1] * f);
    out[i * 4 + 2] = THREE.DataUtils.toHalfFloat(rgbe[i * 4 + 2] * f);
    out[i * 4 + 3] = 0x3c00;
  }
  return out;
}

function prepare(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      // Thin props (leaves, fences, labels) need both faces and a cutout.
      if (m.alphaTest > 0 || m.transparent) m.side = THREE.DoubleSide;
      if (m.map) m.map.anisotropy = 4;
    }
  });
  return root;
}

/**
 * Every call takes `ctx`: the kit's context in the FPS starter, or a plain
 * { scene, renderer, physics? } in any other three.js game.
 */
function norm(ctx) {
  if (typeof ctx.get === 'function') return ctx;
  return {
    scene: ctx.scene,
    viewScene: ctx.viewScene ?? null,
    get: (k) => (k === 'render' ? { renderer: ctx.renderer } : k === 'physics' ? ctx.physics ?? null : null),
  };
}

export async function createLibrary(catalog) {
  const decoded = new Map();
  await Promise.all(
    Object.entries(catalog).map(async ([id, a]) => {
      if (a.kind === 'model' || a.kind === 'material') {
        const gltf = await parseGLB(bytesOf(a.data));
        gltf.scene.animations = gltf.animations; // clips that ship inside the model; copies keep them
        decoded.set(id, prepare(gltf.scene));
      } else if (a.kind === 'sky') {
        const [img, env] = await Promise.all([bitmap(bytesOf(a.data), 'image/webp', true), inflate(bytesOf(a.env))]);
        decoded.set(id, { img, env });
      } else if (a.kind === 'audio') {
        const b = bytesOf(a.data);
        const off = new OfflineAudioContext(1, 1, 44100);
        decoded.set(id, await off.decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
      } else if (a.kind === 'flipbook') {
        const tex = new THREE.Texture(await bitmap(bytesOf(a.data), 'image/webp', true));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        decoded.set(id, tex);
      } else if (a.kind === 'anims') {
        const json = JSON.parse(new TextDecoder().decode(await inflate(bytesOf(a.data))));
        decoded.set(id, new Map(json.clips.map((c) => [c.name, THREE.AnimationClip.parse(c)])));
      }
    }),
  );

  const need = (id, kind) => {
    const a = catalog[id];
    if (!a) throw new Error(`asset "${id}" is not in this game. Run: npm run assets -- add ${id} --game=games/<slug>`);
    if (kind && a.kind !== kind) throw new Error(`asset "${id}" is a ${a.kind}, not a ${kind}`);
    return a;
  };

  const lib = {
    catalog,

    /**
     * A fresh copy of a model. Geometry, materials and textures are shared.
     * Many scans ship variants side by side (clean and rusted, open and closed):
     * keep / drop take a substring or RegExp matched against the part names in
     * assets.parts(id), and the kept parts are re-centred on x and z.
     */
    model(id, { keep = null, drop = null, centre = true } = {}) {
      need(id, 'model');
      const src = decoded.get(id);
      // Rigged models need their skeleton rebound to the copy's own bones.
      let skinned = false;
      src.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
      const copy = skinned ? cloneSkinned(src) : src.clone(true);
      copy.name = id;
      copy.traverse((o) => {
        if (o.isMesh) o.userData.libraryMesh = true;
      });
      if (keep || drop) {
        const hit = (name, p) => (p instanceof RegExp ? p.test(name) : name.includes(p));
        for (const c of [...copy.children]) if ((keep && !hit(c.name, keep)) || (drop && hit(c.name, drop))) copy.remove(c);
        if (centre) {
          const c = new THREE.Box3().setFromObject(copy).getCenter(new THREE.Vector3());
          for (const ch of copy.children) {
            ch.position.x -= c.x;
            ch.position.z -= c.z;
          }
        }
      }
      return copy;
    },

    /**
     * A decoded sound or music track (kind 'audio'), as an AudioBuffer. Play it from a voice in
     * src/game/sounds.js so the recorder hears it too:
     *   const s = actx.createBufferSource(); s.buffer = assets.sound('spacial-winds'); s.loop = true;
     *   s.connect(g); s.start(t0);
     */
    sound(id) {
      need(id, 'audio');
      return decoded.get(id);
    },

    /**
     * A camera-facing animated sprite from a flipbook sheet (fire, smoke, explosions).
     *   const f = assets.flipbook('fire-flame', { size: 1.6 }); f.object.position.set(x, 0.8, z); scene.add(f.object);
     *   f.update(dt) every frame (or share one clock: all sprites of a sheet can be updated together)
     * size: height in metres (width follows one frame's aspect). fps: playback speed. loop: false plays once
     * then hides. phase: start frame, so a row of fires doesn't flicker in step. color/intensity tint it;
     * opacity fades an alpha sheet. upright: true keeps it vertical (flames), false faces the camera fully (puffs).
     */
    flipbook(id, { size = 1, fps, loop = true, phase = Math.random(), color = '#ffffff', intensity = 1, opacity = 1, upright = true } = {}) {
      const a = need(id, 'flipbook');
      const tex = decoded.get(id);
      const additive = a.blend === 'additive';
      const aspect = (a.px[0] / a.cols) / (a.px[1] / a.rows);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          map: { value: tex }, grid: { value: new THREE.Vector2(a.cols, a.rows) }, frame: { value: 0 },
          frames: { value: a.frames }, tint: { value: new THREE.Color(color).multiplyScalar(intensity) }, opacity: { value: opacity },
          upright: { value: upright ? 1 : 0 },
        },
        vertexShader: `uniform float upright; varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 s = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
            vec4 c = viewMatrix * vec4(modelMatrix[3].xyz, 1.0);
            vec3 up = mix(vec3(0.0, 1.0, 0.0), (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, upright);
            vec3 right = normalize(cross(up, vec3(0.0, 0.0, 1.0)));
            if (upright < 0.5) right = vec3(1.0, 0.0, 0.0);
            c.xyz += right * position.x * s.x + up * position.y * s.y;
            gl_Position = projectionMatrix * c;
          }`,
        fragmentShader: `uniform sampler2D map; uniform vec2 grid; uniform float frame; uniform float frames; uniform vec3 tint; uniform float opacity; varying vec2 vUv;
          vec4 cell(float f) {
            f = mod(f, frames);
            vec2 rc = vec2(mod(f, grid.x), grid.y - 1.0 - floor(f / grid.x));
            return texture2D(map, (rc + vUv) / grid);
          }
          void main() {
            float f = floor(frame);
            vec4 c = mix(cell(f), cell(f + 1.0), frame - f);
            ${additive ? 'gl_FragColor = vec4(c.rgb * tint * opacity, 1.0);' : 'gl_FragColor = vec4(c.rgb * tint, c.a * opacity);'}
            #include <colorspace_fragment>
          }`,
      });
      const object = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1).translate(0, 0.5, 0), mat);
      object.scale.setScalar(size);
      object.frustumCulled = false;
      object.renderOrder = additive ? 12 : 11;
      const rate = fps ?? a.fps;
      let t = phase * a.frames;
      const update = (dt) => {
        t += dt * rate;
        if (!loop && t >= a.frames - 1) { object.visible = false; return; }
        mat.uniforms.frame.value = loop ? t % a.frames : Math.min(t, a.frames - 1.001);
      };
      update(0);
      return { object, material: mat, update, restart: () => { t = 0; object.visible = true; } };
    },

    /**
     * A rigged character that plays retargeted clips (kind 'anims', packed onto this model),
     * or, with no `anims`, the clips the model itself ships with (see the catalogue's `clips`).
     *   const c = assets.character('human-0278', { anims: 'anims-human-0278' });
     *   scene.add(c.object); c.play('Walk_Loop'); ... c.update(dt) every frame
     * play(name, { fade = 0.2, loop = true, speed = 1 }) cross-fades from the current clip;
     * a one-shot (loop: false) holds its last frame. c.clips lists the names.
     */
    character(id, { anims, ...opts } = {}) {
      const object = lib.model(id, opts);
      // clips packed onto this body (kind 'anims'), else the ones the model ships with
      const clips = anims ? decoded.get(need(anims, 'anims') && anims) : new Map((object.animations ?? []).map((c) => [c.name, c]));
      const mixer = new THREE.AnimationMixer(object);
      const actions = new Map();
      let current = null;
      const play = (name, { fade = 0.2, loop = true, speed = 1 } = {}) => {
        const clip = clips.get(name);
        if (!clip) throw new Error(`no clip "${name}" in ${anims}: ${[...clips.keys()].join(', ')}`);
        let act = actions.get(name);
        if (!act) actions.set(name, (act = mixer.clipAction(clip)));
        act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        act.clampWhenFinished = !loop;
        act.timeScale = speed;
        if (current === act) return act;
        act.reset().setEffectiveWeight(1).play();
        if (current) current.crossFadeTo(act, fade, false);
        current = act;
        return act;
      };
      return { object, mixer, play, actions, clips: [...clips.keys()], update: (dt) => mixer.update(dt), get current() { return current; } };
    },

    /**
     * Call once after placing everything: every library mesh that appears two or
     * more times in the scene becomes one InstancedMesh (one draw call per part,
     * not per copy). Colliders are untouched. Returns { before, after } mesh counts.
     */
    instance(ctx, { min = 2 } = {}) {
      ctx = norm(ctx);
      const groups = new Map();
      let before = 0;
      ctx.scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.userData.libraryMesh) return;
        before++;
        const k = `${o.geometry.uuid}|${o.material.uuid}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(o);
      });
      let after = before;
      for (const list of groups.values()) {
        if (list.length < min) continue;
        const first = list[0];
        const im = new THREE.InstancedMesh(first.geometry, first.material, list.length);
        list.forEach((o, i) => {
          o.updateWorldMatrix(true, false);
          im.setMatrixAt(i, o.matrixWorld);
          o.parent.remove(o);
        });
        im.castShadow = first.castShadow;
        im.receiveShadow = first.receiveShadow;
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.name = `${first.name}-x${list.length}`;
        ctx.scene.add(im);
        after -= list.length - 1;
      }
      return { before, after };
    },

    /** Names of a model's top-level parts, for keep / drop. */
    parts(id) {
      need(id, 'model');
      return decoded.get(id).children.map((c) => c.name);
    },

    /** Size in metres [x, y, z] as packed. */
    size(id) {
      return need(id).size_m;
    },

    /**
     * Put a model in the level. `at` is [x, y, z], or [x, z] to sit it on the ground
     * (ground lookups rebuild the physics tree, so pass y on flat levels).
     * collider: 'box' (default, its bounds), 'mesh' (exact, costly) or 'none'.
     */
    place(ctx, id, { at = [0, 0, 0], rotY = 0, rot = null, scale = 1, solid = true, collider = 'box', surface = 'metal', parent = null, keep = null, drop = null, sit = true, shadow = 'auto' } = {}) {
      ctx = norm(ctx);
      const physics = ctx.get('physics');
      const obj = lib.model(id, { keep, drop });
      let [x, y, z] = at.length === 2 ? [at[0], null, at[1]] : at;
      if (y === null) y = physics?.groundHeight(x, z) ?? 0;
      obj.position.set(x, y, z);
      if (rot) obj.rotation.set(rot[0], rot[1], rot[2]);
      else obj.rotation.y = rotY;
      obj.scale.setScalar(scale);
      (parent ?? ctx.scene).add(obj);
      obj.updateWorldMatrix(true, true);
      // Sit the lowest point on y, so rotated props (a tyre on its side) don't sink.
      const bounds = new THREE.Box3().setFromObject(obj, true);
      if (sit) {
        obj.position.y += y - bounds.min.y;
        obj.updateWorldMatrix(true, true);
      }
      // Small things don't cast sun shadows (ambient occlusion grounds them); it
      // halves the shadow pass in a dense scene. shadow: true forces it on.
      const big = Math.max(...bounds.getSize(new THREE.Vector3()).toArray()) > 0.6;
      if (shadow !== true && !(shadow === 'auto' && big)) obj.traverse((o) => { o.castShadow = false; });
      if (solid && collider !== 'none' && physics) {
        if (collider === 'mesh') physics.addStatic(obj, surface);
        else {
          const box = new THREE.Box3().setFromObject(obj, true);
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()));
          box.getCenter(proxy.position);
          physics.addStatic(proxy, surface);
          obj.userData.collider = proxy;
        }
      }
      return obj;
    },

    /**
     * A scanned PBR material. `size` is the surface's size in metres [u, v] and sets
     * the repeat from the scan's real tile size; or pass `repeat` directly.
     */
    material(id, { repeat = null, size = null, tint = null, roughness = null, normalScale = 1 } = {}) {
      const a = need(id, 'material');
      let src = null;
      decoded.get(id).traverse((o) => { if (o.isMesh) src = o.material; });
      const m = src.clone();
      const rep = repeat ?? (size ? [size[0] / a.tile_m[0], size[1] / a.tile_m[1]] : [1, 1]);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
        if (!m[k]) continue;
        m[k] = m[k].clone();
        m[k].wrapS = m[k].wrapT = THREE.RepeatWrapping;
        m[k].repeat.set(rep[0], rep[1]);
        m[k].anisotropy = 8;
        m[k].needsUpdate = true;
      }
      // An AO map reads uv1 in three; the quads and level geometry have one uv set.
      if (m.aoMap) m.aoMap.channel = 0;
      if (tint) m.color.set(tint);
      if (roughness !== null) m.roughness = roughness;
      m.normalScale.setScalar(normalScale);
      return m;
    },

    /**
     * Sky and light from a scanned HDRI. Sets the background and the reflection /
     * ambient probe on the world and on the first-person scene, and returns the sun
     * so the game aims its DirectionalLight and light shafts at the same place.
     */
    sky(ctx, id, { exposure = 1, env = 1, background = true, rotate = 0 } = {}) {
      ctx = norm(ctx);
      const a = need(id, 'sky');
      const { img, env: rgbe } = decoded.get(id);
      const renderer = ctx.get('render').renderer;
      const [w, h] = a.env_size;
      const probe = new THREE.DataTexture(rgbeToHalf(rgbe, w, h), w, h, THREE.RGBAFormat, THREE.HalfFloatType);
      probe.mapping = THREE.EquirectangularReflectionMapping;
      probe.magFilter = probe.minFilter = THREE.LinearFilter;
      probe.needsUpdate = true;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromEquirectangular(probe).texture;
      pmrem.dispose();
      probe.dispose();
      for (const scene of [ctx.scene, ctx.viewScene].filter(Boolean)) {
        scene.environment = envMap;
        scene.environmentIntensity = env;
        scene.environmentRotation.y = rotate;
      }
      if (background) {
        const bg = new THREE.Texture(img);
        bg.mapping = THREE.EquirectangularReflectionMapping;
        bg.colorSpace = THREE.SRGBColorSpace;
        bg.flipY = false;
        bg.needsUpdate = true;
        ctx.scene.background = bg;
        ctx.scene.backgroundIntensity = exposure / a.bg_scale;
        ctx.scene.backgroundRotation.y = rotate;
      }
      const d = new THREE.Vector3(...a.sun.dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotate);
      return { sunDir: d.toArray(), sunColor: a.sun.color, elevation: a.sun.elevation_deg };
    },

    /**
     * Hold a model in the first-person hands. `itemId` is the id given to heldItem()
     * in weapons.js (its body can be an empty Assembly); call after the engine has
     * started, e.g. from buildWorld. pos/rot place the model in item space: origin at
     * the right hand's thumb web, -Z away from the player, metres.
     */
    held(ctx, itemId, id, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, keep = null, drop = null, albedo = 0.4, env = 0.5 } = {}) {
      ctx = norm(ctx);
      const root = ctx.viewScene ?? ctx.scene;
      const group = root.getObjectByName(`weapon-${itemId}`);
      if (!group) throw new Error(`no held item "${itemId}" in the viewmodel; is it in weapons.js?`);
      const obj = lib.model(id, { keep, drop, centre: false });
      obj.position.set(...pos);
      obj.rotation.set(...rot);
      obj.scale.setScalar(scale);
      // The kit's first-person lamps run about 4x hotter than the world (they are
      // calibrated for its dark procedural guns and gloves), so a scan with
      // measured albedo is toned down here to sit in the same light as the hands.
      const seen = new Map();
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (!seen.has(o.material)) {
          const m = o.material.clone();
          m.color.multiplyScalar(albedo);
          m.envMapIntensity = env;
          seen.set(o.material, m);
        }
        o.material = seen.get(o.material);
      });
      group.add(obj);
      return obj;
    },

    /** "Assets: Poly Haven (CC0); ..." for the title or end screen. */
    credits() {
      const by = new Map();
      for (const a of Object.values(catalog)) {
        const from = a.upstream ?? a.source;
        const key = a.licence === 'CC0' ? `${from} (CC0)` : `${a.name} by ${a.authors.join(', ')} (${from}, ${a.licence.replace(/-4\.0$/, ' 4.0').replace('CC-BY', 'CC BY')})`;
        by.set(a.credit ?? key, true);
      }
      const name = { polyhaven: 'Poly Haven', ambientcg: 'ambientCG', kenney: 'Kenney', quaternius: 'Quaternius', khronos: 'Khronos glTF samples' };
      return 'Assets: ' + [...by.keys()].map((k) => k.replace(/^(\w+) \(CC0\)$/, (_, s) => `${name[s] ?? s} (CC0)`)).join('; ');
    },
  };
  return lib;
}
