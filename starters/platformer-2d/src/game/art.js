// Every picture in the default game, painted in code. Rewrite this file to change the look.
// Sprites go into one atlas (kit/art.js); the terrain and the backdrops are painted straight
// onto their own canvases.
import { radial, linear, drawGlow, roundRect, litBall } from '../kit/art.js';
import { stream } from '../kit/rng.js';
import { palette as P } from './config.js';

const TAU = Math.PI * 2;

/* ---------------- sprites ---------------- */

function robotBody(ctx, w, h, frame) {
  // a small round brass robot with a visor; frame 1 blinks
  const cx = w / 2;
  const cy = h * 0.56;
  const r = w * 0.36;
  // shadow side rim
  ctx.fillStyle = radial(ctx, cx - r * 0.35, cy - r * 0.45, r * 1.6, [[0, P.robotLight], [0.4, P.robot], [0.85, P.robotDark], [1, '#2a120c']]);
  roundRect(ctx, cx - r, cy - r * 0.95, r * 2, r * 1.95, r * 0.82);
  ctx.fill();
  // warm rim light from the sun (right)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = P.rim;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = w * 0.05;
  ctx.beginPath();
  ctx.arc(cx - r * 0.12, cy, r * 1.02, -0.9, 0.9);
  ctx.stroke();
  ctx.restore();
  // belly plate
  ctx.fillStyle = 'rgba(255,230,190,.18)';
  roundRect(ctx, cx - r * 0.42, cy + r * 0.28, r * 0.84, r * 0.42, r * 0.18);
  ctx.fill();
  // rivets
  ctx.fillStyle = 'rgba(60,25,10,.55)';
  for (const sx of [-0.62, 0.62]) {
    ctx.beginPath();
    ctx.arc(cx + sx * r, cy + r * 0.48, w * 0.018, 0, TAU);
    ctx.fill();
  }
  // visor
  const vx = cx - r * 0.72;
  const vy = cy - r * 0.55;
  ctx.fillStyle = linear(ctx, 0, vy, 0, vy + r * 0.8, [[0, '#2b2350'], [1, P.visor]]);
  roundRect(ctx, vx, vy, r * 1.44, r * 0.78, r * 0.36);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = w * 0.02;
  ctx.stroke();
  // eyes
  const eyeY = vy + r * 0.39;
  for (const ex of [-0.3, 0.3]) {
    const x = cx + ex * r + r * 0.08;
    if (frame === 1) {
      ctx.fillStyle = P.eye;
      ctx.fillRect(x - r * 0.15, eyeY - w * 0.012, r * 0.3, w * 0.024);
    } else {
      ctx.fillStyle = radial(ctx, x, eyeY, r * 0.24, [[0, '#ffffff'], [0.35, P.eye], [1, 'rgba(120,240,255,0)']]);
      ctx.beginPath();
      ctx.arc(x, eyeY, r * 0.24, 0, TAU);
      ctx.fill();
    }
  }
  // visor glare
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  roundRect(ctx, vx + r * 0.16, vy + r * 0.08, r * 0.5, r * 0.12, r * 0.06);
  ctx.fill();
  // antenna stalk
  ctx.strokeStyle = P.robotDark;
  ctx.lineWidth = w * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.1, cy - r * 0.92);
  ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 1.2, cx + r * 0.15, cy - r * 1.32);
  ctx.stroke();
}

function robotLeg(ctx, w, h) {
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, '#3a1c12'], [0.6, '#6a3622'], [1, '#2a120c']]);
  roundRect(ctx, w * 0.3, 0, w * 0.4, h * 0.7, w * 0.18);
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, h * 0.6, 0, h, [[0, P.robot], [1, P.robotDark]]);
  roundRect(ctx, w * 0.08, h * 0.58, w * 0.84, h * 0.4, h * 0.18);
  ctx.fill();
}

function bulb(ctx, w, h) {
  litBall(ctx, w / 2, h / 2, w * 0.36, P.bulb, '#ffffff', '#c06a10');
}

