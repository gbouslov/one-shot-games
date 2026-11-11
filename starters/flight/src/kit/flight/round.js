import * as THREE from 'three';
import { FlightModel } from './model.js';
import { Autopilot } from './autopilot.js';

/**
 * A round of course flying: fly the gates in order against a clock, with a
 * few lives. Owns the flight model, the bot, the clock, gate crossing, crashes
 * and respawns. Visuals and sound listen to its events:
 *
 *   events: 'round:start', 'round:gate' {index, pos, last}, 'round:crash' {pos, water},
 *           'round:respawn', 'round:won' {score}, 'round:lost' {reason}
 *
 * States: 'title' (the bot flies an attract lap behind the title), 'playing',
 * 'won', 'lost'. Game time only (clamped dt), never frame counts.
 *
 * Options (from src/game/rules.js):
 *   lives, timeLimit (seconds) or timePerMetre, crashDelay, flight (FlightModel params),
 *   course: { gates: [{ pos, normal, radius }], start: { pos, heading } }, ground(x, z)
 *
 * Written for this repository.
 */
export class RoundSystem {
  static id = 'round';
  static deps = ['audio'];

  constructor({ rules }) {
    this.rules = rules;
  }

  init(ctx) {
    this.ctx = ctx;
    this.model = new FlightModel(this.rules.flight);
    this.state = 'title';
    this.autoplay = false;
    this.elapsed = 0;
    this.clock = 0;
    this.lives = this.rules.lives ?? 3;
    this.gate = 0;
    this.score = 0;
    this.crashed = false;
    this.crashT = 0;
    this.crashes = 0;
    this.warning = '';
    this.course = null;
  }

  /** Called once the game has built the course and the ground. */
  setCourse(course, ground) {
    this.course = course;
    this.ground = ground;
    this.bot = new Autopilot(this.ctx.input, { ground, keys: this.model.p.keys, ...(this.rules.bot ?? {}) });
    const len = course.gates.reduce((s, g, i) => s + g.pos.distanceTo(i ? course.gates[i - 1].pos : course.start.pos), 0);
    this.courseLength = len;
    this.timeLimit = this.rules.timeLimit ?? Math.ceil(len / (this.rules.paceMetresPerSecond ?? 58) / 5) * 5 + 10;
    this._reset();
    this.state = 'title';
  }

  _reset() {
    const s = this.course.start;
    this.model.reset(s.pos, s.heading, this.rules.startSpeed ?? 95, this.rules.startThrottle ?? 0.72);
    this.gate = 0;
    this.lives = this.rules.lives ?? 3;
    this.clock = this.timeLimit;
    this.elapsed = 0;
    this.score = 0;
    this.crashed = false;
    this.crashT = 0;
    this.warning = '';
  }

  start() {
    this._reset();
    this.ctx.input.clearSource('bot');
    if (this.bot) this.bot.recover = false;
    this.state = 'playing';
    this.ctx.events.emit('round:start', {});
  }

  lose(reason = 'debug') {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.reason = reason;
    this.ctx.input.clearSource('bot');
    this.ctx.events.emit('round:lost', { reason });
  }

  setAutoplay(on) {
    this.autoplay = !!on;
    if (!on) this.ctx.input.clearSource('bot');
  }

  get nextGate() {
    if (!this.course) return null;
    return this.course.gates[this.gate] ?? null;
  }

  /** The bot flies in the title attract, after a win, and when autoplay is on. */
  _botFlying() {
    if (this.crashed) return false;
    if (this.state === 'playing') return this.autoplay;
    return this.state === 'title' || this.state === 'won';
  }

  beginFrame() {
    if (!this.course || !this._botFlying()) return;
    const gates = this.course.gates;
    const g = gates[this.gate % gates.length];
    this.bot.update(this.model, g);
  }

  fixedUpdate(dt) {
    if (!this.course) return;
    const m = this.model;
    const playing = this.state === 'playing';
    if (playing) {
      this.elapsed += dt;
      this.clock = Math.max(0, this.clock - dt);
      if (this.clock <= 0) {
        this.lose('time');
        return;
      }
    }
    if (this.crashed) {
      this.crashT += dt;
      if (this.crashT >= (this.rules.crashDelay ?? 1.8)) {
        if (playing && this.lives <= 0) this.lose('crashes');
        else this._respawn();
      }
      return;
    }
    if (this.state === 'lost') return;

    m.step(dt, this.ctx.input);
    this._checkGate();

    const ground = Math.max(this.ground(m.position.x, m.position.z), 0);
    const agl = m.position.y - ground;
    this.agl = agl;
    this.warning = m.stalled ? 'STALL' : agl < 45 && m.fwd.y < -0.05 ? 'PULL UP' : m.leaving ? 'TURN BACK' : '';
    if (agl < 1.4) this._crash(ground <= 0.01);
  }

  _checkGate() {
    const g = this.nextGate;
    if (!g) return;
    const m = this.model;
    const lp = this._tmp1 ??= new THREE.Vector3();
    const lc = this._tmp2 ??= new THREE.Vector3();
    const a = lp.subVectors(m.prevPosition, g.pos).dot(g.normal);
    const b = lc.subVectors(m.position, g.pos).dot(g.normal);
    if (!(a < 0 && b >= 0)) return;
    const t = a / (a - b);
    const hit = lp.copy(m.prevPosition).lerp(m.position, t);
    if (hit.distanceTo(g.pos) > g.radius) return;
    const index = this.gate;
    const total = this.course.gates.length;
    this.gate++;
    if (this.bot) this.bot.recover = false;
    const last = this.gate >= total;
    if (this.state === 'playing') {
      this.score = this.gate * 100;
      this.ctx.events.emit('round:gate', { index, pos: g.pos, last, total });
      if (last) {
        this.score = this.gate * 100 + Math.round(this.clock * 10) + this.lives * 250;
        this.state = 'won';
        this.ctx.events.emit('round:won', { score: this.score, time: this.elapsed });
      }
    } else {
      this.ctx.events.emit('round:gate', { index, pos: g.pos, last: false, total, attract: true });
      if (last) this.gate = 0; // attract and victory laps go round again
    }
  }

  _crash(water) {
    this.crashed = true;
    this.crashT = 0;
    this.crashes++;
    if (this.state === 'playing') this.lives--;
    this.ctx.events.emit('round:crash', { pos: this.model.position.clone(), water, lives: this.lives });
  }

  _respawn() {
    const gates = this.course.gates;
    const prev = this.gate > 0 ? gates[(this.gate - 1) % gates.length] : null;
    const next = gates[this.gate % gates.length];
    const from = prev ? prev.pos : this.course.start.pos;
    const p = from.clone();
    p.y = Math.max(p.y, Math.max(0, this.ground(p.x, p.z)) + 90);
    const heading = Math.atan2(next.pos.x - p.x, -(next.pos.z - p.z));
    // Start a little back along the line so the next gate is straight ahead.
    p.x -= Math.sin(heading) * 60;
    p.z += Math.cos(heading) * 60;
    p.y = Math.max(p.y, Math.max(0, this.ground(p.x, p.z)) + 90);
    this.model.reset(p, heading, 95, Math.max(0.72, this.model.throttle));
    this.crashed = false;
    if (this.bot) this.bot.recover = false;
    this.ctx.events.emit('round:respawn', {});
  }
}
