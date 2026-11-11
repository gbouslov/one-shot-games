import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../kit/core/rng.js';
import { fbm, glowTexture } from '../kit/textures/textures.js';
import { loadModel, scatter } from '../kit/world/scatter.js';
import outcropUrl from './assets/outcrop/basalt-column-outcrop-f1339d.glb?url';
import boulderUrl from './assets/boulder/basalt-boulder-a1929c.glb?url';

/**
 * The land: a causeway of hexagonal basalt column tops over a sea of fire at
 * dusk, built along the round's track. Ember-lit seams between the lanes,
 * curbs and braziers along the edges, column-faced walls dropping into the
 * lava, outcrops and sea stacks in the lava, a volcano on the horizon, a sky
 * with a low copper sun and ash bands, rising embers in the air, and the dark
 * beacon tower at the far end, which blazes when the run is won.
 *
 * Built once at load and merged per 120 m chunk (one draw call per material
 * per chunk, culled by the camera). Returns { update, flash, sunDir }.
 */
const CHUNK = 120;
const STEP = 2;

// ------------------------------------------------------------------ textures
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Normal map from a height canvas (Sobel, wrapped). */
function normalFrom(hc, strength = 3) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const at = (x, y) => src[((((y + h) % h) * w + ((x + w) % w)) * 4)] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const nx = -dx * strength;
      const ny = dy * strength;
      const l = Math.hypot(nx, ny, 1);
      const k = (y * w + x) * 4;
      img.data[k] = (nx / l) * 127 + 128;
      img.data[k + 1] = (ny / l) * 127 + 128;
      img.data[k + 2] = (1 / l) * 127 + 128;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Hexagonal column tops: colour, height (for the normal map) and glowing grout. Tiles in both axes. */
function hexTextures(rng, P) {
  const W = 512;
  const r = W / 6; // two hex periods across
  const H = Math.round(Math.sqrt(3) * r * 3); // three periods down
  const [cc, g] = canvas(W, H);
  const [hc, hg] = canvas(W, H);
  const [ec, eg] = canvas(W, H);
  g.fillStyle = P.grout;
  g.fillRect(0, 0, W, H);
  hg.fillStyle = '#000';
  hg.fillRect(0, 0, W, H);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, W, H);
  const base = new THREE.Color(P.stone);
  const dark = new THREE.Color(P.stoneDark);
  const warm = new THREE.Color(P.stoneWarm);
  const hex = (ctx, cx, cy, rr) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  const cells = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const cx = i * 1.5 * r;
      const cy = j * Math.sqrt(3) * r * 0.5 * 2 + (i % 2) * Math.sqrt(3) * r * 0.5;
      if (cx >= W || cy >= H) continue;
      cells.push([cx, cy]);
    }
  }
  for (const [cx, cy] of cells) {
    const c = base.clone().lerp(dark, rng.float() * 0.7).lerp(warm, rng.float() * 0.3);
    const glow = rng.float() < 0.22;
    const tilt = rng.float();
    const crack = rng.float() < 0.35;
    for (const ox of [-W, 0, W]) {
      for (const oy of [-H, 0, H]) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < -r || x > W + r || y < -r || y > H + r) continue;
        // stone face with a gentle bevel
        const grad = g.createLinearGradient(x - r, y - r, x + r, y + r);
        grad.addColorStop(0, `#${c.clone().offsetHSL(0, 0, 0.05).getHexString()}`);
        grad.addColorStop(1, `#${c.clone().offsetHSL(0, 0, -0.04).getHexString()}`);
        g.fillStyle = grad;
        hex(g, x, y, r * 0.9);
        g.fill();
        // speckle and wear
        for (let k = 0; k < 40; k++) {
          const a = rng.float() * Math.PI * 2;
          const d = Math.sqrt(rng.float()) * r * 0.8;
          g.fillStyle = rng.float() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,210,0.05)';
          g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + rng.float() * 3, 2 + rng.float() * 3);
        }
        if (crack) {
          g.strokeStyle = 'rgba(0,0,0,0.5)';
          g.lineWidth = 1.5;
          g.beginPath();
          let px = x - r * 0.6;
          let py = y + (tilt - 0.5) * r;
          g.moveTo(px, py);
          for (let k = 0; k < 5; k++) {
            px += r * 0.25;
            py += (rng.float() - 0.5) * r * 0.3;
            g.lineTo(px, py);
          }
          g.stroke();
        }
        // height: domed top, grout low
        const hgrad = hg.createRadialGradient(x, y, 0, x, y, r * 0.92);
        hgrad.addColorStop(0, '#ffffff');
        hgrad.addColorStop(0.75, '#e8e8e8');
        hgrad.addColorStop(1, '#707070');
        hg.fillStyle = hgrad;
        hex(hg, x, y, r * 0.9);
        hg.fill();
        if (glow) {
          eg.strokeStyle = `rgba(255,${90 + Math.floor(rng.float() * 60)},30,${0.35 + rng.float() * 0.4})`;
          eg.lineWidth = 3;
          hex(eg, x, y, r * 0.97);
          eg.stroke();
        }
      }
    }
  }
  return { map: tex(cc, true), normalMap: tex(normalFrom(hc, 2.5), false), emissiveMap: tex(ec, true), aspect: H / W };
}

