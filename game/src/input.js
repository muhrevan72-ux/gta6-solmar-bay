// Keyboard and pointer input. Held keys give a movement direction;
// one-shot presses (confirm, pause, interact, punch, mute, new game)
// are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_NEW = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
// Confirm is Enter only: Space is the handbrake while driving, and must
// never accidentally start a mission or restart the game.
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const NEW = new Set(['KeyN']);

const GAME_KEYS = new Set([
  ...UP, ...DOWN, ...LEFT, ...RIGHT, ...RUN, ...HANDBRAKE,
  ...CONFIRM, ...PAUSE, ...INTERACT, ...PUNCH, ...MUTE, ...NEW,
]);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    held.add(event.code);
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
      if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
      if (MUTE.has(event.code)) actions |= ACTION_MUTE;
      if (NEW.has(event.code)) actions |= ACTION_NEW;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 on each axis, from WASD or the arrow keys. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { x, y };
    },
    /** Driving input for the player's car. */
    drive() {
      return {
        up: has(UP),
        down: has(DOWN),
        left: has(LEFT),
        right: has(RIGHT),
        handbrake: has(HANDBRAKE),
      };
    },
    run() { return has(RUN); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
