// Solmar Bay — wanted level + police. GTA-style crime table:
// every crime in the game calls commitCrime(type), which sets the
// wanted stars. Cops chase in cars and on foot; wanted decays when
// the player is out of sight for 14 seconds. Busted = hospital
// respawn + 20% cash fine.
//
// REQUIRED (round-4 play-test): ONLY the player's own crimes raise
// wanted. Idling, gang hostility, explosions the player did not
// cause and traffic collisions never call commitCrime.

import { TUNE, CRIME, clamp, angleLerp, dist2 } from './config.js';
import { showToast } from './state.js';
import { collideCircle } from './world.js';
import { spawnVehicle } from './vehicles.js';
import { showMenu } from './hud.js';

export function createPolice() {
  const police = {
    copCars: [],
    footCops: [],
    copKills: 0,
    explosionKills: 0,
    decayT: 0,
    spawnT: 0,
    busted: false,
    heli: null, // police helicopter (4-5 stars): { x, z, y, heading, rotor }
    roadblock: null, // { cars: [veh...], x, z } at 3+ stars
  };
  police.commitCrime = (game, type) => commitCrime(game, type);
  return police;
}

// Cop-car unit names for the HUD police list (original names).
const UNIT_NAMES = ['OSPREY', 'KESTREL', 'FALCON', 'HAWK'];

// Set the wanted level for a crime. Escalates for cop kills and
// multiple explosion kills; caps at 5 stars.
export function commitCrime(game, type) {
  const state = game.state;
  const police = game.police;
  const entry = CRIME[type];
  if (!entry) return;
  let stars = entry.stars;
  if (type === 'killCop') {
    police.copKills += 1;
    if (police.copKills >= 3) stars = Math.max(stars, 4);
    if (police.copKills >= 6) stars = 5;
  }
  if (type === 'explosion') {
    police.explosionKills += 1;
    if (police.explosionKills >= 2) stars = Math.max(stars, 4);
  }
  if (stars > state.wanted) state.wanted = stars;
  state.wanted = Math.min(5, state.wanted);
  police.decayT = 0;
  if (game.hud) game.hud.flashWanted();
}

