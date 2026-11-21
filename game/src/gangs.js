// Solmar Bay — the two rival gangs: Golden Kings (downtown) and
// Coral Sharks (harbour). Written fresh for rebuild #18.

import { mulberry32, COL } from './config.js';
import { isBlocked, randomSidewalkPoint } from './world.js';
import { pushBox } from './render.js';
import { showToast } from './state.js';
import { damagePlayer } from './police.js';

export const TURFS = {
  kings: { cx: 0, cz: -40, r: 90 },
  sharks: { cx: -180, cz: 180, r: 90 },
};

export function gangInTurf(gang, x, z) {
  const t = TURFS[gang];
  if (!t) return false;
  return Math.hypot(x - t.cx, z - t.cz) < t.r;
}

export function spawnGangs(g) {
  const rng = mulberry32(777);
  const gangs = [];
  for (let i = 0; i < 13; i++) {
    const p = randomSidewalkPoint(rng);
    gangs.push({
      gang: 'kings', x: p.x, z: p.z, hp: 100, dead: false,
      tx: p.x, tz: p.z, speed: 1.5 + rng() * 1,
    });
  }
  for (let i = 0; i < 12; i++) {
    const p = randomSidewalkPoint(rng);
    gangs.push({
      gang: 'sharks', x: p.x, z: p.z, hp: 100, dead: false,
      tx: p.x, tz: p.z, speed: 1.5 + rng() * 1,
    });
  }
  g.gangs = gangs;
  g.gangMembers = gangs;
  g._inKingsTurf = false;
  return gangs;
}

export function stepGangs(g, dt) {
  // Entering Kings turf warns the player once.
  const inKings = gangInTurf('kings', g.player.x, g.player.z);
  if (inKings && !g._inKingsTurf) {
    showToast(g, 'Golden Kings territory — the kings run these streets');
  }
  g._inKingsTurf = inKings;
  for (const m of g.gangs) {
    if (m.dead) continue;
    const inTurf = gangInTurf(m.gang, m.x, m.z);
    const d = Math.hypot(m.x - g.player.x, m.z - g.player.z);
    if (inTurf && d < 25) {
      // Attack: close in and hit the player.
      if (d > 2) {
        m.x += ((g.player.x - m.x) / d) * 3 * dt;
        m.z += ((g.player.z - m.z) / d) * 3 * dt;
      }
      if (d < 2.5) {
        m.hitCd = (m.hitCd || 0) - dt;
        if (m.hitCd <= 0) {
          m.hitCd = 1.5;
          damagePlayer(g, 5);
        }
      }
    } else {
      // Patrol: drift toward a nearby target point.
      const dx = m.tx - m.x, dz = m.tz - m.z;
      const td = Math.hypot(dx, dz);
      if (td < 2) {
        const t = randomSidewalkPoint(Math.random);
        m.tx = t.x; m.tz = t.z;
      } else {
        m.x += (dx / td) * m.speed * dt;
        m.z += (dz / td) * m.speed * dt;
      }
    }
  }
}

// 7 boxes; the last one is the gang bandana in the gang colour.
export function gangBoxes(g, m, b, gl) {
  const col = m.gang === 'kings' ? COL.kingsGold : COL.sharksTeal;
  const skin = [0.85, 0.65, 0.5];
  const pants = [0.15, 0.15, 0.2];
  pushBox(b, m.x - 0.14, 0, m.z, 0.26, 0.9, 0.26, pants, [0, 0, 1, 1]);
  pushBox(b, m.x + 0.14, 0, m.z, 0.26, 0.9, 0.26, pants, [0, 0, 1, 1]);
  pushBox(b, m.x, 0.9, m.z, 0.75, 0.7, 0.4, col, [0, 0, 1, 1]);
  pushBox(b, m.x - 0.48, 0.95, m.z, 0.2, 0.6, 0.2, col, [0, 0, 1, 1]);
  pushBox(b, m.x + 0.48, 0.95, m.z, 0.2, 0.6, 0.2, col, [0, 0, 1, 1]);
  pushBox(b, m.x, 1.6, m.z, 0.36, 0.36, 0.36, skin, [0, 0, 1, 1]);
  // Bandana in the gang colour.
  pushBox(b, m.x, 1.9, m.z, 0.4, 0.12, 0.4, col, [0, 0, 1, 1]);
  return 7;
}
