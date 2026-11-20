// Solmar Bay — two rival gangs: the Bay Kings (gold, downtown) and
// the Harbour Sharks (teal, harbour). Members attack the player on
// sight inside their turf.

import { GANGS } from './config.js';
import { pushBox } from './render.js';

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gangInTurf(gang, x, z) {
  const def = GANGS[gang];
  if (!def) return false;
  return x >= def.turf.x0 && x <= def.turf.x1 && z >= def.turf.z0 && z <= def.turf.z1;
}

export function spawnGangs(g) {
  const rng = mulberry32(777);
  g.gangMembers = [];
  for (const [key, def] of Object.entries(GANGS)) {
    const count = key === 'kings' ? 13 : 12;
    for (let i = 0; i < count; i++) {
      const x = def.turf.x0 + rng() * (def.turf.x1 - def.turf.x0);
      const z = def.turf.z0 + rng() * (def.turf.z1 - def.turf.z0);
      g.gangMembers.push({
        gang: key, x, z, heading: rng() * Math.PI * 2,
        hp: 100, dead: false, colour: def.colour, bandana: def.colour,
        speed: 2 + rng(),
        home: { x, z },
      });
    }
  }
}

// Gang members patrol their turf; inside their turf they attack the
// player on sight. Outside turf they drift back toward home.
export function stepGangs(g, dt) {
  for (const m of g.gangMembers) {
    if (m.dead) continue;
    const dx = g.player.x - m.x;
    const dz = g.player.z - m.z;
    const d = Math.hypot(dx, dz) || 1;
    if (gangInTurf(m.gang, g.player.x, g.player.z) && d < 25) {
      // Attack: close in and hit the player (5 HP/s at close range).
      m.x += (dx / d) * m.speed * 1.5 * dt;
      m.z += (dz / d) * m.speed * 1.5 * dt;
      m.heading = Math.atan2(dx, dz);
      if (d < 1.5) {
        g.health -= 5 * dt;
        if (g.health <= 0) {
          g.health = 0;
          g.mode = 'wasted';
        }
      }
    } else {
      // Patrol: drift toward home, then wander.
      const hx = m.home.x - m.x;
      const hz = m.home.z - m.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 5) {
        m.x += (hx / hd) * m.speed * 0.5 * dt;
        m.z += (hz / hd) * m.speed * 0.5 * dt;
        m.heading = Math.atan2(hx, hz);
      } else {
        m.x += Math.sin(m.heading) * m.speed * 0.3 * dt;
        m.z += Math.cos(m.heading) * m.speed * 0.3 * dt;
        if (Math.random() < 0.01) m.heading += (Math.random() - 0.5) * 2;
      }
    }
  }
}

// A gang member is 7 boxes; the last one (the bandana) is drawn in
// the gang colour.
export function gangBoxes(g, member, batch, cam) {
  if (member.dead) return 0;
  const h = 1.85;
  let n = 0;
  const box = (x, y, z, w, hh, d, col) => { pushBox(batch, x, y, z, w, hh, d, col); n++; };
  const m = member;
  box(m.x - 0.18, 0, m.z, 0.32, 0.8, 0.32, [0.15, 0.15, 0.2]);
  box(m.x + 0.18, 0, m.z, 0.32, 0.8, 0.32, [0.15, 0.15, 0.2]);
  box(m.x, 0.8, m.z, 0.7, 0.6, 0.4, m.colour);
  box(m.x - 0.5, 0.85, m.z, 0.22, 0.55, 0.22, m.colour);
  box(m.x + 0.5, 0.85, m.z, 0.22, 0.55, 0.22, m.colour);
  box(m.x, 1.4, m.z, 0.45, 0.4, 0.4, [0.9, 0.75, 0.6]);
  box(m.x, 1.72, m.z, 0.48, 0.14, 0.44, m.bandana);
  return n;
}
