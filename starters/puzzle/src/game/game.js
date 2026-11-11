// The default game, "Glowtide": a match-three in a tidepool at night. Swap two neighbouring
// creatures to line up three or more of a kind; reach the target before the swaps run out.
// The rules live in board.js; this file animates them, takes input, and drives the bot.
import * as LJS from '../kit/engine.js';
import { round, control } from '../kit/boot.js';
import { input, bindActions } from '../kit/input.js';
import { packAtlas, atlasTiles } from '../kit/art.js';
import { drawFx, burst, shake, flash, popText, hitStop } from '../kit/fx.js';
import { rules as R, kinds, palette as P } from './config.js';
import * as B from './board.js';
import { sprites, paintBoard, paintSeabed } from './art.js';
import { makeSounds, music } from './sounds.js';
import { audio } from '../kit/audio.js';
import { hudCss, hudHtml } from './hud.js';
import { makeShots } from './shots.js';

const { vec2, rgb, hsl } = LJS;
const DT = 1 / 60;

const g = {
  grid: null,
  pieces: [], // by cell index; each { kind, pos, vel, scale, dying, pop }
  phase: 'idle',
  t: 0, // seconds in this phase
  cursor: { x: 3, y: 3 },
  grabbed: false,
  selected: null, // mouse selection {x, y}
  drag: null,
  swapA: null,
  swapB: null,
  moves: R.moves,
  cascade: 0,
  idle: 0,
  endAt: 0,
  won: false,
  hint: null,
  tiles: null,
  sounds: null,
  screens: null,
  bubbles: [],
  bot: { cool: 0, plan: [] },
  biggest: 0,
};

const rand = () => Math.random();
const cellCenter = (x, y) => vec2(x + 0.5, y + 0.5);
const glowRGB = (k, a) => rgb(kinds[k].glow[0], kinds[k].glow[1], kinds[k].glow[2], a);

function newPiece(kind, x, y) {
  return { kind, pos: cellCenter(x, y), vel: 0, scale: 1, dying: false, pop: 0, seed: Math.random() * 10 };
}

function freshBoard() {
  g.grid = B.makeGrid(R.width, R.height, R.kinds, rand);
  g.pieces = g.grid.cells.map((k, i) => newPiece(k, i % R.width, Math.floor(i / R.width)));
  // drop in from above at the start, a column at a time
  for (let i = 0; i < g.pieces.length; i++) {
    const x = i % R.width;
    const y = Math.floor(i / R.width);
    g.pieces[i].pos = vec2(x + 0.5, R.height + 1 + y * 0.6 + x * 0.35);
  }
  g.phase = 'fall';
  g.t = 0;
}

function setPhase(p) {
  g.phase = p;
  g.t = 0;
}

/* ------------------------------------------------------------------ moves */

function trySwap(ax, ay, bx, by) {
  if (g.phase !== 'idle' || g.endAt) return false;
  if (bx < 0 || by < 0 || bx >= R.width || by >= R.height) return false;
  if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return false;
  B.swap(g.grid, ax, ay, bx, by);
  const ia = ax + ay * R.width;
  const ib = bx + by * R.width;
  [g.pieces[ia], g.pieces[ib]] = [g.pieces[ib], g.pieces[ia]];
  g.swapA = [ax, ay];
  g.swapB = [bx, by];
  g.swaps = (g.swaps ?? 0) + 1;
  g.sounds.swap.play();
  g.idle = 0;
  g.hint = null;
  setPhase('swap');
  return true;
}

