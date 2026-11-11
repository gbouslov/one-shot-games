// The things in the world: the player, bramblebugs, sunseeds, lantern posts and the beacon.
// The player's controller follows the character in LittleJS examples/platformer/gameCharacter.js
// (MIT): coyote time, a buffered jump and a held-jump boost; rewritten with its own numbers.
import * as LJS from '../kit/engine.js';
import { input } from '../kit/input.js';
import { burst, shake, hitStop, flash, popText } from '../kit/fx.js';
import { tuning as K, palette as P } from './config.js';

const { vec2, rgb, hsl } = LJS;
export const art = { tiles: null }; // filled in by game.js once the atlas is on the GPU
export const world = { grid: null, sounds: null, game: null };

const glowColor = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
};

export function additive(fn) {
  LJS.setAdditiveBlendMode(true);
  fn();
  LJS.setAdditiveBlendMode(false);
}

export function glow(pos, size, color) {
  LJS.drawTile(pos, vec2(size), art.tiles.glow, color);
}

/* ------------------------------------------------------------------ player */

export class Player extends LJS.EngineObject {
  constructor(pos) {
    super(pos, vec2(0.62, 0.9));
    this.setCollision(true, false);
    this.renderOrder = 20;
    this.groundTimer = new LJS.Timer();
    this.jumpTimer = new LJS.Timer();
    this.bufferTimer = new LJS.Timer();
    this.hurtTimer = new LJS.Timer();
    this.facing = 1;
    this.walk = 0;
    this.stepDist = 0;
    this.squash = vec2(1, 1);
    this.wasGrounded = true;
    this.jumping = false;
    this.cut = false;
    this.frozen = false;
    this.blink = 0;
    this.peak = pos.y;
  }

  get grounded() { return !!this.groundObject; }

  update() {
    const g = world.game;
    const S = world.sounds;
    this.gravityScale = 1;
    if (this.frozen) {
      this.velocity.x *= 0.8;
      return;
    }
    const move = input.axis('left', 'right');

    // ground and coyote time
    if (this.grounded) this.groundTimer.set(K.coyoteTime);
    if (input.pressed('jump')) this.bufferTimer.set(K.jumpBuffer);

    // landing
    if (this.grounded && !this.wasGrounded) {
      const impact = Math.min(1, Math.abs(this.lastFall ?? 0) / 0.3);
      this.squash = vec2(1 + 0.3 * impact, 1 - 0.28 * impact);
      if (impact > 0.25) {
        S.land.play(this.pos, 0.6 + impact * 0.4);
        dust(this.pos.add(vec2(0, -0.45)), 8 + impact * 10);
      }
      this.jumping = false;
    }
    this.lastFall = this.velocity.y;

    // jump: buffered press, inside coyote time
    if (this.bufferTimer.active() && this.groundTimer.active() && !this.jumpTimer.active()) {
      this.velocity.y = K.jumpSpeed;
      this.jumpTimer.set(K.jumpHoldTime);
      this.groundTimer.unset();
      this.bufferTimer.unset();
      this.jumping = true;
      this.cut = false;
      this.squash = vec2(0.72, 1.3);
      S.jump.play(this.pos);
      dust(this.pos.add(vec2(0, -0.45)), 6);
    }
    if (this.jumping && this.velocity.y > 0) {
      if (input.down('jump') && this.jumpTimer.active()) this.velocity.y += K.jumpHoldBoost;
      else if (!input.down('jump') && !this.cut) {
        this.velocity.y *= K.jumpCut;
        this.cut = true;
      }
    }
    if (!this.grounded && this.velocity.y < 0) this.velocity.y += K.gravity * K.fallExtra;

    // run
    const accel = this.grounded ? K.groundAccel : K.airAccel;
    if (move) {
      this.velocity.x = LJS.clamp(this.velocity.x + move * accel, -K.runSpeed, K.runSpeed);
      this.facing = move;
    } else if (this.grounded) this.velocity.x *= K.groundStop;
    else this.velocity.x *= 0.96;

    // keep inside the level on the left and right
    if (this.pos.x < 0.4) { this.pos.x = 0.4; this.velocity.x = Math.max(0, this.velocity.x); }
    if (this.pos.x > world.grid.w - 0.4) { this.pos.x = world.grid.w - 0.4; this.velocity.x = Math.min(0, this.velocity.x); }

    // footsteps and walk cycle
    const speed = Math.abs(this.velocity.x);
    if (this.grounded && speed > 0.02) {
      this.walk += speed * 2.2;
      this.stepDist += speed;
      if (this.stepDist > 1.1) {
        this.stepDist = 0;
        S.step.play(this.pos);
        dust(this.pos.add(vec2(-this.facing * 0.2, -0.45)), 3, 0.5);
      }
    } else this.walk *= 0.8;

    this.squash = this.squash.lerp(vec2(1, 1), 0.18);
    this.wasGrounded = this.grounded;
    if (this.grounded) this.peak = this.pos.y;
    else this.peak = Math.max(this.peak, this.pos.y);

    // brambles
    if (!this.hurtTimer.active()) {
      const x0 = Math.floor(this.pos.x - 0.25);
      const x1 = Math.floor(this.pos.x + 0.25);
      const y = Math.floor(this.pos.y - 0.4);
      for (let x = x0; x <= x1; x++) {
        if (world.grid.get(x, y) === 'thorns') {
          this.hurt(vec2(x + 0.5, y));
          this.velocity.y = 0.2;
          break;
        }
      }
    }

    // fell off the world
    if (this.pos.y < -2.5) g.fell();

    this.blink = (this.blink + 1) % 240;
  }

