// Solmar Bay — keyboard + mouse input.
//
// REQUIRED pattern (found by the round-3 browser play-test):
// - A cooldown gate must NEVER be `!cooldown`: a per-frame cooldown
//   decays slightly negative (e.g. -0.0167) and `!(-0.0167)` is false
//   forever, so the action dies permanently after one press. Gate
//   with `cooldown <= 0` everywhere.
// - Quick taps must register: a key pressed and released between two
//   animation frames is invisible to a loop that only polls held keys.
//   Keep a `pressed` set: on non-repeat keydown add the code; expose
//   `pressedKey(code)`; clear `pressed` in `endFrame()` (same pattern
//   as the mouse `clicked`). ALL tap actions (E, F, G, Escape, M,
//   Digit1-3, Enter, Tab, R, outfit keys) use `pressedKey`, never
//   `down()` or a prev-keys comparison. Repeat keydown events must
//   NOT re-add to `pressed`.
//
// Pure logic — no DOM at import time, so headless tests can drive it.

export function createInput() {
  return {
    down: new Set(), // currently held key codes
    pressed: new Set(), // tapped this frame (cleared by endFrame)
    mouse: {
      x: 0, y: 0, dx: 0, dy: 0,
      down: false, clicked: false, wheel: 0,
      dragging: false,
    },
    eCooldown: 0, // interact cooldown; gate with `<= 0`
  };
}

export function keyDown(inp, code) {
  if (!inp.down.has(code)) {
    // Non-repeat only: a held key must not re-add to `pressed`.
    inp.pressed.add(code);
  }
  inp.down.add(code);
}

export function keyUp(inp, code) {
  inp.down.delete(code);
}

export function isDown(inp, code) {
  return inp.down.has(code);
}

// True only on the frame the key was tapped (non-repeat keydown).
export function pressedKey(inp, code) {
  return inp.pressed.has(code);
}

export function mouseMove(inp, x, y, dx, dy) {
  inp.mouse.x = x;
  inp.mouse.y = y;
  inp.mouse.dx += dx;
  inp.mouse.dy += dy;
}

export function mouseDown(inp) {
  inp.mouse.down = true;
  inp.mouse.dragging = true;
  inp.mouse.clicked = true;
}

export function mouseUp(inp) {
  inp.mouse.down = false;
  inp.mouse.dragging = false;
}

export function mouseWheel(inp, delta) {
  inp.mouse.wheel += delta;
}

// Call once at the end of every frame: clears the tap set, the click
// flag, the mouse deltas and the wheel delta.
export function endFrame(inp, dt) {
  inp.pressed.clear();
  inp.mouse.clicked = false;
  inp.mouse.dx = 0;
  inp.mouse.dy = 0;
  inp.mouse.wheel = 0;
  if (inp.eCooldown > 0) inp.eCooldown -= dt;
  else if (inp.eCooldown < 0) inp.eCooldown = 0;
}

// Attach real browser listeners. Called only from main.js boot().
export function attachInput(inp, el) {
  if (typeof window === 'undefined' || !el) return;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault();
    keyDown(inp, e.code);
  });
  window.addEventListener('keyup', (e) => keyUp(inp, e.code));
  el.addEventListener('mousedown', (e) => {
    inp.mouse.x = e.offsetX;
    inp.mouse.y = e.offsetY;
    mouseDown(inp);
  });
  window.addEventListener('mouseup', () => mouseUp(inp));
  el.addEventListener('mousemove', (e) => {
    mouseMove(inp, e.offsetX, e.offsetY, e.movementX || 0, e.movementY || 0);
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    mouseWheel(inp, e.deltaY);
  }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