function seed(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.3;
  ctx.fillStyle = radial(ctx, cx - r * 0.3, cy - r * 0.35, r * 1.4, [[0, '#fffbe0'], [0.35, P.seed], [1, '#b8661a']]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, TAU);
  ctx.fill();
  // little leaf
  ctx.fillStyle = P.leaf;
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.45, cy - r * 1.05, r * 0.42, r * 0.2, -0.6, 0, TAU);
  ctx.fill();
  // seam
  ctx.strokeStyle = 'rgba(150,70,10,.5)';
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.quadraticCurveTo(cx + r * 0.3, cy, cx, cy + r * 0.9);
  ctx.stroke();
}

function bug(ctx, w, h, frame) {
  const cx = w / 2;
  const cy = h * 0.55;
  // legs, three a side, two poses
  ctx.strokeStyle = '#1a0d22';
  ctx.lineWidth = w * 0.045;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const lx = cx + (i - 1) * w * 0.2;
    const kick = (frame + i) % 2 ? 0.06 : -0.06;
    ctx.beginPath();
    ctx.moveTo(lx, cy + h * 0.08);
    ctx.lineTo(lx + w * (kick + 0.04), cy + h * 0.24);
    ctx.lineTo(lx + w * (kick * 2), cy + h * 0.38);
    ctx.stroke();
  }
  // shell
  ctx.fillStyle = radial(ctx, cx - w * 0.1, cy - h * 0.25, w * 0.6, [[0, P.bugSheen], [0.35, P.bug], [1, '#140a1c']]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.4, h * 0.3, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // thorns on the shell
  ctx.fillStyle = '#24112e';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + (i + 0.6) * (Math.PI / 4.4);
    const x = cx + Math.cos(a) * w * 0.38;
    const y = cy + Math.sin(a) * h * 0.28;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.04, y + h * 0.02);
    ctx.lineTo(x + Math.cos(a) * w * 0.12, y + Math.sin(a) * h * 0.14);
    ctx.lineTo(x + w * 0.04, y + h * 0.02);
    ctx.fill();
  }
  // rim light
  ctx.strokeStyle = 'rgba(255,190,150,.55)';
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.39, h * 0.29, 0, -1.2, -0.15);
  ctx.stroke();
  // belly
  ctx.fillStyle = '#1a0d22';
  ctx.fillRect(cx - w * 0.4, cy - 1, w * 0.8, h * 0.07);
  // head
  ctx.fillStyle = '#1e0f28';
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.36, cy - h * 0.02, w * 0.14, h * 0.12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = radial(ctx, cx + w * 0.42, cy - h * 0.05, w * 0.06, [[0, '#fff'], [0.4, P.bugEye], [1, 'rgba(255,60,90,0)']]);
  ctx.beginPath();
  ctx.arc(cx + w * 0.42, cy - h * 0.05, w * 0.06, 0, TAU);
  ctx.fill();
}

function beaconStone(ctx, w, h) {
  // a tall carved stone with a cradle at the top
  const g = linear(ctx, 0, 0, w, 0, [[0, '#1d1430'], [0.45, P.stone], [0.7, '#7b6390'], [1, '#2a1d3c']]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h);
  ctx.lineTo(w * 0.3, h * 0.2);
  ctx.lineTo(w * 0.14, h * 0.14);
  ctx.lineTo(w * 0.24, h * 0.09);
  ctx.lineTo(w * 0.76, h * 0.09);
  ctx.lineTo(w * 0.86, h * 0.14);
  ctx.lineTo(w * 0.7, h * 0.2);
  ctx.lineTo(w * 0.78, h);
  ctx.closePath();
  ctx.fill();
  // carved rings
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 3;
  for (const t of [0.35, 0.55, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * t);
    ctx.lineTo(w * 0.73, h * t);
    ctx.stroke();
  }
  // glyphs that glow faintly
  ctx.fillStyle = 'rgba(140,240,255,.35)';
  for (const t of [0.44, 0.64, 0.84]) {
    ctx.beginPath();
    ctx.arc(w * 0.5, h * t, w * 0.05, 0, TAU);
    ctx.fill();
  }
  // rim
  ctx.strokeStyle = 'rgba(255,200,160,.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.2);
  ctx.lineTo(w * 0.78, h);
  ctx.stroke();
}

