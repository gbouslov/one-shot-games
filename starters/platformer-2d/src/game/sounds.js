// Every sound in the default game: ZzFX parameter lists, made in code. Design new ones at
// https://killedbyapixel.github.io/ZzFX/ and paste the list here.
import { sfx, createMusic } from '../kit/audio.js';

export function makeSounds() {
  return {
    jump: sfx([0.5, 0.05, 260, 0.01, 0.04, 0.09, 1, 1.6, 9, , , , , , , , , 0.7, 0.02]),
    land: sfx([0.35, 0.1, 90, 0.005, 0.01, 0.05, 4, 2, , , , , , 0.5, , 0.1, , 0.6, 0.02]),
    step: sfx([0.12, 0.2, 60, 0.003, 0.005, 0.02, 4, 1, , , , , , 1, , , , 0.4], { volume: 0.7 }),
    seed: sfx([0.6, 0, 880, 0.01, 0.05, 0.22, 1, 1.8, , , 440, 0.05, , , , , , 0.7, 0.04]),
    stomp: sfx([0.9, 0.05, 140, 0.01, 0.06, 0.18, 2, 1.6, -6, , , , , 0.6, , 0.2, , 0.6, 0.04]),
    hurt: sfx([0.9, 0.1, 320, 0.01, 0.08, 0.25, 3, 2.2, -12, , , , , 1.2, , 0.4, , 0.5, 0.06]),
    fall: sfx([0.7, 0, 520, 0.02, 0.2, 0.4, 1, 1.4, -24, , , , , , , , , 0.6, 0.1]),
    checkpoint: sfx([0.6, 0, 660, 0.02, 0.18, 0.4, 1, 1.5, , , 330, 0.08, 0.06, , , , , 0.7, 0.08]),
    win: sfx([1, 0, 523, 0.02, 0.4, 0.8, 1, 1.4, , , 262, 0.12, 0.1, , , , 0.15, 0.7, 0.2]),
    lose: sfx([0.9, 0, 220, 0.04, 0.3, 0.6, 2, 1.2, -4, , -60, 0.15, , 0.4, , , 0.1, 0.5, 0.2]),
  };
}

// a warm four-chord loop: Fmaj7, Am7, Dm9, Bbmaj7
export const music = createMusic({
  chords: [[65, 69, 72, 76], [69, 72, 76, 79], [62, 65, 69, 72, 76], [70, 74, 77, 81]],
  bpm: 92,
  volume: 0.16,
  wave: 'triangle',
  bright: 1800,
});
