/**
 * The shooter HUD: minimap, compass, objective, wave bar, score and chain, stance,
 * segmented health, weapon block, contact arcs, radio subtitles, an interaction
 * prompt and a map intro card. Opt in with `config.hud.shooter = shooterHud({ ... })` (import it from this file; hud.js never does, so games without it don't bundle it); a game
 * that sets nothing keeps the plain HUD in hud.js.
 *
 *   config.hud.shooter = shooterHud({
 *     north: 0,                 // world yaw (radians) that reads as N on the compass (0 = -Z)
 *     mapRange: 26,             // metres from the player to the minimap's edge
 *     chainWindow: 4,           // seconds a kill keeps the chain alive
 *     killScore: 100, headBonus: 50,
 *     voice: 'DISPATCH',        // who talks on the radio
 *   })
 *   level.minimap = { rects: [[x, z, w, d, rotY?], ...], walls: [[x0, z0, x1, z1], ...] }
 *   weapon def: hudName, calibre, silhouette ('rifle' | 'smg' | 'pistol' | 'blade' | 'shotgun')
 *
 * Calls a game makes through ctx.get('hud'):
 *   setObjective(text, count, fraction)   radio(text, seconds)   prompt(text, fraction)
 *   contact(x, z)   addScore(n)   intro({ kicker, title, sub }, seconds)
 *   markers = [{ x, z, done, label }]   (objective markers on the minimap and compass)
 */

const SIL = {
  rifle: 'M2 9h6l1-2h20l2-1h8v2h6v2h-6l-2 2h-6l-1 5h-3l1-5h-6l-2 4h-4l1-4H9l-2 3H2z',
  smg: 'M4 8h4l1-2h18l1 1h9v2h4v2h-4l-1 1h-5v3h-3v-3h-6l-1 6h-4l1-6h-3l-2 2H8l1-3H4z',
  pistol: 'M14 6h22v4H26l-1 2h-4l-2 8h-5l2-8-4-2z',
  shotgun: 'M2 9h8l2-2h30v2h4v2h-4v1H26l-2 2h-6l-2-2h-4l-3 4H5l2-5H2z',
  blade: 'M2 11l4-3h4l2 1h28l6 1-6 2H12l-2 1H6z',
};

