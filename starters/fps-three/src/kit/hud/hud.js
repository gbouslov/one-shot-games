/**
 * DOM heads-up display and game screens. Restyle through config.hud; replace
 * individual pieces by editing this file only if the game needs a different shape.
 */

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--ink);user-select:none;-webkit-user-select:none}
#ui *{box-sizing:border-box}
.hud{position:absolute;inset:0;transition:opacity .2s}
.hud.off{opacity:0}
.xh{position:absolute;left:50%;top:50%;width:0;height:0}
.xh i{position:absolute;background:var(--ink);box-shadow:0 0 2px #000a;opacity:.9}
.xh .t,.xh .b{width:2px;height:8px;left:-1px}
.xh .l,.xh .r{width:8px;height:2px;top:-1px}
.xh .d{width:2px;height:2px;left:-1px;top:-1px}
.hm{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.hm i{position:absolute;width:12px;height:2px;background:var(--ink);left:-6px;top:-1px}
.hm.head i{background:var(--accent)}
.hm i:nth-child(1){transform:rotate(45deg) translateX(14px)}
.hm i:nth-child(2){transform:rotate(135deg) translateX(14px)}
.hm i:nth-child(3){transform:rotate(225deg) translateX(14px)}
.hm i:nth-child(4){transform:rotate(315deg) translateX(14px)}
.st{position:absolute;left:28px;bottom:26px;width:min(280px,42vw)}
.st b{display:block;font-weight:700;font-size:13px;letter-spacing:.04em;text-shadow:0 1px 3px #000a;margin-bottom:6px}
.bar{height:8px;background:#0007;border-radius:2px;overflow:hidden}
.bar u{display:block;height:100%;background:var(--accent);transform-origin:left;text-decoration:none}
.am{position:absolute;right:28px;bottom:24px;text-align:right;text-shadow:0 1px 3px #000a}
.am b{font-size:38px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
.am em{font-style:normal;font-size:15px;opacity:.75;margin-left:6px;font-variant-numeric:tabular-nums}
.am span{display:block;font-size:12px;letter-spacing:.06em;opacity:.8;margin-top:4px}
.wv{position:absolute;top:22px;left:50%;transform:translateX(-50%);font-size:13px;letter-spacing:.08em;text-shadow:0 1px 3px #000a;white-space:nowrap}
.bn{position:absolute;top:26%;left:50%;transform:translateX(-50%);font-size:clamp(26px,5vw,52px);font-weight:800;letter-spacing:.02em;text-shadow:0 2px 16px #000b;opacity:0;white-space:nowrap}
.dv{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,var(--hurt) 130%);opacity:0}
.da{position:absolute;left:50%;top:50%;width:220px;height:220px;margin:-110px;opacity:0}
.da:after{content:"";position:absolute;left:50%;top:0;width:90px;height:14px;margin-left:-45px;border-radius:50%;background:var(--hurt);filter:blur(6px)}
.ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--scrim);pointer-events:auto;cursor:pointer;text-align:center;padding:24px}
.ov.off{display:none}
.ov h1{font-size:clamp(36px,8vw,84px);line-height:1.02;margin:0 0 10px;font-weight:800;letter-spacing:-.01em}
.ov p{margin:0 auto 18px;max-width:560px;font-size:clamp(15px,2vw,18px);opacity:.92}
.ov .go{display:inline-block;padding:13px 28px;background:var(--accent);color:#120d08;font-weight:800;border-radius:4px;font-size:17px}
.ov small{display:block;margin-top:20px;font-size:13px;opacity:.72;line-height:1.7}
.ov small.cr{margin:14px auto 0;font-size:10.5px;opacity:.5;line-height:1.5;max-width:52em}
.hud.shoot .da{display:none}
.tc{position:absolute;right:18px;bottom:96px;display:none;grid-template-columns:repeat(2,64px);gap:12px;pointer-events:auto}
.tc button{width:64px;height:64px;border-radius:50%;border:1px solid #fff5;background:#0005;color:#fff;font:700 12px var(--font);touch-action:none}
.touch .tc{display:grid}
`;

export class HudSystem {
  static id = 'hud';
  static deps = ['player', 'weapons'];

  init(ctx) {
    this.ctx = ctx;
    const cfg = ctx.config;
    const h = cfg.hud ?? {};
    const style = document.createElement('style');
    style.textContent = `:root{--accent:${h.accent ?? '#ffb65c'};--ink:${h.ink ?? '#fff4e6'};--hurt:${h.hurt ?? '#a01515'};--scrim:${h.scrim ?? 'rgba(10,8,6,.55)'};--font:${h.font ?? '"Trebuchet MS","Helvetica Neue",Arial,sans-serif'}}${CSS}`;
    document.head.appendChild(style);

    const root = document.getElementById('ui');
    root.innerHTML = `
      <div class="hud off">
        <div class="dv"></div><div class="da"></div>
        <div class="xh"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i></div>
        <div class="hm"><i></i><i></i><i></i><i></i></div>
        <div class="wv"></div><div class="bn"></div>
        <div class="st"><b class="hp"></b><div class="bar"><u></u></div></div>
        <div class="am"><b></b><em></em><span></span></div>
        <div class="tc">
          <button data-c="KeyR">RELOAD</button><button data-c="KeyQ">SWAP</button>
          <button data-c="Space">JUMP</button><button data-c="KeyF">FIRE</button>
        </div>
      </div>
      <div class="ov"><div><h1></h1><p></p><span class="go"></span><small></small><small class="cr"></small></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      hud: q('.hud'), hmBox: q('.hm'), dv: q('.dv'), da: q('.da'), wv: q('.wv'), bn: q('.bn'),
      hp: q('.hp'), bar: q('.bar u'), ammo: q('.am b'), reserve: q('.am em'), wname: q('.am span'),
      ov: q('.ov'), h1: q('.ov h1'), p: q('.ov p'), go: q('.go'), small: q('.ov small'),
      xt: q('.xh .t'), xb: q('.xh .b'), xl: q('.xh .l'), xr: q('.xh .r'),
    };
    // Attribution for licensed assets (CC-BY needs it where the work is shown): every
    // weapon's `viewmodel.credit` plus config `credits`, one small line on each screen.
    const credits = new Set([...(ctx.peek('weapons')?.defs ?? []).map((d) => d.viewmodel?.credit), ...(cfg.credits ?? [])].filter(Boolean));
    q('.ov small.cr').textContent = [...credits].join(' · ');
    if ('ontouchstart' in window) root.classList.add('touch');
    root.querySelectorAll('.tc button').forEach((b) => {
      const code = b.dataset.c;
      const down = (e) => { e.preventDefault(); ctx.input.virtual(code, true); };
      const up = (e) => { e.preventDefault(); ctx.input.virtual(code, false); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
    });

    // The shooter HUD (minimap, compass, objective, score, weapon block...): opt-in through
    // config.hud.shooter = shooterHud({...}) from ./shooter-hud.js, so games without it don't bundle it.
    this.shooter = h.shooter?.Hud ? new h.shooter.Hud(ctx, this, h.shooter) : null;

    this.onAction = null;
    this.el.ov.addEventListener('click', () => this.onAction?.());

    this.hm = 0;
    this.hurt = 0;
    this.dir = 0;
    this.banner = 0;
    this.spread = 0;
    this._last = {};

    ctx.events.on('enemy:hit', (e) => {
      this.hm = 1;
      this.el.hmBox.classList.toggle('head', !!e.head);
    });
    ctx.events.on('player:damaged', (e) => {
      this.hurt = Math.min(1, this.hurt + 0.3 + e.amount / 60);
      if (e.direction !== null) {
        this.dir = 1;
        this.el.da.style.transform = `rotate(${-e.direction}rad)`;
      }
      ctx.get('audio').play('hurt');
    });
    ctx.events.on('weapon:fire', () => { this.spread = 1; });
  }

  showScreen({ title, text, action, small }) {
    const e = this.el;
    e.h1.textContent = title;
    e.p.textContent = text ?? '';
    e.go.textContent = action ?? '';
    e.small.textContent = small ?? '';
    e.ov.classList.remove('off');
    e.hud.classList.add('off');
  }

  hideScreen() {
    this.el.ov.classList.add('off');
    this.el.hud.classList.remove('off');
  }

  showBanner(text, seconds = 1.8) {
    this.el.bn.textContent = text;
    this.banner = seconds;
  }

  setStatus(text) {
    if (this.shooter) return;
    if (this._last.wv !== text) this.el.wv.textContent = this._last.wv = text;
  }

  update(dt, ctx) {
    const e = this.el;
    const p = ctx.get('player');
    const w = ctx.get('weapons').current;
    const reloading = ctx.get('weapons').reloading > 0;

    const hpText = `HEALTH ${Math.ceil(p.health)}`;
    if (this._last.hp !== hpText) e.hp.textContent = this._last.hp = hpText;
    e.bar.style.transform = `scaleX(${p.health / p.maxHealth})`;

    const ammo = w.def.magazine ? String(w.ammo) : '';
    if (this._last.ammo !== ammo) e.ammo.textContent = this._last.ammo = ammo;
    const reserve = w.def.magazine && w.reserve !== Infinity ? `/ ${w.reserve}` : '';
    if (this._last.reserve !== reserve) e.reserve.textContent = this._last.reserve = reserve;
    const label = reloading ? 'RELOADING' : w.def.name.toUpperCase();
    if (this._last.label !== label) e.wname.textContent = this._last.label = label;

    this.spread = Math.max(0, this.spread - dt * 7);
    const gap = 5 + this.spread * 9 + Math.min(1, p.speed / 8) * 6;
    e.xt.style.top = `${-gap - 8}px`;
    e.xb.style.top = `${gap}px`;
    e.xl.style.left = `${-gap - 8}px`;
    e.xr.style.left = `${gap}px`;

    this.hm = Math.max(0, this.hm - dt * 5.5);
    e.hmBox.style.opacity = this.hm;
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    const low = p.health < p.maxHealth * 0.3 ? 0.35 : 0;
    const hurt = Math.max(this.hurt, low);
    e.dv.style.opacity = hurt;
    this.dir = Math.max(0, this.dir - dt * 1.4);
    e.da.style.opacity = this.dir;
    ctx.get('render').hurt = hurt;

    this.shooter?.update(dt, ctx);

    if (this.banner > 0) {
      this.banner -= dt;
      e.bn.style.opacity = Math.min(1, this.banner * 3);
    } else {
      e.bn.style.opacity = 0;
    }
  }
}
