// Solmar Bay — gangs: two original rival gangs.
//
// Bay Kings (gold) own downtown; Harbour Sharks (teal) own the
// harbour. Gang members hang out in groups in their turf; the turf
// zones show on the minimap. They turn hostile if the player attacks
// them or causes trouble in their turf. Killing gang members drops
// cash and raises wanted (commitCrime 'killGang', 2 stars). Two gang
// side jobs run through the side-mission markers: turf clear-out and
// gang delivery.

import { GANGS, dist2 } from './config.js';
import { showToast, damagePlayer } from './state.js';

export function createGangs() {
  return {
    hostility: { kings: 0, sharks: 0 }, // 0 calm .. 100 at war with you
    turfWar: null, // active turf-war event {gang, x, z, t}
  };
}

export function gangAt(game, x, z) {
  for (const [id, g] of Object.entries(GANGS)) {
    if (Math.abs(x - g.turf.x) < g.turf.hx && Math.abs(z - g.turf.z) < g.turf.hz) return id;
  }
  return null;
}

// Called when the player attacks a gang member or makes trouble in
// a gang's turf: that gang turns hostile.
export function provokeGang(game, gangId, amount) {
  const g = game.gangs;
  g.hostility[gangId] = Math.min(100, g.hostility[gangId] + amount);
  if (g.hostility[gangId] >= 50) {
    showToast(game.state, GANGS[gangId].name + ' are gunning for you now.', 3);
  }
}

export function stepGangs(game, dt) {
  const g = game.gangs;
  // Hostility cools down slowly when the player stays out of the turf.
  const playerGang = gangAt(game, game.state.player.x, game.state.player.z);
  for (const id of Object.keys(g.hostility)) {
    if (id !== playerGang) g.hostility[id] = Math.max(0, g.hostility[id] - dt * 0.5);
  }
  // Hostile gang members near the player chase and swing at them.
  for (const p of game.peds.list) {
    if (!p.gang || p.hp <= 0) continue;
    const hostile = g.hostility[p.gang] >= 40;
    if (!hostile) continue;
    const d = Math.sqrt(dist2(p.x, p.z, game.state.player.x, game.state.player.z));
    if (d < 30) {
      p.heading = Math.atan2(game.state.player.x - p.x, game.state.player.z - p.z);
      p.x += Math.sin(p.heading) * p.speed * 1.4 * dt;
      p.z += Math.cos(p.heading) * p.speed * 1.4 * dt;
      // Swing at most once per second (the old code rolled every
      // frame: ~1.5 hits/s per gang member).
      if (p.hitT > 0) p.hitT -= dt;
      if (d < 2 && p.hitT <= 0) {
        p.hitT = 1.0;
        damagePlayer(game.state, 6);
      }
    }
  }
}

export function gangBoxes(p, out) {
  // Gang members wear their gang colour as a bandana + jacket trim.
  const c = GANGS[p.gang].colour;
  out.pushBoxRot(p.x, 2.25, p.z, 0.58, 0.14, 0.52, c, p.heading);
}

export { GANGS };