const CSS = `
.sh{position:absolute;inset:0;font-family:var(--shfont);color:var(--ink);text-shadow:0 1px 2px #000c}
.sh .lbl{font-size:10.5px;letter-spacing:.22em;font-weight:500;opacity:.78;text-transform:uppercase}
.sh .mm{position:absolute;left:24px;top:22px;width:172px;height:172px;border-radius:50%;overflow:hidden;background:rgba(6,10,16,.5);box-shadow:inset 0 0 0 1px rgba(220,235,255,.32),0 0 0 3px rgba(0,0,0,.18)}
.sh .mm canvas{width:100%;height:100%;display:block}
.sh .ob{position:absolute;left:24px;top:206px;width:260px}
.sh .ob .t{font-size:12.5px;letter-spacing:.16em;font-weight:600;white-space:nowrap}
.sh .ob .t i{font-style:normal;color:var(--accent);margin-right:8px}
.sh .ob .t em{font-style:normal;color:var(--warn);margin-left:10px;font-variant-numeric:tabular-nums}
.sh .ob .bar{height:2px;margin-top:7px;width:172px;background:rgba(255,255,255,.16)}
.sh .ob .bar u{display:block;height:100%;background:var(--warn);transform-origin:left;transform:scaleX(0)}
.sh .ob .s{margin-top:6px;font-size:10.5px;letter-spacing:.18em;opacity:.7}
.sh .cp{position:absolute;left:50%;top:16px;width:440px;margin-left:-220px;height:36px;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)}
.sh .cp .strip{position:absolute;top:0;left:0;height:100%}
.sh .cp b{position:absolute;top:2px;transform:translateX(-50%);font-size:11px;font-weight:600;letter-spacing:.1em}
.sh .cp b.n{font-size:10px;font-weight:400;opacity:.55;top:3px}
.sh .cp s{position:absolute;top:17px;width:1px;height:5px;background:var(--ink);opacity:.5;text-decoration:none}
.sh .cp s.m{height:8px;top:16px;opacity:.85}
.sh .cp .pip{position:absolute;top:27px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--warn)}
.sh .cp .pip.o{border-radius:0;transform:rotate(45deg);background:var(--obj);width:6px;height:6px;margin-left:-3px;top:26px}
.sh .caret{position:absolute;left:50%;top:13px;margin-left:-5px;border:5px solid transparent;border-top:6px solid var(--ink);border-bottom:0}
.sh .wb{position:absolute;left:50%;top:56px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;white-space:nowrap}
.sh .wb .n{font-size:22px;font-weight:300;font-variant-numeric:tabular-nums;letter-spacing:.04em}
.sh .wb .bar{width:170px;height:2px;background:rgba(255,255,255,.18)}
.sh .wb .bar u{display:block;height:100%;background:var(--warn);transform-origin:left}
.sh .sc{position:absolute;right:26px;top:20px;text-align:right}
.sh .sc .v{font-size:40px;font-weight:300;line-height:1.05;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.sh .sc .ch{font-size:12px;letter-spacing:.2em;font-weight:700;color:var(--warn);opacity:0;transition:opacity .2s}
.sh .sc .chb{height:2px;width:150px;margin:4px 0 0 auto;background:var(--warn);transform-origin:right;transform:scaleX(0)}
.sh .hp{position:absolute;left:26px;bottom:24px}
.sh .hp .stn{display:flex;align-items:center;gap:6px}
.sh .hp .v{font-size:44px;font-weight:300;line-height:1;font-variant-numeric:tabular-nums;margin:2px 0 8px}
.sh .hp .v i{font-style:normal;font-size:22px;opacity:.75;margin-right:6px;vertical-align:8px}
.sh .hp .seg{display:flex;gap:3px;width:300px}
.sh .hp .seg u{flex:1;height:4px;background:var(--ink);opacity:.9;text-decoration:none}
.sh .hp .seg u.off{opacity:.16}
.sh .hp.low .seg u{background:var(--hurtc)}
.sh .wp{position:absolute;right:26px;bottom:20px;text-align:right;width:260px}
.sh .wp .nm{display:flex;justify-content:flex-end;align-items:center;gap:8px}
.sh .wp .tag{font-size:9.5px;letter-spacing:.14em;border:1px solid rgba(255,255,255,.4);padding:1px 5px;opacity:.75}
.sh .wp svg{display:block;margin:6px 0 4px auto;width:120px;height:34px;fill:var(--ink);opacity:.92}
.sh .wp .pips{display:flex;flex-wrap:wrap-reverse;justify-content:flex-end;gap:2px;margin:0 0 6px auto;max-width:180px}
.sh .wp .pips u{width:3px;height:10px;background:var(--ink);text-decoration:none}
.sh .wp .pips u.off{opacity:.18}
.sh .wp .rd{display:flex;justify-content:flex-end;align-items:baseline;gap:10px}
.sh .wp .rd .a{font-size:46px;font-weight:300;line-height:.95;font-variant-numeric:tabular-nums}
.sh .wp .rd .a.low{color:var(--warn)}
.sh .wp .rd .r{font-size:18px;font-weight:300;opacity:.7;font-variant-numeric:tabular-nums}
.sh .ct{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.sh .ct .arc{position:absolute;left:-130px;top:-130px;width:260px;height:260px;border-radius:50%;border:3px solid transparent;border-top-color:var(--hurtc);filter:drop-shadow(0 0 4px var(--hurtc))}
.sh .ctl{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-size:15px;letter-spacing:.24em;font-weight:700;color:var(--hurtc);opacity:0;white-space:nowrap}
.sh .rad{position:absolute;left:50%;bottom:88px;transform:translateX(-50%);max-width:min(680px,80vw);padding:7px 14px;background:rgba(4,7,12,.62);font-size:15px;line-height:1.4;opacity:0;transition:opacity .25s;text-align:center}
.sh .rad b{color:var(--accent);letter-spacing:.14em;font-size:12px;margin-right:10px;font-weight:700}
.sh .pr{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);text-align:center;opacity:0;white-space:nowrap}
.sh .pr .t{font-size:12px;letter-spacing:.22em;font-weight:600}
.sh .pr .bar{width:150px;height:3px;margin:7px auto 0;background:rgba(255,255,255,.2)}
.sh .pr .bar u{display:block;height:100%;background:var(--obj);transform-origin:left}
.sh .in{position:absolute;left:6vw;bottom:15vh;opacity:0;transition:opacity .6s}
.sh .in .k{font-size:12px;letter-spacing:.3em;color:var(--warn);font-weight:600}
.sh .in .h{font-size:clamp(30px,4.4vw,58px);letter-spacing:.14em;font-weight:600;margin:6px 0 4px;line-height:1.05}
.sh .in .s{font-size:12.5px;letter-spacing:.28em;opacity:.8}
.sh .in .ln{width:64px;height:2px;background:var(--warn);margin-bottom:12px}
.hud.shoot>.st,.hud.shoot>.am,.hud.shoot>.wv{display:none}
.hud.introing .sh>*:not(.in),.hud.introing .xh,.hud.introing .bn{visibility:hidden}
.hud.shoot .bn{font-weight:500;letter-spacing:.2em;font-size:clamp(20px,3.2vw,34px);top:22%}
`;

