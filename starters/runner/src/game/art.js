import * as THREE from 'three';
import { loadModel } from '../kit/world/scatter.js';
import { glowTexture } from '../kit/textures/textures.js';
import outcropUrl from './assets/outcrop/basalt-column-outcrop-f1339d.glb?url';
import boulderUrl from './assets/boulder/basalt-boulder-a1929c.glb?url';
import rubbleUrl from './assets/rubble/lava-rock-pile-d56d19.glb?url';

/**
 * The things on the road: basalt spires to dodge, heaps of hot rock to jump
 * or dodge, cracks of fire across the road to jump, fallen columns at head
 * height to slide under, and the cinders to pick up. Each obstacle reads its
 * answer at a glance: tall and dark (go round), low and glowing (go over), a
 * curtain of heat on the ground (jump), a glowing underside overhead (duck).
 *
 * art.obstacle(o) returns an Object3D in track-local axes (-Z ahead, +Y up,
 * origin on the road at the obstacle's lane and middle); the director places it.
 * art.pickups(course, track) returns { object, update, take }.
 */
const glowTex = glowTexture(64);

function sprite(color, size, opacity = 1, fog = true) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

/** One centred mesh from a loaded GLB, its base on y = 0, scaled to a size in metres. */
function prepare(scene, size, material) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const c = box.getCenter(new THREE.Vector3());
  const dim = box.getSize(new THREE.Vector3());
  const geos = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    g.translate(-c.x, -box.min.y, -c.z);
    g.scale(size[0] / dim.x, size[1] / dim.y, size[2] / dim.z);
    geos.push(g);
  });
  const mesh = new THREE.Mesh(geos[0], material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Vertex-coloured rock that glows hot toward its base (lava heat), via a small shader patch. */
function hotRockMaterial(tint, hot, height, power) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.hotColor = { value: new THREE.Color(hot).multiplyScalar(power) };
    sh.uniforms.hotHeight = { value: height };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY; uniform vec3 hotColor; uniform float hotHeight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += hotColor * pow(1.0 - clamp(vLocalY / hotHeight, 0.0, 1.0), 2.5);');
  };
  return m;
}

