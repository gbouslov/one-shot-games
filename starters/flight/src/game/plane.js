import * as THREE from 'three';

/**
 * The aircraft: a two-seat low-wing sport plane, cream with a teal cheatline.
 * Built from lathe and extruded shapes so it has a real silhouette from any
 * angle: tapered wings with dihedral, a swept fin, a bubble canopy with a
 * pilot, wheel spats, a spinner and a prop disc that blurs with throttle.
 * Nose points down -Z; about 10 m span, 7.6 m long. Written for this repository.
 */
const CREAM = new THREE.Color('#efe5cf');
const TEAL = new THREE.Color('#1d5e66');
const DARK = new THREE.Color('#23272c');

function paint(geo, fn) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function surface(points, thickness, bevel = 0.04) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

export function buildPlane() {
  const g = new THREE.Group();
  g.name = 'plane';
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.12, envMapIntensity: 1.0 });
  const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.5, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b2c3a', roughness: 0.05, metalness: 0.9, envMapIntensity: 1.6, transparent: true, opacity: 0.86 });

  // Fuselage: a lathe from tail (-Y) to nose (+Y), turned so the nose is -Z.
  const prof = [
    [0.0, -4.1], [0.12, -4.0], [0.22, -3.6], [0.36, -2.6], [0.52, -1.3], [0.66, -0.1],
    [0.72, 1.0], [0.71, 2.0], [0.64, 2.8], [0.55, 3.25], [0.46, 3.45], [0.3, 3.5], [0.0, 3.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 28);
  fus.rotateX(-Math.PI / 2);
  fus.scale(0.92, 1.0, 1);
  paint(fus, (x, y, z, c) => {
    const stripe = Math.abs(y - 0.02 - (z > 0 ? z * 0.04 : 0)) < 0.09 && Math.abs(x) > 0.2;
    const cowl = z < -2.75;
    c.copy(cowl || stripe ? TEAL : CREAM);
    if (y < -0.45) c.multiplyScalar(0.94);
  });
  const fuselage = new THREE.Mesh(fus, body);
  g.add(fuselage);

  // Spinner and prop.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.62, 18), new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.25, metalness: 0.8 }));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -3.78;
  g.add(spinner);
  const blades = new THREE.Group();
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.04), dark);
    b.position.y = s * 0.55;
    b.rotation.y = s * 0.25;
    blades.add(b);
  }
  blades.position.z = -3.6;
  g.add(blades);
  const discTex = (() => {
    const n = 128;
    const d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x + 0.5) / n - 0.5;
        const dy = (y + 0.5) / n - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        const a = r > 1 ? 0 : (0.25 + 0.75 * Math.pow(r, 1.5)) * (r > 0.94 ? 2.2 : 1) * 0.5;
        const k = (y * n + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = 200;
        d[k + 3] = Math.min(255, Math.round(a * 255));
      }
    }
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  })();
  const discMat = new THREE.MeshBasicMaterial({ map: discTex, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, color: '#cfc8bb' });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.08, 40), discMat);
  disc.position.z = -3.62;
  g.add(disc);

  // Wings: tapered planform, extruded thin, with dihedral. Shape x = span, y = forward.
  const wingPts = [[0, 0.8], [2.4, 0.66], [4.6, 0.5], [5.05, 0.3], [5.15, 0.0], [5.0, -0.42], [4.6, -0.5], [0, -0.95]];
  for (const side of [1, -1]) {
    const geo = surface(wingPts.map(([x, y]) => [x * side, y]), 0.14, 0.05);
    geo.rotateX(-Math.PI / 2);
    paint(geo, (x, y, z, c) => c.copy(Math.abs(x) > 4.25 ? TEAL : CREAM));
    const w = new THREE.Mesh(geo, body);
    w.position.set(0, -0.42, -0.55);
    w.rotation.z = side * THREE.MathUtils.degToRad(5);
    g.add(w);
  }

  // Horizontal tail.
  const stabPts = [[0, 0.45], [1.6, 0.25], [1.85, 0.0], [1.7, -0.35], [0, -0.5]];
  for (const side of [1, -1]) {
    const geo = surface(stabPts.map(([x, y]) => [x * side, y]), 0.08, 0.03);
    geo.rotateX(-Math.PI / 2);
    paint(geo, (x, y, z, c) => c.copy(CREAM));
    const s = new THREE.Mesh(geo, body);
    s.position.set(0, 0.12, 3.55);
    g.add(s);
  }
  // Fin: shape x = rearward, y = up.
  const finGeo = surface([[-0.5, 0], [0.75, 0], [0.82, 1.55], [0.35, 1.6], [-0.1, 0.5]], 0.09, 0.03);
  finGeo.rotateY(-Math.PI / 2);
  paint(finGeo, (x, y, z, c) => c.copy(y > 1.05 ? CREAM : TEAL));
  const fin = new THREE.Mesh(finGeo, body);
  fin.position.set(0, 0.25, 3.15);
  g.add(fin);

  // Canopy and pilot.
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  can.scale.set(1.0, 0.95, 2.3);
  can.position.set(0, 0.42, -0.1);
  g.add(can);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), dark);
  head.position.set(0, 0.62, 0.05);
  g.add(head);

  // Fixed gear with spats.
  for (const side of [1, -1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.22), dark);
    leg.position.set(side * 1.25, -0.82, -0.9);
    leg.rotation.z = side * 0.25;
    g.add(leg);
    const spat = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), body);
    paint(spat.geometry, (x, y, z, c) => c.copy(TEAL));
    spat.scale.set(0.85, 1.05, 2.3);
    spat.position.set(side * 1.42, -1.18, -0.9);
    g.add(spat);
  }

  g.traverse((o) => {
    if (o.isMesh && o !== disc) o.castShadow = true;
  });

  // Wingtip positions for trails, in plane space.
  g.userData.tips = [new THREE.Vector3(5.1, -0.0, -0.4), new THREE.Vector3(-5.1, -0.0, -0.4)];
  g.userData.update = (dt, throttle) => {
    blades.rotation.z += (8 + throttle * 60) * dt;
    blades.visible = throttle < 0.25;
    discMat.opacity = 0.12 + throttle * 0.3;
    disc.rotation.z += 30 * dt;
  };
  return g;
}
