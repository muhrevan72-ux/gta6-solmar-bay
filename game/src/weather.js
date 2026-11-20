// Solmar Bay — weather + day/night cycle.
//
// A 720-second game day: dawn, day, golden hour, sunset, dusk,
// night. The sky colour, fog colour/density and neon boost follow
// the clock; weather (clear/rain/fog) changes every 90–180 s.
// GOLDEN-HOUR REFERENCE (the bounty leader @klencho, "GOLDEN HOUR
// KINGS", 99.4%): warm orange/pink sky and fog, neon glowing
// brighter at sunset (1.6x) and night (1.9x).

import { COL, TUNE, clamp, lerp } from './config.js';

// Keyframes: [hour, sky, fog, neonBoost, fogFar]
const KEYS = [
  [0, COL.skyNight, COL.fogNight, 1.9, 0.5],
  [5, COL.skyNight, COL.fogNight, 1.9, 0.5],
  [6, COL.skyDawn, [0.8, 0.7, 0.72], 1.4, 0.7],
  [8, COL.skyDay, COL.fogDay, 1.0, 1.2],
  [12, COL.skyDay, COL.fogDay, 1.0, 1.2],
  [16, [0.85, 0.7, 0.6], [0.8, 0.72, 0.68], 1.2, 1.0],
  [17, COL.skyGolden, [0.95, 0.62, 0.42], 1.6, 0.9],
  [18, COL.skySunset, [0.95, 0.5, 0.35], 1.6, 0.8],
  [18.75, COL.skyDusk, [0.7, 0.4, 0.5], 1.7, 0.7],
  [20, COL.skyNight, COL.fogNight, 1.9, 0.5],
  [24, COL.skyNight, COL.fogNight, 1.9, 0.5],
];

function mix3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Sample the atmosphere at a given hour. Pure function, testable.
export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((h - a[0]) / (b[0] - a[0] || 1), 0, 1);
  return {
    sky: mix3(a[1], b[1], t),
    fog: mix3(a[2], b[2], t),
    neon: lerp(a[3], b[3], t),
    fogFar: lerp(a[4], b[4], t),
    phase: phaseAt(h),
  };
}

export function phaseAt(h) {
  if (h < 5) return 'night';
  if (h < 7) return 'dawn';
  if (h < 16) return 'day';
  if (h < 17.5) return 'golden hour';
  if (h < 18.75) return 'sunset';
  if (h < 20) return 'dusk';
  return 'night';
}

export function createWeather(game) {
  return {
    game,
    update(dt) {
      // The clock runs 120x real time: 720 s per 24 h day.
      game.clock += (dt * 24) / TUNE.dayLengthSec;
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      game.weatherTimer -= dt;
      if (game.weatherTimer <= 0) {
        game.weatherTimer = TUNE.weatherMinSec + Math.random() * (TUNE.weatherMaxSec - TUNE.weatherMinSec);
        const r = Math.random();
        game.weather = r < 0.65 ? 'clear' : r < 0.85 ? 'rain' : 'fog';
      }
      const target = game.weather === 'rain' ? 1 : 0;
      game.rain += (target - game.rain) * Math.min(1, dt * 0.5);
    },
    sample() {
      const s = sampleAt(game.clock);
      if (game.weather === 'rain') {
        s.fog = mix3(s.fog, [0.45, 0.5, 0.55], 0.5);
        s.fogFar = Math.min(s.fogFar, 0.55);
      } else if (game.weather === 'fog') {
        s.fog = mix3(s.fog, [0.8, 0.82, 0.85], 0.6);
        s.fogFar = Math.min(s.fogFar, 0.35);
      }
      return s;
    },
  };
}
