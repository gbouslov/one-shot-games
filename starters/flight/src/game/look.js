/**
 * The look: golden hour over a warm sea. Colours for the world (read by
 * world.js) and the render grade (applied in main.js). Change the time of
 * day here: a higher sun in config.sunDir, a bluer horizon, a whiter sun light.
 */
export const palette = {
  // sky and haze
  zenith: '#3a5a92',
  horizon: '#f3c18c',
  glow: '#ff9a4d',
  sun: '#fff0d2',
  hazeSun: '#e6b183',
  hazeAway: '#a9a2b0',
  fogDensity: 0.00017,
  cloud: '#ffd0a0',
  cloudShadow: '#8c7896',
  cumulus: '#ffd7b0',
  // light
  sunLight: '#ffc58a',
  sunIntensity: 3.4,
  skyFill: '#9dbbe6',
  groundFill: '#7a6a48',
  fill: 1.35,
  envIntensity: 0.7,
  // sea
  deep: '#0c4560',
  shallow: '#1fb0aa',
  foam: '#fff3e2',
  // land
  wetSand: '#c2a676',
  sand: '#f0d8a4',
  dryGrass: '#bfae62',
  grass: '#7da445',
  forest: '#3f6a30',
  rock: '#b49c80',
  cliff: '#a08670',
};

export const grade = {
  exposure: 1.0,
  tone: 'aces',
  bloom: { strength: 0.42, radius: 0.55, threshold: 0.92 },
  ao: { radius: 1.5, intensity: 0.8 },
  shafts: { strength: 0.45, color: '#ffc68c', density: 0.9, decay: 0.955, threshold: 1.25 },
  vignette: 0.3,
  grain: 0.018,
  saturation: 1.06,
  contrast: 1.04,
  shadows: '#e3e6ff',
  highlights: '#fff3e0',
};
