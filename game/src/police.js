// Solmar Bay — wanted level + police. Cop cars chase and ram; foot
// cops chase on foot and grab the player. Wanted decays when no cop
// can see the player. Busted = hospital + a fine.

import { WANTED, COL } from './config.js';
import { resolveCollision, pointInBuilding } from './world.js';
import { damageVehicle } from './vehicles.js';

// Line of sight: sample the segment every 4 units; a building in the
// way blocks sight. This is what lets the player hide to lose heat.
export function hasLineOfSight(x1, z1, x2, z2, buildings) {
  const dx = x2 - x1, dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(x1 + dx * t, z1 + dz * t, buildings)) return false;
  }
  return true;
}

export function createPolice() {
  return {
    cops: [],        // on-foot cops {x,z,heading,punchCd,grabT}
    spawnT: 0,
    seenT: 0,
  };
}

function spawnCopCar(game) {
  const city = game.city;
  const p = game.player;
  // pick a road node 70-110 units away from the player
  const candidates = city.nodes.filter((n) => {
    const d = Math.hypot(n.x - p.x, n.z - p.z);
    return d > 60 && d < 130;
  });
  const pool = candidates.length ? candidates : city.nodes;
  const n = pool[Math.floor(Math.random() * pool.length)];
  const car = {
    id: 1000 + Math.floor(Math.random() * 9000),
    kind: 'car', x: n.x, y: 0, z: n.z,
    heading: Math.atan2(p.x - n.x, p.z - n.z),
    speed: 0, color: COL.policeCar, health: 100,
    driver: 'cop', traffic: null, throttle: 0, pitch: 0,
    airborne: false, wrecked: false, smokeT: 0, police: true,
  };
  game.vehicles.list.push(car);
  return car;
}

function spawnFootCop(game, x, z) {
  game.police.cops.push({
    x, z, heading: 0, punchCd: 0, grabT: 0, walkPhase: 0,
  });
}

export function getBusted(game, reason) {
  const state = game.state;
  const fine = Math.round(state.cash * WANTED.bustFine);
  state.cash -= fine;
  state.bustedReason = reason + ' — fined $' + fine;
  state.mode = 'busted';
  state.wanted = 0;
  state.health = 100;
  state.armor = 0;
  // respawn at the hospital, on foot
  const p = game.player;
  if (p.inVehicle) { p.inVehicle.driver = null; p.inVehicle = null; }
  p.x = game.city.spawns.hospital.x;
  p.z = game.city.spawns.hospital.z;
  p.y = 0; p.falling = false; p.parachute = false;
  p.speed = 0;
  // clear the heat
  game.vehicles.list = game.vehicles.list.filter((v) => !v.police);
  game.police.cops = [];
  game.audio.sirenStop();
}