/** Vertical basalt columns for the causeway's walls. */
function columnTextures(rng, P) {
  const W = 256;
  const H = 256;
  const [cc, g] = canvas(W, H);
  const [hc, hg] = canvas(W, H);
  const base = new THREE.Color(P.stone).multiplyScalar(0.8);
  const dark = new THREE.Color(P.stoneDark);
  let x = 0;
  while (x < W) {
    const w = Math.min(W - x, 14 + Math.floor(rng.float() * 22));
    const c = base.clone().lerp(dark, rng.float() * 0.8);
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, `#${c.clone().offsetHSL(0, 0, -0.06).getHexString()}`);
    grad.addColorStop(0.5, `#${c.clone().offsetHSL(0, 0, 0.04).getHexString()}`);
    grad.addColorStop(1, `#${c.clone().offsetHSL(0, 0, -0.08).getHexString()}`);
    g.fillStyle = grad;
    g.fillRect(x, 0, w, H);
    const hgrad = hg.createLinearGradient(x, 0, x + w, 0);
    hgrad.addColorStop(0, '#202020');
    hgrad.addColorStop(0.5, '#ffffff');
    hgrad.addColorStop(1, '#202020');
    hg.fillStyle = hgrad;
    hg.fillRect(x, 0, w, H);
    // joints across the column
    let y = rng.float() * 60;
    while (y < H) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x, y, w, 2);
      hg.fillStyle = '#000';
      hg.fillRect(x, y, w, 2);
      y += 30 + rng.float() * 70;
    }
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x, 0, 1.5, H);
    x += w;
  }
  return { map: tex(cc, true), normalMap: tex(normalFrom(hc, 2), false) };
}

