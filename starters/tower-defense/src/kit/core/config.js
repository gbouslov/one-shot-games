/**
 * Quality tiers. Games override any of this from src/game/config.js; the URL
 * can force a tier with ?q=low|medium|high, and seed the RNG with ?seed=.
 * ?capture=1 makes every frame deterministic (fixed RNG seed, no adaptive scale).
 */

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
/** Never simulate more than this many steps in one frame (4x speed at 7 fps). */
export const MAX_SIM_STEPS = 40;

export const QUALITY = {
  low: { pixelRatio: 1, shadowSize: 0, bloom: false, particles: 500, grass: 1400, minScale: 0.6 },
  medium: { pixelRatio: 1.25, shadowSize: 1024, bloom: true, ao: false, shaftTaps: 16, particles: 1200, grass: 4200, minScale: 0.65 },
  high: { pixelRatio: 2, shadowSize: 2048, bloom: true, ao: true, aoSamples: 12, shaftTaps: 24, particles: 2400, grass: 6000, minScale: 0.7 },
};

export function createConfig(gameConfig, params) {
  const quality = QUALITY[params.get('q')] ? params.get('q') : gameConfig.quality ?? 'high';
  return {
    fov: 38,
    ...gameConfig,
    quality,
    q: QUALITY[quality],
    deterministic: params.get('capture') === '1',
    seed: params.has('seed') ? Number(params.get('seed')) : undefined,
  };
}
