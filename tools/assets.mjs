#!/usr/bin/env node
/**
 * The asset library: ready-made, licence-clean models, materials and skies,
 * compressed so they fit inside one HTML file.
 *
 *   npm run assets -- list [--kind=model|material|sky] [--tag=industrial] [--md]
 *   npm run assets -- add <id> [<id> ...] --game=games/<slug>     the one call a game makes
 *   npm run assets -- remove <id> --game=games/<slug>
 *   npm run assets -- credits --game=games/<slug>
 *
 * Growing the library (needs network; raw downloads go to .asset-cache/, never committed):
 *   npm run assets -- pack polyhaven:<id> [--res=1k] [--tex=1024] [--tris=20000] [--tags=a,b] [--grade=A] [--use="..."]
 *   npm run assets -- pack ambientcg:<id> [--tex=1024] ...
 *   npm run assets -- pack file:<path.glb|.gltf> --id=<id> --licence=CC0 --author="..." --page=<url> ...
 *   npm run assets -- pack flipbook:<sheet.tga|.png> --id=<id> --cols=8 --rows=8 --blend=additive|alpha --licence=CC0 ...
 *   npm run assets -- pack anims:<source.glb> --onto=<rigged model id> --clips=Walk_Loop,...
 *
 * `add` writes games/<slug>/src/assets/: one base64 module per asset, the
 * loader (assets/runtime/library.js) and index.js, which a game imports:
 *   import { assets } from '../assets/index.js';
 * Everything decodes at boot without fetch, blob URLs or WebAssembly, so it runs
 * under the artifact content policy. Geometry is quantized (KHR_mesh_quantization,
 * decoded natively by three's GLTFLoader); textures are WebP.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { ROOT, parseArgs } from './lib/harness.mjs';

const LIB = join(ROOT, 'assets');
const CACHE = join(ROOT, '.asset-cache');
const CATALOG = join(LIB, 'catalog.json');

const args = parseArgs();
const [cmd, ...rest] = args._;

const readCatalog = () => (existsSync(CATALOG) ? JSON.parse(readFileSync(CATALOG, 'utf8')) : { assets: [] });
function writeCatalog(cat) {
  cat.assets.sort((a, b) => (a.kind + a.id).localeCompare(b.kind + b.id));
  writeFileSync(CATALOG, JSON.stringify(cat, null, 1) + '\n');
}
const kb = (n) => Math.round(n / 1024);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

/* -------------------------------------------------------------------------- */
/*  fetch                                                                     */
/* -------------------------------------------------------------------------- */

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'one-shot-games-assets/1' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function download(url, file) {
  if (existsSync(file) && statSync(file).size > 0) return file;
  mkdirSync(dirname(file), { recursive: true });
  const r = await fetch(url, { headers: { 'user-agent': 'one-shot-games-assets/1' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

const PH_TYPES = ['sky', 'material', 'model'];

/** Poly Haven: everything CC0. https://polyhaven.com/license */
async function fetchPolyHaven(id, res = '1k') {
  const dir = join(CACHE, 'polyhaven', id);
  const metaFile = join(dir, 'meta.json');
  if (existsSync(metaFile)) {
    const m = JSON.parse(readFileSync(metaFile, 'utf8'));
    if (m.res === res) return m;
  }
  const info = await getJSON(`https://api.polyhaven.com/info/${id}`);
  const files = await getJSON(`https://api.polyhaven.com/files/${id}`);
  const kind = PH_TYPES[info.type];
  const meta = {
    source: 'polyhaven', id, kind, res, name: info.name, authors: Object.keys(info.authors ?? {}),
    licence: 'CC0', page: `https://polyhaven.com/a/${id}`, tags: [...(info.tags ?? []), ...(info.categories ?? [])],
    dimensions_mm: info.dimensions ?? null, polycount: info.polycount ?? null, fetched: new Date().toISOString().slice(0, 10),
    files: {},
  };
  if (kind === 'model') {
    const g = files.gltf[res] ?? files.gltf['1k'];
    meta.files.gltf = await download(g.gltf.url, join(dir, basename(g.gltf.url)));
    for (const [rel, f] of Object.entries(g.gltf.include ?? {})) await download(f.url, join(dir, rel));
  } else if (kind === 'material') {
    const pick = (key) => files[key]?.[res]?.jpg ?? files[key]?.[res]?.png;
    for (const [slot, key] of [['color', 'Diffuse'], ['normal', 'nor_gl'], ['arm', 'arm']]) {
      const f = pick(key);
      if (f) meta.files[slot] = await download(f.url, join(dir, basename(f.url)));
    }
  } else {
    const f = files.hdri[res]?.hdr ?? files.hdri['2k'].hdr;
    meta.files.hdr = await download(f.url, join(dir, basename(f.url)));
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  return meta;
}

/** ambientCG: everything CC0. https://docs.ambientcg.com/license/ */
async function fetchAmbientCG(id, res = '1K') {
  const dir = join(CACHE, 'ambientcg', id);
  const metaFile = join(dir, 'meta.json');
  if (existsSync(metaFile)) return JSON.parse(readFileSync(metaFile, 'utf8'));
  const j = await getJSON(`https://ambientcg.com/api/v2/full_json?id=${id}&include=downloadData,tagData,dimensionsData`);
  const a = j.foundAssets?.[0];
  if (!a) throw new Error(`ambientCG has no asset ${id}`);
  const dl = a.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads ?? [];
  const want = dl.find((d) => d.attribute === `${res}-JPG`) ?? dl.find((d) => d.attribute.endsWith('-JPG'));
  if (!want) throw new Error(`no JPG download for ${id}`);
  const zip = await download(want.downloadLink ?? want.fullDownloadPath, join(dir, want.fileName));
  const { unzipSync } = await import('fflate');
  const out = unzipSync(readFileSync(zip));
  const files = {};
  for (const [name, bytes] of Object.entries(out)) {
    writeFileSync(join(dir, basename(name)), bytes);
    if (/_Color\./.test(name)) files.color = join(dir, basename(name));
    else if (/_NormalGL\./.test(name)) files.normal = join(dir, basename(name));
    else if (/_Roughness\./.test(name)) files.rough = join(dir, basename(name));
    else if (/_AmbientOcclusion\./.test(name)) files.ao = join(dir, basename(name));
    else if (/_Metalness\./.test(name)) files.metal = join(dir, basename(name));
    else if (/_Opacity\./.test(name)) files.opacity = join(dir, basename(name));
  }
  const meta = {
    source: 'ambientcg', id, kind: a.dataType === 'HDRI' ? 'sky' : 'material', name: a.displayName ?? id, authors: ['ambientCG (Lennart Demes)'],
    licence: 'CC0', page: `https://ambientcg.com/view?id=${id}`, tags: a.tags ?? [],
    dimensions_mm: a.dimensionX ? [a.dimensionX * 10, a.dimensionY * 10] : null, fetched: new Date().toISOString().slice(0, 10), files,
  };
  writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  return meta;
}

/**
 * Patch (patch.gg): one open API over ~59,000 CC0 / CC-BY-4.0 assets from Kenney,
 * Poly Haven, ambientCG, KayKit, NVIDIA SimReady, Amazon Berkeley Objects and more,
 * each with its licence evidence and a ready credit line. No login.
 * Docs: https://docs.patch.gg/llms.txt
 */
const PATCH = 'https://patch.gg/api/v1';
const PATCH_LICENCES = { 'CC0-1.0': 'CC0', 'CC-BY-4.0': 'CC-BY-4.0' };
const PATCH_KIND = { model: 'model', material: 'material', hdri: 'sky', music: 'audio', sfx: 'audio', sound: 'audio' };

async function patchSearch(q, { type = 'model', limit = 12, ai = 'false', real = false, extra = '' } = {}) {
  const u = `${PATCH}/assets/search?q=${encodeURIComponent(q)}&type=${type}&limit=${real ? Math.min(100, limit * 6) : limit}${ai === 'any' ? '' : `&ai=${ai}`}${extra}`;
  const j = await getJSON(u);
  let hits = j.hits ?? [];
  if (real) hits = hits.filter((h) => (h.traits ?? []).includes('realistic')).slice(0, limit);
  return { total: j.total, hits };
}

async function fetchPatch(patchId) {
  const local = (args.id ?? patchId.split(':').slice(1).join('_')).replace(/\.(glb|gltf)$/i, '').replace(/[^A-Za-z0-9_-]+/g, '_');
  const dir = join(CACHE, 'patch', local);
  const metaFile = join(dir, 'meta.json');
  if (existsSync(metaFile)) return JSON.parse(readFileSync(metaFile, 'utf8'));
  const d = await getJSON(`${PATCH}/assets/${encodeURIComponent(patchId)}`);
  const licence = PATCH_LICENCES[d.license?.spdx];
  if (!licence) throw new Error(`${patchId}: licence ${d.license?.spdx} is not CC0 or CC-BY-4.0`);
  const kind = PATCH_KIND[d.type];
  if (!kind) throw new Error(`${patchId}: type ${d.type} is not packed yet (model, material, hdri, music, sfx)`);
  const variant = d.variants.find((v) => v.name === 'web') ?? d.variants.find((v) => v.name === 'src') ?? d.variants[0];
  const files = {};
  for (const f of variant.files) {
    const out = join(dir, f.name);
    await download(f.url, out);
    const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
    if (f.sha256 && sha !== f.sha256) throw new Error(`${patchId}: ${f.name} hash ${sha} != ${f.sha256}`);
    const role = { baseColor: 'color', environment: 'hdr', background: 'bg', model: /\.gltf$/.test(f.name) ? 'gltf' : 'glb' }[f.role] ?? f.role;
    files[role] = out;
  }
  const facts = d.facts ?? {};
  const meta = {
    source: 'patch', upstream: d.source?.name, patch_id: patchId, id: local, kind, name: d.title, authors: d.creators ?? [],
    licence, page: d.source?.url ?? `https://patch.gg/assets/${encodeURIComponent(patchId)}`, credit: d.credit, ai: !!d.ai,
    tags: [...(d.traits ?? []), ...(d.tags ?? [])].slice(0, 8), fetched: new Date().toISOString().slice(0, 10),
    dimensions_mm: facts.real_width_m ? [facts.real_width_m * 1000, facts.real_width_m * 1000] : null, files,
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  return meta;
}

/* -------------------------------------------------------------------------- */
/*  pack                                                                      */
/* -------------------------------------------------------------------------- */

async function gltfTools() {
  const core = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const fn = await import('@gltf-transform/functions');
  const sharp = (await import('sharp')).default;
  const { MeshoptSimplifier } = await import('meshoptimizer');
  await MeshoptSimplifier.ready;
  const io = new core.NodeIO().registerExtensions(ALL_EXTENSIONS);
  return { core, fn, sharp, io, MeshoptSimplifier };
}

function countTris(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      n += Math.round((idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3);
    }
  }
  return n;
}

/** Shrink geometry and textures for inlining. Textures go to WebP; normals keep more quality. */
async function compressDoc(doc, t, { tex = 1024, quality = 82, tris = 0 }) {
  const { fn, sharp, MeshoptSimplifier } = t;
  await doc.transform(fn.dedup(), fn.prune(), fn.weld());
  const before = countTris(doc);
  if (tris && before > tris) {
    const ratio = Math.max(0.02, tris / before);
    await doc.transform(fn.simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(args.error ?? 0.01), lockBorder: false }));
  }
  await doc.transform(
    fn.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: Math.min(95, quality + 8), slots: /^normalTexture$/ }),
    fn.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality }),
    fn.prune(),
    fn.quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  return { trisBefore: before, tris: countTris(doc) };
}

