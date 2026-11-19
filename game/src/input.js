// Solmar Bay — keyboard + mouse input. One shared object, read by the
// game loop each frame. Mouse drag orbits the camera, wheel zooms,
// click shoots.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // camera orbit accumulated this frame
    orbitX: 0,
    orbitY: 0,
    wheel: 0,
    // mouse buttons
    mouseDown: false,
    clicked: false,   // true on the frame a click starts
    dragging: false,
    lastX: 0,
    lastY: 0,
    // pointer-lock style: also allow plain drag on the canvas
    down(code) { return input.keys.has(code); },
    // WASD / arrows as a -1..1 pair, camera-relative handled by caller
    moveAxes() {
      let x = 0, y = 0;
      if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
      if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
      if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y += 1;
      if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    // consume per-frame deltas (call once per frame after reading)
    endFrame() {
      input.orbitX = 0;
      input.orbitY = 0;
      input.wheel = 0;
      input.clicked = false;
    },
  };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyG', 'KeyR',
    'Digit1', 'Digit2', 'Digit3', 'Escape', 'KeyP', 'KeyM', 'Enter',
  ]);

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.orbitX += e.clientX - input.lastX;
    input.orbitY += e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheel += e.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}
