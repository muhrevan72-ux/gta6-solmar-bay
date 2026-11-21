// Solmar Bay — the two rival gangs.
// Bay Kings (gold) own downtown; Harbour Sharks (teal) own the
// harbour. A member attacks only inside its own turf, only up
// close (~3 m), about 2 damage per hit.

import { COL } from './config.js';
import { pushBox } from './render.js';
import { damagePlayer, showToast } from './state.js';

export const TURFS = {
  kings: { x0: -150, x1: 150, z0: -150, z1: 50 },
  sharks: { x0: -400, x1: -100, z0: 150, z1: 400 },
};

export function gangInTurf(gang, x, z) {
  const t = TURFS[gang];
  if (!t) return false;
  return x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1;
}

export function spawnGangs(g) {
  let seed = 4242;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  g.gangMembers = [];
  const inPath = (x, z) => {
    // Keep the walk from the spawn to the starter car clear.
    return z > 10 && z < 30 && x > -35 && x < 10;
  };
  for (let i = 0; i < 13; i++) {
    let x, z;
    do {
      x = -140 + rng() * 280;
      z = -140 + rng() * 180;
    } while (inPath(x, z));
    g.gangMembers.push({ x, z, gang: 'kings', type: 'gang', hp: 100, dead: false, attackCd: 0, color: COL.kingsGold, patrolA: rng() * Math.PI * 2, patrolT: 0 });
  }
  for (let i = 0; i < 12; i++) {
    const x = -380 + rng() * 260;
    const z = 160 + rng() * 220;
    g.gangMembers.push({ x, z, gang: 'sharks', type: 'gang', hp: 100, dead: false, attackCd: 0, color: COL.sharksTeal, patrolA: rng() * Math.PI * 2, patrolT: 0 });
  }
  return g.gangMembers;
}

export function stepGangs(g, dt) {
  // Entering Kings turf warns the player once.
  const inKings = gangInTurf('kings', g.player.x, g.player.z);
  if (inKings && g._turfWarned !== 'kings') {
    showToast(g, 'You are in Bay Kings turf — watch your back');
    g._turfWarned = 'kings';
  } else if (!inKings && g._turfWarned === 'kings') {
    g._turfWarned = null;
  }
  for (const m of g.gangMembers) {
    if (m.dead) continue;
    if (m.attackCd > 0) m.attackCd -= dt;
    const dx = g.player.x - m.x, dz = g.player.z - m.z;
    const d = Math.hypot(dx, dz);
    // Attack: up close, and the player must be inside this gang's turf.
    if (d < 3 && gangInTurf(m.gang, g.player.x, g.player.z)) {
      if (m.attackCd <= 0) {
        damagePlayer(g, 2);
        m.attackCd = 1;
      }
      continue;
    }
    // Patrol when the player is far away.
    if (d > 20) {
      m.patrolT -= dt;
      if (m.patrolT <= 0) {
        m.patrolA = Math.random() * Math.PI * 2;
        m.patrolT = 2 + Math.random() * 3;
      }
      const nx = m.x + Math.cos(m.patrolA) * 1.5 * dt;
      const nz = m.z + Math.sin(m.patrolA) * 1.5 * dt;
      const t = TURFS[m.gang];
      if (nx > t.x0 + 2 && nx < t.x1 - 2 && nz > t.z0 + 2 && nz < t.z1 - 2) {
        m.x = nx; m.z = nz;
      }
    }
  }
}

// Draw a gang member (7 boxes). The LAST box is the bandana in
// the gang colour.
export function gangBoxes(g, member, batch, camera) {
  const h = 1.85;
  const c = member.color;
  // Legs.
  pushBox(batch, member.x - 0.14, 0, member.z, 0.24, 0.85, 0.24, [0.1, 0.1, 0.15]);
  pushBox(batch, member.x + 0.14, 0, member.z, 0.24, 0.85, 0.24, [0.1, 0.1, 0.15]);
  // Torso (gang colour shirt).
  pushBox(batch, member.x, 0.85, member.z, 0.62, 0.65, 0.36, c);
  // Arms.
  pushBox(batch, member.x - 0.4, 0.9, member.z, 0.2, 0.6, 0.2, c);
  pushBox(batch, member.x + 0.4, 0.9, member.z, 0.2, 0.6, 0.2, c);
  // Head.
  pushBox(batch, member.x, 1.5, member.z, 0.42, 0.42, 0.42, [0.85, 0.65, 0.5]);
  // Bandana (gang colour) — last box.
  pushBox(batch, member.x, 1.86, member.z, 0.44, 0.14, 0.44, c);
  return 7;
}
