import * as THREE from 'three';
import { Spring, approach, clamp } from '../player/springs.js';
import { glowTexture } from '../textures/textures.js';
import { Viewmodel, WeaponMaterials, ViewLightRig, HANDLING, MODELS } from '../viewmodel/index.js';
import { AssetArms } from '../viewmodel/asset-arms.js';

/** A kit model (heldItem or a finished firearm) as one Object3D, for a hand bone to hold. */
function heldObject(model, mats) {
  const root = new THREE.Group();
  root.name = `held-${model.id ?? 'item'}`;
  const add = (asm, parent) => {
    for (const [key, geo] of asm.build()) {
      const mesh = new THREE.Mesh(geo, mats.get(key));
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  };
  add(model.body, root);
  for (const asm of Object.values(model.moving ?? {})) add(asm, root);
  root.userData.tip = model.nodes?.muzzle ?? [0, 0, -0.4];
  return root;
}

/**
 * Weapon framework. A game supplies definitions (src/game/weapons.js); this
 * handles inventory, firing, ammo, reload, hit registration, projectiles and the
 * held-model animation.
 *
 * kind: 'hitscan' | 'projectile' | 'melee'
 * Common fields: id, name, auto, damage, rate (shots/s), magazine (0 = none),
 * reserve, reload (s), spread (rad), pellets, range, headMultiplier,
 * recoil { pitch, yaw, kick }, sound (audio.play args), impact { color, count },
 * hold [x,y,z], muzzle [x,y,z] in model space, tracer { color } or null.
 *
 * What the player holds, one of:
 *   model: 'carbine' | 'compact' | 'sidearm'   finished firearm with hands (kit/viewmodel)
 *   model: (ctx, mats) => heldItem({...})       any held object, gripped by the same hands
 *   viewmodel(): THREE.Object3D                 a bare mesh with no hands (old path)
 * With `model`, also: handling ('carbine'|'compact'|'sidearm'|'onehand'|'twohand'|'thrown'),
 * pose { hipPos, hipRot, ... } overrides, and materials { key: [surface, opts] | Material }.
 * Rigged arms from a file instead of the coded hands (kit/viewmodel/asset-arms.js):
 *   viewmodel: { arms: 'asset', url, clips: { idle, fire, reload, reloadEmpty, draw }, ... }
 * Keep `model` set too: it is the fallback if the asset fails, and with `hand:` it is
 * what the bare asset arms hold.
 * projectile: { speed, gravity, radius, life, build(): Object3D, stick, splash { radius, damage }, trail { color } }
 * melee: { arc (rad), delay (s to impact), swing (s), strike: 'swing' | 'thrust' }
 * Bare arms holding the kit's primitive items (kit/viewmodel/bare-arms.js):
 *   viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear', material: 'hide' }, model: buildSpear
 */

const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = [0, 0, 0];
const _z = new THREE.Vector3(0, 0, 1);

export class WeaponSystem {
  static id = 'weapons';
  static deps = ['player', 'physics', 'fx', 'audio'];

  constructor({ defs }) {
    this.defs = defs;
  }

  async init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    this.player = ctx.get('player');
    this.physics = ctx.get('physics');
    this.fx = ctx.get('fx');
    this.audio = ctx.get('audio');

    this.rig = new THREE.Group();
    this.vm = null;
    const assetArms = (d) => d.viewmodel?.arms === 'asset' && d.viewmodel.url;
    if (this.defs.some((d) => d.model || assetArms(d))) {
      // Hands and held items. The anchor follows the world camera, so the
      // old bare-mesh rig rides on it to stay in camera space.
      this.mats = new WeaponMaterials(ctx);
      for (const d of this.defs) for (const [k, m] of Object.entries(d.materials ?? {})) this.mats.register(k, m);
      this.vm = new Viewmodel(ctx, this.mats);
      this.viewLights = new ViewLightRig(ctx.viewScene);
      this.vm.anchor.add(this.rig);
    } else {
      ctx.viewScene.add(this.rig);
    }
    // Rigged arms assets load first (in parallel); a failed load falls back to the coded hands.
    const loaded = await Promise.all(this.defs.map((d) => (assetArms(d) ? AssetArms.load(ctx, d.viewmodel, this.mats).catch((err) => {
      console.warn(`[weapons] ${d.id}: arms asset failed, using the coded hands`, err);
      return null;
    }) : null)));
    this.slots = this.defs.map((def, k) => {
      const slot = { def, model: null, vm: null, ammo: def.magazine || Infinity, reserve: def.reserve ?? Infinity };
      if (loaded[k]) {
        const asset = loaded[k];
        // Bare arms: the game's held item (a coded spear, club, rifle...) goes in the named hand.
        if (asset.hand && def.model) {
          const preset = typeof def.model === 'string' ? def.model : null;
          asset.attachHeld(heldObject(preset ? MODELS[preset]() : def.model(ctx, this.mats), this.mats));
        }
        const handling = { ...HANDLING.asset, ...(def.pose ?? {}) };
        handling.cycleTime = 1 / (def.rate ?? 8);
        slot.vm = this.vm.addAssetWeapon(def.id, asset, handling);
      } else if (def.model) {
        const preset = typeof def.model === 'string' ? def.model : null;
        const model = preset ? MODELS[preset]() : def.model(ctx, this.mats);
        model.id = def.id;
        const handling = { ...HANDLING[def.handling ?? preset ?? 'onehand'], ...(def.pose ?? {}) };
        handling.cycleTime = 1 / (def.rate ?? 8);
        handling.magLen = model.magSize?.len ?? 0.2;
        slot.vm = this.vm.addWeapon(model, handling);
      } else {
        slot.model = def.viewmodel();
        slot.model.visible = false;
        this.rig.add(slot.model);
      }
      return slot;
    });

    const flashMat = new THREE.SpriteMaterial({ map: glowTexture(64), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true, opacity: 0 });
    this.muzzleSprite = new THREE.Sprite(flashMat);
    this.muzzleSprite.scale.setScalar(0.3);
    this.rig.add(this.muzzleSprite);
    this.throwT = 1;
    this.lastShot = -1;

    this.index = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.swap = 0;
    this.swingT = 1;
    this.pendingMelee = -1;
    this.flashT = 0;
    this.kickZ = new Spring(13, 0.5);
    this.kickRot = new Spring(11, 0.45);
    this.swayX = new Spring(7, 0.65);
    this.swayY = new Spring(7, 0.65);
    this.bobT = 0;

    this.projectiles = [];
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this._select(0, true);

    ctx.events.on('enemy:hit', (e) => {
      this.stats.hits++;
      if (e.kill) this.stats.kills++;
    });
  }

  get current() {
    return this.slots[this.index];
  }

  get active() {
    return this.player.controlEnabled && !this.player.dead;
  }

  resetRound() {
    for (const s of this.slots) {
      s.ammo = s.def.magazine || Infinity;
      s.reserve = s.def.reserve ?? Infinity;
    }
    this.cooldown = this.reloading = 0;
    this.pendingMelee = -1;
    this.stats.shots = this.stats.hits = this.stats.kills = 0;
    for (const p of this.projectiles) this.ctx.scene.remove(p.mesh);
    this.projectiles.length = 0;
    this._select(0, true);
  }

  _select(i, instant = false) {
    if (i < 0 || i >= this.slots.length) return;
    if (!instant && i === this.index) return;
    this.index = i;
    this.reloading = 0;
    // The last weapon's refire wait does not follow the hands to the next one; the swap or
    // draw time gates the first shot instead.
    this.cooldown = 0;
    this.pendingMelee = -1;
    this.swap = instant ? 0 : 0.28;
    this.slots.forEach((s, k) => { if (s.model) s.model.visible = k === i; });
    if (this.vm) {
      const slot = this.current;
      this.vm.rig.visible = !!slot.vm;
      if (slot.vm) {
        this.vm.stopClip();
        this.vm.setActive(slot.def.id);
        if (!instant && slot.vm.clips.draw) {
          this.vm.play('draw');
          this.swap = 0;
        }
      }
    }
    const m = this.current.def.muzzle ?? [0, 0, -0.5];
    const h = this.current.def.hold ?? [0.24, -0.22, -0.5];
    this.muzzleSprite.position.set(h[0] + m[0], h[1] + m[1], h[2] + m[2]);
    this.muzzleSprite.material.color.set(this.current.def.flashColor ?? '#ffcf8a');
    if (!instant) this.audio.play('reload');
    this.ctx.events.emit('weapon:changed', { id: this.current.def.id, name: this.current.def.name });
  }

  startReload() {
    const s = this.current;
    if (!s.def.magazine || this.reloading > 0 || s.ammo >= s.def.magazine || s.reserve <= 0) return;
    this.reloading = s.def.reload ?? 1.2;
    // The hands play the real reload, timed to the weapon's own reload length.
    if (s.vm?.clips.reloadTac) {
      const clip = s.ammo === 0 ? 'reloadEmpty' : 'reloadTac';
      const len = this.vm.play(clip);
      this.reloading = len || this.reloading;
    }
    this.audio.play('reload');
  }

  _finishReload() {
    const s = this.current;
    const want = s.def.magazine - s.ammo;
    const got = Math.min(want, s.reserve);
    s.ammo += got;
    if (s.reserve !== Infinity) s.reserve -= got;
    this.audio.play('reload');
  }

  update(dt, ctx) {
    const input = ctx.input;
    const s = this.current;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.swap = Math.max(0, this.swap - dt);
    this.flashT = Math.max(0, this.flashT - dt);

    if (this.active) {
      for (let i = 0; i < this.slots.length; i++) if (input.actionPressed(`weapon${i + 1}`)) this._select(i);
      if (input.actionPressed('nextWeapon') || input.wheel) {
        const dir = input.wheel < 0 ? -1 : 1;
        this._select((this.index + dir + this.slots.length) % this.slots.length);
      }
      if (input.actionPressed('reload')) this.startReload();

      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) {
          this.reloading = 0;
          this._finishReload();
        }
      }

      const want = input.firePressed || (s.def.auto && input.fire);
      if (want && this.cooldown <= 0 && this.reloading <= 0 && this.swap <= 0) {
        if (s.ammo > 0) this._fire(s);
        else if (input.firePressed) {
          this.audio.play('dry');
          this.startReload();
        } else this.startReload();
      }
    }

    if (this.pendingMelee >= 0) {
      this.pendingMelee -= dt;
      if (this.pendingMelee < 0) this._meleeImpact(s);
    }

    this._animate(dt, ctx, s);
  }

  fixedUpdate(h) {
    if (this.projectiles.length) this._stepProjectiles(h);
  }

  _muzzleWorld(out) {
    if (this.current.vm) return this.vm.muzzleWorld(out);
    const p = this.player;
    _right.set(1, 0, 0).applyQuaternion(this.ctx.camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(this.ctx.camera.quaternion);
    return out.copy(p.eye).addScaledVector(p.forward, 0.6).addScaledVector(_right, 0.17).addScaledVector(_up, -0.14);
  }

  _fire(s) {
    const d = s.def;
    this.stats.shots++;
    this.cooldown = 1 / d.rate;
    if (d.magazine) s.ammo--;
    if (d.sound) this.audio.play(d.sound[0], d.sound[1]);
    const r = d.recoil ?? {};
    this.player.addRecoil((r.pitch ?? 0.01) * this.rng.range(0.85, 1.15), (r.yaw ?? 0.004) * this.rng.signed());
    this.kickZ.impulse(r.kick ?? 1.2);
    this.kickRot.impulse((r.kick ?? 1.2) * 0.8);
    this.ctx.events.emit('weapon:fire', { id: d.id });
    const now = this.ctx.time.elapsed;
    if (s.vm && d.kind !== 'melee' && d.handling !== 'thrown') this.vm.addRecoil(r.pitch ?? 0.01, r.yaw ?? 0.004, now - this.lastShot > 0.3);
    this.lastShot = now;

    if (d.kind === 'melee') {
      this.swingT = 0;
      this.pendingMelee = d.delay ?? 0.14;
      return;
    }
    if (s.vm && d.handling === 'thrown') this.throwT = 0;

    this.flashT = 0.05;
    const muzzle = this._muzzleWorld(_v);
    const mp = [muzzle.x, muzzle.y, muzzle.z];
    this.fx.flash(mp, { color: d.flashColor ?? '#ffc680', intensity: d.flashIntensity ?? 30, distance: 9, life: 0.06 });
    this.fx.burst(mp, { count: 5, color: d.flashColor ?? '#ffc680', speed: 3, life: 0.1, size: 0.06, gravity: 0 });

    if (d.kind === 'projectile') {
      this._spawnProjectile(d.projectile, mp, this.player.forward, d, 'player');
      return;
    }

    const pellets = d.pellets ?? 1;
    for (let i = 0; i < pellets; i++) this._hitscan(d, mp);
  }

  _spread(d, out) {
    const p = this.player;
    const moving = 1 + Math.min(1, p.speed / 6) * 0.7 + (p.grounded ? 0 : 0.8);
    const spread = (d.spread ?? 0.01) * moving * (this.ctx.input.aim ? 0.5 : 1);
    const disc = this.rng.disc();
    _right.set(1, 0, 0).applyQuaternion(this.ctx.camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(this.ctx.camera.quaternion);
    out[0] = p.forward.x + (_right.x * disc.x + _up.x * disc.y) * spread;
    out[1] = p.forward.y + (_right.y * disc.x + _up.y * disc.y) * spread;
    out[2] = p.forward.z + (_right.z * disc.x + _up.z * disc.y) * spread;
    const len = Math.hypot(out[0], out[1], out[2]);
    out[0] /= len;
    out[1] /= len;
    out[2] /= len;
  }

  _hitscan(d, mp) {
    const p = this.player;
    const o = [p.eye.x, p.eye.y, p.eye.z];
    this._spread(d, _dir);
    const res = this.physics.trace(o, _dir, d.range ?? 200);
    const end = res.hit ? [...res.point] : [o[0] + _dir[0] * (d.range ?? 200), o[1] + _dir[1] * (d.range ?? 200), o[2] + _dir[2] * (d.range ?? 200)];
    if (d.tracer !== null) this.fx.tracer(mp, end, d.tracer ?? {});
    if (res.hit) this._applyHit(res, _dir, d);
  }

  /** Deal a trace result: damage if it was an enemy, impact effects either way. */
  _applyHit(res, dir, d, damageOverride) {
    const point = res.point;
    if (res.target) {
      const e = res.target.owner;
      const head = point[1] > e.headY;
      const damage = (damageOverride ?? d.damage) * (head ? d.headMultiplier ?? 1.8 : 1);
      this.ctx.get('enemies').damage(e, damage, point, dir, head);
    } else {
      const imp = d.impact ?? {};
      this.fx.burst(point, { count: imp.count ?? 9, color: imp.color ?? '#ffd9a0', speed: 4.5, life: 0.28, size: 0.05, dir: res.normal, spread: 0.8 });
      this.fx.burst(point, { count: 3, color: imp.dust ?? '#8a7a68', additive: false, speed: 1.2, life: 0.5, size: 0.14, gravity: 0.6, dir: res.normal, grow: 1.2 });
      this.fx.mark(point, res.normal, { color: imp.mark ?? '#14110e', size: imp.markSize ?? 0.14 });
      this.audio.play('impact');
    }
  }

  _meleeImpact(s) {
    const d = s.def;
    const p = this.player;
    const enemies = this.ctx.get('enemies');
    const range = d.range ?? 2.4;
    const cosArc = Math.cos((d.arc ?? 1.2) / 2);
    const dir = [p.forward.x, p.forward.y, p.forward.z];
    let any = false;
    for (const e of enemies.alive) {
      const dx = e.x - p.feet.x;
      const dz = e.z - p.feet.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + e.def.radius) continue;
      const lenF = Math.hypot(p.forward.x, p.forward.z) || 1;
      const dot = dist < 0.01 ? 1 : (dx * p.forward.x + dz * p.forward.z) / (dist * lenF);
      if (dot < cosArc) continue;
      enemies.damage(e, d.damage, [e.x, e.y + e.def.height * 0.6, e.z], dir, false);
      any = true;
    }
    if (any) {
      p.addTrauma(0.2);
      return;
    }
    const o = [p.eye.x, p.eye.y, p.eye.z];
    const res = this.physics.trace(o, dir, range, { targets: false });
    if (res.hit) this._applyHit(res, dir, d, 0);
  }

  /** Launch from a weapon, or from an enemy with team: 'enemy'. */
  _spawnProjectile(pd, origin, dir, weaponDef, team) {
    const mesh = pd.build();
    mesh.position.set(origin[0], origin[1], origin[2]);
    this.ctx.scene.add(mesh);
    this.projectiles.push({
      pd, weaponDef, team, mesh,
      pos: new THREE.Vector3(origin[0], origin[1], origin[2]),
      vel: new THREE.Vector3(dir.x ?? dir[0], dir.y ?? dir[1], dir.z ?? dir[2]).multiplyScalar(pd.speed),
      life: pd.life ?? 6,
      stuck: 0,
      trail: 0,
    });
  }

  spawnEnemyProjectile(pd, origin, dir, damage) {
    this._spawnProjectile(pd, origin, dir, { damage }, 'enemy');
  }

  _stepProjectiles(h) {
    const list = this.projectiles;
    const p = this.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life -= h;
      if (s.stuck > 0) {
        s.stuck -= h;
        if (s.stuck <= 0) this._removeProjectile(i);
        continue;
      }
      if (s.life <= 0) {
        this._removeProjectile(i);
        continue;
      }
      s.vel.y += (s.pd.gravity ?? 0) * h;
      const speed = s.vel.length();
      const stepLen = speed * h;
      const dir = [s.vel.x / speed, s.vel.y / speed, s.vel.z / speed];
      const o = [s.pos.x, s.pos.y, s.pos.z];

      if (s.team === 'enemy') {
        const res = this.physics.trace(o, dir, stepLen, { targets: false });
        const dx = s.pos.x - p.feet.x;
        const dz = s.pos.z - p.feet.z;
        const dy = s.pos.y - (p.feet.y + 0.9);
        if (Math.hypot(dx, dz) < 0.5 + (s.pd.radius ?? 0.15) && Math.abs(dy) < 1.05) {
          p.applyDamage(s.weaponDef.damage, s.pos);
          this.fx.burst([s.pos.x, s.pos.y, s.pos.z], { count: 10, color: s.pd.color ?? '#ff7a50', speed: 3, life: 0.3, size: 0.08 });
          this._removeProjectile(i);
          continue;
        }
        if (res.hit) {
          this.fx.burst(res.point, { count: 8, color: s.pd.color ?? '#ff7a50', speed: 3, life: 0.3, size: 0.07, dir: res.normal });
          this._removeProjectile(i);
          continue;
        }
      } else {
        const res = this.physics.trace(o, dir, stepLen);
        if (res.hit) {
          this._projectileHit(s, i, res, dir);
          continue;
        }
      }

      s.pos.x += s.vel.x * h;
      s.pos.y += s.vel.y * h;
      s.pos.z += s.vel.z * h;
      s.mesh.position.copy(s.pos);
      _v.copy(s.vel).normalize();
      s.mesh.quaternion.setFromUnitVectors(_z, _v);
      if (s.pd.trail) {
        s.trail -= h;
        if (s.trail <= 0) {
          s.trail = 0.03;
          this.fx.burst([s.pos.x, s.pos.y, s.pos.z], { count: 1, color: s.pd.trail.color ?? '#fff', speed: 0.2, life: 0.3, size: s.pd.trail.size ?? 0.12, gravity: 0 });
        }
      }
    }
  }

  _projectileHit(s, i, res, dir) {
    const d = s.weaponDef;
    this._applyHit(res, dir, d);
    const sp = s.pd.splash;
    if (sp) this._splash(res.point, sp);
    if (s.pd.stick && !res.target) {
      s.pos.set(res.point[0], res.point[1], res.point[2]);
      s.mesh.position.copy(s.pos);
      s.stuck = s.pd.stick;
      return;
    }
    this._removeProjectile(i);
  }

  _splash(point, sp) {
    const enemies = this.ctx.get('enemies');
    this.fx.burst(point, { count: 26, color: sp.color ?? '#ffb060', speed: 8, life: 0.45, size: 0.16 });
    this.fx.burst(point, { count: 10, color: '#6d6155', additive: false, speed: 2.5, life: 1, size: 0.6, gravity: 0.8, grow: 2 });
    this.fx.flash(point, { color: sp.color ?? '#ffb060', intensity: 90, distance: sp.radius * 3, life: 0.14 });
    this.audio.play('kill');
    const pl = this.player;
    pl.addTrauma(Math.max(0, 0.4 - pl.feet.distanceTo(_v.set(point[0], point[1], point[2])) * 0.02));
    for (const e of [...enemies.alive]) {
      const dist = Math.hypot(e.x - point[0], e.y + e.def.height * 0.5 - point[1], e.z - point[2]);
      if (dist < sp.radius) {
        enemies.damage(e, sp.damage * (1 - dist / sp.radius * 0.6), [e.x, e.y + 1, e.z], [0, 1, 0], false);
      }
    }
  }

  _removeProjectile(i) {
    const s = this.projectiles[i];
    this.ctx.scene.remove(s.mesh);
    this.projectiles.splice(i, 1);
  }

  /**
   * Melee swing and throw as one additive layer on the hands: wind up and back,
   * strike across and down fast, recover. t runs 0..1 over the swing.
   */
  _swingLayer(t, out, kind) {
    const ease = (x) => x * x * (3 - 2 * x);
    let pos;
    let rot;
    if (kind === 'throw') {
      // cock back over the shoulder, then whip forward and release
      const back = t < 0.35 ? ease(t / 0.35) : 1 - ease(Math.min(1, (t - 0.35) / 0.25));
      const fwd = t < 0.35 ? 0 : Math.sin(Math.min(1, (t - 0.35) / 0.4) * Math.PI);
      pos = [0.04 * back - 0.06 * fwd, 0.1 * back - 0.03 * fwd, 0.12 * back - 0.2 * fwd];
      rot = [0.9 * back - 0.6 * fwd, -0.2 * back, -0.2 * back + 0.3 * fwd];
    } else if (kind === 'thrust') {
      // draw back to the hip, drive straight down the line of sight, recover
      const back = t < 0.28 ? ease(t / 0.28) : Math.max(0, 1 - (t - 0.28) / 0.1);
      const fwd = t < 0.28 ? 0 : t < 0.46 ? ease((t - 0.28) / 0.18) : 1 - ease(Math.min(1, (t - 0.46) / 0.54));
      pos = [0.03 * back - 0.08 * fwd, -0.02 * back + 0.06 * fwd, 0.12 * back - 0.3 * fwd];
      rot = [0.12 * back - 0.05 * fwd, -0.12 * back + 0.14 * fwd, 0.08 * back - 0.06 * fwd];
    } else {
      const up = t < 0.3 ? ease(t / 0.3) : 1 - ease(Math.min(1, (t - 0.3) / 0.18));
      const hit = t < 0.3 ? 0 : t < 0.55 ? ease((t - 0.3) / 0.25) : 1 - ease(Math.min(1, (t - 0.55) / 0.45));
      pos = [0.06 * up - 0.24 * hit, 0.12 * up - 0.1 * hit, 0.06 * up - 0.18 * hit];
      rot = [0.75 * up - 1.25 * hit, -0.35 * up + 0.7 * hit, -0.25 * up + 0.55 * hit];
    }
    out.pos = pos;
    out.rot = rot;
    return out;
  }

  _animateHands(dt, ctx, s) {
    const d = s.def;
    const p = this.player;
    const vm = this.vm;
    const ex = { pos: [0, 0, 0], rot: [0, 0, 0] };
    if (d.kind === 'melee' && this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt / (d.swing ?? 0.42));
      this._swingLayer(this.swingT, ex, d.strike === 'thrust' ? 'thrust' : 'swing');
    } else if (this.throwT < 1) {
      this.throwT = Math.min(1, this.throwT + dt / (d.throwTime ?? 0.45));
      this._swingLayer(this.throwT, ex, 'throw');
    }
    // Held items have no reload clip: dip below the frame and come back.
    const dip = (this.swap > 0 ? this.swap / 0.28 : 0) + (this.reloading > 0 && !s.vm.clips.reloadTac ? Math.sin(Math.min(1, 1 - this.reloading / (d.reload ?? 1.2)) * Math.PI) : 0);
    ex.pos[1] -= dip * 0.28;
    ex.rot[0] -= dip * 0.6;
    vm.extra = ex;
    vm.update(dt, {
      ads: ((!!ctx.input.aim && this.active) || !!this.forceAds) && !p.sprinting,
      sprint: !!p.sprinting && p.speed > 3 && this.reloading <= 0,
      lowReady: false,
      speed: p.speed,
      crouch: false,
      airborne: !p.grounded,
      trigger: this.active && !!ctx.input.fire,
      empty: s.ammo === 0,
    });
    this.viewLights.update(vm.anchor, s.vm.asset?.spec.lightScale ?? 1);

    const mat = this.muzzleSprite.material;
    mat.opacity = this.flashT > 0 ? 1 : 0;
    if (this.flashT > 0) {
      vm.muzzleWorld(_v);
      vm.anchor.worldToLocal(_v);
      this.muzzleSprite.position.copy(_v);
      mat.rotation = this.rng.range(0, 6.28);
    }
  }

  _animate(dt, ctx, s) {
    if (s.vm) return this._animateHands(dt, ctx, s);
    if (this.vm) {
      // Bare-mesh weapon in a hands loadout: keep the anchor on the camera.
      ctx.camera.updateMatrixWorld();
      this.vm.anchor.position.setFromMatrixPosition(ctx.camera.matrixWorld);
      this.vm.anchor.quaternion.setFromRotationMatrix(ctx.camera.matrixWorld);
      ctx.viewCamera.position.copy(this.vm.anchor.position);
      ctx.viewCamera.quaternion.copy(this.vm.anchor.quaternion);
    }
    const d = s.def;
    const hold = d.hold ?? [0.24, -0.22, -0.5];
    const p = this.player;

    this.kickZ.step(dt);
    this.kickRot.step(dt);
    this.swayX.target = clamp(-ctx.input.look.x * 3, -0.06, 0.06);
    this.swayY.target = clamp(ctx.input.look.y * 3, -0.06, 0.06);
    this.swayX.step(dt);
    this.swayY.step(dt);

    this.bobT += dt * p.speed * 1.7;
    const bobAmp = p.grounded ? Math.min(1, p.speed / 5) : 0.2;
    const bobX = Math.cos(this.bobT) * 0.012 * bobAmp;
    const bobY = Math.abs(Math.sin(this.bobT)) * 0.014 * bobAmp;

    const reload = this.reloading > 0 ? Math.sin(Math.min(1, 1 - this.reloading / (d.reload ?? 1.2)) * Math.PI) : 0;
    const swap = this.swap > 0 ? this.swap / 0.28 : 0;

    let swing = 0;
    if (d.kind === 'melee' && this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt / (d.swing ?? 0.42));
      swing = Math.sin(this.swingT * Math.PI);
    }

    const aimX = ctx.input.aim ? -hold[0] * 0.75 : 0;
    this.rig.position.x = approach(this.rig.position.x, aimX, 0.05, dt);
    const m = s.model;
    m.position.set(
      hold[0] + bobX + this.swayX.value - swing * 0.2,
      hold[1] - bobY + this.swayY.value - reload * 0.22 - swap * 0.3 - swing * 0.05,
      hold[2] + this.kickZ.value * 0.05 + swing * -0.25
    );
    m.rotation.set(
      this.kickRot.value * 0.05 + reload * -0.7 + swing * -1.1,
      swing * 0.7,
      this.swayX.value * 1.6 + swing * 0.5
    );

    const mat = this.muzzleSprite.material;
    mat.opacity = this.flashT > 0 ? 1 : 0;
    if (this.flashT > 0) mat.rotation = this.rng.range(0, 6.28);
  }
}
