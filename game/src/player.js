// Solmar Bay — the player on foot: eased WASD movement relative to
// the camera, running, swimming, parachute gliding, entering/exiting
// vehicles (E). Body lean + bob make movement feel smooth, not stiff.

import { TUNE, clamp, lerp, angleLerp } from './config.js';
import { collideCircle, inWater } from './world.js';

export function createPlayer(city) {
  const s = city.spawns.player;
  return {
    x: s.x,
    y: 0,
    z: s.z,
    heading: 0, // facing, radians (0 = -z... we use +z forward below)
    vx: 0,
    vz: 0,
    speed: 0,
    inVehicle: null, // vehicle object when driving/riding
    onTrain: false,
    onElevator: false,
    swimming: false,
    parachute: false,
    falling: 0,
    lean: 0, // body lean into turns (-1..1)
    bob: 0,
    eCooldown: 0,
    carryingCat: null,
    outfit: { hair: 0, shirt: 0, pants: 0, shoes: 0 },
  };
}

export function resetPlayer(player, city, keepOutfit) {
  const s = city.spawns.player;
  const outfit = player.outfit;
  player.x = s.x;
  player.y = 0;
  player.z = s.z;
  player.heading = 0;
  player.vx = 0;
  player.vz = 0;
  player.speed = 0;
  player.inVehicle = null;
  player.onTrain = false;
  player.onElevator = false;
  player.swimming = false;
  player.parachute = false;
  player.falling = 0;
  player.lean = 0;
  player.bob = 0;
  player.eCooldown = 0;
  player.carryingCat = null;
  if (keepOutfit) player.outfit = outfit;
}

// Move the player for one frame. `input` is the input object,
// `yaw` the camera yaw (movement is camera-relative).
export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  const city = game.city;
  if (p.inVehicle || p.onTrain || p.onElevator) return;

  p.eCooldown = Math.max(0, p.eCooldown - dt);

  // desired move direction, camera-relative
  let mx = 0;
  let mz = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const mag = Math.hypot(mx, mz);
  if (mag > 0) {
    mx /= mag;
    mz /= mag;
  }
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const swimming = inWater(p.x, p.z) && p.y <= 0.5;
  p.swimming = swimming;
  const maxSpeed = swimming ? TUNE.swimSpeed : run ? TUNE.runSpeed : TUNE.walkSpeed;

  // rotate the input vector by the camera yaw
  const sin = Math.sin(game.camera.yaw);
  const cos = Math.cos(game.camera.yaw);
  const wx = mx * cos - mz * sin;
  const wz = mx * sin + mz * cos;

  // eased acceleration / deceleration (never snaps)
  const accel = mag > 0 ? TUNE.accel : TUNE.friction;
  p.vx = approach(p.vx, wx * maxSpeed, accel * dt);
  p.vz = approach(p.vz, wz * maxSpeed, accel * dt);
  p.speed = Math.hypot(p.vx, p.vz);

  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  const fixed = collideCircle(city, nx, nz, TUNE.playerRadius);
  nx = fixed.x;
  nz = fixed.z;
  p.x = nx;
  p.z = nz;

  // face the movement direction, eased
  if (p.speed > 0.5) {
    const target = Math.atan2(p.vx, p.vz);
    const before = p.heading;
    p.heading = angleLerp(p.heading, target, 1 - Math.pow(0.00001, dt));
    // lean into the turn
    let dh = p.heading - before;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI;
    p.lean = clamp(lerp(p.lean, clamp(dh * 8, -1, 1), 0.2), -1, 1);
  } else {
    p.lean = lerp(p.lean, 0, 0.1);
  }
  p.bob += p.speed * dt * 1.6;

  // parachute glide
  if (p.parachute) {
    p.y = Math.max(0, p.y - 3.5 * dt);
    const px = Math.sin(p.heading) * 6 * dt;
    const pz = Math.cos(p.heading) * 6 * dt;
    const f2 = collideCircle(city, p.x + px, p.z + pz, TUNE.playerRadius);
    p.x = f2.x;
    p.z = f2.z;
    if (p.y <= 0) p.parachute = false;
  }
  // falling (after jumping out of a plane)
  if (p.falling > 0) {
    p.y -= 22 * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.falling = 0;
    }
  }
  // swim: stay at water level
  if (swimming) p.y = 0;
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

// Voxel boxes for the player figure (used by the renderer).
// Returns boxes in world space. Colours come from the outfit.
export function playerBoxes(game) {
  const p = game.player;
  const OUTFIT = game.configOutfit;
  const shirt = OUTFIT.shirt[p.outfit.shirt].colour;
  const pants = OUTFIT.pants[p.outfit.pants].colour;
  const shoes = OUTFIT.shoes[p.outfit.shoes].colour;
  const hair = OUTFIT.hair[p.outfit.hair].colour;
  const skin = [0.95, 0.75, 0.55];
  const bobY = Math.sin(p.bob) * 0.08 * Math.min(1, p.speed / 6);
  const leanX = p.lean * 0.25;
  const y = p.y + bobY;
  const boxes = [];
  // legs
  boxes.push({ x: p.x - 0.28 + leanX, y: y + 0.45, z: p.z, sx: 0.5, sy: 0.9, sz: 0.5, c: pants });
  boxes.push({ x: p.x + 0.28 + leanX, y: y + 0.45, z: p.z, sx: 0.5, sy: 0.9, sz: 0.5, c: pants });
  // shoes
  boxes.push({ x: p.x - 0.28 + leanX, y: y + 0.08, z: p.z, sx: 0.55, sy: 0.16, sz: 0.7, c: shoes });
  boxes.push({ x: p.x + 0.28 + leanX, y: y + 0.08, z: p.z, sx: 0.55, sy: 0.16, sz: 0.7, c: shoes });
  // torso
  boxes.push({ x: p.x + leanX, y: y + 1.35, z: p.z, sx: 1.1, sy: 0.9, sz: 0.6, c: shirt });
  // arms
  boxes.push({ x: p.x - 0.75 + leanX, y: y + 1.35, z: p.z, sx: 0.4, sy: 0.85, sz: 0.45, c: shirt });
  boxes.push({ x: p.x + 0.75 + leanX, y: y + 1.35, z: p.z, sx: 0.4, sy: 0.85, sz: 0.45, c: shirt });
  // head + hair
  boxes.push({ x: p.x + leanX, y: y + 2.05, z: p.z, sx: 0.7, sy: 0.65, sz: 0.65, c: skin });
  boxes.push({ x: p.x + leanX, y: y + 2.4, z: p.z, sx: 0.74, sy: 0.25, sz: 0.7, c: hair });
  // carried cat rides on the shoulder
  if (p.carryingCat) {
    boxes.push({ x: p.x + 0.6 + leanX, y: y + 1.9, z: p.z, sx: 0.4, sy: 0.35, sz: 0.5, c: p.carryingCat.colour });
  }
  // parachute canopy
  if (p.parachute) {
    boxes.push({ x: p.x, y: y + 3.6, z: p.z, sx: 3.4, sy: 0.25, sz: 2.2, c: [0.95, 0.3, 0.3] });
  }
  return boxes;
}
