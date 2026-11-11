/**
 * RaceDirector: owns the renderer, scene, camera, lights, the fixed-step loop
 * and the round flow   title (attract race) -> playing (countdown, race) -> won | lost.
 * Everything the game decides lives in src/game; this file only sequences the kit.
 *
 * Adapted from bridge-mind/turbo-kart-rush src/game/Game.ts (MIT): the menus,
 * character select, loading screen and pause menu are gone; the attract race,
 * the won/lost rule, the bot hook and the lockstep step for captures are new.
 */
import * as THREE from 'three';
import { events } from '../core/events';
import { COUNTDOWN_STEP_SECONDS, FIXED_DT, KART_COUNT, setGameTitle } from '../core/constants';
import { clamp, clamp01, damp } from '../core/math';
import { Kart } from '../kart/Kart';
import { InputManager } from '../kart/InputManager';
import { Track } from '../track/Track';
import { ItemManager } from '../items/ItemManager';
import { buildItemIcon } from '../items/itemVisuals';
import { AIDriver } from '../ai/AIDriver';
import { AudioEngine } from '../audio/AudioEngine';
import { ParticleSystem } from '../fx/ParticleSystem';
import { PostFX } from '../fx/PostFX';
import { RaceManager } from './RaceManager';
import { FollowCamera } from './FollowCamera';
import { HUD } from '../ui/HUD';
import { Screens, TouchControls } from '../ui/screens';

const MAX_FRAME_DT = 0.1;
const MAX_STEPS = 12;
const SUN_DISTANCE = 90;

export const QUALITY = {
  low: { pixelRatio: 0.45, shadowSize: 0, post: false, bloom: false, ao: false, shafts: false, samples: 0 },
  medium: { pixelRatio: 1, shadowSize: 1024, post: true, bloom: true, ao: false, shafts: true, samples: 0 },
  high: { pixelRatio: 2, shadowSize: 2048, post: true, bloom: true, ao: true, shafts: true, samples: 4 },
};

