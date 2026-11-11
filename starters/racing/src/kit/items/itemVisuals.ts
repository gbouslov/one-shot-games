/**
 * Procedural item visuals: 64x64 Canvas2D HUD icons and low-poly 3D meshes.
 * Everything is generated in code (no asset files). Geometries, materials and
 * textures are cached module-wide and shared between mesh instances.
 *
 * The art here is original to this starter (oil slick, hockey-puck bolt,
 * homing drone, nitro canister, hex overdrive core, contact mine, comet
 * crystal, shock ring). Restyle freely per game: only buildItemMesh,
 * buildItemIcon and the mesh names 'bombBody' / 'bombTip' are relied on.
 */
import * as THREE from 'three';
import type { ItemType } from '../core/types';
import { TAU } from '../core/math';

// ---------------------------------------------------------------------------
// Icons (Canvas2D)
// ---------------------------------------------------------------------------

const ICON_SIZE = 64;
const iconCache = new Map<ItemType, HTMLCanvasElement>();

/** Returns a cached 64x64 canvas icon for the HUD item slot / roulette. */
export function buildItemIcon(item: ItemType): HTMLCanvasElement {
  const cached = iconCache.get(item);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawIcon(ctx, item);
  }
  iconCache.set(item, canvas);
  return canvas;
}

const PUCK = { body: '#18c8d8', dark: '#0a4e5a', glow: 'rgba(80,240,255,0.55)' };
const DRONE = { body: '#e8358f', dark: '#5a0f35', glow: 'rgba(255,90,170,0.55)' };

function drawIcon(ctx: CanvasRenderingContext2D, item: ItemType): void {
  const c = ICON_SIZE / 2;
  switch (item) {
    case 'none':
      return;
    case 'slick':
      drawSlick(ctx, c, c + 2, 1);
      return;
    case 'triple_slick':
      drawTriple(ctx, (x, y, s) => drawSlick(ctx, x, y, s));
      return;
    case 'bolt':
      drawPuck(ctx, c, c, 1);
      return;
    case 'triple_bolt':
      drawTriple(ctx, (x, y, s) => drawPuck(ctx, x, y, s));
      return;
    case 'seeker':
      drawDrone(ctx, c, c, 1);
      return;
    case 'triple_seeker':
      drawTriple(ctx, (x, y, s) => drawDrone(ctx, x, y, s));
      return;
    case 'comet':
      drawComet(ctx, c, c, 1);
      return;
    case 'nitro':
      drawCanister(ctx, c, c, 1, false);
      return;
    case 'triple_nitro':
      drawTriple(ctx, (x, y, s) => drawCanister(ctx, x, y, s, false));
      return;
    case 'gold_nitro':
      drawCanister(ctx, c, c, 1, true);
      return;
    case 'overdrive':
      drawHexCore(ctx, c, c, 1);
      return;
    case 'shock':
      drawShockRings(ctx, c, c, 1);
      return;
    case 'mine':
      drawMine(ctx, c, c, 1);
      return;
  }
}

function drawTriple(ctx: CanvasRenderingContext2D, fn: (x: number, y: number, s: number) => void): void {
  const c = ICON_SIZE / 2;
  fn(c - 14, c - 9, 0.52);
  fn(c + 14, c - 9, 0.52);
  fn(c, c + 12, 0.52);
}

function glow(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
}

