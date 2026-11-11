// Every picture in the default game, painted in code: six tidepool pieces, the glass board,
// the seabed backdrop and small sprites for light. Rewrite this file to change the look.
import { radial, linear, drawGlow, roundRect } from '../kit/art.js';
import { stream } from '../kit/rng.js';
import { kinds, palette as P } from './config.js';

const TAU = Math.PI * 2;

function outline(ctx, w) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,10,25,.75)';
  ctx.lineWidth = w * 0.045;
  ctx.stroke();
}

function gloss(ctx, x, y, rx, ry, a = 0.55) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, TAU);
  ctx.fill();
}

const painters = {
  jelly(ctx, w, h, k) {
    const cx = w / 2;
    // tentacles
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = cx - w * 0.21 + i * w * 0.14;
      ctx.strokeStyle = k.dark;
      ctx.lineWidth = w * 0.075;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.55);
      ctx.bezierCurveTo(x - w * 0.06, h * 0.68, x + w * 0.07, h * 0.76, x - w * 0.02, h * 0.9);
      ctx.stroke();
      ctx.strokeStyle = k.main;
      ctx.lineWidth = w * 0.04;
      ctx.stroke();
    }
    // bell
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.38, h * 0.58);
    ctx.bezierCurveTo(cx - w * 0.42, h * 0.1, cx + w * 0.42, h * 0.1, cx + w * 0.38, h * 0.58);
    ctx.quadraticCurveTo(cx + w * 0.19, h * 0.5, cx, h * 0.6);
    ctx.quadraticCurveTo(cx - w * 0.19, h * 0.5, cx - w * 0.38, h * 0.58);
    ctx.closePath();
    ctx.fillStyle = radial(ctx, cx - w * 0.1, h * 0.25, w * 0.5, [[0, k.light], [0.5, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    // inner glow spots
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (const [dx, dy, r] of [[-0.12, 0.38, 0.05], [0.06, 0.33, 0.04], [0.16, 0.42, 0.035]]) {
      ctx.beginPath();
      ctx.arc(cx + dx * w, dy * h, r * w, 0, TAU);
      ctx.fill();
    }
    gloss(ctx, cx - w * 0.14, h * 0.24, w * 0.11, w * 0.05);
  },
  star(ctx, w, h, k) {
    const cx = w / 2;
    const cy = h * 0.53;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? w * 0.19 : w * 0.42;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = radial(ctx, cx - w * 0.08, cy - h * 0.12, w * 0.5, [[0, k.light], [0.45, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    // bumpy texture along the arms
    ctx.fillStyle = 'rgba(255,240,210,.55)';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      for (const t of [0.12, 0.22, 0.31]) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * w * t, cy + Math.sin(a) * w * t, w * 0.022, 0, TAU);
        ctx.fill();
      }
    }
    gloss(ctx, cx - w * 0.1, cy - h * 0.16, w * 0.07, w * 0.035, 0.45);
  },
  shell(ctx, w, h, k) {
    const cx = w / 2;
    const base = h * 0.82;
    // fan
    ctx.beginPath();
    ctx.moveTo(cx, base);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
      const r = w * (0.42 + (i % 2 ? 0.0 : 0.02));
      ctx.lineTo(cx + Math.cos(a) * r, base - h * 0.08 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = radial(ctx, cx, h * 0.3, w * 0.6, [[0, k.light], [0.5, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    // ridges
    ctx.strokeStyle = 'rgba(120,70,10,.5)';
    ctx.lineWidth = w * 0.025;
    for (let i = 1; i < 8; i++) {
      const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
      ctx.beginPath();
      ctx.moveTo(cx, base - h * 0.04);
      ctx.lineTo(cx + Math.cos(a) * w * 0.38, base - h * 0.08 + Math.sin(a) * w * 0.38);
      ctx.stroke();
    }
    // hinge
    ctx.fillStyle = k.dark;
    roundRect(ctx, cx - w * 0.12, base - h * 0.06, w * 0.24, h * 0.1, w * 0.04);
    ctx.fill();
    gloss(ctx, cx - w * 0.12, h * 0.36, w * 0.09, w * 0.04, 0.5);
  },
  urchin(ctx, w, h, k) {
    const cx = w / 2;
    const cy = h / 2;
    // spikes
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const r = w * (i % 2 ? 0.44 : 0.4);
      ctx.strokeStyle = k.dark;
      ctx.lineWidth = w * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.2, cy + Math.sin(a) * w * 0.2);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
      ctx.strokeStyle = k.main;
      ctx.lineWidth = w * 0.022;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.27, 0, TAU);
    ctx.fillStyle = radial(ctx, cx - w * 0.08, cy - h * 0.1, w * 0.35, [[0, k.light], [0.45, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * w * 0.15, cy + Math.sin(a) * w * 0.15, w * 0.025, 0, TAU);
      ctx.fill();
    }
    gloss(ctx, cx - w * 0.09, cy - h * 0.1, w * 0.08, w * 0.04, 0.55);
  },
  kelp(ctx, w, h, k) {
    const cx = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.08);
    ctx.bezierCurveTo(cx + w * 0.42, h * 0.3, cx + w * 0.3, h * 0.78, cx, h * 0.92);
    ctx.bezierCurveTo(cx - w * 0.3, h * 0.78, cx - w * 0.42, h * 0.3, cx, h * 0.08);
    ctx.closePath();
    ctx.fillStyle = radial(ctx, cx - w * 0.1, h * 0.35, w * 0.55, [[0, k.light], [0.45, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    ctx.strokeStyle = k.dark;
    ctx.lineWidth = w * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.2);
    ctx.quadraticCurveTo(cx + w * 0.03, h * 0.55, cx, h * 0.86);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const y = h * (0.3 + i * 0.13);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + s * w * 0.1, y - h * 0.02, cx + s * w * 0.2, y - h * 0.08);
        ctx.stroke();
      }
    }
    gloss(ctx, cx - w * 0.12, h * 0.32, w * 0.06, w * 0.1, 0.45);
  },
  pearl(ctx, w, h, k) {
    const cx = w / 2;
    const cy = h / 2;
    // a ring of shell around the pearl
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r = w * (i % 2 ? 0.38 : 0.42);
      i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#d8f4ff'], [0.5, '#5aa8d0'], [1, '#183a5a']]);
    ctx.fill();
    outline(ctx, w);
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.27, 0, TAU);
    ctx.fillStyle = radial(ctx, cx - w * 0.09, cy - h * 0.1, w * 0.36, [[0, '#ffffff'], [0.35, k.light], [0.75, k.main], [1, k.dark]]);
    ctx.fill();
    outline(ctx, w);
    gloss(ctx, cx - w * 0.09, cy - h * 0.1, w * 0.09, w * 0.05, 0.8);
  },
};

function frame(ctx, w, h) {
  // the cursor: a rounded square ring, white, tinted when drawn
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = w * 0.06;
  roundRect(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.88, w * 0.2);
  ctx.stroke();
}

function sparkle(ctx, w, h) {
  const g = radial(ctx, w / 2, h / 2, w / 2, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.quadraticCurveTo(w * 0.55, h * 0.45, w, h / 2);
  ctx.quadraticCurveTo(w * 0.55, h * 0.55, w / 2, h);
  ctx.quadraticCurveTo(w * 0.45, h * 0.55, 0, h / 2);
  ctx.quadraticCurveTo(w * 0.45, h * 0.45, w / 2, 0);
  ctx.fill();
}

function bubble(ctx, w, h) {
  ctx.strokeStyle = 'rgba(220,250,255,.85)';
  ctx.lineWidth = w * 0.08;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.4, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,245,255,.15)';
  ctx.fill();
  gloss(ctx, w * 0.36, h * 0.34, w * 0.12, w * 0.07, 0.9);
}

function ray(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

export const sprites = {
  glow: { w: 128, h: 128, draw: (c, w, h) => drawGlow(c, w, h, 2) },
  frame: { w: 128, h: 128, draw: frame },
  sparkle: { w: 64, h: 64, draw: sparkle },
  bubble: { w: 32, h: 32, draw: bubble },
  ray: { w: 64, h: 256, draw: ray },
};
kinds.forEach((k, i) => { sprites[`piece${i}`] = { w: 128, h: 128, draw: (c, w, h) => painters[k.name](c, w, h, k) }; });

/** The glass tray the pieces sit in: size in cells, px pixels per cell. */
export function paintBoard(cols, rows, px) {
  const pad = px * 0.3;
  const canvas = document.createElement('canvas');
  canvas.width = cols * px + pad * 2;
  canvas.height = rows * px + pad * 2;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  // drop shadow and glass body
  roundRect(ctx, 4, 8, W - 8, H - 10, px * 0.5);
  ctx.fillStyle = 'rgba(0,8,20,.45)';
  ctx.fill();
  roundRect(ctx, 2, 2, W - 4, H - 6, px * 0.5);
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, 'rgba(40,140,180,.38)'], [0.5, 'rgba(10,60,100,.42)'], [1, 'rgba(4,30,60,.6)']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,240,255,.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // cells
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = pad + x * px;
      const cy = pad + y * px;
      roundRect(ctx, cx + px * 0.05, cy + px * 0.05, px * 0.9, px * 0.9, px * 0.2);
      ctx.fillStyle = (x + y) % 2 ? 'rgba(120,220,255,.07)' : 'rgba(0,20,40,.22)';
      ctx.fill();
    }
  }
  // a sheen across the top
  ctx.save();
  roundRect(ctx, 2, 2, W - 4, H - 6, px * 0.5);
  ctx.clip();
  ctx.fillStyle = linear(ctx, 0, 0, W * 0.6, H * 0.6, [[0, 'rgba(255,255,255,.16)'], [0.35, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  return { canvas, pad: pad / px };
}

/** The seabed backdrop: deep water, dunes, coral and swaying weeds in silhouette. */
export function paintSeabed(wTiles, hTiles, px) {
  const canvas = document.createElement('canvas');
  canvas.width = wTiles * px;
  canvas.height = hTiles * px;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const rnd = stream(5);
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, P.shallow], [0.45, P.mid], [1, P.deep]]);
  ctx.fillRect(0, 0, W, H);
  // far rocks, hazy
  const ridge = (base, amp, seed, color) => {
    const r = stream(seed);
    const waves = [[r.float(3, 1), r.float(amp), r.float(6)], [r.float(7, 4), r.float(amp * 0.5), r.float(6)]];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      let y = base;
      for (const [f, a, p] of waves) y += Math.sin((x / W) * TAU * f + p) * a * H;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  };
  ridge(H * 0.72, 0.05, 1, 'rgba(10,70,100,.55)');
  ridge(H * 0.8, 0.04, 2, 'rgba(6,45,70,.8)');
  // coral fans and weeds on the bed
  for (let i = 0; i < 26; i++) {
    const x = rnd.float(W);
    const base = H * rnd.float(0.95, 0.82);
    const hgt = H * rnd.float(0.2, 0.06);
    if (rnd.float() < 0.5) {
      ctx.strokeStyle = rnd.float() < 0.5 ? 'rgba(4,36,56,.95)' : 'rgba(20,60,80,.9)';
      ctx.lineCap = 'round';
      ctx.lineWidth = px * rnd.float(0.12, 0.05);
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        ctx.moveTo(x + b * px * 0.15, base);
        ctx.bezierCurveTo(x + px * rnd.float(0.6, -0.6), base - hgt * 0.4, x + px * rnd.float(0.8, -0.8), base - hgt * 0.7, x + px * rnd.float(0.5, -0.5), base - hgt);
        ctx.stroke();
      }
    } else {
      // branching coral
      const branch = (bx, by, len, ang, depth) => {
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        ctx.lineWidth = Math.max(2, depth * px * 0.05);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (depth > 1) {
          branch(ex, ey, len * 0.72, ang - 0.45, depth - 1);
          branch(ex, ey, len * 0.72, ang + 0.4, depth - 1);
        }
      };
      ctx.strokeStyle = rnd.float() < 0.5 ? 'rgba(90,30,70,.9)' : 'rgba(30,50,90,.9)';
      ctx.lineCap = 'round';
      branch(x, base, hgt * 0.35, -Math.PI / 2, 4);
    }
  }
  // the sand
  ctx.fillStyle = linear(ctx, 0, H * 0.86, 0, H, [[0, '#1a4a58'], [1, '#0a2430']]);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, H * 0.9 + Math.sin(x * 0.01) * H * 0.015 + Math.sin(x * 0.033) * H * 0.006);
  ctx.lineTo(W, H);
  ctx.fill();
  return canvas;
}
