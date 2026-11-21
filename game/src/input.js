// Solmar Bay — keyboard and mouse input.
//
// One object owns every key: `down` is what is held right now, `pressed`
// is what went down since the last endFrame (so a tap is seen exactly
// once). The game loop calls endFrame after each step. In a real browser
// the listeners attach to window automatically; in Node (tests) the
// object is inert until a test injects taps.

export function createInput() {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, dx: 0, dy: 0, clicked: false, down: false },
    wheel: 0,
    attached: false,
    _handlers: {},
  };

  const onDown = (e) => {
    if (e.repeat) return;
    const code = e.code || e.key;
    if (!code) return;
    if (!input.down.has(code)) input.pressed.add(code);
    input.down.add(code);
  };
  const onUp = (e) => {
    const code = e.code || e.key;
    if (!code) return;
    input.down.delete(code);
  };
  const onMouseDown = (e) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    if (typeof e.clientX === 'number') {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    }
  };
  const onMove = (e) => {
    if (typeof e.clientX === 'number') {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    }
    input.mouse.dx += e.movementX || 0;
    input.mouse.dy += e.movementY || 0;
  };
  const onMouseUp = () => {
    input.mouse.down = false;
  };
  const onWheel = (e) => {
    input.wheel += e.deltaY || 0;
  };

  input._handlers = { onDown, onUp, onMouseDown, onMove, onMouseUp, onWheel };

  input.attach = (target) => {
    if (!target || typeof target.addEventListener !== 'function') return false;
    // Only a genuine window counts as attached. A bare stand-in object
    // (tests pass {addEventListener(){}}) is a safe no-op: it does not
    // flip the attached flag. The real window is the global one.
    if (typeof globalThis === 'undefined' || target !== globalThis.window) return false;
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    target.addEventListener('mousedown', onMouseDown);
    target.addEventListener('mousemove', onMove);
    target.addEventListener('mouseup', onMouseUp);
    target.addEventListener('wheel', onWheel);
    input.attached = true;
    return true;
  };

  input.injectTap = (code) => {
    input.down.add(code);
    input.pressed.add(code);
  };
  input.injectRelease = (code) => {
    input.down.delete(code);
  };
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.wheel = 0;
  };
  input.pressedKey = (code) => input.pressed.has(code);
  input.downKey = (code) => input.down.has(code);

  // Auto-attach when a real window exists (browser boot, and the
  // headless harness which stubs one). No-op in plain Node.
  if (typeof globalThis !== 'undefined' && globalThis.window) {
    input.attach(globalThis.window);
  }
  return input;
}

// Signed axis between two keys: the negative key gives -1, the positive
// key gives +1, both or neither gives 0.
export function axis(input, negCode, posCode) {
  let v = 0;
  if (input.down.has(negCode)) v -= 1;
  if (input.down.has(posCode)) v += 1;
  return v;
}