/** Ash bands for the sky, wrapped horizontally. */
function cloudTexture(seed) {
  const W = 512;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const n = fbm(u, v * 0.25, 6, 5, seed);
      const band = Math.exp(-(((v - 0.45) * 2.6) ** 2));
      const d = Math.max(0, n - 0.46) * 3.2 * band;
      const k = (y * W + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.min(255, d * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ shaders
const NOISE = /* glsl */ `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm3(vec2 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

function lavaMaterial(P) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 },
      crust: { value: new THREE.Color(P.crust) },
      crustWarm: { value: new THREE.Color(P.crustWarm) },
      lava: { value: new THREE.Color(P.lava) },
      hot: { value: new THREE.Color(P.lavaHot) },
    }]),
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 crust, crustWarm, lava, hot; varying vec3 vW;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec2 p = vW.xz * 0.045;
        vec2 flow = vec2(time * 0.018, time * 0.011);
        float big = fbm3(p * 0.35 + flow * 0.5);
        float n = fbm3(p + flow + big * 1.3);
        float ridge = 1.0 - abs(n * 2.0 - 1.0);
        float vein = smoothstep(0.80, 0.97, ridge);
        float core = smoothstep(0.95, 1.0, ridge);
        float pool = smoothstep(0.62, 0.8, big);
        vec3 c = mix(crust, crustWarm, smoothstep(0.3, 0.8, n));
        c = mix(c, lava * 2.4, max(vein, pool * 0.8));
        c += hot * 3.0 * (core + pool * smoothstep(0.7, 0.9, n) * 0.6);
        float pulse = 0.85 + 0.15 * sin(time * 0.9 + big * 9.0);
        gl_FragColor = vec4(c * pulse, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

function skyMaterial(P, sunDir, clouds) {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: sunDir.clone() },
      zenith: { value: new THREE.Color(P.zenith) },
      mid: { value: new THREE.Color(P.skyMid) },
      horizon: { value: new THREE.Color(P.horizon) },
      sun: { value: new THREE.Color(P.sun) },
      fog: { value: new THREE.Color(P.fog) },
      tClouds: { value: clouds },
      time: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, zenith, mid, horizon, sun, fog; uniform sampler2D tClouds; uniform float time; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y;
        float g = max(dot(d, sunDir), 0.0);
        // Horizon glows hotter toward the sun.
        vec3 hz = mix(horizon * 0.55, horizon, pow(g, 3.0));
        vec3 c = mix(hz, mid, smoothstep(-0.02, 0.22, e));
        c = mix(c, zenith, smoothstep(0.18, 0.65, e));
        // Ash bands, lit from behind by the sun.
        float u = atan(d.x, -d.z) / 6.2831853 + 0.5 + time * 0.0006;
        float v = clamp(e * 2.4 + 0.12, 0.0, 1.0);
        float a = texture2D(tClouds, vec2(u, v)).a * smoothstep(-0.02, 0.06, e);
        vec3 cloud = mix(mid * 0.45, sun * 1.6, pow(g, 6.0)) + horizon * 0.25 * (1.0 - smoothstep(0.0, 0.3, e));
        c = mix(c, cloud, a * 0.85);
        // The sun: a hot disc, a tight halo, a wide bloom.
        c += sun * (smoothstep(0.99955, 0.99975, g) * 7.0 + pow(g, 400.0) * 0.8 + pow(g, 14.0) * 0.3) * (1.0 - a * 0.6);
        // Below the horizon: haze over the burning sea.
        c = mix(c, fog * 1.3 + horizon * 0.12 * pow(g, 2.0), smoothstep(0.0, -0.08, e));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/** Rising embers: a box of points that wraps around the camera. */
function embersField(count, color) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const r = new Rng(77);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = r.float() * 70;
    pos[i * 3 + 1] = r.float() * 26;
    pos[i * 3 + 2] = r.float() * 70;
    seed[i] = r.float();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, color: { value: new THREE.Color(color) }, scale: { value: 400 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float time, scale; uniform vec3 cam; varying float vA;
      void main(){
        vec3 box = vec3(70.0, 26.0, 70.0);
        vec3 p = position + vec3(sin(time * 0.6 + seed * 40.0) * 1.5, time * (1.2 + seed * 1.8), cos(time * 0.5 + seed * 30.0) * 1.5);
        p = mod(p - cam + box * 0.5, box) - box * 0.5 + cam;
        p.y -= 6.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float tw = 0.5 + 0.5 * sin(time * (3.0 + seed * 5.0) + seed * 60.0);
        vA = tw * smoothstep(34.0, 10.0, length(mv.xyz)) * smoothstep(0.5, 3.0, -mv.z);
        gl_PointSize = (0.05 + seed * 0.09) * scale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float k = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(color * 3.0 * k * k * vA, 1.0); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ------------------------------------------------------------------ build
export async function buildWorld(ctx, config, rules, P, track) {
  const scene = ctx.scene;
  const q = ctx.config.q;
  const rng = new Rng(config.worldSeed * 7919 + 3);
  const group = new THREE.Group();
  scene.add(group);
  const lw = rules.body.laneWidth;
  const lanes = rules.body.lanes;
  const roadHalf = (lanes * lw) / 2 + 0.9; // lanes plus a margin each side
  const curbW = 0.55;
  const lavaY = track.minY - 4.5;
  const end = rules.goal + 34;

  // Sun: low, a little left of the line from the start to the beacon.
  const goalPos = track.point(rules.goal);
  const toGoal = new THREE.Vector3(goalPos.x, 0, goalPos.z).normalize();
  const sunDir = toGoal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.32);
  sunDir.y = 0.075;
  sunDir.normalize();

  scene.fog = new THREE.FogExp2(P.fog, P.fogDensity);
  scene.background = new THREE.Color(P.fog);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMaterial(P, sunDir, cloudTexture(config.worldSeed * 31 + 7)));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const lava = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), lavaMaterial(P));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = lavaY;
  scene.add(lava);

  // ---- materials
  const hexT = hexTextures(rng, P);
  const topMat = new THREE.MeshStandardMaterial({
    map: hexT.map, normalMap: hexT.normalMap, emissiveMap: hexT.emissiveMap, emissive: new THREE.Color(P.groutGlow), emissiveIntensity: 1.4,
    roughness: 0.82, metalness: 0.05, normalScale: new THREE.Vector2(1.1, 1.1),
  });
  const colT = columnTextures(rng, P);
  const wallMat = new THREE.MeshStandardMaterial({ map: colT.map, normalMap: colT.normalMap, roughness: 0.9, metalness: 0 });
  const curbMat = new THREE.MeshStandardMaterial({ color: P.curb, roughness: 0.7, metalness: 0.05, map: colT.map });
  const laneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.lane).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.75, depthWrite: false });
  const tileV = 3.3; // metres per texture repeat along the road

  // ---- the causeway, chunk by chunk
  const f = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  const v = new THREE.Vector3();
  for (let s0 = -40; s0 < end; s0 += CHUNK) {
    const s1 = Math.min(end, s0 + CHUNK);
    const top = { p: [], uv: [], idx: [] };
    const wall = { p: [], uv: [], idx: [] };
    const curb = { p: [], uv: [], idx: [] };
    const seam = { p: [], uv: [], idx: [] };
    const n = Math.round((s1 - s0) / STEP);
    // Cross sections: [x, y] pairs across the road; each list is a strip.
    const strip = (L, cross, uvOf) => {
      const cols = cross.length;
      const base = L.p.length / 3;
      for (let i = 0; i <= n; i++) {
        const s = s0 + i * STEP;
        track.frame(s, f);
        for (let c = 0; c < cols; c++) {
          const [x, y] = cross[c];
          v.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, y);
          if (y < -50) v.y = lavaY - 2; // walls reach down into the lava
          L.p.push(v.x, v.y, v.z);
          const [u, vv] = uvOf(s, x, y, c, v);
          L.uv.push(u, vv);
        }
        if (i < n) {
          for (let c = 0; c < cols - 1; c++) {
            const a = base + i * cols + c;
            const b = a + cols;
            L.idx.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
      }
    };
    strip(top, [[-roadHalf, 0], [0, 0], [roadHalf, 0]], (s, x) => [x / tileV, -s / (tileV * hexT.aspect)]);
    // Curbs: a low lip each side.
    for (const side of [-1, 1]) {
      const xi = side * roadHalf;
      const xo = side * (roadHalf + curbW);
      const cross = side < 0 ? [[xo, -0.1], [xo, 0.22], [xi, 0.22], [xi, 0]] : [[xi, 0], [xi, 0.22], [xo, 0.22], [xo, -0.1]];
      strip(curb, cross, (s, x, y) => [s / 2.5, (x + y) / 2.5]);
      // Wall from the curb down into the lava, flaring out.
      const wcross = side < 0 ? [[xo - 1.6, -99], [xo, -0.1]] : [[xo, -0.1], [xo + 1.6, -99]];
      strip(wall, wcross, (s, x, y, c, p) => [s / 3.2, p.y / 5.5]);
    }
    // Ember seams between lanes.
    for (let k = 1; k < lanes; k++) {
      const x = (k - lanes / 2) * lw;
      strip(seam, [[x - 0.035, 0.012], [x + 0.035, 0.012]], (s) => [0, s]);
    }
    const make = (L, mat, shadow) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
      g.setIndex(L.idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = !!shadow;
      m.matrixAutoUpdate = false;
      group.add(m);
    };
    make(top, topMat, true);
    make(wall, wallMat);
    make(curb, curbMat, true);
    make(seam, laneMat);
  }

  // ---- props: braziers on the curbs, outcrops and stacks in the lava
  const [outcrop, boulder] = await Promise.all([loadModel(outcropUrl), loadModel(boulderUrl)]);
  const rockMat = (tint, rough = 0.88) => () => new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, roughness: rough, metalness: 0 });
  const beaconAt = track.point(rules.goal + 36);
  const nearDistOk = (p, minD, s) => {
    if ((beaconAt.x - p.x) ** 2 + (beaconAt.z - p.z) ** 2 < 18 * 18) return false;
    for (let t = s - 260; t <= s + 260; t += 8) {
      if (t < -60 || t > end + 60) continue;
      const c = track.point(t);
      if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < minD * minD) return false;
    }
    return true;
  };
  const braziers = [];
  const flames = [];
  for (let s = 18, side = 1; s < end - 10; s += 22, side = -side) {
    track.frame(s, f);
    const x = side * (roadHalf + curbW * 0.5);
    v.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, 0.2);
    braziers.push({ x: v.x, y: v.y, z: v.z, s: 0.75, ry: rng.float() * 6.28 });
    flames.push(v.x, v.y + 0.95, v.z);
  }
  const SCH = 150;
  for (let c0 = -60; c0 < end + 200; c0 += SCH) {
    const near = [];
    const far = [];
    for (let s = c0; s < c0 + SCH; s += 5) {
      track.frame(Math.min(s, end + 150), f);
      for (const side of [-1, 1]) {
        if (rng.float() < 0.42 * q.scatter + 0.1) {
          const off = roadHalf + curbW + 1.5 + rng.float() ** 1.6 * 26;
          v.copy(f.pos).addScaledVector(f.right, side * off);
          if (nearDistOk(v, roadHalf + 2.2, s)) near.push({ x: v.x, y: lavaY - 0.6 - rng.float() * 1.5, z: v.z, s: 0.9 + rng.float() * 2.6, sy: 0.8 + rng.float() * (1 + (track.point(s).y - lavaY) / 6), ry: rng.float() * 6.28 });
        }
        if (rng.float() < 0.09 * q.scatter + 0.03) {
          const off = 45 + rng.float() * 220;
          v.copy(f.pos).addScaledVector(f.right, side * off).addScaledVector(f.fwd, (rng.float() - 0.5) * 40);
          if (nearDistOk(v, 30, s)) far.push({ x: v.x, y: lavaY - 2, z: v.z, s: 5 + rng.float() * 12, sy: 1 + rng.float() * 2.2, ry: rng.float() * 6.28 });
        }
      }
    }
    if (near.length) group.add(scatter(outcrop, near, { material: rockMat('#b9a9a4'), castShadow: false }));
    if (far.length) group.add(scatter(outcrop, far, { material: rockMat('#8c7c80', 0.95) }));
  }
  group.add(scatter(boulder, braziers, { material: rockMat('#a89c98'), castShadow: true }));

  // Brazier flames: one points object, flickering.
  const glow = glowTexture(64);
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute('position', new THREE.Float32BufferAttribute(flames, 3));
  const flameMat = new THREE.PointsMaterial({ map: glow, color: new THREE.Color(P.brazier).multiplyScalar(2.6), size: 1.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const flamePts = new THREE.Points(flameGeo, flameMat);
  group.add(flamePts);
  const coreMat = flameMat.clone();
  coreMat.size = 0.55;
  coreMat.color = new THREE.Color(P.cinderHot).multiplyScalar(4);
  group.add(new THREE.Points(flameGeo, coreMat));

  // ---- the beacon at the far end: a platform, a tower of columns, a fire bowl
  const beacon = new THREE.Group();
  {
    track.frame(rules.goal + 36, f);
    beacon.position.copy(f.pos);
    beacon.rotation.y = -track.headingAt(rules.goal + 36);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, f.pos.y - lavaY + 2, 6, 1), wallMat);
    plat.position.y = -(f.pos.y - lavaY + 2) / 2 + 0.01;
    const platTop = new THREE.Mesh(new THREE.CircleGeometry(9, 6), topMat);
    platTop.rotation.x = -Math.PI / 2;
    platTop.position.y = 0.02;
    platTop.receiveShadow = true;
    beacon.add(plat, platTop);
    const colMat = new THREE.MeshStandardMaterial({ color: '#4a3e40', roughness: 0.8, map: colT.map });
    const cols = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = i === 0 ? 0 : 1.6;
      const h = 8.5 + (i === 0 ? 3 : rng.float() * 2.5);
      const g = new THREE.CylinderGeometry(0.85, 0.95, h, 6);
      g.translate(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      cols.push(g);
    }
    const tower = new THREE.Mesh(mergeGeometries(cols), colMat);
    tower.castShadow = true;
    beacon.add(tower);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.8, 1.6, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#2a2224', roughness: 0.7, side: THREE.DoubleSide }));
    bowl.position.y = 12.2;
    beacon.add(bowl);
    scene.add(beacon);
  }
  const fireSprite = (size, color, opacity) => {
    const m = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  };
  const fireCore = fireSprite(6, new THREE.Color(P.beacon).multiplyScalar(3), 0.9);
  const fireHalo = fireSprite(40, P.beacon, 0.35);
  const fireFar = fireSprite(140, P.horizon, 0.18);
  fireCore.position.y = fireHalo.position.y = fireFar.position.y = 13.8;
  beacon.add(fireCore, fireHalo, fireFar);
  const fireLight = new THREE.PointLight(P.beacon, 0, 90, 1.4);
  fireLight.position.y = 15;
  beacon.add(fireLight);
  let lit = 0;

  // ---- the volcano on the horizon, right of the sun
  {
    const dir = toGoal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.55);
    const g = new THREE.CylinderGeometry(70, 640, 300, 64, 6, true);
    const p = g.attributes.position;
    const vr = new Rng(5);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + (vr.float() - 0.5) * (y > 140 ? 0.25 : 0.1);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
      if (y > 140) p.setY(i, y - vr.float() * 14);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(P.fog).multiplyScalar(0.62), fog: false }));
    m.position.copy(dir.clone().multiplyScalar(1500)).setY(lavaY + 100);
    m.renderOrder = -5;
    scene.add(m);
    const crater = fireSprite(380, P.lava, 0.32);
    crater.position.copy(m.position).setY(lavaY + 240);
    crater.renderOrder = -4;
    scene.add(crater);
  }

  // ---- air
  const motes = embersField(Math.round(380 * (q.scatter + 0.2)), P.cinder);
  scene.add(motes);

  // ---- lights
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemi);
  const key = new THREE.DirectionalLight(P.key, P.keyIntensity);
  const under = new THREE.DirectionalLight(P.under, P.underIntensity);
  scene.add(hemi, key, key.target, under, under.target);
  if (q.shadowSize > 0) {
    key.castShadow = true;
    key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const sc = key.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 120;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
  }
  const flash = new THREE.PointLight('#ff8a3a', 0, 26, 1.6);
  scene.add(flash);
  let flashT = 9;

  return {
    group,
    sunDir,
    beacon,
    goalView: beacon.position.clone().add(new THREE.Vector3(0, 9, 0)),
    flash(pos, color, power = 1) {
      flash.position.copy(pos);
      flash.color.set(color);
      flash.userData.power = 140 * power;
      flashT = 0;
    },
    update(dt, time, camera, round) {
      sky.position.copy(camera.position);
      sky.material.uniforms.time.value = time;
      lava.position.x = Math.round(camera.position.x / 50) * 50;
      lava.position.z = Math.round(camera.position.z / 50) * 50;
      lava.material.uniforms.time.value = time;
      motes.material.uniforms.time.value = time;
      motes.material.uniforms.cam.value.copy(camera.position);
      motes.material.uniforms.scale.value = (ctx.canvas.clientHeight || innerHeight) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      // Sun and its shadow follow the runner.
      const b = round.body;
      const at = track.toWorld(b.s + 3, b.x, 0, v);
      key.target.position.copy(at);
      key.position.copy(at).addScaledVector(sunDir, 60);
      under.target.position.copy(at);
      under.position.copy(at).add(new THREE.Vector3(0.2, -40, 0.3));
      // Flicker.
      const fl = 0.85 + 0.1 * Math.sin(time * 13) + 0.05 * Math.sin(time * 31);
      flameMat.size = 1.6 * fl;
      coreMat.size = 0.55 * (0.9 + 0.1 * Math.sin(time * 17));
      // The beacon: a smoulder until the run is won, then a blaze.
      const want = round.state === 'won' ? 1 : 0;
      lit += (want - lit) * (1 - Math.exp(-dt * (want ? 1.5 : 6)));
      const beat = 0.9 + 0.1 * Math.sin(time * 9) * Math.sin(time * 5.3);
      fireCore.scale.setScalar((3 + lit * 9) * beat);
      fireCore.material.opacity = 0.35 + lit * 0.65;
      fireHalo.scale.setScalar((14 + lit * 50) * beat);
      fireHalo.material.opacity = 0.18 + lit * 0.35;
      fireFar.scale.setScalar(60 + lit * 140);
      fireFar.material.opacity = 0.1 + lit * 0.18;
      fireLight.intensity = lit * 2600 * beat;
      if (flashT < 2) {
        flashT += dt;
        flash.intensity = flash.userData.power * Math.exp(-flashT * 7);
      } else flash.intensity = 0;
    },
  };
}
