import * as THREE from 'three';
import { createFrame, clearFrame, createFx, composite } from '../vendor/pixelfx/src/core/index.js';
import * as hitSpark from '../vendor/pixelfx/src/fx/impacts/hit-spark.js';
import * as bulletImpact from '../vendor/pixelfx/src/fx/impacts/bullet-impact.js';
import * as collectBurst from '../vendor/pixelfx/src/fx/pickups/collect-burst.js';

/**
 * Pixel-art effects from pixelfx (patch-gg/pixelfx, MIT, vendored in ../vendor/pixelfx) used as light:
 * each live effect paints its own small pixel frame, which goes into a CanvasTexture on an additive,
 * camera-facing billboard (nearest-neighbour, so the pixels stay crisp). Additive means the effect can
 * only brighten the scene, so it reads as a flare or spark rather than a sticker.
 *
 * OFF by default: the default game's look is realistic, and these clash with it (see README). Turn it on
 * for a stylised game with `pixelfx: { enabled: true }` in src/game/config.js, or ?pixelfx=1.
 *
 *   pixelfx.spawn(module, [x, y, z], { ppm, dir: [dx, dz], palette, seed, ...the effect's options })
 *
 * When enabled it listens for weapon:fire (a flare at the muzzle along the shot), weapon:impact (sparks
 * off the wall) and pickup (a burst in the pickup's colour). `on` in the config swaps or drops any of them.
 */
const DEFAULTS = {
  fire: { fx: hitSpark, ppm: 64, opts: { aim: 0, height: 0, palette: ['#3a1206', '#a8401a', '#f07a2a', '#ffb35c', '#ffe2a0', '#fff6dc', '#ffffff'] } },
  impact: { fx: bulletImpact, ppm: 44, opts: { height: 0, palette: ['#3a1206', '#a8401a', '#f07a2a', '#ffb35c', '#ffe2a0', '#fff6dc', '#ffffff'] } },
  pickup: { fx: collectBurst, ppm: 40, opts: {} },
};

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class PixelFxSystem {
  static id = 'pixelfx';
  static deps = ['render', 'fx'];

  init(ctx) {
    this.ctx = ctx;
    const cfg = ctx.config.pixelfx ?? {};
    const param = new URLSearchParams(location.search).get('pixelfx');
    this.enabled = param != null ? param === '1' : !!cfg.enabled;
    this.max = cfg.max ?? 16;
    this.on = { ...DEFAULTS, ...(cfg.on ?? {}) };
    this.live = [];
    this.pool = new Map(); // effect module -> idle billboards of its size
    this.stats = { spawned: 0, alive: 0 };
    this.group = new THREE.Group();
    ctx.scene.add(this.group);

    ctx.events.on('weapon:fire', (e) => {
      if (!this.enabled || !this.on.fire || e?.x == null) return;
      // the auto-weapons report where they fired from and which way
      this._moment(this.on.fire, [e.x + (e.dx ?? 0) * 0.6, e.y ?? 1.1, e.z + (e.dz ?? 0) * 0.6], e.dx || e.dz ? [e.dx, e.dz] : null);
    });
    ctx.events.on('weapon:impact', (e) => {
      if (!this.enabled || !this.on.impact) return;
      // the effect's wall faces left, so it points along the incoming shot
      this._moment(this.on.impact, [e.x, e.y, e.z], [e.dx, e.dz]);
    });
    ctx.events.on('pickup', (e) => {
      if (!this.enabled || !this.on.pickup || e.x == null) return;
      const c = new THREE.Color(e.color ?? '#9effc4');
      this._moment(this.on.pickup, [e.x, 0.15, e.z], null, { palette: ramp(c) });
    });
  }

  _moment(def, pos, dir, extra = {}) {
    this.spawn(def.fx, pos, { ppm: def.ppm, dir, ...def.opts, ...extra });
  }

  /** Start an effect at a world point. dir [dx, dz] turns a directional effect (which faces right) to that heading on screen. */
  spawn(mod, pos, o = {}) {
    const { ppm = 40, dir = null, ...opts } = o;
    if (this.live.length >= this.max) this._release(this.live.shift());
    const b = this._billboard(mod);
    b.fx = createFx(mod, { seed: (mod.meta?.options?.seed ?? 1) + this.stats.spawned, ...opts, x: b.ox, y: b.oy });
    b.dir = dir;
    b.sprite.position.set(pos[0], pos[1], pos[2]);
    b.sprite.scale.set(b.w / ppm, b.h / ppm, 1);
    b.sprite.visible = true;
    this.live.push(b);
    this.stats.spawned++;
    return b.fx;
  }

  _billboard(mod) {
    const idle = this.pool.get(mod);
    if (idle?.length) return idle.pop();
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(ox / w, 1 - oy / h); // the effect's origin sits on the world point
    sprite.renderOrder = 12;
    sprite.frustumCulled = false;
    // GTAOPass hides points and lines (by these flags) from its depth-normal pass; without this the
    // billboard quads are drawn into it and the AO darkens a rectangle round every effect
    sprite.isLine2 = true;
    this.group.add(sprite);
    return { mod, w, h, ox, oy, canvas, g: canvas.getContext('2d'), img: new ImageData(w, h), frame: createFrame(w, h), tex, sprite };
  }

  _release(b) {
    b.sprite.visible = false;
    b.fx = null;
    if (!this.pool.has(b.mod)) this.pool.set(b.mod, []);
    this.pool.get(b.mod).push(b);
  }

  update(dt, ctx) {
    const cam = ctx.camera;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.fx.update(dt);
      if (b.fx.done()) {
        this._release(b);
        this.live.splice(i, 1);
        continue;
      }
      clearFrame(b.frame);
      b.fx.draw(b.frame);
      composite(b.frame, b.img.data, null);
      b.g.putImageData(b.img, 0, 0);
      b.tex.needsUpdate = true;
      if (b.dir) {
        // the heading as it looks on screen
        _v.copy(b.sprite.position).project(cam);
        _w.set(b.sprite.position.x + b.dir[0], b.sprite.position.y, b.sprite.position.z + b.dir[1]).project(cam);
        b.sprite.material.rotation = Math.atan2((_w.y - _v.y) / cam.aspect, _w.x - _v.x);
      }
    }
    this.stats.alive = this.live.length;
  }

  clear() {
    for (const b of this.live) this._release(b);
    this.live = [];
    this.stats.alive = 0;
  }
}

/** A dark-to-bright ramp through one colour, for recolouring an effect to a pickup. */
function ramp(c) {
  const hsl = {};
  c.getHSL(hsl);
  return [0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 1].map((l) => `#${new THREE.Color().setHSL(hsl.h, hsl.s, l).getHexString()}`);
}
