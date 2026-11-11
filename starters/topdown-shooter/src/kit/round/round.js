/**
 * The round as a player sees it: title, waves, a short breather between them,
 * win or lose, restart. Rules come from src/game/rules.js, the place from
 * src/game/level.js. A plain state machine, so the playtest can read it.
 *
 * rules = {
 *   title, kicker, tagline, startLabel, controls,
 *   waves: [{ enemies: [{ type, count }], interval, label, sub }],
 *   breakSeconds, maxAlive, minSpawnDistance,
 *   drops: [{ kind, chance }],
 *   winScreen: { kicker, title, text, action }, loseScreen: { ... },
 *   onWave(i, ctx), onKill(e, ctx)
 * }
 */
export class RoundSystem {
  static id = 'round';
  static deps = ['player', 'weapons', 'enemies', 'hud', 'audio', 'fx', 'pickups', 'camera'];

  constructor({ rules }) {
    this.rules = rules;
  }

  init(ctx) {
    this.ctx = ctx;
    this.hud = ctx.get('hud');
    this.player = ctx.get('player');
    this.enemies = ctx.get('enemies');
    this.weapons = ctx.get('weapons');
    this.audio = ctx.get('audio');
    this.rng = ctx.rng.fork();
    this.state = 'title';
    this.wave = -1;
    this.queue = [];
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.elapsed = 0;
    this.score = 0;
    this.killed = 0;
    this.level = null;

    ctx.events.on('player:died', () => this._end('lost'));
    ctx.events.on('player:step', (e) => this.audio.play('step', e));
    ctx.events.on('player:dash', (e) => {
      this.audio.play('dash');
      ctx.get('fx').burst([e.x, 0.15, e.z], { count: 10, color: '#8b8278', speed: 2.5, life: 0.5, size: 0.25, gravity: 0.6, additive: false, dir: [-e.dx, 0.3, -e.dz], spread: 0.9, grow: 1 });
    });
    ctx.events.on('enemy:killed', (e) => {
      if (this.state !== 'playing') return;
      this.killed++;
      const pts = e.def.score ?? 100;
      this.score += pts;
      this.hud.setScore(this.score, pts);
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

  setLevel(level) {
    this.level = level;
    this.player.reset(level.playerSpawn, level.playerYaw ?? 0);
    this.ctx.input.captureGameplay = false;
    this.ctx.get('camera').snap();
    this._title();
  }

  _title() {
    const r = this.rules;
    this.hud.showScreen({ kicker: r.kicker, title: r.title, text: r.tagline, action: r.startLabel ?? 'Start', small: r.controls });
  }

  /** The overlay was clicked or Enter was pressed: start or restart. */
  primaryAction() {
    this.audio.unlock();
    this.start();
  }

  start() {
    const c = this.ctx;
    this.enemies.clear();
    this.weapons.resetRound();
    c.get('pickups').clear();
    c.get('fx').clear();
    c.peek('pixelfx')?.clear();
    this.player.reset(this.level.playerSpawn, this.level.playerYaw ?? 0);
    this.player.controlEnabled = true;
    this.player.scriptedCamera = false;
    c.input.captureGameplay = true;
    c.input.showTouch(true);
    c.time.scale = 1;
    c.get('camera').heading = this.level.cameraHeading ?? 0;
    c.get('camera').snap();
    this.state = 'playing';
    this.wave = -1;
    this.queue = [];
    this.elapsed = 0;
    this.score = 0;
    this.killed = 0;
    this.breakTimer = 0;
    this.hud.setScore(0);
    this.hud.hideScreen();
    this._nextWave();
    c.events.emit('round:state', { state: this.state });
  }

  get totalWaves() {
    return this.rules.waves.length;
  }

  _nextWave() {
    this.wave++;
    const def = this.rules.waves[this.wave];
    this.queue = [];
    for (const g of def.enemies) for (let i = 0; i < g.count; i++) this.queue.push(g.type);
    // interleave types so a wave is not all of one kind in a row
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.waveSize = this.queue.length;
    this.spawnTimer = 0.6;
    this.spawnInterval = def.interval ?? 0.8;
    this.hud.showBanner(def.label ?? `Wave ${this.wave + 1}`, 2.2, def.sub ?? '');
    this.audio.play('wave');
    this.rules.onWave?.(this.wave, this.ctx);
    this.ctx.events.emit('round:wave', { wave: this.wave });
  }

  _pickSpawn() {
    const p = this.player;
    const pts = this.level.enemySpawns;
    const min = this.rules.minSpawnDistance ?? 10;
    const far = pts.filter((s) => Math.hypot(s[0] - p.x, s[1] - p.z) > min);
    const s = this.rng.pick(far.length ? far : pts);
    return [s[0] + this.rng.signed() * 0.8, s[1] + this.rng.signed() * 0.8];
  }

  _end(state) {
    if (this.state !== 'playing') return;
    this.state = state;
    if (state === 'won') this.player.controlEnabled = false;
    this.ctx.input.captureGameplay = false;
    this.ctx.input.showTouch(false);
    this.audio.play(state === 'won' ? 'win' : 'lose');
    const r = this.rules;
    const screen = state === 'won' ? r.winScreen : r.loseScreen;
    const text = typeof screen.text === 'function' ? screen.text(this) : screen.text;
    this.hud.showScreen({ kicker: screen.kicker, title: screen.title, text, action: screen.action ?? 'Play again', small: `Score ${this.score}  ·  ${this.killed} down  ·  ${this.elapsed.toFixed(0)} s` });
    this.ctx.events.emit('round:state', { state });
  }

  update(dt) {
    const cam = this.ctx.get('camera');
    if (this.state === 'title') {
      // the title drifts slowly over the live scene
      cam.heading = (this.level?.cameraHeading ?? 0) + Math.sin(this.ctx.time.elapsed * 0.12) * 0.35;
    }
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const left = this.queue.length + this.enemies.alive.length;
    this.hud.setWave(this.rules.waveLabel ?? 'Wave', `${String(this.wave + 1).padStart(2, '0')}<em>/ ${String(this.totalWaves).padStart(2, '0')}</em>`, `${left} left`, this.waveSize ? left / this.waveSize : 0);

    if (this.queue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.alive.length < (this.rules.maxAlive ?? 16)) {
        this.spawnTimer = this.spawnInterval;
        const type = this.queue.shift();
        const s = this._pickSpawn();
        this.enemies.spawn(type, s[0], s[1]);
      }
      return;
    }
    if (this.enemies.alive.length) return;
    if (this.wave + 1 >= this.totalWaves) {
      this._end('won');
      return;
    }
    this.breakTimer += dt;
    if (this.breakTimer >= (this.rules.breakSeconds ?? 2.5)) {
      this.breakTimer = 0;
      this._nextWave();
    }
  }
}