function startClear() {
  const found = B.findMatches(g.grid);
  if (!found.cells.size) return false;
  g.cascade++;
  const points = B.scoreStep(found, g.cascade, R);
  round.score += points;
  let cx = 0;
  let cy = 0;
  for (const i of found.cells) {
    const p = g.pieces[i];
    p.dying = true;
    cx += p.pos.x;
    cy += p.pos.y;
  }
  cx /= found.cells.size;
  cy /= found.cells.size;
  const longest = Math.max(...found.runs.map((r) => r.length));
  g.biggest = Math.max(g.biggest, longest);
  const pitch = 1 + (g.cascade - 1) * 0.12;
  g.sounds.clear.play(undefined, 1, pitch);
  popText(`+${points}`, vec2(cx, cy + 0.2), rgb(1, 1, 1), 0.75 + Math.min(0.5, found.cells.size * 0.03));
  if (g.cascade >= 2) {
    popText(`Cascade ×${g.cascade}`, vec2(R.width / 2, R.height + 0.55), rgb(0.6, 1, 1), 0.85);
  }
  if (longest >= 4 || g.cascade >= 3) {
    g.sounds.big.play(undefined, 1, longest >= 5 ? 1.25 : 1);
    shake(longest >= 5 ? 0.3 : 0.16);
    hitStop(0.05);
    flash(rgb(0.6, 1, 1), 0.12);
    burst(vec2(cx, cy), { tile: g.tiles.glow, color: rgb(0.6, 1, 1, 0.6), count: 1, speed: 0, size: 1.5, sizeEnd: 7, life: 0.45 });
  }
  setPhase('clear');
  return true;
}

function finishClear() {
  // particles for each piece that goes
  for (let i = 0; i < g.pieces.length; i++) {
    const p = g.pieces[i];
    if (!p.dying) continue;
    const c = kinds[p.kind].glow;
    burst(p.pos, { tile: g.tiles.sparkle, color: rgb(c[0], c[1], c[2], 1), color2: rgb(1, 1, 1, 1), count: 9, speed: 4.5, size: 0.32, sizeEnd: 0, life: 0.55, damping: 0.9, spin: 0.2 });
    burst(p.pos, { tile: g.tiles.glow, color: rgb(c[0], c[1], c[2], 0.7), count: 1, speed: 0, size: 1.1, sizeEnd: 2.2, life: 0.3 });
    B.set(g.grid, i % R.width, Math.floor(i / R.width), B.EMPTY);
  }
  const old = g.pieces;
  const moves = B.collapse(g.grid, rand);
  const next = old.map((p) => (p.dying ? null : p));
  for (const m of moves) {
    const [fx, fy] = m.from;
    const [tx, ty] = m.to;
    if (m.fresh) next[tx + ty * R.width] = Object.assign(newPiece(m.kind, tx, ty), { pos: vec2(tx + 0.5, fy + 0.5 + 0.4) });
    else next[tx + ty * R.width] = old[fx + fy * R.width];
  }
  g.pieces = next;
  setPhase('fall');
}

/* ------------------------------------------------------------------ input */

function keyboard() {
  const c = g.cursor;
  const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, 1], ['down', 0, -1]];
  if (input.pressed('grab')) {
    g.grabbed = !g.grabbed;
    g.sounds.grab.play(undefined, 1, g.grabbed ? 1 : 0.8);
  }
  for (const [a, dx, dy] of dirs) {
    if (!input.pressed(a)) continue;
    if (g.grabbed) {
      if (trySwap(c.x, c.y, c.x + dx, c.y + dy)) g.grabbed = false;
    } else {
      c.x = LJS.clamp(c.x + dx, 0, R.width - 1);
      c.y = LJS.clamp(c.y + dy, 0, R.height - 1);
      g.sounds.move.play();
    }
  }
}

function mouse() {
  if (round.elapsed < 0.25) return; // the click that started the round
  const m = LJS.mousePos;
  const cx = Math.floor(m.x);
  const cy = Math.floor(m.y);
  const inside = cx >= 0 && cy >= 0 && cx < R.width && cy < R.height;
  if (LJS.mouseWasPressed(0) && inside) {
    g.cursor = { x: cx, y: cy };
    g.grabbed = false;
    if (g.selected && Math.abs(g.selected.x - cx) + Math.abs(g.selected.y - cy) === 1) {
      trySwap(g.selected.x, g.selected.y, cx, cy);
      g.selected = null;
      g.drag = null;
    } else {
      g.drag = { x: cx, y: cy, from: m.copy() };
    }
  }
  if (g.drag && LJS.mouseIsDown(0)) {
    const d = m.subtract(g.drag.from);
    if (d.length() > 0.45) {
      const dx = Math.abs(d.x) > Math.abs(d.y) ? Math.sign(d.x) : 0;
      const dy = dx ? 0 : Math.sign(d.y);
      trySwap(g.drag.x, g.drag.y, g.drag.x + dx, g.drag.y + dy);
      g.drag = null;
      g.selected = null;
    }
  }
  if (g.drag && LJS.mouseWasReleased(0)) {
    // a tap: select, or clear the selection when tapping it again
    const same = g.selected && g.selected.x === g.drag.x && g.selected.y === g.drag.y;
    g.selected = same ? null : { x: g.drag.x, y: g.drag.y };
    if (!same) g.sounds.grab.play();
    g.drag = null;
  }
}

