/**
 * Quality tiers and fixed timing. Games override any of this from
 * src/game/config.js; the URL can force a tier with ?q=low|medium|high.
 */

export const PHYSICS_HZ = 120;
export const FIXED_DT = 1 / PHYSICS_HZ;
/** Never simulate more than this many physics steps in one frame. */
export const MAX_SUBSTEPS = 12;

export const QUALITY = {
  // flashLights: pooled point lights for muzzle flashes; every live light is a
  // per-pixel cost on every lit surface. lamps: whether pole lamps cast real light.
  low: { pixelRatio: 1, shadowSize: 0, bloom: false, particles: 400, minScale: 0.5, flashLights: 1, lamps: false },
  medium: { pixelRatio: 1.25, shadowSize: 1024, bloom: true, ao: false, shaftTaps: 16, particles: 900, minScale: 0.65, flashLights: 2, lamps: true },
  high: { pixelRatio: 2, shadowSize: 2048, bloom: true, ao: true, aoSamples: 12, shaftTaps: 24, particles: 1800, minScale: 0.7, flashLights: 3, lamps: true },
};

export function createConfig(gameConfig, params) {
  const quality = QUALITY[params.get('q')] ? params.get('q') : gameConfig.quality ?? 'high';
  return {
    sensitivity: 0.0022,
    dragSensitivity: 0.0048,
    invertY: false,
    fov: 78,
    ...gameConfig,
    quality,
    q: QUALITY[quality],
    deterministic: params.get('capture') === '1',
    forceDrag: params.get('look') === 'drag',
    seed: params.has('seed') ? Number(params.get('seed')) : undefined,
  };
}
