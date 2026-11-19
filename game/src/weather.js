// Solmar Bay — weather + day/night cycle.
//
// A game-day lasts TUNE.dayLengthSec real seconds. The time of day
// drives the sky colour, fog colour/density and light level through
// keyframes (night / dawn / day / sunset); the weather state
// (clear / rain / fog) changes every 90-180s and modifies the fog
// further. Rain draws visible falling drops around the player
// (capped, cheap boxes). All state is plain data, so headless tests
// can construct any time/weather directly.

import { TUNE, clamp, lerp } from './config.js';

// hour -> { sky, fog, light }. Sky is the clear colour, fog the
// distance-fade colour (the renderer clears to the fog colour).
//
// The sunset is a GOLDEN HOUR look (the reference: the bounty
// leader's "GOLDEN HOUR KINGS" — warm orange/pink sky, warm low
// light, neon glowing). The game starts at 16:00, so the player
// watches the city warm into golden hour within ~30 seconds, peak
// sunset at 18:00, a pink dusk afterglow, then night.
const KEYS = [
  { h: 0, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.15], light: 0.45 },
  { h: 5, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.15], light: 0.45 },
  { h: 6.5, sky: [0.98, 0.62, 0.45], fog: [0.95, 0.65, 0.55], light: 0.8 },
  { h: 8, sky: [0.55, 0.8, 0.95], fog: [0.72, 0.85, 0.95], light: 1.0 },
  { h: 16, sky: [0.55, 0.8, 0.95], fog: [0.72, 0.85, 0.95], light: 1.0 },
  { h: 17, sky: [1.0, 0.62, 0.38], fog: [1.0, 0.66, 0.45], light: 0.95 },
  { h: 18, sky: [1.0, 0.45, 0.3], fog: [1.0, 0.55, 0.45], light: 0.85 },
  { h: 18.75, sky: [0.75, 0.35, 0.5], fog: [0.8, 0.45, 0.55], light: 0.6 },
  { h: 19.5, sky: [0.05, 0.07, 0.14], fog: [0.06, 0.08, 0.16], light: 0.5 },
  { h: 24, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.15], light: 0.45 },
];

export function phaseFor(hour) {
  if (hour < 5 || hour >= 19) return 'Night';
  if (hour < 7) return 'Dawn';
  if (hour < 17) return 'Day';
  return 'Sunset';
}

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Keyframe colours for one hour of the day (0..24).
export function keyframeFor(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (h >= KEYS[i].h && h <= KEYS[i + 1].h) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const span = b.h - a.h || 1;
  const t = clamp((h - a.h) / span, 0, 1);
  return {
    sky: lerp3(a.sky, b.sky, t),
    fog: lerp3(a.fog, b.fog, t),
    light: lerp(a.light, b.light, t),
  };
}

export function createWeather() {
  return {
    time: 16.0, // game hours; starts late afternoon (sunset palette)
    day: 1, // game day, increments when the clock wraps past 24
    weather: 'clear', // clear | rain | fog
    weatherT: 0, // seconds in the current weather
    nextChange: 120, // seconds until the weather may change
    rain: [], // rain drops { x, y, z } around the player
  };
}

function seedRain(w, game) {
  const p = game.player;
  w.rain = [];
  for (let i = 0; i < TUNE.rainDrops; i++) {
    w.rain.push({
      x: p.x + (Math.random() * 90 - 45),
      y: Math.random() * 25,
      z: p.z + (Math.random() * 90 - 45),
    });
  }
}

export function updateWeather(game, dt) {
  const w = game.weather;
  if (!w) return;
  // advance the clock: one game day per TUNE.dayLengthSec seconds
  const before = w.time;
  w.time = (w.time + (dt * 24) / TUNE.dayLengthSec) % 24;
  if (w.time < before) w.day = (w.day || 1) + 1; // wrapped past midnight
  // weather state machine
  w.weatherT += dt;
  w.nextChange -= dt;
  if (w.nextChange <= 0) {
    const r = Math.random();
    const next = r < 0.6 ? 'clear' : r < 0.8 ? 'rain' : 'fog';
    if (next !== w.weather) {
      w.weather = next;
      w.weatherT = 0;
      if (next === 'rain') seedRain(w, game);
      else w.rain = [];
    }
    w.nextChange = TUNE.weatherMinSec + Math.random() * (TUNE.weatherMaxSec - TUNE.weatherMinSec);
  }
  // rain falls and recycles around the player
  if (w.weather === 'rain' && w.rain.length) {
    const p = game.player;
    for (const d of w.rain) {
      d.y -= 20 * dt;
      if (d.y <= 0) {
        d.y = 25;
        d.x = p.x + (Math.random() * 90 - 45);
        d.z = p.z + (Math.random() * 90 - 45);
      }
    }
  }
}

// Everything the renderer + HUD need for this frame.
export function currentSky(w) {
  const base = keyframeFor(w.time);
  const phase = phaseFor(w.time);
  // Neon signs glow brighter as the daylight fades: dim by day,
  // bright at sunset, brightest at night (golden-hour look).
  let neon = phase === 'Night' ? 1.9 : phase === 'Sunset' ? 1.6 : phase === 'Dawn' ? 1.4 : 1.0;
  if (w.weather === 'rain' || w.weather === 'fog') neon *= 0.85;
  const out = {
    sky: base.sky,
    fog: base.fog,
    fogNear: 120,
    fogFar: 700,
    light: base.light,
    neon,
    phase,
    weather: w.weather,
    day: w.day || 1,
    clock: clockText(w.time),
  };
  if (w.weather === 'rain') {
    out.fog = [out.fog[0] * 0.55, out.fog[1] * 0.55, out.fog[2] * 0.6];
    out.fogNear = 60;
    out.fogFar = 320;
    out.light = Math.min(out.light, 0.6);
  } else if (w.weather === 'fog') {
    out.fog = [0.75, 0.78, 0.8];
    out.fogNear = 30;
    out.fogFar = 220;
    out.light = Math.min(out.light, 0.7);
  }
  return out;
}

export function clockText(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Neon sign boxes, drawn dynamically so their brightness follows
// the time of day (dim by day, glowing at sunset and night). The
// base colour is never mutated — the boost makes a fresh array, and
// channels are capped so the glow stays a colour, not white.
export function neonBoxes(game) {
  const list = game.city && game.city.neon;
  if (!list || !list.length) return [];
  const boost = currentSky(game.weather).neon;
  if (boost <= 1.0) return list.map((b) => ({ ...b }));
  return list.map((b) => ({
    ...b,
    c: [
      Math.min(b.c[0] * boost, 1.8),
      Math.min(b.c[1] * boost, 1.8),
      Math.min(b.c[2] * boost, 1.8),
    ],
  }));
}

// Dynamic boxes for the rain (empty unless raining). Capped at
// TUNE.rainDrops so low-spec devices stay fine.
export function weatherBoxes(game) {
  const w = game.weather;
  if (!w || w.weather !== 'rain' || !w.rain.length) return [];
  const boxes = [];
  for (const d of w.rain) {
    boxes.push({ x: d.x, y: d.y, z: d.z, sx: 0.12, sy: 1.4, sz: 0.12, c: [0.7, 0.8, 1], a: 0.55 });
  }
  return boxes;
}
