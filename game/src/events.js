// Solmar Bay — city events.
//
// Rotating events keep the city moving: a beach party (crowd +
// music on the sand), a street race (cars loop the ring road),
// and a market day (stalls + crowds downtown). An event runs
// for a few minutes, then the next one is scheduled.

import { makeRng } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { showToast } from './state.js';

const EVENT_DEFS = [
  { id: 'beachParty', label: 'Beach party', x: -330, z: 40, dur: 240 },
  { id: 'streetRace', label: 'Street race', x: 0, z: 0, dur: 180 },
  { id: 'marketDay', label: 'Market day', x: 30, z: 30, dur: 300 },
];

export function stepEvents(game, dt, rng) {
  game.eventTimer -= dt;
  if (game.eventTimer > 0) return;
  const r = rng ? rng() : Math.random();
  const def = EVENT_DEFS[Math.floor(r * EVENT_DEFS.length)];
  game.event = { ...def, t: def.dur };
  game.eventTimer = def.dur + 120 + r * 120;
  showToast(game, `Event: ${def.label}!`);
  if (game.audio) game.audio.sfx('mission');
}

export function stepEventActive(game, dt) {
  if (!game.event) return;
  game.event.t -= dt;
  if (game.event.t <= 0) {
    showToast(game, `${game.event.label} is over.`);
    game.event = null;
  }
}

// Event boxes: party lights + stalls + race flags.
export function eventBoxes(game, b, cam) {
  if (!game.event) return 0;
  const uv = tileUV('plain');
  const e = game.event;
  if (e.id === 'beachParty') {
    for (let i = 0; i < 6; i++) {
      const col = [[1, 0.25, 0.6], [0.2, 0.9, 1], [1, 0.75, 0.15]][i % 3];
      pushBox(b, e.x - 10 + i * 4, 4 + Math.sin(game.time * 3 + i) * 0.5, e.z, 1, 1, 1, col, uv);
    }
  } else if (e.id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      pushBox(b, -180 + i * 120, 3, -180, 0.5, 3, 0.5, [0.9, 0.2, 0.2], uv);
    }
  } else if (e.id === 'marketDay') {
    for (let i = 0; i < 5; i++) {
      pushBox(b, e.x - 8 + i * 4, 1.5, e.z + 4, 3, 2.5, 2, [[0.9, 0.4, 0.2], [0.2, 0.7, 0.9], [0.95, 0.8, 0.2]][i % 3], uv);
    }
  }
  return 6;
}
