// Solmar Bay — gangs: Bay Kings vs Harbour Sharks.
//
// Two original rival gangs in gold (downtown) and teal
// (harbour). Members hang out in groups in their turf; they turn
// hostile if the player attacks them or causes trouble in their
// turf. Killing one drops cash and raises wanted (gang murder).
// Two gang side jobs run through missions.js.

import { GANGS, TUNE, dist, makeRng, clamp } from './config.js';
import { isBlocked } from './world.js';

export function spawnGangs(game) {
  const rng = makeRng(99);
  game.gangMembers = [];
  const spawn = (gangId, turf, count) => {
    const g = GANGS[gangId];
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * turf.r * 0.7;
      const x = turf.x + Math.cos(a) * r;
      const z = turf.z + Math.sin(a) * r;
      if (isBlocked(game.city, x, z, 1)) continue;
      game.gangMembers.push({
        gang: gangId,
        x, z,
        heading: rng() * Math.PI * 2,
        hp: 100,
        hostile: false,
        speed: 2 + rng() * 1.5,
        colour: g.colour,
        bandana: g.colour,
        walkPhase: rng() * Math.PI * 2,
        target: null,
      });
    }
  };
  spawn('kings', GANGS.kings.turf, 13);
  spawn('sharks', GANGS.sharks.turf, 12);
}

// Gang members wander their turf; hostile ones chase the player
// and punch. A member turns hostile when the player attacks a
// member of the same gang, or commits a crime inside the turf.
export function stepGangs(game, dt) {
  const p = game.player;
  for (const gm of game.gangMembers) {
    // Hostility: player hurt this gang, or is committing crimes
    // inside their turf right now.
    if (!gm.hostile) {
      const g = GANGS[gm.gang];
      if (game.wanted > 0 && dist(p.x, p.z, g.turf.x, g.turf.z) < g.turf.r) {
        gm.hostile = true;
      }
    }
    if (gm.hostile) {
      const d = dist(gm.x, gm.z, p.x, p.z);
      if (d < 60) {
        const a = Math.atan2(p.x - gm.x, p.z - gm.z);
        gm.heading = a;
        if (d > 2) {
          gm.x += Math.sin(a) * gm.speed * 1.6 * dt;
          gm.z += Math.cos(a) * gm.speed * 1.6 * dt;
        } else if (!p.inCar) {
          // Gang punch.
          gm.punchT = (gm.punchT || 0) - dt;
          if (gm.punchT <= 0) {
            gm.punchT = 1;
            game.health = Math.max(0, game.health - 6);
            if (game.health <= 0) {
              game.mode = 'wasted';
              game.bustedBy = 'beaten by the ' + GANGS[gm.gang].name;
            }
          }
        }
        continue;
      }
      gm.hostile = false;
    }
    // Idle wander inside the turf.
    if (!gm.target || dist(gm.x, gm.z, gm.target.x, gm.target.z) < 2) {
      const g = GANGS[gm.gang];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * g.turf.r * 0.6;
      gm.target = { x: g.turf.x + Math.cos(a) * r, z: g.turf.z + Math.sin(a) * r };
    }
    const a = Math.atan2(gm.target.x - gm.x, gm.target.z - gm.z);
    let diff = a - gm.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    gm.heading += clamp(diff, -3 * dt, 3 * dt);
    const nx = gm.x + Math.sin(gm.heading) * gm.speed * dt;
    const nz = gm.z + Math.cos(gm.heading) * gm.speed * dt;
    if (!isBlocked(game.city, nx, gm.z, 0.6)) gm.x = nx;
    if (!isBlocked(game.city, gm.x, nz, 0.6)) gm.z = nz;
    gm.walkPhase += dt * 3;
  }
}

// Draw a gang member: like a ped, but in gang colours with a
// bandana. Reuses the ped body layout (same boxes, own colours).
export function gangBoxes(game, gm, out) {
  const bob = Math.sin(gm.walkPhase) * 0.08;
  out.push({ x: gm.x - 0.2, y: 0.15, z: gm.z, w: 0.32, h: 0.7, d: 0.32, c: [0.2, 0.2, 0.25] });
  out.push({ x: gm.x + 0.2, y: 0.15, z: gm.z, w: 0.32, h: 0.7, d: 0.32, c: [0.2, 0.2, 0.25] });
  out.push({ x: gm.x, y: 0.85 + bob, z: gm.z, w: 0.8, h: 0.8, d: 0.45, c: gm.colour });
  out.push({ x: gm.x - 0.5, y: 0.85 + bob, z: gm.z, w: 0.24, h: 0.75, d: 0.28, c: gm.colour });
  out.push({ x: gm.x + 0.5, y: 0.85 + bob, z: gm.z, w: 0.24, h: 0.75, d: 0.28, c: gm.colour });
  out.push({ x: gm.x, y: 1.65 + bob, z: gm.z, w: 0.58, h: 0.55, d: 0.5, c: [0.85, 0.65, 0.5] });
  // Bandana across the forehead.
  out.push({ x: gm.x, y: 1.82 + bob, z: gm.z, w: 0.62, h: 0.16, d: 0.54, c: gm.bandana });
  out.push({ x: gm.x, y: 1.95 + bob, z: gm.z, w: 0.5, h: 0.22, d: 0.5, c: [0.15, 0.12, 0.1] });
  return out;
}

export function gangInTurf(gangId, x, z) {
  const g = GANGS[gangId];
  return dist(x, z, g.turf.x, g.turf.z) < g.turf.r;
}