export class RaceDirector {
  /**
   * @param {object} o
   * @param {HTMLCanvasElement} o.canvas
   * @param {HTMLElement} o.ui
   * @param {object} o.config     src/game/config.js
   * @param {object} o.track      src/game/track.js (a TrackDefinition)
   * @param {object[]} o.racers   src/game/racers.js
   * @param {object} o.look       src/game/look.js
   * @param {'low'|'medium'|'high'} o.quality
   * @param {boolean} o.deterministic  captures: no adaptive anything, fixed seeds
   */
  constructor({ canvas, ui, config, track, racers, look, quality = 'medium', deterministic = false }) {
    this.canvas = canvas;
    this.ui = ui;
    this.config = config;
    this.trackDef = track;
    this.racers = racers;
    this.look = look;
    this.qualityName = QUALITY[quality] ? quality : 'medium';
    this.q = QUALITY[this.qualityName];
    this.deterministic = deterministic;

    this.state = 'title';
    this.phase = 'attract';
    this.elapsed = 0;
    this.frame = 0;
    this.accumulator = 0;
    this.endTimer = -1;
    this.result = null;
    this.bot = null;
    this.botOn = false;
    this.pendingUseItem = false;
    this.speedFx = 0;
    this.boostFx = 0;
    this.lastDt = 0;
    this.attractAngle = 0;
    this.touchMode = false;
    this.unsubs = [];
    this.roundUnsubs = [];
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.tmpC = new THREE.Vector3();
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3);
    this.cameraOverride = null;
  }

  // ------------------------------------------------------------------ build

  init() {
    const q = this.q;
    setGameTitle(this.config.title);

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !q.post,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.deterministic,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.look.exposure ?? 1;
    renderer.shadowMap.enabled = q.shadowSize > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1400);
    this.scene.add(this.camera);

    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem();
    this.scene.add(this.particles.object);

    this.postfx = new PostFX();
    this.postfx.setOptions({ bloom: q.bloom, ao: q.ao, shafts: q.shafts, samples: q.samples });
    this.resize();
    if (q.post) {
      this.postfx.init(renderer, this.scene, this.camera);
      this.postfx.setLook(this.look);
    }

    // The circuit is built once and kept for every round.
    this.track = new Track(this.trackDef);
    this.scene.add(this.track.object);
    if (this.qualityName === 'low') {
      // Slow devices and software WebGL: drop the densest ground cover.
      this.track.object.traverse((o) => {
        if (o.name === 'flowers' || o.name === 'bushes') o.visible = false;
      });
    }
    this.buildLights();
    this.dressing = this.look.dress?.({ THREE, scene: this.scene, track: this.track, quality: this.qualityName }) ?? null;

    this.followCamera = new FollowCamera(this.camera);
    this.followCamera.setTrack(this.track);

    this.hud = new HUD(this.ui, buildItemIcon);
    this.hud.setTrack(this.track);
    this.screens = new Screens(this.ui, { ...this.config, trackName: this.trackDef.name });
    this.touch = new TouchControls(this.ui, this.input);

    this.items = new ItemManager(this.particles);
    this.scene.add(this.items.object);

    this.bindInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.newRound('attract');
  }

  buildLights() {
    const env = this.trackDef.environment;
    const sun = new THREE.DirectionalLight(env.sunColor, env.sunIntensity);
    const half = this.look.shadowExtent ?? 34;
    if (this.q.shadowSize > 0) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
      const sc = sun.shadow.camera;
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.near = 1;
      sc.far = SUN_DISTANCE + half * 3;
      sc.updateProjectionMatrix();
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.03;
    }
    this.sunDir.set(env.sunDirection.x, env.sunDirection.y, env.sunDirection.z);
    if (this.sunDir.y < 0.12) this.sunDir.y = 0.12;
    this.sunDir.normalize();
    this.postfx.setSunDirection(this.sunDir);
    const hemi = new THREE.HemisphereLight(env.ambientSky, env.ambientGround, env.ambientIntensity);
    const darkness = clamp(0.9 - env.ambientIntensity, 0, 0.6) + clamp((1.6 - env.sunIntensity) * 0.3, 0, 0.3);
    const fill = new THREE.DirectionalLight(this.look.fillColor ?? 0xd9e4ff, this.look.fill ?? darkness);
    fill.visible = fill.intensity > 0.01;
    this.scene.add(sun, sun.target, hemi, fill, fill.target);
    this.scene.fog = env.fogDensity > 0 ? new THREE.FogExp2(env.fogColor, env.fogDensity) : null;
    this.scene.background = new THREE.Color(env.skyHorizon);
    this.sun = sun;
    this.fill = fill;
  }

  bindInput() {
    const startFromPointer = (e) => {
      if (e.pointerType === 'touch' && !this.touchMode) {
        this.touchMode = true;
        this.screens.setPrompt(true);
      }
      this.wakeAudio();
      if (e.target?.closest?.('.touch')) return;
      if (this.state === 'title' || this.state === 'won' || this.state === 'lost') this.startRace();
    };
    const onKey = (e) => {
      this.wakeAudio();
      if (e.repeat) return;
      if (e.code === 'KeyM') this.audio.setMuted(!this.audio.muted);
      const go = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space';
      if (!go) return;
      if (this.state === 'title') this.startRace();
      else if ((this.state === 'won' || this.state === 'lost') && this.endTimer < 0) this.startRace();
    };
    this.ui.addEventListener('pointerdown', startFromPointer);
    this.canvas.addEventListener('pointerdown', startFromPointer);
    addEventListener('keydown', onKey);
  }

  wakeAudio() {
    if (this.audio.state === 'running') return;
    this.audio.init().then(() => this.audio.playMusic(this.music ?? 'menu')).catch(() => {});
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || innerHeight);
    const pr = Math.min(devicePixelRatio || 1, this.q.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.q.post) this.postfx.setSize(w, h, pr);
  }

  // ------------------------------------------------------------------ rounds

  /** A fresh grid. mode 'attract' races eight bots behind the title; 'race' is the real thing. */
  newRound(mode) {
    this.clearRound();
    const cfg = this.config;
    const roster = this.racers;
    const player = roster.find((r) => r.id === cfg.player) ?? roster[0];
    const others = roster.filter((r) => r !== player);
    // A seeded shuffle so ?seed= gives the same grid.
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const karts = [new Kart(0, player, true)];
    for (let id = 1; id < KART_COUNT; id++) karts.push(new Kart(id, others[(id - 1) % others.length], false));
    for (const k of karts) this.scene.add(k.object);
    this.karts = karts;

    const difficulty = cfg.difficulty ?? 'normal';
    this.aiDrivers = karts.slice(1).map((k, i) => new AIDriver(k, difficulty, i + 1));
    this.items.init(this.track, karts);
    const laps = cfg.laps ?? this.trackDef.laps ?? 3;
    this.raceManager = new RaceManager(this.track, karts, { characterId: player.id, trackId: this.trackDef.id, difficulty, laps });
    this.playerAuto = mode === 'attract' ? new AIDriver(karts[0], difficulty, 0) : null;
    this.audio.setKarts?.(karts);

    this.accumulator = 0;
    this.pendingUseItem = false;
    this.result = null;
    this.endTimer = -1;
    this.speedFx = 0;
    this.boostFx = 0;
    this.particles.reset();
    if (this.botOn) this.setAutoplay(true);
    for (const k of karts) k.updateVisuals(0);
    this.followCamera.snapTo(karts[0]);

    this.playerItemUses = 0;
    const r = this.roundUnsubs;
    r.push(
      events.on('item:use', (e) => {
        if (e.isPlayer) this.playerItemUses++;
      }),
      events.on('race:finish', (e) => {
        if (e.isPlayer && this.phase === 'race') this.onPlayerFinished(e.place, e.time);
      }),
      events.on('race:start', () => {
        if (this.phase === 'countdown') this.phase = 'race';
      }),
    );

    if (mode === 'attract') {
      this.state = 'title';
      this.phase = 'attract';
      this.hud.hide();
      this.screens.showTitle();
      this.touch.show(false);
      this.raceManager.startCountdown();
      // Get the field strung out before anyone sees it.
      this.fastForward(this.config.attractLead ?? 9);
      this.playMusic('menu');
    } else {
      this.state = 'playing';
      this.phase = 'countdown';
      this.screens.hideTitle();
      this.screens.hideEnd();
      this.hud.show();
      this.touch.show(this.touchMode);
      this.startCinematic();
      this.raceManager.startCountdown();
      this.playMusic('race');
    }
  }

  clearRound() {
    for (const u of this.roundUnsubs) u();
    this.roundUnsubs.length = 0;
    if (!this.karts) return;
    for (const k of this.karts) {
      this.scene.remove(k.object);
      k.dispose();
    }
    this.raceManager?.dispose();
    this.karts = null;
  }

  startRace() {
    this.wakeAudio();
    this.newRound('race');
  }

  startCinematic() {
    const grid = this.track.startGrid;
    const center = this.tmpA.set(0, 0, 0);
    const n = Math.min(grid.length, KART_COUNT);
    for (let i = 0; i < n; i++) center.add(grid[i].position);
    center.multiplyScalar(1 / Math.max(1, n));
    const forward = this.karts[0].forwardDir(this.tmpB);
    forward.y = 0;
    forward.normalize();
    const right = this.tmpC.set(-forward.z, 0, forward.x);
    const from = center.clone().addScaledVector(forward, 18).addScaledVector(right, 11);
    from.y += 6.5;
    const look = center.clone();
    look.y += 0.8;
    this.followCamera.setCinematic(from, look, 3 * COUNTDOWN_STEP_SECONDS, 46);
  }

  onPlayerFinished(place, time) {
    const won = place <= (this.config.winPlace ?? 3);
    this.end(won, place, time);
  }

  /** End the round now. */
  end(won, place, time, reason) {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.phase = 'finished';
    this.playerAuto = new AIDriver(this.karts[0], 'normal', 0);
    this.result = { won, place, time, reason };
    this.endTimer = -1;
    this.showEndScreen();
    this.touch.show(false);
    if (this.q.post) this.postfx.flash(0xfff1d8, 0.35);
    this.playMusic('results');
  }

  lose(reason = 'Retired') {
    if (this.state !== 'playing') return;
    this.end(false, 0, 0, reason);
  }

  showEndScreen() {
    const standings = this.raceManager.getStandings();
    this.hud.hide();
    this.screens.showEnd({ ...this.result, standings });
  }

  playMusic(track) {
    this.music = track;
    try {
      this.audio.playMusic(track);
    } catch {}
  }

  // ------------------------------------------------------------------ loop

  /** One frame. fixedDt makes it a constant slice of game time (captures, recordings). */
  step(now, fixedDt = null) {
    const raw = fixedDt ?? Math.min(MAX_FRAME_DT, Math.max(0, (now - (this.lastNow ?? now)) / 1000));
    this.lastNow = now;
    const dt = raw;
    this.lastDt = dt;
    this.elapsed += dt;
    this.frame++;

    if (!this.botOn) this.touch.setGas(this.phase === 'race' && this.state === 'playing');
    let input = this.input.update();
    if (input.useItem) this.pendingUseItem = true;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      if (this.botOn && this.bot && this.state === 'playing') input = this.driveBot(FIXED_DT);
      this.simStep(FIXED_DT, input);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS) this.accumulator = 0;

    this.visualStep(dt, input);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        this.showEndScreen();
      }
    }
    this.render(dt);
  }

  /** The bot presses the same virtual device touch controls use, then the device is read. */
  driveBot(dt) {
    const o = this.bot.update(dt, this.track, this.karts, this.items, null);
    const v = this.input.virtual;
    v.throttle = o.throttle;
    v.brake = o.brake;
    v.steer = o.steer;
    v.drift = o.drift;
    v.item = o.useItem || o.useItemHeld;
    const input = this.input.update();
    if (input.useItem) this.pendingUseItem = true;
    return input;
  }

  simStep(dt, input) {
    const { track, karts, items } = this;
    const player = karts[0];
    if (this.playerAuto) {
      this.playerAuto.update(dt, track, karts, items, null);
    } else {
      const p = this.playerInput ?? (this.playerInput = {});
      Object.assign(p, {
        throttle: input.throttle,
        brake: input.brake,
        steer: input.steer,
        drift: input.drift,
        useItem: this.pendingUseItem,
        useItemHeld: input.useItemHeld,
        lookBack: input.lookBack,
        pause: false,
        confirm: false,
        back: false,
        menuUp: false,
        menuDown: false,
        menuLeft: false,
        menuRight: false,
      });
      player.setInput(p);
    }
    this.pendingUseItem = false;
    for (let i = 0; i < this.aiDrivers.length; i++) this.aiDrivers[i].update(dt, track, karts, items, this.playerAuto ? null : player);
    for (let i = 0; i < karts.length; i++) karts[i].update(dt, track, karts);
    for (let i = 0; i < karts.length; i++) {
      const k = karts[i];
      const inp = k.input;
      if (inp.useItem && !k.state.itemRouletteActive && k.state.item !== 'none') items.requestUse(k, inp.brake > 0.5 || inp.lookBack);
    }
    items.update(dt);
    this.raceManager.update(dt);
  }

  visualStep(dt, input) {
    const player = this.karts[0];
    for (let i = 0; i < this.karts.length; i++) this.karts[i].updateVisuals(dt);
    this.track.update(dt, this.elapsed);
    if (this.phase === 'attract') this.attractCamera(dt);
    else this.followCamera.update(dt, player, this.state === 'playing' && input.lookBack);
    if (this.cameraOverride) this.cameraOverride(this.camera, this);
    this.updateSun(player);
    this.particles.update(dt, this.karts, this.camera);
    this.dressing?.update?.(dt, this.camera);
    this.audio.update(dt, this.karts, this.phase === 'attract' ? -1 : 0, this.camera);
    if (this.phase !== 'attract') this.hud.update(dt, player, this.karts, this.raceManager.raceTime, this.raceManager.totalLaps);
    this.updateFeel(dt, player);
  }

  /** Behind the title: a slow broadcast orbit around the race leader. */
  attractCamera(dt) {
    this.attractAngle += dt * 0.12;
    let lead = this.karts[0];
    for (const k of this.karts) if (k.state.raceProgress > lead.state.raceProgress) lead = k;
    // Ahead of the leader looking back down the field: nothing passes between
    // the camera and the pack, and the drivers face the lens.
    const p = lead.state.position;
    const heading = lead.state.heading;
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    const side = 3 + Math.sin(this.attractAngle) * 2.5;
    const ahead = 13;
    const target = this.tmpA.set(p.x + fx * ahead - fz * side, p.y + 4.2, p.z + fz * ahead + fx * side);
    const k = 1 - Math.exp(-3 * dt);
    if (!this.attractInit || dt === 0) {
      this.camera.position.copy(target);
      this.attractInit = true;
    } else this.camera.position.lerp(target, k);
    const ground = this.track.query(this.camera.position, lead.state.trackT).groundY + 1.2;
    if (this.camera.position.y < ground) this.camera.position.y = ground;
    this.attractLook = this.attractLook ?? new THREE.Vector3().copy(p);
    // Aim a little to the camera's left so the pack sits in the right half, clear of the title.
    this.attractLook.lerp(this.tmpB.set(p.x - fx * 5 - fz * 4.5, p.y + 0.6, p.z - fz * 5 + fx * 4.5), dt === 0 ? 1 : 1 - Math.exp(-6 * dt));
    this.camera.lookAt(this.attractLook);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
  }

  updateSun(player) {
    const p = player.state.position;
    const snap = 2;
    this.tmpC.set(Math.round(p.x / snap) * snap, Math.round(p.y / snap) * snap, Math.round(p.z / snap) * snap);
    this.sun.target.position.copy(this.tmpC);
    this.sun.position.copy(this.tmpC).addScaledVector(this.sunDir, SUN_DISTANCE);
    if (this.fill.visible) {
      this.fill.position.copy(this.camera.position);
      this.fill.position.y += 2;
      this.fill.target.position.copy(p);
    }
  }

  updateFeel(dt, player) {
    if (!this.q.post) return;
    const s = player.state;
    const top = Math.max(1, player.topSpeed());
    const calm = this.phase === 'attract';
    this.postfx.calm = calm;
    const speedTarget = calm ? 0 : clamp01((Math.abs(s.speed) - top * 0.55) / (top * 0.9));
    const boostTarget = calm ? 0 : s.isBoosting ? clamp01(0.45 + s.boostStrength) : s.isInvincible ? 0.35 : 0;
    this.speedFx = damp(this.speedFx, speedTarget, 5, dt);
    this.boostFx = damp(this.boostFx, boostTarget, s.isBoosting ? 12 : 4, dt);
    this.postfx.setSpeedEffect(this.speedFx);
    this.postfx.setBoostEffect(this.boostFx);
  }

  render(dt) {
    this.renderer.info.reset();
    if (this.q.post) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /**
   * Run the simulation forward without drawing (captures, the attract lead).
   * Everyone is driven by bots meanwhile, the player included unless a bot is on.
   */
  fastForward(seconds) {
    const tick = 1 / 30;
    const saved = this.playerAuto;
    if (!this.playerAuto && !this.botOn) this.playerAuto = new AIDriver(this.karts[0], this.config.difficulty ?? 'normal', 0);
    const empty = this.input.update();
    for (let t = 0; t < seconds; t += tick) {
      this.accumulator += tick;
      while (this.accumulator >= FIXED_DT) {
        const input = this.botOn && this.bot && !this.playerAuto ? this.driveBot(FIXED_DT) : empty;
        this.simStep(FIXED_DT, input);
        this.accumulator -= FIXED_DT;
      }
      this.elapsed += tick;
      for (const k of this.karts) k.updateVisuals(tick);
      if (this.phase === 'attract') this.attractCamera(tick);
      else {
        this.followCamera.update(tick, this.karts[0], false);
        this.hud.update(tick, this.karts[0], this.karts, this.raceManager.raceTime, this.raceManager.totalLaps);
      }
      this.particles.update(tick, this.karts, this.camera);
    }
    this.playerAuto = saved;
  }

  // ------------------------------------------------------------------ bot

  setAutoplay(on) {
    this.botOn = !!on;
    if (on) {
      this.bot = new AIDriver(this.karts[0], this.config.botDifficulty ?? 'hard', 0);
      this.bot.fullThrottle = true;
    } else {
      this.bot = null;
      Object.assign(this.input.virtual, { throttle: 0, brake: 0, steer: 0, drift: false, item: false });
      this.touch.sync();
    }
  }

  // ------------------------------------------------------------------ read-out

  snapshot() {
    const k = this.karts[0];
    const s = k.state;
    const info = this.renderer.info.render;
    return {
      state: this.state,
      phase: this.phase,
      score: this.result?.place ?? s.place,
      frame: this.frame,
      elapsed: +this.elapsed.toFixed(3),
      raceTime: +this.raceManager.raceTime.toFixed(3),
      laps: this.raceManager.totalLaps,
      player: {
        x: s.position.x,
        y: s.position.y,
        z: s.position.z,
        heading: s.heading,
        speed: s.speed,
        lap: s.lap,
        place: s.place,
        progress: s.raceProgress,
        drifting: s.isDrifting,
        driftStage: s.driftStage,
        boosting: s.isBoosting,
        item: s.item,
        itemReady: s.item !== 'none' && !s.itemRouletteActive,
        itemUses: this.playerItemUses,
        lookBack: k.input?.lookBack ?? false,
        finished: s.finished,
      },
      result: this.result,
      autoplay: this.botOn,
      touch: this.touch.active,
      render: { renderer: this.rendererName(), drawCalls: info.calls, triangles: info.triangles, quality: this.qualityName },
      audio: { state: this.audio.state, played: this.audio.played, muted: this.audio.muted },
    };
  }

  rendererName() {
    if (this._rendererName) return this._rendererName;
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this._rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return this._rendererName;
  }
}
