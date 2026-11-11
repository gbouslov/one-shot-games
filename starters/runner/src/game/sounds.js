import { biquad, gain, osc } from '../kit/audio/dsp.js';
import { noiseHit, thud, tone } from '../kit/audio/audio.js';

/**
 * Every sound is made in code. One-shot voices, then the bed: the low roar
 * of the burning sea, wind that rises with speed, and a slow two-note drone.
 */
const note = (n, base = 440) => base * 2 ** (n / 12);
// A minor pentatonic, climbing with the cinder chain.
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

export const voices = {
  step: (a, b, r, d, t, { side = 0, speed = 15 } = {}) => {
    noiseHit(a, b, r, d, t, { freq: 1500 + side * 300, q: 1.1, level: 0.07 + Math.min(0.05, speed * 0.002), decay: 0.035, kind: 'crackle' });
    thud(a, b, r, d, t, { freq: 70 + side * 8, level: 0.16, decay: 0.06 });
  },
  jump: (a, b, r, d, t) => {
    noiseHit(a, b, r, d, t, { freq: 900, q: 0.7, level: 0.16, decay: 0.16, kind: 'pink', type: 'bandpass', attack: 0.02 });
    tone(a, b, r, d, t, { from: 220, to: 440, level: 0.05, dur: 0.14, type: 'triangle' });
  },
  land: (a, b, r, d, t, { hard = 0.5 } = {}) => {
    thud(a, b, r, d, t, { freq: 60, level: 0.3 + hard * 0.3, decay: 0.12 });
    noiseHit(a, b, r, d, t, { freq: 1100, q: 0.8, level: 0.12 + hard * 0.1, decay: 0.09, kind: 'crackle' });
  },
  slide: (a, b, r, d, t) => {
    noiseHit(a, b, r, d, t, { freq: 2400, q: 0.9, level: 0.14, decay: 0.45, kind: 'white', attack: 0.02 });
    noiseHit(a, b, r, d, t, { freq: 500, q: 0.7, level: 0.16, decay: 0.4, kind: 'brown', type: 'lowpass' });
  },
  drop: (a, b, r, d, t) => tone(a, b, r, d, t, { from: 520, to: 160, level: 0.05, dur: 0.14, type: 'sine' }),
  lane: (a, b, r, d, t, { dir = 1 } = {}) => {
    noiseHit(a, b, r, d, t, { freq: 1700 + dir * 250, q: 1.4, level: 0.08, decay: 0.12, kind: 'pink', attack: 0.015 });
  },
  pickup: (a, b, r, d, t, { combo = 1 } = {}) => {
    const n = PENTA[Math.min(PENTA.length - 1, combo - 1)];
    tone(a, b, r, d, t, { from: note(n, 660), to: note(n, 660), level: 0.08, dur: 0.18, type: 'sine', attack: 0.002 });
    tone(a, b, r, d, t + 0.03, { from: note(n + 12, 660), to: note(n + 12, 660), level: 0.03, dur: 0.12, type: 'triangle' });
  },
  hit: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 55, level: 0.9, decay: 0.3 });
    noiseHit(a, b, r, d, t, { freq: 800, q: 0.6, level: 0.6, decay: 0.35, kind: 'brown', type: 'lowpass' });
    noiseHit(a, b, r, d, t + 0.01, { freq: 2600, q: 0.8, level: 0.25, decay: 0.2, kind: 'crackle' });
    tone(a, b, r, d, t + 0.05, { from: 300, to: 110, level: 0.08, dur: 0.3, type: 'sawtooth' });
  },
  crash: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 42, level: 1, decay: 0.8 });
    noiseHit(a, b, r, d, t, { freq: 500, q: 0.5, level: 0.8, decay: 0.9, kind: 'brown', type: 'lowpass' });
    noiseHit(a, b, r, d, t + 0.02, { freq: 2200, q: 0.7, level: 0.3, decay: 0.5, kind: 'crackle' });
  },
  graze: (a, b, r, d, t) => noiseHit(a, b, r, d, t, { freq: 3000, q: 2, level: 0.08, decay: 0.08, kind: 'white' }),
  milestone: (a, b, r, d, t) => {
    [0, 7, 12].forEach((n, i) => tone(a, b, r, d, t + i * 0.09, { from: note(n, 330), to: note(n, 330), level: 0.08, dur: 0.5, type: 'triangle' }));
  },
  start: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: note(-12, 330), to: note(-12, 330), level: 0.14, dur: 0.3, type: 'triangle' });
    tone(a, b, r, d, t + 0.14, { from: note(-5, 330), to: note(-5, 330), level: 0.14, dur: 0.5, type: 'triangle' });
    noiseHit(a, b, r, d, t, { freq: 500, q: 0.6, level: 0.25, decay: 0.9, kind: 'pink', attack: 0.3 });
  },
  win: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 40, level: 0.8, decay: 1.2 });
    noiseHit(a, b, r, d, t, { freq: 700, q: 0.5, level: 0.5, decay: 1.6, kind: 'pink', attack: 0.4 });
    [0, 3, 7, 10, 15].forEach((n, i) => tone(a, b, r, d, t + 0.5 + i * 0.14, { from: note(n, 220), to: note(n, 220), level: 0.14, dur: 1.2, type: 'triangle' }));
  },
  lose: (a, b, r, d, t) => [7, 3, 0, -5].forEach((n, i) => tone(a, b, r, d, t + 0.5 + i * 0.22, { from: note(n, 220), to: note(n, 220) * 0.98, level: 0.13, dur: 0.8, type: 'triangle' })),
};