function boundsOf(doc, fn) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = fn.getBounds(scene);
  return { min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)), size_m: b.max.map((v, i) => +(v - b.min[i]).toFixed(3)) };
}

async function packModel(meta, opts) {
  const t = await gltfTools();
  const src = meta.files.gltf ?? meta.files.glb;
  const doc = await t.io.read(src);
  // Measure before quantizing: quantization moves scale into node transforms.
  const b = boundsOf(doc, t.fn);
  const st = await compressDoc(doc, t, opts);
  const out = join(LIB, 'models', `${opts.id}.glb`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await t.io.writeBinary(doc));
  return { file: relative(LIB, out), tris: st.tris, tris_source: st.trisBefore, size_m: b.size_m, origin: originNote(b) };
}

function originNote(b) {
  const centred = Math.abs(b.min[0] + b.max[0]) < 0.05 * b.size_m[0] + 0.01 && Math.abs(b.min[2] + b.max[2]) < 0.05 * b.size_m[2] + 0.01;
  const onFloor = Math.abs(b.min[1]) < 0.02 + 0.02 * b.size_m[1];
  return `${centred ? 'centred' : 'off-centre'}, ${onFloor ? 'base at y=0' : `base at y=${b.min[1]}`}`;
}

/** A material is stored as a one-quad glTF so the same loader reads it. */
async function packMaterial(meta, opts) {
  const t = await gltfTools();
  const { Document } = t.core;
  const doc = new Document();
  const buf = doc.createBuffer();
  const sharp = t.sharp;
  const f = meta.files;
  const texFrom = async (file, name) => doc.createTexture(name).setImage(await sharp(file).png().toBuffer()).setMimeType('image/png');

  const mat = doc.createMaterial(opts.id).setRoughnessFactor(1).setMetallicFactor(1);
  if (f.color) mat.setBaseColorTexture(await texFrom(f.color, 'color'));
  if (f.normal) mat.setNormalTexture(await texFrom(f.normal, 'normal'));
  let orm = f.arm;
  if (!orm && (f.rough || f.ao || f.metal)) {
    // ambientCG ships separate maps: pack AO, roughness, metalness into R, G, B.
    const size = (await sharp(f.color ?? f.rough).metadata()).width;
    const chan = async (file, fill) => (file ? sharp(file).resize(size, size).greyscale().raw().toBuffer() : Buffer.alloc(size * size, fill));
    const [ao, ro, me] = await Promise.all([chan(f.ao, 255), chan(f.rough, 200), chan(f.metal, 0)]);
    const rgb = Buffer.alloc(size * size * 3);
    for (let i = 0; i < size * size; i++) {
      rgb[i * 3] = ao[i];
      rgb[i * 3 + 1] = ro[i];
      rgb[i * 3 + 2] = me[i];
    }
    orm = await sharp(rgb, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  }
  if (orm) {
    const tx = typeof orm === 'string' ? await texFrom(orm, 'orm') : doc.createTexture('orm').setImage(orm).setMimeType('image/png');
    mat.setMetallicRoughnessTexture(tx).setOcclusionTexture(tx);
  } else mat.setMetallicFactor(0);

  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1])).setBuffer(buf);
  const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])).setBuffer(buf);
  const nor = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])).setBuffer(buf);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setAttribute('NORMAL', nor).setIndices(idx).setMaterial(mat);
  const node = doc.createNode(opts.id).setMesh(doc.createMesh(opts.id).addPrimitive(prim));
  doc.createScene().addChild(node);

  await doc.transform(
    t.fn.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [opts.tex, opts.tex], quality: Math.min(95, opts.quality + 8), slots: /^normalTexture$/ }),
    t.fn.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [opts.tex, opts.tex], quality: opts.quality }),
  );
  const out = join(LIB, 'materials', `${opts.id}.glb`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await t.io.writeBinary(doc));
  const tile = meta.dimensions_mm ? meta.dimensions_mm.slice(0, 2).map((v) => +(v / 1000).toFixed(2)) : [2, 2];
  return { file: relative(LIB, out), tile_m: tile };
}

