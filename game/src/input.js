// Solmar Bay — keyboard + mouse input.
//
// THE INPUT RULES (learned from play-test bugs, 19 Nov 2026):
// - Cooldowns are NEVER gated with `!cooldown`: a cooldown that
//   decays per frame goes slightly negative (-0.0167) and
//   `!(-0.0167)` is false forever, so the action dies permanently
//   after one press. Always gate with `cooldown <= 0`.
// - Quick taps must register: a key pressed and released between
//   two animation frames is invisible to a loop that only polls
//   currently-held keys. Keep a `pressed` set: on non-repeat
//   keydown add the code to `pressed`; expose `pressedKey(code)`;
//   clear `pressed` in `endFrame()`. All tap actions (E, F, G,
//   Escape/P, M, Digit1-3, Enter, outfit keys) use `pressedKey`,
//   never `down()` or a prevKeys comparison. Repeat keydown events
//   must NOT re-add to `pressed`.

export function createInput() {
  const input = {
    down: new Set(), // currently held keys (by code)
    pressed: new Set(), // keys tapped since the last frame
    mouse: { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false },
    wheel: 0,
    attached: false,
    _el: null,
    _handlers: null,
  };

  input.downKey = function (code) {
    return input.down.has(code);
  };

  // True once for a tap, then cleared at endFrame.
  input.pressedKey = function (code) {
    return input.pressed.has(code);
  };

  input.endFrame = function () {
    input.pressed.clear();
    input.mouse.dx = 0;
    input.mouse.dy = 0;
    input.mouse.clicked = false;
    input.wheel = 0;
  };

  // Test helper: inject a tap without a DOM.
  input.injectTap = function (code) {
    input.down.add(code);
    input.pressed.add(code);
  };

  input.injectRelease = function (code) {
    input.down.delete(code);
  };

  input.attach = function (el) {
    if (input.attached || typeof window === 'undefined') return;
    input.attached = true;
    input._el = el;
    const onDown = (e) => {
      if (e.repeat) return; // repeat keydown must NOT re-add
      input.down.add(e.code);
      input.pressed.add(e.code);
      // Keys the game owns must not scroll the page or move focus.
      if (
        e.code === 'Tab' ||
        e.code === 'Space' ||
        e.code.startsWith('Arrow') ||
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD'
      ) {
        e.preventDefault();
      }
    };
    const onUp = (e) => {
      input.down.delete(e.code);
    };
    const onMove = (e) => {
      if (input.mouse.down) {
        input.mouse.dx += e.movementX || 0;
        input.mouse.dy += e.movementY || 0;
      }
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    };
    const onMouseDown = (e) => {
      if (e.button === 0) {
        input.mouse.down = true;
        input.mouse.clicked = true;
      }
    };
    const onMouseUp = (e) => {
      if (e.button === 0) input.mouse.down = false;
    };
    const onWheel = (e) => {
      input.wheel += e.deltaY;
      e.preventDefault();
    };
    const onBlur = () => {
      input.down.clear();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    input._handlers = { onDown, onUp, onMove, onMouseDown, onMouseUp, onWheel, onBlur };
  };

  input.detach = function () {
    if (!input.attached || typeof window === 'undefined') return;
    const h = input._handlers;
    window.removeEventListener('keydown', h.onDown);
    window.removeEventListener('keyup', h.onUp);
    window.removeEventListener('blur', h.onBlur);
    input._el.removeEventListener('mousemove', h.onMove);
    input._el.removeEventListener('mousedown', h.onMouseDown);
    window.removeEventListener('mouseup', h.onMouseUp);
    input._el.removeEventListener('wheel', h.onWheel);
    input.attached = false;
  };

  return input;
}

// Axis helper: -1/0/+1 from a pair of held keys.
export function axis(input, negCode, posCode) {
  let v = 0;
  if (input.downKey(negCode)) v -= 1;
  if (input.downKey(posCode)) v += 1;
  return v;
}
