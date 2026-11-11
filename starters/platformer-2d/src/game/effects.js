// The moments of action, drawn with pixelfx effects (src/kit/pixelfx.js) recoloured to the dusk:
// violet smoke, sunseed gold, lantern amber, beacon cyan. Each function takes the world position
// of the moment; the effect's own origin (its floor, y = 0) goes there.
import * as LJS from '../kit/engine.js';
import * as poof from '../kit/vendor/pixelfx/src/fx/spawn/poof.js';
import * as collectBurst from '../kit/vendor/pixelfx/src/fx/pickups/collect-burst.js';
import * as hitSpark from '../kit/vendor/pixelfx/src/fx/impacts/hit-spark.js';
import * as fireworkBurst from '../kit/vendor/pixelfx/src/fx/explosions/firework-burst.js';
import * as fireworkRocket from '../kit/vendor/pixelfx/src/fx/explosions/firework-rocket.js';

const { vec2 } = LJS;

// palettes, dark to bright
const DUSK_SMOKE = ['#2a1640', '#55306e', '#8e5a92', '#c890b4', '#f6d8e6', '#ffffff'];
const STAR_GOLD = ['#ffb04a', '#ffe08a', '#ffffff'];
const SEED_GOLD = ['#2a1406', '#6a3a0c', '#b8701a', '#f0a830', '#ffd860', '#fff2b0', '#fffbe8', '#ffffff'];
const LAMP_AMBER = ['#2a0a10', '#5a1a1c', '#a03a24', '#e0702a', '#ffa040', '#ffd080', '#fff0c8', '#ffffff'];
const HURT_ROSE = ['#3a0a1a', '#b0203a', '#f0405a', '#ff7a6a', '#ffd27a', '#fff0b0', '#ffffff'];
const BEACON_CYAN = ['#0c2a3a', '#16506a', '#2a90b0', '#5ad0f0', '#a8f0ff', '#e0fcff', '#ffffff'];
const BEACON_ROSE = ['#3d0a33', '#701560', '#b0306f', '#f05a8a', '#ff9ab0', '#ffd8e0', '#ffffff'];
const CORE_GOLD = ['#4a2c08', '#86520c', '#c48412', '#f0b424', '#ffe066', '#fff6c4', '#ffffff'];

export function makeEffects(pfx) {
  const px = 1 / pfx.pxPerTile; // one effect pixel, in tiles
  return {
    /** a bramblebug popped: a soft violet poof with gold stars, from its feet */
    stomp(feet) {
      pfx.spawn(poof, feet, { palette: DUSK_SMOKE, stars: STAR_GOLD });
    },
    /** a sunseed gathered: flash, rings and gold twinkles centred on the seed (the burst sits 30 px over its origin) */
    seed(at) {
      pfx.spawn(collectBurst, at.add(vec2(0, -30 * px)), { palette: SEED_GOLD });
    },
    /** a lantern lit: the same pop in amber, a little stronger */
    lantern(lamp) {
      pfx.spawn(collectBurst, lamp.add(vec2(0, -30 * px)), { palette: LAMP_AMBER, light: 1.3 });
    },
    /** the robot hurt: a lopsided hit flare along the blow, sparks falling to its feet. dir: +1 thrown right, -1 left */
    hurt(feet, dir) {
      pfx.spawn(hitSpark, feet, { palette: HURT_ROSE, flip: dir < 0, aim: -0.35, height: 16 });
    },
    /** the beacon woke: a rocket off the ridge and two shells over the crystal */
    celebrate(crystal, ground) {
      pfx.spawn(fireworkRocket, vec2(crystal.x - 2.2, ground), { tips: BEACON_CYAN });
      pfx.spawn(fireworkBurst, crystal.add(vec2(2.6, 0.5)), { palette: BEACON_CYAN, core: CORE_GOLD, delay: 0.15 });
      pfx.spawn(fireworkBurst, crystal.add(vec2(-3.6, 1.1)), { palette: BEACON_ROSE, core: CORE_GOLD, delay: 0.55 });
    },
  };
}
