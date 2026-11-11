// The heads-up display: score against the target as a ring, and the swaps left.
// To the left of the board on a wide screen, above it on a tall one.

export const hudCss = `
.gt { position: absolute; left: max(18px, calc(50% - 50vh * 0.94 - 190px)); top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 16px; align-items: stretch; width: 170px; font-family: var(--font-ui); }
.gt-card { padding: 14px 16px; border-radius: 18px; background: linear-gradient(160deg, rgba(40,150,190,.28), rgba(4,30,60,.55)); border: 1px solid rgba(160,240,255,.28); box-shadow: 0 10px 30px rgba(0,10,25,.35), inset 0 1px 0 rgba(255,255,255,.15); backdrop-filter: blur(6px); }
.gt-label { font-size: 12px; font-weight: 700; letter-spacing: .14em; opacity: .7; }
.gt-score { font-size: 34px; font-weight: 900; line-height: 1.05; color: #fff; font-variant-numeric: tabular-nums; text-shadow: 0 0 18px rgba(120,240,255,.6); }
.gt-ring { position: relative; width: 120px; height: 120px; margin: 4px auto 0; }
.gt-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.gt-ring .in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.gt-ring b { font-size: 26px; font-weight: 900; color: #fff; }
.gt-ring small { font-size: 12px; opacity: .75; font-weight: 700; }
.gt-moves { display: flex; align-items: baseline; justify-content: space-between; }
.gt-moves b { font-size: 34px; font-weight: 900; color: var(--accent); font-variant-numeric: tabular-nums; text-shadow: 0 0 14px rgba(120,240,255,.6); }
.gt-moves b.low { color: #ffb06a; text-shadow: 0 0 14px rgba(255,150,80,.7); }
@media (max-aspect-ratio: 1/1) {
  .gt { left: 50%; top: 14px; transform: translateX(-50%); flex-direction: row; width: auto; gap: 10px; }
  .gt-card { padding: 10px 14px; }
  .gt-ring { width: 64px; height: 64px; margin: 0; }
  .gt-ring b { font-size: 15px; } .gt-ring small { display: none; }
  .gt-score, .gt-moves b { font-size: 24px; }
}
`;

export function hudHtml({ score, target, moves, total }) {
  const p = Math.min(1, score / target);
  const C = 2 * Math.PI * 52;
  return `<div class="gt">
    <div class="gt-card"><div class="gt-label">SCORE</div><div class="gt-score">${score.toLocaleString('en-US')}</div>
      <div class="gt-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(160,240,255,.15)" stroke-width="10"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="url(#gtg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}"/>
      <defs><linearGradient id="gtg"><stop offset="0" stop-color="#5ad8ff"/><stop offset="1" stop-color="#b8ffe8"/></linearGradient></defs></svg>
      <div class="in"><b>${Math.round(p * 100)}%</b><small>of ${target.toLocaleString('en-US')}</small></div></div>
    </div>
    <div class="gt-card gt-moves"><span class="gt-label">SWAPS</span><b class="${moves <= 5 ? 'low' : ''}">${moves}</b></div>
  </div>`;
}
