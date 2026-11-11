/**
 * The heads-up display and the title, win and lose screens, in the DOM over the
 * canvas. For a survivors-like: the clock is the biggest thing on screen, the
 * level and its experience bar sit under it, health bottom left, what you carry
 * bottom right, a boss bar when one is out. Colours and the font come from
 * config.hud; the words from src/game/rules.js.
 *
 *   hud.showScreen({ title, kicker, text, action, small, credits })   hud.hideScreen()
 *   hud.showBanner(text, seconds, sub)
 *   hud.setClock(left, total)   hud.setScore(n)
 */
const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--ink);user-select:none;-webkit-user-select:none;font-variant-numeric:tabular-nums}
#ui *{box-sizing:border-box}
.hud{position:absolute;inset:0;transition:opacity .25s}
.hud.off{opacity:0}
.k{font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.62}
.xp{position:absolute;left:0;right:0;top:0;height:5px;background:#ffffff14}
.xp u{display:block;height:100%;background:linear-gradient(90deg,var(--xp),#fff);transform-origin:left;transform:scaleX(0);text-decoration:none;box-shadow:0 0 12px var(--xp);transition:transform .15s}
.ck{position:absolute;left:50%;top:20px;transform:translateX(-50%);text-align:center}
.ck .t{font-size:40px;font-weight:800;letter-spacing:.04em;line-height:1;margin-top:4px;text-shadow:0 2px 18px #000a}
.ck .t.end{color:var(--accent)}
.bb{position:absolute;left:50%;top:92px;transform:translateX(-50%);width:min(440px,60vw);text-align:center;opacity:0;transition:opacity .3s}
.bb.on{opacity:1}
.bb .n{font-size:11px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:var(--hurt);filter:brightness(1.6)}
.bb .bar{margin-top:6px;height:6px;background:#ffffff18;border:1px solid #ffffff22}
.bb .bar u{display:block;height:100%;background:var(--hurt);transform-origin:left;text-decoration:none;filter:brightness(1.3)}
.tl{position:absolute;left:28px;top:24px}
.tl .lv{font-size:26px;font-weight:800;letter-spacing:.04em;margin-top:2px}
.tl .lv em{font-style:normal;font-size:12px;font-weight:700;opacity:.5;letter-spacing:.18em;margin-right:6px}
.tr{position:absolute;right:28px;top:24px;text-align:right}
.tr .s{font-size:26px;font-weight:800;letter-spacing:.02em;margin-top:2px}
.bl{position:absolute;left:28px;bottom:26px}
.bl .hp{display:flex;gap:3px;margin-top:7px}
.bl .hp i{display:block;width:17px;height:6px;background:var(--ink);opacity:.9;transition:opacity .15s,background .15s}
.bl .hp i.e{opacity:.14}
.bl .hp.low i{background:var(--hurt)}
.br{position:absolute;right:28px;bottom:24px;text-align:right}
.br .kit{display:flex;flex-direction:column;gap:5px;margin-top:8px;align-items:flex-end}
.br .kit div{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.04em}
.br .kit div s{text-decoration:none;font-size:10.5px;letter-spacing:.16em;opacity:.6}
.br .kit div b{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c)}
.bn{position:absolute;top:30%;left:0;right:0;text-align:center;opacity:0;transition:opacity .2s}
.bn b{display:block;font-size:clamp(28px,4.6vw,54px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 2px 24px #000c}
.bn span{display:block;margin-top:8px;font-size:13px;letter-spacing:.26em;text-transform:uppercase;opacity:.75}
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
.ov .cr{position:absolute;right:18px;bottom:12px;font-size:10.5px;opacity:.4;letter-spacing:.04em}
@media (max-width:700px){.tl,.tr{top:14px}.tl{left:16px}.tr{right:16px}.ck{top:12px}.ck .t{font-size:30px}.bb{top:70px}.bl{left:16px;bottom:14px}.br{right:16px;bottom:12px}.ov{padding:0 0 6vh 6vw}}
`;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export class HudSystem {
  static id = 'hud';
  static deps = ['player'];

  init(ctx) {
    this.ctx = ctx;
    const h = ctx.config.hud ?? {};
    this.h = h;
    const style = document.createElement('style');
    style.textContent = `:root{--accent:${h.accent ?? '#ffb347'};--ink:${h.ink ?? '#f3efe8'};--hurt:${h.hurt ?? '#b3121b'};--xp:${h.xp ?? '#6ff5c8'};--scrim:${h.scrim ?? 'rgba(6,8,12,.86)'};--font:${h.font ?? 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'}}${CSS}`;
    document.head.appendChild(style);
    const segs = h.healthSegments ?? 10;
    this.segs = segs;
    const root = document.getElementById('ui');
    root.innerHTML = `
      <div class="hud off">
        <div class="dv"></div>
        <div class="xp"><u></u></div>
        <div class="ck"><div class="k">${h.clockLabel ?? 'Survive'}</div><div class="t">0:00</div></div>
        <div class="bb"><div class="n"></div><div class="bar"><u></u></div></div>
        <div class="tl"><div class="k">${h.levelLabel ?? 'Level'}</div><div class="lv">1</div></div>
        <div class="tr"><div class="k">${h.scoreLabel ?? 'Kills'}</div><div class="s">0</div></div>
        <div class="bl"><div class="k">${h.healthLabel ?? 'Vitals'}</div><div class="hp">${'<i></i>'.repeat(segs)}</div></div>
        <div class="br"><div class="k">${h.kitLabel ?? 'Carried'}</div><div class="kit"></div></div>
        <div class="bn"><b></b><span></span></div>
      </div>
      <div class="ov"><div class="in"><div class="kk"></div><h1></h1><p></p><span class="go"></span><small></small></div><div class="cr"></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      hud: q('.hud'), dv: q('.dv'), xp: q('.xp u'), clock: q('.ck .t'), bb: q('.bb'), bbn: q('.bb .n'), bbu: q('.bb .bar u'),
      lv: q('.tl .lv'), score: q('.tr .s'), hp: q('.bl .hp'), hpi: [...root.querySelectorAll('.bl .hp i')], kit: q('.br .kit'),
      bn: q('.bn'), bnb: q('.bn b'), bns: q('.bn span'),
      ov: q('.ov'), kk: q('.ov .kk'), h1: q('.ov h1'), p: q('.ov p'), go: q('.ov .go'), small: q('.ov small'), cr: q('.ov .cr'),
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
    this.score = 0;
    this._last = {};
    ctx.events.on('player:damaged', (e) => {
      this.hurt = Math.min(1, this.hurt + 0.25 + e.amount / 40);
      ctx.get('audio').play('hurt');
    });
  }

  showScreen({ title, kicker, text, action, small, credits }) {
    const e = this.el;
    e.kk.textContent = kicker ?? '';
    e.h1.textContent = title ?? '';
    e.p.textContent = text ?? '';
    e.go.textContent = action ?? '';
    e.go.style.display = action ? '' : 'none';
    e.small.textContent = small ?? '';
    e.cr.textContent = credits ?? '';
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

  setScore(n) {
    this.score = n;
  }

  update(dt, ctx) {
    const e = this.el;
    const p = ctx.get('player');
    const round = ctx.get('round');
    const lu = ctx.peek('levelup');
    const arsenal = ctx.peek('arsenal');
    const horde = ctx.peek('horde');

    const filled = Math.ceil((p.health / p.maxHealth) * this.segs);
    if (this._last.hp !== filled) {
      this._last.hp = filled;
      e.hpi.forEach((el, i) => el.classList.toggle('e', i >= filled));
      e.hp.classList.toggle('low', filled <= this.segs * 0.3);
    }
    const sc = String(this.score);
    if (this._last.sc !== sc) e.score.textContent = this._last.sc = sc;

    if (round) {
      const left = Math.max(0, round.duration - round.elapsed);
      const txt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      if (this._last.ck !== txt) {
        e.clock.textContent = this._last.ck = txt;
        e.clock.classList.toggle('end', left < 30);
      }
    }
    if (lu) {
      const lv = `<em>LV</em>${lu.level}`;
      if (this._last.lv !== lv) e.lv.innerHTML = this._last.lv = lv;
      e.xp.style.transform = `scaleX(${Math.min(1, lu.xp / lu.next)})`;
    }
    if (arsenal) {
      const key = arsenal.owned.map((o) => `${o.def.id}${o.level}`).join();
      if (this._last.kit !== key) {
        this._last.kit = key;
        e.kit.innerHTML = arsenal.owned.map((o) => `<div style="--c:${o.def.color}">${o.def.name}<s>${o.def.evolution ? '★' : ROMAN[o.level]}</s><b></b></div>`).join('');
      }
    }
    const boss = horde?.boss;
    e.bb.classList.toggle('on', !!boss);
    if (boss) {
      if (this._last.bn !== boss.def.name) e.bbn.textContent = this._last.bn = boss.def.name;
      e.bbu.style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
    }

    this.hurt = Math.max(0, this.hurt - (dt || 0.016) * 1.4);
    const low = p.health < p.maxHealth * 0.3 ? 0.3 + Math.sin(ctx.time.raw * 5) * 0.08 : 0;
    const hurt = Math.max(this.hurt, low);
    e.dv.style.opacity = hurt;
    ctx.get('render').hurt = hurt * 0.8;

    if (this.banner > 0) {
      this.banner -= dt;
      e.bn.style.opacity = Math.min(1, this.banner * 2.5);
    } else e.bn.style.opacity = 0;
  }
}
