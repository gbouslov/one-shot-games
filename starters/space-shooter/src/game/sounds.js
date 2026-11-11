import { biquad, gain, osc } from '../kit/audio/dsp.js';
import { noiseHit, thud, tone } from '../kit/audio/audio.js';

/**
 * Every sound is made in code. One-shot voices, then the bed: a low engine
 * drone and rushing air that follow the rail speed and open up on boost.
 */
const note = (n, base = 440) => base * 2 ** (n / 12);

export const voices = {
  laser: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: 1900, to: 520, level: 0.055, dur: 0.07, type: 'square', attack: 0.001 });
    noiseHit(a, b, r, d, t, { freq: 5200, q: 1.2, level: 0.05, decay: 0.03 });
  },
  enemyShot: (a, b, r, d, t) => tone(a, b, r, d, t, { from: 420, to: 180, level: 0.07, dur: 0.16, type: 'sawtooth' }),
  bossShot: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: 260, to: 90, level: 0.12, dur: 0.28, type: 'sawtooth' });
    thud(a, b, r, d, t, { freq: 70, level: 0.3, decay: 0.2 });
  },
  hit: (a, b, r, d, t) => noiseHit(a, b, r, d, t, { freq: 3000, q: 2, level: 0.16, decay: 0.05, kind: 'white' }),
  ping: (a, b, r, d, t) => tone(a, b, r, d, t, { from: 2600, to: 2400, level: 0.06, dur: 0.08, type: 'sine' }),
  pop: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 80, level: 0.6, decay: 0.25 });
    noiseHit(a, b, r, d, t, { freq: 900, q: 0.6, level: 0.5, decay: 0.35, kind: 'brown', type: 'lowpass' });
    noiseHit(a, b, r, d, t + 0.01, { freq: 3200, q: 0.8, level: 0.15, decay: 0.12, kind: 'crackle' });
  },
  boom: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 48, level: 1, decay: 0.7 });
    noiseHit(a, b, r, d, t, { freq: 500, q: 0.5, level: 0.8, decay: 0.9, kind: 'brown', type: 'lowpass' });
    noiseHit(a, b, r, d, t + 0.02, { freq: 2400, q: 0.7, level: 0.25, decay: 0.3, kind: 'crackle' });
  },
  bigBoom: (a, b, r, d, t) => {
    for (let i = 0; i < 4; i++) {
      thud(a, b, r, d, t + i * 0.22, { freq: 40 + i * 6, level: 1, decay: 0.9 });
      noiseHit(a, b, r, d, t + i * 0.22, { freq: 400, q: 0.5, level: 0.8, decay: 1.2, kind: 'brown', type: 'lowpass' });
    }
    noiseHit(a, b, r, d, t, { freq: 1800, q: 0.4, level: 0.35, decay: 1.6, kind: 'pink', attack: 0.05 });
  },
  damage: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 110, level: 0.6, decay: 0.18 });
    noiseHit(a, b, r, d, t, { freq: 1400, q: 1.5, level: 0.4, decay: 0.15, kind: 'crackle' });
    tone(a, b, r, d, t, { from: 300, to: 120, level: 0.1, dur: 0.2, type: 'square' });
  },
  scrape: (a, b, r, d, t) => {
    noiseHit(a, b, r, d, t, { freq: 2600, q: 3, level: 0.35, decay: 0.4, kind: 'white', attack: 0.01 });
    thud(a, b, r, d, t, { freq: 70, level: 0.5, decay: 0.25 });
  },
  alarm: (a, b, r, d, t) => {
    for (let i = 0; i < 3; i++) tone(a, b, r, d, t + i * 0.36, { from: 620, to: 470, level: 0.11, dur: 0.24, type: 'triangle' });
  },
  open: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: 90, to: 260, level: 0.25, dur: 0.9, type: 'sawtooth', attack: 0.05 });
    noiseHit(a, b, r, d, t, { freq: 700, q: 0.8, level: 0.3, decay: 0.9, kind: 'pink', attack: 0.2 });
  },
  start: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: note(-12), to: note(-12), level: 0.16, dur: 0.25, type: 'triangle' });
    tone(a, b, r, d, t + 0.12, { from: note(-5), to: note(-5), level: 0.16, dur: 0.4, type: 'triangle' });
    noiseHit(a, b, r, d, t, { freq: 600, q: 0.6, level: 0.25, decay: 0.8, kind: 'pink', attack: 0.3 });
  },
  win: (a, b, r, d, t) => [0, 4, 7, 11, 14].forEach((n, i) => tone(a, b, r, d, t + 0.6 + i * 0.13, { from: note(n, 330), to: note(n, 330), level: 0.16, dur: 0.9, type: 'triangle' })),
  lose: (a, b, r, d, t) => [7, 3, 0, -5].forEach((n, i) => tone(a, b, r, d, t + 0.4 + i * 0.2, { from: note(n, 262), to: note(n, 262) * 0.98, level: 0.15, dur: 0.7, type: 'triangle' })),
};

/** The running bed: engine drone and air rush. Returns a handle the director drives. */
export function bed(actx, bank, rng, dest, t0) {
  const out = gain(actx, 0);
  out.connect(dest);
  const lp = biquad(actx, 'lowpass', 300, 3);
  const eng = gain(actx, 0.16);
  const o1 = osc(actx, 'sawtooth', 55);
  const o2 = osc(actx, 'sawtooth', 55, 12);
  const sub = osc(actx, 'sine', 27.5);
  const subG = gain(actx, 0.5);
  o1.connect(lp);
  o2.connect(lp);
  sub.connect(subG);
  subG.connect(eng);
  lp.connect(eng);
  eng.connect(out);
  const wsrc = bank.source('pink', rng, 1, true);
  const wbp = biquad(actx, 'bandpass', 600, 0.5);
  const wind = gain(actx, 0);
  wsrc.connect(wbp);
  wbp.connect(wind);
  wind.connect(out);
  for (const o of [o1, o2, sub]) o.start(t0);
  wsrc.start(t0, wsrc._offset);
  out.gain.setTargetAtTime(0.8, t0, 0.5);
  return {
    set({ speed = 40, boost = 0, on = true } = {}, now = actx.currentTime) {
      const f = 46 + speed * 0.35 + boost * 12;
      o1.frequency.setTargetAtTime(f, now, 0.15);
      o2.frequency.setTargetAtTime(f, now, 0.15);
      sub.frequency.setTargetAtTime(f / 2, now, 0.15);
      lp.frequency.setTargetAtTime(240 + speed * 6 + boost * 900, now, 0.12);
      eng.gain.setTargetAtTime(on ? 0.12 + boost * 0.08 : 0, now, 0.15);
      wind.gain.setTargetAtTime(on ? Math.min(0.45, (speed / 80) ** 2 * 0.35 + boost * 0.12) : 0.03, now, 0.25);
      wbp.frequency.setTargetAtTime(400 + speed * 10, now, 0.2);
    },
  };
}