function blobPath(ctx: CanvasRenderingContext2D, r: number, wobble: number, seed: number): void {
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wobble * Math.sin(a * 3 + seed) + wobble * 0.6 * Math.sin(a * 5 + seed * 2.1);
    const x = Math.cos(a) * r * k;
    const y = Math.sin(a) * r * k * 0.62;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Oil slick: a flat glossy puddle with a thin-film rainbow sheen. */
function drawSlick(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  blobPath(ctx, 26, 0.12, 1.3);
  ctx.fillStyle = '#0d0f14';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3a3f4c';
  ctx.stroke();
  ctx.save();
  blobPath(ctx, 26, 0.12, 1.3);
  ctx.clip();
  const sheen = ctx.createLinearGradient(-22, -12, 22, 12);
  sheen.addColorStop(0.0, 'rgba(120,60,255,0)');
  sheen.addColorStop(0.3, 'rgba(120,80,255,0.55)');
  sheen.addColorStop(0.45, 'rgba(40,220,200,0.55)');
  sheen.addColorStop(0.6, 'rgba(255,220,60,0.5)');
  sheen.addColorStop(0.75, 'rgba(255,80,140,0.45)');
  sheen.addColorStop(1.0, 'rgba(255,80,140,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(-2, -2, 18, 7, -0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-10, -6, 5, 1.6, -0.25, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Bolt: a spinning hockey-puck disc with a glowing cyan rim. */
function drawPuck(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  glow(ctx, 31, PUCK.glow);
  ctx.lineWidth = 2.5;
  // side wall
  ctx.fillStyle = '#20252e';
  ctx.strokeStyle = '#05070a';
  ctx.beginPath();
  ctx.ellipse(0, 6, 24, 10, 0, 0, Math.PI);
  ctx.lineTo(-24, -2);
  ctx.ellipse(0, -2, 24, 10, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // glowing band
  ctx.strokeStyle = PUCK.body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 2, 24, 10, 0, 0.05, Math.PI - 0.05);
  ctx.stroke();
  // top face
  ctx.fillStyle = '#2c333f';
  ctx.strokeStyle = '#05070a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -2, 24, 10, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // chevron
  ctx.strokeStyle = PUCK.body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-9, 1);
  ctx.lineTo(0, -5);
  ctx.lineTo(9, 1);
  ctx.stroke();
  ctx.restore();
}

/** Seeker: a round drone with a single lens and two side fins. */
function drawDrone(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  glow(ctx, 31, DRONE.glow);
  ctx.lineWidth = 2.5;
  // fins
  ctx.fillStyle = '#2a2e38';
  ctx.strokeStyle = '#06070a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 14, -6);
    ctx.lineTo(side * 29, -12);
    ctx.lineTo(side * 27, 4);
    ctx.lineTo(side * 14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // body
  const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 20);
  g.addColorStop(0, '#ff9ccb');
  g.addColorStop(0.5, DRONE.body);
  g.addColorStop(1, DRONE.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // lens
  ctx.fillStyle = '#0b0b10';
  ctx.beginPath();
  ctx.arc(0, 2, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffe8f4';
  ctx.beginPath();
  ctx.arc(0, 2, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Comet: a pale blue crystal with a long trailing tail. */
function drawComet(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  const tail = ctx.createLinearGradient(-28, 22, 6, -6);
  tail.addColorStop(0, 'rgba(120,180,255,0)');
  tail.addColorStop(1, 'rgba(160,210,255,0.85)');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-30, 26);
  ctx.lineTo(2, -10);
  ctx.lineTo(10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dff0ff';
  ctx.strokeStyle = '#2b5fae';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.lineTo(22, -6);
  ctx.lineTo(10, 10);
  ctx.lineTo(-2, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Nitro: a pressurised canister with a nozzle and a coloured band. */
function drawCanister(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, gold: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.rotate(0.35);
  if (gold) glow(ctx, 31, 'rgba(255,200,60,0.55)');
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#08090c';
  // nozzle
  ctx.fillStyle = '#9aa3ad';
  ctx.beginPath();
  ctx.roundRect(-5, -27, 10, 9, 2);
  ctx.fill();
  ctx.stroke();
  // body
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  if (gold) {
    g.addColorStop(0, '#8a5a00');
    g.addColorStop(0.35, '#ffe08a');
    g.addColorStop(0.6, '#f0b020');
    g.addColorStop(1, '#7a4a00');
  } else {
    g.addColorStop(0, '#0c2c66');
    g.addColorStop(0.35, '#5aa8ff');
    g.addColorStop(0.6, '#2a6fe0');
    g.addColorStop(1, '#0a2250');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-12, -19, 24, 44, 9);
  ctx.fill();
  ctx.stroke();
  // band + flame mark
  ctx.fillStyle = gold ? '#fff6d6' : '#ff6a1a';
  ctx.fillRect(-11, 0, 22, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-7, -15, 3, 34);
  ctx.restore();
}

/** Overdrive: a glowing hexagonal core inside a hex frame. */
function drawHexCore(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  glow(ctx, 32, 'rgba(120,255,200,0.6)');
  const hex = (r: number): void => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  hex(25);
  ctx.fillStyle = '#10161c';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4dffb8';
  ctx.stroke();
  hex(14);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#b8ffe2');
  g.addColorStop(1, '#22d68f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Shock: concentric pulse rings around a bright point. */
function drawShockRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  glow(ctx, 30, 'rgba(170,140,255,0.6)');
  ctx.strokeStyle = '#c8b8ff';
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 1 - i * 0.28;
    ctx.lineWidth = 3.5 - i;
    ctx.beginPath();
    ctx.arc(0, 0, 9 + i * 8, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Mine: a flat dome with stubby contact pins and a red light. */
function drawMine(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#050608';
  // base plate
  ctx.fillStyle = '#3a4048';
  ctx.beginPath();
  ctx.ellipse(0, 12, 26, 8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // pins
  ctx.fillStyle = '#c9a23a';
  for (const x of [-15, -5, 5, 15]) {
    ctx.beginPath();
    ctx.roundRect(x - 2.5, -14 + Math.abs(x) * 0.5, 5, 9, 1.5);
    ctx.fill();
    ctx.stroke();
  }
  // dome
  const g = ctx.createRadialGradient(-6, -4, 2, 0, 4, 22);
  g.addColorStop(0, '#6c7480');
  g.addColorStop(1, '#1a1e24');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 8, 20, 15, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // hazard stripe
  ctx.fillStyle = '#ffcc1a';
  ctx.fillRect(-20, 6, 40, 4);
  // light
  ctx.fillStyle = '#ff2a1a';
  ctx.beginPath();
  ctx.arc(0, -4, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 3D meshes
// ---------------------------------------------------------------------------

const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.Material>();
const textureCache = new Map<string, THREE.Texture>();

function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometryCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geometryCache.set(key, g);
  }
  return g;
}

function mat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = materialCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    materialCache.set(key, m);
  }
  return m;
}

function tex(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = textureCache.get(key);
  if (!t) {
    t = make();
    textureCache.set(key, t);
  }
  return t;
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function standard(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return mat(key, () => new THREE.MeshStandardMaterial(params));
}

function glowMat(key: string, color: number, opacity = 0.5): THREE.MeshBasicMaterial {
  return mat(
    key,
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
  );
}

/** Thin-film sheen for the oil slick. */
function slickTexture(): THREE.Texture {
  return tex('slickSheen', () =>
    canvasTexture(128, (ctx) => {
      ctx.fillStyle = '#07080b';
      ctx.fillRect(0, 0, 128, 128);
      const bands = ['#5a2cff', '#16c8b4', '#f2c81e', '#ff3c8c'];
      ctx.globalAlpha = 0.32;
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = bands[i % bands.length];
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(64 + Math.sin(i) * 6, 64, 14 + i * 6, 8 + i * 4, 0.4, 0, TAU);
        ctx.stroke();
      }
    }),
  );
}

function buildSlick(): THREE.Object3D {
  const g = new THREE.Group();
  const puddle = new THREE.Mesh(
    geo('slick', () => {
      const shape = new THREE.Shape();
      const n = 20;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const r = 0.62 * (1 + 0.14 * Math.sin(a * 3 + 1.3) + 0.08 * Math.sin(a * 5 + 2.7));
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.8;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      const geom = new THREE.ShapeGeometry(shape, 2);
      geom.rotateX(-Math.PI / 2);
      return geom;
    }),
    standard('slick', { map: slickTexture(), color: 0xffffff, roughness: 0.08, metalness: 0.6 }),
  );
  puddle.receiveShadow = true;
  g.add(puddle);
  // a tipped-over can that spilled it
  const can = new THREE.Mesh(
    geo('slickCan', () => new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10)),
    standard('slickCan', { color: 0x30343c, roughness: 0.45, metalness: 0.6 }),
  );
  can.rotation.z = Math.PI / 2;
  can.position.set(0.42, 0.12, -0.18);
  can.castShadow = true;
  g.add(can);
  g.position.y = 0.03;
  return g;
}

function buildPuck(): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geo('puckBody', () => new THREE.CylinderGeometry(0.4, 0.4, 0.2, 18)),
    standard('puckBody', { color: 0x1e232c, roughness: 0.35, metalness: 0.7 }),
  );
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(
    geo('puckBand', () => new THREE.TorusGeometry(0.405, 0.035, 6, 24)),
    standard('puckBand', { color: 0x18c8d8, emissive: 0x18e0f0, emissiveIntensity: 2.2, roughness: 0.4 }),
  );
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const halo = new THREE.Mesh(geo('puckHalo', () => new THREE.RingGeometry(0.42, 0.75, 24)), glowMat('puckHalo', 0x40e8ff, 0.35));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.09;
  g.add(halo);
  g.position.y = 0.2;
  return g;
}

function buildDrone(): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geo('droneBody', () => new THREE.SphereGeometry(0.3, 16, 10)),
    standard('droneBody', { color: 0xe8358f, roughness: 0.25, metalness: 0.35 }),
  );
  body.castShadow = true;
  g.add(body);
  const lens = new THREE.Mesh(
    geo('droneLens', () => new THREE.CircleGeometry(0.13, 16)),
    standard('droneLens', { color: 0x0b0b10, emissive: 0xffd0e8, emissiveIntensity: 1.6, roughness: 0.1 }),
  );
  lens.position.set(0, 0.02, -0.295);
  lens.rotation.y = Math.PI;
  g.add(lens);
  const finGeo = geo('droneFin', () => new THREE.BoxGeometry(0.34, 0.04, 0.2));
  const finMat = standard('droneFin', { color: 0x2a2e38, roughness: 0.5, metalness: 0.6 });
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(side * 0.36, 0.02, 0.04);
    fin.rotation.z = side * 0.2;
    g.add(fin);
  }
  const halo = new THREE.Mesh(geo('droneHalo', () => new THREE.SphereGeometry(0.46, 12, 8)), glowMat('droneHalo', 0xff4fa8, 0.18));
  g.add(halo);
  g.position.y = 0.42;
  return g;
}

function buildComet(): THREE.Object3D {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    geo('cometCore', () => new THREE.OctahedronGeometry(0.42, 0)),
    standard('cometCore', { color: 0xdff0ff, emissive: 0x6aa8ff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, flatShading: true }),
  );
  core.scale.set(1, 1.4, 1);
  core.castShadow = true;
  g.add(core);
  const tail = new THREE.Mesh(
    geo('cometTail', () => {
      const c = new THREE.ConeGeometry(0.34, 1.6, 10, 1, true);
      c.rotateX(Math.PI / 2);
      c.translate(0, 0, 0.9);
      return c;
    }),
    glowMat('cometTail', 0x88c4ff, 0.4),
  );
  g.add(tail);
  g.position.y = 0.6;
  return g;
}

function buildCanister(gold: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geo('canBody', () => new THREE.CapsuleGeometry(0.2, 0.42, 4, 14)),
    gold
      ? standard('canGold', { color: 0xf0b020, roughness: 0.22, metalness: 0.9, emissive: 0x3a2400, emissiveIntensity: 0.5 })
      : standard('canBlue', { color: 0x2a6fe0, roughness: 0.25, metalness: 0.7 }),
  );
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(
    geo('canBand', () => new THREE.CylinderGeometry(0.205, 0.205, 0.1, 14, 1, true)),
    standard(gold ? 'canBandGold' : 'canBand', { color: gold ? 0xfff6d6 : 0xff6a1a, emissive: gold ? 0x000000 : 0xff4a00, emissiveIntensity: 0.6, roughness: 0.5 }),
  );
  band.position.y = 0.02;
  g.add(band);
  const nozzle = new THREE.Mesh(
    geo('canNozzle', () => new THREE.CylinderGeometry(0.06, 0.09, 0.14, 8)),
    standard('canNozzle', { color: 0x9aa3ad, roughness: 0.3, metalness: 0.9 }),
  );
  nozzle.position.y = 0.48;
  g.add(nozzle);
  g.rotation.z = 0.25;
  g.position.y = 0.5;
  return g;
}

function buildHexCore(): THREE.Object3D {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    geo('hexFrame', () => new THREE.TorusGeometry(0.42, 0.06, 6, 6)),
    standard('hexFrame', { color: 0x10161c, emissive: 0x4dffb8, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.6 }),
  );
  g.add(frame);
  const core = new THREE.Mesh(
    geo('hexCore', () => new THREE.CylinderGeometry(0.26, 0.26, 0.12, 6)),
    standard('hexCore', { color: 0xb8ffe2, emissive: 0x22d68f, emissiveIntensity: 2.2, roughness: 0.2 }),
  );
  core.rotation.x = Math.PI / 2;
  core.castShadow = true;
  g.add(core);
  const halo = new THREE.Mesh(geo('hexHalo', () => new THREE.CircleGeometry(0.7, 6)), glowMat('hexHalo', 0x4dffb8, 0.22));
  halo.position.z = -0.02;
  g.add(halo);
  g.position.y = 0.6;
  return g;
}

function buildMine(): THREE.Object3D {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(
    geo('minePlate', () => new THREE.CylinderGeometry(0.46, 0.5, 0.08, 16)),
    standard('minePlate', { color: 0x3a4048, roughness: 0.55, metalness: 0.6 }),
  );
  plate.position.y = -0.2;
  g.add(plate);
  const body = new THREE.Mesh(
    geo('mineDome', () => new THREE.SphereGeometry(0.36, 14, 8, 0, TAU, 0, Math.PI / 2)),
    standard('mineDome', { color: 0x2a2f36, roughness: 0.4, metalness: 0.5 }),
  );
  body.name = 'bombBody';
  body.position.y = -0.18;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(
    geo('mineStripe', () => new THREE.CylinderGeometry(0.365, 0.365, 0.05, 16, 1, true)),
    standard('mineStripe', { color: 0xffcc1a, roughness: 0.6 }),
  );
  stripe.position.y = -0.12;
  g.add(stripe);
  const pinGeo = geo('minePin', () => new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6));
  const pinMat = standard('minePin', { color: 0xc9a23a, roughness: 0.3, metalness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const pin = new THREE.Mesh(pinGeo, pinMat);
    const dir = new THREE.Vector3(Math.cos(a) * 0.7, 0.72, Math.sin(a) * 0.7).normalize();
    pin.position.copy(dir).multiplyScalar(0.36);
    pin.position.y -= 0.18;
    pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(pin);
  }
  const tip = new THREE.Mesh(
    geo('mineLight', () => new THREE.SphereGeometry(0.06, 8, 6)),
    standard('mineLight', { color: 0xff3a1a, emissive: 0xff2a00, emissiveIntensity: 2.5, roughness: 0.4 }),
  );
  tip.name = 'bombTip';
  tip.position.set(0, 0.2, 0);
  g.add(tip);
  g.position.y = 0.24;
  return g;
}

function buildShockRing(): THREE.Object3D {
  const g = new THREE.Group();
  const ringGeo = geo('shockRing', () => new THREE.TorusGeometry(0.4, 0.03, 6, 28));
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(ringGeo, glowMat(`shockRing${i}`, 0xb8a8ff, 0.8 - i * 0.2));
    r.scale.setScalar(1 + i * 0.35);
    r.rotation.x = i * 0.7;
    r.rotation.y = i * 1.1;
    g.add(r);
  }
  const core = new THREE.Mesh(geo('shockCore', () => new THREE.SphereGeometry(0.14, 10, 8)), glowMat('shockCore', 0xffffff, 0.95));
  g.add(core);
  g.position.y = 0.6;
  return g;
}

