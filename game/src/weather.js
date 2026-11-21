// Solmar Bay — day/night cycle, sky, fog, weather.
// Written fresh for rebuild #18. The clock runs 120x real time
// (30 s = 1 game hour, a full day is 720 s). sampleAt(hour) is a
// pure keyframe lookup; createWeather wires it to a live game.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Keyframes: [hour, fogFar, neonBoost, sky, fog]
const KEYS = [
  [0, 180, 1.9, [0.05, 0.08, 0.18], [0.08, 0.1, 0.2]],
  [6, 260, 1.4, [0.75, 0.55, 0.5], [0.7, 0.6, 0.55]],
  [7, 320, 1.2, [0.65, 0.75, 0.9], [0.7, 0.78, 0.88]],
  [12, 420, 1.0, [0.45, 0.7, 0.95], [0.7, 0.8, 0.9]],
  [16, 380, 1.2, [0.55, 0.72, 0.92], [0.72, 0.8, 0.9]],
  [17, 300, 1.6, [0.98, 0.78, 0.45], [0.9, 0.72, 0.5]],
  [18, 260, 1.6, [0.95, 0.45, 0.2], [0.85, 0.5, 0.35]],
  [20, 200, 1.9, [0.25, 0.2, 0.4], [0.3, 0.28, 0.42]],
  [23, 180, 1.9, [0.05, 0.08, 0.18], [0.08, 0.1, 0.2]],
  [24, 180, 1.9, [0.05, 0.08, 0.18], [0.08, 0.1, 0.2]],
];

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 16) return 'day';
  if (h >= 16 && h < 17.5) return 'golden';
  if (h >= 17.5 && h < 19) return 'sunset';
  return 'night';
}

export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (h >= KEYS[i][0] && h <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = (b[0] - a[0]) || 1;
  const t = Math.max(0, Math.min(1, (h - a[0]) / span));
  return {
    phase: phaseAt(h),
    fogNear: 60,
    fogFar: lerp(a[1], b[1], t),
    neonBoost: lerp(a[2], b[2], t),
    sky: lerp3(a[3], b[3], t),
    fog: lerp3(a[4], b[4], t),
  };
}

export function createWeather(game) {
  const w = {
    game,
    timer: 120,
    next(rng) {
      const r = rng ? rng() : Math.random();
      let out;
      if (r < 0.5) out = 'clear';
      else if (r < 0.85) out = 'rain';
      else out = 'fog';
      const r2 = rng ? rng() : Math.random();
      w.timer = 90 + r2 * 90;
      return out;
    },
    sample() {
      const s = sampleAt(game.clock);
      let fogFar = s.fogFar;
      if (game.weather === 'rain') fogFar = Math.min(fogFar, 200);
      if (game.weather === 'fog') fogFar = Math.min(fogFar, 120);
      return { ...s, fogFar };
    },
    step(dt, rng) {
      // Clock runs 120x: 30 s real = 1 game hour.
      game.clock += dt / 30;
      while (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      game._phase = phaseAt(game.clock);
      // Rain intensity eases toward its target.
      const target = game.weather === 'rain' ? 1 : 0;
      game.rain += (target - game.rain) * (1 - Math.exp(-dt * 0.1));
      // Weather changes when the timer expires.
      w.timer -= dt;
      if (w.timer <= 0) {
        game.weather = w.next(rng);
      }
    },
  };
  return w;
}
