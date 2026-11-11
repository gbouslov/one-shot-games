import { NoiseBank, ad, biquad, gain, limiterCurve, osc, series, shaper, sweep } from './dsp.js';
import { SHOT_PROFILES, dryVoice, shotVoice } from './shot.js';
import { Rng } from '../core/rng.js';

/**
 * Procedural sound: no audio files. Every voice has the signature
 *   voice(actx, bank, rng, dest, t0, params)
 * so the same code runs in the live AudioContext and in an OfflineAudioContext.
 * The recorder uses that to render a frame-accurate soundtrack (see renderLog).
 *
 * The context starts on the first click, as browsers require.
 * Play with audio.play('name', params). Add voices in src/game/sounds.js.
 */

function thud(actx, bank, rng, dest, t0, { freq = 90, level = 0.8, decay = 0.14 } = {}) {
  const o = osc(actx, 'sine', freq);
  const g = gain(actx, 0);
  o.connect(g);
  g.connect(dest);
  sweep(o.frequency, t0, freq * 1.8, freq * 0.6, decay);
  ad(g.gain, t0, level, 0.003, decay);
  o.start(t0);
  o.stop(t0 + decay * 2.4);
}

function noiseHit(actx, bank, rng, dest, t0, { freq = 1800, q = 0.9, level = 0.5, decay = 0.06, kind = 'white' } = {}) {
  const src = bank.source(kind, rng, rng.range(0.85, 1.2));
  const g = gain(actx, 0);
  series(src, biquad(actx, 'bandpass', freq * rng.range(0.9, 1.1), q), g).connect(dest);
  ad(g.gain, t0, level, 0.002, decay);
  src.start(t0, src._offset, decay * 3 + 0.05);
}

function tone(actx, bank, rng, dest, t0, { from = 440, to = 660, level = 0.25, dur = 0.12, type = 'triangle' } = {}) {
  const o = osc(actx, type, from);
  const g = gain(actx, 0);
  o.connect(g);
  g.connect(dest);
  sweep(o.frequency, t0, from, to, dur);
  ad(g.gain, t0, level, 0.004, dur);
  o.start(t0);
  o.stop(t0 + dur * 2.6);
}

export const CORE_VOICES = {
  shot: (a, b, r, d, t, p = {}) => shotVoice(a, b, r, d, t, typeof p.profile === 'object' ? p.profile : SHOT_PROFILES[p.profile ?? 'medium']),
  dry: dryVoice,
  impact: (a, b, r, d, t, p = {}) => noiseHit(a, b, r, d, t, { freq: p.freq ?? 1900, level: p.level ?? 0.3, decay: 0.05 }),
  hit: (a, b, r, d, t, p = {}) => {
    tone(a, b, r, d, t, { from: p.head ? 1760 : 1320, to: p.head ? 2200 : 1100, level: 0.2, dur: 0.05, type: 'square' });
    noiseHit(a, b, r, d, t, { freq: 520, q: 0.7, level: 0.55, decay: 0.07, kind: 'pink' });
  },
  kill: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 70, level: 0.9, decay: 0.24 });
    noiseHit(a, b, r, d, t, { freq: 700, q: 0.6, level: 0.6, decay: 0.16, kind: 'pink' });
  },
  hurt: (a, b, r, d, t) => {
    thud(a, b, r, d, t, { freq: 58, level: 1, decay: 0.2 });
    tone(a, b, r, d, t, { from: 260, to: 120, level: 0.22, dur: 0.16, type: 'sawtooth' });
  },
  step: (a, b, r, d, t, p = {}) => noiseHit(a, b, r, d, t, { freq: 260, q: 0.8, level: p.running ? 0.3 : 0.2, decay: 0.05, kind: 'brown' }),
  jump: (a, b, r, d, t) => noiseHit(a, b, r, d, t, { freq: 340, q: 0.7, level: 0.16, decay: 0.07, kind: 'pink' }),
  land: (a, b, r, d, t) => thud(a, b, r, d, t, { freq: 72, level: 0.55, decay: 0.12 }),
  reload: (a, b, r, d, t) => {
    noiseHit(a, b, r, d, t, { freq: 2600, q: 3, level: 0.28, decay: 0.03 });
    noiseHit(a, b, r, d, t + 0.09, { freq: 1500, q: 3, level: 0.28, decay: 0.03 });
  },
  swing: (a, b, r, d, t) => {
    const src = b.source('pink', r, 1);
    const g = gain(a, 0);
    const bp = biquad(a, 'bandpass', 600, 1.2);
    series(src, bp, g).connect(d);
    sweep(bp.frequency, t, 300, 1400, 0.18);
    ad(g.gain, t, 0.5, 0.05, 0.14);
    src.start(t, src._offset, 0.4);
  },
  telegraph: (a, b, r, d, t, p = {}) => tone(a, b, r, d, t, { from: p.freq ?? 180, to: (p.freq ?? 180) * 1.6, level: 0.2, dur: 0.22, type: 'sawtooth' }),
  wave: (a, b, r, d, t) => {
    tone(a, b, r, d, t, { from: 220, to: 330, level: 0.3, dur: 0.3 });
    tone(a, b, r, d, t + 0.16, { from: 330, to: 495, level: 0.28, dur: 0.34 });
  },
  win: (a, b, r, d, t) => [262, 330, 392, 523].forEach((f, i) => tone(a, b, r, d, t + i * 0.13, { from: f, to: f, level: 0.28, dur: 0.4 })),
  lose: (a, b, r, d, t) => [392, 311, 262, 196].forEach((f, i) => tone(a, b, r, d, t + i * 0.18, { from: f, to: f * 0.97, level: 0.26, dur: 0.5, type: 'sawtooth' })),
};