/** Radiance .hdr (RGBE, with or without run-length encoding) to linear float RGB. */
function readHDR(file) {
  const buf = readFileSync(file);
  let p = 0;
  const line = () => {
    let s = '';
    while (p < buf.length && buf[p] !== 0x0a) s += String.fromCharCode(buf[p++]);
    p++;
    return s;
  };
  let l;
  while ((l = line()) !== '') if (p >= buf.length) throw new Error('bad hdr header');
  const dims = line().match(/-Y (\d+) \+X (\d+)/);
  if (!dims) throw new Error('unsupported hdr orientation');
  const H = +dims[1];
  const W = +dims[2];
  const rgbe = new Uint8Array(W * H * 4);
  const row = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && ((buf[p + 2] << 8) | buf[p + 3]) === W) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < W) {
          let n = buf[p++];
          if (n > 128) {
            n -= 128;
            const v = buf[p++];
            while (n--) row[(x++) * 4 + c] = v;
          } else while (n--) row[(x++) * 4 + c] = buf[p++];
        }
      }
    } else {
      for (let x = 0; x < W * 4; x++) row[x] = buf[p++];
    }
    rgbe.set(row, y * W * 4);
  }
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const e = rgbe[i * 4 + 3];
    const f = e ? Math.pow(2, e - 136) : 0;
    rgb[i * 3] = rgbe[i * 4] * f;
    rgb[i * 3 + 1] = rgbe[i * 4 + 1] * f;
    rgb[i * 3 + 2] = rgbe[i * 4 + 2] * f;
  }
  return { W, H, rgb };
}

