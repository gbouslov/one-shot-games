// Adapted from starters/fps-three/src/kit/audio/audio.js: the gun voices are
// gone, the ambient bed returns a handle the game can drive every frame (an
// engine note that follows the throttle), and there is a mute. See NOTICES.md.
import { NoiseBank, ad, biquad, gain, limiterCurve, osc, shaper, sweep } from './dsp.js';
import { Rng } from '../core/rng.js';

/**
 * Procedural sound: no audio files. Every voice has the signature
 *   voice(actx, bank, rng, dest, t0, params)
 * so the same code runs in the live AudioContext and an OfflineAudioContext.
 *
 * The context starts on the first click or key, as browsers require.
 * audio.play('name', params) for one-shots; voices come from src/game/sounds.js.
 * `bed(actx, bank, rng, dest, t0)` may return { set(params) } for a sound that
 * runs all the time; audio.setBed(params) forwards to it.
 */
export function tone(actx, bank, rng, dest, t0, { from = 440, to = 660, level = 0.25, dur = 0.12, type = 'triangle', attack = 0.004 } = {}) {
  const o = osc(actx, type, from);
  const g = gain(actx, 0);
  o.connect(g);
  g.connect(dest);
  sweep(o.frequency, t0, from, to, dur);
  ad(g.gain, t0, level, attack, dur);
  o.start(t0);
  o.stop(t0 + attack + dur * 2.6);
}

export function noiseHit(actx, bank, rng, dest, t0, { freq = 1800, q = 0.9, level = 0.5, decay = 0.06, kind = 'white', type = 'bandpass', attack = 0.002 } = {}) {
  const src = bank.source(kind, rng, rng.range(0.85, 1.2));
  const g = gain(actx, 0);
  const f = biquad(actx, type, freq * rng.range(0.9, 1.1), q);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  ad(g.gain, t0, level, attack, decay);
  src.start(t0, src._offset, attack + decay * 3 + 0.05);
}

export function thud(actx, bank, rng, dest, t0, { freq = 90, level = 0.8, decay = 0.14 } = {}) {
  const o = osc(actx, 'sine', freq);
  const g = gain(actx, 0);
  o.connect(g);
  g.connect(dest);
  sweep(o.frequency, t0, freq * 1.8, freq * 0.6, decay);
  ad(g.gain, t0, level, 0.003, decay);
  o.start(t0);
  o.stop(t0 + decay * 2.4);
}

export class AudioSystem {
  static id = 'audio';
  static deps = [];

  constructor(opts = {}) {
    this.voices = { ...(opts.voices ?? {}) };
    this.bedFn = opts.bed ?? null;
  }

  init(ctx) {
    this.ctx = ctx;
    this.actx = null;
    this.rng = ctx.rng.fork();
    this.played = 0;
    this.muted = false;
    this.bed = null;
    this.log = null;
  }

  /** Create or resume the context. Call from inside a user gesture. */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.actx) {
      this.actx = new AC();
      this.bank = new NoiseBank(this.actx, this.rng);
      this.master = this._buildMaster(this.actx);
      this.bed = this.bedFn?.(this.actx, this.bank, this.rng, this.master, this.actx.currentTime + 0.05) ?? null;
    }
    if (this.actx.state === 'suspended') this.actx.resume();
  }

  _buildMaster(actx) {
    const input = gain(actx, this.muted ? 0 : 0.62);
    const limit = shaper(actx, limiterCurve(), '2x');
    input.connect(limit);
    limit.connect(actx.destination);
    this.analyser = actx.createAnalyser?.() ?? null;
    if (this.analyser) limit.connect(this.analyser);
    return input;
  }

  setMuted(on) {
    this.muted = !!on;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.62, this.actx.currentTime, 0.03);
  }

  setBed(params) {
    if (this.bed && this.actx?.state === 'running') this.bed.set(params, this.actx.currentTime);
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

  /** Render a recorded event log through the same voices, offline (for the recorder). */
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
    this.bedFn?.(off, bank, rng, input, 0.05);
    for (const ev of log) this.voices[ev.name]?.(off, bank, rng, input, ev.frame / fps, ev.params ?? undefined);
    const buf = await off.startRendering();
    return { sampleRate: sr, left: buf.getChannelData(0), right: buf.getChannelData(1) };
  }
}