export class AudioSystem {
  static id = 'audio';
  static deps = [];

  constructor(opts = {}) {
    this.voices = { ...CORE_VOICES, ...(opts.voices ?? {}) };
    this.ambient = opts.ambient ?? null;
  }

  init(ctx) {
    this.ctx = ctx;
    this.actx = null;
    this.rng = ctx.rng.fork();
    this.played = 0;
    this.log = null; // [{ frame, name, params }] while recording
  }

  /** Create or resume the context. Call from inside a user gesture. */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.actx) {
      this.actx = new AC();
      this.bank = new NoiseBank(this.actx, this.rng);
      this.master = this._buildMaster(this.actx);
      this.ambient?.(this.actx, this.bank, this.rng, this.master, this.actx.currentTime + 0.05);
    }
    if (this.actx.state === 'suspended') this.actx.resume();
  }

  _buildMaster(actx) {
    const input = gain(actx, 0.62);
    const limit = shaper(actx, limiterCurve(), '2x');
    input.connect(limit);
    limit.connect(actx.destination);
    this.analyser = actx.createAnalyser?.() ?? null;
    if (this.analyser) limit.connect(this.analyser);
    return input;
  }

  play(name, params) {
    const voice = this.voices[name];
    if (!voice) {
      console.warn(`[audio] unknown voice "${name}"`);
      return;
    }
    this.played++;
    this.log?.push({ frame: this.ctx.time.frame, name, params });
    if (!this.actx || this.actx.state !== 'running') return;
    voice(this.actx, this.bank, this.rng, this.master, this.actx.currentTime + 0.002, params);
  }

  /**
   * Render a recorded event log through the same voices, offline. Returns
   * { sampleRate, left, right } for the recorder to write as a WAV.
   */
  async renderLog(log, frames, fps) {
    const sr = 48000;
    const length = Math.ceil((frames / fps + 1) * sr);
    const off = new OfflineAudioContext(2, length, sr);
    const rng = new Rng(0x51a7ed);
    const bank = new NoiseBank(off, rng);
    const input = gain(off, 0.62);
    const limit = shaper(off, limiterCurve(), '2x');
    input.connect(limit);
    limit.connect(off.destination);
    this.ambient?.(off, bank, rng, input, 0.05);
    for (const ev of log) this.voices[ev.name]?.(off, bank, rng, input, ev.frame / fps, ev.params ?? undefined);
    const buf = await off.startRendering();
    return { sampleRate: sr, left: buf.getChannelData(0), right: buf.getChannelData(1) };
  }
}
