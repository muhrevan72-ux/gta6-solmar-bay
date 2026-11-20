// Solmar Bay — pedestrians (rebuild #14).
// 76 peds: 7 sit, 14 chat, 7 queue, 6 vendor, 42 walk. Walkers
// stroll between sidewalk points; sitters, chatters, queuers and
// vendors hold their spots. A ped that is attacked flees.

import { COL } from './config.js';
import { randomSidewalkPoint } from './world.js';
import { pushBox, pushBoxRot } from './render.js';
import { mulberry32 } from './state.js';

export function spawnPeds(g) {
  const rng = mulberry32(777);
  const peds = [];
  const acts = [
    ...Array(7).fill('sit'),
    ...Array(14).fill('chat'),
    ...Array(7).fill('queue'),
    ...Array(6).fill('vendor'),
    ...Array(42).fill('walk'),
  ];
  for (let i = 0; i < 76; i++) {
    const p = randomSidewalkPoint(rng);
    const activity = acts[i];
    const ped = {
      x: p.x, z: p.z,
      hp: 100,
      height: 1.7 + rng() * 0.3,
      bulk: 0.8 + rng() * 0.5,
      hairStyle: Math.floor(rng() * 5),
      hairCol: Math.floor(rng() * COL.hair.length),
      shirtCol: [0.3 + rng() * 0.6, 0.3 + rng() * 0.6, 0.3 + rng() * 0.6],
      pantsCol: [0.2 + rng() * 0.4, 0.2 + rng() * 0.4, 0.3 + rng() * 0.4],
      activity,
      heading: rng() * Math.PI * 2,
      speed: 0,
      target: null,
      fleeing: false,
      state: 'alive',
    };
    if (activity === 'walk') {
      const t = randomSidewalkPoint(rng);
      ped.target = { x: t.x, z: t.z };
      ped.speed = 1 + rng() * 0.8;
    }
    peds.push(ped);
  }
  g.peds = peds;
  return peds;
}

export function stepPed(g, ped, dt) {
  if (ped.hp <= 0) {
    ped.state = 'dead';
    return;
  }
  if (ped.fleeing) {
    // Run away from the player.
    const dx = ped.x - g.player.x;
    const dz = ped.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.x += (dx / d) * 5 * dt;
    ped.z += (dz / d) * 5 * dt;
    ped.heading = Math.atan2(dx / d, dz / d);
    if (d > 30) ped.fleeing = false;
    return;
  }
  if (ped.activity === 'walk' && ped.target) {
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      const t = randomSidewalkPoint(g.rng);
      ped.target = { x: t.x, z: t.z };
      return;
    }
    const sp = ped.speed || 1.2;
    ped.x += (dx / d) * sp * dt;
    ped.z += (dz / d) * sp * dt;
    ped.heading = Math.atan2(dx / d, dz / d);
  }
  // Sitters, chatters, queuers and vendors hold their spots.
}

export function stepPeds(g, dt) {
  if (!g.peds) return;
  for (const p of g.peds) stepPed(g, p, dt);
}

// A ped is 8 base boxes. Near the camera (< 40 m, or no camera)
// it also gets two eye boxes, so near peds read as people, not
// mannequins. Dead peds draw nothing.
export function pedBoxes(g, ped, b, camera) {
  if (!ped || ped.dead || ped.hp <= 0) return 0;
  const h = ped.height || 1.8;
  const bulk = ped.bulk || 1;
  const yaw = ped.heading || 0;
  const x = ped.x;
  const z = ped.z;
  const hairCol = COL.hair[ped.hairCol || 0] || COL.hair[0];
  const skin = [0.85, 0.65, 0.5];
  const legH = 0.85 * (h / 1.8);
  const torsoH = 0.6 * (h / 1.8);
  // Legs, shoes (one box), torso, arms, head, hair.
  pushBoxRot(b, x - 0.13 * bulk, 0, z, 0.24, legH, 0.24, yaw, ped.pantsCol);
  pushBoxRot(b, x + 0.13 * bulk, 0, z, 0.24, legH, 0.24, yaw, ped.pantsCol);
  pushBoxRot(b, x, 0, z + 0.05, 0.55, 0.13, 0.36, yaw, [0.2, 0.2, 0.22]);
  pushBoxRot(b, x, legH, z, 0.6 * bulk, torsoH, 0.32, yaw, ped.shirtCol);
  pushBoxRot(b, x - 0.4 * bulk, legH + 0.05, z, 0.18, torsoH * 0.9, 0.18, yaw, ped.shirtCol);
  pushBoxRot(b, x + 0.4 * bulk, legH + 0.05, z, 0.18, torsoH * 0.9, 0.18, yaw, ped.shirtCol);
  pushBoxRot(b, x, legH + torsoH, z, 0.4, 0.4, 0.4, yaw, skin);
  pushBoxRot(b, x, legH + torsoH + 0.36, z, 0.42, 0.14, 0.42, yaw, hairCol);
  // Eyes: near LOD only.
  let near = true;
  if (camera && camera.x !== undefined && camera.z !== undefined) {
    near = Math.hypot(camera.x - x, camera.z - z) < 40;
  }
  if (near) {
    const ey = legH + torsoH + 0.05;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    pushBoxRot(b, x - 0.09 + fwdX * 0.21, ey, z + fwdZ * 0.21, 0.06, 0.06, 0.05, yaw, [0.05, 0.05, 0.05]);
    pushBoxRot(b, x + 0.09 + fwdX * 0.21, ey, z + fwdZ * 0.21, 0.06, 0.06, 0.05, yaw, [0.05, 0.05, 0.05]);
  }
  return 8;
}
