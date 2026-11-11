import { ad, biquad, gain, osc, series, sweep } from '../kit/audio/dsp.js';

/**
 * Extra voices for this game: name -> voice(actx, bank, rng, dest, t0, params).
 * The kit already has shot, impact, hit, kill, hurt, step, reload, wave, win, lose.
 */
function noise(a, b, r, d, t, { kind = 'pink', type = 'bandpass', f = 800, q = 0.8, level = 0.3, attack = 0.003, decay = 0.1, from = null, to = null }) {
  const src = b.source(kind, r, r.range(0.9, 1.1));
  const g = gain(a, 0);
  const flt = biquad(a, type, f, q);
  series(src, flt, g).connect(d);
  if (from && to) sweep(flt.frequency, t, from, to, attack + decay);
  ad(g.gain, t, level, attack, decay);
  src.start(t, src._offset, attack + decay + 0.1);
}

function tone(a, d, t, { type = 'sine', from = 200, to = 200, level = 0.2, attack = 0.005, decay = 0.2 }) {
  const o = osc(a, type, from);
  const g = gain(a, 0);
  o.connect(g);
  g.connect(d);
  sweep(o.frequency, t, from, to, attack + decay);
  ad(g.gain, t, level, attack, decay);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

export const voices = {
  // a wet, throaty rasp before a Hollow swings
  growl: (a, b, r, d, t, p = {}) => {
    const k = (p.pitch ?? 1) * r.range(0.85, 1.15);
    noise(a, b, r, d, t, { kind: 'brown', f: 420 * k, q: 3, level: 0.32, attack: 0.06, decay: 0.32, from: 300 * k, to: 620 * k });
    tone(a, d, t, { type: 'sawtooth', from: 92 * k, to: 70 * k, level: 0.05, attack: 0.05, decay: 0.3 });
  },
  dash: (a, b, r, d, t) => noise(a, b, r, d, t, { kind: 'white', type: 'bandpass', f: 1200, q: 0.9, level: 0.26, attack: 0.02, decay: 0.16, from: 600, to: 2600 }),
  swap: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'white', f: 3200, q: 4, level: 0.18, decay: 0.03 });
    noise(a, b, r, d, t + 0.07, { kind: 'white', f: 2100, q: 4, level: 0.2, decay: 0.04 });
  },
  reloaded: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'white', f: 2600, q: 5, level: 0.22, decay: 0.03 });
    tone(a, d, t, { type: 'square', from: 1900, to: 1700, level: 0.03, decay: 0.03 });
  },
  pickup: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'triangle', from: 660, to: 990, level: 0.18, decay: 0.14 });
    tone(a, d, t + 0.08, { type: 'triangle', from: 990, to: 1320, level: 0.15, decay: 0.2 });
  },
};

/** Rain on tin and tarmac, a low sodium hum, and far-off thunder now and then. */
export function ambient(actx, bank, rng, dest, t0) {
  const rainSrc = bank.source('pink', rng, 1, true);
  const rainG = gain(actx, 0);
  series(rainSrc, biquad(actx, 'highpass', 900, 0.5), biquad(actx, 'lowpass', 7000, 0.4), rainG).connect(dest);
  rainG.gain.setValueAtTime(0, t0);
  rainG.gain.linearRampToValueAtTime(0.16, t0 + 2);
  rainSrc.start(t0);

  const bed = bank.source('brown', rng, 0.7, true);
  const bedG = gain(actx, 0);
  series(bed, biquad(actx, 'lowpass', 320, 0.6), bedG).connect(dest);
  bedG.gain.setValueAtTime(0, t0);
  bedG.gain.linearRampToValueAtTime(0.22, t0 + 2.5);
  bed.start(t0);

  const hum = osc(actx, 'sine', 100);
  const humG = gain(actx, 0);
  hum.connect(humG);
  humG.connect(dest);
  humG.gain.setValueAtTime(0, t0);
  humG.gain.linearRampToValueAtTime(0.012, t0 + 3);
  hum.start(t0);

  // thunder: a long brown-noise roll every 20 to 40 seconds of the first ten minutes
  let t = t0 + rng.range(6, 14);
  for (let i = 0; i < 24; i++) {
    const src = bank.source('brown', rng, rng.range(0.5, 0.8));
    const g = gain(actx, 0);
    series(src, biquad(actx, 'lowpass', rng.range(160, 260), 0.7), g).connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rng.range(0.25, 0.45), t + rng.range(0.3, 0.9));
    g.gain.exponentialRampToValueAtTime(0.0005, t + rng.range(3.5, 6));
    src.loop = true;
    src.start(t);
    src.stop(t + 6.5);
    t += rng.range(20, 40);
  }
}
