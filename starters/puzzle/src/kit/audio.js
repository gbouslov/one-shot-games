// Sound made in code. Effects are ZzFX parameter lists played through the engine's Sound;
// the music is a small generative pad and pluck loop on Web Audio. Nothing is loaded from a file.
import * as LJS from './engine.js';

export const audio = {
  played: 0,
  get state() { return LJS.audioContext?.state ?? 'not-started'; },
  muted: false,
};

/** A sound effect from a ZzFX list (https://killedbyapixel.github.io/ZzFX/). */
export function sfx(params, { volume = 1, randomness } = {}) {
  const sound = new LJS.Sound(params, randomness);
  return {
    sound,
    play(pos, vol = 1, pitch = 1) {
      if (audio.muted) return;
      audio.played++;
      return sound.play(pos, vol * volume, pitch);
    },
  };
}

/** Resume audio on the first gesture; the engine also does this on keys. */
export function resumeAudio() {
  const c = LJS.audioContext;
  if (c && c.state !== 'running') c.resume().catch(() => {});
}

/**
 * A quiet loop under the game: a soft chord pad and a plucked arpeggio, built from oscillators.
 * chords: list of chords, each a list of MIDI notes. Starts on the first call to start().
 */
export function createMusic({ chords, bpm = 84, volume = 0.18, pluck = true, wave = 'triangle', bright = 1400 }) {
  let running = false;
  let timer = 0;
  let step = 0;
  let nextTime = 0;
  let out;
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  const ensure = () => {
    const c = LJS.audioContext;
    if (!c || out) return c;
    out = c.createGain();
    out.gain.value = volume;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = bright;
    // a short feedback delay for space
    const delay = c.createDelay(1);
    delay.delayTime.value = (60 / bpm) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    out.connect(lp);
    lp.connect(LJS.audioMasterGain ?? c.destination);
    lp.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    fb.connect(LJS.audioMasterGain ?? c.destination);
    return c;
  };

  const note = (c, t, midi, dur, gain, type, attack) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = hz(midi);
    o.detune.value = ((midi * 7919 + step * 31) % 9) - 4; // not Math.random: that is the game's seeded stream
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const schedule = () => {
    const c = LJS.audioContext;
    if (!running || !c || c.state !== 'running') return;
    const beat = 60 / bpm / 2; // eighth notes
    while (nextTime < c.currentTime + 0.3) {
      const chord = chords[Math.floor(step / 16) % chords.length];
      const i = step % 16;
      if (i === 0) for (const m of chord) note(c, nextTime, m - 12, beat * 16, 0.05, 'sine', 0.8);
      if (pluck && (i % 2 === 0 || i === 7 || i === 13)) {
        const m = chord[(i * 3 + (i >> 2)) % chord.length] + (i % 4 === 2 ? 12 : 0);
        note(c, nextTime, m, beat * 3, 0.07, wave, 0.005);
      }
      nextTime += beat;
      step++;
    }
  };

  return {
    start() {
      const c = ensure();
      if (!c || running) return;
      running = true;
      nextTime = c.currentTime + 0.1;
      timer = setInterval(schedule, 100);
    },
    stop() {
      running = false;
      clearInterval(timer);
    },
    get running() { return running; },
  };
}
