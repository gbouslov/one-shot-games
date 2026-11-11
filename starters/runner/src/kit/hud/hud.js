import './hud.css';

/**
 * Runner HUD and the title / won / lost screens. Words come from the game
 * (src/game/config.js `text`), numbers from the round.
 *
 *   top left     pickups and the combo
 *   top centre   distance run, a bar to the goal, metres left
 *   top right    hearts
 *   centre       toasts (milestones, hits)
 *
 * Adapted from starters/space-shooter/src/kit/hud/hud.js (screens, toast, the
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
    const hearts = ctx.get('round').rules.hearts ?? 3;
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="hud-pick"><span class="label">${esc(this.text.pickupName ?? 'Pickups')}</span><span class="big"><i class="gem"></i><b id="hud-pick-n">0</b></span><span class="combo" id="hud-combo"></span></div>
      <div id="hud-dist"><span class="big"><b id="hud-m">0</b><small>m</small></span><div class="bar"><i id="hud-fill"></i><em id="hud-goal"></em></div><span class="label" id="hud-left"></span></div>
      <div id="hud-hearts"><span class="label">${esc(this.text.heartsName ?? 'Hearts')}</span><span class="row">${Array.from({ length: hearts }, () => '<i class="heart on"></i>').join('')}</span></div>
      <div id="hud-toast"></div>`;
    ui.appendChild(hud);
    this.hud = hud;
    const $ = (id) => hud.querySelector(`#${id}`);
    this.el = { pick: $('hud-pick-n'), combo: $('hud-combo'), m: $('hud-m'), fill: $('hud-fill'), left: $('hud-left'), toast: $('hud-toast'), hearts: [...hud.querySelectorAll('.heart')] };
    this._toastT = 0;
    this._last = {};
  }

  /** The screen overlay is created after the touch layer so it sits on top. */
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
    const unit = t.unit ?? 'm';
    if (kind === 'title') {
      html = `<div class="card"><div class="kicker">${esc(t.kicker)}</div><h1>${esc(t.title)}</h1><div class="sub">${esc(t.tagline)}</div>
        <div class="keys">${t.keys.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
        <div class="touchkeys">${esc(t.touchKeys ?? 'Swipe left or right to change lane, up to jump, down to slide')}</div>
        <div class="go">${esc(t.start)}</div></div>${t.credits ? `<div class="credits">${esc(t.credits)}</div>` : ''}`;
    } else if (kind === 'won') {
      html = `<div class="card"><div class="kicker">${esc(t.wonKicker)}</div><h1>${esc(t.wonTitle)}</h1>
        <div class="stats"><div><div class="label">Time</div><div class="big">${fmtClock(data.time ?? 0)}</div></div>
        <div><div class="label">${esc(t.pickupName ?? 'Pickups')}</div><div class="big">${data.embers ?? 0}<small> / ${data.total ?? 0}</small></div></div>
        <div><div class="label">${esc(t.heartsName ?? 'Hearts')}</div><div class="big">${data.hearts ?? 0}</div></div>
        <div><div class="label">Score</div><div class="big">${Math.round(data.score ?? 0)}</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    } else if (kind === 'lost') {
      const why = (data.reason === 'hits' ? t.lostHits : t.lostOther) ?? t.lostHits;
      html = `<div class="card"><div class="kicker">${esc(t.lostKicker)}</div><h1>${esc(why)}</h1>
        <div class="stats"><div><div class="label">Distance</div><div class="big">${Math.round(data.distance ?? 0)}<small> ${unit}</small></div></div>
        <div><div class="label">To go</div><div class="big">${Math.max(0, Math.round((data.goal ?? 0) - (data.distance ?? 0)))}<small> ${unit}</small></div></div>
        <div><div class="label">${esc(t.pickupName ?? 'Pickups')}</div><div class="big">${data.embers ?? 0}</div></div></div>
        <div class="go">${esc(t.again)}</div></div>`;
    }
    this.screen.innerHTML = html;
    this.screen.className = kind === 'title' ? 'title' : `end ${kind}`;
  }

  toast(msg, seconds = 1.6) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('on');
    void this.el.toast.offsetWidth;
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
    const b = r.body;
    const d = Math.min(r.goal, Math.max(0, b.s));
    this._set('m', this.el.m, String(Math.floor(d)));
    this._set('left', this.el.left, `${Math.max(0, Math.ceil(r.goal - d))} m ${this.text.toGoal ?? 'to go'}`);
    this._set('fill', this.el.fill.style, `${((d / r.goal) * 100).toFixed(2)}%`, 'width');
    this._set('pick', this.el.pick, String(r.embers));
    this._set('combo', this.el.combo, r.combo >= 3 ? `×${Math.min(10, r.combo)}` : '');
    this.el.hearts.forEach((h, i) => {
      const on = i < r.hearts;
      if (this._last[`h${i}`] !== on) {
        this._last[`h${i}`] = on;
        h.classList.toggle('on', on);
        if (!on) h.classList.add('lost');
      }
    });
    if (r.state === 'playing' && r.hearts === (r.rules.hearts ?? 3) && this._last.h0 && this.el.hearts.some((h) => h.classList.contains('lost'))) {
      for (const h of this.el.hearts) h.classList.remove('lost');
    }
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('on');
    }
  }
}