/**
 * Builds a fresh Object3D for the given item (≤ 600 triangles). Geometries and
 * materials are shared from the module caches; the returned group itself can be
 * freely positioned, scaled and removed. Triple items return the single base
 * item (the ItemManager instantiates three of them for the orbit).
 */
export function buildItemMesh(item: ItemType): THREE.Object3D {
  switch (item) {
    case 'slick':
    case 'triple_slick':
      return buildSlick();
    case 'bolt':
    case 'triple_bolt':
      return buildPuck();
    case 'seeker':
    case 'triple_seeker':
      return buildDrone();
    case 'comet':
      return buildComet();
    case 'nitro':
    case 'triple_nitro':
      return buildCanister(false);
    case 'gold_nitro':
      return buildCanister(true);
    case 'overdrive':
      return buildHexCore();
    case 'shock':
      return buildShockRing();
    case 'mine':
      return buildMine();
    case 'none':
    default:
      return new THREE.Group();
  }
}

/** Base (non-triple) item type, e.g. 'triple_seeker' -> 'seeker'. */
export function baseItemType(item: ItemType): ItemType {
  switch (item) {
    case 'triple_slick':
      return 'slick';
    case 'triple_bolt':
      return 'bolt';
    case 'triple_seeker':
      return 'seeker';
    case 'triple_nitro':
      return 'nitro';
    default:
      return item;
  }
}

/** Frees all cached GPU resources (geometries, materials, textures) and icon canvases. */
export function disposeItemVisualCaches(): void {
  for (const g of geometryCache.values()) g.dispose();
  geometryCache.clear();
  for (const m of materialCache.values()) m.dispose();
  materialCache.clear();
  for (const t of textureCache.values()) t.dispose();
  textureCache.clear();
  iconCache.clear();
}
