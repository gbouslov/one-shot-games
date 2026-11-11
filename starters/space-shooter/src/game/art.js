import * as THREE from 'three';
import { loadModel } from '../kit/world/scatter.js';
import { glowTexture } from '../kit/textures/textures.js';
// Ready-made models (credits in NOTICES.md). Imported as URLs so the build inlines them.
import fighterUrl from './assets/fighter/agile-starfighter-89805f.glb?url';
import raiderUrl from './assets/raider/interceptor-9d2289.glb?url';
import turretUrl from './assets/turret/defense-turret-12ba8d.glb?url';

/**
 * Everything the player looks at that moves: the player's fighter, the
 * raider craft, the wall guns, the girders across the trench and the reactor
 * heart at the end. The ready-made models are vertex-coloured; they get a
 * metal material here, engine glows and running lights, and a hit flash.
 */
const glowTex = glowTexture(64);

function sprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

function hdr(color, k) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
}

/** Turn a loaded GLB into one centred group with nose down -Z and a metal finish. */
function prepare(scene, { scale, yaw, nozzleName, tint = '#ffffff', metal = 0.45, rough = 0.42, emissive = '#000000' }) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const centre = box.getCenter(new THREE.Vector3());
  // Nose direction: the engine nozzles are at the tail. Detect which end they are on.
  let y = yaw;
  if (y == null) {
    let nz = null;
    scene.traverse((o) => {
      if (nz === null && nozzleName && o.name && o.name.includes(nozzleName)) nz = o.getWorldPosition(new THREE.Vector3()).z;
    });
    y = nz !== null && nz < centre.z ? Math.PI : 0;
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, metalness: metal, roughness: rough, emissive, emissiveIntensity: 0 });
  const inner = new THREE.Group();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    g.translate(-centre.x, -centre.y, -centre.z);
    inner.add(new THREE.Mesh(g, mat));
  });
  inner.rotation.y = y;
  inner.scale.setScalar(scale);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
  return { inner, mat, size };
}

