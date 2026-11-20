// Solmar Bay — day/night cycle + weather (rebuild #15).
// The clock runs 120x real time (a 720 s day). sampleAt() gives
// the sky colour, fog range (metres) and neon boost for any hour
// by interpolating keyframes. Night is DARK NAVY (fix (d)) —
// never the rusty orange-brown of round 13.

export function phaseAt(h) {
  const hour = (((h % 24) + 24) % 24);
  if (hour >= 5.5 && hour < 7.5) return 'dawn';
  if (hour >= 7.5 && hour < 16.5) return 'day';
  if (hour >= 16.5 && hour < 17.5) return 'golden';
  if (hour >= 17.5 && hour < 19) return 'sunset';
  return 'night';
}

// Keyframes: [hour, sky RGB, fogFar (m), neonBoost].
const KEYS = [
  [0, [0.04, 0.07, 0.16], 180, 1.9],
  [5, [0.05, 0.08, 0.18], 180, 1.9],
  [6, [0.6, 0.5, 0.55], 260, 1.4],
  [8, [0.5, 0.72, 0.95], 380, 1.0],
  [12, [0.45, 0.7, 0.95], 420, 1.0],
  [16, [0.5, 0.72, 0.95], 380, 1.0],
  [17, [0.95, 0.62, 0.32], 300, 1.6],
  [18, [0.95, 0.45, 0.25], 260, 1.6],
  [20, [0.1, 0.12, 0.25], 200, 1.9],
  [23, [0.05, 0.08, 0.18], 180, 1.9],
  [24, [0.04, 0.07, 0.16], 180, 1.9],
];

export function sampleAt(h) {
  const hour = (((h % 24) + 24) % 24);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b[0] - a[0] || 1;
  const t = Math.max(0, Math.min(1, (hour - a[0]) / span));
  const lerp = (x, y) => x + (y - x) * t;
  const sky = [lerp(a[1][0], b[1][0]), lerp(a[1][1], b[1][1]), lerp(a[1][2], b[1][2])];
  return {
    phase: phaseAt(hour),
    sky,
    // The fog colour follows the sky (darker), so it differs per
    // phase just like the sky does.
    fog: [sky[0] * 0.85, sky[1] * 0.85, sky[2] * 0.9],
    fogNear: 60,
    fogFar: lerp(a[2], b[2]),
    neonBoost: lerp(a[3], b[3]),
  };
}

// The live weather object on the game: advances the clock, eases
// the rain intensity toward its target, and re-rolls the weather
// when the timer expires.
export function createWeather(g) {
  const w = {
    timer: 120,
    rain: 0,
    step(dt, rng) {
      g.clock += (dt * 120) / 3600;
      while (g.clock >= 24) {
        g.clock -= 24;
        g.day += 1;
      }
      const target = g.weather === 'rain' ? 1 : 0;
      w.rain += (target - w.rain) * Math.min(1, dt * 0.5);
      g.rain = w.rain;
      w.timer -= dt;
      if (w.timer <= 0) w.next(rng || Math.random);
    },
    next(rng) {
      const r = (rng || Math.random)();
      if (r < 0.5) g.weather = 'clear';
      else if (r < 0.8) g.weather = 'rain';
      else g.weather = 'fog';
      w.timer = 90 + (rng || Math.random)() * 90;
      return g.weather;
    },
    // The current sample, with the fog distance clamped by the
    // weather: rain never sees past 200 m, fog never past 120 m.
    sample() {
      const s = sampleAt(g.clock);
      if (g.weather === 'rain') s.fogFar = Math.min(s.fogFar, 200);
      if (g.weather === 'fog') s.fogFar = Math.min(s.fogFar, 120);
      return s;
    },
  };
  return w;
}