function crystal(ctx, w, h) {
  ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#ffffff'], [0.35, P.crystal], [1, '#2a6a9a']]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.85, h * 0.45);
  ctx.lineTo(w * 0.5, h);
  ctx.lineTo(w * 0.15, h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.5, h);
  ctx.lineTo(w * 0.15, h * 0.45);
  ctx.closePath();
  ctx.fill();
}

function lantern(ctx, w, h) {
  // a post with a hanging lantern for checkpoints
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, '#2a1a1c'], [0.5, '#5a3a34'], [1, '#2a1a1c']]);
  ctx.fillRect(w * 0.42, h * 0.15, w * 0.16, h * 0.85);
  ctx.fillRect(w * 0.42, h * 0.15, w * 0.4, h * 0.06);
  ctx.strokeStyle = '#2a1a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.2);
  ctx.lineTo(w * 0.76, h * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#3a2420';
  roundRect(ctx, w * 0.64, h * 0.3, w * 0.24, h * 0.2, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,150,.35)';
  ctx.fillRect(w * 0.68, h * 0.33, w * 0.16, h * 0.14);
}

function beam(ctx, w, h) {
  // a vertical light shaft, white, tinted when drawn
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,1)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function shard(ctx, w, h) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w, h * 0.5);
  ctx.lineTo(w * 0.5, h);
  ctx.lineTo(0, h * 0.5);
  ctx.closePath();
  ctx.fill();
}

function puff(ctx, w, h) {
  ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 'rgba(255,255,255,.9)'], [0.6, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, 0, w, h);
}

export const sprites = {
  robot: { w: 112, h: 112, frames: 2, draw: robotBody },
  leg: { w: 28, h: 36, draw: robotLeg },
  bulb: { w: 32, h: 32, draw: bulb },
  seed: { w: 72, h: 72, draw: seed },
  bug: { w: 112, h: 80, frames: 2, draw: bug },
  stone: { w: 96, h: 300, draw: beaconStone },
  crystal: { w: 56, h: 84, draw: crystal },
  lantern: { w: 64, h: 128, draw: lantern },
  glow: { w: 128, h: 128, draw: (c, w, h) => drawGlow(c, w, h, 2.2) },
  beam: { w: 64, h: 256, draw: beam },
  shard: { w: 16, h: 16, draw: shard },
  puff: { w: 48, h: 48, draw: puff },
};

/* ---------------- the terrain, painted once onto a canvas ---------------- */

/**
 * grid: Level grid (see level.js). px: pixels per tile.
 * Paints soil with rounded outer corners, a mossy top lit from the setting sun, grass, roots,
 * pebbles, wooden ledges and brambles. Returns the canvas.
 */
