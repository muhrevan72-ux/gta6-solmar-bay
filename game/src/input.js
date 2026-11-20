// Solmar Bay — keyboard + mouse input.
//
// Two sets: `down` is every key currently held, `pressed` is the keys
// tapped since the last frame. A tap lands in both; endFrame clears
// only `pressed`, so a held key keeps moving the player while a tap is
// consumed exactly once. A repeat keydown (holding a key) never counts
// as a second tap.

export function createInput() {
  const input = {
    pressed: new Set(),
    down: new Set(),
    mouse: { clicked: false, down: false, x: 0, y: 0 },
    wheel: 0,
    attached: false,
    _handlers: null,

    pressedKey(code) {
      return this.pressed.has(code);
    },
    downKey(code) {
      return this.down.has(code);
    },
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
      this.wheel = 0;
    },
    attach(target) {
      // Handlers are built whether or not a window exists, so the
      // logic suites can drive them headlessly through _handlers.
      const self = this;
      this._handlers = {
        onDown(e) {
          if (e.repeat) {
            self.down.add(e.code);
            return;
          }
          self.pressed.add(e.code);
          self.down.add(e.code);
          if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) {
            if (e.preventDefault) e.preventDefault();
          }
        },
        onUp(e) {
          self.down.delete(e.code);
        },
        onMouseDown() {
          self.mouse.clicked = true;
          self.mouse.down = true;
        },
        onMouseUp() {
          self.mouse.down = false;
        },
        onMove(e) {
          self.mouse.x = e.clientX;
          self.mouse.y = e.clientY;
        },
        onWheel(e) {
          self.wheel += e.deltaY || 0;
        },
      };
      // Only the real window gets listeners. In Node (or when handed
      // a stand-in object) attach is a safe no-op.
      if (typeof window === 'undefined') {
        this.attached = false;
        return;
      }
      const w = target || window;
      if (w !== window) {
        this.attached = false;
        return;
      }
      w.addEventListener('keydown', this._handlers.onDown);
      w.addEventListener('keyup', this._handlers.onUp);
      w.addEventListener('mousedown', this._handlers.onMouseDown);
      w.addEventListener('mouseup', this._handlers.onMouseUp);
      w.addEventListener('mousemove', this._handlers.onMove);
      w.addEventListener('wheel', this._handlers.onWheel);
      this.attached = true;
    },
  };
  return input;
}

// Signed axis: -1 while the first key is held, +1 while the second
// is, 0 when neither (or both). W/S is the forward axis, A/D strafe.
export function axis(input, keyA, keyB) {
  const a = input.downKey(keyA) ? -1 : 0;
  const b = input.downKey(keyB) ? 1 : 0;
  return a + b;
}