export function updatePolice(game, dt) {
  const state = game.state;
  const police = game.police;
  const player = game.player;
  if (state.wanted <= 0) {
    police.decayT = 0;
    // clear cops when the heat is gone
    if (police.copCars.length || police.footCops.length) {
      police.copCars = [];
      police.footCops = [];
    }
    if (police.heli) police.heli = null;
    if (police.roadblock) {
      removeRoadblock(game);
      police.roadblock = null;
    }
    return;
  }

  // wanted decays after hiding out of sight (no cop within 60 units)
  // — the helicopter counts too, but only while it can actually see
  // you: a tall building between it and you breaks the sightline
  // ("break line of sight"), so the heat can still be lost at 4-5 stars
  let nearestCop = Infinity;
  for (const c of police.copCars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
  for (const c of police.footCops) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
  if (police.heli && heliSeesPlayer(game)) nearestCop = Math.min(nearestCop, Math.hypot(police.heli.x - player.x, police.heli.z - player.z));
  if (nearestCop > TUNE.copSightRange) {
    police.decayT += dt;
    if (police.decayT >= TUNE.wantedDecayTime) {
      police.decayT = 0;
      state.wanted -= 1;
      if (state.wanted <= 0) {
        state.wanted = 0;
        police.copCars = [];
        police.footCops = [];
      }
    }
  } else {
    police.decayT = 0;
  }

  // spawn cop cars: one per star, up to 4
  const wantCars = Math.min(4, state.wanted);
  police.spawnT -= dt;
  if (police.copCars.length < wantCars && police.spawnT <= 0) {
    police.spawnT = 2;
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.sin(angle) * 60;
    const z = player.z + Math.cos(angle) * 60;
    const car = spawnVehicle(game.vehicles, 'police', clamp(x, -380, 380), clamp(z, -380, 380), angle, [0.1, 0.15, 0.25]);
    car.driver = 'cop';
    car.unitName = UNIT_NAMES[police.copCars.length % UNIT_NAMES.length] + '-' + (police.copCars.length + 1);
    police.copCars.push(car);
    if (game.audio) game.audio.play('siren');
  }
  // foot cops: one per star, up to 4, only when wanted >= 2
  const wantCops = state.wanted >= 2 ? Math.min(4, state.wanted) : 0;
  if (police.footCops.length < wantCops && police.spawnT <= 0) {
    police.spawnT = 2;
    const angle = Math.random() * Math.PI * 2;
    police.footCops.push({
      x: player.x + Math.sin(angle) * 25,
      z: player.z + Math.cos(angle) * 25,
      heading: angle,
      speed: 7,
    });
  }

  // cop cars chase the player
  const wantSpeed = 14 + state.wanted * 3;
  for (const car of police.copCars) {
    const desired = Math.atan2(player.x - car.x, player.z - car.z);
    car.heading = angleLerp(car.heading, desired, 1 - Math.pow(0.001, dt));
    car.speed = Math.min(wantSpeed, car.speed + 12 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 2.2);
    car.x = fixed.x;
    car.z = fixed.z;
    // ram: if the cop car touches the player, damage + bust check
    if (dist2(car.x, car.z, player.x, player.z) < 9) {
      if (game.combat) game.combat.damagePlayer(game, 12 * dt);
      if (player.inVehicle && Math.hypot(car.speed - (player.inVehicle.speed || 0)) > 8) {
        // boxed in while slow: busted
        if (Math.abs(player.speed) < 2 && state.wanted >= 3) {
          bustPlayer(game, 'boxed in by the police');
        }
      }
    }
  }

  // foot cops chase and baton the player
  for (const cop of police.footCops) {
    const d = Math.hypot(player.x - cop.x, player.z - cop.z);
    const desired = Math.atan2(player.x - cop.x, player.z - cop.z);
    cop.heading = angleLerp(cop.heading, desired, 1 - Math.pow(0.001, dt));
    const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 0.6);
    cop.x = fixed.x;
    cop.z = fixed.z;
    if (d < 2.2 && !player.inVehicle) {
      if (game.combat) game.combat.damagePlayer(game, 18 * dt);
      // caught on foot at close range: busted (death by beating is
      // handled by damagePlayer, which shows WASTED)
      if (state.health <= 0) bustPlayer(game, 'beaten by the police', 'wasted');
      else if (d < 1.6) bustPlayer(game, 'caught by the police');
    }
  }

  // police helicopter at 4-5 stars: circles above the player with a
  // spotlight. It sees you from the sky, so the wanted level only
  // decays once it is gone (wanted 0 clears it above).
  if (state.wanted >= 4 && !police.heli) {
    police.heli = {
      x: player.x + 40,
      z: player.z - 40,
      y: 80, // above every building (the tallest tower is 72)
      heading: 0,
      rotor: 0,
      name: 'AIR-1',
    };
    showToast(game.state, 'Police helicopter overhead! Break line of sight to lose it.', 4);
    if (game.audio) game.audio.play('siren');
  }
  if (police.heli) {
    const h = police.heli;
    h.rotor += dt * 18;
    const desired = Math.atan2(player.x - h.x, player.z - h.z);
    h.heading = angleLerp(h.heading, desired, 1 - Math.pow(0.001, dt));
    const speed = 22;
    h.x += Math.sin(h.heading) * speed * dt;
    h.z += Math.cos(h.heading) * speed * dt;
    if (state.wanted < 4) police.heli = null; // breaks off as the heat drops
  }

  // roadblock at 3+ stars: three parked cop cars across the road
  // ahead of the player. Ramming one at speed wrecks your car.
  if (state.wanted >= 3 && !police.roadblock) {
    police.roadblock = spawnRoadblock(game);
  }
  if (police.roadblock && state.wanted < 3) {
    removeRoadblock(game);
    police.roadblock = null;
  }
  if (police.roadblock) {
    const rb = police.roadblock;
    const veh = player.inVehicle;
    if (veh) {
      for (const c of rb.cars) {
        if (dist2(c.x, c.z, player.x, player.z) < 25) {
          veh.speed *= 0.5;
          veh.damage = Math.min(100, (veh.damage || 0) + 15);
          if (veh.damage >= 100) veh.wrecked = true;
          if (game.audio) game.audio.play('punch');
          break;
        }
      }
    }
  }
}