export async function buildArt(ctx, config, rules, P) {
  const [outcropG, boulderG, rubbleG] = await Promise.all([outcropUrl, boulderUrl, rubbleUrl].map(loadModel));
  const lw = rules.body.laneWidth;
  const roadHalf = (rules.body.lanes * lw) / 2 + 0.9;
  const K = rules.obstacles;

  const spireMat = hotRockMaterial('#9a8c8c', P.lava, 1.6, 0.9);
  const spire = prepare(outcropG, [1.75, K.spire.y[1], 1.6], spireMat);
  const rubbleMat = hotRockMaterial('#7a6660', P.lava, K.rubble.y[1] * 0.9, 0.85);
  const rubble = prepare(rubbleG, [1.95, K.rubble.y[1], K.rubble.depth], rubbleMat);
  const boulderMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#a09494', roughness: 0.85 });
  const boulder = prepare(boulderG, [1.3, 1.0, 1.2], boulderMat);

  const lavaHdr = (k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(P.lava).multiplyScalar(k), toneMapped: false });
  const hotHdr = (k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(P.lavaHot).multiplyScalar(k), toneMapped: false });
  const charMat = new THREE.MeshBasicMaterial({ color: '#050303', transparent: true, opacity: 0.9, depthWrite: false });

  // A jagged crack across the road, as a flat shape in the XZ plane.
  const crack = (depth, jag, seed) => {
    const sh = new THREE.Shape();
    const w = roadHalf + 0.6;
    const n = 18;
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const top = [];
    const bot = [];
    for (let i = 0; i <= n; i++) {
      const x = -w + (2 * w * i) / n;
      top.push([x, depth / 2 + (rnd() - 0.5) * jag]);
      bot.push([x, -depth / 2 + (rnd() - 0.5) * jag]);
    }
    sh.moveTo(top[0][0], top[0][1]);
    for (const [x, y] of top) sh.lineTo(x, y);
    for (const [x, y] of bot.reverse()) sh.lineTo(x, y);
    sh.closePath();
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const curtainMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(P.lava).multiplyScalar(2.2) }, time: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 color; uniform float time; varying vec2 vUv;
      void main(){ float f = pow(1.0 - vUv.y, 2.2); float w = 0.75 + 0.25 * sin(vUv.x * 40.0 + time * 6.0) * sin(vUv.x * 13.0 - time * 3.0);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(color * f * w * edge, 1.0); }`,
  });
  const colMat = new THREE.MeshStandardMaterial({ color: '#5a4c4c', roughness: 0.82, metalness: 0 });

  // Sparks rising out of a fissure: positions animated in the shader, shared by every fissure.
  const sparkGeo = new THREE.BufferGeometry();
  {
    const n = 40;
    const pos = new Float32Array(n * 3);
    let r = 12345;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * roadHalf;
      pos[i * 3 + 1] = rnd(); // phase
      pos[i * 3 + 2] = (rnd() - 0.5) * 1.2;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  }
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { time: curtainMat.uniforms.time, color: { value: new THREE.Color(P.lavaHot).multiplyScalar(3) }, scale: { value: 400 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `uniform float time, scale; varying float vA;
      void main(){ float t = fract(position.y + time * 0.6); vec3 p = vec3(position.x + sin(t * 9.0 + position.x) * 0.2, t * 2.6, position.z);
        vA = (1.0 - t) * smoothstep(0.0, 0.1, t); vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 0.09 * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float k = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(color * k * vA, 1.0); }`,
  });

  let seed = 7;
  const obstacle = (o) => {
    const root = new THREE.Group();
    const g = new THREE.Group();
    root.add(g);
    const kind = o.kind;
    if (kind === 'spire') {
      const m = spire.clone();
      m.rotation.y = (seed++ % 6) * (Math.PI / 3) + 0.2;
      g.add(m);
      const heat = sprite(P.lava, 2.6, 0.55);
      heat.position.set(0, 0.15, 0.4);
      g.add(heat);
    } else if (kind === 'rubble') {
      const m = rubble.clone();
      m.rotation.y = (seed++ % 2) * Math.PI;
      g.add(m);
      const heat = sprite(P.lava, 2.6, 0.5);
      heat.position.set(0, 0.25, 0.6);
      g.add(heat);
      const core = sprite(P.lavaHot, 0.8, 0.45);
      core.position.set((seed % 3 - 1) * 0.3, 0.4, 0.7);
      g.add(core);
    } else if (kind === 'fissure') {
      const d = o.depth;
      const ch = new THREE.Mesh(crack(d + 0.9, 0.7, seed++ * 977 + 1), charMat);
      ch.position.y = 0.012;
      ch.renderOrder = 1;
      const molten = new THREE.Mesh(crack(d * 0.8, 0.5, seed++ * 613 + 5), lavaHdr(2.6));
      molten.position.y = 0.02;
      const core = new THREE.Mesh(crack(d * 0.32, 0.25, seed++ * 389 + 9), hotHdr(3.2));
      core.position.y = 0.026;
      g.add(ch, molten, core);
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf * 2 + 0.6, 1.6), curtainMat);
      curtain.position.y = 0.8;
      g.add(curtain);
      for (let i = 0; i < 4; i++) {
        const s = sprite(P.lava, 3.2, 0.5);
        s.position.set((i - 1.5) * lw * 0.95, 0.3, 0);
        g.add(s);
      }
      g.add(new THREE.Points(sparkGeo, sparkMat));
    } else if (kind === 'arch') {
      const span = roadHalf * 2 + 1.6;
      const r = 0.5;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, span, 6, 1), colMat);
      col.rotation.z = Math.PI / 2;
      col.rotation.x = 0.3;
      col.position.y = K.arch.y[0] + r * 0.95;
      col.castShadow = true;
      g.add(col);
      // A seam of heat along its underside, so it reads against the road.
      const seam = new THREE.Mesh(new THREE.BoxGeometry(span - 1.2, 0.05, 0.12), lavaHdr(2.4));
      seam.position.y = K.arch.y[0] + 0.03;
      g.add(seam);
      for (const side of [-1, 1]) {
        const b1 = boulder.clone();
        b1.position.set(side * (roadHalf + 0.35), 0, 0);
        b1.scale.set(1.1, 1.25, 1.1);
        const b2 = boulder.clone();
        b2.position.set(side * (roadHalf + 0.45), 1.15, 0.05);
        b2.rotation.y = 1.3;
        b2.scale.set(0.9, 0.9, 0.9);
        g.add(b1, b2);
      }
      for (let i = 0; i < 3; i++) {
        const s = sprite(P.lava, 1.4, 0.45);
        s.position.set((i - 1) * lw, K.arch.y[0] - 0.05, 0);
        g.add(s);
      }
    }
    // Struck: shudder and sink (the round has already counted the hit).
    root.userData.update = (dt, time) => {
      if (kind === 'fissure') curtainMat.uniforms.time.value = time;
      const t = root.userData.hitT;
      if (t > 0) {
        const k = Math.min(1, t / 0.5);
        g.position.set(Math.sin(t * 70) * 0.08 * (1 - k), -k * (kind === 'arch' ? 0.2 : 0.6), 0);
        if (kind === 'rubble' || kind === 'spire') g.scale.set(1 + k * 0.15, 1 - k * 0.45, 1 + k * 0.15);
      }
    };
    return root;
  };

  // ---- cinders: glowing crystals, one instanced draw, plus their halos as points
  const pickups = (course, track) => {
    const list = course.pickups;
    const n = Math.max(1, list.length);
    const geo = new THREE.OctahedronGeometry(0.2, 0);
    geo.scale(1, 1.5, 1);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.cinder).multiplyScalar(3.2), toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    const pos = new Float32Array(n * 3);
    const alpha = new Float32Array(n);
    const base = list.map((p) => track.toWorld(p.s, p.lane * lw, p.y, new THREE.Vector3()));
    base.forEach((b, i) => {
      pos[i * 3] = b.x;
      pos[i * 3 + 1] = b.y;
      pos[i * 3 + 2] = b.z;
      alpha[i] = 1;
    });
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    hg.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    hg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const hm = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: new THREE.Color(P.cinder) }, scale: { value: 400 }, time: { value: 0 } }]),
      fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float alpha; uniform float scale, time; varying float vA;
        #include <fog_pars_vertex>
        void main(){ vec4 mvPosition = modelViewMatrix * vec4(position + vec3(0.0, sin(time * 3.0 + position.x + position.z) * 0.12, 0.0), 1.0);
          vA = alpha; gl_PointSize = 1.5 * scale / max(0.1, -mvPosition.z); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        #include <fog_pars_fragment>
        void main(){ vec2 d = gl_PointCoord - 0.5; float k = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(color * 1.6 * k * k * vA, 1.0);
          #include <fog_fragment>
        }`,
    });
    const halos = new THREE.Points(hg, hm);
    halos.frustumCulled = false;
    const object = new THREE.Group();
    object.add(mesh, halos);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const zero = new THREE.Vector3(0, 0, 0);
    const p = new THREE.Vector3();
    const taken = new Uint8Array(n);
    const idOf = new Map(list.map((x, i) => [x.id, i]));
    let lo = 0;
    return {
      object,
      take(pk) {
        const i = idOf.get(pk.id);
        if (i === undefined) return;
        taken[i] = 1;
        alpha[i] = 0;
        hg.attributes.alpha.needsUpdate = true;
      },
      update(dt, time, round) {
        hm.uniforms.time.value = time;
        hm.uniforms.scale.value = (ctx.canvas.clientHeight || innerHeight) / (2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2));
        const s = round.body.s;
        while (lo < list.length && list[lo].s < s - 6) {
          m4.compose(zero, q, zero);
          mesh.setMatrixAt(lo, m4);
          lo++;
        }
        const view = ctx.config.q.view ?? 220;
        let count = 0;
        for (let i = 0; i < list.length; i++) {
          if (i < lo || list[i].s > s + view || taken[i]) {
            m4.makeScale(0, 0, 0);
          } else {
            e.set(0, time * 2.4 + i, 0.25);
            q.setFromEuler(e);
            p.copy(base[i]);
            p.y += Math.sin(time * 3 + base[i].x + base[i].z) * 0.12;
            m4.compose(p, q, one);
            count++;
          }
          mesh.setMatrixAt(i, m4);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  };

  return { obstacle, pickups };
}
