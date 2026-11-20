// Solmar Bay — input (rebuild #13).
// KEYBOARD LISTENERS GO ON THE WINDOW, not the canvas: a <canvas>
// is not focusable, so real keyboard input never reaches a game
// whose listeners sit on the canvas (play-test #12 found Enter /
// Tab / R / W / E all dead in a real browser while clicks worked).
// Mouse listeners stay on the canvas.

export function createInput() {
  const input = {
    pressed: new Set(),
    down: new Set(),
    mouse: { x: 0, y: 0, clicked: false, down: false },
    wheel: 0,
    attached: false,
    _handlers: null,
    injectTap(code) {
      this.down.add(code);
      this.pressed.add(code);
    },
    injectRelease(code) {
      this.down.delete(code);
    },
    pressedKey(code) {
      return this.pressed.has(code);
    },
    downKey(code) {
      return this.down.has(code);
    },
    attach(canvas) {
      const self = this;
      const onDown = (e) => {
        if (e.code === 'Tab' || e.code === 'Space') {
          if (typeof e.preventDefault === 'function') e.preventDefault();
        }
        if (!e.repeat) self.pressed.add(e.code);
        self.down.add(e.code);
      };
      const onUp = (e) => {
        self.down.delete(e.code);
      };
      const onMouseDown = (e) => {
        self.mouse.clicked = true;
        self.mouse.down = true;
        if (typeof e.clientX === 'number') { self.mouse.x = e.clientX; self.mouse.y = e.clientY; }
      };
      const onMouseUp = () => {
        self.mouse.down = false;
      };
      const onMove = (e) => {
        if (typeof e.clientX === 'number') { self.mouse.x = e.clientX; self.mouse.y = e.clientY; }
      };
      const onWheel = (e) => {
        self.wheel += e.deltaY || 0;
      };
      this._handlers = { onDown, onUp, onMouseDown, onMouseUp, onMove, onWheel };
      // No window (Node / headless tests): handlers are built but
      // nothing is attached; the game still works via injectTap.
      if (typeof window === 'undefined') {
        this.attached = false;
        return;
      }
      // Keyboard on the WINDOW (the document's default view).
      if (window.addEventListener) {
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
      }
      // Mouse on the canvas.
      if (canvas && typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('wheel', onWheel);
      }
      this.attached = true;
    },
    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
      this.wheel = 0;
    },
  };
  return input;
}

export function axis(input, negCode, posCode) {
  let v = 0;
  if (input.down.has(posCode)) v += 1;
  if (input.down.has(negCode)) v -= 1;
  return v;
}
