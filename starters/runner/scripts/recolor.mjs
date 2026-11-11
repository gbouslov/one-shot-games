// Recolour the courier: the KayKit rogue's green cloth becomes rust and ember, so the
// courier reads as their own (and as someone who walks through fire).
// Step 2 of 2 for src/game/assets/courier/rogue-hooded-runner.glb (after pack-runner.mjs).
//   node starters/runner/scripts/recolor.mjs <in.glb> <out.glb> [--dump=texture.png]
// Needs @gltf-transform/core, /extensions and sharp where NODE_TOOLS points
// (default: the repo's .scratch/tools, which is not committed).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_TOOLS ?? new URL('../../../.scratch/tools/package.json', import.meta.url));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const sharp = require('sharp');

const [inFile, out] = process.argv.slice(2);
const opt = Object.fromEntries(process.argv.slice(4).map((a) => a.replace(/^--/, '').split('=')));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.readBinary(new Uint8Array(fs.readFileSync(inFile)));
const texs = doc.getRoot().listTextures();
const t = texs[0];
if (opt.dump) fs.writeFileSync(opt.dump, t.getImage());
const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const rgb2hsl = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl2rgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};
let changed = 0;
for (let i = 0; i < info.width * info.height; i++) {
  const k = i * 4;
  const [h, s, l] = rgb2hsl(data[k] / 255, data[k + 1] / 255, data[k + 2] / 255);
  if (h > 70 && h < 170 && s > 0.15) {
    // green cloth -> deep rust red, a touch darker
    const [r, g, b] = hsl2rgb(8 + (h - 120) * 0.15, Math.min(1, s * 0.95), l * 0.8);
    data[k] = r * 255; data[k + 1] = g * 255; data[k + 2] = b * 255;
    changed++;
  }
}
const png = await sharp(data, { raw: info }).png({ compressionLevel: 9, palette: true }).toBuffer();
t.setImage(new Uint8Array(png));
fs.writeFileSync(out, await io.writeBinary(doc));
console.log('recoloured px', changed, 'of', info.width * info.height, 'png bytes', png.length);
