// Solmar Bay — time of day and weather.
//
// The clock runs 120x real time (30 s real = 1 game hour, a full day is
// 720 s). sampleAt(hour) describes the light at any hour by lerping
// between keyframes: fog distance in metres, sky and fog colours, and
// how strongly the neon signs glow. Rain and fog weather clamp the fog
// distance down; the weather itself changes on a 90-180 s timer.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpStops(stops, h) {
  // stops: [[hour, value], ...] sorted by hour; value a number or an
  // RGB array. Interpolates linearly; clamps outside the range.
  if (h <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i][0]) {
      const [h0, v0] = stops[i - 1];
      const [h1, v1] = stops[i];
      const t = (h - h0) / (h1 - h0);
      if (Array.isArray(v0)) return v0.map((v, k) => lerp(v, v1[k], t));
      return lerp(v0, v1, t);
    }
  }
  return stops[stops.length - 1][1];
}

const NIGHT_SKY = [0.03, 0.05, 0.12];
const DAWN_SKY = [0.72, 0.5, 0.58];
const DAY_SKY = [0.45, 0.65, 0.9];
const GOLDEN_SKY = [0.95, 0.7, 0.35];
const SUNSET_SKY = [0.98, 0.5, 0.2];

const SKY_STOPS = [
  [0, NIGHT_SKY],
  [5, NIGHT_SKY],
  [6, DAWN_SKY],
  [7, DAY_SKY],
  [12, DAY_SKY],
  [17, GOLDEN_SKY],
  [18, SUNSET_SKY],
  [19, NIGHT_SKY],
  [23, NIGHT_SKY],
  [24, NIGHT_SKY],
];

const FOG_COLOUR_STOPS = [
  [0, [0.08, 0.1, 0.16]],
  [6, [0.8, 0.65, 0.7]],
  [12, [0.7, 0.75, 0.85]],
  [17, [0.95, 0.75, 0.5]],
  [18, [0.9, 0.55, 0.35]],
  [23, [0.08, 0.1, 0.16]],
  [24, [0.08, 0.1, 0.16]],
];

const FOG_FAR_STOPS = [
  [0, 180],
  [6, 260],
  [12, 420],
  [17, 300],
  [18, 260],
  [23, 180],
  [24, 180],
];

const NEON_STOPS = [
  [0, 1.9],
  [6, 1.3],
  [12, 1.0],
  [17, 1.6],
  [18, 1.6],
  [23, 1.9],
  [24, 1.9],
];

export function phaseAt(h) {
  const hour = Math.floor(h);
  if (hour === 17) return 'golden';
  if (hour === 18) return 'sunset';
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  return 'night';
}

export function sampleAt(h) {
  return {
    phase: phaseAt(h),
    sky: lerpStops(SKY_STOPS, h),
    fog: lerpStops(FOG_COLOUR_STOPS, h),
    fogNear: 60,
    fogFar: lerpStops(FOG_FAR_STOPS, h),
    neonBoost: lerpStops(NEON_STOPS, h),
  };
}

export function createWeather(game) {
  const w = {
    game,
    timer: 120,

    next(rng) {
      const r = typeof rng === 'function' ? rng() : Math.random();
      let weather = 'clear';
      if (r >= 0.8) weather = 'fog';
      else if (r >= 0.5) weather = 'rain';
      this.timer = 90 + (typeof rng === 'function' ? rng() : Math.random()) * 90;
      return weather;
    },

    step(dt, rng) {
      const g = this.game;
      // Clock: 120x real time. 30 s real = 1 game hour.
      g.clock += dt / 30;
      if (g.clock >= 24) {
        g.clock -= 24;
        g.day += 1;
      }
      // Rain intensity eases toward its target.
      const target = g.weather === 'rain' ? 1 : 0;
      g.rain += (target - g.rain) * (1 - Math.exp(-dt * 0.1));
      if (g.rain < 0.001) g.rain = 0;
      // Weather changes when the timer runs out.
      this.timer -= dt;
      if (this.timer <= 0) {
        g.weather = this.next(rng);
      }
      return g.weather;
    },

    sample() {
      const g = this.game;
      const s = sampleAt(g.clock);
      if (g.weather === 'rain' && s.fogFar > 200) s.fogFar = 200;
      if (g.weather === 'fog' && s.fogFar > 120) s.fogFar = 120;
      s.fogNear = 60;
      return s;
    },
  };
  return w;
}