/* ------------------------------------------------------------------ the update */

function updatePieces() {
  let moving = false;
  for (let i = 0; i < g.pieces.length; i++) {
    const p = g.pieces[i];
    if (!p) continue;
    const target = cellCenter(i % R.width, Math.floor(i / R.width));
    if (g.phase === 'swap' || g.phase === 'unswap') {
      // swapping pieces slide; the rest stay
      p.pos = p.pos.lerp(target, 0.32);
      if (p.pos.distance(target) > 0.02) moving = true;
      else p.pos = target;
      continue;
    }
    if (p.pos.y > target.y + 0.001) {
      p.vel += R.gravity * DT;
      p.pos.y = Math.max(target.y, p.pos.y - p.vel * DT);
      p.pos.x = target.x;
      if (p.pos.y === target.y) {
        p.pop = 1; // squash on landing
        if (p.vel > 6) g.landed = true;
        p.vel = 0;
      } else moving = true;
    } else {
      p.pos = target.copy();
      p.vel = 0;
    }
    p.pop *= 0.85;
  }
  return moving;
}

function update() {
  g.t += DT;
  audio.muted = round.state === 'title'; // the attract mode behind the title plays silently
  if (round.state === 'title') {
    // the board plays itself quietly behind the title
    if (g.phase === 'idle' && g.t > 1.2) {
      const mv = B.findMove(g.grid);
      if (mv) trySwap(mv.x, mv.y, mv.x + mv.dx, mv.y + mv.dy);
      else freshBoard();
    }
  }
  const playing = round.state === 'playing';
  if (playing && !g.endAt) {
    keyboard();
    mouse();
  }

  g.landed = false;
  const moving = updatePieces();
  if (g.landed) g.sounds.land.play();

  switch (g.phase) {
    case 'swap':
      if (!moving && g.t > R.swapTime * 0.5) {
        g.cascade = 0;
        if (startClear()) {
          if (round.state === 'playing') g.moves--;
        } else {
          // no match: swap back
          const [ax, ay] = g.swapA;
          const [bx, by] = g.swapB;
          B.swap(g.grid, ax, ay, bx, by);
          const ia = ax + ay * R.width;
          const ib = bx + by * R.width;
          [g.pieces[ia], g.pieces[ib]] = [g.pieces[ib], g.pieces[ia]];
          g.sounds.bad.play();
          shake(0.06);
          setPhase('unswap');
        }
      }
      break;
    case 'unswap':
      if (!moving) setPhase('idle');
      break;
    case 'clear':
      for (const p of g.pieces) if (p?.dying) p.scale = 1 + Math.sin(Math.min(1, g.t / R.clearTime) * Math.PI) * 0.35 - Math.max(0, g.t / R.clearTime - 0.6) * 2;
      if (g.t >= R.clearTime) finishClear();
      break;
    case 'fall':
      if (!moving) {
        if (!startClear()) {
          setPhase('idle');
          if (!B.findMove(g.grid)) {
            B.shuffle(g.grid, rand);
            g.pieces = g.grid.cells.map((k, i) => Object.assign(newPiece(k, i % R.width, Math.floor(i / R.width)), { pop: 1 }));
            g.sounds.shuffle.play();
            popText('Shuffle', vec2(R.width / 2, R.height / 2), rgb(0.7, 1, 1), 1);
          }
        }
      }
      break;
    case 'idle':
      g.idle += DT;
      if (g.idle > 6 && !g.hint) g.hint = B.findMove(g.grid);
      break;
    default:
  }

  // the end of a round
  if (playing && g.phase === 'idle' && !g.endAt) {
    if (round.score >= R.target) {
      g.endAt = LJS.time;
      g.won = true;
      g.sounds.win.play();
      flash(rgb(0.7, 1, 1), 0.45);
      shake(0.35);
      for (let i = 0; i < g.pieces.length; i += 3) {
        const p = g.pieces[i];
        const c = kinds[p.kind].glow;
        burst(p.pos, { tile: g.tiles.sparkle, color: rgb(c[0], c[1], c[2]), color2: rgb(1, 1, 1), count: 6, speed: 7, size: 0.4, life: 0.9, damping: 0.94 });
      }
    } else if (g.moves <= 0) {
      g.endAt = LJS.time;
      g.won = false;
      g.sounds.lose.play();
    }
  }
  if (g.endAt && LJS.time - g.endAt > (g.won ? 1.2 : 0.8)) {
    const info = { target: R.target, moves: R.moves - g.moves };
    g.won ? control.win(info) : control.lose(info);
  }

  // bubbles rising through the scene
  for (const b of g.bubbles) {
    b.y += b.v * DT;
    b.x += Math.sin(LJS.time * b.f + b.p) * 0.004;
    if (b.y > 14) { b.y = -6; b.x = Math.random() * 24 - 8; }
  }

  if (playing || round.state !== 'title') g.screens.setHud(hudHtml({ score: round.score, target: R.target, moves: g.moves, total: R.moves, cascade: g.cascade }));
}

