/**
 * The look: dusk over a sea of fire. A low copper sun ahead throws long light
 * down the causeway and rims everything; the lava lights the world from below;
 * violet sky and ash haze swallow the distance. Colours for the world
 * (world.js), the obstacles and pickups (art.js), the courier (courier.js),
 * effects (director) and the render grade (main.js).
 */
export const palette = {
  // sky and haze
  zenith: '#140c26',
  skyMid: '#4a1f45',
  horizon: '#ff6a32',
  sun: '#ffc285',
  fill: '#a99cff', // cool light on the courier's back, from the camera's side
  fillIntensity: 7,
  fog: '#3b1820',
  fogDensity: 0.0075,
  // light
  key: '#ffb27a', // the sun
  keyIntensity: 2.6,
  hemiSky: '#5a4a86',
  hemiGround: '#ff5418',
  hemi: 0.75,
  under: '#ff5a1e', // lava light from below
  underIntensity: 1.1,
  // lava
  crust: '#120807',
  crustWarm: '#2c0f08',
  lava: '#ff4a0c',
  lavaHot: '#ffc46a',
  // causeway
  stone: '#3a3236',
  stoneDark: '#211b1e',
  stoneWarm: '#4a3a34',
  grout: '#0d0909',
  groutGlow: '#ff6a20',
  curb: '#2c2528',
  lane: '#ff8a3a', // the faint seams between lanes
  // things
  brazier: '#ffae58',
  beacon: '#ffcf8a',
  cinder: '#ffc066',
  cinderHot: '#fff0c0',
  lantern: '#ffb35a',
  dust: '#6a5048',
  spark: '#ffcf7a',
  hit: '#ff6a2a',
  lines: '#ffe0bc',
};

export const grade = {
  exposure: 1.0,
  tone: 'aces',
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.82 },
  ao: { radius: 1.4, intensity: 0.8 },
  shafts: { strength: 0.42, color: '#ffc890', density: 0.85, decay: 0.95, threshold: 1.25 },
  vignette: 0.46,
  grain: 0.025,
  saturation: 1.08,
  contrast: 1.08,
  shadows: '#cfc6ff',
  highlights: '#fff0dc',
};
