/**
 * The look: a cold steel trench lit by its own seams, warm furnace light
 * from below, a pale glow at the far end. Colours for the trench (trench.js),
 * the ships and bolts (art.js, director) and the render grade (main.js).
 */
export const palette = {
  // sky and haze
  space: '#03050b',
  nebulaA: '#1b2c58',
  nebulaB: '#4a2448',
  farGlow: '#ffd2a0',
  fog: '#0b1222',
  fogDensity: 0.0026,
  // light
  key: '#b6ccff',
  keyIntensity: 1.5,
  rim: '#ff8a40',
  rimIntensity: 1.1,
  hemiSky: '#34508a',
  hemiGround: '#ff7a30',
  hemi: 0.75,
  coldFill: '#8db4ff',
  furnace: '#ff7a26',
  // trench
  steel: '#2a3344',
  steelDark: '#161c27',
  floor: '#141a24',
  seam: '#8ac8ff', // cold light strips on the wall faces
  seamGlow: 2.2,
  ember: '#ff9a30', // warm runoff strips low down
  emberGlow: 2.6,
  window: '#ffc890',
  beam: '#9cc4ff', // light columns beyond the walls
  // ships and fire
  playerBolt: '#9fe8ff',
  enemyBolt: '#ff6a2a',
  engine: '#7fd6ff',
  enemyEngine: '#ff5a3a',
  fire: '#ff7a2a',
  spark: '#ffd79a',
  smoke: '#262a33',
  core: '#ffb060',
};

export const grade = {
  exposure: 1.05,
  tone: 'aces',
  bloom: { strength: 0.55, radius: 0.5, threshold: 0.9 },
  ao: { radius: 2.2, intensity: 0.85 },
  shafts: { strength: 0.28, color: '#ffd2a0', density: 0.8, decay: 0.95, threshold: 1.8 },
  vignette: 0.42,
  grain: 0.02,
  saturation: 1.1,
  contrast: 1.06,
  shadows: '#d6e2ff',
  highlights: '#fff0dc',
};
