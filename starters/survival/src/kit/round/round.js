/**
 * The round of a survivors-like: title, a clock to outlast, a spawn director
 * that ramps the horde, timed surges, a mini-boss near the end, win when the
 * clock runs out with you standing, lose at zero health, restart.
 *
 * The director works in fractions of the round (0 at the start, 1 at the bell),
 * so a shorter round (window.__ROUND_SECONDS__, set only by the playtest plan)
 * plays the same arc compressed. Its shape follows the spawner in
 * VictorZakharov/void-harvest-game (MIT, 8d9109d): enemies appear on a ring
 * just outside the view, on angles that stay inside the map, and the mix of
 * kinds and their health grow with time. Rewritten, not copied.
 *
 * rules = {
 *   title, kicker, tagline, startLabel, controls, credits,
 *   seconds, start: ['weapon id'],
 *   director: {
 *     alive: [[f, n]...]   how many should be out, by fraction (linear between points)
 *     rate:  [[f, n]...]   at most n spawns a second
 *     hp:    [[f, k]...]   health multiplier
 *     mix:   [[f, { type: weight }]...]   which kinds, from fraction f on
 *     ring:  [min, max]    spawn distance from the player
 *     events: [{ at, type, count, radius, banner, sub }]   a ring closing in all at once
 *     boss: { at, type, banner, sub }
 *   },
 *   drops: [{ kind, chance }], xp(def) -> gem value,
 *   winScreen, loseScreen: { kicker, title, text, action }
 * }
 */
const curve = (pts, f) => {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) {
      const [f0, v0] = pts[i - 1];
      const [f1, v1] = pts[i];
      return v0 + (v1 - v0) * ((f - f0) / (f1 - f0 || 1));
    }
  }
  return pts[pts.length - 1][1];
};

export class RoundSystem {
  static id = 'round';
  static deps = ['player', 'arsenal', 'horde', 'gems', 'hud', 'audio', 'fx', 'pickups', 'camera', 'levelup'];

  constructor({ rules }) {
    this.rules = rules;
  }

  init(ctx) {
    this.ctx = ctx;
    this.hud = ctx.get('hud');
    this.player = ctx.get('player');
    this.horde = ctx.get('horde');
    this.audio = ctx.get('audio');
    this.rng = ctx.rng.fork();
    this.state = 'title';
    this.elapsed = 0;
    this.duration = this._duration();
    this.score = 0;
    this.killed = 0;
    this.level = null;
    this.spawnBudget = 0;
    this.fired = new Set();

    ctx.events.on('player:died', () => this._end('lost'));
    ctx.events.on('player:step', (e) => this.audio.play('step', e));
    ctx.events.on('enemy:killed', (e) => {
      if (this.state !== 'playing') return;
      this.killed++;
      this.score = this.killed;
      this.hud.setScore(this.score);
      const value = this.rules.xp ? this.rules.xp(e.def) : (e.def.xp ?? 1);
      if (value > 0) ctx.get('gems').drop(e.x, e.z, value);
      for (const d of this.rules.drops ?? []) {
        if (this.rng.float() < d.chance) {
          ctx.get('pickups').spawn(d.kind, e.x, e.z);
          break;
        }
      }
      this.rules.onKill?.(e, ctx);
    });
    this.hud.onAction = () => this.primaryAction();
  }

  _duration() {
    const test = typeof window !== 'undefined' ? Number(window.__ROUND_SECONDS__) : NaN;
    return Number.isFinite(test) && test > 0 ? test : (this.rules.seconds ?? 300);
  }

  setLevel(level) {
    this.level = level;
    this.player.reset(level.playerSpawn, level.playerYaw ?? 0);
    this.ctx.input.captureGameplay = false;
    this.ctx.get('camera').offset = level.titleOffset ?? null;
    this.ctx.get('camera').snap();
    // a few of them waiting at the edge of the light behind the title (cleared on start)
    const p = this.player;
    for (const [type, dx, dz] of level.titleCrowd ?? []) {
      const e = this.horde.spawn(type, p.x + dx, p.z + dz);
      if (e) e.yaw = Math.atan2(-dx, -dz);
    }
    this._title();
  }

  _title() {
    const r = this.rules;
    this.hud.showScreen({ kicker: r.kicker, title: r.title, text: r.tagline, action: r.startLabel ?? 'Start', small: r.controls, credits: r.credits });
  }

  primaryAction() {
    this.audio.unlock();
    this.start();
  }

  start() {
    const c = this.ctx;
    this.duration = this._duration();
    this.horde.clear();
    c.get('gems').clear();
    c.get('pickups').clear();
    c.get('fx').clear();
    c.peek('pixelfx')?.clear();
    c.get('levelup').reset();
    c.get('arsenal').reset(this.rules.start ?? []);
    this.player.reset(this.level.playerSpawn, this.level.playerYaw ?? 0);
    this.player.health = this.player.maxHealth;
    this.player.controlEnabled = true;
    this.player.scriptedCamera = false;
    c.input.captureGameplay = true;
    c.input.showTouch(true);
    c.time.scale = 1;
    c.get('camera').heading = this.level.cameraHeading ?? 0;
    c.get('camera').offset = null;
    c.get('camera').snap();
    this.state = 'playing';
    this.elapsed = 0;
    this.score = 0;
    this.killed = 0;
    this.spawnBudget = 2;
    this.fired = new Set();
    this.hud.setScore(0);
    this.hud.hideScreen();
    const d = this.rules.director;
    this.hud.showBanner(d.openBanner ?? this.rules.title, 2.4, d.openSub ?? '');
    this.audio.play('wave');
    c.events.emit('round:state', { state: this.state });
  }

