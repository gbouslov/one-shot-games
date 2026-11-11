import { RunnerBody } from './body.js';
import { Track } from './track.js';
import { buildCourse } from './course.js';
import { RunnerBot } from './bot.js';

/**
 * A round of a lane runner: the runner runs a bending, dipping path at a
 * speed that ramps with distance, changes lane, jumps and slides past rows of
 * obstacles, picks up what lies in the lanes, and wins on reaching the goal
 * distance. Each obstacle struck costs a heart (or ends the round, if its kind
 * is `fatal`); the round is lost when the hearts run out. Owns the track, the
 * course, the body, hits, score and the bot. Visuals and sound listen to its
 * events:
 *
 *   'round:start', 'round:won' {score, time, ...}, 'round:lost' {reason}
 *   'runner:lane' {from, to}, 'runner:jump', 'runner:land' {vy}, 'runner:slide', 'runner:drop'
 *   'runner:hit' {o, hearts}, 'pickup' {p, combo}, 'milestone' {m}
 *   'round:loop'                         the title run looped back to the start
 *
 * States: 'title' (the runner jogs the opening stretch, no hits), 'playing',
 * 'won', 'lost'. Game time only (clamped dt on the engine's fixed step),
 * never frame counts.
 *
 * Rules (src/game/rules.js): goal, hearts, speed {start, max, rampTo},
 * body {...RunnerBody params}, track {...Track params}, obstacles, course,
 * scores, bot. See the default game for the shape.
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
    const R = this.rules;
    this.track = new Track({ length: R.goal + 200, ...R.track });
    this.body = new RunnerBody({ ...R.body });
    this.bot = new RunnerBot(ctx.input, R.bot);
    this.rng = ctx.rng.fork();
    this.state = 'title';
    this.autoplay = false;
    this.god = false;
    this.course = { obstacles: [], pickups: [] };
    this._reset();
  }

  get goal() {
    return this.rules.goal;
  }

  /** Speed at distance s: eases from start to max by rampTo metres. */
  speedAt(s) {
    const S = this.rules.speed;
    const t = Math.max(0, Math.min(1, s / (S.rampTo ?? this.rules.goal)));
    return S.start + (S.max - S.start) * (t * (2 - t) * 0.5 + t * 0.5);
  }

  _reset() {
    this.body.reset(0);
    this.hearts = this.rules.hearts ?? 3;
    this.elapsed = 0;
    this.score = 0;
    this.embers = 0;
    this.combo = 0;
    this.comboT = 0;
    this.hits = 0;
    this.invuln = 0;
    this.slow = 0;
    this.cursor = 0;
    this.pcursor = 0;
    this.milestone = 0;
    this.dead = false;
    this.endT = 0;
  }

  start() {
    this._reset();
    this.course = buildCourse(this.rules, this.rng, (s) => this.speedAt(s));
    this.ctx.input.clearSource('bot');
    this.ctx.input.clearEdges();
    this.state = 'playing';
    this.ctx.events.emit('round:start', { course: this.course });
  }

  lose(reason = 'debug') {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.reason = reason;
    this.dead = true;
    this.ctx.input.clearSource('bot');
    this.ctx.events.emit('round:lost', { reason, distance: this.body.s, goal: this.goal, embers: this.embers, score: this.score });
  }

  _win() {
    const R = this.rules;
    this.score += this.hearts * (R.scores?.heart ?? 500);
    this.state = 'won';
    this.ctx.input.clearSource('bot');
    this.ctx.events.emit('round:won', { score: this.score, time: this.elapsed, hearts: this.hearts, embers: this.embers, total: this.course.pickups.length });
  }

  setAutoplay(on) {
    this.autoplay = !!on;
    if (!on) this.ctx.input.clearSource('bot');
  }

  beginFrame() {
    if (this.state === 'playing' && this.autoplay && !this.dead) this.bot.update(this);
  }

  /** Obstacles ahead of s within `ahead` metres (the bot and the art read this). */
  ahead(s, ahead) {
    const out = [];
    const list = this.course.obstacles;
    for (let i = this.cursor; i < list.length; i++) {
      const o = list[i];
      if (o.s > s + ahead) break;
      if (o.s + o.depth >= s - 1) out.push(o);
    }
    return out;
  }

  fixedUpdate(dt) {
    const R = this.rules;
    const b = this.body;
    const input = this.ctx.input;
    if (this.state === 'title') {
      b.step(dt, {}, R.attractSpeed ?? 9);
      if (b.s > (R.attractLength ?? 110)) {
        b.reset(0);
        this.ctx.events.emit('round:loop', {});
      }
      this._emit();
      return;
    }
    if (this.state === 'won' || this.state === 'lost') {
      // Coast to a stop after the line; stand still after a fall.
      this.endT += dt;
      const v = this.state === 'won' ? Math.max(0, b.speed - dt * 14) : 0;
      b.step(dt, {}, v);
      this._emit();
      return;
    }

    this.elapsed += dt;
    const press = {
      left: input.take('ArrowLeft', 'KeyA'),
      right: input.take('ArrowRight', 'KeyD'),
      jump: input.take('ArrowUp', 'KeyW', 'Space'),
      slide: input.take('ArrowDown', 'KeyS'),
    };
    this.invuln = Math.max(0, this.invuln - dt);
    this.slow = Math.max(0, this.slow - dt);
    const base = this.speedAt(b.s);
    const speed = base * (1 - (R.stumbleSlow ?? 0.35) * Math.min(1, this.slow / 0.6));
    const prevS = b.s;
    b.step(dt, press, speed);
    this._emit();

    // Distance score, combo decay, milestones.
    this.score += (b.s - prevS) * (R.scores?.metre ?? 1);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    const every = R.milestoneEvery ?? 250;
    if (Math.floor(b.s / every) > this.milestone) {
      this.milestone = Math.floor(b.s / every);
      if (this.milestone * every < this.goal) this.ctx.events.emit('milestone', { m: this.milestone * every, left: this.goal - this.milestone * every });
    }

    this._collide(prevS);
    this._pickups();
    if (this.state === 'playing' && b.s >= this.goal) this._win();
    this.score = Math.round(this.score * 100) / 100;
  }

  _emit() {
    for (const e of this.body.drain()) this.ctx.events.emit(`runner:${e.type}`, e);
  }

  _collide(prevS) {
    const b = this.body;
    const P = b.p;
    const list = this.course.obstacles;
    while (this.cursor < list.length && list[this.cursor].s + list[this.cursor].depth < b.s - 2) this.cursor++;
    const half = (P.lanes - 1) / 2;
    const reach = (this.rules.hitDepth ?? 0.35);
    for (let i = this.cursor; i < list.length; i++) {
      const o = list[i];
      if (o.s - reach > b.s) break;
      if (o.hit || o.s + o.depth + reach < prevS) continue;
      // Across: the body's span against the lanes the obstacle fills.
      let across = true;
      if (o.lanes) {
        across = false;
        const hw = (o.halfWidth ?? P.laneWidth * 0.42);
        for (const l of o.lanes) if (Math.abs(b.x - l * P.laneWidth) < hw + P.halfWidth) across = true;
      } else if (Math.abs(b.x) > half * P.laneWidth + P.laneWidth * 0.5) across = false;
      if (!across) continue;
      // Up: the body's span against the obstacle's.
      if (b.y >= o.y1 || b.top <= o.y0) continue;
      this._hit(o);
    }
  }

  _hit(o) {
    const R = this.rules;
    o.hit = true;
    if (this.invuln > 0 || this.god) {
      this.ctx.events.emit('runner:graze', { o });
      return;
    }
    const fatal = R.obstacles[o.kind]?.fatal;
    this.hearts = fatal ? 0 : this.hearts - 1;
    this.hits++;
    this.combo = 0;
    this.invuln = R.invulnerable ?? 1.2;
    this.slow = R.stumbleTime ?? 0.6;
    this.body.knock(R.stumbleTime ?? 0.6);
    this.ctx.events.emit('runner:hit', { o, hearts: this.hearts });
    if (this.hearts <= 0) this.lose(fatal ? o.kind : 'hits');
  }

  _pickups() {
    const b = this.body;
    const P = b.p;
    const list = this.course.pickups;
    while (this.pcursor < list.length && list[this.pcursor].s < b.s - 3) this.pcursor++;
    for (let i = this.pcursor; i < list.length; i++) {
      const p = list[i];
      if (p.s > b.s + 1.2) break;
      if (p.taken || Math.abs(p.s - b.s) > 1.1) continue;
      if (Math.abs(p.lane * P.laneWidth - b.x) > P.laneWidth * 0.55) continue;
      if (p.y < b.y - 0.4 || p.y > b.top + 0.5) continue;
      p.taken = true;
      this.embers++;
      this.combo++;
      this.comboT = this.rules.comboTime ?? 1.4;
      this.score += (this.rules.scores?.pickup ?? 10) * Math.min(this.combo, 10);
      this.ctx.events.emit('pickup', { p, combo: this.combo });
    }
  }
}
