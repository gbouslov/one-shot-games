import * as THREE from 'three';
import './hud.css';

/**
 * Quiet rail-shooter HUD and the title / won / lost screens. Words come from
 * the game (src/game/config.js `text`), numbers from the round.
 *
 *   top left        score and kills
 *   top centre      course progress; becomes the target's health at the end
 *   bottom left     hull and boost
 *   on the world    a near and a far reticle where the guns converge
 *   warnings        low hull
 *
 * Adapted from starters/flight/src/kit/hud/hud.js (screens, toast, the
 * change-only DOM writes); the readouts are new.
 */
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const fmtClock = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

export class HudSystem {
  static id = 'hud';
  static deps = ['round'];

  constructor({ text }) {
    this.text = text;
  }

  init(ctx) {
    this.ctx = ctx;
    const ui = document.getElementById('ui');
    this.ui = ui;
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="hud-score"><span class="label">Score</span><span class="big" id="hud-pts">0</span><span class="small" id="hud-kills"></span></div>
      <div id="hud-track"><span class="label" id="hud-track-label">Run</span><div class="bar"><i id="hud-track-fill"></i></div></div>
      <div id="hud-ship">
        <div class="row"><span class="label">Hull</span><span class="num" id="hud-hull-n">100</span></div>
        <div class="bar hull"><i id="hud-hull"></i></div>
        <div class="row"><span class="label">Boost</span></div>
        <div class="bar boost"><i id="hud-boost"></i></div>
      </div>
      <div id="ret-far" class="ret"></div><div id="ret-near" class="ret"></div>
      <div id="hud-warn"></div>
      <div id="hud-toast"></div>`;
    ui.appendChild(hud);
    this.hud = hud;
    const $ = (id) => hud.querySelector(`#${id}`);
    this.el = {
      pts: $('hud-pts'), kills: $('hud-kills'), trackLabel: $('hud-track-label'), track: $('hud-track-fill'),
      hullN: $('hud-hull-n'), hull: $('hud-hull'), boost: $('hud-boost'), far: $('ret-far'), near: $('ret-near'),
      warn: $('hud-warn'), toast: $('hud-toast'), trackBox: $('hud-track'),
    };
    this._toastT = 0;
    this._v = new THREE.Vector3();
    this._last = {};
  }

  /** The screen overlay is created after the touch controls so it sits on top. */
  mountScreen(onActivate) {
    const s = document.createElement('div');
    s.id = 'screen';
    this.ui.appendChild(s);
    this.screen = s;
    s.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onActivate();
    });
  }

  show(kind, data = {}) {
    const t = this.text;
    this.hud.classList.toggle('hidden', kind === 'title');
    if (!kind) {
      this.screen.className = 'hidden';
      return;
    }
    let html = '';
    if (kind === 'title') {
      html = `<div class="card"><div class="kicker">${esc(t.kicker)}</div><h1>${esc(t.title)}</h1><div class="sub">${esc(t.tagline)}</div>
        <div class="keys">${t.keys.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
        <div class="go">${esc(t.start)}</div></div>${t.credits ? `<div class="credits">${esc(t.credits)}</div>` : ''}`;
    } else if (kind === 'won') {
      html = `<div class="card"><div class="kicker">${esc(t.wonKicker)}</div><h1>${esc(t.wonTitle)}</h1>
        <div class="stats"><div><div class="label">Time</div><div class="big">${fmtClock(data.time ?? 0)}</div></div>
        <div><div class="label">Hull</div><div class="big">${Math.round(data.hull ?? 0)}</div></div>
        <div><div class="label">Kills</div><div class="big">${data.kills ?? 0}</div></div>
        <div><div class="label">Score</div><div class="big">${data.score ?? 0}</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    } else if (kind === 'lost') {
      const why = data.reason === 'hull' ? t.lostHull : t.lostOther;
      html = `<div class="card"><div class="kicker">${esc(t.lostKicker)}</div><h1>${esc(why)}</h1>
        <div class="stats"><div><div class="label">Distance</div><div class="big">${Math.round((data.progress ?? 0) * 100)}%</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    }
    this.screen.innerHTML = html;
    // End screens fade in after a beat so the explosion is seen; they take clicks at once.
    this.screen.className = kind === 'title' ? 'title' : 'end';
  }

  toast(msg, seconds = 1.6) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('on');
    this._toastT = seconds;
  }

  _set(key, el, value, prop = 'textContent') {
    if (this._last[key] === value) return;
    this._last[key] = value;
    el[prop] = value;
  }

  _place(el, p, cam, key) {
    const v = this._v.copy(p).project(cam);
    const x = ((v.x + 1) / 2) * innerWidth;
    const y = ((1 - v.y) / 2) * innerHeight;
    const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (this._last[key] !== tf) el.style.transform = this._last[key] = tf;
  }

  update(dt, ctx) {
    const r = ctx.get('round');
    const s = r.ship;
    this._set('pts', this.el.pts, String(r.score));
    this._set('kills', this.el.kills, r.kills ? `${r.kills} down` : '');
    const hull = Math.max(0, Math.round(r.hull));
    this._set('hullN', this.el.hullN, String(hull));
    this.el.hull.style.width = `${hull}%`;
    this.el.hull.parentNode.classList.toggle('low', hull <= 30);
    this.el.boost.style.width = `${Math.round(s.boost * 100)}%`;
    this.el.boost.parentNode.classList.toggle('on', s.boosting);

    if (r.boss && !r.boss.dead && r.bossActive) {
      const B = r.rules.boss;
      const total = B.nodes.length * B.nodeHp + B.coreHp;
      const left = r.boss.nodes.reduce((a, n) => a + (n.alive ? Math.max(0, n.hp) : 0), 0) + (r.boss.core.alive ? r.boss.core.hp : 0);
      this._set('trackLabel', this.el.trackLabel, this.text.bossName ?? 'Target');
      this.el.track.style.width = `${(left / total) * 100}%`;
      this.el.trackBox.classList.add('boss');
    } else {
      this._set('trackLabel', this.el.trackLabel, this.text.runName ?? 'Run');
      this.el.track.style.width = `${Math.min(100, (s.distance / r.courseLength) * 100)}%`;
      this.el.trackBox.classList.remove('boss');
    }

    const w = r.state === 'playing' && hull <= 30 && hull > 0 ? this.text.lowHull ?? 'Hull critical' : '';
    this._set('warn', this.el.warn, w);
    this.el.warn.classList.toggle('on', !!w);

    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('on');
    }

    // Reticles where the guns converge, near and far.
    const show = r.state === 'playing' && !r.dead && !ctx.cameraOverride;
    this.el.far.classList.toggle('on', show);
    this.el.near.classList.toggle('on', show);
    if (show) {
      const cam = ctx.camera;
      const far = s.aimPoint(this._far ??= new THREE.Vector3());
      const near = this._near ??= new THREE.Vector3();
      near.copy(s.position).lerp(far, 0.4);
      this._place(this.el.far, far, cam, 'far');
      this._place(this.el.near, near, cam, 'near');
      this.el.far.classList.toggle('lock', !!r.lockedOn);
    }
  }
}
