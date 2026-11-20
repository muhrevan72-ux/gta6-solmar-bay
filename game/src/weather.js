// Solmar Bay — time of day, sky and weather.
//
// The clock runs 120x real time (a full day is 720 s). sampleAt(h)
// describes an hour: sky and fog colours, the fog range IN METRES
// (the round-8 bug was fog in NDC depth, which blanked golden hour)
// and the neon boost that makes the signs glow after dark.
// createWeather owns the live clock, the rain easing and the weather
// timer that rolls a new condition every minute and a half or so.

// Linear interpolation between keyframes [hour, value].
function lerpKeys(keys, h) {
  const hh = ((h % 24) + 24) % 24;
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, v0] = keys[i];
    const [h1, v1] = keys[i + 1];
    if (hh >= h0 && hh <= h1) {
      const t = h1 === h0 ? 0 : (hh - h0) / (h1 - h0);
      if (Array.isArray(v0)) return v0.map((c, j) => c + (v1[j] - c) * t);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}

const FOG_FAR_KEYS = [
  [0, 180], [5, 180], [6, 260], [12, 420], [17, 300], [18, 260], [23, 180], [24, 180],
];
const NEON_KEYS = [
  [0, 1.9], [6, 1.3], [12, 1.0], [17, 1.6], [18, 1.6], [23, 1.9], [24, 1.9],
];
const SKY_KEYS = [
  [0, [0.05, 0.08, 0.18]],
  [5, [0.06, 0.09, 0.2]],
  [6, [0.8, 0.55, 0.5]],
  [8, [0.6, 0.75, 0.95]],
  [12, [0.45, 0.7, 0.95]],
  [16, [0.6, 0.7, 0.9]],
  [17, [0.95, 0.7, 0.4]],
  [18, [0.98, 0.5, 0.2]],
  [19.5, [0.4, 0.25, 0.35]],
  [23, [0.05, 0.08, 0.18]],
  [24, [0.05, 0.08, 0.18]],
];
const FOG_KEYS = [
  [0, [0.08, 0.1, 0.2]],
  [5, [0.09, 0.11, 0.22]],
  [6, [0.85, 0.65, 0.6]],
  [8, [0.7, 0.8, 0.9]],
  [12, [0.7, 0.8, 0.9]],
  [16, [0.75, 0.75, 0.85]],
  [17, [0.95, 0.7, 0.45]],
  [18, [0.95, 0.6, 0.35]],
  [19.5, [0.45, 0.3, 0.4]],
  [23, [0.08, 0.1, 0.2]],
  [24, [0.08, 0.1, 0.2]],
];

export function phaseAt(h) {
  const hh = ((h % 24) + 24) % 24;
  if (hh < 5) return 'night';
  if (hh < 8) return 'dawn';
  if (hh < 16) return 'day';
  if (hh < 18) return 'golden';
  if (hh < 19.5) return 'sunset';
  return 'night';
}

// The atmosphere at one hour. fogNear is a constant 60 m; fogFar is
// in metres, never below it, and the sky/fog colours are interpolated.
export function sampleAt(h) {
  return {
    phase: phaseAt(h),
    sky: lerpKeys(SKY_KEYS, h),
    fog: lerpKeys(FOG_KEYS, h),
    fogNear: 60,
    fogFar: lerpKeys(FOG_FAR_KEYS, h),
    neonBoost: lerpKeys(NEON_KEYS, h),
  };
}

// The live weather object: the clock, the rain easing and the timer
// that rolls a new condition. step takes the rng so the suites can
// drive it deterministically.
export function createWeather(game) {
  const w = {
    game,
    timer: 120,
    next(rng) {
      const r = (rng || Math.random)();
      const weather = r < 0.5 ? 'clear' : r < 0.8 ? 'rain' : 'fog';
      game.weather = weather;
      this.timer = 90 + (rng || Math.random)() * 90;
      return weather;
    },
    step(dt, rng) {
      // The clock runs 120x: dt seconds of real time are dt/30 hours.
      game.clock += dt / 30;
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      // Rain eases toward 1 in rain, toward 0 otherwise.
      const target = game.weather === 'rain' ? 1 : 0;
      game.rain += (target - game.rain) * (1 - Math.exp(-dt * 0.15));
      if (game.rain < 0.001) game.rain = 0;
      if (game.rain > 0.999) game.rain = 1;
      this.timer -= dt;
      if (this.timer <= 0) this.next(rng);
    },
    // The atmosphere right now, with the weather clamps applied:
    // rain pulls the fog in to 200 m, fog to 120 m.
    sample() {
      const s = sampleAt(game.clock);
      if (game.weather === 'rain') s.fogFar = Math.min(s.fogFar, 200);
      if (game.weather === 'fog') s.fogFar = Math.min(s.fogFar, 120);
      return s;
    },
  };
  return w;
}
