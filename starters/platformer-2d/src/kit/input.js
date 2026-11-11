// Actions, not keys. The game names its actions and their keys once; keyboard, the on-screen
// touch buttons and the bot all press the same actions, so the bot plays through the player's path.
// Read input anywhere during an update (the game's update or an object's): it holds for the whole update.
import * as LJS from './engine.js';

const state = {
  bindings: {},
  held: {},
  prev: {},
  tapNext: {}, // touch taps since the last update
  tapNow: {}, // presses this update that an edge alone would miss
  touch: {},
  bot: {},
  botOn: false,
};

/** bindings: { left: ['ArrowLeft', 'KeyA'], jump: ['Space', 'ArrowUp'], ... } (KeyboardEvent.code) */
export function bindActions(bindings) {
  state.bindings = bindings;
  for (const a of Object.keys(bindings)) {
    state.held[a] = false;
    state.prev[a] = false;
  }
}

const sample = (a) => state.bindings[a].some((code) => LJS.keyIsDown(code)) || !!state.touch[a] || (state.botOn && !!state.bot[a]);

/** Once at the start of each update. */
export function updateInput() {
  for (const a of Object.keys(state.bindings)) {
    state.prev[a] = state.held[a];
    state.held[a] = sample(a);
    // a tap shorter than an update, or a second key for the action pressed as the first is let go
    state.tapNow[a] = !!state.tapNext[a] || state.bindings[a].some((code) => LJS.keyWasPressed(code));
    state.tapNext[a] = false;
  }
}

/** After the bot has written its buttons: take them in this same update. */
export function refreshInput() {
  for (const a of Object.keys(state.bindings)) state.held[a] = sample(a);
}

export const input = {
  down: (a) => !!state.held[a],
  pressed: (a) => (state.held[a] && !state.prev[a]) || !!state.tapNow[a],
  released: (a) => !state.held[a] && state.prev[a],
  /** -1, 0 or 1 from two opposite actions */
  axis: (neg, pos) => (state.held[pos] ? 1 : 0) - (state.held[neg] ? 1 : 0),
  /** the bot writes here: input.bot.left = true */
  bot: state.bot,
  setBot(on) {
    state.botOn = !!on;
    if (!on) for (const k of Object.keys(state.bot)) state.bot[k] = false;
  },
  get botOn() { return state.botOn; },
  touchDown(a, on) {
    if (on && !state.touch[a]) state.tapNext[a] = true;
    state.touch[a] = on;
  },
  /** true on a phone or tablet */
  isTouch: () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
};