// Place a roadblock on the next road intersection ahead of the
// player: three cop cars parked across the road.
function spawnRoadblock(game) {
  const p = game.player;
  const aheadX = p.x + Math.sin(p.heading) * 80;
  const aheadZ = p.z + Math.cos(p.heading) * 80;
  // snap to the nearest road intersection (grid lines every 100)
  const gx = Math.round(aheadX / 100) * 100;
  const gz = Math.round(aheadZ / 100) * 100;
  const across = p.heading + Math.PI / 2;
  const cars = [];
  for (let i = -1; i <= 1; i++) {
    const x = gx + Math.sin(across) * i * 5;
    const z = gz + Math.cos(across) * i * 5;
    const car = spawnVehicle(game.vehicles, 'police', clamp(x, -380, 380), clamp(z, -380, 380), p.heading, [0.1, 0.15, 0.25]);
    car.driver = 'roadblock';
    car.unitName = 'ROADBLOCK';
    cars.push(car);
  }
  return { cars, x: gx, z: gz };
}

function removeRoadblock(game) {
  const rb = game.police.roadblock;
  if (!rb) return;
  for (const c of rb.cars) {
    const i = game.vehicles.list.indexOf(c);
    if (i >= 0) game.vehicles.list.splice(i, 1);
    game.vehicles.byId.delete(c.id);
  }
}

// HUD police list: named units with distance + status, in the
// top-4 leaders' style. Empty when there is no heat.
export function policeListData(game) {
  const out = [];
  const p = game.player;
  if (!game.police || game.state.wanted <= 0) return out;
  for (const c of game.police.copCars) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    out.push({ name: c.unitName || 'CRUISER', dist: Math.round(d), status: d < 12 ? 'RAMMING' : d < 45 ? 'PURSUIT' : 'RESPONDING' });
  }
  game.police.footCops.forEach((c, i) => {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    out.push({ name: 'OFFICER-' + (i + 1), dist: Math.round(d), status: d < 6 ? 'CLOSING IN' : 'PURSUIT' });
  });
  if (game.police.heli) {
    const h = game.police.heli;
    out.push({ name: 'AIR-1', dist: Math.round(Math.hypot(h.x - p.x, h.z - p.z)), status: heliSeesPlayer(game) ? 'SPOTLIGHT' : 'SEARCHING' });
  }
  if (game.police.roadblock) {
    const rb = game.police.roadblock;
    out.push({ name: 'ROADBLOCK', dist: Math.round(Math.hypot(rb.x - p.x, rb.z - p.z)), status: 'ROADBLOCK' });
  }
  return out;
}

// Does the helicopter currently have line of sight on the player?
// Range 80 units, and a tall building (30+) near the midpoint of
// the sightline breaks it — hide behind a tower to lose the heli.
export function heliSeesPlayer(game) {
  const h = game.police && game.police.heli;
  if (!h) return false;
  const p = game.player;
  const d = Math.hypot(h.x - p.x, h.z - p.z);
  if (d > 80) return false;
  const mx = (h.x + p.x) / 2;
  const mz = (h.z + p.z) / 2;
  for (const b of game.city.buildings) {
    if (b.h < 30) continue;
    const cx = Math.max(b.x - b.sx / 2, Math.min(mx, b.x + b.sx / 2));
    const cz = Math.max(b.z - b.sz / 2, Math.min(mz, b.z + b.sz / 2));
    if (Math.hypot(mx - cx, mz - cz) < 8) return false;
  }
  return true;
}

