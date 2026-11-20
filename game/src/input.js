// Solmar Bay — keyboard and mouse input (rebuild #15).
// `pressed` is the edge (this frame only), `down` is the held
// state. endFrame() clears the edge set at the end of each frame.
// attach() binds real DOM listeners on `window` — never on the
// canvas, which cannot take focus, so keyboard input would never
// arrive (the round-4 bug). Tab is preventDefault()ed so the
// browser does not steal focus to a button (fix (b)).

export function createInput() {
  const input = {
    pressed: new Set(),
    down: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, dx: 0, dy: 0 },
    wheel: 0,
    attached: false,
    _handlers: null,
  };
  input._handlers = {
    onDown: (e) => {
      if (!e || !e.code) return;
      if (e.code === 'Tab') {
        // Keep focus in the game: Tab opens the phone, it must
        // not move browser focus to the Pause button.
        if (e.preventDefault) e.preventDefault();
      }
      if (!e.repeat) input.pressed.add(e.code);
      input.down.add(e.code);
    },
    onUp: (e) => {
      if (!e || !e.code) return;
      input.down.delete(e.code);
    },
    onMouseDown: (e) => {
      input.mouse.down = true;
      input.mouse.clicked = true;
      if (e) { input.mouse.x = e.clientX || 0; input.mouse.y = e.clientY || 0; }
    },
    onMove: (e) => {
      if (!e) return;
      input.mouse.x = e.clientX || 0;
      input.mouse.y = e.clientY || 0;
      if (e.movementX !== undefined) {
        input.mouse.dx = e.movementX;
        input.mouse.dy = e.movementY || 0;
      }
    },
    onMouseUp: () => {
      input.mouse.down = false;
    },
  };
  input.attach = (target) => {
    // Only the real global window gets listeners. A plain object
    // with addEventListener is NOT the window (the round-9 test
    // passes one and expects a no-op), and in Node there is no
    // window at all, so attach is a safe no-op there.
    const w = typeof window !== 'undefined' ? window : null;
    if (!w || target !== w) {
      input.attached = false;
      return;
    }
    const h = input._handlers;
    target.addEventListener('keydown', h.onDown);
    target.addEventListener('keyup', h.onUp);
    target.addEventListener('mousedown', h.onMouseDown);
    target.addEventListener('mousemove', h.onMove);
    target.addEventListener('mouseup', h.onMouseUp);
    input.attached = true;
  };
  // Auto-attach to the real window when one exists (the browser).
  // Without this, createInput() defines attach() but no DOM
  // listener is ever registered, so the keyboard is dead even
  // though the handlers exist (the #14 play-test regression:
  // Enter/Tab/Escape/W/E/Space were all ignored in a real
  // browser). In Node there is no window, so this is a safe
  // no-op, and the round-9 test that attach(plainObject) is a
  // no-op is unaffected (it still sets attached = false).
  // Calling attach twice (here and in boot) is harmless: the
  // browser deduplicates identical addEventListener calls.
  if (typeof window !== 'undefined') input.attach(window);
  input.injectTap = (code) => {
    input.pressed.add(code);
    input.down.add(code);
  };
  input.injectRelease = (code) => {
    input.down.delete(code);
  };
  input.pressedKey = (code) => input.pressed.has(code);
  input.downKey = (code) => input.down.has(code);
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.mouse.dx = 0;
    input.mouse.dy = 0;
    input.wheel = 0;
  };
  return input;
}

// Axis from two keys: -1 when the negative key is held, +1 when
// the positive key is held, 0 otherwise. W = -1, S = +1.
export function axis(input, neg, pos) {
  const n = input.down.has(neg) ? -1 : 0;
  const p = input.down.has(pos) ? 1 : 0;
  return n + p;
}
