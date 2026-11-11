/**
 * Title and end screens, drawn in the DOM over the live 3D scene. Text comes
 * from src/game/config.js; the look comes from src/kit/style.css.
 */
import { cssHex, el } from './dom';
import { formatRaceTime, ordinal } from '../core/math';

export class Screens {
  constructor(root, config) {
    this.root = root;
    this.config = config;

    // ---- title -------------------------------------------------------------
    this.title = el('div', 'screen screen-title', undefined, root);
    const block = el('div', 'title-block', undefined, this.title);
    el('div', 'title-kicker', config.kicker ?? '', block);
    el('h1', 'title-name', config.title, block);
    el('div', 'title-tagline', config.tagline ?? '', block);
    this.prompt = el('div', 'title-prompt', '', block);
    this.setPrompt(false);
    const legend = el('div', 'title-legend', undefined, this.title);
    for (const [keys, what] of config.controlsLegend ?? []) {
      const row = el('div', 'legend-row', undefined, legend);
      el('span', 'legend-keys', keys, row);
      el('span', 'legend-what', what, row);
    }

    // ---- end ---------------------------------------------------------------
    this.end = el('div', 'screen screen-end hidden', undefined, root);
    const panel = el('div', 'end-panel', undefined, this.end);
    this.endKicker = el('div', 'end-kicker', '', panel);
    this.endPlace = el('div', 'end-place', '', panel);
    this.endLine = el('div', 'end-line', '', panel);
    this.endTable = el('div', 'end-table', undefined, panel);
    this.endPrompt = el('div', 'end-prompt', '', panel);
  }

  setPrompt(touch) {
    this.prompt.textContent = touch ? 'Tap to race' : 'Click or press Enter to race';
    if (this.endPrompt) this.endPrompt.textContent = touch ? 'Tap to race again' : 'Click or press Enter to race again';
  }

  showTitle() {
    this.title.classList.remove('hidden', 'leaving');
    this.end.classList.add('hidden');
  }

  hideTitle() {
    this.title.classList.add('hidden');
  }

  /**
   * @param {{ won: boolean, place: number, time: number, reason?: string,
   *           standings: { name: string, color: number, place: number, finishTime: number, isPlayer: boolean }[] }} r
   */
  showEnd(r) {
    const c = this.config;
    this.end.classList.remove('hidden');
    this.end.classList.toggle('won', r.won);
    this.end.classList.toggle('lost', !r.won);
    this.endKicker.textContent = r.won ? c.winText ?? 'Podium' : c.loseText ?? 'Off the podium';
    this.endPlace.textContent = r.place > 0 ? ordinal(r.place).toUpperCase() : 'DNF';
    this.endLine.textContent = r.reason ?? (r.time > 0 ? `${c.trackName ?? ''}  ·  ${formatRaceTime(r.time)}` : '');
    this.endTable.replaceChildren();
    for (const s of r.standings) {
      const row = el('div', `end-row${s.isPlayer ? ' me' : ''}`, undefined, this.endTable);
      el('span', 'end-pos', String(s.place), row);
      const dot = el('span', 'end-dot', undefined, row);
      dot.style.background = cssHex(s.color);
      el('span', 'end-name', s.name, row);
      el('span', 'end-time', s.finishTime > 0 ? formatRaceTime(s.finishTime) : '—', row);
    }
  }

  hideEnd() {
    this.end.classList.add('hidden');
  }
}

/**
 * On-screen controls for touch screens: steer left and right, drift, item.
 * The throttle is held for you while touch controls are up (brake with both
 * steer buttons at once). Writes into InputManager.virtual.
 */
export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.node = el('div', 'touch hidden', undefined, root);
    const left = el('div', 'touch-left', undefined, this.node);
    const right = el('div', 'touch-right', undefined, this.node);
    this.held = new Set();
    this.make(left, 'steerLeft', '◀');
    this.make(left, 'steerRight', '▶');
    this.make(right, 'item', 'ITEM');
    this.make(right, 'drift', 'DRIFT');
    this.active = false;
  }

  make(parent, code, label) {
    const b = el('button', `touch-btn touch-${code}`, label, parent);
    b.type = 'button';
    b.dataset.c = code;
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.held.add(code);
      b.classList.add('down');
      this.sync();
    };
    const up = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.held.delete(code);
      b.classList.remove('down');
      this.sync();
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }

  show(on) {
    this.active = on;
    this.node.classList.toggle('hidden', !on);
    if (!on) this.held.clear();
    this.sync();
  }

  /** The held throttle only engages after the lights go green (holding early spins you out). */
  setGas(on) {
    if (on === this.gas) return;
    this.gas = on;
    this.sync();
  }

  sync() {
    if (!this.active && !this.wasActive) return;
    this.wasActive = this.active;
    const v = this.input.virtual;
    const l = this.held.has('steerLeft');
    const r = this.held.has('steerRight');
    v.steer = (r ? 1 : 0) - (l ? 1 : 0);
    v.brake = l && r ? 1 : 0;
    v.throttle = this.active && this.gas && !(l && r) ? 1 : 0;
    v.drift = this.held.has('drift');
    v.item = this.held.has('item');
  }
}