/* ------------------------------------------------------------------ drawing */

function renderBoard() {
  const T = g.tiles;
  const t = LJS.time;
  LJS.setAdditiveBlendMode(true);
  for (let i = 0; i < g.pieces.length; i++) {
    const p = g.pieces[i];
    if (!p || p.pos.y > R.height + 0.2) continue;
    const pulse = 0.16 + 0.06 * Math.sin(t * 2 + p.seed);
    LJS.drawTile(p.pos, vec2(1.35 * p.scale), T.glow, glowRGB(p.kind, p.dying ? 0.6 : pulse));
  }
  LJS.setAdditiveBlendMode(false);

  for (let i = 0; i < g.pieces.length; i++) {
    const p = g.pieces[i];
    if (!p || p.pos.y > R.height + 0.45) continue; // still above the tray
    const breathe = 1 + 0.025 * Math.sin(t * 2.2 + p.seed);
    const squash = vec2(1 + p.pop * 0.18, 1 - p.pop * 0.18);
    let s = 0.86 * p.scale * breathe;
    let bob = Math.sin(t * 1.6 + p.seed) * 0.02;
    if (g.hint && ((i % R.width === g.hint.x && Math.floor(i / R.width) === g.hint.y) || (i % R.width === g.hint.x + g.hint.dx && Math.floor(i / R.width) === g.hint.y + g.hint.dy))) {
      s *= 1 + 0.08 * Math.abs(Math.sin(t * 5));
      bob += 0.04 * Math.sin(t * 5);
    }
    const tint = p.dying ? rgb(1, 1, 1) : LJS.WHITE;
    const add = p.dying ? rgb(0.5, 0.5, 0.5, 0) : undefined;
    LJS.drawTile(p.pos.add(vec2(0, bob - p.pop * 0.06)), vec2(s * squash.x, s * squash.y), T[`piece${p.kind}`], tint, Math.sin(t * 1.3 + p.seed) * 0.05, false, add);
  }

  // the keyboard cursor, the mouse selection
  if (round.state === 'playing' && !g.endAt) {
    const c = g.cursor;
    const k = g.grabbed ? 1.06 + 0.04 * Math.sin(t * 12) : 1.02 + 0.03 * Math.sin(t * 4);
    const col = g.grabbed ? rgb(1, 0.85, 0.4) : rgb(0.6, 1, 1, 0.85);
    LJS.drawTile(cellCenter(c.x, c.y), vec2(k), T.frame, col);
    LJS.setAdditiveBlendMode(true);
    LJS.drawTile(cellCenter(c.x, c.y), vec2(1.6), T.glow, g.grabbed ? rgb(1, 0.7, 0.3, 0.3) : rgb(0.4, 0.9, 1, 0.18));
    LJS.setAdditiveBlendMode(false);
    if (g.selected) LJS.drawTile(cellCenter(g.selected.x, g.selected.y), vec2(1.05 + 0.04 * Math.sin(t * 10)), T.frame, rgb(1, 0.85, 0.4));
  }
}

