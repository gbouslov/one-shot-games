import * as THREE from 'three';
import './hud.css';

/**
 * Quiet flight HUD and the title / won / lost screens. Text comes from the
 * game (src/game/config.js `text`), numbers from the round and flight model.
 *
 *   top centre      gates cleared, the clock, lives
 *   bottom left     airspeed (kt), altitude above ground (ft), throttle
 *   on the world    a diamond on the next gate with its distance; an arrow at
 *                   the screen edge when it is off screen
 *   warnings        STALL, PULL UP, TURN BACK
 *
 * Written for this repository.
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
      <div id="hud-top">
        <div class="cell"><span class="label">Gates</span><span class="val" id="hud-gates">0 / 10</span></div>
        <div class="cell"><span class="label">Clock</span><span class="clock" id="hud-clock">0:00.0</span></div>
        <div class="cell"><span class="label">Lives</span><span id="hud-lives"></span></div>
      </div>
      <div id="hud-inst">
        <div class="read"><span class="label">Airspeed</span><span><span class="big" id="hud-spd">0</span><span class="unit">KT</span></span></div>
        <div class="sep"></div>
        <div class="read"><span class="label">Altitude</span><span><span class="big" id="hud-alt">0</span><span class="unit">FT</span></span></div>
        <div class="sep"></div>
        <div class="read" style="min-width:0;align-items:center"><span class="label">Thr</span><div id="hud-thr"><i></i></div></div>
      </div>
      <div id="hud-marker"><div class="ring"></div><div class="arrow"></div><div class="dist"></div></div>
      <div id="hud-warn"></div>
      <div id="hud-toast"></div>`;
    ui.appendChild(hud);
    this.hud = hud;
    const $ = (id) => hud.querySelector(`#${id}`);
    this.el = {
      gates: $('hud-gates'), clock: $('hud-clock'), lives: $('hud-lives'), spd: $('hud-spd'), alt: $('hud-alt'),
      thr: hud.querySelector('#hud-thr i'), marker: $('hud-marker'), dist: hud.querySelector('#hud-marker .dist'),
      arrow: hud.querySelector('#hud-marker .arrow'), warn: $('hud-warn'), toast: $('hud-toast'),
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
      this.screen.classList.add('hidden');
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
        <div><div class="label">Lives</div><div class="big">${data.lives ?? 0}</div></div>
        <div><div class="label">Score</div><div class="big">${data.score ?? 0}</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    } else if (kind === 'lost') {
      const why = data.reason === 'time' ? t.lostTime : data.reason === 'crashes' ? t.lostCrashes : t.lostOther;
      html = `<div class="card"><div class="kicker">${esc(t.lostKicker)}</div><h1>${esc(why)}</h1>
        <div class="stats"><div><div class="label">Gates</div><div class="big">${data.gates ?? 0} / ${data.total ?? 0}</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    }
    this.screen.innerHTML = html;
    this.screen.classList.remove('hidden');
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

  update(dt, ctx) {
    const r = ctx.get('round');
    const m = r.model;
    if (!r.course) return;
    const total = r.course.gates.length;
    this._set('gates', this.el.gates, `${Math.min(r.gate, total)} / ${total}`);
    this._set('clock', this.el.clock, fmtClock(r.state === 'playing' || r.state === 'lost' ? r.clock : r.timeLimit));
    this.el.clock.classList.toggle('low', r.state === 'playing' && r.clock < 15);
    const lives = r.rules.lives ?? 3;
    const livesHtml = Array.from({ length: lives }, (_, i) => `<i class="${i < r.lives ? '' : 'gone'}"></i>`).join('');
    this._set('lives', this.el.lives, livesHtml, 'innerHTML');
    this._set('spd', this.el.spd, String(Math.round(m.speed * 1.944)));
    this._set('alt', this.el.alt, String(Math.max(0, Math.round((r.agl ?? 0) * 3.281 / 10) * 10)));
    this.el.thr.style.height = `${Math.round(m.throttle * 100)}%`;

    const w = r.state === 'playing' && !r.crashed ? r.warning : '';
    this._set('warn', this.el.warn, w);
    this.el.warn.classList.toggle('on', !!w);

    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('on');
    }

    // Next gate marker.
    const g = r.nextGate;
    const mk = this.el.marker;
    if (!g || r.state !== 'playing' || r.crashed) {
      mk.classList.remove('on');
      return;
    }
    const cam = ctx.camera;
    const v = this._v.copy(g.pos).project(cam);
    const behind = this._v.copy(g.pos).sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) < 0;
    v.copy(g.pos).project(cam);
    let x = v.x;
    let y = v.y;
    if (behind) {
      x = -x;
      y = -y;
    }
    const W = innerWidth;
    const H = innerHeight;
    const edge = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (edge) {
      const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-3);
      x *= k;
      y *= k;
      this.el.arrow.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    }
    mk.classList.add('on');
    mk.classList.toggle('edge', edge);
    mk.style.transform = `translate(${((x + 1) / 2) * W}px, ${((1 - y) / 2) * H}px)`;
    const d = Math.round(g.pos.distanceTo(m.position) / 10) * 10;
    this._set('dist', this.el.dist, `${d} m`);
  }
}
