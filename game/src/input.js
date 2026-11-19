// Solmar Bay — keyboard + mouse input.
//
// REQUIRED pattern (found by play-test): quick key taps must register
// even when the press and release happen between two animation frames.
// So we keep a `pressed` set: a non-repeat keydown adds the code,
// `pressedKey(code)` reads it, and `endFrame()` clears it at the end
// of each frame. Cooldowns are NEVER gated with `!cooldown` (a
// cooldown that decays slightly negative is truthy forever) — always
// `cooldown <= 0`.
//
// In the browser the input listens on window (keys) and the canvas
// (mouse). In Node, tests pass their own EventTarget and dispatch
// synthetic keydown/keyup events through the real listeners.

export function createInput(keyTarget, mouseTarget) {
  const keys = new Set(); // currently held
  const pressed = new Set(); // tapped this frame
  const mouse = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    wheel: 0,
    clicked: false,
    dragging: false,
    down: false,
  };

  const kt =
    keyTarget ||
    (typeof globalThis.window !== 'undefined' ? globalThis.window : null) ||
    (typeof globalThis.document !== 'undefined' ? globalThis.document : null);

  function onKeyDown(e) {
    if (e.repeat) return; // repeats must NOT re-add to `pressed`
    keys.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) {
      if (e.preventDefault) e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
  }

  if (kt && kt.addEventListener) {
    kt.addEventListener('keydown', onKeyDown);
    kt.addEventListener('keyup', onKeyUp);
    kt.addEventListener('blur', onBlur);
  }

  function attachMouse(canvas) {
    if (!canvas || !canvas.addEventListener) return;
    canvas.addEventListener('mousemove', (e) => {
      if (mouse.down) {
        mouse.dx += e.movementX || 0;
        mouse.dy += e.movementY || 0;
      }
      mouse.x = e.clientX || 0;
      mouse.y = e.clientY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      mouse.down = true;
      mouse.dragging = true;
      mouse.clicked = true;
      if (e.button === 0) mouse.clicked = true;
    });
    canvas.addEventListener('mouseup', () => {
      mouse.down = false;
      mouse.dragging = false;
    });
    canvas.addEventListener('wheel', (e) => {
      mouse.wheel += e.deltaY || 0;
      if (e.preventDefault) e.preventDefault();
    }, { passive: false });
  }
  if (mouseTarget) attachMouse(mouseTarget);

  return {
    keys,
    pressed,
    mouse,
    // Held right now (polling, for WASD driving/walking).
    down(code) {
      return keys.has(code);
    },
    // Tapped this frame (one-shot actions: E, F, G, Esc, digits...).
    pressedKey(code) {
      return pressed.has(code);
    },
    // Call at the end of every frame.
    endFrame() {
      pressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.wheel = 0;
      mouse.clicked = false;
    },
    attachMouse,
    // Test helper: feed a synthetic key event through the real path.
    feedKey(code, type) {
      if (type === 'keydown') onKeyDown({ code, repeat: false, preventDefault() {} });
      else onKeyUp({ code });
    },
    destroy() {
      if (kt && kt.removeEventListener) {
        kt.removeEventListener('keydown', onKeyDown);
        kt.removeEventListener('keyup', onKeyUp);
        kt.removeEventListener('blur', onBlur);
      }
    },
  };
}
