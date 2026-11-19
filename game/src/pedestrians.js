// Solmar Bay — pedestrians: walk the sidewalks, flee from danger,
// wait as taxi passengers, fall down when hurt.

import { COL } from './config.js';
import { resolveCollision } from './world.js';

export function createPeds(city) {
  const list = [];
  const spots = [];
  // seed pedestrians near downtown intersections + beach + suburbs
  for (const n of city.nodes) {
    if (Math.abs(n.x) < 160 && Math.abs(n.z) < 160 && Math.random() < 0.22) {
      spots.push([n.x + 8, n.z + 8]);
    }
  }
  spots.push([-300, 40], [-296, -80], [-100, -280], [40, -300], [210, 210], [260, -200]);
  for (const [x, z] of spots.slice(0, 30)) {
    list.push({
      x: x + Math.random() * 4 - 2,
      z: z + Math.random() * 4 - 2,
      heading: Math.random() * Math.PI * 2,
      speed: 1.6 + Math.random() * 1.2,
      state: 'walk', // walk | flee | dead | passenger
      health: 100,
      shirt: COL.pedShirt[Math.floor(Math.random() * COL.pedShirt.length)],
      target: null,
      fleeT: 0,
      deadT: 0,
      walkPhase: Math.random() * 6,
    });
  }
  return { list };
}

// Make every ped near (x,z) run away from it.
export function fleeFrom(peds, x, z, radius) {
  for (const p of peds.list) {
    if (p.state === 'dead') continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < radius) {
      p.state = 'flee';
      p.fleeT = 3 + Math.random();
      p.heading = Math.atan2(p.x - x, p.z - z);
    }
  }
}

export function updatePeds(dt, game) {
  const city = game.city;
  const list = game.peds.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.state === 'dead') {
      p.deadT += dt;
      if (p.deadT > 25) list.splice(i, 1);
      continue;
    }
    if (p.state === 'passenger') continue; // stands still, waiting for the taxi

    if (p.state === 'flee') {
      p.fleeT -= dt;
      const sp = 5.5;
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      const fixed = resolveCollision(p.x, p.z, 0.5, city.buildings);
      p.x = fixed.x; p.z = fixed.z;
      p.walkPhase += dt * 10;
      if (p.fleeT <= 0) p.state = 'walk';
      continue;
    }

    // walking: head for a target road node, pick a new one on arrival
    if (!p.target) {
      const n = city.nodes[Math.floor(Math.random() * city.nodes.length)];
      p.target = { x: n.x + 8, z: n.z + 8 };
    }
    const dx = p.target.x - p.x, dz = p.target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) { p.target = null; continue; }
    const want = Math.atan2(dx, dz);
    let d = (want - p.heading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    p.heading += d * Math.min(1, dt * 4);
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    const fixed = resolveCollision(p.x, p.z, 0.5, city.buildings);
    p.x = fixed.x; p.z = fixed.z;
    p.walkPhase += dt * p.speed * 2.2;

    // hit by the player's vehicle?
    const pv = game.player.inVehicle;
    if (pv && Math.abs(pv.speed) > 5) {
      const dd = Math.hypot(p.x - pv.x, p.z - pv.z);
      if (dd < 2.2) {
        game.combat.damagePed(game, p, 60, 'car');
        game.audio.thud();
      }
    }
  }
}

export function drawPeds(renderer, game) {
  for (const p of game.peds.list) {
    const yaw = p.heading;
    if (p.state === 'dead') {
      // lying flat
      renderer.box(p.x, 0.3, p.z, 0.6, 0.5, 1.7, yaw, p.shirt, p.shirt);
      renderer.box(p.x, 0.35, p.z + 1.0, 0.45, 0.4, 0.45, yaw, COL.playerSkin, COL.playerSkin);
      continue;
    }
    const swing = Math.sin(p.walkPhase) * 0.25;
    const bob = Math.abs(Math.sin(p.walkPhase)) * 0.05;
    renderer.box(p.x - 0.13, 0.35 + bob, p.z, 0.22, 0.7, 0.24, yaw, COL.playerPants);
    renderer.box(p.x + 0.13, 0.35 + bob, p.z, 0.22, 0.7, 0.24, yaw, COL.playerPants);
    renderer.box(p.x, 1.02 + bob, p.z, 0.6, 0.66, 0.32, yaw, p.shirt);
    renderer.box(p.x - 0.4, 1.02 + bob + swing * 0.4, p.z, 0.18, 0.55, 0.2, yaw, p.shirt);
    renderer.box(p.x + 0.4, 1.02 + bob - swing * 0.4, p.z, 0.18, 0.55, 0.2, yaw, p.shirt);
    renderer.box(p.x, 1.58 + bob, p.z, 0.48, 0.44, 0.44, yaw, COL.playerSkin);
    if (p.state === 'passenger') {
      // yellow marker above a waiting passenger
      renderer.box(p.x, 2.5 + Math.sin(game.time * 3) * 0.15, p.z, 0.5, 0.5, 0.5, 0, COL.marker, COL.marker);
    }
  }
}
