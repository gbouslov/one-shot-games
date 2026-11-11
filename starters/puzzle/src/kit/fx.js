// Game feel: particles, shake, flash, hit stop, floating text, and the post-process pass.
import * as LJS from './engine.js';

const { vec2 } = LJS;

export const fx = {
  quality: 'high',
  freeze: 0, // seconds of hit stop left, read by the loop in boot.js
  flashColor: null,
  flashAlpha: 0,
  pops: [],
};

/** The full-screen pass, by quality. low: a vignette only; medium: plus colour fringe; high: plus glow.
 *  extra: GLSL lines run last on `c` (the colour) and `uv`, e.g. a grade. */
export function setupPost(quality, { glow = 0.9, glowThreshold = 0.55, vignette = 0.55, chromatic = 0.0015, scanlines = 0, grade = '' } = {}) {
  fx.quality = quality;
  const parts = [];
  if (quality !== 'low' && chromatic) parts.push(LJS.postProcessChromatic(chromatic));
  if (quality === 'high' && glow) parts.push(LJS.postProcessGlow(glowThreshold, glow, 8));
  if (scanlines && quality !== 'low') parts.push(LJS.postProcessScanlines(scanlines, 3));
  if (vignette) parts.push(LJS.postProcessVignette(vignette, 2.2));
  if (grade) parts.push(grade);
  return new LJS.PostProcessPlugin(LJS.postProcessEffects(...parts));
}

const n = (count) => Math.max(1, Math.round(count * (fx.quality === 'low' ? 0.5 : 1)));

/**
 * One burst of particles.
 * opts: color, color2, end, end2, count, speed, size, sizeEnd, life, gravity, cone, angle, spread,
 *       additive, tile, damping, collide, order
 */
export function burst(pos, o = {}) {
  const color = o.color ?? LJS.WHITE;
  const color2 = o.color2 ?? color;
  const end = o.end ?? color.scale(1, 0);
  const end2 = o.end2 ?? color2.scale(1, 0);
  const count = n(o.count ?? 20);
  const emitTime = 1 / 30;
  const e = new LJS.ParticleEmitter(
    pos, o.angle ?? 0, o.spread ?? 0.1, emitTime, count / emitTime, o.cone ?? Math.PI,
    o.tile, color, color2, end, end2,
    o.life ?? 0.5, o.size ?? 0.2, o.sizeEnd ?? 0, (o.speed ?? 6) / 60, o.spin ?? 0.1,
    o.damping ?? 0.92, 0.95, o.gravity ?? 0, Math.PI, o.fade ?? 0.2,
    o.randomness ?? 0.5, !!o.collide, o.additive ?? true, true, o.order,
  );
  if (o.trail) e.trailScale = o.trail;
  return e;
}

/** A continuous emitter, e.g. embers rising or a torch. Returns the emitter; destroy() it to stop. */
export function stream(pos, o = {}) {
  const color = o.color ?? LJS.WHITE;
  const color2 = o.color2 ?? color;
  return new LJS.ParticleEmitter(
    pos, o.angle ?? 0, o.area ?? 1, 0, n(o.rate ?? 10), o.cone ?? Math.PI,
    o.tile, color, color2, o.end ?? color.scale(1, 0), o.end2 ?? color2.scale(1, 0),
    o.life ?? 1, o.size ?? 0.15, o.sizeEnd ?? 0, (o.speed ?? 1) / 60, o.spin ?? 0.05,
    o.damping ?? 1, 1, o.gravity ?? 0, Math.PI, o.fade ?? 0.5,
    o.randomness ?? 0.5, false, o.additive ?? true, true, o.order,
  );
}

export function shake(amount) {
  LJS.cameraShake(amount * (fx.quality === 'low' ? 0.7 : 1));
}

export function hitStop(seconds) {
  fx.freeze = Math.max(fx.freeze, seconds);
}

export function flash(color, alpha = 0.35) {
  fx.flashColor = color;
  fx.flashAlpha = alpha;
}

/** Text that rises and fades at a world position. */
export function popText(text, pos, color = LJS.WHITE, size = 0.6) {
  fx.pops.push({ text, pos: pos.copy(), color, size, t: 0 });
}

/** Call from the game's render-post. */
export function drawFx(font) {
  for (const p of fx.pops) {
    const a = 1 - p.t / 0.9;
    const c = p.color.copy();
    c.a = Math.max(0, Math.min(1, a * 1.6));
    LJS.drawText(p.text, p.pos.add(vec2(0, p.t * 1.4)), p.size, c, p.size * 0.12, LJS.rgb(0, 0, 0, c.a * 0.7), 'center', font);
  }
  if (fx.flashAlpha > 0.01 && fx.flashColor) {
    const c = fx.flashColor.copy();
    c.a = fx.flashAlpha;
    LJS.drawRect(LJS.mainCanvasSize.scale(0.5), LJS.mainCanvasSize, c, 0, true, true);
  }
}

/** Call once per update. */
export function updateFx() {
  const dt = 1 / 60;
  for (const p of fx.pops) p.t += dt;
  fx.pops = fx.pops.filter((p) => p.t < 0.9);
  fx.flashAlpha *= 0.86;
}

export function clearFx() {
  fx.pops = [];
  fx.flashAlpha = 0;
}
