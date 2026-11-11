// Pixel-art effects from pixelfx (patch-gg/pixelfx, MIT, vendored in ./vendor/pixelfx) drawn into the
// LittleJS world. The bridge owns one pixel frame the size of the view at `pxPerTile`, steps every live
// effect on the engine's own updates (so hit stop and the 0.1 s clamp in boot.js apply to them too), and
// draws the frame's two buffers over the scene each frame as nearest-neighbour textures: `color` with
// normal blending, `light` added on top. Nothing is drawn while no effect is alive.
//
//   const pfx = createPixelFx({ pxPerTile: 32, renderOrder: 30 });
//   pfx.spawn(poof, pos, { palette, seed, flip, light, delay })   pos is a world vec2 (y up)
//   pfx.clear()                                                    drop every effect (a new round)
//   pfx.stats                                                      { alive, spawned } for snapshots
import * as LJS from './engine.js';
import { createFrame, clearFrame, createFx } from './vendor/pixelfx/src/core/index.js';

const { vec2 } = LJS;

export function createPixelFx({ pxPerTile = 32, renderOrder = 30 } = {}) {
  const live = [];
  const stats = { alive: 0, spawned: 0, drawn: 0 };
  let frame = null;
  let colorTex = null;
  let lightTex = null;
  let colorTile = null;
  let lightTile = null;
  let serial = 0;

  // a frame (and two textures) as big as the view, rebuilt only when the view's size changes
  const fit = (w, h) => {
    if (frame && frame.w === w && frame.h === h) return;
    colorTex?.destroyWebGLTexture?.();
    lightTex?.destroyWebGLTexture?.();
    frame = createFrame(w, h);
    const canvas = (cw, ch) => Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    colorTex = new LJS.TextureInfo(canvas(w, h), true, false, true);
    lightTex = new LJS.TextureInfo(canvas(w, h), true, false, true);
    colorTile = new LJS.TileInfo(vec2(), vec2(w, h), colorTex, 0, 0);
    lightTile = new LJS.TileInfo(vec2(), vec2(w, h), lightTex, 0, 0);
  };

  const layer = new LJS.EngineObject(vec2(), vec2());
  layer.mass = 0;
  layer.persistent = true;
  layer.renderOrder = renderOrder;
  layer.gravityScale = 0;

  // one engine update is 1/60 s of game time; no updates run during hit stop
  const step = (dt) => {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      if (e.delay > 0) {
        e.delay -= dt;
        continue;
      }
      e.fx.update(dt);
      if (e.fx.done()) live.splice(i, 1);
    }
    stats.alive = live.length;
  };
  layer.update = () => step(LJS.timeDelta || 1 / 60);

  layer.render = () => {
    if (!live.some((e) => e.delay <= 0)) return;
    // the view in world tiles, and the same box in frame pixels (x right, y down)
    const scale = LJS.cameraScale;
    const vw = LJS.mainCanvasSize.x / scale;
    const vh = LJS.mainCanvasSize.y / scale;
    const w = Math.ceil(vw * pxPerTile) + 2;
    const h = Math.ceil(vh * pxPerTile) + 2;
    fit(w, h);
    frame.ox = Math.floor((LJS.cameraPos.x - vw / 2) * pxPerTile) - 1;
    frame.oy = Math.floor(-(LJS.cameraPos.y + vh / 2) * pxPerTile) - 1;
    clearFrame(frame);
    for (const e of live) if (e.delay <= 0) e.fx.draw(frame);
    // the buffers are already RGBA bytes (little-endian ABGR words), so they upload as they are
    colorTex.updateData(new Uint8Array(frame.color.buffer));
    lightTex.updateData(new Uint8Array(frame.light.buffer));
    const center = vec2((frame.ox + w / 2) / pxPerTile, -(frame.oy + h / 2) / pxPerTile);
    const size = vec2(w / pxPerTile, h / pxPerTile);
    LJS.drawTile(center, size, colorTile);
    LJS.setAdditiveBlendMode(true);
    LJS.drawTile(center, size, lightTile);
    LJS.setAdditiveBlendMode(false);
    stats.drawn++;
  };

  return {
    stats,
    pxPerTile,
    /** Start an effect module at a world position. o: palette, seed, flip, angle, light, delay (s), and the effect's own options. */
    spawn(mod, pos, o = {}) {
      const { delay = 0, ...opts } = o;
      const fx = createFx(mod, { seed: (mod.meta?.options?.seed ?? 1) + serial++, ...opts, x: pos.x * pxPerTile, y: -pos.y * pxPerTile });
      live.push({ fx, delay });
      stats.spawned++;
      stats.alive = live.length;
      return fx;
    },
    clear() {
      live.length = 0;
      stats.alive = 0;
    },
    /** Run every live effect on by `seconds` at once (for capture set-ups). */
    advance(seconds) {
      for (let t = 0; t < seconds - 1e-6; t += 1 / 60) step(1 / 60);
    },
  };
}
