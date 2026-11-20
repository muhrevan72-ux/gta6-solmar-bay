// Solmar Bay — keyboard + mouse input.
//
// Two sets, because a quick tap can happen between two frames:
// `down` tracks held keys, `pressed` tracks taps. A tap is added on a
// non-repeat keydown and cleared by endFrame(). Every tap action in
// the game (E, F, G, Escape, Enter, digits, M, R, Tab) reads
// pressedKey, never a poll of held keys. Repeat keydown events never
// re-add to `pressed`. Cooldowns are always gated with `<= 0`, never
// with `!cooldown` (a decaying cooldown goes slightly negative and
// `!(-0.0167)` is false forever).

export function createInput() {
  const input = {
    down: new Set(),
    pressed: new Set(),
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
    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
      this.wheel = 0;
    },
    attach(target) {
      // In Node there is no window: stay detached, never throw.
      if (typeof window === 'undefined' || !target || typeof target.addEventListener !== 'function') {
        this.attached = false;
        this._handlers = {
          onDown: (e) => {
            if (e.repeat) return;
            this.down.add(e.code);
            this.pressed.add(e.code);
            if (e.preventDefault) e.preventDefault();
          },
          onUp: (e) => { this.down.delete(e.code); },
          onMouseDown: (e) => {
            if (e.button === 0) { this.mouse.clicked = true; this.mouse.down = true; }
          },
          onMouseUp: (e) => {
            if (e.button === 0) this.mouse.down = false;
          },
          onMove: (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
          },
          onWheel: (e) => { this.wheel += e.deltaY || 0; },
        };
        return;
      }
      const h = {
        onDown: (e) => {
          if (e.repeat) return;
          this.down.add(e.code);
          this.pressed.add(e.code);
          if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
        },
        onUp: (e) => { this.down.delete(e.code); },
        onMouseDown: (e) => {
          if (e.button === 0) { this.mouse.clicked = true; this.mouse.down = true; }
        },
        onMouseUp: (e) => {
          if (e.button === 0) this.mouse.down = false;
        },
        onMove: (e) => {
          this.mouse.x = e.clientX;
          this.mouse.y = e.clientY;
          if (this.mouse.down && typeof e.movementX === 'number') {
            this._dragX = (this._dragX || 0) + e.movementX;
            this._dragY = (this._dragY || 0) + e.movementY;
          }
        },
        onWheel: (e) => { this.wheel += e.deltaY || 0; },
      };
      this._handlers = h;
      target.addEventListener('keydown', h.onDown);
      target.addEventListener('keyup', h.onUp);
      target.addEventListener('mousedown', h.onMouseDown);
      target.addEventListener('mouseup', h.onMouseUp);
      target.addEventListener('mousemove', h.onMove);
      target.addEventListener('wheel', h.onWheel);
      this.attached = true;
    },
    consumeDrag() {
      const dx = this._dragX || 0;
      const dy = this._dragY || 0;
      this._dragX = 0;
      this._dragY = 0;
      return { dx, dy };
    },
  };
  return input;
}

export function axis(input, negCode, posCode) {
  let v = 0;
  if (input.downKey(negCode)) v -= 1;
  if (input.downKey(posCode)) v += 1;
  return v;
}
