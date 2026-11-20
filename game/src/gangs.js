// Solmar Bay — rival gangs (rebuild #13).
// Bay Kings own Downtown; Harbour Sharks own the Harbour.
// Members attack the player inside their turf — but never during
// the 5-second spawn grace period after (re)spawning.
import { pushBox } from './render.js';
import { damagePlayer } from './combat.js';
import { COL } from './config.js';

export function gangInTurf(gang, x, z) {
  if (gang === 'kings') return x >= -180 && x <= 180 && z >= -180 && z <= 120;
  if (gang === 'sharks') return x >= -300 && x <= -120 && z >= 120 && z <= 300;
  return false;
}

export function spawnGangs(g) {
  // No gang member spawns within 40 m of the player spawn (0, 20):
  // the player must be able to boot in and look around before anyone
  // can reach them, and a member standing on the spawn would make the
  // opening seconds (and a bomb thrown at the spawn) a coin flip.
  // The clear zone is far outside every gang's chase radius (18 m),
  // so a member still has to patrol in before it can attack.
  const clear = (x, z) => Math.hypot(x - 0, z - 20) >= 40;
  const members = [];
  for (let i = 0; i < 13; i++) {
    let x, z;
    do {
      x = -150 + Math.random() * 300;
      z = -150 + Math.random() * 240;
    } while (!clear(x, z));
    members.push({
      gang: 'kings',
      x, z,
      hp: 100, dead: false, heading: Math.random() * Math.PI * 2, speed: 3.5, _assaulted: false,
    });
  }
  for (let i = 0; i < 12; i++) {
    let x, z;
    do {
      x = -290 + Math.random() * 160;
      z = 130 + Math.random() * 150;
    } while (!clear(x, z));
    members.push({
      gang: 'sharks',
      x, z,
      hp: 100, dead: false, heading: Math.random() * Math.PI * 2, speed: 3.5, _assaulted: false,
    });
  }
  g.gangMembers = members;
}

export function stepGangs(g, dt) {
  for (const m of g.gangMembers) {
    if (m.dead) continue;
    const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
    const inTurf = gangInTurf(m.gang, g.player.x, g.player.z);
    if (inTurf && d < 18 && g._spawnGrace <= 0) {
      // Chase and attack.
      if (d > 0.01) {
        m.x += ((g.player.x - m.x) / d) * m.speed * dt;
        m.z += ((g.player.z - m.z) / d) * m.speed * dt;
      }
      if (d < 2.5) damagePlayer(g, 4 * dt);
    } else {
      // Patrol: wander.
      m.heading += (Math.random() - 0.5) * dt * 2;
      m.x += Math.sin(m.heading) * 1.2 * dt;
      m.z += Math.cos(m.heading) * 1.2 * dt;
    }
  }
}

// 7 boxes: legs 2, torso, arms 2, head, bandana (LAST, gang colour).
export function gangBoxes(g, m, b, cam) {
  if (m.dead) return 0;
  const plain = [0, 0, 1, 1];
  const bandana = m.gang === 'kings' ? COL.kings : COL.sharks;
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  box(m.x - 0.14, 0.2, m.z, 0.2, 0.6, 0.2, [0.15, 0.15, 0.18]);
  box(m.x + 0.14, 0.2, m.z, 0.2, 0.6, 0.2, [0.15, 0.15, 0.18]);
  box(m.x, 0.8, m.z, 0.6, 0.6, 0.3, m.gang === 'kings' ? [0.3, 0.3, 0.35] : [0.2, 0.3, 0.45]);
  box(m.x - 0.42, 0.8, m.z, 0.18, 0.55, 0.18, [0.85, 0.65, 0.5]);
  box(m.x + 0.42, 0.8, m.z, 0.18, 0.55, 0.18, [0.85, 0.65, 0.5]);
  box(m.x, 1.4, m.z, 0.36, 0.36, 0.36, [0.85, 0.65, 0.5]);
  box(m.x, 1.72, m.z, 0.38, 0.14, 0.38, bandana);
  return n;
}
