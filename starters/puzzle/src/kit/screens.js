// Title, win and lose cards and the HUD, drawn in HTML over the canvas so the type is crisp
// and the post-process pass never smears it. The game supplies the words and a theme.
import { input } from './input.js';

const CSS = `
#ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: var(--font-ui); color: var(--ink); -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none; }
#ui .screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; padding: 24px; opacity: 0; transform: translateY(10px) scale(.985); transition: opacity .35s ease, transform .45s cubic-bezier(.2,.8,.2,1); pointer-events: none; }
#ui .screen.on { opacity: 1; transform: none; pointer-events: auto; cursor: pointer; }
#ui .screen::before { content: ''; position: absolute; inset: 0; background: var(--scrim); z-index: -1; }
#ui h1 { font-family: var(--font-display); font-weight: 900; font-size: clamp(40px, 9vw, 104px); line-height: .92; letter-spacing: -.02em; margin: 0; color: var(--title); text-shadow: 0 2px 0 var(--title-edge), 0 6px 0 rgba(0,0,0,.25), 0 0 42px var(--glow); }
#ui h2 { font-family: var(--font-display); font-weight: 900; font-size: clamp(34px, 7vw, 76px); line-height: 1; margin: 0; color: var(--title); text-shadow: 0 2px 0 var(--title-edge), 0 0 34px var(--glow); letter-spacing: -.01em; }
#ui .tag { font-size: clamp(14px, 2vw, 19px); max-width: 34em; opacity: .9; line-height: 1.45; text-wrap: balance; }
#ui .stat { font-size: clamp(15px, 2.2vw, 22px); font-weight: 700; letter-spacing: .02em; }
#ui .stat b { color: var(--accent); font-size: 1.35em; }
#ui .cta { margin-top: 10px; padding: 12px 26px; border-radius: 999px; font-weight: 800; font-size: clamp(14px, 1.9vw, 18px); letter-spacing: .04em; color: var(--cta-ink); background: var(--accent); box-shadow: 0 0 0 2px rgba(255,255,255,.18) inset, 0 8px 28px var(--glow); animation: kit-pulse 1.6s ease-in-out infinite; }
#ui .keys { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; margin-top: 8px; font-size: 14px; opacity: .85; }
#ui .keys span { display: inline-flex; align-items: center; gap: 6px; }
#ui kbd { display: inline-block; min-width: 26px; padding: 3px 7px; border-radius: 6px; font: 700 12px/1.3 var(--font-ui); color: var(--ink); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22); border-bottom-width: 3px; }
#ui .hud { position: absolute; inset: 0; pointer-events: none; transition: opacity .3s; }
#ui .hud.off { opacity: 0; }
#ui .touch { position: absolute; inset: auto 0 0 0; height: 0; pointer-events: none; display: none; }
#ui .touch.on { display: block; }
#ui .touch button { position: absolute; bottom: 18px; width: 76px; height: 76px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); background: rgba(10,10,20,.32); color: #fff; font: 800 22px/1 var(--font-ui); pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(4px); }
#ui .touch button.held { background: rgba(255,255,255,.28); }
@keyframes kit-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }
`;

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = html;
  return e;
};

/**
 * theme: CSS variables (accent, ink, title, glow, scrim, font-display, font-ui, ...)
 * text: { title, tagline, keys: [['← →', 'run'], ...], cta, won: { title, line(score) }, lost: {...} }
 * touch: [{ action, label, left|right: px, bottom?: px, size?: px }]
 */
export function createScreens({ theme, text, touch = [] }) {
  const root = document.getElementById('ui');
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  for (const [k, v] of Object.entries(theme)) root.style.setProperty(`--${k}`, v);

  const hud = el('div', 'hud off');
  const title = el('div', 'screen title');
  const won = el('div', 'screen won');
  const lost = el('div', 'screen lost');
  const pad = el('div', 'touch');
  root.append(hud, title, won, lost, pad);

  const keys = (text.keys ?? []).map(([k, what]) => `<span>${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join('')} ${what}</span>`).join('');
  title.innerHTML = `<h1>${text.title}</h1><div class="tag">${text.tagline ?? ''}</div><div class="cta">${text.cta ?? 'Click, tap or press Enter'}</div><div class="keys">${keys}</div>`;

  for (const b of touch) {
    const btn = el('button', '', b.label);
    btn.dataset.c = b.action;
    if (b.left !== undefined) btn.style.left = `${b.left}px`;
    if (b.right !== undefined) btn.style.right = `${b.right}px`;
    if (b.bottom !== undefined) btn.style.bottom = `${b.bottom}px`;
    if (b.size) { btn.style.width = btn.style.height = `${b.size}px`; }
    const on = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.add('held'); input.touchDown(b.action, true); };
    const off = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.remove('held'); input.touchDown(b.action, false); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
    pad.append(btn);
  }

  let shown = '';
  let lastHud = '';
  return {
    root,
    hud,
    show(state, info = {}) {
      if (state === 'won') won.innerHTML = `<h2>${text.won?.title ?? 'You win'}</h2><div class="stat">${text.won?.line?.(info) ?? ''}</div><div class="cta">${text.won?.cta ?? 'Play again'}</div>`;
      if (state === 'lost') lost.innerHTML = `<h2>${text.lost?.title ?? 'Try again'}</h2><div class="stat">${text.lost?.line?.(info) ?? ''}</div><div class="cta">${text.lost?.cta ?? 'Try again'}</div>`;
      title.classList.toggle('on', state === 'title');
      won.classList.toggle('on', state === 'won');
      lost.classList.toggle('on', state === 'lost');
      hud.classList.toggle('off', state !== 'playing');
      pad.classList.toggle('on', state === 'playing' && input.isTouch());
      shown = state;
    },
    hideAll() {
      for (const s of [title, won, lost]) s.classList.remove('on');
      pad.classList.remove('on');
    },
    /** html for the HUD; only touches the DOM when it changed */
    setHud(html) {
      if (html !== lastHud) {
        hud.innerHTML = html;
        lastHud = html;
      }
    },
    get shown() { return shown; },
  };
}
