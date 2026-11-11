/**
 * The game loop as a player sees it: title, waves, win or lose, restart.
 * Rules come from src/game/rules.js. Everything is a plain state machine so the
 * playtest tool can read it from window.__GAME__.
 */
export class RoundSystem {
  static id = 'round';
  static deps = ['player', 'weapons', 'enemies', 'hud', 'audio', 'fx'];

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
    this.state = 'title';
    this.wave = -1;
    this.queue = [];
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.elapsed = 0;
    this.level = null;
    this.introT = 0;
    this._introShown = false;

    ctx.events.on('player:died', () => this._end('lost'));
    ctx.events.on('player:step', (e) => this.audio.play('step', e));
    ctx.events.on('player:jump', () => this.audio.play('jump'));
    ctx.events.on('player:land', () => this.audio.play('land'));

    this.hud.onAction = () => this.primaryAction();
    document.addEventListener('pointerlockchange', () => this._onLockChange());
  }

  setLevel(level) {
    this.level = level;
    this.player.reset(level.playerSpawn, level.playerYaw ?? 0);
    this.ctx.input.captureGameplay = false;
    this.player.update(0, this.ctx);
    const r = this.rules;
    this.hud.showScreen({ title: r.title, text: r.tagline, action: r.startLabel ?? 'Click to play', small: r.controls });
  }

  /** The overlay was clicked: start, resume or restart. */
  primaryAction() {
    this.audio.unlock();
    const input = this.ctx.input;
    input.captureGameplay = true;
    input.requestPointerLock();
    if (this.state === 'paused') {
      this.state = 'playing';
      this.ctx.time.scale = 1;
      this.player.controlEnabled = true;
      this.hud.hideScreen();
      return;
    }
    this.start();
  }

  start() {
    const c = this.ctx;
    this.enemies.clear();
    this.weapons.resetRound();
    c.get('fx').clear();
    this.player.reset(this.level.playerSpawn, this.level.playerYaw ?? 0);
    this.player.controlEnabled = true;
    this.player.scriptedCamera = false;
    c.input.captureGameplay = true;
    c.time.scale = 1;
    this.state = 'playing';
    this.wave = -1;
    this.queue = [];
    this.elapsed = 0;
    this.hud.hideScreen();
    this.rules.onStart?.(c);
    this._nextWave();
    // Optional map intro (rules.intro): a card over a short camera fly-in, first start only.
    // Any move, look or fire input skips it, so it never costs a player control.
    const intro = this.rules.intro;
    if (intro && !this._introShown && this.hud.shooter) {
      this._introShown = true;
      this.introT = this.introLen = intro.seconds ?? 4;
      this.spawnTimer += this.introT;
      this.player.scriptedCamera = true;
      this.hud.shooter.intro(intro, this.introT);
      this.hud.el.bn.style.visibility = 'hidden';
    }
    c.events.emit('round:state', { state: this.state });
  }

  _endIntro() {
    if (this.introT > 0) this.spawnTimer = Math.min(this.spawnTimer, 0.6);
    this.introT = 0;
    this.player.scriptedCamera = false;
    this.hud.shooter?.endIntro();
    this.hud.el.bn.style.visibility = '';
  }

  _stepIntro(dt) {
    const input = this.ctx.input;
    const m = input.moveVector();
    if (input.fire || input.aim || Math.abs(input.look.x) + Math.abs(input.look.y) > 0.002 || Math.abs(m.x) + Math.abs(m.y) > 0) {
      this._endIntro();
      return;
    }
    this.introT -= dt;
    if (this.introT <= 0) { this._endIntro(); return; }
    const path = this.rules.intro.path;
    if (!path) return;
    const t = 1 - this.introT / this.introLen;
    const k = t * t * (3 - 2 * t);
    const cam = this.ctx.camera;
    const eye = this.player.eye;
    const [from, look] = path;
    cam.position.set(from[0] + (eye.x - from[0]) * k, from[1] + (eye.y - from[1]) * k, from[2] + (eye.z - from[2]) * k);
    const f = this.player.forward;
    const lx = look[0] + (eye.x + f.x * 10 - look[0]) * k;
    const ly = look[1] + (eye.y + f.y * 10 - look[1]) * k;
    const lz = look[2] + (eye.z + f.z * 10 - look[2]) * k;
    cam.lookAt(lx, ly, lz);
  }

  _nextWave() {
    this.wave++;
    const def = this.rules.waves[this.wave];
    this.queue = [];
    for (const group of def.enemies) for (let i = 0; i < group.count; i++) this.queue.push(group.type);
    this.spawnTimer = 0.4;
    this.spawnInterval = def.spawnInterval ?? 0.7;
    this.waveTotal = this.queue.length;
    this.hud.showBanner(def.message ?? `Wave ${this.wave + 1}`);
    if (def.radio) this.hud.shooter?.radio(def.radio, def.radioSeconds ?? 5);
    this.audio.play('wave');
    this.rules.onWave?.(this.wave, this.ctx);
    this.ctx.events.emit('round:wave', { wave: this.wave });
  }

  _pickSpawn() {
    const p = this.player.feet;
    const physics = this.ctx.get('physics');
    const rng = this.ctx.rng;
    const pts = this.level.enemySpawns;
    const candidates = pts.filter((s) => Math.hypot(s[0] - p.x, s[1] - p.z) > (this.rules.minSpawnDistance ?? 12));
    const pool = candidates.length ? candidates : pts;
    const hidden = pool.filter((s) => {
      const y = physics.groundHeight(s[0], s[1]) ?? 0;
      return !physics.lineOfSight([s[0], y + 1.2, s[1]], [p.x, p.y + 1.4, p.z]);
    });
    return rng.pick(hidden.length ? hidden : pool);
  }

  _end(state) {
    if (this.state !== 'playing') return;
    this.state = state;
    this.player.controlEnabled = state === 'lost' ? this.player.controlEnabled : false;
    this.ctx.input.captureGameplay = false;
    document.exitPointerLock?.();
    this.audio.play(state === 'won' ? 'win' : 'lose');
    const r = this.rules;
    const t = this.elapsed.toFixed(1);
    const stats = this.weapons.stats;
    const screen = { ...(state === 'won' ? r.winScreen : r.loseScreen), ...(r.endScreen?.(state, this.ctx) ?? {}) };
    if (this.introT > 0) this._endIntro();
    const score = this.hud.shooter ? ` · score ${Math.round(this.hud.shooter.score)}` : '';
    this.hud.showScreen({
      title: screen.title,
      text: `${screen.text} Wave ${Math.max(this.wave + 1, 1)}/${r.waves.length} · ${stats.kills} kills · ${t}s · `
        + `${stats.shots ? Math.round((100 * stats.hits) / stats.shots) : 0}% accuracy${score}`,
      action: screen.action ?? 'Play again',
      small: r.controls,
    });
    this.ctx.events.emit('round:state', { state });
  }

  _onLockChange() {
    const input = this.ctx.input;
    if (document.pointerLockElement || this.state !== 'playing' || input.mode !== 'lock' || !input.lockEverWorked) return;
    this.state = 'paused';
    this.ctx.time.scale = 0;
    this.player.controlEnabled = false;
    this.hud.showScreen({ title: 'Paused', text: '', action: 'Click to resume', small: this.rules.controls });
  }

  update(dt) {
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    if (this.introT > 0) this._stepIntro(dt);
    this.rules.onUpdate?.(dt, this.ctx);
    if (this.state !== 'playing') return;
    const left = this.queue.length + this.enemies.alive.length;
    this.hud.setStatus(`WAVE ${this.wave + 1} / ${this.rules.waves.length}   ·   LEFT ${left}`);
    this.hud.shooter?.setWave(this.wave + 1, left || null, this.waveTotal ? 1 - left / this.waveTotal : 1);

    if (this.queue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        const type = this.queue.shift();
        const s = this._pickSpawn();
        this.enemies.spawn(type, s[0], s[1]);
        this.ctx.events.emit('round:spawn', { type, x: s[0], z: s[1] });
      }
      return;
    }
    if (this.enemies.alive.length) return;

    if (this.wave + 1 >= this.rules.waves.length) {
      this._end('won');
      return;
    }
    this.breakTimer += dt;
    if (this.breakTimer >= (this.rules.breakSeconds ?? 2)) {
      this.breakTimer = 0;
      this._nextWave();
    }
  }
}