export function paintTerrain(grid, px) {
  const { w, h } = grid;
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = h * px;
  const ctx = canvas.getContext('2d');
  const rnd = stream(77);
  const solid = (x, y) => grid.get(x, y) === 'solid';
  const X = (x) => x * px;
  const Y = (y) => (h - 1 - y) * px; // canvas y of a cell's top edge
  const R = px * 0.38;

  // depth below the surface for each solid cell
  const depth = (x, y) => {
    let d = 0;
    while (solid(x, y + d + 1) && d < 6) d++;
    return d;
  };

  // 1. soil body
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const up = solid(x, y + 1);
      const down = solid(x, y - 1) || y === 0;
      const left = solid(x - 1, y) || x === 0;
      const right = solid(x + 1, y) || x === w - 1;
      const d = depth(x, y);
      const t = Math.min(1, d / 4);
      ctx.fillStyle = linear(ctx, 0, Y(y), 0, Y(y) + px, [[0, mix(P.soilTop, P.soilDeep, t)], [1, mix(P.soilTop, P.soilDeep, Math.min(1, t + 0.25))]]);
      const tl = !up && !left ? R : 0;
      const tr = !up && !right ? R : 0;
      const br = !down && !right ? R : 0;
      const bl = !down && !left ? R : 0;
      cornerRect(ctx, X(x) - 0.5, Y(y) - 0.5, px + 1, px + 1, tl, tr, br, bl);
      ctx.fill();
    }
  }

  // 2. texture: strata and pebbles, kept inside the soil
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  // strata: soft wavy bands that run across the whole level
  for (let band = 0; band < h * 2.2; band++) {
    const by = band * px * 0.45 + rnd.float(px * 0.2);
    ctx.strokeStyle = band % 2 ? 'rgba(255,170,220,.05)' : 'rgba(0,0,0,.12)';
    ctx.lineWidth = rnd.float(px * 0.22, px * 0.08);
    ctx.beginPath();
    for (let sx = 0; sx <= w * px; sx += px) {
      const sy = by + Math.sin(sx * 0.013 + band) * px * 0.18 + Math.sin(sx * 0.051 + band * 2) * px * 0.06;
      sx ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
    }
    ctx.stroke();
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      // fine grit
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rnd.float() < 0.5 ? 'rgba(255,210,230,.06)' : 'rgba(0,0,0,.16)';
        ctx.fillRect(X(x) + rnd.float(px), Y(y) + rnd.float(px), rnd.float(3, 1), rnd.float(3, 1));
      }
      if (rnd.float() < 0.12) {
        // a buried stone: irregular, lit on top, with a dark seam under it
        const sx = X(x) + rnd.float(px * 0.8, px * 0.2);
        const sy = Y(y) + rnd.float(px * 0.8, px * 0.3);
        const r = rnd.float(px * 0.32, px * 0.14);
        const pts = [];
        const n = 7;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          const rr = r * rnd.float(1.15, 0.75);
          pts.push([sx + Math.cos(a) * rr * 1.25, sy + Math.sin(a) * rr * 0.8]);
        }
        const path = () => { ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); };
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.save();
        ctx.translate(2, 3);
        path();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = radial(ctx, sx - r * 0.3, sy - r * 0.5, r * 1.6, [[0, '#8a6c92'], [0.45, '#4a3458'], [1, '#22162e']]);
        path();
        ctx.fill();
      }
    }
  }
  // ambient occlusion along the underside of overhangs and at depth
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) || solid(x, y - 1) || y === 0) continue;
      ctx.fillStyle = linear(ctx, 0, Y(y) + px * 0.55, 0, Y(y) + px, [[0, 'rgba(10,0,20,0)'], [1, 'rgba(10,0,20,.55)']]);
      ctx.fillRect(X(x), Y(y), px, px);
    }
  }
  // sun-facing walls (right) get a warm rim, left walls a cool shade
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x + 1, y) && x < w - 1) {
        ctx.fillStyle = linear(ctx, X(x) + px * 0.75, 0, X(x) + px, 0, [[0, 'rgba(255,150,110,0)'], [1, 'rgba(255,160,120,.45)']]);
        ctx.fillRect(X(x), Y(y), px, px);
      }
      if (!solid(x - 1, y) && x > 0) {
        ctx.fillStyle = linear(ctx, X(x), 0, X(x) + px * 0.3, 0, [[0, 'rgba(20,10,50,.45)'], [1, 'rgba(20,10,50,0)']]);
        ctx.fillRect(X(x), Y(y), px, px);
      }
    }
  }
  ctx.restore();

  // 3. hanging roots under overhangs
  ctx.lineCap = 'round';
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) || solid(x, y - 1)) continue;
      const n = rnd.int(3);
      for (let i = 0; i < n; i++) {
        const sx = X(x) + rnd.float(px * 0.9, px * 0.1);
        const len = rnd.float(px * 0.9, px * 0.25);
        ctx.strokeStyle = rnd.float() < 0.5 ? '#3c2440' : '#4d5a2e';
        ctx.lineWidth = rnd.float(3, 1.5);
        ctx.beginPath();
        ctx.moveTo(sx, Y(y) + px - 2);
        ctx.quadraticCurveTo(sx + rnd.float(8, -8), Y(y) + px + len * 0.5, sx + rnd.float(6, -6), Y(y) + px + len);
        ctx.stroke();
      }
    }
  }

  // 4. moss caps and grass on every exposed top
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) || solid(x, y + 1)) continue;
      const left = solid(x - 1, y) && !solid(x - 1, y + 1);
      const right = solid(x + 1, y) && !solid(x + 1, y + 1);
      const x0 = X(x) - (left ? 0 : px * 0.08);
      const x1 = X(x) + px + (right ? 0 : px * 0.08);
      const top = Y(y);
      const thick = px * 0.24;
      // moss band with a wavy underside
      ctx.fillStyle = linear(ctx, 0, top, 0, top + thick * 1.4, [[0, P.mossLight], [0.5, P.moss], [1, P.mossDark]]);
      ctx.beginPath();
      ctx.moveTo(x0, top + (left ? 0 : px * 0.1));
      ctx.lineTo(x1, top + (right ? 0 : px * 0.1));
      const steps = 6;
      for (let i = steps; i >= 0; i--) {
        const sx = x0 + ((x1 - x0) * i) / steps;
        const drip = thick * (0.9 + 0.5 * Math.sin((x * steps + i) * 1.7) + (rnd.float() < 0.15 ? 0.8 : 0));
        ctx.lineTo(sx, top + drip);
      }
      ctx.closePath();
      ctx.fill();
      // rim light along the top edge
      ctx.strokeStyle = P.rim;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = px * 0.05;
      ctx.beginPath();
      ctx.moveTo(x0 + (left ? 0 : 4), top + 1.5);
      ctx.lineTo(x1 - (right ? 0 : 4), top + 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // grass blades
      const blades = 9;
      for (let i = 0; i < blades; i++) {
        const bx = x0 + rnd.float(x1 - x0);
        const bh = rnd.float(px * 0.42, px * 0.12);
        const lean = rnd.float(px * 0.14, -px * 0.08);
        ctx.strokeStyle = rnd.float() < 0.3 ? P.grassTip : P.grass;
        ctx.lineWidth = rnd.float(3.2, 1.6);
        ctx.beginPath();
        ctx.moveTo(bx, top + 3);
        ctx.quadraticCurveTo(bx + lean * 0.3, top - bh * 0.6, bx + lean, top - bh);
        ctx.stroke();
      }
    }
  }

  // 5. decoration on open ground: flowers, mushrooms, tufts
  const glows = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h - 1; y++) {
      if (!solid(x, y) || solid(x, y + 1) || grid.get(x, y + 1) !== 'empty') continue;
      const r = rnd.float();
      const bx = X(x) + rnd.float(px * 0.8, px * 0.2);
      const top = Y(y);
      if (r < 0.14) {
        // glowing mushroom
        ctx.fillStyle = '#e8d8c8';
        ctx.fillRect(bx - 2, top - px * 0.22, 4, px * 0.22);
        ctx.fillStyle = radial(ctx, bx - 3, top - px * 0.27, px * 0.18, [[0, '#ffffff'], [0.4, P.shroom], [1, '#5a2a8a']]);
        ctx.beginPath();
        ctx.ellipse(bx, top - px * 0.22, px * 0.13, px * 0.08, 0, Math.PI, 0);
        ctx.fill();
        glows.push({ x: (bx / px), y: h - (top - px * 0.24) / px, color: 'shroom' });
      } else if (r < 0.3) {
        // flower
        ctx.strokeStyle = P.grass;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, top + 2);
        ctx.lineTo(bx + 2, top - px * 0.32);
        ctx.stroke();
        ctx.fillStyle = rnd.pick([P.flowerA, P.flowerB, '#fff2d0']);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          ctx.beginPath();
          ctx.arc(bx + 2 + Math.cos(a) * 4, top - px * 0.32 + Math.sin(a) * 4, 3.2, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath();
        ctx.arc(bx + 2, top - px * 0.32, 2.4, 0, TAU);
        ctx.fill();
      } else if (r < 0.42) {
        // pebble
        ctx.fillStyle = radial(ctx, bx - 3, top - 6, 12, [[0, '#b8a0b8'], [1, '#4a3656']]);
        ctx.beginPath();
        ctx.ellipse(bx, top - 2, px * 0.14, px * 0.08, 0, Math.PI, 0);
        ctx.fill();
      }
    }
  }

  // 6. wooden ledges (one way)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.get(x, y) !== 'ledge') continue;
      const top = Y(y);
      ctx.fillStyle = linear(ctx, 0, top, 0, top + px * 0.32, [[0, '#c48a5a'], [0.4, '#8a5534'], [1, '#4a2a1c']]);
      ctx.fillRect(X(x) - 0.5, top, px + 1, px * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(X(x) + px - 2, top, 2, px * 0.3);
      ctx.fillStyle = 'rgba(255,220,170,.55)';
      ctx.fillRect(X(x), top, px, 3);
      // brackets under the ends
      const leftEnd = grid.get(x - 1, y) !== 'ledge';
      const rightEnd = grid.get(x + 1, y) !== 'ledge';
      ctx.strokeStyle = '#3a2218';
      ctx.lineWidth = 4;
      for (const end of [leftEnd && X(x) + px * 0.25, rightEnd && X(x) + px * 0.75]) {
        if (end === false) continue;
        ctx.beginPath();
        ctx.moveTo(end, top + px * 0.3);
        ctx.lineTo(end + (end < X(x) + px / 2 ? 1 : -1) * px * 0.2, top + px * 0.62);
        ctx.stroke();
      }
    }
  }

  // 7. brambles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.get(x, y) !== 'thorns') continue;
      const base = Y(y) + px;
      ctx.fillStyle = '#2a1230';
      ctx.beginPath();
      ctx.moveTo(X(x) - 1, base);
      for (let k = 0; k < 4; k++) {
        const sx = X(x) + (k + 0.5) * (px / 4);
        const tipH = px * (0.55 + 0.25 * Math.sin(x * 3 + k * 1.9));
        ctx.lineTo(sx - px * 0.07, base - px * 0.12);
        ctx.lineTo(sx, base - tipH);
        ctx.lineTo(sx + px * 0.07, base - px * 0.12);
      }
      ctx.lineTo(X(x) + px + 1, base);
      ctx.closePath();
      ctx.fill();
      // hot tips
      for (let k = 0; k < 4; k++) {
        const sx = X(x) + (k + 0.5) * (px / 4);
        const tipH = px * (0.55 + 0.25 * Math.sin(x * 3 + k * 1.9));
        ctx.fillStyle = '#ff5a6a';
        ctx.beginPath();
        ctx.moveTo(sx - 3, base - tipH + 9);
        ctx.lineTo(sx, base - tipH);
        ctx.lineTo(sx + 3, base - tipH + 9);
        ctx.fill();
      }
      // a twisted vine across
      ctx.strokeStyle = '#46204e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(X(x), base - px * 0.15);
      ctx.bezierCurveTo(X(x) + px * 0.3, base - px * 0.35, X(x) + px * 0.6, base, X(x) + px, base - px * 0.18);
      ctx.stroke();
    }
  }

  return { canvas, glows };
}

