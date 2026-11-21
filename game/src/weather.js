// Solmar Bay — time of day + weather.
// The clock runs 120x real time (1 game hour = 30 real seconds,
// a full day = 720 s). sampleAt returns the sky/fog/neon for an
// hour by interpolating between keyframes; fog distances are in
// metres and fogNear is always 60 m.

const KEYS = [
  { h: 0, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.14], fogFar: 180, neon: 1.9 },
  { h: 5, sky: [0.05, 0.07, 0.15], fog: [0.06, 0.08, 0.16], fogFar: 200, neon: 1.9 },
  { h: 6, sky: [0.85, 0.55, 0.4], fog: [0.8, 0.55, 0.42], fogFar: 260, neon: 1.4 },
  { h: 6.5, sky: [0.95, 0.7, 0.5], fog: [0.9, 0.68, 0.5], fogFar: 300, neon: 1.2 },
  { h: 8, sky: [0.6, 0.78, 0.95], fog: [0.65, 0.75, 0.9], fogFar: 380, neon: 1.0 },
  { h: 12, sky: [0.55, 0.75, 0.95], fog: [0.6, 0.72, 0.9], fogFar: 420, neon: 1.0 },
  { h: 13, sky: [0.55, 0.75, 0.95], fog: [0.6, 0.72, 0.9], fogFar: 420, neon: 1.0 },
  { h: 16, sky: [0.7, 0.75, 0.9], fog: [0.7, 0.72, 0.88], fogFar: 360, neon: 1.1 },
  { h: 17, sky: [1.0, 0.62, 0.35], fog: [0.98, 0.6, 0.38], fogFar: 300, neon: 1.6 },
  { h: 18, sky: [1.0, 0.45, 0.2], fog: [0.95, 0.45, 0.25], fogFar: 260, neon: 1.6 },
  { h: 18.75, sky: [0.7, 0.35, 0.45], fog: [0.65, 0.35, 0.45], fogFar: 220, neon: 1.9 },
  { h: 20, sky: [0.1, 0.12, 0.25], fog: [0.1, 0.12, 0.24], fogFar: 190, neon: 1.9 },
  { h: 23, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.14], fogFar: 180, neon: 1.9 },
  { h: 24, sky: [0.04, 0.06, 0.13], fog: [0.05, 0.07, 0.14], fogFar: 180, neon: 1.9 },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 16.5) return 'day';
  if (h >= 16.5 && h < 17.5) return 'golden';
  if (h >= 17.5 && h < 19) return 'sunset';
  return 'night';
}

export function sampleAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = (b.h - a.h) || 1;
  const t = Math.max(0, Math.min(1, (h - a.h) / span));
  return {
    sky: lerp3(a.sky, b.sky, t),
    fog: lerp3(a.fog, b.fog, t),
    fogNear: 60,
    fogFar: lerp(a.fogFar, b.fogFar, t),
    neonBoost: lerp(a.neon, b.neon, t),
    phase: phaseAt(h),
  };
}

// Pick the next weather from a random roll: <0.6 clear, <0.8
// rain, otherwise fog. The timer resets to 90-180 s.
export function createWeather(game) {
  const w = {
    timer: 150,
    next(rng) {
      const r = (rng || Math.random)();
      const pick = r < 0.6 ? 'clear' : (r < 0.8 ? 'rain' : 'fog');
      w.timer = 90 + r * 90;
      return pick;
    },
    sample() {
      const s = sampleAt(game.clock);
      let fogFar = s.fogFar;
      if (game.weather === 'rain') fogFar = Math.min(fogFar, 200);
      if (game.weather === 'fog') fogFar = Math.min(fogFar, 120);
      return { ...s, fogNear: 60, fogFar };
    },
    step(dt, rng) {
      // Clock: 1 real second = 1/30 game hour (120x).
      game.clock += dt / 30;
      if (game.clock >= 24) {
        game.clock -= 24;
        game.day += 1;
      }
      game._phase = phaseAt(game.clock);
      // Rain intensity eases toward its target.
      const target = game.weather === 'rain' ? 1 : 0;
      const k = 1 - Math.exp(-dt * 0.2);
      game.rain += (target - game.rain) * k;
      if (game.rain < 0.001) game.rain = 0;
      if (game.rain > 1) game.rain = 1;
      // Weather timer.
      w.timer -= dt;
      if (w.timer <= 0) {
        game.weather = w.next(rng);
      }
    },
  };
  return w;
}