// Voxel boxes for the police helicopter: body, tail, rotor (spins),
// searchlight cone + the bright pool it throws on the ground.
export function heliBoxes(game) {
  const h = game.police && game.police.heli;
  if (!h) return [];
  const boxes = [];
  const y = h.y;
  boxes.push({ x: h.x, y: y + 1.2, z: h.z, sx: 3.4, sy: 2.2, sz: 6, c: [0.1, 0.15, 0.25] });
  boxes.push({ x: h.x, y: y + 1.6, z: h.z - 4.5, sx: 1.2, sy: 1.0, sz: 5, c: [0.1, 0.15, 0.25] });
  boxes.push({ x: h.x, y: y + 2.6, z: h.z, sx: 1.0, sy: 0.5, sz: 1.0, c: [0.9, 0.1, 0.1] });
  // rotor: two blades, spinning (angle from h.rotor)
  const ra = h.rotor;
  const rx = Math.sin(ra) * 5;
  const rz = Math.cos(ra) * 5;
  boxes.push({ x: h.x + rx, y: y + 2.6, z: h.z + rz, sx: 0.5, sy: 0.15, sz: 1.2, c: [0.2, 0.2, 0.22] });
  boxes.push({ x: h.x - rx, y: y + 2.6, z: h.z - rz, sx: 0.5, sy: 0.15, sz: 1.2, c: [0.2, 0.2, 0.22] });
  // searchlight: a translucent cone down to the player + a bright pool
  const midY = y / 2;
  boxes.push({ x: (h.x + game.player.x) / 2, y: midY, z: (h.z + game.player.z) / 2, sx: 3, sy: y, sz: 3, c: [1, 0.95, 0.7], a: 0.12 });
  boxes.push({ x: game.player.x, y: 0.15, z: game.player.z, sx: 8, sy: 0.2, sz: 8, c: [1, 0.95, 0.7], a: 0.25 });
  return boxes;
}

// Busted: respawn at the hospital (on the street outside it — see
// world.js spawns.hospital), lose 20% of cash, heat cleared.
// `kind` is 'busted' (arrested) or 'wasted' (killed): the screen
// says which, with a clear "press Enter to respawn" prompt. The
// play-test saw NO screen at all — the game just froze and E/Escape
// looked dead until Enter was pressed.
export function bustPlayer(game, reason, kind) {
  const state = game.state;
  const player = game.player;
  if (state.mode === 'busted') return;
  state.mode = 'busted';
  const fine = Math.floor(state.cash * TUNE.bustedFine);
  state.cash -= fine;
  state.wanted = 0;
  game.police.copCars = [];
  game.police.footCops = [];
  game.police.copKills = 0;
  if (game.police.heli) game.police.heli = null;
  if (game.police.roadblock) game.police.roadblock = null;
  if (game.audio) game.audio.play('busted');
  state.bustedReason = reason || 'Busted by the police';
  state.bustedFine = fine;
  state.deathKind = kind === 'wasted' ? 'wasted' : 'busted';
  const title = state.deathKind === 'wasted' ? 'WASTED' : 'BUSTED';
  const body = state.bustedReason +
    (fine > 0 ? '<br>Fine: -$' + fine + ' (20% of your cash).' : '<br>No fine this time.') +
    '<br>Health and wanted are cleared.';
  showMenu(game.hud, title, body, 'Press Enter to respawn at the hospital.');
  void player;
}

// Respawn after the busted screen: hospital street, health restored.
export function respawnAfterBusted(game) {
  const state = game.state;
  const player = game.player;
  state.mode = 'playing';
  state.health = 100;
  state.armour = 0;
  state.wanted = 0;
  const h = game.city.spawns.hospital;
  player.x = h.x;
  player.z = h.z;
  player.y = 0;
  player.inVehicle = null;
  player.onTrain = false;
  player.onElevator = false;
  player.parachute = false;
  player.falling = 0;
  player.speed = 0;
  player.vx = 0;
  player.vz = 0;
  if (game.camera && game.camera.snap) {
    // snapCamera is imported by main.js; keep the camera sane here
    game.camera.snap = true;
  }
  if (game.audio) game.audio.play('respawn');
}
