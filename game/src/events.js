// Solmar Bay — city events (rebuild #13).
import { pushBox } from './render.js';

const EVENT_TYPES = [
  { id: 'beachParty', label: 'Beach party', x: -330, z: 40, t: 120 },
  { id: 'streetRace', label: 'Street race', x: 0, z: 0, t: 90 },
  { id: 'marketDay', label: 'Market day', x: 30, z: 30, t: 150 },
];

export function stepEvents(g, dt, rng) {
  if (g.event) return;
  g.eventTimer -= dt;
  if (g.eventTimer > 0) return;
  const r = (rng || Math.random)();
  const type = r < 0.34 ? EVENT_TYPES[0] : r < 0.67 ? EVENT_TYPES[1] : EVENT_TYPES[2];
  g.event = { ...type };
  g.eventTimer = 120;
}

export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) g.event = null;
}

// Returns the number of boxes drawn.
export function eventBoxes(g, b, cam) {
  if (!g.event) return 0;
  const plain = [0, 0, 1, 1];
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  if (g.event.id === 'beachParty') {
    for (let i = 0; i < 6; i++) {
      box(g.event.x - 10 + i * 4, 4, g.event.z, 1, 1, 1, [[1, 0.3, 0.5], [0.2, 0.9, 1], [1, 0.8, 0.2]][i % 3]);
    }
  } else if (g.event.id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      box(g.event.x - 6 + i * 4, 3, g.event.z, 0.4, 3, 0.4, [0.9, 0.9, 0.9]);
      box(g.event.x - 6 + i * 4, 4.5, g.event.z, 1.6, 1, 0.1, i % 2 ? [0.9, 0.2, 0.2] : [0.95, 0.95, 0.95]);
    }
  } else if (g.event.id === 'marketDay') {
    for (let i = 0; i < 4; i++) {
      box(g.event.x - 9 + i * 6, 1, g.event.z, 2.5, 1.8, 2.5, [0.8, 0.5, 0.3]);
      box(g.event.x - 9 + i * 6, 2.8, g.event.z, 3, 0.3, 3, [0.9, 0.7, 0.4]);
    }
  }
  return n;
}
