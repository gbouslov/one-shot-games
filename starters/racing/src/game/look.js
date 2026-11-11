/**
 * The look of the default game: a low, warm sun behind the far hills, cool
 * shadows, a gentle bloom and a filmic grade, with autumn tree belts, flag
 * strings over the main straight and dust hanging in the light. The light
 * itself (sun colour, direction, fog, sky) lives in track.js `environment`;
 * this file is the camera grade and the dressing. See skills/make-it-look-great.
 */
import { bunting, scatterTrees, skidMarks, sunDust } from '../kit/track/dressing.js';

export default {
  exposure: 1.0,
  bloom: { strength: 0.2, radius: 0.45, threshold: 0.92 },
  ao: { radius: 1.1, intensity: 0.9 },
  shafts: { strength: 0.5, color: 0xffc58a, density: 0.9, decay: 0.955, threshold: 1.0 },
  // display grade: cool shadows, warm highlights
  vignette: 0.3,
  saturation: 1.06,
  contrast: 1.06,
  shadows: 0xd8e2ff,
  highlights: 0xfff0dc,
  tint: 0xffffff,
  /** Half size (m) of the sun's shadow box around the player. */
  shadowExtent: 34,

  /** Runs once after the track is built. Return { update(dt, camera) } for anything that moves. */
  dress(ctx) {
    const low = ctx.quality === 'low';
    scatterTrees(ctx, {
      count: low ? 90 : 300,
      near: 10,
      far: 150,
      palette: [0x5b6b2a, 0x7d7a2e, 0x9c6a26, 0x4f5e2a, 0xb0582c, 0x6f8a34],
    });
    bunting(ctx, { at: [0.015, 0.045, 0.075], colors: [0xf4efe0, 0xd2452a, 0xffb25e, 0x2f4858] });
    skidMarks(ctx, { darkness: 0.9 });
    return low ? null : sunDust(ctx, { count: 360, color: 0xffd6a0, size: 0.05, opacity: 0.55 });
  },
};
