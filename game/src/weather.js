// Solmar Bay — weather + day/night cycle.
//
// A 720-second game day: dawn / day / sunset / night keyframes drive
// the sky colour, fog colour/density and light tint. Weather states
// (clear, rain with visible rain particles + darker light, fog with
// short fog distance) change every 90-180 seconds.
//
// GOLDEN HOUR (the look the bounty leaders use): golden hour 17:00
// sky [1, 0.62, 0.38], peak sunset 18:00 [1, 0.45, 0.3], pink dusk
// afterglow 18:45 [0.75, 0.35, 0.5], warm fog to match. Neon signs
// glow brighter at sunset (1.6x) and night (1.9x), 1.4x at dawn,
// 1.0x in the day — and x0.85 in rain/fog.
//
// Fog near/far are in the same 0..1 range the vertex shader uses:
// vFog = (NDC z + 1) / 2, so 0 is the near plane and 1 the far plane.

import { TUNE, COL, clamp, lerp } from './config.js';

// Keyframes: [hour, sky, fog, fogNear, fogFar, neonBoost].
const DAY_KEYS = [
  { h: 0, sky: COL.skyNight, fog: COL.fogNight, near: 0.25, far: 0.7, neon: 1.9 },
  { h: 5, sky: [0.45, 0.4, 0.55], fog: [0.5, 0.45, 0.55], near: 0.3, far: 0.9, neon: 1.4 },
  { h: 7, sky: COL.skyDawn, fog: [0.85, 0.65, 0.55], near: 0.35, far: 1.0, neon: 1.4 },
  { h: 10, sky: COL.skyDay, fog: COL.fogDay, near: 0.4, far: 1.2, neon: 1.0 },
  { h: 15, sky: [0.9, 0.78, 0.62], fog: [0.9, 0.78, 0.62], near: 0.4, far: 1.1, neon: 1.0 },
  { h: 16.5, sky: COL.skyGolden, fog: [1.0, 0.62, 0.38], near: 0.35, far: 1.0, neon: 1.6 },
  { h: 17.5, sky: COL.skySunset, fog: [1.0, 0.45, 0.3], near: 0.3, far: 0.9, neon: 1.6 },
  { h: 19, sky: COL.skyDusk, fog: [0.75, 0.35, 0.5], near: 0.3, far: 0.85, neon: 1.9 },
  { h: 20, sky: COL.skyNight, fog: COL.fogNight, near: 0.25, far: 0.7, neon: 1.9 },
  { h: 24, sky: COL.skyNight, fog: COL.fogNight, near: 0.25, far: 0.7, neon: 1.9 },
  { h: 29, sky: [0.45, 0.4, 0.55], fog: [0.5, 0.45, 0.55], near: 0.3, far: 0.9, neon: 1.4 },
];

export function createWeather() {
  return {
    time: 16 * 3600, // seconds since midnight — starts at 16:00 so the
    // golden hour arrives soon after a new game starts
    day: 1,
    weather: 'clear', // clear | rain | fog
    weatherT: 120, // seconds until the next weather change
    rainDrops: [], // {x, y, z} falling drops around the player
    phase: 'day',
  };
}

function sampleKeys(w) {
  const hour = (w.time / 3600) % 24;
  let a = DAY_KEYS[0];
  let b = DAY_KEYS[DAY_KEYS.length - 1];
  for (let i = 0; i < DAY_KEYS.length - 1; i++) {
    if (hour >= DAY_KEYS[i].h && hour < DAY_KEYS[i + 1].h) {
      a = DAY_KEYS[i];
      b = DAY_KEYS[i + 1];
      break;
    }
  }
  const span = b.h - a.h || 1;
  const t = clamp((hour - a.h) / span, 0, 1);
  const mix = (va, vb) => [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t), lerp(va[2], vb[2], t)];
  return {
    sky: mix(a.sky, b.sky),
    fog: mix(a.fog, b.fog),
    near: lerp(a.near, b.near, t),
    far: lerp(a.far, b.far, t),
    neon: lerp(a.neon, b.neon, t),
    hour,
  };
}

export function weatherSample(w) {
  const s = sampleKeys(w);
  // Weather modifies the sample: rain darkens + shortens fog, fog
  // shortens the fog distance hard.
  if (w.weather === 'rain') {
    s.sky = s.sky.map((v) => v * 0.7);
    s.fog = s.fog.map((v) => v * 0.75);
    s.far *= 0.75;
    s.neon *= 0.85;
  } else if (w.weather === 'fog') {
    s.far = 0.35;
    s.near = 0.05;
    s.neon *= 0.85;
  }
  return s;
}

export function phaseName(w) {
  const hour = (w.time / 3600) % 24;
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19.5) return 'sunset';
  return 'night';
}

export function stepWeather(game, dt) {
  const w = game.weather;
  // A full game day lasts TUNE.dayLengthSec real seconds (720), so the
  // clock advances 86400 / 720 = 120 game-seconds per real second.
  // Advancing 1:1 would make the golden hour take 2+ real hours
  // instead of ~2 minutes.
  w.time += dt * (24 * 3600 / TUNE.dayLengthSec);
  if (w.time >= 24 * 3600) {
    w.time -= 24 * 3600;
    w.day++;
    game.state.day = w.day;
  }
  w.phase = phaseName(w);
  // Weather changes every 90-180 s.
  w.weatherT -= dt;
  if (w.weatherT <= 0) {
    w.weatherT = TUNE.weatherMinSec + Math.random() * (TUNE.weatherMaxSec - TUNE.weatherMinSec);
    const roll = Math.random();
    w.weather = roll < 0.6 ? 'clear' : roll < 0.85 ? 'rain' : 'fog';
  }
  // Rain particles around the player (capped at 100).
  const p = game.state.player;
  if (w.weather === 'rain') {
    while (w.rainDrops.length < TUNE.rainDrops) {
      w.rainDrops.push({
        x: p.x + (Math.random() - 0.5) * 60,
        y: 20 + Math.random() * 20,
        z: p.z + (Math.random() - 0.5) * 60,
      });
    }
    for (const d of w.rainDrops) {
      d.y -= dt * 30;
      if (d.y < 0) {
        d.y = 20 + Math.random() * 20;
        d.x = p.x + (Math.random() - 0.5) * 60;
        d.z = p.z + (Math.random() - 0.5) * 60;
      }
    }
  } else if (w.rainDrops.length > 0) {
    w.rainDrops.length = 0;
  }
}

// "Day 1 · 16:00 · sunset · clear" — the HUD clock line.
export function clockText(game) {
  const w = game.weather;
  const hour = Math.floor((w.time / 3600) % 24);
  const min = Math.floor((w.time / 60) % 60);
  const hh = String(hour).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return 'Day ' + w.day + ' · ' + hh + ':' + mm + ' · ' + w.phase + ' · ' + w.weather;
}

// Rain drops as thin boxes in the dynamic batch.
export function rainBoxes(game, out) {
  const w = game.weather;
  if (w.weather !== 'rain') return;
  for (const d of w.rainDrops) {
    out.pushBox(d.x, d.y, d.z, 0.1, 1.2, 0.1, [0.7, 0.8, 0.95]);
  }
}
