// Solmar Bay — weather + day/night cycle (rebuild #13).
// Fog distances are in METRES (fogNear 60, fogFar 180–420).
// The clock runs 120x real time: 30 s real = 1 game hour,
// a full day is 720 s.

const KEYS = [
  { h: 0, phase: 'night', sky: [0.05, 0.07, 0.15], fog: [0.05, 0.07, 0.15], fogFar: 180, neonBoost: 1.9 },
  { h: 6, phase: 'dawn', sky: [0.9, 0.6, 0.5], fog: [0.85, 0.65, 0.55], fogFar: 260, neonBoost: 1.3 },
  { h: 12, phase: 'day', sky: [0.45, 0.7, 0.95], fog: [0.6, 0.75, 0.9], fogFar: 420, neonBoost: 1.0 },
  { h: 17, phase: 'golden', sky: [1.0, 0.65, 0.3], fog: [0.95, 0.7, 0.45], fogFar: 300, neonBoost: 1.6 },
  { h: 18, phase: 'sunset', sky: [0.98, 0.45, 0.2], fog: [0.9, 0.5, 0.3], fogFar: 260, neonBoost: 1.6 },
  { h: 23, phase: 'night', sky: [0.05, 0.07, 0.15], fog: [0.05, 0.07, 0.15], fogFar: 180, neonBoost: 1.9 },
];

export function phaseAt(h) {
  const hh = ((h % 24) + 24) % 24;
  if (hh >= 5 && hh < 7) return 'dawn';
  if (hh >= 7 && hh < 16) return 'day';
  if (hh >= 16 && hh < 18) return 'golden';
  if (hh >= 18 && hh < 19) return 'sunset';
  return 'night';
}

export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  // Find the bracketing keyframes (wrap at midnight).
  let a = KEYS[KEYS.length - 1], b = KEYS[0];
  for (let i = 0; i < KEYS.length; i++) {
    if (KEYS[i].h <= h) a = KEYS[i];
    if (KEYS[i].h > h) { b = KEYS[i]; break; }
  }
  let span = b.h - a.h;
  if (span <= 0) span += 24;
  let t = (h - a.h) / span;
  if (t < 0) t += 1;
  if (t > 1) t = 1;
  const lerp = (u, v) => u + (v - u) * t;
  const sky = [lerp(a.sky[0], b.sky[0]), lerp(a.sky[1], b.sky[1]), lerp(a.sky[2], b.sky[2])];
  const fog = [lerp(a.fog[0], b.fog[0]), lerp(a.fog[1], b.fog[1]), lerp(a.fog[2], b.fog[2])];
  return {
    phase: phaseAt(h),
    sky,
    fog,
    fogNear: 60,
    fogFar: lerp(a.fogFar, b.fogFar),
    neonBoost: lerp(a.neonBoost, b.neonBoost),
  };
}

export function createWeather(game) {
  const w = {
    timer: 120,
    next(rng) {
      const r = rng();
      let next;
      if (r < 0.6) next = 'clear';
      else if (r < 0.85) next = 'rain';
      else next = 'fog';
      this.timer = 90 + rng() * 90;
      return next;
    },
    step(dt, rng) {
      // Clock: 120x — dt seconds real = dt/30 game hours.
      game.clock += dt / 30;
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      game._phase = phaseAt(game.clock);
      this.timer -= dt;
      if (this.timer <= 0) {
        game.weather = this.next(rng || Math.random);
      }
      // Rain intensity eases toward its target.
      const target = game.weather === 'rain' ? 1 : 0;
      const rate = dt * 0.1;
      if (game.rain < target) game.rain = Math.min(target, game.rain + rate);
      else if (game.rain > target) game.rain = Math.max(target, game.rain - rate);
    },
    sample() {
      const s = sampleAt(game.clock);
      let fogFar = s.fogFar;
      if (game.weather === 'rain') fogFar = Math.min(fogFar, 200);
      if (game.weather === 'fog') fogFar = Math.min(fogFar, 120);
      return { ...s, fogNear: 60, fogFar };
    },
  };
  return w;
}
