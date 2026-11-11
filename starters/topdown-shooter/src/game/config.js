// Your game starts here. Everything in src/game/ is yours to rewrite.
import { humanoid } from '../kit/actors/rig.js';

export default {
  quality: 'high',
  fov: 36,
  camera: {
    mode: 'topdown',
    pitch: 1.0, // radians above the horizon: lower is more cinematic, higher is easier to read
    distance: 22,
    lead: 0.24, // how far the view leans toward the aim
    maxLead: 4.5,
    damping: 7,
  },
  player: {
    speed: 6.4,
    accel: 46,
    radius: 0.42,
    maxHealth: 100,
    dashSpeed: 19,
    dashTime: 0.17,
    dashCooldown: 0.7,
    // The yard keeper: an amber oilskin coat (so you can find yourself in the
    // dark at a glance), reflective bands, a headlamp.
    rig: (rng) => humanoid(rng, {
      height: 1.82,
      build: 1.08,
      head: 'hood',
      colors: { skin: '#c49478', top: '#c98a2e', bottom: '#2d3238', boots: '#141414', accent: '#b37a26' },
      glow: [{ seg: 'head', pos: [0, 0.2, 0.15], r: 0.035 }],
      glowColor: '#fff2d6',
      glowIntensity: 6,
      gear: (add, s) => {
        // a reflective band across the back and chest, and a pack
        add('upper', s.box(0.56, 0.06, 0.4), '#e8e6dc', { pos: [0, 0.42, 0] });
        add('upper', s.box(0.56, 0.05, 0.4), '#e8e6dc', { pos: [0, 0.26, 0] });
        add('upper', s.box(0.36, 0.42, 0.18), '#2a2f2a', { pos: [0, 0.38, -0.22] });
        add('upper', s.box(0.6, 0.07, 0.42), '#1d201d', { pos: [0, 0.12, 0] });
      },
    }),
  },
  // Pixel-art flares and sparks (src/kit/fx/pixelfx.js) as additive light. Off: they clash with this
  // realistic yard. Turn on for a stylised game; `on: { fire, impact, pickup }` swaps or drops each one.
  pixelfx: { enabled: false },
  hud: {
    accent: '#ffb347',
    ink: '#f2eee6',
    hurt: '#b3121b',
    scrim: 'rgba(4,6,10,.88)',
    scoreLabel: 'Score',
    healthLabel: 'Vitals',
    dashLabel: 'Dash',
    healthSegments: 10,
  },
};
