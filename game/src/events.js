// Solmar Bay — city events: beach parties, street races, and
// market days. An event starts when the timer runs out and
// expires after its own duration.

import { pushBox } from './render.js';

export function stepEvents(g, dt, rng) {
  g.eventTimer -= dt;
  if (g.eventTimer > 0) return;
  const roll = rng ? rng() : Math.random();
  const id = roll < 0.34 ? 'beachParty' : roll < 0.67 ? 'streetRace' : 'marketDay';
  const duration = id === 'beachParty' ? 240 : id === 'streetRace' ? 180 : 300;
  const spot = id === 'beachParty' ? { x: -330, z: 40 } : id === 'streetRace' ? { x: 0, z: 0 } : { x: 30, z: 30 };
  const label = id === 'beachParty' ? 'Beach party' : id === 'streetRace' ? 'Street race' : 'Market day';
  g.event = { id, label, x: spot.x, z: spot.z, t: duration };
  g.eventTimer = 180 + Math.random() * 120;
  return g.event;
}

export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) g.event = null;
}

// Beach party: 6 lights. Street race: flags. Market: stalls.
// No event: 0.
export function eventBoxes(g, batch) {
  if (!g.event) return 0;
  const plain = [0, 0, 1, 1];
  let n = 0;
  const id = g.event.id || g.event.type;
  if (id === 'beachParty') {
    for (let i = 0; i < 6; i++) {
      const x = -320 + (i % 3) * 8;
      const z = -40 + Math.floor(i / 3) * 10;
      pushBox(batch, x, 3, z, 0.8, 0.8, 0.8, [[1, 0.3, 0.6], [0.3, 0.8, 1], [1, 0.8, 0.2]][i % 3], plain);
      n++;
    }
    return n;
  }
  if (id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      pushBox(batch, -60 + i * 40, 0, 0, 0.3, 3, 0.3, [0.9, 0.9, 0.9], plain);
      pushBox(batch, -60 + i * 40, 2.5, 0, 1.5, 1, 0.1, i % 2 ? [0.1, 0.1, 0.1] : [0.95, 0.95, 0.95], plain);
      n += 2;
    }
    return n;
  }
  // marketDay
  for (let i = 0; i < 4; i++) {
    pushBox(batch, -200 + i * 10, 0.5, 190, 4, 2.5, 3, [0.8, 0.5, 0.2], plain);
    pushBox(batch, -200 + i * 10, 3, 190, 4.5, 0.3, 3.5, [1, 0.3, 0.3], plain);
    n += 2;
  }
  return n;
}