/** The bed: lava roar, wind with speed, a low drone. Returns a handle the director drives. */
export function bed(actx, bank, rng, dest, t0) {
  const out = gain(actx, 0);
  out.connect(dest);
  // Roar of the sea: brown noise, low-passed, slowly breathing.
  const rsrc = bank.source('brown', rng, 1, true);
  const rlp = biquad(actx, 'lowpass', 180, 0.8);
  const roar = gain(actx, 0.5);
  rsrc.connect(rlp);
  rlp.connect(roar);
  roar.connect(out);
  const lfo = osc(actx, 'sine', 0.13);
  const lfoG = gain(actx, 0.18);
  lfo.connect(lfoG);
  lfoG.connect(roar.gain);
  // Wind: pink noise, band-passed higher as you go faster.
  const wsrc = bank.source('pink', rng, 1, true);
  const wbp = biquad(actx, 'bandpass', 700, 0.6);
  const wind = gain(actx, 0);
  wsrc.connect(wbp);
  wbp.connect(wind);
  wind.connect(out);
  // Drone: a fifth, very low, very quiet.
  const dg = gain(actx, 0.05);
  const dlp = biquad(actx, 'lowpass', 400, 0.7);
  const o1 = osc(actx, 'sawtooth', note(-24, 220));
  const o2 = osc(actx, 'sawtooth', note(-17, 220), 6);
  o1.connect(dlp);
  o2.connect(dlp);
  dlp.connect(dg);
  dg.connect(out);
  for (const o of [o1, o2, lfo]) o.start(t0);
  rsrc.start(t0, rsrc._offset);
  wsrc.start(t0, wsrc._offset);
  out.gain.setTargetAtTime(0.85, t0, 0.6);
  return {
    set({ speed = 10, on = true, fast = 0 } = {}, now = actx.currentTime) {
      wind.gain.setTargetAtTime(on ? 0.05 + fast * 0.3 : 0.02, now, 0.3);
      wbp.frequency.setTargetAtTime(500 + speed * 45, now, 0.3);
      roar.gain.setTargetAtTime(on ? 0.5 : 0.3, now, 0.5);
      dlp.frequency.setTargetAtTime(300 + fast * 500, now, 0.5);
    },
  };
}
