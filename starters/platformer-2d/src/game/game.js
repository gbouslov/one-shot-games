// The default game, "Sparkwright": a little brass robot climbs a ridge at sundown, gathers
// sunseeds, stomps bramblebugs and wakes the beacon at the top. Everything game-specific is in
// src/game; src/kit is the engine glue every game made from this starter shares.
import * as LJS from '../kit/engine.js';
import { round, control } from '../kit/boot.js';
import { input, bindActions } from '../kit/input.js';
import { packAtlas, atlasTiles } from '../kit/art.js';
import { drawFx, burst, shake, flash } from '../kit/fx.js';
import { createPixelFx } from '../kit/pixelfx.js';
import { makeEffects } from './effects.js';
import { tuning as K, palette as P } from './config.js';
import { level, buildGrid } from './level.js';
import { sprites, paintTerrain, paintMountains, paintHills, paintForest, ridgeAt } from './art.js';
import { makeSounds, music } from './sounds.js';
import { Player, Bug, Seed, Lantern, Beacon, art, world, additive, glow } from './entities.js';
import { makeShots } from './shots.js';
import { hudCss, hudHtml } from './hud.js';

const { vec2, rgb, hsl } = LJS;
const PX = 48; // terrain pixels per tile

const g = {
  player: null,
  things: [],
  lanterns: [],
  beacon: null,
  checkpoint: null,
  hearts: K.hearts,
  seeds: 0,
  seedsTotal: level.seeds.length,
  bugs: 0,
  seedChain: 0,
  winAt: 0,
  loseAt: 0,
  cam: vec2(),
  look: 0,
  motes: [],
  glowSpots: [],
  quality: 'high',
};
world.game = g;

g.addScore = (n, kind) => {
  round.score += n;
  if (kind === 'seed') g.seeds++;
  if (kind === 'bug') g.bugs++;
};

g.loseHeart = () => {
  g.hearts = Math.max(0, g.hearts - 1);
  if (g.hearts === 0 && !g.loseAt) {
    g.loseAt = LJS.time;
    g.player.frozen = true;
    world.sounds.lose.play();
  }
};

g.fell = () => {
  const p = g.player;
  if (p.frozen) return;
  world.sounds.fall.play();
  shake(0.3);
  flash(rgb(0.3, 0.1, 0.4), 0.4);
  g.loseHeart();
  if (g.hearts > 0) {
    const at = g.checkpoint ?? vec2(...level.start);
    p.pos = vec2(at.x, at.y + 0.6);
    p.velocity = vec2();
    p.hurtTimer.set(1);
    burst(p.pos, { color: hsl(0.13, 1, 0.75), count: 24, speed: 5, size: 0.14, life: 0.5, tile: art.tiles.shard });
  } else {
    p.pos = vec2(p.pos.x, -2);
  }
};

function viewSize() {
  const scale = LJS.mainCanvasSize.y / K.viewHeight;
  return vec2(LJS.mainCanvasSize.x / scale, K.viewHeight);
}

function placeCamera(target, snap) {
  const v = viewSize();
  const W = world.grid.w;
  const H = world.grid.h;
  const x = LJS.clamp(target.x, v.x / 2, W - v.x / 2);
  const y = LJS.clamp(target.y, v.y / 2 - 1.2, H - v.y / 2 + 1);
  const want = vec2(x, y);
  g.cam = snap ? want : g.cam.lerp(want, 0.12);
  LJS.setCameraScale(LJS.mainCanvasSize.y / K.viewHeight);
  LJS.setCameraPos(g.cam);
}

function spawnRound() {
  for (const t of g.things) t.destroy();
  g.things = [];
  g.lanterns = [];
  g.player = new Player(vec2(level.start[0], level.start[1] + 0.5));
  g.things.push(g.player);
  for (const [x, y] of level.seeds) g.things.push(new Seed(vec2(x, y)));
  for (const [x, y] of level.bugs) g.things.push(new Bug(vec2(x, y + 0.3)));
  for (const x of level.checkpoints) {
    const s = world.grid.surface(x);
    const l = new Lantern(vec2(x + 0.5, s + 1));
    l.spawn = vec2(x + 0.5, s);
    g.lanterns.push(l);
    g.things.push(l);
  }
  const [bx, by] = level.beacon;
  g.beacon = new Beacon(vec2(bx, by + 2.5));
  g.things.push(g.beacon);
  g.hearts = K.hearts;
  g.seeds = 0;
  g.bugs = 0;
  g.seedChain = 0;
  g.winAt = 0;
  g.loseAt = 0;
  g.checkpoint = null;
}

function makeMotes() {
  // drifting sparks of light in front of the scene
  g.motes = [];
  const n = g.quality === 'low' ? 18 : 40;
  for (let i = 0; i < n; i++) {
    g.motes.push({ x: Math.random(), y: Math.random(), s: 0.05 + Math.random() * 0.1, p: Math.random() * 10, d: 0.3 + Math.random() * 0.7 });
  }
}

