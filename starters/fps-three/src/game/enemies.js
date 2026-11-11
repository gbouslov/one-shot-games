import * as THREE from 'three';

/**
 * Two examples: something that walks up and hits you, something that floats and
 * spits. Replace the models and numbers. Models are plain code with feet at y=0.
 */

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05, emissive: '#000000', ...extra });
}

function buildWalker() {
  const g = new THREE.Group();
  const body = mat('#54606b');
  const trim = mat('#2a2f36');
  const eye = mat('#1a0a06', { emissive: '#ffb04a', emissiveIntensity: 4 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 4, 12), body);
  torso.position.y = 1.08;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), trim);
  head.position.y = 1.62;
  g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.08), eye);
  visor.position.set(0, 1.63, 0.17);
  g.add(visor);

  const limb = (x, y, len, m) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, len, 3, 8), m);
    mesh.position.y = -len / 2 - 0.05;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  };
  g.userData.legL = limb(-0.16, 0.74, 0.56, trim);
  g.userData.legR = limb(0.16, 0.74, 0.56, trim);
  g.userData.armL = limb(-0.42, 1.36, 0.56, body);
  g.userData.armR = limb(0.42, 1.36, 0.56, body);
  g.userData.torso = torso;
  return g;
}

function animateWalker(e, dt, t) {
  const u = e.model.userData;
  const stride = e.moved > 0.2 ? Math.sin(t * 9) * 0.75 : 0;
  u.legL.rotation.x = stride;
  u.legR.rotation.x = -stride;
  let raise = 0;
  if (e.state === 'windup') raise = -2.3;
  else if (e.state === 'strike') raise = -0.7;
  else if (e.state === 'stagger') raise = 0.5;
  const armTarget = raise || -stride * 0.6;
  u.armL.rotation.x += (armTarget - u.armL.rotation.x) * Math.min(1, dt * 16);
  u.armR.rotation.x += (armTarget - u.armR.rotation.x) * Math.min(1, dt * 16);
  u.torso.rotation.x = e.state === 'stagger' ? -0.3 : e.moved > 0.2 ? 0.1 : 0;
}

function buildSpitter() {
  const g = new THREE.Group();
  const shell = mat('#6b4a5f');
  const core = mat('#180808', { emissive: '#ff5a3a', emissiveIntensity: 5 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 2), shell);
  orb.position.y = 0.55;
  g.add(orb);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), core);
  eye.position.set(0, 0.56, 0.37);
  g.add(eye);
  g.userData.orb = orb;
  return g;
}

function animateSpitter(e, dt, t) {
  e.model.position.y += Math.sin(t * 2.6) * 0.12;
  const s = e.state === 'windup' ? 1.18 : 1;
  const o = e.model.userData.orb;
  o.scale.setScalar(o.scale.x + (s - o.scale.x) * Math.min(1, dt * 12));
  o.rotation.y = t * 0.8;
}

function spitBall() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a50').multiplyScalar(4), toneMapped: false })
  );
}

export const enemies = [
  {
    id: 'walker', hp: 80, speed: 3.5, radius: 0.42, height: 1.84, headFrom: 0.8, stagger: 0.14,
    blood: '#ffb04a', spawnColor: '#ffb04a', hitColor: 0xffc58a, telegraphHz: 150,
    attack: { kind: 'melee', range: 1.7, damage: 10, windup: 0.42, cooldown: 1.3, recover: 0.28 },
    build: buildWalker, animate: animateWalker,
  },
  {
    id: 'spitter', hp: 55, speed: 2.8, radius: 0.5, height: 1.1, headFrom: 0.7, stagger: 0.08, hover: 1.0,
    blood: '#ff6a48', spawnColor: '#ff6a48', hitColor: 0xffa58a, telegraphHz: 260,
    attack: { kind: 'ranged', range: 17, keepAway: 10, damage: 8, windup: 0.6, cooldown: 2.1, recover: 0.2,
      projectile: { speed: 15, gravity: 0, radius: 0.15, life: 4, color: '#ff7a50', build: spitBall, trail: { color: '#ff7a50', size: 0.13 } } },
    build: buildSpitter, animate: animateSpitter,
  },
];
