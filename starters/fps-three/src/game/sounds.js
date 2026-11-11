import { biquad, gain, series } from '../kit/audio/dsp.js';

/** Extra voices for this game: name -> voice(actx, bank, rng, dest, t0, params). */
export const voices = {};

/** A low wind bed that starts with the audio. Replace it with your world's air. */
export function ambient(actx, bank, rng, dest, t0) {
  const src = bank.source('brown', rng, 0.8, true);
  const g = gain(actx, 0);
  series(src, biquad(actx, 'lowpass', 520, 0.6), g).connect(dest);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.28, t0 + 1.5);
  src.start(t0);
}