  hurt(from) {
    if (this.hurtTimer.active() || this.frozen) return;
    const g = world.game;
    this.hurtTimer.set(K.hurtTime);
    const away = Math.sign(this.pos.x - from.x) || -this.facing;
    this.velocity = vec2(away * 0.16, 0.16);
    world.sounds.hurt.play(this.pos);
    shake(0.35);
    hitStop(0.07);
    flash(rgb(1, 0.2, 0.3), 0.32);
    world.effects.hurt(this.pos.add(vec2(-away * 0.25, -0.45)), away);
    burst(this.pos, { color: hsl(0.98, 1, 0.65), color2: hsl(0.08, 1, 0.6), count: 10, speed: 7, size: 0.14, life: 0.4, gravity: 0.6, tile: art.tiles.shard });
    g.loseHeart();
  }

  render() {
    if (this.hurtTimer.active() && (LJS.time * 14) % 2 < 0.8) return; // blink while safe
    const T = art.tiles;
    const m = this.facing < 0;
    const s = this.squash;
    const base = this.pos.add(vec2(0, -0.45)); // feet
    const bob = this.grounded ? Math.abs(Math.sin(this.walk)) * 0.06 : 0;
    // legs
    const legSwing = this.grounded ? Math.sin(this.walk) * 0.16 : 0.08;
    for (const side of [-1, 1]) {
      const lx = base.x + side * 0.14 * s.x + (this.grounded ? side * legSwing * 0.6 : 0);
      const ly = base.y + 0.13 + (this.grounded ? Math.max(0, side * Math.sin(this.walk)) * 0.07 : -0.02 * side);
      LJS.drawTile(vec2(lx, ly), vec2(0.2, 0.26), T.leg, LJS.WHITE, 0, m);
    }
    // body, squashed from the feet
    const size = vec2(1.08 * s.x, 1.08 * s.y);
    const body = vec2(base.x, base.y + 0.18 + size.y * 0.5 + bob);
    const lean = LJS.clamp(-this.velocity.x * 1.2, -0.18, 0.18);
    const frame = this.blink < 8 ? 1 : 0;
    LJS.drawTile(body, size, T.robot[frame], LJS.WHITE, lean, m);
    // antenna bulb, glowing
    const tip = body.add(vec2((m ? -1 : 1) * 0.07 * s.x, size.y * 0.53).rotate(-lean));
    LJS.drawTile(tip, vec2(0.16), T.bulb);
    additive(() => {
      glow(tip, 0.9 + 0.08 * Math.sin(LJS.time * 6), glowColor(P.bulb, 0.55));
      glow(body.add(vec2((m ? -1 : 1) * 0.04, 0.08)), 0.9, glowColor(P.eye, 0.22));
      glow(body, 3.2, rgb(1, 0.75, 0.5, 0.1));
    });
  }
}