function cornerRect(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

/* ---------------- backdrops: each repeats left to right without a seam ---------------- */

/** A ridge height in 0..1 at u (0..1 across the image) from integer-frequency waves, so it tiles. */
function ridge(u, waves) {
  let v = 0;
  for (const [f, a, ph] of waves) v += a * Math.sin(u * TAU * f + ph);
  return v;
}

// Each backdrop's skyline sits at `ridgeAt` of the image height from its top; game.js places the
// layers so those skylines land where it wants them on screen.
export const ridgeAt = { mountains: 0.3, hills: 0.32, forest: 0.3 };

export function paintMountains(ctx, size) {
  const { x: w, y: h } = size;
  const waves = [[2, 0.07, 0.3], [3, 0.045, 1.1], [7, 0.02, 2.0], [13, 0.01, 0.4], [29, 0.004, 1.3]];
  const yAt = (i) => h * (ridgeAt.mountains - ridge(i / w, waves));
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= w; i += 2) ctx.lineTo(i, yAt(i));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, h * 0.15, 0, h * 0.7, [[0, P.farTop], [0.5, P.far], [1, P.farLow]]);
  ctx.fill();
  // snow-lit faces: a lighter band just under the ridge, brighter toward the sun (right)
  ctx.save();
  ctx.clip();
  for (let i = 0; i <= w; i += 3) {
    const y = yAt(i);
    const slope = yAt(i + 3) - y; // negative where the face rises to the right, i.e. faces the sun
    const a = Math.max(0, Math.min(0.5, -slope * 0.08 + 0.12));
    ctx.fillStyle = `rgba(255,200,190,${a})`;
    ctx.fillRect(i, y, 3, h * 0.05);
  }
  ctx.restore();
  // sunlit edge on the ridgeline
  ctx.strokeStyle = 'rgba(255,205,185,.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= w; i += 2) (i ? ctx.lineTo(i, yAt(i) + 1) : ctx.moveTo(i, yAt(i) + 1));
  ctx.stroke();
  // haze at the base
  ctx.fillStyle = linear(ctx, 0, h * 0.35, 0, h * 0.7, [[0, 'rgba(255,150,150,0)'], [1, 'rgba(255,140,150,.35)']]);
  ctx.fillRect(0, 0, w, h);
}

