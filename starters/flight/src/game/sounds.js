import { biquad, gain, osc } from '../kit/audio/dsp.js';
import { noiseHit, thud, tone } from '../kit/audio/audio.js';

/**
 * Every sound is made in code. One-shot voices, then the bed: a small
 * flat-four engine note that follows the throttle and air noise that follows
 * airspeed.
 */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (n, base = 523.25) => base * 2 ** (n / 12);

export const voices = {
  gate: (a, b, r, d, t, p = {}) => {
    const i = Math.min(PENTA.length - 1, p.index ?? 0);
    const f = note(PENTA[i]);
    tone(a, b, r, d, t, { from: f, to: f, level: 0.2, dur: 0.5, type: 'sine', attack: 0.005 });
    tone(a, b, r, d, t + 0.07, { from: f * 1.5, to: f * 1.5, level: 0.12, dur: 0.6, type: 'triangle' });
    noiseHit(a, b, r, d, t, { freq: 900, q: 0.6, level: 0.25, decay: 0.35, kind: 'pink', attack: 0.08 });
  },
  crash: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 55, level: 1, decay: 0.6 });
    noiseHit(a, b, r, d, t, { freq: 420, q: 0.5, level: 0.8, decay: 0.9, kind: 'brown', type: 'lowpass' });
    noiseHit(a, b, r, d, t + 0.02, { freq: 2400, q: 0.7, level: 0.25, decay: 0.25, kind: 'crackle' });
  },
  splash: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 70, level: 0.8, decay: 0.3 });
    noiseHit(a, b, r, d, t, { freq: 1600, q: 0.4, level: 0.7, decay: 1.1, kind: 'white', type: 'bandpass', attack: 0.02 });
  },
  warn: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: 880, to: 880, level: 0.1, dur: 0.09, type: 'square' });
    tone(a, b, r, d, t + 0.14, { from: 880, to: 880, level: 0.1, dur: 0.09, type: 'square' });
  },
  start: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: note(0, 392), to: note(0, 392), level: 0.18, dur: 0.25, type: 'sine' });
    tone(a, b, r, d, t + 0.12, { from: note(7, 392), to: note(7, 392), level: 0.18, dur: 0.4, type: 'sine' });
  },
  respawn: (a, b, r, d, t) => tone(a, b, r, d, t, { from: 330, to: 660, level: 0.12, dur: 0.3, type: 'sine' }),
  win: (a, b, r, d, t) => [0, 4, 7, 12, 16].forEach((n, i) => tone(a, b, r, d, t + i * 0.11, { from: note(n, 392), to: note(n, 392), level: 0.2, dur: 0.7, type: 'triangle' })),
  lose: (a, b, r, d, t) => [7, 4, 0, -5].forEach((n, i) => tone(a, b, r, d, t + i * 0.17, { from: note(n, 330), to: note(n, 330) * 0.98, level: 0.18, dur: 0.6, type: 'triangle' })),
};

/** The running bed: engine and wind. Returns a handle the director drives. */
export function bed(actx, bank, rng, dest, t0) {
  const out = gain(actx, 0);
  out.connect(dest);
  // Engine: two detuned saws and a sub, through a lowpass that opens with power.
  const lp = biquad(actx, 'lowpass', 500, 2.5);
  const eng = gain(actx, 0.22);
  const o1 = osc(actx, 'sawtooth', 62);
  const o2 = osc(actx, 'sawtooth', 62, 9);
  const sub = osc(actx, 'square', 31);
  const subG = gain(actx, 0.25);
  o1.connect(lp);
  o2.connect(lp);
  sub.connect(subG);
  subG.connect(lp);
  lp.connect(eng);
  eng.connect(out);
  // Firing pulses: amplitude-modulate the engine at the cylinder rate.
  const lfo = osc(actx, 'sine', 24);
  const lfoG = gain(actx, 0.08);
  lfo.connect(lfoG);
  lfoG.connect(eng.gain);
  // Wind.
  const wsrc = bank.source('pink', rng, 1, true);
  const wbp = biquad(actx, 'bandpass', 700, 0.6);
  const wind = gain(actx, 0);
  wsrc.connect(wbp);
  wbp.connect(wind);
  wind.connect(out);
  for (const o of [o1, o2, sub, lfo]) o.start(t0);
  wsrc.start(t0, wsrc._offset);
  out.gain.setTargetAtTime(0.9, t0, 0.4);

  return {
    set({ throttle = 0.7, speed = 90, on = true } = {}, now = actx.currentTime) {
      const rpm = 48 + throttle * 46;
      for (const o of [o1, o2]) o.frequency.setTargetAtTime(rpm, now, 0.12);
      sub.frequency.setTargetAtTime(rpm / 2, now, 0.12);
      lfo.frequency.setTargetAtTime(rpm * 0.4, now, 0.12);
      lp.frequency.setTargetAtTime(380 + throttle * 1100, now, 0.12);
      eng.gain.setTargetAtTime(on ? 0.14 + throttle * 0.14 : 0, now, 0.1);
      wind.gain.setTargetAtTime(on ? Math.min(0.5, (speed / 150) ** 2 * 0.45) : 0.05, now, 0.2);
      wbp.frequency.setTargetAtTime(400 + speed * 6, now, 0.2);
    },
  };
}
