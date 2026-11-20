// Solmar Bay — gangs.
//
// Two rival crews with turf: Bay Kings (gold, downtown) and
// Harbour Sharks (teal, harbour). Gang members patrol their turf
// and attack the player on sight when the player enters it
// uninvited. Killing a gang member is 'killGang' (2 stars).
// Turf wars: entering rival turf with a weapon out draws a fight.

import { GANGS, makeRng } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { randomSidewalkPoint, isBlocked } from './world.js';
import { dist } from './config.js';

export function spawnGangs(game) {
  const rng = makeRng(4242);
  game.gangMembers = [];
  for (let i = 0; i < 13; i++) {
    const t = randomSidewalkPoint(rng);
    game.gangMembers.push(makeGang(rng, 'kings', t.x, t.z));
  }
  for (let i = 0; i < 12; i++) {
    const t = randomSidewalkPoint(rng);
    game.gangMembers.push(makeGang(rng, 'sharks', t.x, t.z));
  }
}

function makeGang(rng, gangId, x, z) {
  const g = GANGS[gangId];
  return {
    gang: gangId,
    x,
    z,
    y: 0,
    heading: rng() * Math.PI * 2,
    hp: 120,
    speed: 2.5 + rng() * 1,
    colour: g.colour,
    target: randomSidewalkPoint(rng),
    wait: rng() * 3,
    punchCd: 0,
    dead: false,
    id: Math.random().toString(36).slice(2, 8),
  };
}

export function gangInTurf(gangId, x, z) {
  const t = GANGS[gangId].turf;
  return dist(x, z, t.x, t.z) < t.r;
}

export function stepGangs(game, dt) {
  const p = game.player;
  for (const g of game.gangMembers) {
    if (g.dead) continue;
    g.punchCd = Math.max(0, g.punchCd - dt);
    const d = dist(g.x, g.z, p.x, p.z);
    // Attack the player on sight inside their turf.
    const inTurf = gangInTurf(g.gang, p.x, p.z);
    if (inTurf && d < 25 && !p.inCar) {
      const a = Math.atan2(p.x - g.x, p.z - g.z);
      g.heading = a;
      if (d > 1.5) {
        const nx = g.x + Math.sin(a) * g.speed * 2 * dt;
        const nz = g.z + Math.cos(a) * g.speed * 2 * dt;
        if (!isBlocked(game.city, nx, nz)) {
          g.x = nx;
          g.z = nz;
        }
      } else if (g.punchCd <= 0) {
        g.punchCd = 1;
        game.health = Math.max(0, game.health - 8);
        if (game.health <= 0 && game.mode === 'play') {
          game.mode = 'wasted';
          game.bustedBy = `the ${GANGS[g.gang].name}`;
        }
      }
      continue;
    }
    // Otherwise patrol the turf.
    const td = dist(g.x, g.z, g.target.x, g.target.z);
    if (td < 1.5) {
      g.wait -= dt;
      if (g.wait <= 0) {
        g.target = randomSidewalkPoint(Math.random);
        g.wait = 1 + Math.random() * 3;
      }
      continue;
    }
    const a = Math.atan2(g.target.x - g.x, g.target.z - g.z);
    g.heading = a;
    const nx = g.x + Math.sin(a) * g.speed * dt;
    const nz = g.z + Math.cos(a) * g.speed * dt;
    if (!isBlocked(game.city, nx, nz)) {
      g.x = nx;
      g.z = nz;
    } else {
      g.target = randomSidewalkPoint(Math.random);
    }
  }
}

// Gang member: like a ped, but with a bandana in gang colours.
export function gangBoxes(game, g, b, cam) {
  if (g.dead) return 0;
  const uv = tileUV('plain');
  const skin = [0.8, 0.6, 0.45];
  pushBox(b, g.x - 0.15, 0, g.z, 0.28, 0.85, 0.28, [0.2, 0.25, 0.4], uv);
  pushBox(b, g.x + 0.15, 0, g.z, 0.28, 0.85, 0.28, [0.2, 0.25, 0.4], uv);
  pushBox(b, g.x, 0.85, g.z, 0.8, 0.7, 0.4, g.colour, uv);
  pushBox(b, g.x - 0.5, 0.9, g.z, 0.22, 0.65, 0.22, skin, uv);
  pushBox(b, g.x + 0.5, 0.9, g.z, 0.22, 0.65, 0.22, skin, uv);
  pushBox(b, g.x, 1.55, g.z, 0.45, 0.45, 0.45, skin, uv);
  // Bandana in gang colours.
  pushBox(b, g.x, 1.85, g.z, 0.48, 0.15, 0.48, g.colour, uv);
  return 7;
}
