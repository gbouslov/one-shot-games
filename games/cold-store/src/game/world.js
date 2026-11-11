import * as THREE from 'three';
import { assets } from '../assets/index.js';

/**
 * Cold Store: a frozen-food distribution hall at night, power out.
 *
 * Layout (x east, z south; the player starts at the south end looking north up an aisle):
 *   four double racks run north-south, 7.2 m tall, with aisles between them
 *   north wall: the loading dock, two roller doors with red strobes
 *   south-east corner: the guard hut, its window lit
 *   roof at 9 m on steel trusses, with skylight strips letting moonlight in
 * The player's flashlight is the main light.
 */
const HX = 20;
const HZ = 15;
const ROOF = 9;

function metreBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return g;
}

export function buildWorld(ctx) {
  const physics = ctx.get('physics');
  // Rack tops (7.2 m) are not floor: probe for ground from 3.5 m down (kit: physics.probeY).
  physics.probeY = 3.5;
  const scene = ctx.scene;
  const kit = ctx.get('materials');

  const block = (material, [x, y, z], [w, h, d], { surface = 'concrete', solid = true, shadow = true, rotY = 0 } = {}) => {
    const mesh = new THREE.Mesh(metreBox(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) physics.addStatic(mesh, surface);
    return mesh;
  };
  const collider = ([x, y, z], [w, h, d], surface = 'metal') => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
    c.position.set(x, y, z);
    c.visible = false;
    scene.add(c);
    physics.addStatic(c, surface);
  };
  const prop = (id, xyz, o = {}) => assets.place(ctx, id, { at: xyz, surface: o.surface ?? 'metal', ...o });

  // ---- instanced detail ---------------------------------------------------------------
  const lots = new Map();
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const P = new THREE.Vector3();
  const E = new THREE.Euler();
  const put = (key, geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true } = {}) => {
    if (!lots.has(key)) lots.set(key, { geo, mat, shadow, list: [] });
    lots.get(key).list.push(M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)).clone());
  };

  // ---- materials ---------------------------------------------------------------------
  const floor = assets.material('painted_concrete', { size: [1, 1], tint: '#8c9294', roughness: 0.55 });
  const cladding = assets.material('corrugated_iron', { size: [1, 1], tint: '#9aa3ad' });
  const plaster = assets.material('plastered_wall_02', { size: [1, 1], tint: '#c8ccd0' });
  const rust = assets.material('rusty_metal_02', { size: [1, 1], tint: '#7a6a62' });
  const tread = assets.material('metal_plate', { size: [1, 1] });
  // painted steel with chips and rust coming through: the rust scan, tinted to the paint
  const upright = assets.material('rusty_metal_02', { size: [0.6, 3], tint: '#4f7fd0', roughness: 0.55 });
  const beam = assets.material('rusty_metal_02', { size: [3, 0.6], tint: '#ff8a3a', roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: '#4a4e54', roughness: 0.5, metalness: 0.8 });
  const wood = assets.material('weathered_planks', { size: [1, 1], tint: '#b8a184' });
  const wrap = new THREE.MeshPhysicalMaterial({ color: '#8a96a2', roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.13, depthWrite: false });
  const carton = assets.material('Cardboard001', { size: [1, 1], tint: '#c2a47e' });
  // varied loads: kraft, white printed stock, blue freezer cartons, red-banded meat cases
  const cartons = [carton,
    assets.material('Cardboard001', { size: [1, 1], tint: '#e4e2da' }),
    assets.material('Cardboard001', { size: [1, 1], tint: '#7f9cc4' }),
    assets.material('Cardboard001', { size: [1, 1], tint: '#c46a52' })];
  const frost = new THREE.MeshStandardMaterial({ color: '#e6f0ff', roughness: 0.35, metalness: 0, transparent: true, opacity: 0.55 });

  // ---- shell ------------------------------------------------------------------------
  block(floor, [0, -0.1, 0], [2 * HX + 2, 0.2, 2 * HZ + 2]);
  // painted floor lines along the aisles
  const lineMat = new THREE.MeshStandardMaterial({ color: '#d8b02a', roughness: 0.6 });
  for (const x of [-9.2, -0.8, 7.6, -16, 15]) put('line', new THREE.BoxGeometry(0.12, 0.01, 1), lineMat, x, 0.005, -1, { sz: 22, shadow: false });
  put('line', new THREE.BoxGeometry(1, 0.01, 0.12), lineMat, 0, 0.005, -11.6, { sx: 36, shadow: false });

  // walls: corrugated cladding over a 1.2 m concrete upstand
  const walls = [[0, -HZ, 2 * HX, 0], [0, HZ, 2 * HX, Math.PI], [-HX, 0, 2 * HZ, Math.PI / 2], [HX, 0, 2 * HZ, -Math.PI / 2]];
  for (const [x, z, len, r] of walls) {
    const nx = Math.round(Math.sin(r) * 10) / 10;
    const nz = Math.round(Math.cos(r) * 10) / 10;
    block(cladding, [x - nx * 0.2, ROOF / 2, z - nz * 0.2], [Math.abs(nz) > 0.5 ? len : 0.3, ROOF, Math.abs(nx) > 0.5 ? len : 0.3], { surface: 'metal' });
    block(plaster, [x + nx * 0.02, 0.6, z + nz * 0.02], [Math.abs(nz) > 0.5 ? len : 0.3, 1.2, Math.abs(nx) > 0.5 ? len : 0.3], { shadow: false });
  }
  // wall columns every 5 m
  for (let x = -HX + 2.5; x < HX; x += 5) for (const z of [-HZ + 0.25, HZ - 0.25]) put('col', metreBox(0.3, ROOF, 0.3), steel, x, ROOF / 2, z);
  for (let z = -HZ + 2.5; z < HZ; z += 5) for (const x of [-HX + 0.25, HX - 0.25]) put('col', metreBox(0.3, ROOF, 0.3), steel, x, ROOF / 2, z);

  // roof: panels with three skylight gaps, on trusses; moonlight comes through the gaps
  const sky = [-8, 0, 8];
  let z0 = -HZ - 0.5;
  for (const sz of [...sky, HZ + 0.5]) {
    const z1 = sz === HZ + 0.5 ? sz : sz - 0.9;
    if (z1 > z0) block(cladding, [0, ROOF + 0.1, (z0 + z1) / 2], [2 * HX + 1, 0.15, z1 - z0], { solid: false, surface: 'metal' });
    z0 = sz + 0.9;
  }
  for (const sz of sky) {
    // skylight glazing: faintly visible, light passes (no shadow)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * HX, 0.03, 1.8), new THREE.MeshStandardMaterial({ color: '#203040', transparent: true, opacity: 0.25, roughness: 0.1 }));
    glass.position.set(0, ROOF + 0.12, sz);
    scene.add(glass);
  }
  for (let x = -HX + 2.5; x < HX; x += 5) {
    put('truss', metreBox(0.18, 0.3, 2 * HZ), steel, x, ROOF - 0.15, 0);
    put('truss', metreBox(0.12, 0.12, 2 * HZ), steel, x, ROOF - 1.4, 0);
    for (let z = -HZ + 1; z < HZ; z += 2) put('web', metreBox(0.06, 1.5, 0.06), steel, x, ROOF - 0.78, z, { rx: (z % 4 === 1 ? 1 : -1) * 0.55 });
  }
  for (let z = -HZ + 1.5; z < HZ; z += 3) put('purlin', metreBox(2 * HX, 0.14, 0.1), steel, 0, ROOF - 0.08, z);

  // ---- racking: four double runs, 7.2 m, three beam levels --------------------------
  const RACK_X = [-13, -4.6, 3.8, 12.2];
  const BAY = 2.8;
  const RZ0 = -10;
  const BAYS = 7;
  const levels = [0.0, 2.35, 4.7];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const rx of RACK_X) {
    for (let b = 0; b <= BAYS; b++) {
      const z = RZ0 + b * BAY;
      for (const dx of [-1.15, -0.05, 0.05, 1.15]) put('upright', metreBox(0.09, 7.2, 0.09), upright, rx + dx, 3.6, z);
      // bracing between front and back uprights
      for (let y = 0.8; y < 7; y += 1.6) for (const side of [-0.6, 0.6]) put('brace', metreBox(1.0, 0.04, 0.04), upright, rx + side, y, z, { rz: 0.5 });
    }
    collider([rx, 3.6, RZ0 + (BAYS * BAY) / 2], [2.4, 7.2, BAYS * BAY + 0.1]);
    for (let b = 0; b < BAYS; b++) {
      const zc = RZ0 + b * BAY + BAY / 2;
      for (const ly of levels) {
        if (ly > 0) for (const side of [-1.15, 1.15]) put('beam', metreBox(0.08, 0.14, BAY - 0.1), beam, rx + side, ly, zc);
        // two pallet positions per side per level
        for (const side of [-0.6, 0.6]) for (const off of [-0.66, 0.66]) {
          const r = rnd();
          if (ly === 0 && r < 0.2) continue;
          if (r < 0.08) continue;
          const y = ly + (ly > 0 ? 0.07 : 0);
          put('pallet', metreBox(1.0, 0.14, 1.1), wood, rx + side, y + 0.07, zc + off);
          const h = 0.9 + rnd() * 1.0;
          const wrapped = rnd() < 0.55;
          const sx = 0.92 + rnd() * 0.08;
          const ci = Math.floor(rnd() * 4);
          put(`load${ci}`, metreBox(0.96, 1, 1.04), cartons[ci], rx + side, y + 0.14 + h / 2, zc + off, { sy: h, sx });
          if (wrapped) put('load-wrap', metreBox(0.99, 1, 1.07), wrap, rx + side, y + 0.14 + h / 2 + 0.01, zc + off, { sy: h + 0.02, sx, shadow: false });
          if (rnd() < 0.3) put('frost', metreBox(1.0, 0.04, 1.08), frost, rx + side, y + 0.14 + h + 0.02, zc + off, { shadow: false });
        }
      }
    }
    // end-of-run guard posts, yellow
    for (const z of [RZ0 - 0.4, RZ0 + BAYS * BAY + 0.4]) for (const dx of [-1, 1]) put('bollard', new THREE.CylinderGeometry(0.1, 0.1, 1.1, 12), lineMat, rx + dx, 0.55, z);
  }

  // ---- loading dock: two roller doors with strobes ----------------------------------
  const doorMat = assets.material('corrugated_iron', { size: [1, 1], tint: '#b0a48a' });
  const strobes = [];
  for (const x of [-9, 9]) {
    block(doorMat, [x, 2.4, -HZ + 0.15], [4.6, 4.8, 0.12], { solid: false, surface: 'metal' });
    block(steel, [x, 5.0, -HZ + 0.3], [5.2, 0.5, 0.5], { solid: false });
    for (const s of [-1, 1]) put('doorjamb', metreBox(0.2, 5, 0.3), lineMat, x + s * 2.4, 2.5, -HZ + 0.3);
    // dock bumpers
    for (const s of [-1, 1]) block(kit.get('rubber', { tint: '#151515' }), [x + s * 1.6, 0.6, -HZ + 0.45], [0.4, 0.5, 0.25], { solid: false });
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 16), new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 4 }));
    housing.position.set(x + 2.8, 5.2, -HZ + 0.35);
    scene.add(housing);
    const s = new THREE.SpotLight('#ff2a1a', 110, 34, 0.32, 0.45, 1.3);
    s.position.set(x + 2.8, 5.2, -HZ + 0.45);
    scene.add(s, s.target);
    strobes.push({ s, x: x + 2.8 });
  }
  // the dock area: a pallet truck, stacked empties, a cart of cartons
  prop('pallet_b01', [-5.2, 0, -12.6], { rotY: 0.2, surface: 'wood' });
  for (let i = 1; i < 7; i++) prop('pallet_b01', [-5.2 + Math.sin(i) * 0.03, i * 0.21, -12.6], { rotY: 0.2 + Math.sin(i * 2.1) * 0.05, surface: 'wood', solid: false });
  for (const [x, z, r, n] of [[1.2, -12.8, 0.1, 4], [5.6, -12.2, -0.3, 3], [14.5, -12.6, 0.4, 4], [-15.6, -12.4, 0.05, 4]]) {
    prop('pallet_b01', [x, 0, z], { rotY: r, surface: 'wood' });
    const spots = [[-0.3, 0, -0.25], [0.3, 0, -0.25], [-0.3, 0, 0.25], [0.3, 0.52, -0.25]];
    for (let i = 0; i < n; i++) {
      const [bx, by, bz] = spots[i];
      const c = Math.cos(r);
      const s = Math.sin(r);
      prop(i % 2 ? 'box_cardboard_a02' : 'box_cardboard_a01', [x + bx * c + bz * s, 0.21 + by, z - bx * s + bz * c], { rotY: r + (i % 2) * Math.PI / 2, scale: 0.85, surface: 'wood', solid: i === 0 });
    }
  }

  // ---- guard hut, south-east corner -------------------------------------------------
  const HUTX = 16.5;
  const HUTZ = 12;
  block(plaster, [HUTX, 1.4, HUTZ - 2.4], [6.6, 2.8, 0.2]); // front wall
  block(plaster, [HUTX - 3.2, 1.4, HUTZ], [0.2, 2.8, 4.8]); // side wall
  block(tread, [HUTX, 2.9, HUTZ], [6.8, 0.2, 5]);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshStandardMaterial({ color: '#1a1006', emissive: '#ffb35a', emissiveIntensity: 2.4 }));
  win.position.set(HUTX + 0.6, 1.6, HUTZ - 2.51);
  win.rotation.y = Math.PI;
  scene.add(win);
  const hutLight = new THREE.PointLight('#ffb35a', 14, 9, 2);
  hutLight.position.set(HUTX + 0.6, 1.9, HUTZ - 3.4);
  scene.add(hutLight);
  prop('utility_box_02', [HUTX - 3.5, 0, HUTZ + 0.6], { rotY: -Math.PI / 2 });
  prop('korean_fire_extinguisher_01', [HUTX - 3.55, 0, HUTZ - 1.4], { rotY: -Math.PI / 2, solid: false });
  prop('folding_wooden_stool', [HUTX - 1.6, 0, HUTZ - 3.2], { rotY: 0.6, surface: 'wood' });
  prop('medical_box', [HUTX - 1.0, 0, HUTZ - 3.0], { rotY: 0.2, solid: false });
  prop('metal_tool_chest', [HUTX + 2.6, 0, HUTZ - 2.85], { rotY: Math.PI });

  // ---- clutter along the walls and the aisle ends ----------------------------------
  prop('steel_frame_shelves_01', [-HX + 0.7, 0, 6], { rotY: Math.PI / 2 });
  prop('steel_frame_shelves_01', [-HX + 0.7, 0, 9.2], { rotY: Math.PI / 2 });
  for (const [x, z, r] of [[-HX + 0.7, 7.6, 0.2], [-HX + 0.8, 11.5, 1.1]]) prop('cardboard_box_01', [x, 0, z], { rotY: r, surface: 'wood' });
  for (const [x, z, r] of [[HX - 0.7, -6, 0.3], [HX - 0.8, -5.2, 1.4], [HX - 1.2, -5.7, 2.2]]) prop('Barrel_01', [x, 0, z], { rotY: r });
  prop('propane_tank', [HX - 0.5, 0, 2.2], { rotY: 0.4 });
  prop('propane_tank', [HX - 0.5, 0, 2.7], { rotY: 1.3 });
  prop('utility_box_02', [-HX + 0.25, 0, -8], { rotY: Math.PI / 2 });
  prop('korean_fire_extinguisher_01', [-0.4, 0, 9.4], { rotY: Math.PI, solid: false });
  prop('korean_fire_extinguisher_01', [8.0, 0, -10.6], { rotY: 0, solid: false });
  for (const [x, z, r] of [[-9.0, 10.6, 0.3], [-1.2, 11.4, -0.4], [-17, 1.6, 1.0]]) {
    prop('pallet_b01', [x, 0, z], { rotY: r, surface: 'wood' });
    prop('box_cardboard_a01', [x, 0.21, z], { rotY: r, scale: 0.85, surface: 'wood' });
  }
  prop('cardboard_box_01', [7.0, 0, 10.8], { rotY: 0.5, surface: 'wood' });
  prop('cardboard_box_01', [7.4, 0, 11.3], { rotY: 1.1, surface: 'wood' });
  prop('cardboard_box_01', [7.2, 0.34, 11.0], { rotY: 0.2, surface: 'wood', solid: false });

  // security lights on the walls, dead except one
  for (const [x, y, z, r] of [[-HX + 0.2, 6.5, -4, Math.PI / 2], [HX - 0.2, 6.5, 4, -Math.PI / 2], [0, 6.5, HZ - 0.2, Math.PI]]) prop('security_light', [x, y, z], { rotY: r, solid: false });

  // ---- hanging sodium lamps, one per aisle, flickering ------------------------------
  const lampOn = new THREE.MeshStandardMaterial({ color: '#2a1606', emissive: '#ffb35a', emissiveIntensity: 5 });
  const lamps = [];
  for (const [x, z] of [[-8.8, -4], [-0.4, 3], [8.0, -6.5], [16.2, 1]]) {
    put('lampwire', new THREE.CylinderGeometry(0.008, 0.008, 1, 4), steel, x, ROOF - 1.1, z, { sy: 2.2, shadow: false });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 18, 1, true), steel);
    shade.position.set(x, ROOF - 2.3, z);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lampOn);
    bulb.position.set(x, ROOF - 2.42, z);
    scene.add(bulb);
    const l = new THREE.PointLight('#ffb35a', 26, 17, 1.7);
    l.position.set(x, ROOF - 2.6, z);
    scene.add(l);
    lamps.push({ l, bulb, ph: x * 1.7 + z });
  }

  // ---- the flashlight: a spot glued to the camera -----------------------------------
  const torch = new THREE.SpotLight('#f4f1ea', 30, 30, 0.4, 0.5, 0.6);
  torch.castShadow = true;
  torch.shadow.mapSize.set(1024, 1024);
  torch.shadow.bias = -0.0004;
  torch.shadow.camera.near = 0.3;
  scene.add(torch, torch.target);
  // the beam itself: a faint additive cone through the cold air, densest a few metres out
  const BEAM = 9;
  const torchBeam = new THREE.Mesh(
    new THREE.ConeGeometry(Math.tan(0.3) * BEAM, BEAM, 40, 1, true).translate(0, -BEAM / 2, 0),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { color: { value: new THREE.Color('#cfdcff') } },
      vertexShader: 'varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = -position.y / 9.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float d = clamp(vD, 0.0, 1.0); float along = smoothstep(0.0, 0.3, d) * pow(max(1.0 - d, 0.0), 1.6); float edge = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5); gl_FragColor = vec4(color * along * (0.025 + 0.06 * edge), 1.0); }',
    }),
  );
  torchBeam.frustumCulled = false;
  torchBeam.renderOrder = 10;
  scene.add(torchBeam);
  const DOWN = new THREE.Vector3(0, -1, 0);
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  // ---- signs: aisle numbers, dock numbers, rack bays ---------------------------------
  const signMat = (text, { w = 512, h = 160, bg = '#e8e4d8', fg = '#16191d', size = 92, glow = 0.18 } = {}) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `700 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: glow });
  };
  const sign = (text, [x, y, z], [w, h], rotY = 0, o = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(text, o));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  };
  // aisle signs hang over the south end of each aisle, facing the player's side, both faces
  [[-16.6, '01'], [-8.8, '02'], [-0.4, '03'], [8.0, '04'], [16.0, '05']].forEach(([x, n]) => {
    for (const [z, r] of [[RZ0 + BAYS * BAY + 1.2, 0], [RZ0 - 1.2, Math.PI]]) {
      sign(`AISLE ${n}`, [x, 5.6, z], [1.9, 0.6], r, { bg: '#1d4f9a', fg: '#ffffff', glow: 0.35 });
      put('signwire', new THREE.CylinderGeometry(0.006, 0.006, 1, 4), steel, x - 0.8, 7.3, z, { sy: 3.1, shadow: false });
      put('signwire', new THREE.CylinderGeometry(0.006, 0.006, 1, 4), steel, x + 0.8, 7.3, z, { sy: 3.1, shadow: false });
    }
  });
  // bay codes on every rack end, low enough to read in the torch
  RACK_X.forEach((rx, i) => {
    sign(`R${i + 1} · BAY 01–07`, [rx, 3.05, RZ0 + BAYS * BAY + 0.06], [1.3, 0.34], 0, { bg: '#f2c230', size: 84 });
    sign(`R${i + 1} · BAY 07–01`, [rx, 3.05, RZ0 - 0.06], [1.3, 0.34], Math.PI, { bg: '#f2c230', size: 84 });
  });
  sign('DOCK 1', [-9, 5.8, -HZ + 0.36], [1.6, 0.5], 0, { bg: '#c9241b', fg: '#fff', glow: 0.4 });
  sign('DOCK 2', [9, 5.8, -HZ + 0.36], [1.6, 0.5], 0, { bg: '#c9241b', fg: '#fff', glow: 0.4 });
  sign('−22 °C  FROZEN GOODS · KEEP DOORS CLOSED', [0, 3.2, -HZ + 0.36], [4.2, 0.42], 0, { w: 1024, h: 104, size: 58, bg: '#e8e4d8' });
  sign('KESSLER COLD STORE · SECURITY', [HUTX, 2.55, HUTZ - 2.52], [3.0, 0.3], Math.PI, { w: 1024, h: 100, size: 60, bg: '#1d2430', fg: '#ffd27a', glow: 0.5 });

  // hazard stripes: dock edge and the forklift lane across the north end
  const stripeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#e8b81e';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#141414';
    for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const stripe = (x, z, w, d, along = 'x') => {
    const t = stripeTex.clone();
    t.needsUpdate = true;
    t.repeat.set((along === 'x' ? w : d) / 1.0, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(along === 'x' ? w : d, along === 'x' ? d : w).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
    if (along === 'z') m.rotation.y = Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  stripe(-9, -HZ + 1.0, 5.2, 0.32);
  stripe(9, -HZ + 1.0, 5.2, 0.32);
  stripe(0, -10.9, 34, 0.22);
  for (const x of [-9, 9]) for (const s2 of [-1, 1]) put('doorstripe', metreBox(0.22, 1.4, 0.06), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }), x + s2 * 2.4, 0.7, -HZ + 0.48, { rz: 0 });

  // ---- breakers: three tripped panels on three walls ------------------------------------
  const panelMat = new THREE.MeshStandardMaterial({ color: '#8b949c', roughness: 0.45, metalness: 0.6 });
  const lampOff = new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 6 });
  const lampLive = new THREE.MeshStandardMaterial({ color: '#030', emissive: '#4dff7a', emissiveIntensity: 6 });
  const breakers = [
    { id: 'A', where: 'WEST WALL', x: -HX + 0.55, z: 3.5, rot: Math.PI / 2 },
    { id: 'B', where: 'DOCK', x: 0, z: -HZ + 0.55, rot: 0 },
    { id: 'C', where: 'EAST WALL', x: HX - 0.55, z: -7.5, rot: -Math.PI / 2 },
  ].map((b) => {
    const grp = new THREE.Group();
    grp.position.set(b.x, 0, b.z);
    grp.rotation.y = b.rot;
    // wall-side origin: the panel sits against the wall at local z = -0.25
    const cab = new THREE.Mesh(metreBox(0.8, 1.1, 0.3), panelMat);
    cab.position.set(0, 1.45, -0.2);
    cab.castShadow = true;
    const door = new THREE.Mesh(metreBox(0.7, 1.0, 0.02), new THREE.MeshStandardMaterial({ color: '#b7bec4', roughness: 0.4, metalness: 0.5 }));
    door.position.set(0, 1.45, -0.04);
    const handle = new THREE.Mesh(metreBox(0.05, 0.2, 0.05), steel);
    handle.position.set(0.25, 1.45, -0.01);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), lampOff);
    lamp.position.set(0, 2.12, -0.12);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18), signMat(`BREAKER ${b.id}`, { w: 400, h: 120, size: 78, bg: '#f2c230', glow: 0.3 }));
    label.position.set(0, 1.8, -0.025);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }));
    plate.material.map.repeat.set(1, 1);
    plate.position.set(0, 0.013, 0.1);
    grp.add(cab, door, handle, lamp, label, plate);
    scene.add(grp);
    grp.updateMatrixWorld(true);
    physics.addStatic(cab, 'metal');
    const out = { id: b.id, where: b.where, x: b.x + Math.sin(b.rot) * 0.35, z: b.z + Math.cos(b.rot) * 0.35, on: false };
    out.set = (on) => {
      out.on = on;
      lamp.material = on ? lampLive : lampOff;
    };
    return out;
  });

  // the generator feeds the aisle lamps: steady and brighter once all 3 breakers are reset
  // (no new lights: every extra light costs every lit pixel on a weak GPU)
  let generatorOn = false;

  // Build the instanced detail.
  for (const { geo, mat, list, shadow } of lots.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = shadow;
    im.receiveShadow = true;
    scene.add(im);
  }
  assets.instance(ctx);

  assets.held(ctx, 'machete', 'machete', { rot: [0, Math.PI, 0], scale: 0.8, pos: [0, -0.05, 0] });

  // the weapon light: a rail-mounted torch at four o'clock on the SMG's handguard
  const smg = ctx.get('weapons').slots.find((sl) => sl.def.id === 'smg')?.vm?.group;
  if (smg) {
    const body = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.45, metalness: 0.7 });
    const torchGroup = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0115, 0.09, 24).rotateX(Math.PI / 2), body);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.0135, 0.022, 24).rotateX(Math.PI / 2), body);
    head.position.z = -0.05;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0135, 24), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#f4f6ff', emissiveIntensity: 9 }));
    lens.position.z = -0.0615;
    lens.rotation.y = Math.PI;
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.03), body);
    mount.position.set(-0.012, 0.012, 0);
    torchGroup.add(tube, head, lens, mount);
    torchGroup.position.set(0.026, 0.05, -0.2);
    smg.add(torchGroup);
  }

  return {
    breakers,
    generator(on) {
      generatorOn = on;
    },
    minimap: {
      rects: [
        ...RACK_X.map((rx) => [rx, RZ0 + (BAYS * BAY) / 2, 2.4, BAYS * BAY]),
        [HUTX, HUTZ, 6.6, 4.8],
        [-9, -HZ + 0.4, 4.6, 0.5], [9, -HZ + 0.4, 4.6, 0.5],
      ],
      walls: [[-HX, -HZ, HX, -HZ], [HX, -HZ, HX, HZ], [HX, HZ, -HX, HZ], [-HX, HZ, -HX, -HZ]],
    },
    playerSpawn: [8.5, 0.2, 12.6],
    playerYaw: 0.05,
    enemySpawns: [[-9, -13.6], [9, -13.6], [-17.5, -13], [17.5, -12], [-17, -4], [0, -13.5], [-8.8, -12.2], [16.6, -3]],
    bounds: { minX: -HX + 0.6, maxX: HX - 0.6, minZ: -HZ + 0.6, maxZ: HZ - 0.6, cell: 0.5, agentRadius: 0.4, agentHeight: 1.7, maxStep: 0.6 },
    update(dt, c) {
      const t = c.time.elapsed;
      const cam = c.camera;
      cam.getWorldDirection(fwd);
      right.crossVectors(fwd, cam.up).normalize();
      torch.position.copy(cam.position).addScaledVector(right, -0.12).addScaledVector(cam.up, 0.08).addScaledVector(fwd, 0.3);
      torch.target.position.copy(cam.position).addScaledVector(fwd, 10);
      torch.target.updateMatrixWorld();
      torchBeam.position.copy(torch.position);
      torchBeam.quaternion.setFromUnitVectors(DOWN, fwd);
      for (const { s, x } of strobes) {
        const a = t * 4.2;
        s.target.position.set(x + Math.sin(a) * 8, 0, -HZ + 6 + Math.cos(a) * 6);
        s.target.updateMatrixWorld();
      }
      for (const L of lamps) {
        const f = generatorOn ? 1.6 : Math.sin(t * 23 + L.ph) > 0.96 || Math.sin(t * 1.3 + L.ph) > 0.992 ? 0.1 : 1;
        L.l.intensity = 26 * f;
        L.l.distance = generatorOn ? 24 : 17;
        L.bulb.material.emissiveIntensity = 5 * f;
      }
    },
  };
}
