/**
 * The heads-up display and the title, win and lose screens, in the DOM over the
 * canvas. Quiet by design: four corners, small type, one number large. Colours
 * and the font come from config.hud; the text comes from src/game/rules.js.
 *
 *   hud.showScreen({ title, kicker, text, action, small })   hud.hideScreen()
 *   hud.showBanner(text, seconds, sub)   hud.setWave(i, n, left, total)
 *   hud.popScore(points)
 */

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--ink);user-select:none;-webkit-user-select:none;font-variant-numeric:tabular-nums}
#ui *{box-sizing:border-box}
.hud{position:absolute;inset:0;transition:opacity .25s}
.hud.off{opacity:0}
.k{font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.62}
.tl{position:absolute;left:28px;top:24px;min-width:180px}
.tl .w{font-size:22px;font-weight:800;letter-spacing:.04em;margin-top:3px}
.tl .w em{font-style:normal;opacity:.45;font-weight:600;font-size:15px;margin-left:4px}
.tl .pr{margin-top:8px;height:2px;background:#ffffff1c;width:180px}
.tl .pr u{display:block;height:100%;background:var(--accent);transform-origin:left;text-decoration:none;transition:transform .2s}
.tl .lf{margin-top:6px;font-size:12px;opacity:.7}
.tr{position:absolute;right:28px;top:24px;text-align:right}
.tr .s{font-size:26px;font-weight:800;letter-spacing:.02em;margin-top:2px}
.tr .pp{position:absolute;right:0;top:56px;font-size:13px;font-weight:700;color:var(--accent);opacity:0;white-space:nowrap}
.bl{position:absolute;left:28px;bottom:26px}
.bl .hp{display:flex;gap:3px;margin-top:7px}
.bl .hp i{display:block;width:17px;height:6px;background:var(--ink);opacity:.9;transition:opacity .15s,background .15s}
.bl .hp i.e{opacity:.14}
.bl .hp.low i{background:var(--hurt)}
.bl .dr{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:10.5px;letter-spacing:.2em;font-weight:700;opacity:.7;text-transform:uppercase}
.bl .dr b{display:block;width:44px;height:2px;background:#ffffff26;position:relative;overflow:hidden}
.bl .dr b u{position:absolute;inset:0;background:var(--ink);transform-origin:left;text-decoration:none}
.br{position:absolute;right:28px;bottom:22px;text-align:right}
.br .a{font-size:46px;font-weight:800;line-height:1;letter-spacing:-.01em}
.br .a em{font-style:normal;font-size:15px;font-weight:600;opacity:.5;margin-left:6px}
.br .mg{display:flex;justify-content:flex-end;gap:2px;margin-top:8px;height:8px}
.br .mg i{display:block;width:3px;background:var(--ink);opacity:.85}
.br .mg i.e{opacity:.15}
.br .rl{height:2px;margin-top:6px;background:#ffffff1c;position:relative}
.br .rl u{position:absolute;inset:0;background:var(--accent);transform-origin:right;transform:scaleX(0);text-decoration:none}
.bn{position:absolute;top:30%;left:0;right:0;text-align:center;opacity:0;transition:opacity .2s}
.bn b{display:block;font-size:clamp(28px,4.6vw,54px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 2px 24px #000c}
.bn span{display:block;margin-top:8px;font-size:13px;letter-spacing:.26em;text-transform:uppercase;opacity:.75}
.rt{position:absolute;left:0;top:0;width:0;height:0;opacity:0}
.rt i{position:absolute;width:30px;height:30px;left:-15px;top:-15px;border:1.5px solid var(--ink);border-radius:50%;opacity:.85;box-shadow:0 0 6px #0008}
.rt b{position:absolute;width:3px;height:3px;left:-1.5px;top:-1.5px;background:var(--accent);border-radius:50%}
.dv{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,var(--hurt) 140%);opacity:0}
.ov{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:flex-start;background:linear-gradient(90deg,var(--scrim) 0%,transparent 72%),linear-gradient(0deg,var(--scrim) 0%,transparent 55%);pointer-events:auto;cursor:pointer;padding:0 0 9vh 7vw}
.ov.off{display:none}
.ov .in{max-width:560px}
.ov .kk{font-size:12px;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:var(--accent)}
.ov h1{font-size:clamp(46px,9vw,112px);line-height:.9;margin:12px 0 18px;font-weight:900;letter-spacing:-.025em;text-transform:uppercase}
.ov p{margin:0 0 26px;font-size:clamp(15px,1.7vw,18px);line-height:1.5;opacity:.86;max-width:470px}
.ov .go{display:inline-block;padding:14px 26px 13px;border:1.5px solid var(--ink);font-weight:800;font-size:13px;letter-spacing:.24em;text-transform:uppercase}
.ov:hover .go{background:var(--ink);color:#0b0d10}
.ov small{display:block;margin-top:22px;font-size:12px;opacity:.55;line-height:1.8;letter-spacing:.04em}
@media (max-width:700px){.tl,.tr{top:14px}.tl{left:16px}.tr{right:16px}.bl{left:16px;bottom:14px}.br{right:16px;bottom:12px}.br .a{font-size:34px}.ov{padding:0 0 6vh 6vw}}
`;

export class HudSystem {
  static id = 'hud';
  static deps = ['player', 'weapons'];

  init(ctx) {
    this.ctx = ctx;
    const h = ctx.config.hud ?? {};
    const style = document.createElement('style');
    style.textContent = `:root{--accent:${h.accent ?? '#ffb347'};--ink:${h.ink ?? '#f3efe8'};--hurt:${h.hurt ?? '#b3121b'};--scrim:${h.scrim ?? 'rgba(6,8,12,.86)'};--font:${h.font ?? 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'}}${CSS}`;
    document.head.appendChild(style);
    const segs = h.healthSegments ?? 10;
    this.segs = segs;
    const root = document.getElementById('ui');
    root.innerHTML = `
      <div class="hud off">
        <div class="dv"></div>
        <div class="tl"><div class="k wl"></div><div class="w"></div><div class="pr"><u></u></div><div class="lf"></div></div>
        <div class="tr"><div class="k">${h.scoreLabel ?? 'Score'}</div><div class="s">0</div><div class="pp"></div></div>
        <div class="bl"><div class="k">${h.healthLabel ?? 'Vitals'}</div><div class="hp">${'<i></i>'.repeat(segs)}</div><div class="dr">${h.dashLabel ?? 'DASH'}<b><u></u></b></div></div>
        <div class="br"><div class="k wn"></div><div class="a"></div><div class="mg"></div><div class="rl"><u></u></div></div>
        <div class="bn"><b></b><span></span></div>
        <div class="rt"><i></i><b></b></div>
      </div>
      <div class="ov"><div class="in"><div class="kk"></div><h1></h1><p></p><span class="go"></span><small></small></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      hud: q('.hud'), dv: q('.dv'), wl: q('.wl'), w: q('.tl .w'), pr: q('.tl .pr u'), lf: q('.tl .lf'),
      score: q('.tr .s'), pop: q('.tr .pp'), hp: q('.bl .hp'), hpi: [...root.querySelectorAll('.bl .hp i')], dash: q('.bl .dr u'),
      wn: q('.br .wn'), ammo: q('.br .a'), mag: q('.br .mg'), rl: q('.br .rl u'), bn: q('.bn'), bnb: q('.bn b'), bns: q('.bn span'),
      rt: q('.rt'), ov: q('.ov'), kk: q('.ov .kk'), h1: q('.ov h1'), p: q('.ov p'), go: q('.ov .go'), small: q('.ov small'),
    };
    this.onAction = null;
    this.el.ov.addEventListener('click', () => this.onAction?.());
    addEventListener('keydown', (e) => {
      if ((e.code === 'Enter' || e.code === 'Space') && !this.el.ov.classList.contains('off')) {
        e.preventDefault();
        this.onAction?.();
      }
    });
    this.banner = 0;
    this.hurt = 0;
    this.kick = 0;
    this.popT = 0;
    this.score = 0;
    this._last = {};
    this._magFor = null;
    ctx.events.on('player:damaged', (e) => {
      this.hurt = Math.min(1, this.hurt + 0.35 + e.amount / 50);
      ctx.get('audio').play('hurt');
    });
    ctx.events.on('weapon:fire', () => { this.kick = 1; });
  }

  showScreen({ title, kicker, text, action, small }) {
    const e = this.el;
    e.kk.textContent = kicker ?? '';
    e.h1.textContent = title ?? '';
    e.p.textContent = text ?? '';
    e.go.textContent = action ?? '';
    e.go.style.display = action ? '' : 'none';
    e.small.textContent = small ?? '';
    e.ov.classList.remove('off');
    e.hud.classList.add('off');
  }

  hideScreen() {
    this.el.ov.classList.add('off');
    this.el.hud.classList.remove('off');
  }

  showBanner(text, seconds = 2, sub = '') {
    this.el.bnb.textContent = text;
    this.el.bns.textContent = sub;
    this.banner = seconds;
  }

  setWave(label, value, sub, progress) {
    const e = this.el;
    if (this._last.wl !== label) e.wl.textContent = this._last.wl = label;
    if (this._last.w !== value) e.w.innerHTML = this._last.w = value;
    if (this._last.lf !== sub) e.lf.textContent = this._last.lf = sub;
    e.pr.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  }

  setScore(n, gained = 0) {
    this.score = n;
    if (gained > 0) {
      this.el.pop.textContent = `+${gained}`;
      this.popT = 1;
    }
  }

  update(dt, ctx) {
    const e = this.el;
    const p = ctx.get('player');
    const w = ctx.get('weapons');
    const s = w.current;

    const filled = Math.ceil((p.health / p.maxHealth) * this.segs);
    if (this._last.hp !== filled) {
      this._last.hp = filled;
      e.hpi.forEach((el, i) => el.classList.toggle('e', i >= filled));
      e.hp.classList.toggle('low', filled <= this.segs * 0.3);
    }
    e.dash.style.transform = `scaleX(${1 - p.dashCd / (p.cfg.dashCooldown || 1)})`;

    const sc = String(this.score);
    if (this._last.sc !== sc) e.score.textContent = this._last.sc = sc;
    this.popT = Math.max(0, this.popT - dt * 1.6);
    e.pop.style.opacity = Math.min(1, this.popT * 2);
    e.pop.style.transform = `translateY(${(1 - this.popT) * -10}px)`;

    if (this._last.wn !== s.def.name) e.wn.textContent = this._last.wn = s.def.name;
    const ammo = s.def.magazine ? `${s.ammo}<em>/ ${s.def.magazine}</em>` : '∞';
    if (this._last.ammo !== ammo) e.ammo.innerHTML = this._last.ammo = ammo;
    if (this._magFor !== s.def.id) {
      this._magFor = s.def.id;
      const n = Math.min(40, s.def.magazine ?? 0);
      e.mag.innerHTML = '<i></i>'.repeat(n);
      this._pips = [...e.mag.children];
      this._last.pips = -1;
    }
    const shown = s.def.magazine ? Math.round((s.ammo / s.def.magazine) * this._pips.length) : 0;
    if (this._last.pips !== shown) {
      this._last.pips = shown;
      this._pips.forEach((el, i) => el.classList.toggle('e', i >= shown));
    }
    e.rl.style.transform = `scaleX(${w.reloading > 0 ? w.reloading / (s.def.reload ?? 1) : 0})`;

    // reticle follows the mouse; hidden for touch and when no pointer yet
    const input = ctx.input;
    this.kick = Math.max(0, this.kick - dt * 8);
    if (input.pointer && !input.aimWorld && input.mode === 'mouse' && ctx.get('camera').mode === 'topdown') {
      e.rt.style.opacity = 1;
      e.rt.style.transform = `translate(${input.pointer.x}px,${input.pointer.y}px) scale(${1 + this.kick * 0.35})`;
    } else e.rt.style.opacity = 0;

    this.hurt = Math.max(0, this.hurt - dt * 1.4);
    const low = p.health < p.maxHealth * 0.3 ? 0.3 + Math.sin(ctx.time.elapsed * 5) * 0.08 : 0;
    const hurt = Math.max(this.hurt, low);
    e.dv.style.opacity = hurt;
    ctx.get('render').hurt = hurt * 0.8;

    if (this.banner > 0) {
      this.banner -= dt;
      e.bn.style.opacity = Math.min(1, this.banner * 2.5);
    } else e.bn.style.opacity = 0;
  }
}