export function paintHills(ctx, size) {
  const { x: w, y: h } = size;
  const waves = [[3, 0.04, 0.8], [5, 0.025, 2.2], [11, 0.012, 0.1]];
  const rnd = stream(11);
  const yAt = (x) => h * (ridgeAt.hills - ridge(x / w, waves));
  ctx.fillStyle = linear(ctx, 0, h * 0.2, 0, h * 0.7, [[0, P.midTop], [1, P.mid]]);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= w; i += 2) ctx.lineTo(i, yAt(i));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // pines along the ridge
  for (let i = 0; i < 110; i++) {
    const x = rnd.float(w);
    const th = rnd.float(h * 0.1, h * 0.04);
    const tw = th * 0.42;
    const base = yAt(x) + h * 0.02;
    for (const dx of [0, w, -w]) {
      ctx.fillStyle = P.midTree;
      ctx.beginPath();
      ctx.moveTo(x + dx - tw / 2, base);
      ctx.lineTo(x + dx, base - th);
      ctx.lineTo(x + dx + tw / 2, base);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = linear(ctx, 0, h * 0.3, 0, h * 0.75, [[0, 'rgba(230,110,150,0)'], [1, 'rgba(230,110,150,.3)']]);
  ctx.fillRect(0, 0, w, h);
}

export function paintForest(ctx, size) {
  const { x: w, y: h } = size;
  const rnd = stream(23);
  const waves = [[2, 0.03, 1.7], [6, 0.015, 0.5]];
  const yAt = (x) => h * (ridgeAt.forest - ridge(x / w, waves));
  ctx.fillStyle = P.near;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= w; i += 2) ctx.lineTo(i, yAt(i));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // round canopies, drawn wrapped so the seam matches
  for (let i = 0; i < 34; i++) {
    const x = rnd.float(w);
    const r = rnd.float(h * 0.055, h * 0.028);
    const base = yAt(x);
    for (const dx of [0, w, -w]) {
      ctx.fillStyle = P.nearTree;
      ctx.fillRect(x + dx - r * 0.08, base - r * 1.2, r * 0.16, r * 1.3);
      ctx.beginPath();
      ctx.arc(x + dx, base - r * 1.4, r, 0, TAU);
      ctx.arc(x + dx - r * 0.6, base - r * 1.05, r * 0.7, 0, TAU);
      ctx.arc(x + dx + r * 0.65, base - r * 1.0, r * 0.65, 0, TAU);
      ctx.fill();
      // rim of sunset on the right of each canopy
      ctx.strokeStyle = 'rgba(255,140,120,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + dx, base - r * 1.4, r - 1, -1.0, 0.3);
      ctx.stroke();
    }
  }
}
