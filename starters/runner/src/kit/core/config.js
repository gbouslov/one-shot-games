/**
 * Quality tiers and fixed timing (after starters/space-shooter/src/kit/core/config.js).
 * Games override any of this from src/game/config.js; the URL can force a
 * tier with ?q=low|medium|high.
 */

export const PHYSICS_HZ = 120;
export const FIXED_DT = 1 / PHYSICS_HZ;
/** 0.1 s of clamped frame time is exactly 12 steps; never more. */
export const MAX_SUBSTEPS = 12;

export const QUALITY = {
  low: { pixelRatio: 1, shadowSize: 0, bloom: false, blur: false, view: 170, scatter: 0.5, lights: 1, particles: 500, minScale: 0.6 },
  medium: { pixelRatio: 1.25, shadowSize: 1024, bloom: true, ao: false, blur: true, shaftTaps: 16, view: 230, scatter: 0.8, lights: 2, particles: 1000, minScale: 0.65 },
  high: { pixelRatio: 2, shadowSize: 2048, bloom: true, ao: true, aoSamples: 12, blur: true, shaftTaps: 24, view: 280, scatter: 1, lights: 3, particles: 1600, minScale: 0.7 },
};

export function createConfig(gameConfig, params) {
  const fallback = matchMedia('(pointer: coarse)').matches ? 'low' : gameConfig.quality ?? 'medium';
  const quality = QUALITY[params.get('q')] ? params.get('q') : fallback;
  return {
    fov: 64,
    near: 0.2,
    far: 2400,
    ...gameConfig,
    quality,
    q: QUALITY[quality],
    deterministic: params.get('capture') === '1',
    seed: params.has('seed') ? Number(params.get('seed')) : undefined,
  };
}