function dust(pos, count, scale = 1) {
  burst(pos, {
    tile: art.tiles.puff, color: rgb(1, 0.86, 0.8, 0.55), color2: rgb(0.9, 0.7, 0.85, 0.45),
    count, speed: 2.5 * scale, size: 0.35 * scale, sizeEnd: 0.7 * scale, life: 0.45, gravity: -0.05,
    cone: 1.2, angle: 0, spread: 0.4, additive: false, damping: 0.9,
  });
}

/* ------------------------------------------------------------------ bramblebug */

export class Bug extends LJS.EngineObject {
  constructor(pos) {
    super(pos, vec2(0.86, 0.56));
    this.setCollision(false, false, true);
    this.renderOrder = 15;
    this.dir = -1;
    this.walk = Math.random() * 10;
  }

  update() {
    const grid = world.grid;
    this.velocity.x = this.dir * K.bugSpeed;
    if (this.groundObject) {
      const ahead = this.pos.x + this.dir * 0.55;
      const row = Math.floor(this.pos.y - 0.28 + 0.05); // the open row the bug walks in
      const wall = grid.get(Math.floor(ahead), row) === 'solid';
      const noFloor = grid.get(Math.floor(ahead), row - 1) !== 'solid';
      const thorn = grid.get(Math.floor(ahead + this.dir * 0.2), row) === 'thorns';
      if (wall || noFloor || thorn) this.dir *= -1;
    }
    this.walk += 0.15;
    const p = world.game.player;
    if (p && !p.frozen && this.isOverlappingObject(p)) {
      if (p.velocity.y < 0.02 && p.pos.y > this.pos.y + 0.22) this.stomp(p);
      else p.hurt(this.pos);
    }
  }

  stomp(p) {
    const S = world.sounds;
    p.velocity.y = K.stompBounce + (input.down('jump') ? 0.06 : 0);
    p.jumping = true;
    p.cut = false;
    p.jumpTimer.set(K.jumpHoldTime * 0.5);
    p.squash = vec2(1.25, 0.8);
    S.stomp.play(this.pos);
    shake(0.18);
    hitStop(0.05);
    world.effects.stomp(this.pos.add(vec2(0, -0.28)));
    burst(this.pos, { tile: art.tiles.shard, color: hsl(0.8, 0.6, 0.55), color2: hsl(0.95, 0.9, 0.6), count: 12, speed: 7, size: 0.16, life: 0.6, gravity: 0.7, additive: false });
    popText('+50', this.pos.add(vec2(0, 0.6)), hsl(0.95, 0.9, 0.75));
    world.game.addScore(50, 'bug');
    this.destroy();
  }

  render() {
    const T = art.tiles;
    const f = Math.floor(this.walk) % 2;
    const sq = 1 + Math.sin(this.walk * 2) * 0.03;
    const body = this.pos.add(vec2(0, 0.06));
    LJS.drawTile(body.add(vec2(0, 0.08)), vec2(1.35 * sq, 0.96 / sq), T.bug[f], LJS.WHITE, 0, this.dir < 0);
    const eye = body.add(vec2(this.dir * 0.57, 0.1));
    additive(() => {
      glow(eye, 0.8, glowColor(P.bugEye, 0.75));
      glow(body, 2.2, rgb(0.8, 0.3, 0.6, 0.12)); // a faint menace so it reads against dark grass
    });
  }
}

/* ------------------------------------------------------------------ sunseed */

export class Seed extends LJS.EngineObject {
  constructor(pos) {
    super(pos, vec2(0.6));
    this.mass = 0;
    this.renderOrder = 12;
    this.home = pos.copy();
    this.phase = pos.x * 0.7;
  }

  update() {
    this.pos.y = this.home.y + Math.sin(LJS.time * 2.4 + this.phase) * 0.12;
    const p = world.game.player;
    if (p && !p.frozen && p.pos.distance(this.pos.add(vec2(0, 0))) < 0.75) {
      world.sounds.seed.play(this.pos, 1, 1 + (world.game.seedChain++ % 6) * 0.06);
      world.effects.seed(this.pos);
      burst(this.pos, { tile: art.tiles.glow, color: rgb(1, 0.85, 0.4, 0.35), count: 1, speed: 0, size: 1.6, sizeEnd: 3, life: 0.3 });
      popText('+100', this.pos.add(vec2(0, 0.5)), hsl(0.13, 1, 0.75));
      world.game.addScore(100, 'seed');
      this.destroy();
    }
  }

