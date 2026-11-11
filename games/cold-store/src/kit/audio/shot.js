// Derived from mshumer/Claude-of-Duty src/audio/weapons.js (MIT). See third_party/NOTICES.md.
// Real-weapon profiles and the distance model were removed; the layered synthesis stays.
import {
  ad, biquad, gain, hit, osc, saturationCurve, semis, series, shaper, struckResonator, sweep,
} from './dsp.js';

/**
 * A discharge is several layers at once: a transient click, a saturated body,
 * band-passed crack, a mid glue, a filtered tail and an optional mechanical
 * clack. These profiles describe what kind of thing went off, in generic terms.
 * Frequencies in Hz, times in seconds. Games add their own in src/game/sounds.js.
 */
export const SHOT_PROFILES = {
  light: { level: 0.8, bodyF: 186, bodyF2: 84, bodyDecay: 0.05, subF: 92, subDecay: 0.07, crackF: 2750, crackQ: 1.15, crackDecay: 0.035, drive: 4.5, asym: 0.28, midF: 950, midDecay: 0.03, tailDecay: 0.16, tailF: 6800, tailEndF: 1000, mechDelay: 0.038, mechLevel: 0.46, mechPartials: [2450, 4200, 6900] },
  medium: { level: 1.0, bodyF: 148, bodyF2: 56, bodyDecay: 0.085, subF: 62, subDecay: 0.12, crackF: 2450, crackQ: 0.95, crackDecay: 0.055, drive: 6, asym: 0.35, midF: 780, midDecay: 0.05, tailDecay: 0.3, tailF: 5200, tailEndF: 700, mechDelay: 0.028, mechLevel: 0.42, mechPartials: [1880, 3260, 5400] },
  heavy: { level: 1.18, bodyF: 108, bodyF2: 40, bodyDecay: 0.13, subF: 44, subDecay: 0.19, crackF: 1450, crackQ: 0.7, crackDecay: 0.09, drive: 9, asym: 0.6, midF: 520, midDecay: 0.08, tailDecay: 0.5, tailF: 3600, tailEndF: 460, mechDelay: 0.16, mechLevel: 0.7, mechPartials: [980, 1760, 3050], pellets: 6 },
  soft: { level: 0.55, bodyF: 132, bodyF2: 64, bodyDecay: 0.055, subF: 70, subDecay: 0.07, crackF: 900, crackQ: 0.6, crackDecay: 0.03, drive: 2.5, asym: 0.2, midF: 430, midDecay: 0.05, tailDecay: 0.1, tailF: 1800, tailEndF: 400, mechDelay: 0.019, mechLevel: 0, mechPartials: [2100, 3700, 5900] },
};

