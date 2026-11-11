import { ad, biquad, gain, osc, series, struckResonator, sweep } from '../kit/audio/dsp.js';

/**
 * Every sound in the game, made in code. voice(actx, bank, rng, dest, t0, params).
 * Names the kit plays: twang thump boom bell hit kill leak build upgrade sell click deny wave win lose.
 */

function noise(actx, bank, rng, dest, t0, { kind = 'white', type = 'bandpass', freq = 1200, q = 0.8, level = 0.4, attack = 0.002, decay = 0.1, to = null }) {
  const src = bank.source(kind, rng, rng.range(0.9, 1.1));
  const f = biquad(actx, type, freq * rng.range(0.92, 1.08), q);
  const g = gain(actx, 0);
  series(src, f, g).connect(dest);
  if (to) sweep(f.frequency, t0, freq, to, attack + decay);
  ad(g.gain, t0, level, attack, decay);
  src.start(t0, src._offset, attack + decay + 0.05);
}

function tone(actx, dest, t0, { type = 'sine', from = 440, to = from, level = 0.2, attack = 0.004, decay = 0.2 }) {
  const o = osc(actx, type, from);
  const g = gain(actx, 0);
  o.connect(g);
  g.connect(dest);
  if (to !== from) sweep(o.frequency, t0, from, to, attack + decay);
  ad(g.gain, t0, level, attack, decay);
  o.start(t0);
  o.stop(t0 + attack + decay + 0.05);
}

export const voices = {
  /** Bolt Spire: a taut string and a wooden knock. */
  twang: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'triangle', from: r.range(190, 220), to: 120, level: 0.16, decay: 0.12 });
    noise(a, b, r, d, t, { freq: 2600, q: 2, level: 0.18, decay: 0.05 });
    noise(a, b, r, d, t + 0.01, { kind: 'pink', freq: 600, q: 1.2, level: 0.16, decay: 0.04 });
  },
  /** Ember Kiln launch: a deep cough. */
  thump: (a, b, r, d, t) => {
    tone(a, d, t, { from: 110, to: 45, level: 0.5, decay: 0.22 });
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', freq: 500, level: 0.6, decay: 0.25 });
  },
  /** Ember shell landing. */
  boom: (a, b, r, d, t) => {
    tone(a, d, t, { from: 80, to: 32, level: 0.55, decay: 0.4 });
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', freq: 900, to: 200, level: 0.7, attack: 0.004, decay: 0.55 });
    noise(a, b, r, d, t + 0.02, { kind: 'crackle', freq: 3000, q: 0.7, level: 0.22, decay: 0.3 });
  },
  /** Frost Bell: a struck bronze bell, slightly detuned partials. */
  bell: (a, b, r, d, t) => {
    const f = r.range(520, 540);
    const out = struckResonator(a, b, r, t, [
      { f, q: 90, g: 0.35, decay: 1.6 },
      { f: f * 2.01, q: 90, g: 0.22, decay: 1.1 },
      { f: f * 2.76, q: 80, g: 0.14, decay: 0.8 },
      { f: f * 5.4, q: 70, g: 0.08, decay: 0.4 },
    ], 0.006);
    const g = gain(a, 0.5);
    out.connect(g);
    g.connect(d);
    tone(a, d, t, { from: f * 0.5, level: 0.06, attack: 0.01, decay: 1.2 });
  },
  hit: (a, b, r, d, t) => noise(a, b, r, d, t, { freq: 1700, q: 1.4, level: 0.14, decay: 0.04 }),
  kill: (a, b, r, d, t, p = {}) => {
    noise(a, b, r, d, t, { kind: 'pink', freq: p.big ? 380 : 900, q: 0.8, level: p.big ? 0.5 : 0.32, decay: p.big ? 0.3 : 0.12 });
    noise(a, b, r, d, t + 0.015, { kind: 'crackle', freq: 2400, q: 1, level: 0.2, decay: 0.08 });
    tone(a, d, t, { type: 'sine', from: p.big ? 300 : 700, to: p.big ? 120 : 260, level: 0.08, decay: 0.12 });
  },
  leak: (a, b, r, d, t) => {
    tone(a, d, t, { type: 'sawtooth', from: 160, to: 70, level: 0.18, attack: 0.01, decay: 0.6 });
    tone(a, d, t, { from: 82, to: 41, level: 0.4, decay: 0.7 });
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', freq: 400, level: 0.4, decay: 0.6 });
  },
  build: (a, b, r, d, t) => {
    noise(a, b, r, d, t, { kind: 'brown', type: 'lowpass', freq: 700, level: 0.55, decay: 0.18 });
    tone(a, d, t, { from: 140, to: 70, level: 0.3, decay: 0.14 });
    noise(a, b, r, d, t + 0.08, { kind: 'pink', freq: 1800, q: 2, level: 0.12, decay: 0.05 });
  },
  upgrade: (a, b, r, d, t) => [523, 659, 784].forEach((f, i) => tone(a, d, t + i * 0.07, { type: 'triangle', from: f, level: 0.14, decay: 0.25 })),
  sell: (a, b, r, d, t) => [784, 587].forEach((f, i) => tone(a, d, t + i * 0.08, { type: 'triangle', from: f, level: 0.12, decay: 0.2 })),
  click: (a, b, r, d, t) => tone(a, d, t, { type: 'triangle', from: 880, to: 660, level: 0.07, decay: 0.05 }),
  deny: (a, b, r, d, t) => tone(a, d, t, { type: 'square', from: 140, to: 110, level: 0.06, decay: 0.12 }),
  /** A low horn for each night. */
  wave: (a, b, r, d, t) => {
    for (const [f, k] of [[110, 0.22], [165, 0.12], [220, 0.06]]) {
      const o = osc(a, 'sawtooth', f);
      const lp = biquad(a, 'lowpass', 500, 0.8);
      const g = gain(a, 0);
      series(o, lp, g).connect(d);
      sweep(lp.frequency, t, 300, 1100, 0.6);
      ad(g.gain, t, k, 0.25, 1.1);
      o.start(t);
      o.stop(t + 1.5);
    }
  },
  win: (a, b, r, d, t) => [392, 494, 587, 784].forEach((f, i) => tone(a, d, t + i * 0.16, { type: 'triangle', from: f, level: 0.18, decay: 0.8 })),
  lose: (a, b, r, d, t) => [392, 311, 262, 196].forEach((f, i) => tone(a, d, t + i * 0.22, { type: 'sawtooth', from: f, to: f * 0.97, level: 0.1, decay: 0.6 })),
};

/** Dusk: a soft wind bed and crickets. */
export function ambient(actx, bank, rng, dest, t0) {
  const src = bank.source('brown', rng, 0.7, true);
  const g = gain(actx, 0);
  series(src, biquad(actx, 'lowpass', 420, 0.6), g).connect(dest);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.2, t0 + 2);
  src.start(t0);

  // crickets: a high tone gated by a fast pulse, swelling slowly
  const c = osc(actx, 'sine', 4300);
  const gate = gain(actx, 0.5); // 0.5 +- 0.5: on, off, on...
  const pulse = osc(actx, 'square', 19);
  const depth = gain(actx, 0.5);
  pulse.connect(depth);
  depth.connect(gate.gain);
  const swell = osc(actx, 'sine', 0.23);
  const sd = gain(actx, 0.012);
  const level = gain(actx, 0.012);
  swell.connect(sd);
  sd.connect(level.gain);
  c.connect(gate);
  gate.connect(level);
  level.connect(dest);
  c.start(t0);
  pulse.start(t0);
  swell.start(t0);
}
