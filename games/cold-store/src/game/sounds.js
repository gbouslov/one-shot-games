import { biquad, gain, osc, series } from '../kit/audio/dsp.js';
import { assets } from '../assets/index.js';

export const voices = {
  /** Radio: a squelch click, then a short band-passed static burst. */
  radio(actx, bank, rng, dest, t0) {
    const n = bank.source('white', rng, 0.4, false);
    const g = gain(actx, 0);
    series(n, biquad(actx, 'bandpass', 2200, 1.4), g).connect(dest);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.01);
    g.gain.setValueAtTime(0.16, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    n.start(t0);
    n.stop(t0 + 0.4);
    const o = osc(actx, 'square', 1250);
    const og = gain(actx, 0);
    series(o, biquad(actx, 'lowpass', 3000, 0.7), og).connect(dest);
    og.gain.setValueAtTime(0.05, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
    o.start(t0);
    o.stop(t0 + 0.06);
  },
  /** Breaker: a heavy mechanical clunk and a relay buzz. */
  breaker(actx, bank, rng, dest, t0) {
    const n = bank.source('brown', rng, 0.3, false);
    const g = gain(actx, 0);
    series(n, biquad(actx, 'lowpass', 900, 1.2), g).connect(dest);
    g.gain.setValueAtTime(0.9, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    n.start(t0);
    n.stop(t0 + 0.3);
    const o = osc(actx, 'sawtooth', 100);
    const og = gain(actx, 0);
    series(o, biquad(actx, 'lowpass', 1400, 0.7), og).connect(dest);
    og.gain.setValueAtTime(0, t0 + 0.05);
    og.gain.linearRampToValueAtTime(0.05, t0 + 0.08);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    o.start(t0);
    o.stop(t0 + 0.7);
  },
  /** Generator: a diesel turning over and catching, about 3 s. */
  generator(actx, bank, rng, dest, t0) {
    const o = osc(actx, 'sawtooth', 18);
    o.frequency.setValueAtTime(14, t0);
    o.frequency.linearRampToValueAtTime(31, t0 + 2.2);
    const og = gain(actx, 0);
    series(o, biquad(actx, 'lowpass', 260, 1.1), og).connect(dest);
    og.gain.setValueAtTime(0, t0);
    og.gain.linearRampToValueAtTime(0.5, t0 + 0.6);
    og.gain.setValueAtTime(0.5, t0 + 2.2);
    og.gain.linearRampToValueAtTime(0.18, t0 + 3.2);
    o.start(t0);
    o.stop(t0 + 3.4);
  },
};

/** A dead hall: low room tone, the hiss of thawing coils, a faint failing-ballast hum. */
export function ambient(actx, bank, rng, dest, t0) {
  // the score: "Spacial Winds" by Kevin MacLeod (incompetech.com, CC BY 4.0), low under the room tone
  const music = actx.createBufferSource();
  music.buffer = assets.sound('music-spacial-winds');
  music.loop = true;
  const mg = gain(actx, 0);
  series(music, biquad(actx, 'lowpass', 5200, 0.7), mg).connect(dest);
  mg.gain.setValueAtTime(0, t0);
  mg.gain.linearRampToValueAtTime(0.32, t0 + 6);
  music.start(t0);
  const room = bank.source('brown', rng, 0.6, true);
  const rg = gain(actx, 0);
  series(room, biquad(actx, 'lowpass', 220, 0.7), rg).connect(dest);
  rg.gain.setValueAtTime(0, t0);
  rg.gain.linearRampToValueAtTime(0.3, t0 + 3);
  room.start(t0);
  const hiss = bank.source('pink', rng, 1, true);
  const hg = gain(actx, 0);
  series(hiss, biquad(actx, 'highpass', 4200, 0.7), hg).connect(dest);
  hg.gain.setValueAtTime(0, t0);
  hg.gain.linearRampToValueAtTime(0.012, t0 + 4);
  hiss.start(t0);
  const hum = gain(actx, 0);
  hum.connect(dest);
  for (const f of [120, 240.6]) {
    const o = osc(actx, 'sawtooth', f);
    series(o, biquad(actx, 'lowpass', 600, 0.7)).connect(hum);
    o.start(t0);
  }
  hum.gain.setValueAtTime(0, t0);
  hum.gain.linearRampToValueAtTime(0.008, t0 + 5);
}