/** The config entry: the options plus the class. */
export const shooterHud = (opts = {}) => ({ ...opts, Hud: ShooterHud });

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIR_WORDS = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];
const PX_PER_DEG = 3.1;
const wrapDeg = (d) => ((d % 360) + 540) % 360 - 180;

export class ShooterHud {
  constructor(ctx, hud, opts) {
    this.ctx = ctx;
    this.hud = hud;
    this.o = { north: 0, mapRange: 26, chainWindow: 4, killScore: 100, headBonus: 50, voice: 'RADIO', ...opts };
    const h = ctx.config.hud ?? {};
    const style = document.createElement('style');
    style.textContent = `:root{--warn:${h.warn ?? '#f2a23a'};--obj:${h.objective ?? '#7fe0ff'};--hurtc:${h.contact ?? '#ff4a3a'};--shfont:${h.shooterFont ?? '"Bahnschrift","DIN Alternate","Roboto Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif'}}${CSS}`;
    document.head.appendChild(style);

    const root = hud.el.hud;
    root.classList.add('shoot');
    const box = document.createElement('div');
    box.className = 'sh';
    let ticks = '';
    // three turns of strip so it can scroll either way without running out
    for (let deg = -360; deg <= 720; deg += 15) {
      const x = (deg + 360) * PX_PER_DEG;
      const d = ((deg % 360) + 360) % 360;
      if (d % 45 === 0) ticks += `<b style="left:${x}px">${DIRS[d / 45]}</b><s class="m" style="left:${x}px"></s>`;
      else ticks += `<b class="n" style="left:${x}px">${d}</b><s style="left:${x}px"></s>`;
    }
    const seg = Array.from({ length: 10 }, () => '<u></u>').join('');
    box.innerHTML = `
      <div class="mm"><canvas width="344" height="344"></canvas></div>
      <div class="ob"><div class="t"><i>&#9670;</i><span></span><em></em></div><div class="bar"><u></u></div><div class="s"></div></div>
      <div class="cp"><div class="strip">${ticks}</div><div class="pips"></div></div><div class="caret"></div>
      <div class="wb"><span class="lbl">WAVE</span><span class="n">01</span><div class="bar"><u></u></div><span class="lbl rem"></span></div>
      <div class="sc"><div class="lbl">SCORE</div><div class="v">0</div><div class="ch"></div><div class="chb"></div></div>
      <div class="hp"><div class="stn lbl"><span>&#9650;</span><span class="sv">STAND</span></div><div class="v"><i>+</i><span>100</span></div><div class="seg">${seg}</div></div>
      <div class="wp"><div class="nm"><span class="tag"></span><span class="lbl wn"></span></div><svg viewBox="0 0 48 22"><path></path></svg><div class="pips"></div><div class="rd"><span class="lbl fm"></span><span class="a"></span><span class="r"></span></div></div>
      <div class="ct"><div class="arc"></div></div><div class="ctl"></div>
      <div class="rad"><b></b><span></span></div>
      <div class="pr"><div class="t"></div><div class="bar"><u></u></div></div>
      <div class="in"><div class="ln"></div><div class="k"></div><div class="h"></div><div class="s"></div></div>`;
    root.appendChild(box);
    const q = (s) => box.querySelector(s);
    this.el = {
      map: q('.mm canvas'), obT: q('.ob .t span'), obC: q('.ob .t em'), obBar: q('.ob .bar u'), obS: q('.ob .s'), ob: q('.ob'),
      strip: q('.cp .strip'), pips: q('.cp .pips'),
      wn: q('.wb .n'), wbar: q('.wb .bar u'), wrem: q('.wb .rem'), wb: q('.wb'),
      sc: q('.sc .v'), ch: q('.sc .ch'), chb: q('.sc .chb'),
      hp: q('.hp'), hpv: q('.hp .v span'), seg: [...box.querySelectorAll('.hp .seg u')], stance: q('.hp .sv'),
      tag: q('.wp .tag'), wname: q('.wp .wn'), sil: q('.wp svg path'), mag: q('.wp .pips'), fm: q('.wp .fm'), ammo: q('.wp .a'), res: q('.wp .r'),
      ct: q('.ct'), arc: q('.ct .arc'), ctl: q('.ctl'),
      rad: q('.rad'), radWho: q('.rad b'), radText: q('.rad span'),
      pr: q('.pr'), prT: q('.pr .t'), prBar: q('.pr .bar u'),
      intro: q('.in'), inK: q('.in .k'), inH: q('.in .h'), inS: q('.in .s'),
    };
    this.g = this.el.map.getContext('2d');
    this.markers = [];
    this.score = 0;
    this.chain = 0;
    this.chainT = 0;
    this.contactT = 0;
    this.radioT = 0;
    this.promptT = 0;
    this.introT = 0;
    this._last = {};
    this._pipEls = [];
    this._magFor = null;
    this.setObjective('', '', null);

    ctx.events.on('enemy:hit', (e) => {
      if (!e.kill) return;
      this.chain = this.chainT > 0 ? this.chain + 1 : 1;
      this.chainT = this.o.chainWindow;
      this.score += (this.o.killScore + (e.head ? this.o.headBonus : 0)) * Math.min(this.chain, 9);
    });
    ctx.events.on('player:damaged', (e) => {
      if (e.direction === null) return;
      this._showContact(-e.direction, this._bearingWord(e.direction));
    });
    ctx.events.on('round:spawn', (e) => this.contact(e.x, e.z, true));
    ctx.events.on('round:state', (e) => {
      if (e.state === 'playing') { this.score = 0; this.chain = 0; this.chainT = 0; }
    });
  }

