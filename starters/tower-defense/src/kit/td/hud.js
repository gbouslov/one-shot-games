/**
 * The defense HUD and screens, in the DOM over the canvas. Restyle through
 * config.hud (colours, fonts, words); the layout is genre furniture:
 * wave and timer top left, lamp lives and gold top right, the tower bar at the
 * bottom, the selected tower's card bottom left, call-wave and speed bottom right.
 * Every button calls controls.act(), the same as the keyboard.
 */

const ICON = {
  life: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2c2.6 3.3 5 6 5 9.4A5 5 0 0 1 12 16.5a5 5 0 0 1-5-5.1C7 8 9.4 5.3 12 2z" fill="currentColor"/><rect x="9" y="18" width="6" height="2.4" rx="1" fill="currentColor" opacity=".7"/></svg>',
  gold: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2l7 5v10l-7 5-7-5V7z" fill="currentColor"/><path d="M12 2v20M5 7l14 10M19 7L5 17" stroke="#0005" stroke-width="1"/></svg>',
  wave: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 15c3-4 6-4 9 0s6 4 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 9c3-4 6-4 9 0s6 4 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"/></svg>',
};

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--ink);user-select:none;-webkit-user-select:none;font-variant-numeric:tabular-nums}
#ui *{box-sizing:border-box}
#ui button{font:inherit;color:inherit;pointer-events:auto;cursor:pointer;touch-action:manipulation}
.hud{position:absolute;inset:0;transition:opacity .35s}
.hud.off{opacity:0}
.glass{background:var(--panel);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 6px 24px #0006}
.tl{position:absolute;left:20px;top:18px;padding:10px 14px 11px;min-width:180px}
.tl .k{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.7}
.tl .v{display:flex;align-items:center;gap:7px;font-size:20px;font-weight:700;margin-top:2px}
.tl .v svg{color:var(--accent)}
.tl .t{height:3px;margin-top:9px;background:#ffffff1a;border-radius:2px;overflow:hidden}
.tl .t u{display:block;height:100%;background:var(--accent);transform-origin:left;text-decoration:none}
.tl .n{font-size:11.5px;opacity:.8;margin-top:6px}
.tr{position:absolute;right:20px;top:18px;display:flex;gap:10px}
.tr .s{display:flex;align-items:center;gap:8px;padding:9px 14px;font-size:20px;font-weight:700}
.tr .s svg{opacity:.95}
.tr .life svg{color:var(--life)}
.tr .gold svg{color:var(--gold)}
.tr .s.bump{animation:bump .35s}
@keyframes bump{40%{transform:scale(1.12)}}
.bar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:8px;padding:8px}
.card{position:relative;width:118px;padding:9px 10px 9px 12px;border-radius:8px;border:1px solid transparent;background:#ffffff08;text-align:left;transition:background .15s,border-color .15s,opacity .15s}
.card:hover{background:#ffffff14}
.card .nm{display:block;font-size:13.5px;font-weight:700;letter-spacing:.01em;white-space:nowrap}
.card .ds{display:block;font-size:10.5px;opacity:.65;margin-top:1px;white-space:nowrap}
.card .co{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:700;color:var(--gold);margin-top:5px}
.card .ky{position:absolute;right:8px;top:8px;font-size:10px;font-weight:700;opacity:.55;border:1px solid #ffffff40;border-radius:4px;padding:0 4px;line-height:15px}
.card.on{border-color:var(--accent);background:#ffffff1c}
.card.poor{opacity:.42}
.act{position:absolute;right:20px;bottom:16px;display:flex;gap:8px;align-items:stretch}
.call{padding:11px 18px;border-radius:9px;border:0;background:var(--accent);color:var(--accentInk)!important;font-weight:800;font-size:14px;letter-spacing:.02em;text-align:left;box-shadow:0 6px 24px #0006}
.call small{display:block;font-size:10.5px;font-weight:600;opacity:.75;letter-spacing:.02em;margin-top:1px}
.call[disabled]{opacity:.45;cursor:default}
.spd{width:54px;border-radius:9px;font-weight:800;font-size:15px}
.sel{position:absolute;left:20px;bottom:16px;padding:12px 14px;width:220px;display:none}
.sel.on{display:block}
.sel h3{margin:0;font-size:15px;font-weight:800}
.sel .pips{display:flex;gap:4px;margin:6px 0 8px}
.sel .pips i{width:18px;height:4px;border-radius:2px;background:#ffffff26}
.sel .pips i.f{background:var(--accent)}
.sel dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0 0 10px;font-size:12px}
.sel dt{opacity:.6}
.sel dd{margin:0;text-align:right;font-weight:700}
.sel .row{display:flex;gap:6px}
.sel .row button{flex:1;padding:8px 6px;border-radius:7px;border:1px solid var(--line);background:#ffffff10;font-size:12px;font-weight:700}
.sel .row .up{background:var(--accent);color:var(--accentInk)!important;border-color:transparent}
.sel .row button[disabled]{opacity:.4;cursor:default}
.bn{position:absolute;top:21%;left:50%;transform:translate(-50%,0);text-align:center;opacity:0;transition:opacity .4s,transform .4s;white-space:nowrap;text-shadow:0 2px 18px #000c}
.bn.on{opacity:1;transform:translate(-50%,-6px)}
.bn b{display:block;font-family:var(--display);font-size:clamp(28px,4.6vw,50px);font-weight:700;letter-spacing:.01em}
.bn span{display:block;font-size:12px;letter-spacing:.24em;text-transform:uppercase;opacity:.8;margin-top:4px}
.ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--scrim);pointer-events:auto;cursor:pointer;text-align:center;padding:24px;transition:opacity .4s}
.ov.off{opacity:0;pointer-events:none}
.ov .k{font-size:12px;letter-spacing:.32em;text-transform:uppercase;opacity:.75}
.ov h1{font-family:var(--display);font-size:clamp(40px,8.4vw,92px);line-height:1;margin:12px 0 14px;font-weight:700;letter-spacing:-.005em;text-shadow:0 4px 40px #000c}
.ov p{margin:0 auto 26px;max-width:540px;font-size:clamp(15px,1.9vw,18px);line-height:1.5;opacity:.9;text-shadow:0 1px 12px #000c}
.ov .go{display:inline-block;padding:13px 30px;background:var(--accent);color:var(--accentInk);font-weight:800;border-radius:999px;font-size:15px;letter-spacing:.04em;box-shadow:0 10px 30px #0008}
.ov small{display:block;margin-top:22px;font-size:12.5px;opacity:.7;line-height:1.8}
.ov kbd{font:inherit;font-weight:700;border:1px solid #ffffff55;border-radius:4px;padding:0 5px;margin:0 2px}
@media (max-width:760px){
  .tl{left:10px;top:10px;min-width:0;padding:7px 10px}.tl .v{font-size:16px}.tl .n{display:none}
  .tr{right:10px;top:10px;gap:6px}.tr .s{font-size:16px;padding:6px 10px}
  .bar{bottom:8px;left:8px;transform:none;gap:5px;padding:5px}
  .card{width:86px;padding:6px 7px}.card .ds,.card .ky{display:none}.card .nm{font-size:12px}
  .act{right:8px;bottom:8px}.call{padding:8px 12px;font-size:13px}.call small{display:none}.spd{width:44px}
  .sel{left:auto;right:8px;bottom:72px;width:190px}
}
`;

export class HudSystem {
  static id = 'hud';
  static deps = ['defense', 'controls'];

  constructor(opts = {}) {
    this.opts = opts;
  }

  init(ctx) {
    this.ctx = ctx;
    const h = ctx.config.hud ?? {};
    this.words = h.words ?? {};
    const style = document.createElement('style');
    style.textContent = `:root{--accent:${h.accent ?? '#f2b45a'};--accentInk:${h.accentInk ?? '#1d1206'};--ink:${h.ink ?? '#fbf3e4'};--gold:${h.gold ?? '#f6c76a'};--life:${h.life ?? '#ffd08a'};--panel:${h.panel ?? 'rgba(18,14,10,.58)'};--line:${h.line ?? 'rgba(255,236,200,.14)'};--scrim:${h.scrim ?? 'radial-gradient(ellipse at center,rgba(8,6,4,.25),rgba(8,6,4,.72))'};--font:${h.font ?? '"Avenir Next","Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif'};--display:${h.display ?? '"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif'}}${CSS}`;
    document.head.appendChild(style);

    const d = ctx.get('defense');
    const root = document.getElementById('ui');
    const cards = d.towerDefs
      .map((t, i) => `<button class="card" data-i="${i}"><span class="ky">${i + 1}</span><span class="nm">${t.name}</span><span class="ds">${t.blurb ?? ''}</span><span class="co">${ICON.gold}<b>${t.cost}</b></span></button>`)
      .join('');
    root.innerHTML = `
      <div class="hud off">
        <div class="tl glass"><div class="k">${this.words.wave ?? 'Wave'}</div><div class="v">${ICON.wave}<b class="wv"></b></div><div class="t"><u></u></div><div class="n"></div></div>
        <div class="tr"><div class="s life glass">${ICON.life}<b></b></div><div class="s gold glass">${ICON.gold}<b></b></div></div>
        <div class="bar glass">${cards}</div>
        <div class="sel glass"><h3></h3><div class="pips"></div><dl></dl><div class="row"><button class="up"></button><button class="sl"></button></div></div>
        <div class="act"><button class="call"></button><button class="spd glass"></button></div>
        <div class="bn"><b></b><span></span></div>
      </div>
      <div class="ov"><div><div class="k"></div><h1></h1><p></p><span class="go"></span><small></small></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      hud: q('.hud'), wv: q('.tl .wv'), timer: q('.tl .t u'), next: q('.tl .n'),
      life: q('.tr .life'), lifeV: q('.tr .life b'), gold: q('.tr .gold'), goldV: q('.tr .gold b'),
      cards: [...root.querySelectorAll('.card')], call: q('.call'), spd: q('.spd'),
      sel: q('.sel'), selName: q('.sel h3'), pips: q('.sel .pips'), stats: q('.sel dl'), up: q('.sel .up'), sl: q('.sel .sl'),
      bn: q('.bn'), bnB: q('.bn b'), bnS: q('.bn span'),
      ov: q('.ov'), ovK: q('.ov .k'), h1: q('.ov h1'), p: q('.ov p'), go: q('.ov .go'), small: q('.ov small'),
    };
    const controls = ctx.get('controls');
    const press = (el, fn) => el.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      fn();
    });
    this.el.cards.forEach((b) => press(b, () => controls.act('tool', Number(b.dataset.i))));
    press(this.el.call, () => controls.act('call'));
    press(this.el.spd, () => controls.act('speed'));
    press(this.el.up, () => controls.act('upgrade'));
    press(this.el.sl, () => controls.act('sell'));
    this.el.ov.addEventListener('click', () => controls.act('start'));

    this._last = {};
    this._banner = 0;
    ctx.events.on('wave:start', (e) => this.banner(`${this.words.wave ?? 'Wave'} ${e.wave}`, e.early > 0 ? `Called early  +${e.early}` : this.waves?.[e.wave - 1]?.name ?? ''));
    ctx.events.on('wave:clear', (e) => {
      if (e.wave < d.waves.length) this.banner(this.words.cleared ?? 'Held', `+${e.bonus} ${this.words.gold ?? 'gold'}`);
    });
    ctx.events.on('enemy:leaked', () => this._bump(this.el.life));
    ctx.events.on('enemy:killed', () => this._bump(this.el.gold));
    this.waves = d.waves;
    this._screen = null;
  }

  banner(title, sub) {
    this.el.bnB.textContent = title;
    this.el.bnS.textContent = sub ?? '';
    this.el.bn.classList.add('on');
    this._banner = 2.2;
  }

  _bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  _set(key, value, fn) {
    if (this._last[key] === value) return;
    this._last[key] = value;
    fn(value);
  }

  screen(kind) {
    const w = this.words;
    const d = this.ctx.get('defense');
    const e = this.el;
    const s = {
      title: { k: w.kicker ?? '', h1: w.title ?? 'Defend', p: w.pitch ?? '', go: w.start ?? 'Begin', small: w.controls ?? '' },
      won: { k: w.wonKicker ?? 'Victory', h1: w.won ?? 'Held', p: (w.wonText ?? 'Score {score}').replace('{score}', d.score).replace('{lives}', d.lives), go: w.again ?? 'Play again', small: '' },
      lost: { k: w.lostKicker ?? 'Defeat', h1: w.lost ?? 'Fallen', p: (w.lostText ?? 'Reached wave {wave}').replace('{wave}', d.wave).replace('{score}', d.score), go: w.retry ?? 'Try again', small: '' },
    }[kind];
    e.ovK.textContent = s.k;
    e.h1.textContent = s.h1;
    e.p.textContent = s.p;
    e.go.textContent = s.go;
    e.small.innerHTML = s.small;
    e.ov.classList.remove('off');
    e.hud.classList.add('off');
  }

  hideScreen() {
    this.el.ov.classList.add('off');
  }

  update(dt) {
    const d = this.ctx.get('defense');
    const c = this.ctx.get('controls');
    const e = this.el;
    if (this.forceHidden) {
      e.hud.classList.add('off');
      e.ov.classList.add('off');
      return;
    }
    this._set('state', d.state, (s) => {
      if (s === 'playing') {
        e.ov.classList.add('off');
        e.hud.classList.remove('off');
      } else this.screen(s);
    });
    if (d.state !== 'playing') return;

    this._set('wave', `${Math.max(1, d.wave)} / ${d.waves.length}`, (v) => (e.wv.textContent = v));
    const left = d.wave < d.waves.length ? Math.ceil(d.countdown) : 0;
    const span = d.wave === 0 ? d.economy.firstCall ?? 20 : d.economy.betweenWaves ?? 18;
    e.timer.style.transform = `scaleX(${d.wave < d.waves.length ? Math.max(0, d.countdown / span) : 0})`;
    this._set('next', d.wave < d.waves.length ? `${this.words.next ?? 'Next wave in'} ${left}s` : this.words.last ?? 'Final wave', (v) => (e.next.textContent = v));
    this._set('lives', d.lives, (v) => (e.lifeV.textContent = v));
    this._set('gold', Math.floor(d.gold), (v) => (e.goldV.textContent = v));
    this._set('callable', d.wave < d.waves.length, (v) => (e.call.disabled = !v));
    this._set('call', d.wave < d.waves.length ? `${d.wave === 0 ? this.words.callFirst ?? 'Send first wave' : this.words.call ?? 'Call next wave'}|${d.wave > 0 ? `+${Math.floor(d.countdown * (d.economy.earlyBonus ?? 1))} early` : 'Space'}` : `${this.words.holding ?? 'Hold the line'}|`, (v) => {
      const [a, b] = v.split('|');
      e.call.innerHTML = `${a}${b ? `<small>${b}</small>` : ''}`;
    });
    this._set('speed', d.speed, (v) => (e.spd.textContent = `${v}×`));
    d.towerDefs.forEach((t, i) => {
      this._set(`card${i}`, `${c.tool === i}|${d.gold < t.cost}`, () => {
        e.cards[i].classList.toggle('on', c.tool === i);
        e.cards[i].classList.toggle('poor', d.gold < t.cost);
      });
    });

    const t = d.selected;
    this._set('sel', t ? `${t.id}|${t.level}|${Math.floor(d.gold)}` : '', () => {
      e.sel.classList.toggle('on', !!t);
      if (!t) return;
      const max = (t.def.upgrades?.length ?? 0) + 1;
      e.selName.textContent = t.def.name;
      e.pips.innerHTML = Array.from({ length: max }, (_, k) => `<i class="${k <= t.level ? 'f' : ''}"></i>`).join('');
      const rows = [['Damage', t.damage.toFixed(0)], ['Range', t.range.toFixed(1)], ['Rate', `${t.rate.toFixed(2)}/s`]];
      if (t.def.slow) rows.push(['Slows', `${Math.round((1 - t.def.slow.factor) * 100)}%`]);
      if (t.splash) rows.push(['Blast', t.splash.toFixed(1)]);
      e.stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      const cost = d.upgradeCost(t);
      e.up.textContent = cost === null ? 'Max level' : `Upgrade ${cost}`;
      e.up.disabled = cost === null || d.gold < cost;
      e.sl.textContent = `Sell +${Math.floor(t.spent * (d.economy.refund ?? 0.7))}`;
    });

    if (this._banner > 0) {
      this._banner -= dt;
      if (this._banner <= 0) e.bn.classList.remove('on');
    }
  }
}
