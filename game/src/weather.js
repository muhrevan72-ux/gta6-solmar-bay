// Solmar Bay — weather + day/night cycle.
// The clock runs 120x real time (30 s real = 1 game hour, a full day
// is 720 s). sampleAt(hour) is the pure keyframe table; the weather
// object steps the clock, the day counter and the weather state.
// Fog distances are in METRES (fogNear is always 60 m) — the round-8
// bug was fog computed from NDC depth, which swallowed the whole
// scene at golden hour.

const KEYFRAMES = [
  // hour, phase, sky, fog, fogFar, neonBoost
  [0, 'night', [0.03, 0.04, 0.1], [0.05, 0.06, 0.12], 180, 1.9],
  [5, 'night', [0.04, 0.05, 0.12], [0.06, 0.07, 0.14], 180, 1.9],
  [6, 'dawn', [0.85, 0.6, 0.55], [0.8, 0.6, 0.55], 260, 1.4],
  [7, 'dawn', [0.7, 0.8, 0.95], [0.65, 0.75, 0.9], 320, 1.2],
  [8, 'day', [0.55, 0.75, 0.95], [0.6, 0.75, 0.9], 380, 1.0],
  [12, 'day', [0.45, 0.7, 0.98], [0.55, 0.72, 0.92], 420, 1.0],
  [16, 'day', [0.55, 0.72, 0.95], [0.6, 0.72, 0.9], 400, 1.0],
  [17, 'golden', [1, 0.62, 0.38], [0.98, 0.62, 0.4], 300, 1.6],
  [18, 'sunset', [1, 0.45, 0.3], [0.95, 0.5, 0.35], 260, 1.6],
  [18.75, 'sunset', [0.75, 0.35, 0.5], [0.7, 0.4, 0.5], 230, 1.7],
  [19.5, 'night', [0.12, 0.1, 0.25], [0.14, 0.12, 0.26], 200, 1.9],
  [23, 'night', [0.03, 0.04, 0.1], [0.05, 0.06, 0.12], 180, 1.9],
  [24, 'night', [0.03, 0.04, 0.1], [0.05, 0.06, 0.12], 180, 1.9],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.5) return 'night';
  if (h < 7.5) return 'dawn';
  if (h < 16.5) return 'day';
  if (h < 17.5) return 'golden';
  if (h < 19) return 'sunset';
  return 'night';
}

export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i][0] && h <= KEYFRAMES[i + 1][0]) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const t = Math.max(0, Math.min(1, (h - a[0]) / span));
  return {
    phase: phaseAt(h),
    sky: lerp3(a[2], b[2], t),
    fog: lerp3(a[3], b[3], t),
    fogNear: 60,
    fogFar: lerp(a[4], b[4], t),
    neonBoost: lerp(a[5], b[5], t),
  };
}

export function createWeather(game) {
  const w = {
    timer: 120,
    step(dt, rng) {
      // The clock runs 120x: dt seconds real = dt/30 game hours.
      game.clock += dt / 30;
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      // Rain intensity eases toward its target.
      const target = game.weather === 'rain' ? 1 : 0;
      game.rain += (target - game.rain) * Math.min(1, dt * 0.2);
      if (game.rain < 0.01) game.rain = 0;
      // Weather changes when the timer expires.
      w.timer -= dt;
      if (w.timer <= 0) {
        game.weather = w.next(rng || Math.random);
      }
      game._phase = phaseAt(game.clock);
    },
    next(rng) {
      const r = rng();
      const pick = r < 0.6 ? 'clear' : r < 0.85 ? 'rain' : 'fog';
      w.timer = 90 + rng() * 90;
      return pick;
    },
    sample() {
      const s = sampleAt(game.clock);
      if (game.weather === 'rain') s.fogFar = Math.min(s.fogFar, 200);
      if (game.weather === 'fog') s.fogFar = Math.min(s.fogFar, 120);
      return s;
    },
  };
  return w;
}
