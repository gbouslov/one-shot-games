/**
 * The rules and words of the default game. Rewrite for a new game.
 */
export default {
  title: 'Amberline GP',
  kicker: 'Amberline Ring  ·  3 laps  ·  sundown',
  tagline: 'Eight karts, one hillside, the last hour of light.',
  /** Which racer from racers.js the player drives. */
  player: 'orrin',
  laps: 3,
  /** Rival skill: 'easy' | 'normal' | 'hard'. */
  difficulty: 'normal',
  /** Finish in this place or better to win the round. */
  winPlace: 3,
  /** Skill of the autoplay bot the playtest uses. */
  botDifficulty: 'hard',
  /** Seconds the attract race behind the title runs before anyone sees it. */
  attractLead: 9,
  winText: 'Podium finish',
  loseText: 'Off the podium',
  controlsLegend: [
    ['W  ↑', 'throttle'],
    ['A D  ← →', 'steer'],
    ['S  ↓', 'brake'],
    ['Space  Shift', 'hop and drift'],
    ['E  Ctrl', 'use item'],
    ['Q', 'look back'],
    ['M', 'mute'],
  ],
};