export async function buildArt(ctx, config, rules, palette) {
  const [fighterGltf, raiderGltf, turretGltf] = await Promise.all([fighterUrl, raiderUrl, turretUrl].map(loadModel));
  const S = config.models.scale;
  const fighter = prepare(fighterGltf, { scale: S.fighter, yaw: config.models.fighterYaw, nozzleName: 'nozzle', tint: '#e8eef8', metal: 0.55, rough: 0.35 });
  const raider = prepare(raiderGltf, { scale: S.raider, yaw: config.models.raiderYaw, nozzleName: 'nozzle', tint: '#b8a8a0', metal: 0.5, rough: 0.4, emissive: '#ff6040' });
  // prepare() turns the named part to +Z (the tail, for ships); for the turret that puts the muzzle on +Z, which lookAt() aims.
  const turret = prepare(turretGltf, { scale: S.turret, yaw: null, nozzleName: 'muzzle', tint: '#a8b0c0', metal: 0.5, rough: 0.45, emissive: '#ff6040' });
  const bracketMat = new THREE.MeshStandardMaterial({ color: '#2a3140', metalness: 0.6, roughness: 0.5 });

  // ---- the player's fighter
  const ship = new THREE.Group();
  ship.add(fighter.inner);
  const L = fighter.size;
  const engines = [-0.55, 0.55].map((x) => {
    const g = new THREE.Group();
    g.position.set(x * L.x * 0.22, 0.05 * L.y, L.z * 0.48);
    const core = sprite(palette.engine, 0.8, 0.9);
    const plume = sprite(palette.engine, 1.6, 0.3);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.engine).multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = 0.8;
    g.add(core, plume, cone);
    ship.add(g);
    return { g, core, plume, cone };
  });
  // Wingtip running lights.
  const tipL = sprite('#ff5a4a', 0.7);
  const tipR = sprite('#7dff9a', 0.7);
  tipL.position.set(-L.x * 0.48, 0.1, L.z * 0.1);
  tipR.position.set(L.x * 0.48, 0.1, L.z * 0.1);
  ship.add(tipL, tipR);
  // Lights the floor and walls around the ship, not the hull (it sits well behind and below).
  const shipLight = new THREE.PointLight(palette.engine, 30, 18, 1.6);
  shipLight.position.set(0, -1.5, L.z * 0.5 + 3);
  ship.add(shipLight);
  ship.userData.update = (dt, s, time) => {
    const boost = s.boosting ? 1 : 0;
    for (const e of engines) {
      const f = 1 + Math.sin(time * 60 + e.g.position.x * 10) * 0.08;
      e.core.scale.setScalar((0.8 + boost * 0.4) * f);
      e.plume.scale.setScalar((1.5 + boost * 1.6) * f);
      e.cone.scale.set(1 + boost * 0.4, 1 + boost * 1.6, 1 + boost * 0.4);
      e.cone.position.z = 0.8 + boost * 1.2;
    }
    const blink = Math.sin(time * 7) > 0.6 ? 1 : 0.25;
    tipL.material.opacity = blink;
    tipR.material.opacity = blink;
    shipLight.intensity = 30 + boost * 30;
  };

  // ---- enemies
  const enemy = (e) => {
    const g = new THREE.Group();
    if (e.kind === 'craft') {
      const body = raider.inner.clone();
      body.rotation.y += Math.PI; // nose toward the player (+Z)
      g.add(body);
      const R = raider.size;
      for (const x of [-0.18, 0.18]) {
        const s = sprite(palette.enemyEngine, 2.2, 0.9);
        s.position.set(x * R.x, 0, -R.z * 0.5);
        g.add(s);
      }
      const eye = sprite('#ffb070', 1.1);
      eye.position.set(0, 0.2, R.z * 0.45);
      g.add(eye);
      const mat = raider.mat.clone();
      body.traverse((o) => { if (o.isMesh) o.material = mat; });
      g.userData.update = (dt, en, time, s) => {
        // Face the ship, bank with sideways motion.
        g.lookAt(s.position.x, s.position.y, s.position.z + 30);
        g.rotateZ(Math.sin(time * 1.3 + en.phase) * 0.35);
        mat.emissiveIntensity = g.userData.hitT > 0 ? 2.5 : 0.1;
      };
    } else if (e.kind === 'turret') {
      const body = turret.inner.clone(); // muzzle toward +Z
      const mat = turret.mat.clone();
      body.traverse((o) => { if (o.isMesh) o.material = mat; });
      // Upright on a bracket out of the wall; it turns to track the ship.
      const yawG = new THREE.Group();
      yawG.add(body);
      g.add(yawG);
      const h = turret.size.y;
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 5.5), bracketMat);
      bracket.position.set(e.side * 0.9, -h / 2 - 0.45, 0);
      g.add(bracket);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.5, 0.9), bracketMat);
      strut.position.set(e.side * 2.6, -h / 2 - 2.2, 0);
      strut.rotation.z = e.side * 0.6;
      g.add(strut);
      const lamp = sprite('#ff6a3a', 2.4, 0.9);
      lamp.position.set(-e.side * 1.6, -h / 2 - 0.5, 0);
      g.add(lamp);
      const look = new THREE.Vector3();
      g.userData.update = (dt, en, time, s) => {
        yawG.lookAt(look.set(s.position.x, en.pos.y, s.position.z));
        mat.emissiveIntensity = g.userData.hitT > 0 ? 2.5 : 0;
        lamp.material.opacity = 0.5 + 0.5 * Math.sin(time * 5 + en.id);
      };
    } else {
      // Boss parts are drawn by the boss group; nothing per part.
      return null;
    }
    return g;
  };

  // ---- girders across the trench
  const barMat = new THREE.MeshStandardMaterial({ color: '#3a4254', metalness: 0.6, roughness: 0.4 });
  const warnMat = hdr('#ff8a3a', 3);
  const bar = (b) => {
    const g = new THREE.Group();
    const w = config.trench.halfWidth * 2 + 6;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, 4), barMat);
    g.add(beam);
    for (const y of [b.h / 2 + 0.05, -b.h / 2 - 0.05]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w - 4, 0.18, 0.4), warnMat);
      strip.position.set(0, y, 2.05);
      g.add(strip);
    }
    for (let x = -w / 2 + 4; x < w / 2; x += 6) {
      const l = sprite('#ffa060', 1.6, 0.8);
      l.position.set(x, 0, 2.2);
      g.add(l);
    }
    g.position.set(0, b.y, b.z);
    return g;
  };

  // ---- the reactor heart
  const boss = (B) => {
    const R = rules.boss;
    const g = new THREE.Group();
    g.position.copy(B.center);
    const hw = config.trench.halfWidth;
    const floorY = config.trench.floor - B.center.y;
    // The bulkhead closing the trench, with a round aperture.
    const shape = new THREE.Shape();
    shape.moveTo(-hw - 30, floorY);
    shape.lineTo(hw + 30, floorY);
    shape.lineTo(hw + 30, 90);
    shape.lineTo(-hw - 30, 90);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 15, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: false, curveSegments: 40 });
    wallGeo.translate(0, 0, -14);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#232a38', metalness: 0.5, roughness: 0.5 });
    g.add(new THREE.Mesh(wallGeo, wallMat));
    // Glowing rim of the aperture.
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(15, 0.5, 8, 64), hdr(palette.core, 3));
    rimRing.position.z = -5.8;
    g.add(rimRing);
    // The spinning cage that carries the nodes.
    const cage = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: '#4a5468', metalness: 0.7, roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(12.2, 1.1, 10, 48), ringMat);
    cage.add(ring);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.2, 24, 1.2), ringMat);
      spoke.rotation.z = (i / 4) * Math.PI + Math.PI / 4;
      spoke.position.z = -2;
      cage.add(spoke);
    }
    g.add(cage);
    // Nodes: armoured pods with a hot eye.
    const podMat = new THREE.MeshStandardMaterial({ color: '#5a6274', metalness: 0.65, roughness: 0.35, emissive: '#ff6a2a', emissiveIntensity: 0 });
    const nodes = B.nodes.map((n) => {
      const pod = new THREE.Group();
      pod.position.copy(n.pos).sub(B.center);
      const shell = new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), podMat.clone());
      shell.scale.set(1, 1, 0.8);
      pod.add(shell);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), hdr('#ff7a30', 4));
      eye.position.z = 2.2;
      pod.add(eye);
      const halo = sprite('#ff7a30', 7, 0.7);
      halo.position.z = 2.6;
      pod.add(halo);
      g.add(pod);
      return { pod, shell, halo, n };
    });
    // The core behind four shutters.
    const coreMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, heat: { value: 0 }, colA: { value: new THREE.Color(palette.core) }, colB: { value: new THREE.Color('#ff3a10') } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float time, heat; uniform vec3 colA, colB; varying vec3 vN; varying vec3 vP;
        void main(){ float f = pow(1.0 - abs(vN.z), 2.0); float b = 0.5 + 0.5 * sin(vP.y * 3.0 + time * 4.0) * sin(vP.x * 2.0 - time * 3.0);
          vec3 c = mix(colB, colA, b) * (2.0 + heat * 3.0) + colA * f * 3.0; gl_FragColor = vec4(c, 1.0); }`,
      toneMapped: false,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(R.coreRadius, 32, 20), coreMat);
    core.position.z = R.coreZ;
    g.add(core);
    const coreHalo = sprite(palette.core, 14, 0.4);
    coreHalo.position.z = R.coreZ + 1;
    g.add(coreHalo);
    const coreLight = new THREE.PointLight(palette.core, 500, 80, 1.5);
    coreLight.position.z = R.coreZ + 8;
    g.add(coreLight);
    const shutterMat = new THREE.MeshStandardMaterial({ color: '#3a4254', metalness: 0.7, roughness: 0.35 });
    const shutters = [0, 1, 2, 3].map((i) => {
      const piv = new THREE.Group();
      piv.rotation.z = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.2, 2, 4, 1, false, -Math.PI / 4, Math.PI / 2), shutterMat);
      leaf.rotation.x = Math.PI / 2;
      piv.add(leaf);
      piv.position.z = R.coreZ + 5.2;
      g.add(piv);
      return { piv, leaf };
    });
    let open = 0;
    let dieT = 0;
    g.userData.update = (dt, b, time) => {
      if (!b) return;
      cage.rotation.z += dt * 0.25;
      ring.rotation.z = 0;
      for (const N of nodes) {
        if (!N.n.alive) {
          N.pod.visible = false;
          continue;
        }
        N.shell.rotation.z += dt * 0.6;
        N.shell.material.emissiveIntensity = N.n.boss && b.t >= 0 && N.n.hp < R.nodeHp ? 0.25 * (1 - N.n.hp / R.nodeHp) * (1 + Math.sin(time * 12)) : 0;
        N.halo.material.opacity = 0.55 + 0.25 * Math.sin(time * 4 + N.pod.position.x);
      }
      if (b.open) open = Math.min(1, open + dt * 0.8);
      for (const s of shutters) s.leaf.position.y = 0;
      shutters.forEach((s) => {
        s.piv.scale.setScalar(1 - open * 0.9);
        s.piv.position.z = R.coreZ + 5.2 + open * 2;
      });
      coreMat.uniforms.time.value = time;
      coreMat.uniforms.heat.value = b.open ? 0.4 + 0.3 * Math.sin(time * 6) : 0;
      coreLight.intensity = 400 + open * 900 + Math.sin(time * 5) * 100;
      coreHalo.scale.setScalar(14 + open * 10);
      if (b.dead || g.userData.dead) {
        dieT += dt;
        core.visible = dieT < 0.2;
        coreHalo.scale.setScalar(24 + dieT * 120);
        coreHalo.material.opacity = Math.max(0, 0.9 - dieT * 0.45);
        coreLight.intensity = Math.max(0, 6000 * Math.exp(-dieT * 1.5));
        cage.rotation.z += dt * 2;
      }
    };
    return g;
  };

  return { ship, art: { enemy, bar, boss } };
}