  /* ---- calls for games ---------------------------------------------------------- */

  setObjective(text, count = '', fraction = null, sub = '') {
    const e = this.el;
    e.ob.style.display = text ? '' : 'none';
    if (this._last.obT !== text) e.obT.textContent = this._last.obT = text;
    if (this._last.obC !== count) e.obC.textContent = this._last.obC = count;
    if (this._last.obS !== sub) e.obS.textContent = this._last.obS = sub;
    e.obBar.parentElement.style.display = fraction === null ? 'none' : '';
    if (fraction !== null) e.obBar.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
  }

  radio(text, seconds = 4.5, who = this.o.voice) {
    this.el.radWho.textContent = `${who}`;
    this.el.radText.textContent = text;
    this.radioT = seconds;
    const a = this.ctx.peek('audio');
    if (a?.voices?.radio) a.play('radio');
  }

  prompt(text, fraction = null) {
    if (this._last.pr !== text) this.el.prT.textContent = this._last.pr = text;
    this.el.prBar.parentElement.style.display = fraction === null ? 'none' : '';
    if (fraction !== null) this.el.prBar.style.transform = `scaleX(${fraction})`;
    this.promptT = 0.15;
  }

  addScore(n) { this.score += n; }

  setWave(n, remaining, fraction) {
    const num = String(n).padStart(2, '0');
    if (this._last.wn !== num) this.el.wn.textContent = this._last.wn = num;
    const rem = remaining === null ? 'CLEAR' : `${remaining} REMAINING`;
    if (this._last.wrem !== rem) this.el.wrem.textContent = this._last.wrem = rem;
    this.el.wbar.style.transform = `scaleX(${fraction})`;
  }

  intro({ kicker = '', title = '', sub = '' }, seconds = 4) {
    this.el.inK.textContent = kicker;
    this.el.inH.textContent = title;
    this.el.inS.textContent = sub;
    this.introT = seconds;
  }

  endIntro() { this.introT = Math.min(this.introT, 0.01); }

