/**
 * Experience, levels and the choice of three. Gems pay experience; each level
 * stops the clock (time.scale 0) and offers three upgrades from the arsenal.
 * Pick with 1, 2 or 3, a click or a tap: every path, and the bot, ends in
 * choose(i). Levels owed while a choice is open queue up behind it.
 *
 * rules.levels = { first, step, growth }  experience for level n+1: first + step*n + growth*n^2
 * rules.filler = [{ id, name, text, apply(ctx) }]  offered when the arsenal has nothing left
 *
 *   levelup.open      levelup.choices      levelup.choose(i)      levelup.grant(n)
 *
 * Events: level:up { level }, level:chosen { option }
 */
const CSS = `
.lu{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:radial-gradient(ellipse at center,#05070b9e 0%,#05070bd8 80%);pointer-events:auto;opacity:0;transition:opacity .15s}
.lu.off{display:none}
.lu.on{opacity:1}
.lu .lk{font-size:12px;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:var(--accent)}
.lu h2{margin:-12px 0 0;font-size:clamp(26px,4vw,44px);font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.lu .cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;padding:0 16px}
.lu .cd{position:relative;width:min(240px,29vw);min-height:190px;padding:20px 18px 18px;border:1px solid #ffffff2a;background:linear-gradient(180deg,#151a22f0,#0b0e13f0);cursor:pointer;transition:transform .12s,border-color .12s;display:flex;flex-direction:column;gap:8px}
.lu .cd:hover{transform:translateY(-4px);border-color:var(--c)}
.lu .cd i{position:absolute;left:0;top:0;right:0;height:3px;background:var(--c);box-shadow:0 0 18px var(--c)}
.lu .cd .ky{position:absolute;right:14px;top:14px;width:24px;height:24px;border:1px solid #ffffff44;font:700 12px/22px var(--font);text-align:center;opacity:.7}
.lu .cd .tg{font-size:10.5px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--c)}
.lu .cd b{font-size:20px;font-weight:800;letter-spacing:.01em;line-height:1.1;padding-right:26px}
.lu .cd p{margin:0;font-size:13.5px;line-height:1.45;opacity:.82}
.lu .cd .pips{margin-top:auto;display:flex;gap:4px}
.lu .cd .pips u{display:block;width:16px;height:4px;background:#ffffff22;text-decoration:none}
.lu .cd .pips u.f{background:var(--c)}
@media (max-width:700px){.lu{gap:12px}.lu .cards{gap:8px}.lu .cd{width:31vw;min-height:150px;padding:14px 10px}.lu .cd b{font-size:15px}.lu .cd p{font-size:11.5px}.lu .cd .ky{display:none}}
`;

export class LevelUpSystem {
  static id = 'levelup';
  static deps = ['arsenal', 'gems', 'audio', 'hud'];

  constructor({ rules }) {
    this.rules = rules;
  }

