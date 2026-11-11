// All art is drawn in code onto one canvas atlas, then handed to the engine as a texture.
// A sprite is a function that paints into a w x h box with the Canvas 2D API, so a new game
// changes its look by rewriting src/game/art.js, never by finding image files.
import * as LJS from './engine.js';

/**
 * entries: { name: { w, h, frames = 1, draw(ctx, w, h, frame) } }
 * Returns { canvas, rects } where rects[name] = [{x, y, w, h}, ...] one per frame.
 */
export function packAtlas(entries, { gutter = 3, width = 1024 } = {}) {
  const list = Object.entries(entries).map(([name, e]) => ({ name, ...e, frames: e.frames ?? 1 }));
  // tallest first packs shelves tighter
  list.sort((a, b) => b.h - a.h);
  let x = gutter;
  let y = gutter;
  let shelf = 0;
  const rects = {};
  for (const e of list) {
    rects[e.name] = [];
    for (let f = 0; f < e.frames; f++) {
      if (x + e.w + gutter > width) {
        x = gutter;
        y += shelf + gutter;
        shelf = 0;
      }
      rects[e.name].push({ x, y, w: e.w, h: e.h, f });
      x += e.w + gutter;
      shelf = Math.max(shelf, e.h);
    }
  }
  const height = 2 ** Math.ceil(Math.log2(y + shelf + gutter));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  for (const e of list) {
    for (const r of rects[e.name]) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.beginPath();
      ctx.rect(0, 0, r.w, r.h);
      ctx.clip();
      e.draw(ctx, r.w, r.h, r.f);
      ctx.restore();
    }
  }
  return { canvas, rects };
}

/** After the engine has started: a TextureInfo for the atlas and a TileInfo (or list for frames) per sprite. */
export function atlasTiles({ canvas, rects }) {
  const texture = new LJS.TextureInfo(canvas, true, false, false);
  const tiles = {};
  for (const [name, list] of Object.entries(rects)) {
    const infos = list.map((r) => new LJS.TileInfo(LJS.vec2(r.x, r.y), LJS.vec2(r.w, r.h), texture, 0, 0));
    tiles[name] = infos.length === 1 ? infos[0] : infos;
  }
  return { texture, tiles };
}

/* ---------- painting helpers used by the game's art ---------- */

export function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

/** A soft round glow, white, for additive light sprites; tint it when drawing. */
export function drawGlow(ctx, w, h, falloff = 2.2) {
  const r = Math.min(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    g.addColorStop(t, `rgba(255,255,255,${(1 - t) ** falloff})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A rounded rectangle path. */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A filled circle with a soft top-left highlight and a dark bottom-right rim: reads as lit from above. */
export function litBall(ctx, x, y, r, base, light, dark) {
  ctx.fillStyle = radial(ctx, x - r * 0.35, y - r * 0.4, r * 1.5, [[0, light], [0.45, base], [1, dark]]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