function downsample({ W, H, rgb }, w, h) {
  const out = new Float32Array(w * h * 3);
  const sx = W / w;
  const sy = H / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const i = (yy * W + xx) * 3;
          r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { W: w, H: h, rgb: out };
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * A sky becomes two files: an sRGB WebP background (the HDR scaled so the bright
 * sky sits just under white; the runtime scales it back) and a small RGBE light
 * probe, deflated, that drives reflections and ambient light. The sun is found
 * and written to the catalog so a game aims its DirectionalLight at it.
 */
async function packSky(meta, opts) {
  const { default: sharp } = await import('sharp');
  const hdr = readHDR(meta.files.hdr);
  const bgW = Math.min(opts.bg ?? 2048, hdr.W);
  const bgH = bgW / 2;
  const bg = bgW === hdr.W ? hdr : downsample(hdr, bgW, bgH);

  // Sun: brightest texel of a small copy.
  const probe = downsample(hdr, 256, 128);
  let best = 0, bi = 0;
  for (let i = 0; i < probe.W * probe.H; i++) {
    const L = lum(probe.rgb[i * 3], probe.rgb[i * 3 + 1], probe.rgb[i * 3 + 2]);
    if (L > best) { best = L; bi = i; }
  }
  const px = bi % probe.W;
  const py = Math.floor(bi / probe.W);
  const u = (px + 0.5) / probe.W;
  const v = 1 - (py + 0.5) / probe.H;
  const lat = (v - 0.5) * Math.PI;
  const lon = (u - 0.5) * 2 * Math.PI;
  const sunDir = [Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)].map((x) => +x.toFixed(3));
  const sr = probe.rgb[bi * 3], sg = probe.rgb[bi * 3 + 1], sb = probe.rgb[bi * 3 + 2];
  const sm = Math.max(sr, sg, sb) || 1;
  const sunColor = '#' + [sr, sg, sb].map((c) => Math.round((c / sm) * 255).toString(16).padStart(2, '0')).join('');

  // Background exposure: put the 97th-percentile sky luminance at 0.92.
  const L = [];
  for (let i = 0; i < bg.W * bg.H; i += 7) L.push(lum(bg.rgb[i * 3], bg.rgb[i * 3 + 1], bg.rgb[i * 3 + 2]));
  L.sort((a, b) => a - b);
  const scale = 0.92 / Math.max(1e-4, L[Math.floor(L.length * 0.97)]);
  const enc = (c) => {
    const x = Math.min(1, Math.max(0, c * scale));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  };
  const bgFile = join(LIB, 'skies', `${opts.id}.webp`);
  mkdirSync(dirname(bgFile), { recursive: true });
  let bgScale = scale;
  const jpgW = meta.files.bg ? (await sharp(meta.files.bg).metadata()).width : 0;
  if (jpgW > hdr.W) {
    // Patch ships a 1K HDR plus a sharper tonemapped JPEG: use the JPEG as the
    // background and fit its brightness to the HDR (median linear luminance).
    const W2 = Math.min(opts.bg ?? 2048, jpgW);
    await sharp(meta.files.bg).resize(W2, W2 / 2).webp({ quality: opts.quality ?? 80 }).toFile(bgFile);
    const small = await sharp(meta.files.bg).resize(256, 128).removeAlpha().raw().toBuffer();
    const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const a = [];
    const b = [];
    for (let i = 0; i < 256 * 128; i++) {
      a.push(lum(lin(small[i * 3]), lin(small[i * 3 + 1]), lin(small[i * 3 + 2])));
      b.push(lum(probe.rgb[i * 3], probe.rgb[i * 3 + 1], probe.rgb[i * 3 + 2]));
    }
    a.sort((x, y) => x - y);
    b.sort((x, y) => x - y);
    bgScale = a[a.length >> 1] / Math.max(1e-5, b[b.length >> 1]);
  } else {
    const px8 = Buffer.alloc(bg.W * bg.H * 3);
    for (let i = 0; i < bg.W * bg.H * 3; i++) px8[i] = enc(bg.rgb[i]);
    await sharp(px8, { raw: { width: bg.W, height: bg.H, channels: 3 } }).webp({ quality: opts.quality ?? 80 }).toFile(bgFile);
  }

  // Light probe: 256x128 RGBE, rows bottom-up (three's DataTexture has v=0 at row 0),
  // the sun clamped so the DirectionalLight carries it instead of the probe.
  const clampMax = opts.envMax ?? 60;
  const env = new Uint8Array(probe.W * probe.H * 4);
  for (let y = 0; y < probe.H; y++) {
    for (let x = 0; x < probe.W; x++) {
      const i = (y * probe.W + x) * 3;
      const o = ((probe.H - 1 - y) * probe.W + x) * 4;
      let r = probe.rgb[i], g = probe.rgb[i + 1], b = probe.rgb[i + 2];
      const m = Math.max(r, g, b);
      if (m > clampMax) { r *= clampMax / m; g *= clampMax / m; b *= clampMax / m; }
      const mm = Math.max(r, g, b);
      if (mm < 1e-32) continue;
      const e = Math.ceil(Math.log2(mm));
      const f = Math.pow(2, -e) * 255.999;
      const ee = Math.min(255, Math.max(0, e + 128));
      env[o] = Math.min(255, r * f); env[o + 1] = Math.min(255, g * f); env[o + 2] = Math.min(255, b * f); env[o + 3] = ee;
    }
  }
  const envFile = join(LIB, 'skies', `${opts.id}.env`);
  writeFileSync(envFile, deflateRawSync(env, { level: 9 }));
  return {
    file: relative(LIB, bgFile), env_file: relative(LIB, envFile), env_size: [probe.W, probe.H],
    bg_scale: +bgScale.toPrecision(4), sun: { dir: sunDir, color: sunColor, elevation_deg: +((lat * 180) / Math.PI).toFixed(1) },
  };
}

/**
 * Animation clips retargeted onto one rigged library character, stored deflated.
 *   npm run assets -- pack anims:<source glb> --onto=<model id> --clips=Walk_Loop,Idle_Loop [--id=...]
 * The source is Quaternius's Universal Animation Library (CC0), cached in .asset-cache/quaternius-ual/.
 */
async function packAnims(srcPath) {
  const onto = args.onto;
  if (!onto) fail('anims packs need --onto=<rigged model id in the library>');
  const cat = readCatalog();
  const target = cat.assets.find((a) => a.id === onto && a.kind === 'model');
  if (!target) fail(`no model ${onto} in the library`);
  const src = resolve(srcPath);
  if (!existsSync(src)) fail(`no source at ${src}`);
  const { retarget } = await import('./anim-retarget.mjs');
  const clips = args.clips ? String(args.clips).split(',') : null;
  const r = await retarget({ src, dst: join(LIB, target.file), clips, fps: Number(args.fps ?? 30), check: true });
  if (!r.clips.length) fail(`none of the clips ${clips} are in ${src}`);
  const bad = r.report.filter((x) => x.maxDirErrDeg > 1);
  if (bad.length) fail(`retarget check failed: ${JSON.stringify(bad)}`);
  const id = args.id ?? `anims-${onto}`;
  const { deflateRawSync } = await import('node:zlib');
  const bytes = deflateRawSync(Buffer.from(JSON.stringify({ fps: r.fps, clips: r.clips })), { level: 9 });
  const file = join('anims', `${id}.bin`);
  mkdirSync(join(LIB, 'anims'), { recursive: true });
  writeFileSync(join(LIB, file), bytes);
  const entry = {
    id, kind: 'anims', name: `Animations for ${onto}`, source: 'quaternius', page: 'https://opengameart.org/content/universal-animation-library',
    licence: 'CC0', authors: ['Quaternius'], read: new Date().toISOString().slice(0, 10), file, target: onto,
    clips: r.report.map((x) => ({ name: x.clip, seconds: x.seconds })), bytes: bytes.length, inline_kb: kb(Math.ceil(bytes.length / 3) * 4),
    tags: ['anims', 'character'], grade: 'B', use: `Clips retargeted onto ${onto}`,
  };
  cat.assets = cat.assets.filter((a) => a.id !== id);
  cat.assets.push(entry);
  writeCatalog(cat);
  console.log(JSON.stringify({ ok: true, id, kind: 'anims', kb: kb(bytes.length), clips: r.report }));
}

/** Read an uncompressed 24/32-bit TGA (what Houdini and Unity Labs export) into RGBA pixels, top row first. */
function readTGA(buf) {
  const idLen = buf[0], type = buf[2], w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
  if (type !== 2 || (bpp !== 24 && bpp !== 32)) fail(`only uncompressed 24/32-bit TGA, got type ${type}, ${bpp} bpp`);
  const step = bpp / 8, top = (desc & 0x20) !== 0, off = 18 + idLen + (buf[1] ? buf.readUInt16LE(5) * Math.ceil(buf[7] / 8) : 0);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const i = off + (sy * w + x) * step, o = (y * w + x) * 4;
      out[o] = buf[i + 2]; out[o + 1] = buf[i + 1]; out[o + 2] = buf[i]; out[o + 3] = step === 4 ? buf[i + 3] : 255;
    }
  }
  return { w, h, rgba: out, alpha: step === 4 };
}