/* ------------------------------------------------------------------ the game object */

const game = {
  name: 'Sparkwright',
  clear: LJS.rgb(0.08, 0.06, 0.2),
  post: {
    glow: 0.85,
    glowThreshold: 0.6,
    vignette: 0.5,
    chromatic: 0.0012,
    // a warm grade: lift the shadows toward violet, keep highlights golden
    grade: 'c.rgb = c.rgb * vec3(1.04, 1.0, 0.97) + vec3(0.025, 0.005, 0.045) * (1. - c.rgb);',
  },
  theme: {
    ink: '#fff4ea',
    accent: '#ffc24a',
    'cta-ink': '#3a1606',
    title: '#ffe2a8',
    'title-edge': '#b2462a',
    glow: 'rgba(255,150,80,.55)',
    scrim: 'radial-gradient(ellipse at 50% 55%, rgba(30,10,50,.25), rgba(15,5,30,.72))',
    'font-display': '"Trebuchet MS", "Avenir Next", "Segoe UI", system-ui, sans-serif',
    'font-ui': '"Avenir Next", "Segoe UI", "Helvetica Neue", system-ui, sans-serif',
  },
  text: {
    title: 'Sparkwright',
    tagline: 'The ridge goes dark tonight unless someone climbs it. Gather the sunseeds, hop on the bramblebugs, and wake the beacon at the top.',
    cta: 'Click, tap or press Enter',
    keys: [['← →', 'run'], ['Space', 'jump'], ['A D W', 'also work']],
    won: { title: 'The beacon is lit', line: (i) => `<b>${i.seeds}</b> of ${i.total} sunseeds &nbsp;·&nbsp; <b>${i.score}</b> points &nbsp;·&nbsp; ${i.time.toFixed(1)} s`, cta: 'Climb again' },
    lost: { title: 'Out of sparks', line: (i) => `${i.seeds} sunseeds gathered &nbsp;·&nbsp; <b>${i.score}</b> points`, cta: 'Try again' },
  },
  touch: [
    { action: 'left', label: '◀', left: 18 },
    { action: 'right', label: '▶', left: 110 },
    { action: 'jump', label: '▲', right: 22, size: 92 },
  ],

  init({ quality, screens }) {
    g.quality = quality;
    g.screens = screens;
    bindActions({
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
    });
    world.sounds = makeSounds();
    world.grid = buildGrid(level);
    LJS.setGravity(vec2(0, K.gravity));

    // sprites onto the GPU
    const { tiles } = atlasTiles(packAtlas(sprites));
    art.tiles = tiles;

    // backdrops, far to near. `at` is where the skyline sits, in tiles above the middle of the
    // view, when the camera is at a typical height; the parallax keeps it near there.
    const H = world.grid.h;
    const backdrop = (paint, ridge, { size, parallax, order, at }) => {
      const camY = 8;
      const center = camY + at - (size.y / 2 - ridge * size.y);
      const pos = vec2(0, camY + (center - camY) / (1 - parallax.y));
      const px = 2048 / size.x;
      const l = new LJS.ParallaxLayer(pos, size, parallax, order, paint, vec2(2048, Math.round(size.y * px)));
      l.persistent = true;
      return l;
    };
    backdrop(paintMountains, ridgeAt.mountains, { size: vec2(64, 22), parallax: vec2(0.9, 0.88), order: -3000, at: 1.6 });
    backdrop(paintHills, ridgeAt.hills, { size: vec2(50, 18), parallax: vec2(0.75, 0.7), order: -2900, at: -0.6 });
    backdrop(paintForest, ridgeAt.forest, { size: vec2(40, 16), parallax: vec2(0.5, 0.62), order: -2800, at: -1.9 });

    // terrain art, one canvas the size of the level
    const { canvas, glows } = paintTerrain(world.grid, PX);
    const terrain = new LJS.CanvasLayer(vec2(world.grid.w / 2, H / 2), vec2(world.grid.w, H), 0, 0, vec2(canvas.width, canvas.height));
    terrain.context.drawImage(canvas, 0, 0);
    terrain.updateWebGL();
    terrain.persistent = true;
    g.glowSpots = glows;

    // collision, invisible: solid cells and one-way ledges
    const collide = new LJS.TileCollisionLayer(vec2(), vec2(world.grid.w, H), LJS.tile(0, 1), 0, false);
    collide.render = () => {};
    collide.setOneWay(1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < world.grid.w; x++) {
        const k = world.grid.get(x, y);
        if (k === 'solid') collide.setCollisionData(vec2(x, y), 1);
        if (k === 'ledge') {
          collide.setData(vec2(x, y), new LJS.TileLayerData(1));
          collide.setCollisionData(vec2(x, y), 1);
        }
      }
    }

    // a light pass for the little glowing things painted into the terrain
    const glowLayer = new LJS.EngineObject(vec2(), vec2());
    glowLayer.mass = 0;
    glowLayer.renderOrder = 1;
    glowLayer.persistent = true;
    glowLayer.render = () => additive(() => {
      for (const s of g.glowSpots) {
        if (Math.abs(s.x - LJS.cameraPos.x) > 16) continue;
        const k = 0.8 + 0.2 * Math.sin(LJS.time * 1.7 + s.x * 3);
        glow(vec2(s.x, s.y), 1.1 * k, rgb(0.72, 0.5, 1, 0.38 * k));
      }
    });

    // pixel-art effects at the moments of action: over the robot and bugs, under the motes
    world.pfx = createPixelFx({ pxPerTile: 32, renderOrder: 30 });
    world.effects = makeEffects(world.pfx);

    // drifting motes in front of everything
    makeMotes();
    const motes = new LJS.EngineObject(vec2(), vec2());
    motes.mass = 0;
    motes.renderOrder = 40;
    motes.persistent = true;
    motes.render = () => {
      const v = viewSize();
      additive(() => {
        for (const m of g.motes) {
          const x = LJS.cameraPos.x - v.x / 2 + (((m.x * v.x * 1.4 + LJS.time * 0.3 * m.d - LJS.cameraPos.x * (1 - m.d) * 0.4) % (v.x * 1.4)) + v.x * 1.4) % (v.x * 1.4) - v.x * 0.2;
          const y = LJS.cameraPos.y - v.y / 2 + ((m.y * v.y + Math.sin(LJS.time * 0.6 + m.p) * 0.6 + LJS.time * 0.15 * m.d) % v.y);
          const tw = 0.6 + 0.4 * Math.sin(LJS.time * 3 + m.p);
          glow(vec2(x, y), m.s * 4, rgb(1, 0.8, 0.55, 0.5 * tw));
        }
      });
    };

    spawnRound();
    placeCamera(vec2(14, 8), true);
    const style = document.createElement('style');
    style.textContent = hudCss;
    document.head.appendChild(style);
  },

  onGesture() {
    music.start();
  },

  start() {
    world.pfx.clear();
    spawnRound();
    placeCamera(g.player.pos.add(vec2(3, 1.5)), true);
  },

  update() {
    const p = g.player;
    if (round.state === 'title') {
      // a slow pan over the ridge behind the title
      const t = LJS.time * 0.08;
      placeCamera(vec2(14 + (Math.sin(t - Math.PI / 2) + 1) * 0.5 * (world.grid.w - 28), 8 + Math.sin(t * 2.3) * 0.6), false);
      p.frozen = true;
      return;
    }
    if (round.state !== 'playing') {
      placeCamera(g.cam, false);
      return;
    }
    p.frozen = !!(g.winAt || g.loseAt);

    // lantern posts
    for (const l of g.lanterns) {
      if (!l.lit && p.pos.x > l.pos.x - 0.3) {
        l.light();
        g.checkpoint = l.spawn;
      }
    }
    // the beacon
    if (!g.winAt && Math.abs(p.pos.x - g.beacon.pos.x) < 1.1 && p.pos.y < g.beacon.pos.y + 3) {
      g.winAt = LJS.time;
      g.beacon.ignite();
      round.score += 500 + g.hearts * 100;
    }
    if (g.winAt && LJS.time - g.winAt > 1.1) control.win({ seeds: g.seeds, total: g.seedsTotal });
    if (g.loseAt && LJS.time - g.loseAt > 0.9) control.lose({ seeds: g.seeds, total: g.seedsTotal });

    // camera leads where you run
    g.look = LJS.lerp(g.look, p.facing * 2.2, 0.04);
    placeCamera(p.pos.add(vec2(g.look, 1.6)), false);

    screensHud();
  },

  render() {
    // sky, behind everything
    const v = viewSize();
    const c = LJS.cameraPos;
    const top = c.y + v.y / 2;
    // the bands are fixed to the view: the glow of the horizon sits just behind the far skyline
    const bands = [[P.skyTop, 0], [P.skyMid, 0.17], [P.skyLow, 0.3], [P.horizon, 0.42], [P.skyLow, 0.75]];
    for (let i = 0; i < bands.length - 1; i++) {
      const [ca, ta] = bands[i];
      const [cb, tb] = bands[i + 1];
      const y0 = top - ta * v.y;
      const y1 = top - tb * v.y;
      LJS.drawRectGradient(vec2(c.x, (y0 + y1) / 2), vec2(v.x + 2, y0 - y1 + 0.02), hexColor(ca), hexColor(cb));
    }
    LJS.drawRect(vec2(c.x, top - v.y * 0.75 - 5), vec2(v.x + 2, 10), hexColor(P.skyLow));
    additive(() => {
      // stars in the upper sky
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 97.13) % 1) * v.x;
        const sy = ((i * 41.71) % 1) * v.y * 0.45;
        const tw = 0.5 + 0.5 * Math.sin(LJS.time * 2 + i * 1.3);
        LJS.drawTile(vec2(c.x - v.x / 2 + sx, top - sy), vec2(0.08 + (i % 3) * 0.03), art.tiles.glow, rgb(1, 0.95, 1, 0.5 * tw * (1 - sy / (v.y * 0.45))));
      }
      // the setting sun, fixed in the sky
      const sun = vec2(c.x + v.x * 0.2, top - v.y * 0.33);
      glow(sun, v.y * 1.6, rgb(1, 0.45, 0.35, 0.35));
      glow(sun, v.y * 0.7, rgb(1, 0.65, 0.4, 0.45));
      glow(sun, 3.2, rgb(1, 0.9, 0.7, 0.9));
      glow(sun, 2.1, rgb(1, 1, 0.9, 1));
      // long soft clouds
      for (let i = 0; i < 5; i++) {
        const cx = c.x + ((((i * 0.37 + LJS.time * 0.004 * (i + 1) - c.x * 0.002) % 1) + 1) % 1 - 0.5) * v.x * 1.4;
        const cy = top - v.y * (0.1 + i * 0.045);
        LJS.drawTile(vec2(cx, cy), vec2(9 + i * 2, 0.7 + (i % 2) * 0.3), art.tiles.glow, rgb(1, 0.55, 0.6, 0.13));
      }
    });
  },

  renderPost() {
    drawFx('"Trebuchet MS", system-ui, sans-serif');
  },

  snapshot() {
    const p = g.player;
    return {
      player: p ? { x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), vx: +p.velocity.x.toFixed(4), vy: +p.velocity.y.toFixed(4), grounded: p.grounded, facing: p.facing, peak: +p.peak.toFixed(3), jumpHeld: input.down('jump'), jumping: p.jumping, frozen: p.frozen } : null,
      hearts: g.hearts,
      seeds: g.seeds,
      seedsTotal: g.seedsTotal,
      bugsStomped: g.bugs,
      bugsAlive: g.things.filter((t) => t instanceof Bug && !t.destroyed).length,
      checkpoint: g.checkpoint ? g.checkpoint.x : null,
      beaconLit: !!g.beacon?.lit,
      toBeacon: p ? +(g.beacon.pos.x - p.pos.x).toFixed(2) : null,
      pixelfx: world.pfx ? { ...world.pfx.stats } : null,
    };
  },

  /** The bot: runs right, jumps at walls, pits, brambles and bugs, holds jump for full height. */
  bot() {
    const p = g.player;
    const grid = world.grid;
    const b = input.bot;
    b.left = false;
    b.right = true;
    const row = Math.floor(p.pos.y - 0.45 + 0.05);
    const x = p.pos.x;
    const solid = (cx, cy) => grid.get(Math.floor(cx), cy) === 'solid';
    const wall = solid(x + 0.75, row) || solid(x + 0.75, row + 1);
    const pit = !solid(x + 0.7, row - 1) && !solid(x + 0.7, row - 2) && grid.get(Math.floor(x + 0.7), row - 1) !== 'ledge';
    let thorns = false;
    for (let d = 0.4; d <= 1.6; d += 0.3) if (grid.get(Math.floor(x + d), row) === 'thorns') thorns = true;
    let bug = false;
    for (const t of g.things) {
      if (!(t instanceof Bug) || t.destroyed) continue;
      const dx = t.pos.x - x;
      if (dx > -0.2 && dx < 2.4 && Math.abs(t.pos.y - p.pos.y) < 1.2) bug = true;
    }
    const want = wall || pit || thorns || bug;
    if (p.jumping && p.velocity.y > 0) b.jump = true; // hold for full height
    else if (p.grounded) b.jump = want && !b.jump; // release then press, so each jump is a fresh press
    else b.jump = false;
  },

  debug: {
    teleport: (x, y) => { g.player.pos = vec2(x, y); g.player.velocity = vec2(); },
  },

};
game.shots = makeShots({ g, placeCamera, advanceFx: (s) => world.pfx?.advance(s) });
export default game;

function screensHud() {
  g.screens.setHud(hudHtml({ seeds: g.seeds, total: g.seedsTotal, hearts: g.hearts, max: K.hearts, score: round.score, progress: LJS.clamp(g.player.pos.x / level.beacon[0], 0, 1) }));
}

const hexCache = new Map();
function hexColor(h) {
  if (!hexCache.has(h)) {
    const n = parseInt(h.slice(1), 16);
    hexCache.set(h, rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255));
  }
  return hexCache.get(h);
}