export function shotVoice(actx, bank, rng, dest, t0, profile) {
  const jB = semis(rng.range(-1.2, 1.2));
  const jC = semis(rng.range(-1.6, 1.6));
  const jL = rng.range(0.92, 1.06);
  const out = gain(actx, 0.46);
  out.connect(dest);

  // transient
  {
    const tg = gain(actx, 0);
    const src = bank.source('white', rng, rng.range(0.9, 1.3));
    series(src, biquad(actx, 'highpass', 2600, 0.6), biquad(actx, 'peaking', 6200 * jC, 1.1, 8), tg).connect(out);
    hit(tg.gain, t0, 0.9 * jL, 0.0075);
    src.start(t0, src._offset, 0.05);
  }

  // body and sub
  {
    const b1 = osc(actx, 'sine', profile.bodyF * jB);
    const b2 = osc(actx, 'triangle', profile.bodyF * jB * 0.5);
    const bg = gain(actx, 0);
    b1.connect(bg);
    b2.connect(bg);
    series(bg, shaper(actx, saturationCurve(profile.drive * 0.5, profile.asym), '2x'), biquad(actx, 'lowpass', 2200, 0.9)).connect(out);
    sweep(b1.frequency, t0, profile.bodyF * jB, profile.bodyF2 * jB, profile.bodyDecay * 1.4);
    sweep(b2.frequency, t0, profile.bodyF * jB * 0.5, profile.bodyF2 * jB * 0.55, profile.bodyDecay * 1.6);
    ad(bg.gain, t0, 0.85 * jL * profile.level, 0.0012, profile.bodyDecay * rng.range(0.9, 1.15));
    b1.start(t0);
    b2.start(t0);
    const end = t0 + profile.bodyDecay * 1.8 + 0.02;
    b1.stop(end);
    b2.stop(end);

    const s = osc(actx, 'sine', profile.subF * jB);
    const sg = gain(actx, 0);
    s.connect(sg);
    sg.connect(out);
    sweep(s.frequency, t0, profile.subF * jB * 1.5, profile.subF * jB * 0.8, profile.subDecay);
    ad(sg.gain, t0, 0.5 * profile.level, 0.004, profile.subDecay * 1.3);
    s.start(t0);
    s.stop(t0 + profile.subDecay * 2 + 0.05);
  }

  // crack
  {
    const src = bank.source('white', rng, rng.range(0.85, 1.25));
    const bp = biquad(actx, 'bandpass', profile.crackF * jC, profile.crackQ);
    const cg = gain(actx, 0);
    series(src, bp, shaper(actx, saturationCurve(profile.drive, profile.asym * 0.6), '2x'), cg).connect(out);
    sweep(bp.frequency, t0, profile.crackF * jC * 1.35, profile.crackF * jC * 0.8, profile.crackDecay * 2);
    ad(cg.gain, t0, 1.05 * jL * profile.level, 0.0015, profile.crackDecay * rng.range(0.85, 1.2));
    src.start(t0, src._offset, profile.crackDecay * 3 + 0.05);
  }

  // mid glue
  {
    const src = bank.source('pink', rng, rng.range(0.8, 1.25));
    const mg = gain(actx, 0);
    series(src, biquad(actx, 'bandpass', profile.midF, 1.1), mg).connect(out);
    ad(mg.gain, t0, 0.5 * jL * profile.level, 0.002, profile.midDecay * 1.4);
    src.start(t0, src._offset, profile.midDecay * 4 + 0.05);
  }

  // tail
  {
    const tailDur = profile.tailDecay * rng.range(0.9, 1.1);
    const src = bank.source('pink', rng, rng.range(0.7, 1.15));
    const lp = biquad(actx, 'lowpass', profile.tailF, 0.6);
    const tg = gain(actx, 0);
    series(src, biquad(actx, 'highpass', 160, 0.7), lp, tg).connect(out);
    sweep(lp.frequency, t0, profile.tailF, profile.tailEndF, tailDur);
    ad(tg.gain, t0, 0.42 * jL * profile.level, 0.006, tailDur);
    src.start(t0, src._offset, tailDur * 1.3 + 0.05);
  }

  // mechanical clack
  if (profile.mechLevel > 0) {
    const md = profile.mechDelay * rng.range(0.85, 1.2);
    const p = profile.mechPartials;
    struckResonator(actx, bank, rng, t0 + md, [
      { f: p[0] * rng.range(0.96, 1.05), q: 26, g: 0.5 * profile.mechLevel, decay: 0.055 },
      { f: p[1] * rng.range(0.96, 1.05), q: 20, g: 0.34 * profile.mechLevel, decay: 0.035 },
      { f: p[2] * rng.range(0.96, 1.05), q: 14, g: 0.2 * profile.mechLevel, decay: 0.02 },
    ], 0.0035).connect(out);
  }

  // multi-pellet spatter
  if (profile.pellets) {
    for (let i = 0; i < profile.pellets; i++) {
      const pt = t0 + rng.range(0.0004, 0.006);
      const src = bank.source('white', rng, rng.range(0.9, 1.4));
      const g = gain(actx, 0);
      series(src, biquad(actx, 'bandpass', rng.range(2600, 6200), 1.8), g).connect(out);
      hit(g.gain, pt, 0.1, rng.range(0.004, 0.014));
      src.start(pt, src._offset, 0.05);
    }
  }
}

/** Dry click when empty. */
export function dryVoice(actx, bank, rng, dest, t0) {
  const out = gain(actx, 1);
  out.connect(dest);
  struckResonator(actx, bank, rng, t0, [
    { f: 2600 * rng.range(0.95, 1.05), q: 24, g: 1.2, decay: 0.035 },
    { f: 4700, q: 16, g: 0.66, decay: 0.02 },
    { f: 860, q: 10, g: 0.5, decay: 0.05 },
  ], 0.0025).connect(out);
}