/**
 * A flipbook: one sheet of animation frames (fire, smoke, explosions) for a camera-facing sprite.
 *   npm run assets -- pack flipbook:<sheet.tga|.png> --id=fire-flame --cols=16 --rows=4 --blend=additive|alpha
 *        --licence=CC0 --author="..." --page=<url> [--size=1024] [--frames=64] [--fps=30]
 * additive: black background, drawn as light (flames, sparks). alpha: drawn over the scene (smoke, dust).
 */
async function packFlipbook(ref) {
  for (const k of ['id', 'cols', 'rows', 'licence']) if (!args[k]) fail(`flipbook packs need --${k}`);
  if (!/^(CC0|CC-BY(-[34]\.0)?)$/.test(args.licence)) fail(`licence ${args.licence} is not CC0 or CC-BY`);
  const sharp = (await import('sharp')).default;
  const src = resolve(ref);
  let img;
  if (/\.tga$/i.test(src)) {
    const t = readTGA(readFileSync(src));
    img = sharp(t.rgba, { raw: { width: t.w, height: t.h, channels: 4 } });
  } else img = sharp(src).ensureAlpha();
  const cols = Number(args.cols), rows = Number(args.rows), size = Number(args.size ?? 1024);
  const blend = args.blend === 'alpha' ? 'alpha' : 'additive';
  const meta = await img.clone().metadata();
  const width = Math.min(size, meta.width ?? size);
  let pipe = img.resize({ width });
  // an additive sheet needs no alpha: black is nothing
  const bytes = blend === 'additive'
    ? await pipe.removeAlpha().webp({ quality: Number(args.quality ?? 82) }).toBuffer()
    : await pipe.webp({ quality: Number(args.quality ?? 82), alphaQuality: 90 }).toBuffer();
  const id = args.id;
  const file = join('flipbooks', `${id}.webp`);
  mkdirSync(join(LIB, 'flipbooks'), { recursive: true });
  writeFileSync(join(LIB, file), bytes);
  const entry = {
    id, kind: 'flipbook', name: args.name ?? id, source: args.source ?? 'file', page: args.page ?? '', licence: args.licence,
    authors: [args.author ?? 'unknown'], read: new Date().toISOString().slice(0, 10), file,
    cols, rows, frames: Number(args.frames ?? cols * rows), fps: Number(args.fps ?? 30), blend, px: [width, Math.round(width * (meta.height / meta.width))],
    bytes: bytes.length, inline_kb: kb(Math.ceil(bytes.length / 3) * 4),
    tags: args.tags ? String(args.tags).split(',') : ['vfx'], grade: args.grade ?? 'B', use: args.use ?? '',
  };
  const cat = readCatalog();
  cat.assets = cat.assets.filter((a) => a.id !== id);
  cat.assets.push(entry);
  writeCatalog(cat);
  console.log(JSON.stringify({ ok: true, id, kind: 'flipbook', kb: kb(bytes.length), px: entry.px, frames: entry.frames, blend }));
}

/**
 * A sound or music track, re-encoded mono MP3 (every browser decodes it), optionally trimmed with a fade.
 *   npm run assets -- pack patch:incompetech:<id> [--kbps=56] [--start=0] [--seconds=90] [--fade=3]
 * At runtime assets.sound(id) is a decoded AudioBuffer, usable in the live and the offline (recorder) context.
 */
async function packAudio(meta, opts) {
  const { execFileSync } = await import('node:child_process');
  const src = meta.files.audio ?? Object.values(meta.files)[0];
  const full = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString().trim());
  const start = Number(args.start ?? 0);
  const seconds = Math.min(Number(args.seconds ?? full - start), full - start);
  const fade = Number(args.fade ?? (seconds < full - start ? 3 : 0));
  const out = join(LIB, 'audio', `${opts.id}.mp3`);
  mkdirSync(join(LIB, 'audio'), { recursive: true });
  const af = [`afade=t=in:d=${Math.min(0.05, seconds / 4)}`];
  if (fade) af.push(`afade=t=out:st=${(seconds - fade).toFixed(2)}:d=${fade}`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(start), '-t', String(seconds), '-i', src, '-ac', '1', '-ar', '44100', '-af', af.join(','), '-b:a', `${Number(args.kbps ?? 56)}k`, out]);
  return { file: relative(LIB, out), seconds: +seconds.toFixed(2), seconds_source: +full.toFixed(2), kbps: Number(args.kbps ?? 56) };
}

