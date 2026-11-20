// Solmar Bay — the two gangs.
//
// Bay Kings hold downtown (centre 0,-40, radius 130); Harbour Sharks
// hold the harbour (centre -180,180, radius 120). Inside their turf
// and close to the player they chase and attack; outside it they
// patrol. The bandana — the last box drawn — is the gang colour.

import { COL } from './config.js';
import { damagePlayer } from './combat.js';
import { pushBox } from './render.js';

const TURF = {
  kings: { x: 0, z: -40, r: 130 },
  sharks: { x: -180, z: 180, r: 120 },
};

export function gangInTurf(gang, x, z) {
  const t = TURF[gang];
  if (!t) return false;
  return Math.hypot(x - t.x, z - t.z) < t.r;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spawnGangs(g) {
  const rng = mulberry32(4242);
  const members = [];
  for (let i = 0; i < 13; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 100;
    members.push({
      gang: 'kings',
      x: TURF.kings.x + Math.cos(a) * r,
      z: TURF.kings.z + Math.sin(a) * r,
      heading: rng() * Math.PI * 2,
      hp: 100, dead: false, attackCd: 0,
      wanderA: rng() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 90;
    members.push({
      gang: 'sharks',
      x: TURF.sharks.x + Math.cos(a) * r,
      z: TURF.sharks.z + Math.sin(a) * r,
      heading: rng() * Math.PI * 2,
      hp: 100, dead: false, attackCd: 0,
      wanderA: rng() * Math.PI * 2,
    });
  }
  g.gangMembers = members;
}

export function stepGangs(g, dt) {
  for (const m of g.gangMembers) {
    if (m.dead) continue;
    m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
    const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
    const inTurf = gangInTurf(m.gang, g.player.x, g.player.z);
    if (inTurf && d < 30) {
      // Chase and attack.
      if (d > 2.5) {
        const step = Math.min(d - 2, 3.5 * dt);
        m.x += ((g.player.x - m.x) / d) * step;
        m.z += ((g.player.z - m.z) / d) * step;
        m.heading = Math.atan2((g.player.x - m.x) / d, (g.player.z - m.z) / d);
      } else if (m.attackCd <= 0) {
        damagePlayer(g, 5);
        m.attackCd = 1;
      }
    } else {
      // Patrol: wander slowly, turning now and then.
      if (Math.random() < 0.02) m.wanderA = Math.random() * Math.PI * 2;
      m.x += Math.sin(m.wanderA) * 1.2 * dt;
      m.z += Math.cos(m.wanderA) * 1.2 * dt;
      m.heading = m.wanderA;
    }
  }
}

// The gang model: head, torso, 2 arms, 2 legs — 6 boxes — plus the
// bandana last, in the gang colour.
export function gangBoxes(g, m, b, camera) {
  if (m.dead) return 0;
  const col = m.gang === 'kings' ? COL.kingsGold : COL.sharksTeal;
  const shirt = m.gang === 'kings' ? [0.9, 0.75, 0.2] : [0.15, 0.6, 0.75];
  const skin = [0.85, 0.65, 0.5];
  let n = 0;
  const put = (x, y, z, w, h, d, c) => { pushBox(b, x, y, z, w, h, d, c); n++; };
  put(m.x, 1.5, m.z, 0.42, 0.42, 0.42, skin); // head
  put(m.x, 0.9, m.z, 0.62, 0.62, 0.36, shirt); // torso
  put(m.x - 0.38, 0.9, m.z, 0.2, 0.6, 0.2, shirt); // left arm
  put(m.x + 0.38, 0.9, m.z, 0.2, 0.6, 0.2, shirt); // right arm
  put(m.x - 0.15, 0.3, m.z, 0.24, 0.6, 0.24, [0.2, 0.2, 0.25]); // left leg
  put(m.x + 0.15, 0.3, m.z, 0.24, 0.6, 0.24, [0.2, 0.2, 0.25]); // right leg
  put(m.x, 1.85, m.z, 0.44, 0.12, 0.44, col); // bandana (last)
  return n;
}
