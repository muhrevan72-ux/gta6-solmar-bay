// Solmar Bay — pedestrians: walk sidewalks in small groups, varied
// pace and colours, flee from danger, wander with smooth turns.
// Crowded: ~76 peds by default (the design cap).

import { TUNE, COL, clamp, angleLerp, dist2 } from './config.js';
import { collideCircle, onRoad } from './world.js';

export function createPedestrians(city, count) {
  const peds = [];
  const n = count || TUNE.pedCap;
  for (let i = 0; i < n; i++) {
    peds.push(spawnPed(city, peds.length));
  }
  return peds;
}

function randomSidewalkPoint(city) {
  for (let tries = 0; tries < 20; tries++) {
    const x = -300 + Math.random() * 600;
    const z = -300 + Math.random() * 600;
    if (x < -300 || Math.abs(x) % 100 < 12 || Math.abs(z) % 100 < 12) continue;
    if (city.spawns && Math.hypot(x - city.spawns.player.x, z - city.spawns.player.z) < 8) continue;
    return { x, z };
  }
  return { x: 40 + Math.random() * 40, z: 40 + Math.random() * 40 };
}

function spawnPed(city, index) {
  const pt = randomSidewalkPoint(city);
  const group = Math.floor(index / 4);
  return {
    id: index,
    x: pt.x,
    z: pt.z,
    heading: Math.random() * Math.PI * 2,
    targetHeading: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 1.6, // varied pace
    baseSpeed: 1.2 + Math.random() * 1.6,
    fleeing: 0,
    group,
    skin: COL.skin[Math.floor(Math.random() * COL.skin.length)],
    shirt: COL.shirt[Math.floor(Math.random() * COL.shirt.length)],
    pants: [0.25, 0.35, 0.6],
    wanderT: 2 + Math.random() * 4,
    bob: Math.random() * 6,
    alive: true,
  };
}

export function updatePedestrians(game, dt) {
  const peds = game.peds;
  const player = game.player;
  for (const ped of peds) {
    if (!ped.alive) continue;
    ped.bob += ped.speed * dt * 2;
    // flee if the player is close and fast/dangerous, or a bomb went off
    const d2p = dist2(ped.x, ped.z, player.x, player.z);
    if (d2p < 100 && (Math.abs(player.speed) > 8 || game.combat.bombWentOff)) {
      ped.fleeing = 2;
    }
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const away = Math.atan2(ped.x - player.x, ped.z - player.z);
      ped.targetHeading = away;
      ped.speed = ped.baseSpeed * 3.2;
    } else {
      ped.speed = ped.baseSpeed;
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 3 + Math.random() * 5;
        ped.targetHeading = Math.random() * Math.PI * 2;
      }
    }
    ped.heading = angleLerp(ped.heading, ped.targetHeading, 1 - Math.pow(0.001, dt));
    const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    // peds stay off the road centre: nudge back onto sidewalks
    if (onRoad(nx, nz) && ped.fleeing <= 0) {
      ped.targetHeading += Math.PI / 2;
      continue;
    }
    const fixed = collideCircle(game.city, nx, nz, 0.6);
    ped.x = fixed.x;
    ped.z = fixed.z;
  }
}

// Voxel boxes for one pedestrian.
export function pedBoxes(ped) {
  const bobY = Math.sin(ped.bob) * 0.05;
  const boxes = [];
  boxes.push({ x: ped.x - 0.22, y: 0.4 + bobY, z: ped.z, sx: 0.4, sy: 0.8, sz: 0.4, c: ped.pants });
  boxes.push({ x: ped.x + 0.22, y: 0.4 + bobY, z: ped.z, sx: 0.4, sy: 0.8, sz: 0.4, c: ped.pants });
  boxes.push({ x: ped.x, y: 1.2 + bobY, z: ped.z, sx: 0.9, sy: 0.8, sz: 0.5, c: ped.shirt });
  boxes.push({ x: ped.x - 0.6, y: 1.2 + bobY, z: ped.z, sx: 0.3, sy: 0.7, sz: 0.35, c: ped.shirt });
  boxes.push({ x: ped.x + 0.6, y: 1.2 + bobY, z: ped.z, sx: 0.3, sy: 0.7, sz: 0.35, c: ped.shirt });
  boxes.push({ x: ped.x, y: 1.85 + bobY, z: ped.z, sx: 0.6, sy: 0.55, sz: 0.55, c: ped.skin });
  boxes.push({ x: ped.x, y: 2.15 + bobY, z: ped.z, sx: 0.64, sy: 0.2, sz: 0.6, c: [0.15, 0.12, 0.1] });
  return boxes;
}