async function pack(spec) {
  if (spec.startsWith('anims:')) return packAnims(spec.slice(6));
  if (spec.startsWith('flipbook:')) return packFlipbook(spec.slice(9));
  const m = spec.match(/^(patch|polyhaven|ambientcg|file):(.+)$/);
  if (!m) fail(`pack wants patch:<patch-id>, polyhaven:<id>, ambientcg:<id> or file:<path>, got ${spec}`);
  const [, source, ref] = m;
  let meta;
  if (source === 'patch') meta = await fetchPatch(ref);
  else if (source === 'polyhaven') meta = await fetchPolyHaven(ref, args.res ?? (args.kind === 'sky' ? '2k' : '1k'));
  else if (source === 'ambientcg') meta = await fetchAmbientCG(ref, args.res ?? '1K');
  else {
    if (!args.id || !args.licence) fail('file: packs need --id, --licence, --author and --page');
    if (!/^(CC0|CC-BY(-[34]\.0)?)$/.test(args.licence)) fail(`licence ${args.licence} is not CC0 or CC-BY; the library takes nothing else`);
    const p = resolve(ref);
    meta = { source: args.source ?? 'file', id: args.id, kind: 'model', name: args.name ?? args.id, authors: [args.author ?? 'unknown'], licence: args.licence, page: args.page ?? '', tags: [], files: { [p.endsWith('.glb') ? 'glb' : 'gltf']: p }, fetched: new Date().toISOString().slice(0, 10) };
  }
  if (meta.kind === 'sky' && meta.source === 'polyhaven' && meta.res === '1k') meta = await fetchPolyHaven(ref, '2k');
  const id = args.id ?? meta.id;
  const opts = { id, tex: Number(args.tex ?? (meta.kind === 'material' ? 1024 : 512)), quality: Number(args.quality ?? 80), tris: Number(args.tris ?? 0), bg: args.bg ? Number(args.bg) : undefined };
  const built = meta.kind === 'model' ? await packModel(meta, opts) : meta.kind === 'material' ? await packMaterial(meta, opts) : meta.kind === 'audio' ? await packAudio(meta, opts) : await packSky(meta, opts);
  const bytes = [built.file, built.env_file].filter(Boolean).reduce((s, f) => s + statSync(join(LIB, f)).size, 0);
  const cat = readCatalog();
  const old = cat.assets.find((a) => a.id === id);
  const entry = {
    id, kind: meta.kind, name: meta.name, source: meta.source, page: meta.page, licence: meta.licence, authors: meta.authors,
    ...(meta.source === 'patch' ? { upstream: meta.upstream, patch_id: meta.patch_id, credit: meta.credit, ai: meta.ai } : {}),
    ...(args.credit || (meta.source !== 'patch' && old?.credit) ? { credit: String(args.credit ?? old.credit) } : {}),
    read: meta.fetched, ...built, bytes, inline_kb: kb(Math.ceil(bytes / 3) * 4),
    tex: meta.kind === 'sky' || meta.kind === 'audio' ? undefined : opts.tex,
    tags: args.tags ? String(args.tags).split(',') : old?.tags ?? meta.tags.slice(0, 8),
    grade: args.grade ?? old?.grade ?? 'B', use: args.use ?? old?.use ?? '',
  };
  cat.assets = cat.assets.filter((a) => a.id !== id);
  cat.assets.push(entry);
  writeCatalog(cat);
  console.log(JSON.stringify({ ok: true, id, kind: entry.kind, kb: kb(bytes), tris: entry.tris, size_m: entry.size_m, tile_m: entry.tile_m, sun: entry.sun }));
}

/* -------------------------------------------------------------------------- */
/*  add / remove / list / credits                                             */
/* -------------------------------------------------------------------------- */

function gameAssetsDir() {
  if (!args.game) fail('needs --game=games/<slug>');
  const g = resolve(ROOT, args.game);
  if (!existsSync(join(g, 'index.html'))) fail(`no game at ${g}`);
  return join(g, 'src', 'assets');
}

const ident = (id) => 'a_' + id.replace(/[^a-zA-Z0-9_]/g, '_');

/** A library GLB with its textures scaled down to `size`, for a game on a tight budget. */
async function downsized(rel, size, tris = 0) {
  const t = await gltfTools();
  const doc = await t.io.read(join(LIB, rel));
  if (tris && countTris(doc) > tris) {
    // Quantized attributes can't be simplified in place: dequantize, simplify, requantize.
    await doc.transform(t.fn.dequantize(), t.fn.weld(), t.fn.simplify({ simplifier: t.MeshoptSimplifier, ratio: tris / countTris(doc), error: 0.02 }), t.fn.quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  }
  if (size) {
    await doc.transform(
      t.fn.textureCompress({ encoder: t.sharp, targetFormat: 'webp', resize: [size, size], quality: 88, slots: /^normalTexture$/ }),
      t.fn.textureCompress({ encoder: t.sharp, targetFormat: 'webp', resize: [size, size], quality: 80 }),
    );
  }
  return Buffer.from(await t.io.writeBinary(doc));
}

/**
 * `id`, `id@512` (textures capped at 512 px for this game only), `id~4000`
 * (triangles capped) or `id@512~4000`.
 */
const splitSpec = (spec) => {
  const m = spec.match(/^([^@~]+)(?:@(\d+))?(?:~(\d+))?$/);
  if (!m) fail(`bad asset spec ${spec}`);
  return { id: m[1], size: Number(m[2] ?? 0), tris: Number(m[3] ?? 0) };
};

async function writeGameAssets(dir, specs) {
  const cat = readCatalog();
  const byId = new Map(cat.assets.map((a) => [a.id, a]));
  const ids = specs.map((s) => splitSpec(s).id);
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) fail(`not in the library: ${missing.join(', ')}. See: npm run assets -- list`);
  mkdirSync(join(dir, 'data'), { recursive: true });
  for (const f of readdirSync(join(dir, 'data'))) if (!ids.includes(f.replace(/\.js$/, ''))) rmSync(join(dir, 'data', f));
  cpSync(join(LIB, 'runtime', 'library.js'), join(dir, 'library.js'));
  let total = 0;
  const lines = [];
  const entries = [];
  for (const spec of specs) {
    const { id, size, tris } = splitSpec(spec);
    const a = byId.get(id);
    const files = { data: a.file, env: a.env_file };
    const parts = [];
    for (const [key, rel] of Object.entries(files)) {
      if (!rel) continue;
      const bytes = (size || tris) && key === 'data' && (a.kind === 'model' || a.kind === 'material') ? await downsized(rel, size, a.kind === 'model' ? tris : 0) : readFileSync(join(LIB, rel));
      total += bytes.length;
      parts.push(`export const ${key} = '${bytes.toString('base64')}';`);
    }
    const hash = createHash('sha1').update(parts.join('')).digest('hex').slice(0, 10);
    writeFileSync(join(dir, 'data', `${id}.js`), `// ${a.name}, ${a.licence}, ${a.page}\n${parts.join('\n')}\n`);
    lines.push(`import * as ${ident(id)} from './data/${id}.js'; // ${hash}`);
    const { file, env_file, bytes: _b, inline_kb, read, ...keep } = a;
    entries.push(`  ${JSON.stringify(id)}: { ...${JSON.stringify(keep)}, ...${ident(id)} },`);
  }
  const index = `// Generated by \`npm run assets -- add\`. Don't edit: run the command again.
// Assets: ${ids.join(', ')}
import { createLibrary } from './library.js';
${lines.join('\n')}

export const catalog = {
${entries.join('\n')}
};

/** Every asset decoded and ready. See skills/asset-library/SKILL.md. */
export const assets = await createLibrary(catalog);
`;
  writeFileSync(join(dir, 'index.js'), index);
  writeFileSync(join(dir, 'assets.json'), JSON.stringify(specs, null, 1) + '\n');
  return { assets: specs, binary_kb: kb(total), inline_kb: kb(Math.ceil(total / 3) * 4) };
}

async function add(specs, removing = false) {
  const dir = gameAssetsDir();
  const listFile = join(dir, 'assets.json');
  let have = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : [];
  const named = new Set(specs.map((s) => splitSpec(s).id));
  have = have.filter((s) => !named.has(splitSpec(s).id));
  if (!removing) have.push(...specs);
  const r = await writeGameAssets(dir, have);
  console.log(JSON.stringify({ ok: true, game: args.game, import: "import { assets } from '../assets/index.js';", ...r, note: 'inline_kb is what the assets add to the HTML file' }));
}

