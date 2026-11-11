// Your game starts here. Everything in src/game/ is yours to rewrite.
import { humanoid } from '../kit/actors/rig.js';

export default {
  quality: 'high',
  fov: 38,
  // one floating stick over the whole screen: the weapons aim themselves
  touch: 'move',
  camera: {
    mode: 'topdown',
    pitch: 1.08, // radians above the horizon: higher reads a crowd better
    distance: 24,
    lead: 0, // nothing to aim, so the view stays centred on you
    maxLead: 0,
    damping: 6,
  },
  player: {
    speed: 5.2,
    accel: 40,
    radius: 0.42,
    maxHealth: 100,
    regen: 0.6, // health a second
    pickup: 3.0, // metres: experience inside this flies to you
    dash: false,
    faceMove: true,
    hold: 0.35,
    // The lamp-warden: a waxed green coat and a wide-brimmed hat against the rain,
    // a storm lantern swinging from the left hand.
    rig: (rng) => humanoid(rng, {
      height: 1.8,
      build: 1.05,
      head: 'cap',
      colors: { skin: '#c49478', top: '#3f5a3a', bottom: '#2a2620', boots: '#16130f', accent: '#2b2620' },
      glow: [{ seg: 'armL', pos: [0, -0.86, 0.1], r: 0.07 }],
      glowColor: '#ffd38a',
      glowIntensity: 7,
      gear: (add, s) => {
        // the hat brim, a long coat skirt, a satchel strap
        add('head', s.cyl(0.3, 0.3, 0.025, 16), '#241f1a', { pos: [0, 0.14, 0] });
        add('upper', s.cyl(0.26, 0.34, 0.5, 10), '#3a5435', { pos: [0, -0.1, 0] });
        add('upper', s.box(0.06, 0.62, 0.42), '#5a4128', { pos: [0, 0.3, 0], rot: [0, 0, 0.6] });
        add('upper', s.box(0.22, 0.2, 0.12), '#5a4128', { pos: [-0.2, 0.0, -0.18] });
        // the lantern: a cage hanging under the left hand
        add('armL', s.cyl(0.07, 0.09, 0.03, 8), '#2c2a26', { pos: [0, -0.74, 0.1] });
        add('armL', s.cyl(0.09, 0.09, 0.03, 8), '#2c2a26', { pos: [0, -0.98, 0.1] });
        for (const [x, z] of [[-0.07, 0.03], [0.07, 0.03], [-0.07, 0.17], [0.07, 0.17]]) add('armL', s.box(0.012, 0.24, 0.012), '#2c2a26', { pos: [x, -0.86, z] });
      },
    }),
  },
  // Pixel-art flares (src/kit/fx/pixelfx.js), off: they clash with this realistic night.
  pixelfx: { enabled: false },
  hud: {
    accent: '#ffc36b',
    ink: '#f2eee6',
    hurt: '#c0242c',
    xp: '#7ff0c4',
    scrim: 'rgba(4,6,8,.86)',
    clockLabel: 'Until the bell',
    levelLabel: 'Warden',
    scoreLabel: 'Laid to rest',
    healthLabel: 'Vitals',
    kitLabel: 'Carried',
    healthSegments: 10,
  },
};
