// Solmar Bay — keyboard + mouse input.
// Tap actions use a `pressed` set: a key pressed and released
// between two animation frames still registers (polling only the
// held set would miss it). Cooldowns are always gated with
// `<= 0`, never with a falsy check (a decaying cooldown goes
// slightly negative and `!negative` is false forever).

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyR',
  'KeyM', 'KeyP', 'KeyQ', 'ShiftLeft', 'ShiftRight', 'Space',
  'Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
  'ArrowRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9',
]);

export function createInput() {
  const input = {
    pressed: new Set(),
    down: new Set(),
    mouse: { clicked: false, down: false, x: 0, y: 0, dx: 0, dy: 0 },
    wheel: 0,
    attached: false,
    _handlers: null,

    pressedKey(code) { return this.pressed.has(code); },
    downKey(code) { return this.down.has(code); },

    injectTap(code) {
      this.pressed.add(code);
      this.down.add(code);
    },
    injectRelease(code) {
      this.down.delete(code);
    },

    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
      this.mouse.dx = 0;
      this.mouse.dy = 0;
      this.wheel = 0;
    },

    attach(win) {
      // Only attach to a real browser window. In Node there is no
      // window, so this is a safe no-op (attached stays false).
      if (typeof globalThis === 'undefined' || !globalThis.window) {
        this.attached = false;
        return;
      }
      const target = win || globalThis.window;
      if (!target || typeof target.addEventListener !== 'function') {
        this.attached = false;
        return;
      }
      const h = this._handlers;
      target.addEventListener('keydown', h.onDown);
      target.addEventListener('keyup', h.onUp);
      target.addEventListener('mousedown', h.onMouseDown);
      target.addEventListener('mouseup', h.onMouseUp);
      target.addEventListener('mousemove', h.onMove);
      target.addEventListener('wheel', h.onWheel);
      this.attached = true;
    },
  };

  input._handlers = {
    onDown(ev) {
      // A repeat keydown is a held key, not a new tap.
      if (!ev.repeat) input.pressed.add(ev.code);
      input.down.add(ev.code);
      if (GAME_KEYS.has(ev.code) && ev.preventDefault) ev.preventDefault();
    },
    onUp(ev) {
      input.down.delete(ev.code);
    },
    onMouseDown(ev) {
      input.mouse.clicked = true;
      input.mouse.down = true;
    },
    onMouseUp(ev) {
      input.mouse.down = false;
    },
    onMove(ev) {
      input.mouse.x = ev.clientX || 0;
      input.mouse.y = ev.clientY || 0;
      input.mouse.dx += ev.movementX || 0;
      input.mouse.dy += ev.movementY || 0;
    },
    onWheel(ev) {
      input.wheel += ev.deltaY || 0;
    },
  };

  // Auto-attach when a real window exists (the browser). In Node
  // this is a no-op and attached stays false.
  if (typeof globalThis !== 'undefined' && globalThis.window && typeof globalThis.window.addEventListener === 'function') {
    input.attach(globalThis.window);
  }
  return input;
}

// Signed axis: -1 when the negative key is held, +1 when the
// positive key is held, 0 otherwise (both held cancels out).
export function axis(input, negKey, posKey) {
  const neg = input.down.has(negKey) ? 1 : 0;
  const pos = input.down.has(posKey) ? 1 : 0;
  return pos - neg;
}