function list() {
  const cat = readCatalog();
  let rows = cat.assets;
  if (args.kind) rows = rows.filter((a) => a.kind === args.kind);
  if (args.tag) rows = rows.filter((a) => a.tags.includes(args.tag));
  if (args.md || args.skill) {
    const out = [];
    const heads = { model: '**Models** (x × y × z metres, y up; KB = added to the HTML)', material: '**Materials** (one tile in metres)', sky: '**Skies** (sun elevation)' };
    for (const kind of ['model', 'material', 'sky']) {
      const r = rows.filter((a) => a.kind === kind && !/_candidate$/.test(a.id)).sort((a, b) => a.tags[0] === b.tags[0] ? a.id.localeCompare(b.id) : String(a.tags[0]).localeCompare(String(b.tags[0])));
      if (!r.length) continue;
      out.push('', heads[kind], '', `| id | ${kind === 'model' ? 'size' : kind === 'material' ? 'tile' : 'sun'} | KB | use |`, '|---|---|---|---|');
      for (const a of r) {
        const dim = kind === 'model' ? a.size_m.map((v) => v.toFixed(2)).join('×') : kind === 'material' ? a.tile_m.join('×') : `${a.sun.elevation_deg}°`;
        out.push(`| \`${a.id}\` | ${dim} | ${a.inline_kb} | ${a.use || a.name}${a.licence !== 'CC0' ? ` (${a.licence}: credit)` : ''} |`);
      }
    }
    if (args.skill) {
      const f = join(ROOT, 'skills', 'asset-library', 'SKILL.md');
      const s = readFileSync(f, 'utf8');
      const a = '<!-- table:start -->';
      const b = '<!-- table:end -->';
      writeFileSync(f, s.slice(0, s.indexOf(a) + a.length) + '\n' + out.join('\n') + '\n\n' + s.slice(s.indexOf(b)));
      console.log(JSON.stringify({ ok: true, file: 'skills/asset-library/SKILL.md', rows: out.length }));
    } else console.log(out.join('\n'));
    return;
  }
  for (const a of rows) console.log(`${a.kind.padEnd(8)} ${a.id.padEnd(34)} ${String(a.inline_kb).padStart(5)} KB  ${a.grade}  ${a.use || a.name}`);
  console.log(`${rows.length} assets, ${kb(rows.reduce((s, a) => s + a.bytes, 0))} KB on disk`);
}

function credits() {
  const dir = gameAssetsDir();
  const ids = JSON.parse(readFileSync(join(dir, 'assets.json'), 'utf8'));
  const cat = readCatalog();
  for (const spec of ids) {
    const a = cat.assets.find((x) => x.id === splitSpec(spec).id);
    console.log(`${a.name} by ${a.authors.join(', ')}, ${a.licence}, ${a.page}`);
  }
}

/**
 * Render every asset (or --ids=a,b) to a 480x480 JPEG in --out (default
 * references/audit/assets/), lit by --sky. One browser page, closed at the end.
 * --side renders models in an orthographic side view (for placing held items).
 */
async function sheet() {
  const cat = readCatalog();
  const ids = args.ids ? String(args.ids).split(',') : cat.assets.map((a) => a.id);
  const sky = args.sky ?? cat.assets.find((a) => a.kind === 'sky')?.id;
  const out = resolve(ROOT, args.out ?? 'references/audit/assets');
  mkdirSync(out, { recursive: true });
  const tmp = join(CACHE, 'sheet');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'src'), { recursive: true });
  writeFileSync(join(tmp, 'index.html'), '<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="480" height="480"></canvas><script type="module" src="/src/main.js"></script></body></html>');
  const all = [...new Set([...ids, sky].filter(Boolean))];
  await writeGameAssets(join(tmp, 'src', 'assets'), all);
  writeFileSync(join(tmp, 'src', 'main.js'), `import * as THREE from 'three';
import { assets } from './assets/index.js';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const ctx = { scene, viewScene: null, get: (k) => (k === 'render' ? { renderer } : null) };
const sky = ${JSON.stringify(sky)};
const sun = sky ? assets.sky(ctx, sky, { background: false, env: 1 }) : { sunDir: [0.5, 0.8, 0.3] };
scene.background = new THREE.Color('#24272b');
const light = new THREE.DirectionalLight('#fff4e6', 2.2);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
scene.add(light, light.target);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.9 }));
floor.receiveShadow = true;
scene.add(floor);
let current = null;
window.show = (id, side) => {
  if (current) scene.remove(current);
  window.frameInfo = null;
  const a = assets.catalog[id];
  const cam = side ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100) : new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  if (a.kind === 'model') {
    current = assets.model(id);
    const box = new THREE.Box3().setFromObject(current);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z);
    window.frameInfo = { size: size.toArray() };
    floor.visible = !side;
    floor.scale.setScalar(r * 1.5);
    floor.position.set(c.x, box.min.y - 0.002, c.z);
    if (side) {
      cam.left = -r * 0.55; cam.right = r * 0.55; cam.top = r * 0.55; cam.bottom = -r * 0.55;
      cam.position.set(c.x, c.y, c.z + r * 3);
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      window.frameInfo = { size: size.toArray(), min: box.min.toArray(), max: box.max.toArray(), half: r * 0.55, center: c.toArray() };
    } else {
      const d = (r * 0.5) / Math.tan((35 * Math.PI) / 360) * 1.45;
      cam.position.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.66);
      cam.lookAt(c);
    }
    light.position.set(c.x + r * 2, c.y + r * 4, c.z + r * 1.5);
    light.target.position.copy(c);
    const s = light.shadow.camera; s.left = s.bottom = -r; s.right = s.top = r; s.far = r * 10; s.updateProjectionMatrix();
  } else if (a.kind === 'material') {
    floor.visible = false;
    current = new THREE.Group();
    const m = assets.material(id, { size: [2, 2] });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 96, 64), m);
    ball.position.set(0.15, 0.5, 0.1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), m);
    ball.castShadow = true; ground.receiveShadow = true;
    current.add(ball, ground);
    cam.position.set(1.5, 1.25, 1.8);
    cam.lookAt(0, 0.35, 0);
    light.position.set(2, 4, 1.5);
    light.target.position.set(0, 0, 0);
  } else {
    floor.visible = false;
    assets.sky(ctx, id, { background: true });
    current = new THREE.Group();
    const chrome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 64, 32), new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.05 }));
    const clay = new THREE.Mesh(new THREE.SphereGeometry(0.4, 64, 32), new THREE.MeshStandardMaterial({ color: '#bbbbbb', roughness: 0.6 }));
    chrome.position.set(-0.45, 0, 0); clay.position.set(0.45, 0, 0);
    current.add(chrome, clay);
    light.intensity = 0;
    cam.fov = 70; cam.updateProjectionMatrix?.();
    const sd = new THREE.Vector3(...a.sun.dir);
    cam.position.set(-sd.x * 2.2, 0.35, -sd.z * 2.2);
    cam.lookAt(sd.x * 3, 0.6, sd.z * 3);
  }
  scene.add(current);
  renderer.render(scene, cam);
  if (a.kind === 'sky') { scene.background = new THREE.Color('#24272b'); assets.sky(ctx, sky, { background: false }); light.intensity = 2.2; }
  return true;
};
window.ready = true;
`);
  const { build } = await import('vite');
  const { viteSingleFile } = await import('vite-plugin-singlefile');
  await build({ root: tmp, configFile: false, plugins: [viteSingleFile()], logLevel: 'error', build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 50000 } });
  const { launch } = await import('./lib/harness.mjs');
  const browser = await launch(args);
  const info = {};
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
    page.on('pageerror', (e) => console.error('page error', e.message));
    await page.goto('file://' + join(tmp, 'dist', 'index.html'));
    await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
    for (const id of ids) {
      await page.evaluate(([i, s]) => window.show(i, s), [id, !!args.side]);
      info[id] = await page.evaluate(() => window.frameInfo);
      await page.locator('#c').screenshot({ path: join(out, `${id}${args.side ? '.side' : ''}.jpg`), type: 'jpeg', quality: 82 });
      console.log(`shot ${id}`);
    }
  } finally {
    await browser.close();
  }
  // The renderer's bounds are the truth (some sources nest scale in odd ways):
  // write them back as size_m.
  const fresh = readCatalog();
  for (const a of fresh.assets) {
    const f = info[a.id];
    if (a.kind === 'model' && f?.size) a.size_m = f.size.map((v) => +v.toFixed(3));
  }
  writeCatalog(fresh);
  if (args.side) console.log(JSON.stringify(info));
}

