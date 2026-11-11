// The heads-up display: sunseeds, sparks of life, score and how far the beacon is.
// Plain HTML over the canvas; the icons are inline SVG, so nothing is loaded.

export const hudCss = `
.pf { position: absolute; inset: 0; padding: 18px 22px; font-family: var(--font-ui); }
.pf-row { display: flex; align-items: center; gap: 12px; }
.pf-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 9px; border-radius: 999px; background: rgba(18,8,34,.55); border: 1px solid rgba(255,220,180,.18); box-shadow: 0 6px 22px rgba(0,0,0,.25); backdrop-filter: blur(6px); }
.pf-pill b { font-size: 21px; font-weight: 800; color: #ffe2a8; font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.pf-pill span { font-size: 14px; opacity: .7; font-weight: 700; }
.pf-hearts { display: inline-flex; gap: 4px; }
.pf-hearts svg { width: 24px; height: 24px; filter: drop-shadow(0 0 6px rgba(255,190,90,.7)); }
.pf-hearts svg.off { filter: none; opacity: .35; }
.pf-score { position: absolute; top: 18px; right: 22px; text-align: right; }
.pf-score b { display: block; font-size: 30px; font-weight: 900; color: #fff4ea; letter-spacing: .02em; font-variant-numeric: tabular-nums; text-shadow: 0 2px 0 rgba(120,40,20,.8), 0 0 18px rgba(255,150,80,.45); }
.pf-score small { font-size: 12px; font-weight: 700; letter-spacing: .12em; opacity: .7; }
.pf-track { position: absolute; left: 50%; bottom: 20px; width: min(340px, 46vw); height: 8px; transform: translateX(-50%); border-radius: 99px; background: rgba(18,8,34,.5); border: 1px solid rgba(255,220,180,.18); }
.pf-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, #ff9a4a, #ffd76a); box-shadow: 0 0 12px rgba(255,190,90,.8); }
.pf-track em { position: absolute; right: -8px; top: 50%; width: 14px; height: 18px; transform: translateY(-50%) rotate(45deg) scale(.7); background: #8af0ff; box-shadow: 0 0 14px #8af0ff; border-radius: 3px; }
@media (pointer: coarse) { .pf-track { bottom: auto; top: 70px; } }
`;

const seedIcon = '<svg width="26" height="26" viewBox="0 0 26 26"><defs><radialGradient id="sg" cx="40%" cy="35%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffcc4a"/><stop offset="1" stop-color="#b8661a"/></radialGradient></defs><circle cx="13" cy="13" r="12" fill="rgba(255,200,80,.25)"/><ellipse cx="13" cy="14" rx="6.5" ry="8" fill="url(#sg)"/><ellipse cx="17" cy="6" rx="3.4" ry="1.6" transform="rotate(-35 17 6)" fill="#8ccf5a"/></svg>';
const spark = (on) => `<svg class="${on ? '' : 'off'}" viewBox="0 0 24 24"><path d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z" fill="${on ? '#ffd27a' : '#8a6a8a'}"/><circle cx="12" cy="12" r="3.2" fill="${on ? '#fff8e0' : '#b49ab4'}"/></svg>`;

export function hudHtml({ seeds, total, hearts, max, score, progress }) {
  let sparks = '';
  for (let i = 0; i < max; i++) sparks += spark(i < hearts);
  return `<div class="pf">
    <div class="pf-row">
      <div class="pf-pill">${seedIcon}<b>${seeds}</b><span>/ ${total}</span></div>
      <div class="pf-pill pf-hearts">${sparks}</div>
    </div>
    <div class="pf-score"><small>SCORE</small><b>${score.toLocaleString('en-US')}</b></div>
    <div class="pf-track"><i style="width:${(progress * 100).toFixed(1)}%"></i><em></em></div>
  </div>`;
}