function viewFit() {
  const portrait = LJS.mainCanvasSize.y > LJS.mainCanvasSize.x;
  const span = portrait ? vec2(9.3, 12.4) : vec2(9.6, 9.6);
  const scale = Math.min(LJS.mainCanvasSize.x / span.x, LJS.mainCanvasSize.y / span.y);
  LJS.setCameraScale(scale);
  LJS.setCameraPos(vec2(R.width / 2, R.height / 2 + (portrait ? 0.9 : -0.1)));
}

/* ------------------------------------------------------------------ the game object */

const game = {
  name: 'Glowtide',
  clear: rgb(0.02, 0.1, 0.18),
  post: { glow: 0.8, glowThreshold: 0.62, vignette: 0.55, chromatic: 0.001, grade: 'c.rgb = c.rgb * vec3(0.97, 1.02, 1.05) + vec3(0.0, 0.015, 0.03) * (1. - c.rgb);' },
  theme: {
    ink: '#eafcff',
    accent: '#7ff0ff',
    'cta-ink': '#032433',
    title: '#e8fdff',
    'title-edge': '#0a6a8a',
    glow: 'rgba(90,220,255,.55)',
    scrim: 'radial-gradient(ellipse at 50% 50%, rgba(2,20,40,.35), rgba(1,10,24,.8))',
    'font-display': '"Trebuchet MS", "Avenir Next", "Segoe UI", system-ui, sans-serif',
    'font-ui': '"Avenir Next", "Segoe UI", "Helvetica Neue", system-ui, sans-serif',
  },
  text: {
    title: 'Glowtide',
    tagline: `The tidepool lights up at night. Swap two neighbours to line up three or more of a kind, and reach ${R.target.toLocaleString('en-US')} points in ${R.moves} swaps.`,
    cta: 'Click, tap or press Enter',
    keys: [['Drag', 'swap'], ['← ↑ → ↓', 'move'], ['Space', 'pick up, then an arrow to swap']],
    won: { title: 'The pool is glowing', line: (i) => `<b>${i.score.toLocaleString('en-US')}</b> points in ${i.moves} swaps`, cta: 'Play again' },
    lost: { title: 'Out of swaps', line: (i) => `<b>${i.score.toLocaleString('en-US')}</b> of ${(i.target ?? R.target).toLocaleString('en-US')} points`, cta: 'Try again' },
  },
  touch: [], // the board itself is the touch control: tap two neighbours, or drag

  init({ screens }) {
    g.screens = screens;
    bindActions({
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      grab: ['Space', 'KeyZ', 'KeyX'],
    });
    g.sounds = makeSounds();
    g.tiles = atlasTiles(packAtlas(sprites)).tiles;

    // the seabed backdrop, a static layer behind everything
    const bw = 34;
    const bh = 18;
    const seabed = paintSeabed(bw, bh, 40);
    const bg = new LJS.CanvasLayer(vec2(R.width / 2, R.height / 2 - 1), vec2(bw, bh), 0, -100, vec2(seabed.width, seabed.height));
    bg.context.drawImage(seabed, 0, 0);
    bg.updateWebGL();

    // light from the surface, caustics and bubbles, drawn over the backdrop
    for (let i = 0; i < 26; i++) g.bubbles.push({ x: Math.random() * 24 - 8, y: Math.random() * 20 - 6, v: 0.4 + Math.random() * 0.8, s: 0.08 + Math.random() * 0.16, f: 1 + Math.random() * 2, p: Math.random() * 6 });
    const water = new LJS.EngineObject(vec2(), vec2());
    water.mass = 0;
    water.renderOrder = -50;
    water.render = () => {
      const t = LJS.time;
      LJS.setAdditiveBlendMode(true);
      for (let i = 0; i < 7; i++) {
        const x = -6 + i * 3.6 + Math.sin(t * 0.3 + i) * 0.6;
        const a = 0.05 + 0.04 * Math.sin(t * 0.7 + i * 1.7);
        LJS.drawTile(vec2(x, 9), vec2(1.4 + (i % 3) * 0.7, 16), g.tiles.ray, rgb(0.5, 0.95, 1, a), -0.32 + 0.04 * Math.sin(t * 0.2 + i));
      }
      for (let i = 0; i < 9; i++) {
        const x = -4 + ((i * 3.1 + t * 0.15) % 18);
        const y = 11 + Math.sin(t * 0.5 + i * 2) * 0.6;
        LJS.drawTile(vec2(x, y), vec2(3.5, 1.3), g.tiles.glow, rgb(0.4, 0.9, 1, 0.07));
      }
      LJS.setAdditiveBlendMode(false);
      for (const b of g.bubbles) LJS.drawTile(vec2(b.x, b.y), vec2(b.s), g.tiles.bubble, rgb(1, 1, 1, 0.5));
    };

    // the glass tray
    const px = 96;
    const tray = paintBoard(R.width, R.height, px);
    const trayLayer = new LJS.CanvasLayer(vec2(R.width / 2, R.height / 2), vec2(R.width + tray.pad * 2, R.height + tray.pad * 2), 0, -10, vec2(tray.canvas.width, tray.canvas.height));
    trayLayer.context.drawImage(tray.canvas, 0, 0);
    trayLayer.updateWebGL();

    const board = new LJS.EngineObject(vec2(), vec2());
    board.mass = 0;
    board.renderOrder = 10;
    board.render = renderBoard;

    const style = document.createElement('style');
    style.textContent = hudCss;
    document.head.appendChild(style);
    freshBoard();
    viewFit();
  },

  onGesture() { music.start(); },

  start() {
    g.moves = R.moves;
    g.cascade = 0;
    g.endAt = 0;
    g.won = false;
    g.grabbed = false;
    g.selected = null;
    g.drag = null;
    g.hint = null;
    g.idle = 0;
    g.cursor = { x: 3, y: 3 };
    g.bot = { cool: 0, plan: [] };
    freshBoard();
  },

  update() {
    viewFit();
    update();
  },

  renderPost() { drawFx('"Trebuchet MS", system-ui, sans-serif'); },

  snapshot() {
    const o = LJS.worldToScreen(vec2(0.5, 0.5));
    const one = LJS.worldToScreen(vec2(1.5, 1.5));
    return {
      swaps: g.swaps ?? 0,
      // where cell (0, 0) is on screen and how far apart cells are, in CSS pixels, so a test can click them
      screen: { x0: +o.x.toFixed(1), y0: +o.y.toFixed(1), dx: +(one.x - o.x).toFixed(2), dy: +(one.y - o.y).toFixed(2) },
      moves: g.moves,
      target: R.target,
      phase: g.phase,
      cursor: { ...g.cursor },
      grabbed: g.grabbed,
      selected: g.selected ? { ...g.selected } : null,
      cascade: g.cascade,
      kinds: g.grid ? g.grid.cells.slice() : [],
      biggest: g.biggest,
    };
  },

  /** The bot: finds the best swap, walks the cursor there with the arrow actions, picks it up
   *  with grab and pushes it the right way: the same presses a keyboard player makes. */
  bot() {
    const b = input.bot;
    for (const k of ['left', 'right', 'up', 'down', 'grab']) b[k] = false;
    if (g.bot.cool > 0) { g.bot.cool--; return; }
    if (g.phase !== 'idle' || g.endAt) { g.bot.plan = []; return; }
    if (!g.bot.plan.length) {
      const mv = B.findMove(g.grid);
      if (!mv) return;
      const plan = [];
      let { x, y } = g.cursor;
      if (g.grabbed) plan.push('grab');
      while (x < mv.x) { plan.push('right'); x++; }
      while (x > mv.x) { plan.push('left'); x--; }
      while (y < mv.y) { plan.push('up'); y++; }
      while (y > mv.y) { plan.push('down'); y--; }
      plan.push('grab', mv.dx ? 'right' : 'up');
      g.bot.plan = plan;
    }
    b[g.bot.plan.shift()] = true;
    g.bot.cool = 3;
  },

  debug: {
    /** put any kinds on the board, bottom row first: e.g. to set up a cascade for a test */
    setBoard: (cells) => { g.grid.cells = cells.slice(); g.pieces = cells.map((k, i) => newPiece(k, i % R.width, Math.floor(i / R.width))); setPhase('idle'); },
  },
};

game.shots = makeShots({ g, freshBoard, trySwap, setPhase, B, R });
export default game;