  /** Flash the contact arc if (x, z) is off screen. `spawn` marks a new arrival. */
  contact(x, z, spawn = false) {
    const p = this.ctx.get('player');
    const rel = Math.atan2(x - p.feet.x, z - p.feet.z) - p.yaw;
    const relScreen = -rel + Math.PI; // 0 = straight ahead
    const ahead = Math.abs(wrapDeg((relScreen * 180) / Math.PI)) < 42;
    if (spawn && ahead) return;
    this._showContact(relScreen - Math.PI, this._bearingWord(rel), spawn ? 0.75 : 1);
  }

  /* ---- internals ----------------------------------------------------------------- */

  _bearingWord(rel) {
    const p = this.ctx.get('player');
    // world bearing of the source: rel + yaw is atan2(dx, dz); north is -Z
    const ang = rel + p.yaw;
    const brg = ((((180 - (ang * 180) / Math.PI) - (this.o.north * 180) / Math.PI) % 360) + 360) % 360;
    return DIR_WORDS[Math.round(brg / 45) % 8];
  }

  _showContact(screenAngle, word, strength = 1) {
    this.el.arc.style.transform = `rotate(${screenAngle + Math.PI}rad)`;
    this.el.ctl.textContent = `CONTACT – ${word}`;
    this.contactT = 1.6 * strength;
  }

  _heading() {
    const p = this.ctx.get('player');
    return ((((-p.yaw - this.o.north) * 180) / Math.PI) % 360 + 360) % 360;
  }

