/** Title, waves and end screens. The round system runs whatever is listed here. */
export const rules = {
  title: 'Proving Ground',
  tagline: 'A working first-person game. Clear both waves, then make it yours.',
  startLabel: 'Click to play',
  controls: 'WASD move · mouse aim · click fire · R reload · 1 2 3 or Q swap · Space jump · Shift sprint',
  minSpawnDistance: 14,
  breakSeconds: 2,
  waves: [
    { message: 'Wave 1', spawnInterval: 0.8, enemies: [{ type: 'walker', count: 3 }] },
    { message: 'Wave 2', spawnInterval: 0.7, enemies: [{ type: 'walker', count: 3 }, { type: 'spitter', count: 2 }] },
  ],
  winScreen: { title: 'Cleared', text: 'Nothing left standing.', action: 'Play again' },
  loseScreen: { title: 'You fell', text: 'They got to you.', action: 'Try again' },
};