export function updatePolice(dt, game) {
  const state = game.state;
  const p = game.player;
  if (state.wanted <= 0) {
    // mop up leftover cops once the heat is gone
    if (game.police.cops.length) game.police.cops = [];
    return;
  }
  const city = game.city;

  // ---- visibility: a cop sees the player if close AND with line of sight ----
  let seen = false;
  for (const v of game.vehicles.list) {
    if (v.police && v.driver === 'cop' && Math.hypot(v.x - p.x, v.z - p.z) < 55
      && hasLineOfSight(v.x, v.z, p.x, p.z, city.buildings)) { seen = true; break; }
  }
  if (!seen) {
    for (const c of game.police.cops) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 45
        && hasLineOfSight(c.x, c.z, p.x, p.z, city.buildings)) { seen = true; break; }
    }
  }
  if (seen) state.wantedTimer = 0;
  else {
    state.wantedTimer += dt;
    if (state.wantedTimer > WANTED.decayTime) {
      state.wanted--;
      state.wantedTimer = 0;
      game.toast(state.wanted > 0 ? 'Wanted level down.' : 'You lost the cops.');
      if (state.wanted === 0) {
        game.vehicles.list = game.vehicles.list.filter((v) => !v.police);
        game.police.cops = [];
        game.audio.sirenStop();
        return;
      }
    }
  }

  // ---- spawn cop cars to match the wanted level ----
  const wantCars = WANTED.copCars[state.wanted] || 0;
  const haveCars = game.vehicles.list.filter((v) => v.police && v.driver === 'cop' && !v.wrecked).length;
  game.police.spawnT -= dt;
  if (haveCars < wantCars && game.police.spawnT <= 0) {
    spawnCopCar(game);
    game.police.spawnT = 2.5;
  }

  // ---- cop car chase ----
  for (const v of game.vehicles.list) {
    if (!v.police || v.driver !== 'cop' || v.wrecked) continue;
    const dx = p.x - v.x, dz = p.z - v.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let d = (wantHeading - v.heading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    v.heading += d * Math.min(1, dt * 2.5);
    // on foot and close: pull up and send foot cops instead of ramming
    let targetSpeed = dist > 6 ? 30 + state.wanted * 2 : 12;
    if (!p.inVehicle && dist < 12) targetSpeed = 0;
    v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 1.5);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    const fixed = resolveCollision(v.x, v.z, 1.6, city.buildings);
    const hitWall = (fixed.x !== v.x || fixed.z !== v.z);
    v.x = fixed.x; v.z = fixed.z;
    if (hitWall && Math.abs(v.speed) > 10) {
      damageVehicle(game, v, 12, 'wall');
      v.speed *= 0.4;
    }
    // ram the player's car (with a cooldown so it isn't per-frame)
    const pv = p.inVehicle;
    if (pv && dist < 3.4) {
      if (!v.ramCd || v.ramCd <= 0) {
        damageVehicle(game, pv, 6, 'ram');
        damageVehicle(game, v, 2, 'ram');
        v.ramCd = 0.9;
        game.audio.thud();
      }
      v.speed *= (1 - 2 * dt);
    }
    if (v.ramCd > 0) v.ramCd -= dt;
    // player on foot and close: a foot cop gets out
    if (!pv && dist < 7 && game.police.cops.length < (WANTED.footCops[state.wanted] || 0)) {
      spawnFootCop(game, v.x + 2, v.z + 2);
    }
  }

  // ---- foot cops ----
  for (let i = game.police.cops.length - 1; i >= 0; i--) {
    const c = game.police.cops[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    const dist = Math.hypot(dx, dz);
    if (!p.inVehicle && dist > 90) { game.police.cops.splice(i, 1); continue; }
    c.heading = Math.atan2(dx, dz);
    if (dist > 1.7) {
      const sp = p.inVehicle ? 6.5 : 7.6;
      c.x += Math.sin(c.heading) * sp * dt;
      c.z += Math.cos(c.heading) * sp * dt;
      const fixed = resolveCollision(c.x, c.z, 0.5, city.buildings);
      c.x = fixed.x; c.z = fixed.z;
      c.walkPhase += dt * 9;
      c.grabT = Math.max(0, c.grabT - dt);
    } else if (!p.inVehicle) {
      // grabbing the player
      c.grabT += dt;
      c.punchCd -= dt;
      if (c.punchCd <= 0) {
        c.punchCd = 0.8;
        game.hurtPlayer(8, 'cop');
        game.audio.thud();
      }
      if (c.grabT > 1.4) {
        getBusted(game, 'Busted by the police');
        return;
      }
    } else {
      // player in a car: the cop bangs on it
      c.punchCd -= dt;
      if (c.punchCd <= 0) {
        c.punchCd = 0.9;
        damageVehicle(game, p.inVehicle, 4, 'cop');
      }
    }
  }
}

export function drawPolice(renderer, game) {
  for (const c of game.police.cops) {
    const yaw = c.heading;
    const swing = Math.sin(c.walkPhase) * 0.25;
    renderer.box(c.x - 0.13, 0.35, c.z, 0.22, 0.7, 0.24, yaw, COL.copShirt);
    renderer.box(c.x + 0.13, 0.35, c.z, 0.22, 0.7, 0.24, yaw, COL.copShirt);
    renderer.box(c.x, 1.02, c.z, 0.6, 0.66, 0.32, yaw, COL.copShirt);
    renderer.box(c.x - 0.4, 1.02 + swing * 0.4, c.z, 0.18, 0.55, 0.2, yaw, COL.copShirt);
    renderer.box(c.x + 0.4, 1.02 - swing * 0.4, c.z, 0.18, 0.55, 0.2, yaw, COL.copShirt);
    renderer.box(c.x, 1.58, c.z, 0.48, 0.44, 0.44, yaw, COL.playerSkin);
    renderer.box(c.x, 1.84, c.z, 0.52, 0.14, 0.5, yaw, COL.copHat);
  }
}