if (cmd === 'pack') {
  let bad = 0;
  for (const s of rest) {
    try {
      await pack(s);
    } catch (e) {
      bad++;
      console.error(JSON.stringify({ ok: false, spec: s, error: String(e.message ?? e) }));
    }
  }
  if (bad) process.exitCode = 1;
}
else if (cmd === 'sheet') await sheet();
else if (cmd === 'search') {
  // Live search of Patch. --type=model|material|hdri, --real (realistic only), --ai=any, --limit=N
  const { total, hits } = await patchSearch(rest.join(' '), { type: args.type ?? 'model', limit: Number(args.limit ?? 12), ai: args.ai ?? 'false', real: !!args.real });
  console.log(`${total} on Patch; pack one with: npm run assets -- pack patch:<id>`);
  for (const h of hits) {
    const f = h.fit ?? {};
    console.log([h.id.padEnd(50), h.source.slice(0, 14).padEnd(14), (PATCH_LICENCES[h.license] ?? h.license).padEnd(9), h.ai ? 'AI' : '  ', `raw ${f.mb} MB`.padEnd(12), f.triangles ? `${f.triangles} tris` : '', (f.dims_m ?? []).map((v) => v.toFixed(2)).join('×'), (h.traits ?? []).join(',')].join('  '));
  }
}
else if (cmd === 'drop') {
  // Take assets out of the library (files and catalog entry).
  const cat = readCatalog();
  for (const id of rest) {
    const a = cat.assets.find((x) => x.id === id);
    if (!a) continue;
    for (const f of [a.file, a.env_file].filter(Boolean)) rmSync(join(LIB, f), { force: true });
    cat.assets = cat.assets.filter((x) => x.id !== id);
  }
  writeCatalog(cat);
  console.log(JSON.stringify({ ok: true, dropped: rest, left: cat.assets.length }));
}
else if (cmd === 'add') await add(rest);
else if (cmd === 'remove') await add(rest, true);
else if (cmd === 'list') list();
else if (cmd === 'credits') credits();
else if (cmd === 'credits-md') {
  // assets/CREDITS.md, generated from the catalogue so it can't drift.
  const cat = readCatalog();
  const SRC = { polyhaven: 'Poly Haven (polyhaven.com), CC0', ambientcg: 'ambientCG (ambientcg.com), CC0', khronos: 'Khronos glTF-Sample-Assets (per-model licence)', file: 'Other' };
  const out = ['# Asset credits', '', 'Generated by `npm run assets -- credits-md` from `assets/catalog.json`. Every asset here is CC0 unless its row says otherwise; CC-BY rows must also be credited inside any game that uses them (the loader\'s `assets.credits()` writes that line).', ''];
  SRC.patch = 'Fetched through Patch (patch.gg): the credit is the one Patch returns';
  for (const src of [...new Set(cat.assets.map((a) => a.source))]) {
    if (src === 'patch') {
      out.push(`## ${SRC.patch}`, '', '| Asset | Kind | From | Licence | Credit | Read |', '|---|---|---|---|---|---|');
      for (const a of cat.assets.filter((x) => x.source === src)) out.push(`| \`${a.id}\` | ${a.kind} | ${a.upstream} (\`${a.patch_id}\`)${a.ai ? ', AI-made' : ''} | ${a.licence} | ${String(a.credit).replace(/\|/g, '/')} | ${a.read} |`);
      out.push('');
      continue;
    }
    out.push(`## ${SRC[src] ?? src}`, '', '| Asset | Kind | Author | Licence | Page | Read | Credit |', '|---|---|---|---|---|---|---|');
    for (const a of cat.assets.filter((x) => x.source === src)) out.push(`| \`${a.id}\` ${a.name} | ${a.kind} | ${a.authors.join(', ')} | ${a.licence} | ${a.page} | ${a.read} | ${String(a.credit ?? '').replace(/\|/g, '/')} |`);
    out.push('');
  }
  writeFileSync(join(LIB, 'CREDITS.md'), out.join('\n'));
  console.log(JSON.stringify({ ok: true, file: 'assets/CREDITS.md', assets: cat.assets.length }));
}
else {
  console.error('usage: npm run assets -- list | add <id...> --game=games/x | remove <id> --game=games/x | credits --game=games/x | pack polyhaven:<id>|ambientcg:<id>|file:<path>');
  process.exit(2);
}