  render() {
    const pulse = 1 + Math.sin(LJS.time * 5 + this.phase) * 0.05;
    additive(() => glow(this.pos, 1.7 * pulse, rgb(1, 0.75, 0.3, 0.42)));
    LJS.drawTile(this.pos, vec2(0.62 * pulse), art.tiles.seed, LJS.WHITE, Math.sin(LJS.time * 2 + this.phase) * 0.15);
  }
}

/* ------------------------------------------------------------------ lantern post */

export class Lantern extends LJS.EngineObject {
  constructor(pos) {
    super(pos, vec2(1, 2));
    this.mass = 0;
    this.renderOrder = 5;
    this.lit = false;
    this.litAt = 0;
  }

  light() {
    if (this.lit) return;
    this.lit = true;
    this.litAt = LJS.time;
    world.sounds.checkpoint.play(this.pos);
    world.effects.lantern(this.lampPos());
    burst(this.lampPos(), { color: hsl(0.11, 1, 0.7), color2: hsl(0.06, 1, 0.6), count: 12, speed: 3, size: 0.1, life: 0.9, gravity: -0.05 });
  }

  lampPos() { return this.pos.add(vec2(0.26, 0.38)); }

  render() {
    LJS.drawTile(this.pos, vec2(1, 2), art.tiles.lantern);
    const t = this.lit ? Math.min(1, (LJS.time - this.litAt) * 3) : 0;
    const flicker = 1 + Math.sin(LJS.time * 13 + this.pos.x) * 0.04 + Math.sin(LJS.time * 7.3) * 0.03;
    additive(() => {
      glow(this.lampPos(), 0.5, rgb(1, 0.8, 0.5, 0.25 + 0.6 * t));
      if (t) glow(this.lampPos(), 3.4 * flicker, rgb(1, 0.6, 0.3, 0.32 * t));
    });
  }
}

/* ------------------------------------------------------------------ beacon */

export class Beacon extends LJS.EngineObject {
  constructor(pos) {
    super(pos, vec2(1.6, 5));
    this.mass = 0;
    this.renderOrder = 6;
    this.lit = false;
    this.litAt = 0;
  }

  crystalPos() { return this.pos.add(vec2(0, 2.95 + Math.sin(LJS.time * 1.8) * 0.08)); }

  ignite() {
    if (this.lit) return;
    this.lit = true;
    this.litAt = LJS.time;
    const c = this.crystalPos();
    world.sounds.win.play();
    shake(0.5);
    flash(rgb(1, 0.95, 0.8), 0.55);
    burst(c, { color: hsl(0.52, 1, 0.75), color2: hsl(0.12, 1, 0.7), count: 30, speed: 9, size: 0.4, life: 1.1, tile: art.tiles.glow, gravity: 0.12, damping: 0.95 });
    burst(c, { tile: art.tiles.glow, color: rgb(0.6, 0.95, 1, 0.8), count: 1, speed: 0, size: 2, sizeEnd: 12, life: 0.6 });
    world.effects.celebrate(c, this.pos.y - 2.5);
  }

  render() {
    const T = art.tiles;
    LJS.drawTile(this.pos.add(vec2(0, 0.0)), vec2(1.6, 5), T.stone);
    const c = this.crystalPos();
    const t = this.lit ? Math.min(1, (LJS.time - this.litAt) * 2) : 0;
    const idle = 0.5 + 0.5 * Math.sin(LJS.time * 2);
    additive(() => {
      glow(c, 1.8 + idle * 0.3, rgb(0.5, 0.9, 1, 0.22 + 0.5 * t));
      if (t) {
        LJS.drawTile(c.add(vec2(0, 7)), vec2(1.6 + t, 14), T.beam, rgb(0.6, 0.95, 1, 0.55 * t));
        glow(c, 8 * t, rgb(0.5, 0.85, 1, 0.35 * t));
      }
    });
    LJS.drawTile(c, vec2(0.62, 0.95), T.crystal, this.lit ? LJS.WHITE : rgb(0.6, 0.7, 0.85), 0);
  }
}