  init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.className = 'lu off';
    el.innerHTML = `<div class="lk"></div><h2>${this.rules.levelTitle ?? 'Choose one'}</h2><div class="cards"></div>`;
    document.getElementById('ui').appendChild(el);
    this.el = el;
    this.cardsEl = el.querySelector('.cards');
    this.kickerEl = el.querySelector('.lk');
    this.cardsEl.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.cd');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      this.choose(Number(card.dataset.i));
    });
    ctx.events.on('gem:collected', (e) => this.grant(e.value));
    this.reset();
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.next = this._need(1);
    this.owed = 0;
    this.open = false;
    this.choices = [];
    this.picks = 0;
    this.openedAt = 0;
    this._hide();
  }

  /** Put away any open choice (the round ended); the level stays for the end screen. */
  close() {
    this.open = false;
    this.choices = [];
    this.owed = 0;
    this._hide();
  }

  _need(level) {
    const c = this.rules.levels ?? { first: 5, step: 5, growth: 0.6 };
    return Math.round(c.first + c.step * (level - 1) + c.growth * (level - 1) ** 2);
  }

  grant(value) {
    if (this.ctx.get('round').state !== 'playing') return;
    this.xp += value;
    while (this.xp >= this.next) {
      this.xp -= this.next;
      this.level++;
      this.next = this._need(this.level);
      this.owed++;
      this.ctx.events.emit('level:up', { level: this.level });
    }
    if (this.owed && !this.open) this._offer();
  }

  /** Force a level for checks and captures. */
  force() {
    this.grant(this.next - this.xp);
  }

  _offer() {
    const arsenal = this.ctx.get('arsenal');
    const pool = arsenal.options();
    const picks = [];
    // an evolution, when one is ready, is always on the table
    const ev = pool.find((o) => o.kind === 'evolve');
    if (ev) picks.push(ev);
    const rest = pool.filter((o) => o !== ev);
    while (picks.length < 3 && rest.length) {
      // new weapons a little more likely early, so a run finds its shape
      let total = 0;
      for (const o of rest) total += o.def.weight ?? 1;
      let r = this.rng.float() * total;
      let k = 0;
      for (; k < rest.length - 1; k++) {
        r -= rest[k].def.weight ?? 1;
        if (r <= 0) break;
      }
      picks.push(rest.splice(k, 1)[0]);
    }
    for (const f of this.rules.filler ?? []) {
      if (picks.length >= 3) break;
      picks.push({ id: f.id, def: { id: f.id, name: f.name, color: f.color ?? '#e8e2d4', levels: [{}] }, kind: 'filler', text: f.text, level: 1, filler: f });
    }
    this.choices = picks;
    this.open = true;
    this.openedAt = performance.now();
    this.ctx.time.scale = 0;
    this.ctx.get('audio').play('levelup');
    this._show();
  }

  choose(i) {
    if (!this.open || !this.choices[i]) return false;
    const opt = this.choices[i];
    if (opt.kind === 'filler') opt.filler.apply(this.ctx);
    else this.ctx.get('arsenal').take(opt);
    this.picks++;
    this.owed--;
    this.ctx.get('audio').play('pick');
    this.ctx.events.emit('level:chosen', { option: opt });
    this.open = false;
    this.choices = [];
    this._hide();
    if (this.owed > 0) this._offer();
    else this.ctx.time.scale = 1;
    return true;
  }

  _show() {
    const arsenal = this.ctx.get('arsenal');
    this.kickerEl.textContent = `${this.rules.levelKicker ?? 'Level'} ${this.level - this.owed + 1}`;
    this.cardsEl.innerHTML = this.choices.map((o, i) => {
      const max = o.def.levels.length;
      const tag = o.kind === 'new' ? (o.def.kind === 'passive' ? 'New · charm' : 'New') : o.kind === 'evolve' ? 'Evolves' : o.kind === 'filler' ? 'Rest' : `Level ${o.level}`;
      const pips = o.kind === 'filler' || o.kind === 'evolve' ? '' : `<div class="pips">${Array.from({ length: max }, (_, k) => `<u class="${k < o.level ? 'f' : ''}"></u>`).join('')}</div>`;
      void arsenal;
      return `<div class="cd" data-i="${i}" style="--c:${o.def.color ?? '#fff'}"><i></i><span class="ky">${i + 1}</span><span class="tg">${tag}</span><b>${o.def.name}</b><p>${o.text ?? ''}</p>${pips}</div>`;
    }).join('');
    this.el.classList.remove('off');
    // the touch stick covers the screen; lift it so a tap lands on a card
    this.ctx.input.showTouch(false);
    requestAnimationFrame(() => this.el.classList.add('on'));
  }

  _hide() {
    const was = !this.el.classList.contains('off');
    this.el.classList.remove('on');
    this.el.classList.add('off');
    if (was && this.ctx.get('round')?.state === 'playing') this.ctx.input.showTouch(true);
  }

  update(dt, ctx) {
    if (!this.open) return;
    if (ctx.get('round').state !== 'playing') {
      this.open = false;
      this._hide();
      return;
    }
    const input = ctx.input;
    for (let i = 0; i < 3; i++) {
      if (input.pressed(`pick${i + 1}`)) {
        this.choose(i);
        break;
      }
    }
  }
}
