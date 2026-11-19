// Solmar Bay — keyboard + mouse input.
//
// THE REQUIRED INPUT RULES (play-test, 19 Nov 2026):
// - A key pressed and released between two animation frames is invisible
//   to a loop that only polls currently-held keys. So every non-repeat
//   keydown adds the code to a `pressed` set; tap actions read
//   `pressedKey(code)`; `endFrame()` clears `pressed` (same pattern as
//   the mouse `clicked` flag). Repeat keydown events must NOT re-add.
// - Cooldown gates always use `cooldown <= 0`, never `!cooldown`
//   (a cooldown that decays per frame goes slightly negative and
//   `!(-0.0167)` is false forever).
// The target is `window` in the browser; headless tests pass a fake
// event target and dispatch real synthetic events through it — the
// same listener path the game uses.

export function createInput(target) {
  const tgt = target || (typeof window !== 'undefined' ? window : null);
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let clicked = false;
  let dragDX = 0;
  let dragDY = 0;
  let wheelDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyM',
    'KeyP', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ]);

  function onKeyDown(e) {
    if (e.repeat) return; // repeats must NOT re-add to pressed
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (GAME_KEYS.has(e.code) && e.preventDefault) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    mouseDown = true;
    clicked = true;
    dragging = true;
    lastX = e.clientX || 0;
    lastY = e.clientY || 0;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    dragDX += (e.clientX || 0) - lastX;
    dragDY += (e.clientY || 0) - lastY;
    lastX = e.clientX || 0;
    lastY = e.clientY || 0;
  }
  function onMouseUp() {
    mouseDown = false;
    dragging = false;
  }
  function onWheel(e) {
    wheelDelta += e.deltaY || 0;
    if (e.preventDefault) e.preventDefault();
  }
  function onBlur() {
    keys.clear();
  }

  if (tgt && tgt.addEventListener) {
    tgt.addEventListener('keydown', onKeyDown);
    tgt.addEventListener('keyup', onKeyUp);
    tgt.addEventListener('mousedown', onMouseDown);
    tgt.addEventListener('mousemove', onMouseMove);
    tgt.addEventListener('mouseup', onMouseUp);
    tgt.addEventListener('wheel', onWheel);
    tgt.addEventListener('blur', onBlur);
  }

  return {
    keys,
    pressed,
    down(code) { return keys.has(code); },
    pressedKey(code) { return pressed.has(code); },
    get mouseDown() { return mouseDown; },
    get clicked() { return clicked; },
    takeDrag() {
      const d = { x: dragDX, y: dragDY };
      dragDX = 0; dragDY = 0;
      return d;
    },
    takeWheel() {
      const w = wheelDelta;
      wheelDelta = 0;
      return w;
    },
    // Call once per frame, after the game has read the input.
    endFrame() {
      pressed.clear();
      clicked = false;
    },
    destroy() {
      if (!tgt || !tgt.removeEventListener) return;
      tgt.removeEventListener('keydown', onKeyDown);
      tgt.removeEventListener('keyup', onKeyUp);
      tgt.removeEventListener('mousedown', onMouseDown);
      tgt.removeEventListener('mousemove', onMouseMove);
      tgt.removeEventListener('mouseup', onMouseUp);
      tgt.removeEventListener('wheel', onWheel);
      tgt.removeEventListener('blur', onBlur);
    },
  };
}
