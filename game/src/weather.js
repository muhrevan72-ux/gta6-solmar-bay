// Solmar Bay — weather + day/night cycle.
//
// A 720-second game day (120x real time): the clock runs 08:00 ->
// 08:00. Keyframes give sky colour, fog colour, fog distance and
// neon intensity for every hour. Weather (clear/rain/fog) changes
// every 90-180 seconds and modulates the fog.
//
// FOG DISTANCES ARE METRES (round-9 fix, after play-test #7):
// the old keyframes stored fogFar in NDC-depth units (0.5-1.2),
// which with the old NDC-depth fog shader meant EVERYTHING fogged
// to 1.0 at golden hour/sunset (the city vanished into flat orange
// sky) while night (fogFar 0.5 < edge0 0.55) silently lost all fog.
// Now fogNear is 60 m and fogFar is 180-420 m per keyframe, so the
// city at 10-100 m always stays visible: at golden hour fog only
// starts at 60 m and reaches full strength at 300 m — distant
// buildings haze, nearby streets stay crisp.

import { clamp, lerp } from './config.js';

// [hour, phase, neonBoost, fogFarMetres]
const KEYS = [
  [0, 'night', 1.9, 180],
  [5, 'night', 1.9, 180],
  [6, 'dawn', 1.4, 260],
  [8, 'day', 1.0, 420],
  [12, 'day', 1.0, 420],
  [16, 'day', 1.2, 300],
  [17, 'golden', 1.6, 300],
  [18, 'sunset', 1.6, 260],
  [18.75, 'dusk', 1.7, 220],
  [20, 'night', 1.9, 180],
  [24, 'night', 1.9, 180],
];

const SKY = {
  night: [0.07, 0.09, 0.2],
  dawn: [0.92, 0.62, 0.55],
  day: [0.55, 0.78, 0.95],
  golden: [1.0, 0.62, 0.38],
  sunset: [1.0, 0.45, 0.3],
  dusk: [0.75, 0.35, 0.5],
};

const FOG = {
  night: [0.1, 0.12, 0.22],
  dawn: [0.8, 0.68, 0.6],
  day: [0.75, 0.82, 0.9],
  golden: [0.95, 0.68, 0.45],
  sunset: [0.9, 0.5, 0.35],
  dusk: [0.5, 0.3, 0.42],
};

// Interpolate the keyframe table at an hour.
export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b[0] - a[0] || 1;
  const t = clamp((h - a[0]) / span, 0, 1);
  const phase = t < 0.5 ? a[1] : b[1];
  const skyA = SKY[a[1]];
  const skyB = SKY[b[1]];
  const fogA = FOG[a[1]];
  const fogB = FOG[b[1]];
  const sky = [lerp(skyA[0], skyB[0], t), lerp(skyA[1], skyB[1], t), lerp(skyA[2], skyB[2], t)];
  const fog = [lerp(fogA[0], fogB[0], t), lerp(fogA[1], fogB[1], t), lerp(fogA[2], fogB[2], t)];
  return {
    hour: h,
    phase,
    sky,
    fog,
    neonBoost: lerp(a[2], b[2], t),
    fogFar: lerp(a[3], b[3], t), // metres
  };
}

export function phaseAt(hour) {
  return sampleAt(hour).phase;
}

// Weather state machine: clear 65%, rain 20%, fog 15%.
export function createWeather(game) {
  const w = {
    game,
    timer: 120,
    next: function (rng) {
      const r = rng ? rng() : Math.random();
      const w2 = r < 0.65 ? 'clear' : r < 0.85 ? 'rain' : 'fog';
      game.weather = w2;
      w.timer = 90 + (rng ? rng() : Math.random()) * 90;
      return w2;
    },
    // Step the clock and the weather. dt is real seconds.
    step: function (dt, rng) {
      game.clock += (dt * 120) / 3600; // 120x time
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      w.timer -= dt;
      if (w.timer <= 0) w.next(rng);
      // Rain intensity eases toward its target.
      const target = game.weather === 'rain' ? 1 : 0;
      game.rain += (target - game.rain) * Math.min(1, dt * 0.5);
    },
    // Full sample for the renderer: sky, fog, neon, fog distance.
    // Rain and fog weather clamp the fog distance (metres).
    sample: function () {
      const s = sampleAt(game.clock);
      let fogFar = s.fogFar;
      if (game.weather === 'rain') fogFar = Math.min(fogFar, 200);
      if (game.weather === 'fog') fogFar = Math.min(fogFar, 120);
      return { ...s, fogFar, fogNear: 60 };
    },
  };
  return w;
}
