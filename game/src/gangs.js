// Solmar Bay — gangs (rebuild #15).
// Bay Kings (gold) own downtown; Harbour Sharks (teal) own the
// harbour. A member only hurts the player when it is CLOSE and
// VISIBLE — there is no invisible turf damage (fix (a)). Entering
// Kings turf shows a clear on-screen warning instead.

import { TUNE, COL } from './config.js';
import { damagePlayer } from './combat.js';
import { showToast } from './state.js';
import { pushBox, pushBoxRot } from './render.js';
import { mulberry32 } from './state.js';

export function gangInTurf(gang, x, z) {
  if (gang === 'kings') return x >= -80 && x <= 80 && z >= -140 && z <= -20;
  if (gang === 'sharks') return x >= -280 && x <= -140 && z >= 140 && z <= 280;
  return false;
}

export function spawnGangs(g) {
  const rng = mulberry32(4242);
  const members = [];
  for (let i = 0; i < 13; i++) {
    members.push({
      gang: 'kings', x: -70 + rng() * 140, z: -130 + rng() * 100,
      hp: 100, heading: rng() * Math.PI * 2, speed: 2, attackCd: 0,
      target: null, state: 'alive',
    });
  }
  for (let i = 0; i < 12; i++) {
    members.push({
      gang: 'sharks', x: -270 + rng() * 120, z: 150 + rng() * 120,
      hp: 100, heading: rng() * Math.PI * 2, speed: 2, attackCd: 0,
      target: null, state: 'alive',
    });
  }
  g.gangMembers = members;
  return members;
}

export function stepGangs(g, dt) {
  if (!g.gangMembers) return;
  const p = g.player;
  // Turf warning (fix (a)): a clear message on entering turf.
  const inKings = gangInTurf('kings', p.x, p.z);
  const inSharks = gangInTurf('sharks', p.x, p.z);
  if (inKings && !g._warnedKings) {
    showToast(g, 'You are in Bay Kings turf — watch your back.');
    g._warnedKings = true;
  } else if (!inKings) {
    g._warnedKings = false;
  }
  if (inSharks && !g._warnedSharks) {
    showToast(g, 'You are in Harbour Sharks turf — watch your back.');
    g._warnedSharks = true;
  } else if (!inSharks) {
    g._warnedSharks = false;
  }
  for (const m of g.gangMembers) {
    if (m.hp <= 0) continue;
    m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    const playerInMyTurf = gangInTurf(m.gang, p.x, p.z);
    if (playerInMyTurf && d < 3) {
      // Visible attack: the member is right next to the player.
      // Damage routes through damagePlayer (sets the WASTED card).
      if (m.attackCd <= 0) {
        damagePlayer(g, 5);
        m.attackCd = 1;
      }
      m.heading = Math.atan2(p.x - m.x, p.z - m.z);
    } else if (playerInMyTurf && d < 25) {
      // Chase the player inside the turf.
      m.x += ((p.x - m.x) / d) * m.speed * dt;
      m.z += ((p.z - m.z) / d) * m.speed * dt;
      m.heading = Math.atan2(p.x - m.x, p.z - m.z);
    } else {
      // Patrol: drift toward a patrol point, pick a new one there.
      if (!m.target) {
        const home = m.gang === 'kings' ? { x: 0, z: -80 } : { x: -210, z: 210 };
        m.target = { x: home.x + (g.rng ? (g.rng() - 0.5) * 120 : 0), z: home.z + (g.rng ? (g.rng() - 0.5) * 120 : 0) };
      }
      const dx = m.target.x - m.x;
      const dz = m.target.z - m.z;
      const td = Math.hypot(dx, dz);
      if (td < 2) {
        m.target = null;
      } else {
        m.x += (dx / td) * m.speed * 0.5 * dt;
        m.z += (dz / td) * m.speed * 0.5 * dt;
        m.heading = Math.atan2(dx / td, dz / td);
      }
    }
  }
}

// A gang member is 7 boxes; the bandana is LAST, in the gang
// colour, so it reads clearly at a distance.
export function gangBoxes(g, m, b, camera) {
  if (!m || m.hp <= 0) return 0;
  const col = m.gang === 'kings' ? COL.kingsGold : COL.sharksTeal;
  const yaw = m.heading || 0;
  const x = m.x;
  const z = m.z;
  const skin = [0.8, 0.6, 0.45];
  pushBoxRot(b, x - 0.14, 0, z, 0.26, 0.85, 0.26, yaw, [0.25, 0.25, 0.3]);
  pushBoxRot(b, x + 0.14, 0, z, 0.26, 0.85, 0.26, yaw, [0.25, 0.25, 0.3]);
  pushBoxRot(b, x, 0.85, z, 0.62, 0.65, 0.34, yaw, col);
  pushBoxRot(b, x - 0.42, 0.9, z, 0.2, 0.6, 0.2, yaw, col);
  pushBoxRot(b, x + 0.42, 0.9, z, 0.2, 0.6, 0.2, yaw, col);
  pushBoxRot(b, x, 1.5, z, 0.42, 0.42, 0.42, yaw, skin);
  // Bandana last, in the gang colour.
  pushBoxRot(b, x, 1.82, z, 0.44, 0.14, 0.44, yaw, col);
  return 7;
}