  get fraction() {
    return Math.min(1, this.elapsed / this.duration);
  }

  /** Fewer at once in a shortened test round, so the same arc stays fair. */
  get density() {
    return Math.max(0.45, Math.min(1, Math.sqrt(this.duration / (this.rules.seconds ?? 300))));
  }

  _ringPoint(min, max) {
    const p = this.player;
    const f = this.ctx.get('arena').field;
    const pad = 1.5;
    for (let i = 0; i < 16; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(min, max);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (x > f.minX + pad && x < f.maxX - pad && z > f.minZ + pad && z < f.maxZ - pad) return [x, z];
    }
    const a = this.rng.range(0, Math.PI * 2);
    return [Math.min(f.maxX - pad, Math.max(f.minX + pad, p.x + Math.cos(a) * max)), Math.min(f.maxZ - pad, Math.max(f.minZ + pad, p.z + Math.sin(a) * max))];
  }

  _pickType(f) {
    let mix = this.rules.director.mix[0][1];
    for (const [at, m] of this.rules.director.mix) if (f >= at) mix = m;
    let total = 0;
    for (const w of Object.values(mix)) total += w;
    let r = this.rng.float() * total;
    for (const [type, w] of Object.entries(mix)) {
      r -= w;
      if (r <= 0) return type;
    }
    return Object.keys(mix)[0];
  }

  _end(state) {
    if (this.state !== 'playing') return;
    this.state = state;
    const c = this.ctx;
    c.time.scale = 1;
    this.player.controlEnabled = false;
    c.input.captureGameplay = false;
    c.input.showTouch(false);
    c.get('levelup').close();
    if (state === 'won') {
      // the bell: everything still out there sinks back into the ground
      for (const e of [...this.horde.alive]) this.horde._kill(e, 0, 0);
    }
    this.audio.play(state === 'won' ? 'win' : 'lose');
    const r = this.rules;
    const screen = state === 'won' ? r.winScreen : r.loseScreen;
    const text = typeof screen.text === 'function' ? screen.text(this) : screen.text;
    const t = Math.min(this.elapsed, this.duration);
    const lu = c.get('levelup');
    this.hud.showScreen({ kicker: screen.kicker, title: screen.title, text, action: screen.action ?? 'Play again', small: `${this.killed} taken  ·  level ${lu.level}  ·  ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} survived`, credits: r.credits });
    c.events.emit('round:state', { state });
  }

  update(dt) {
    const cam = this.ctx.get('camera');
    if (this.state === 'title') {
      cam.heading = (this.level?.cameraHeading ?? 0) + Math.sin(this.ctx.time.raw * 0.12) * 0.3;
      cam.offset = this.level?.titleOffset ?? null;
    } else cam.offset = null;
    if (this.state !== 'playing' || dt <= 0) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this._end('won');
      return;
    }
    const f = this.fraction;
    const d = this.rules.director;
    const h = this.horde;

    // timed moments: a closing ring, then the boss
    for (const [i, ev] of (d.events ?? []).entries()) {
      if (f < ev.at || this.fired.has(i)) continue;
      this.fired.add(i);
      const n = Math.round(ev.count * this.density);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const [x, z] = this._clamp(this.player.x + Math.cos(a) * ev.radius, this.player.z + Math.sin(a) * ev.radius);
        h.spawn(ev.type, x, z, { hp: curve(d.hp, f) });
      }
      if (ev.banner) this.hud.showBanner(ev.banner, 2.4, ev.sub ?? '');
      this.audio.play('surge');
    }
    if (d.boss && f >= d.boss.at && !this.fired.has('boss')) {
      this.fired.add('boss');
      const [x, z] = this._ringPoint(d.ring[1] - 2, d.ring[1]);
      h.spawn(d.boss.type, x, z, { hp: this.density });
      this.hud.showBanner(d.boss.banner, 3, d.boss.sub ?? '');
      this.audio.play('bossrise');
      cam.shake(0.5);
    }

    // keep the field topped up to the target, no faster than the rate
    const target = Math.round(curve(d.alive, f) * this.density);
    this.spawnBudget = Math.min(6, this.spawnBudget + curve(d.rate, f) * dt);
    while (this.spawnBudget >= 1 && h.alive.length < target) {
      this.spawnBudget -= 1;
      const type = this._pickType(f);
      const [x, z] = this._ringPoint(d.ring[0], d.ring[1]);
      if (!h.spawn(type, x, z, { hp: curve(d.hp, f) })) break;
    }
  }

  _clamp(x, z) {
    const fl = this.ctx.get('arena').field;
    return [Math.min(fl.maxX - 1, Math.max(fl.minX + 1, x)), Math.min(fl.maxZ - 1, Math.max(fl.minZ + 1, z))];
  }
}
