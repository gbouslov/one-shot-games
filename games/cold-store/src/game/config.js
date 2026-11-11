import { assets } from '../assets/index.js';
import { shooterHud } from '../kit/hud/shooter-hud.js';

// Feel: a touch quicker than the starter, a wider sprint gap, a snappier jump.
export default {
  quality: 'high',
  fov: 78,
  credits: [assets.credits()],
  player: {
    walkSpeed: 5.0,
    sprintSpeed: 8.4,
    jumpSpeed: 7.8,
    maxHealth: 100,
  },
  hud: {
    accent: '#9fd0ff',
    ink: '#eef4ff',
    hurt: '#a01515',
    scrim: 'rgba(6,9,14,.7)',
    warn: '#f2a23a',
    objective: '#7fe0ff',
    // the kit's shooter HUD: minimap, compass, objective, wave bar, score, weapon block, radio
    shooter: shooterHud({ north: 0, mapRange: 24, voice: 'MARTA \u00b7 DISPATCH', killScore: 100, headBonus: 50, chainWindow: 4 }),
  },
};
