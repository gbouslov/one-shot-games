import * as THREE from 'three';
import { loadGltf } from '../kit/world/scatter.js';
import { Trail } from '../kit/fx/particles.js';
import { glowTexture } from '../kit/textures/textures.js';
import courierUrl from './assets/courier/rogue-hooded-runner.glb?url';

/**
 * The courier: KayKit's hooded rogue (CC0, via Patch) with its own run,
 * jump, roll, hit, fall and cheer clips, carrying the ember in a lantern in
 * the left hand. A hot rim of light on the outline keeps the silhouette sharp
 * against the dark road; the lantern lights the road around them and draws a
 * ribbon of light as it swings.
 *
 * Returns an Object3D whose userData.update(dt, body, round, time, hooks)
 * picks the clip from the body's state and calls hooks.step() on footfalls,
 * and userData.on(type, e) reacts to round events.
 */
const glowTex = glowTexture(64);

function rimPatch(material, color, power) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = { value: new THREE.Color(color).multiplyScalar(power) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float r = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += rimColor * pow(r, 3.0); }');
  };
  material.customProgramCacheKey = () => 'courier-rim';
}

export async function buildCourier(ctx, config, rules, P) {
  const gltf = await loadGltf(courierUrl);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y;
  const k = (rules.body.height + 0.05) / h;
  model.scale.setScalar(k);
  model.position.y = -box.min.y * k;
  model.rotation.y = Math.PI; // the model faces +Z; the runner's forward is -Z
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    const m = o.material;
    m.roughness = 0.72;
    m.metalness = 0;
    m.color.setScalar(0.88); // the low sun hits the face square-on; keep pale skin under the bloom threshold
    rimPatch(m, P.horizon, 0.55);
  });

  const root = new THREE.Group();
  const lean = new THREE.Group();
  lean.add(model);
  root.add(lean);

  // ---- clips
  const mixer = new THREE.AnimationMixer(model);
  const clip = (name) => gltf.animations.find((a) => a.name === name);
  const act = {};
  for (const [key, name, once] of [
    ['run', 'Running_A'], ['jog', 'Running_B'], ['jumpStart', 'Jump_Start', true], ['jumpAir', 'Jump_Idle'], ['land', 'Jump_Land', true],
    ['roll', 'Dodge_Forward', true], ['hit', 'Hit_A', true], ['death', 'Death_A', true], ['cheer', 'Cheering'], ['idle', 'Idle_A'],
  ]) {
    const c = clip(name);
    if (!c) continue;
    const a = mixer.clipAction(c);
    if (once) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    act[key] = a;
  }
  let current = null;
  const play = (key, fade = 0.12, timeScale = 1) => {
    const a = act[key];
    if (!a) return;
    a.timeScale = timeScale;
    if (current === key) return;
    const prev = current ? act[current] : null;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (prev) prev.crossFadeTo(a, fade, false);
    current = key;
  };
  play('jog', 0);

  // ---- the lantern
  const hand = model.getObjectByName('handslot.l') ?? model.getObjectByName('hand.l');
  const lantern = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.lantern).multiplyScalar(3), toneMapped: false }));
  cage.scale.set(1, 1.4, 1);
  lantern.add(cage);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(P.lantern).multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false }));
  halo.scale.setScalar(0.4 / k);
  halo.material.opacity = 0.55;
  if (hand) {
    lantern.scale.setScalar(1 / k);
    hand.add(lantern);
  } else {
    lantern.position.set(-0.35, 1.0, -0.1);
    root.add(lantern);
  }
  lantern.add(halo);
  const light = new THREE.PointLight(P.lantern, 9, 11, 1.5);
  light.position.set(-0.25, 0.55, -1.3); // low and ahead: lights the road, not the face
  root.add(light);
  // A cool fill from behind and above, the camera's side: the back of the courier is what we see most.
  const fill = new THREE.PointLight(P.fill, P.fillIntensity, 8, 1.2);
  fill.position.set(0.6, 2.6, 2.6);
  root.add(fill);
  const trail = new Trail({ length: 28, maxLength: 3, width: 0.05, color: new THREE.Color(P.lantern).multiplyScalar(2.2), opacity: 0.85, additive: true, nearFade: [1.2, 3] });
  trail.mesh.material.toneMapped = false;
  ctx.scene.add(trail.mesh);
  const tmp = new THREE.Vector3();

  // A soft dark blob under the feet: contact on every quality tier.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float a; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.2, 1.0, d)) * a); }',
    uniforms: { a: { value: 0.55 } },
  }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.renderOrder = 1;
  root.add(blob);

  let phase = 0;
  let jumpT = 0;
  let landT = 9;
  let hitT = 9;
  let prevXv = 0;
  const footPhase = [0.05, 0.55];

  root.userData.on = (type) => {
    if (type === 'runner:jump') jumpT = 0;
    if (type === 'runner:land') landT = 0;
    if (type === 'runner:hit') hitT = 0;
    if (type === 'round:start' || type === 'round:loop') {
      trail.reset();
      hitT = 9;
      current = null;
      mixer.stopAllAction();
      play('run', 0);
    }
  };

  root.userData.update = (dt, b, round, time, hooks) => {
    jumpT += dt;
    landT += dt;
    hitT += dt;
    const st = round.state;
    const v = b.speed;
    if (st === 'lost') play('death', 0.15, 1.2);
    else if (st === 'won' && v < 4) play('cheer', 0.3, 1);
    else if (b.airborne) play(jumpT < 0.16 ? 'jumpStart' : 'jumpAir', 0.08, jumpT < 0.16 ? 2.4 : 1);
    else if (b.sliding) play('roll', 0.06, 0.4 / rules.body.slideTime * 1.05);
    else if (hitT < 0.38) play('hit', 0.05, 1.6);
    else if (landT < 0.12) play('land', 0.05, 2.6);
    else if (st === 'title') play('jog', 0.2, 1.25);
    else play('run', 0.12, Math.min(2.7, 1.15 + v * 0.06));
    mixer.update(dt);

    // Footfalls from the run cycle.
    const a = act[current];
    if ((current === 'run' || current === 'jog') && a) {
      const ph = (a.time / a.getClip().duration) % 1;
      for (let i = 0; i < 2; i++) {
        const f = footPhase[i];
        if ((phase < f && ph >= f) || (phase > ph && (ph >= f || phase < f))) hooks.step(i);
      }
      phase = ph;
    }

    // Lean forward with speed, into lane changes, and wobble on a stumble.
    const xv = b.xv * 0.6 + prevXv * 0.4;
    prevXv = xv;
    lean.rotation.z = THREE.MathUtils.clamp(-xv * 0.035, -0.35, 0.35);
    lean.rotation.x = st === 'playing' && !b.sliding ? -Math.min(0.16, v * 0.006) : 0;
    if (b.stumble > 0) lean.rotation.z += Math.sin(time * 40) * 0.08 * b.stumble;
    // Blink while invulnerable after a hit.
    model.visible = !(round.invuln > 0 && st === 'playing' && Math.sin(time * 38) > 0.4);
    blob.material.uniforms.a.value = 0.55 * Math.max(0.2, 1 - b.y / 2.5);
    blob.position.y = 0.02 - b.y;
    light.intensity = 9 * (0.9 + 0.1 * Math.sin(time * 23) * Math.sin(time * 7));

    root.updateMatrixWorld(true);
    lantern.getWorldPosition(tmp);
    trail.push(tmp, st === 'playing' ? 1 : 0.5);
    trail.update(ctx.camera);
  };
  return root;
}