  _bearingTo(x, z) {
    const p = this.ctx.get('player');
    const deg = (Math.atan2(x - p.feet.x, -(z - p.feet.z)) * 180) / Math.PI - (this.o.north * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  }

  _drawMap(level) {
    const g = this.g;
    const S = this.el.map.width;
    const p = this.ctx.get('player');
    const k = S / 2 / this.o.mapRange;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    // player heading up: rotate the world by the player's yaw
    g.rotate(p.yaw);
    g.scale(k, k);
    g.translate(-p.feet.x, -p.feet.z);
    const mm = level?.minimap;
    if (mm) {
      g.fillStyle = 'rgba(210,225,245,.07)';
      const b = level.bounds;
      if (b) g.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
      g.fillStyle = 'rgba(200,215,235,.62)';
      for (const [x, z, w, d, r = 0] of mm.rects ?? []) {
        g.save();
        g.translate(x, z);
        g.rotate(-r);
        g.fillRect(-w / 2, -d / 2, w, d);
        g.restore();
      }
      g.strokeStyle = 'rgba(220,235,255,.85)';
      g.lineWidth = 0.35;
      g.beginPath();
      for (const [x0, z0, x1, z1] of mm.walls ?? []) { g.moveTo(x0, z0); g.lineTo(x1, z1); }
      g.stroke();
    }
    const r = 0.55;
    for (const m of this.markers) {
      g.save();
      g.translate(m.x, m.z);
      g.rotate(-p.yaw + Math.PI / 4);
      g.fillStyle = m.done ? 'rgba(127,224,255,.35)' : '#7fe0ff';
      g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      g.restore();
    }
    g.fillStyle = '#f2a23a';
    for (const e of this.ctx.get('enemies').alive) {
      g.beginPath();
      g.arc(e.x, e.z, r, 0, Math.PI * 2);
      g.fill();
    }
    // the player: a chevron pointing up the screen
    g.setTransform(1, 0, 0, 1, S / 2, S / 2);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -11);
    g.lineTo(7.5, 8);
    g.lineTo(0, 4);
    g.lineTo(-7.5, 8);
    g.closePath();
    g.fill();
    // view cone
    const grd = g.createRadialGradient(0, 0, 4, 0, 0, S * 0.42);
    grd.addColorStop(0, 'rgba(255,255,255,.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, S * 0.42, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    g.closePath();
    g.fill();
  }

  _drawCompass() {
    const head = this._heading();
    const W = 440;
    this.el.strip.style.transform = `translateX(${W / 2 - (head + 360) * PX_PER_DEG}px)`;
    const pips = [];
    for (const e of this.ctx.get('enemies').alive) pips.push(['', this._bearingTo(e.x, e.z)]);
    for (const m of this.markers) if (!m.done) pips.push(['o', this._bearingTo(m.x, m.z)]);
    while (this._pipEls.length < pips.length) {
      const d = document.createElement('i');
      this.el.pips.appendChild(d);
      this._pipEls.push(d);
    }
    this._pipEls.forEach((d, i) => {
      const pip = pips[i];
      if (!pip) { d.style.display = 'none'; return; }
      const off = wrapDeg(pip[1] - head);
      d.className = `pip ${pip[0]}`;
      d.style.display = Math.abs(off) < 70 ? '' : 'none';
      d.style.left = `${W / 2 + off * PX_PER_DEG}px`;
    });
  }

  _weapon(w, reloading) {
    const e = this.el;
    const d = w.def;
    if (this._magFor !== d.id) {
      this._magFor = d.id;
      e.wname.textContent = (d.hudName ?? d.name).toUpperCase();
      e.tag.textContent = d.hudTag ?? '';
      e.tag.style.display = d.hudTag ? '' : 'none';
      e.sil.setAttribute('d', SIL[d.silhouette ?? (d.kind === 'melee' ? 'blade' : 'rifle')] ?? SIL.rifle);
      const n = d.magazine ? Math.min(d.magazine, 60) : 0;
      e.mag.innerHTML = Array.from({ length: n }, () => '<u></u>').join('');
      this._magEls = [...e.mag.children];
      e.fm.textContent = d.magazine ? `${d.auto ? 'AUTO' : 'SEMI'}${d.calibre ? ` · ${d.calibre}` : ''}` : (d.hudMode ?? 'MELEE');
    }
    const ammo = d.magazine ? (reloading ? '--' : String(w.ammo)) : '';
    if (this._last.ammo !== ammo) e.ammo.textContent = this._last.ammo = ammo;
    e.ammo.classList.toggle('low', d.magazine > 0 && w.ammo <= d.magazine * 0.25);
    const res = d.magazine && w.reserve !== Infinity ? `/ ${w.reserve}` : '';
    if (this._last.res !== res) e.res.textContent = this._last.res = res;
    if (d.magazine) {
      const n = this._magEls.length;
      const lit = Math.round((w.ammo / d.magazine) * n);
      if (this._last.lit !== lit) {
        this._last.lit = lit;
        this._magEls.forEach((u, i) => u.classList.toggle('off', i >= lit));
      }
    }
  }

  update(dt, ctx) {
    const e = this.el;
    const p = ctx.get('player');
    const ws = ctx.get('weapons');
    const level = ctx.peek('round')?.level;

    this._drawMap(level);
    this._drawCompass();

    const hp = Math.ceil(p.health);
    if (this._last.hp !== hp) {
      this._last.hp = hp;
      e.hpv.textContent = hp;
      const lit = Math.ceil((p.health / p.maxHealth) * 10);
      e.seg.forEach((u, i) => u.classList.toggle('off', i >= lit));
      e.hp.classList.toggle('low', p.health < p.maxHealth * 0.3);
    }
    const stance = p.crouching ? 'CROUCH' : p.sprinting ? 'SPRINT' : 'STAND';
    if (this._last.stance !== stance) e.stance.textContent = this._last.stance = stance;

    this._weapon(ws.current, ws.reloading > 0);

    const sc = String(Math.round(this.score));
    if (this._last.sc !== sc) e.sc.textContent = this._last.sc = sc;
    this.chainT = Math.max(0, this.chainT - dt);
    if (this.chainT <= 0) this.chain = 0;
    e.ch.textContent = this.chain > 1 ? `CHAIN X${this.chain}` : '';
    e.ch.style.opacity = this.chain > 1 ? 1 : 0;
    e.chb.style.transform = `scaleX(${this.chain > 1 ? this.chainT / this.o.chainWindow : 0})`;

    this.contactT = Math.max(0, this.contactT - dt);
    const ca = Math.min(1, this.contactT * 1.4);
    e.ct.style.opacity = ca;
    e.ctl.style.opacity = ca;

    this.radioT = Math.max(0, this.radioT - dt);
    e.rad.style.opacity = this.radioT > 0 ? 1 : 0;

    this.promptT = Math.max(0, this.promptT - dt);
    e.pr.style.opacity = this.promptT > 0 ? 1 : 0;

    this.introT = Math.max(0, this.introT - dt);
    e.intro.style.opacity = this.introT > 0.4 ? 1 : this.introT / 0.4;
    const introing = this.introT > 0.25;
    if (this._last.introing !== introing) this.hud.el.hud.classList.toggle('introing', this._last.introing = introing);
  }
}
