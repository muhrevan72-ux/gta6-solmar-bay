// Solmar Bay — keyboard / mouse input.
// Written fresh for rebuild #18. Tracks held keys (`down`) and
// freshly pressed keys (`pressed`, cleared each frame by
// endFrame). Auto-attaches to the real window when one exists;
// in Node it is a detached stub the tests drive with injectTap.

export function createInput() {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouse: { dx: 0, dy: 0, clicked: false, down: false, x: 0, y: 0 },
    wheel: 0,
    attached: false,
    _handlers: {},
  };

  function onDown(e) {
    if (!e || !e.code) return;
    // A held key repeats: it stays `down` but is NOT a fresh press.
    if (!e.repeat) input.pressed.add(e.code);
    input.down.add(e.code);
  }
  function onMouseDown(e) {
    input.mouse.down = true;
    input.mouse.clicked = true;
    if (e) { input.mouse.x = e.clientX || 0; input.mouse.y = e.clientY || 0; }
  }
  function onMove(e) {
    if (!e) return;
    input.mouse.dx += e.movementX || 0;
    input.mouse.dy += e.movementY || 0;
    input.mouse.x = e.clientX || 0;
    input.mouse.y = e.clientY || 0;
  }
  function onMouseUp() {
    input.mouse.down = false;
  }

  input._handlers = { onDown, onMouseDown, onMove, onMouseUp };

  // Test / game helpers, as methods on the input object.
  input.injectTap = function (code) {
    input.pressed.add(code);
    input.down.add(code);
  };
  input.injectRelease = function (code) {
    input.down.delete(code);
  };
  input.pressedKey = function (code) {
    return input.pressed.has(code);
  };
  input.downKey = function (code) {
    return input.down.has(code);
  };
  // Attach to the real window only (a fake target is ignored in Node).
  input.attach = function () {
    const w = typeof globalThis !== 'undefined' ? globalThis.window : null;
    if (!w || typeof w.addEventListener !== 'function' || input.attached) return;
    w.addEventListener('keydown', onDown);
    w.addEventListener('keyup', (e) => { if (e && e.code) input.down.delete(e.code); });
    w.addEventListener('mousedown', onMouseDown);
    w.addEventListener('mouseup', onMouseUp);
    w.addEventListener('mousemove', onMove);
    w.addEventListener('wheel', (e) => { if (e) input.wheel += e.deltaY || 0; });
    input.attached = true;
  };
  // End of frame: forget one-frame presses / clicks / wheel deltas.
  // Held keys (`down`) persist.
  input.endFrame = function () {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.wheel = 0;
  };

  // Attach to the real window when one exists (browser). In Node
  // there is no window, so this stays a detached stub.
  input.attach();

  return input;
}

// -1 / +1 axis from a pair of keys (e.g. W/S, A/D).
export function axis(input, negKey, posKey) {
  let v = 0;
  if (input.down.has(negKey)) v -= 1;
  if (input.down.has(posKey)) v += 1;
  return v;
}

export function pressedKey(input, code) {
  return input.pressed.has(code);
}

export function downKey(input, code) {
  return input.down.has(code);
}
