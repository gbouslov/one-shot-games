import { ad, biquad, gain, osc, series, sweep } from '../kit/audio/dsp.js';

/**
 * Extra voices for this game: name -> voice(actx, bank, rng, dest, t0, params).
 * The kit already has shot, impact, hit, kill, hurt, step, wave, win, lose.
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
  // a coal leaving the lantern: a soft breathy whump and a spark on top
  bolt: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'pink', f: 900, q: 1.2, level: 0.22, attack: 0.004, decay: 0.09, from: 1400, to: 500 });
    tone(a, d, t, { type: 'triangle', from: 1500 * r.range(0.95, 1.05), to: 900, level: 0.05, decay: 0.06 });
  },
  // a hand-bell: struck partials that ring out
  toll: (a, b, r, d, t) => {
    for (const [f, l, dec] of [[392, 0.2, 1.6], [784 * 1.01, 0.1, 1.1], [1176, 0.06, 0.7], [1960, 0.04, 0.4]]) tone(a, d, t, { from: f, to: f * 0.998, level: l, attack: 0.002, decay: dec });
    noise(a, b, r, d, t, { kind: 'white', f: 3000, q: 2, level: 0.12, decay: 0.03 });
  },
  // lightning: a white crack and a low tail
  crack: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'white', type: 'highpass', f: 1800, q: 0.5, level: 0.36, attack: 0.001, decay: 0.12 });
    noise(a, b, r, d, t + 0.02, { kind: 'brown', type: 'lowpass', f: 240, q: 0.7, level: 0.5, attack: 0.01, decay: 0.7 });
  },
  thunder: (a, b, r, d, t) => noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', f: 200, q: 0.6, level: 0.5, attack: 0.25, decay: 3.2 }),
  // a shard taken: a glassy tick that climbs with value
  gem: (a, b, r, d, t, p = {}) => {
    const f = 1700 + Math.min(6, p.value ?? 1) * 140 + r.range(-60, 60);
    tone(a, d, t, { type: 'sine', from: f, to: f * 1.04, level: 0.07, decay: 0.08 });
  },
  levelup: (a, b, r, d, t) => [523, 659, 784, 1047].forEach((f, i) => tone(a, d, t + i * 0.07, { type: 'triangle', from: f, to: f, level: 0.16, decay: 0.45 })),
  pick: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'triangle', from: 880, to: 1320, level: 0.16, decay: 0.16 });
    noise(a, b, r, d, t, { kind: 'white', f: 2600, q: 1.5, level: 0.1, decay: 0.08 });
  },
  pickup: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'triangle', from: 660, to: 990, level: 0.18, decay: 0.14 });
    tone(a, d, t + 0.08, { type: 'triangle', from: 990, to: 1320, level: 0.15, decay: 0.2 });
  },
  // the hart lowering its head: a long rasping bellow
  bellow: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'sawtooth', from: 70, to: 52, level: 0.22, attack: 0.15, decay: 0.9 });
    noise(a, b, r, d, t, { kind: 'brown', f: 300, q: 2, level: 0.35, attack: 0.2, decay: 0.8, from: 200, to: 420 });
  },
  bossrise: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'sawtooth', from: 45, to: 38, level: 0.3, attack: 0.6, decay: 2.2 });
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', f: 160, level: 0.6, attack: 0.4, decay: 2.4 });
  },
  bosskill: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', f: 220, level: 0.8, attack: 0.01, decay: 1.6 });
    [196, 247, 294].forEach((f, i) => tone(a, d, t + 0.2 + i * 0.12, { type: 'triangle', from: f, to: f, level: 0.14, decay: 1 }));
  },
  surge: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'pink', f: 500, q: 1, level: 0.3, attack: 0.3, decay: 0.6, from: 200, to: 900 });
    tone(a, d, t, { type: 'sawtooth', from: 110, to: 82, level: 0.08, attack: 0.2, decay: 0.7 });
  },
};

/** Rain in the leaves, wind over the fen, and the low drone of the marsh. */
export function ambient(actx, bank, rng, dest, t0) {
  const rainSrc = bank.source('pink', rng, 1, true);
  const rainG = gain(actx, 0);
  series(rainSrc, biquad(actx, 'highpass', 1100, 0.5), biquad(actx, 'lowpass', 6500, 0.4), rainG).connect(dest);
  rainG.gain.setValueAtTime(0, t0);
  rainG.gain.linearRampToValueAtTime(0.15, t0 + 2);
  rainSrc.start(t0);

  const wind = bank.source('brown', rng, 0.6, true);
  const windF = biquad(actx, 'bandpass', 380, 0.7);
  const windG = gain(actx, 0);
  series(wind, windF, windG).connect(dest);
  windG.gain.setValueAtTime(0, t0);
  windG.gain.linearRampToValueAtTime(0.2, t0 + 3);
  // the wind rises and falls
  const lfo = osc(actx, 'sine', 0.07);
  const depth = gain(actx, 160);
  lfo.connect(depth);
  depth.connect(windF.frequency);
  lfo.start(t0);
  wind.start(t0);

  const drone = osc(actx, 'sine', 55);
  const droneG = gain(actx, 0);
  drone.connect(droneG);
  droneG.connect(dest);
  droneG.gain.setValueAtTime(0, t0);
  droneG.gain.linearRampToValueAtTime(0.02, t0 + 4);
  drone.start(t0);
}
