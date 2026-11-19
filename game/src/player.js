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
    fishing: false,
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
  player.fishing = false;
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
  if (p.inVehicle || p.onTrain || p.onElevator || p.fishing) return;

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
  const y = p.y + bobY;
  // graphics pass: the body faces the player's heading (every box
  // carries yaw), the legs/arms swing with sin(bob) like a walk
  // cycle, and the lean runs along the body's right axis. A blob
  // shadow grounds the player.
  const yaw = p.heading;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const lean = p.lean * 0.25;
  const at = (dx, dz) => ({ x: p.x + (dx + lean) * c + dz * s, z: p.z - (dx + lean) * s + dz * c });
  const put = (boxes, dx, yy, dz, sx, sy, sz, col) => {
    const q = at(dx, dz);
    boxes.push({ x: q.x, y: yy, z: q.z, sx, sy, sz, c: col, yaw });
  };
  const boxes = [];
  const swing = Math.sin(p.bob) * 0.3 * Math.min(1, p.speed / 6);
  // legs + shoes (opposite phases, swinging along the facing direction)
  put(boxes, -0.28, y + 0.45, swing, 0.5, 0.9, 0.5, pants);
  put(boxes, 0.28, y + 0.45, -swing, 0.5, 0.9, 0.5, pants);
  put(boxes, -0.28, y + 0.08, swing, 0.55, 0.16, 0.7, shoes);
  put(boxes, 0.28, y + 0.08, -swing, 0.55, 0.16, 0.7, shoes);
  // torso
  put(boxes, 0, y + 1.35, 0, 1.1, 0.9, 0.6, shirt);
  // arms (opposite to the legs)
  put(boxes, -0.75, y + 1.35, -swing * 0.8, 0.4, 0.85, 0.45, shirt);
  put(boxes, 0.75, y + 1.35, swing * 0.8, 0.4, 0.85, 0.45, shirt);
  // head + hair
  put(boxes, 0, y + 2.05, 0, 0.7, 0.65, 0.65, skin);
  put(boxes, 0, y + 2.4, 0, 0.74, 0.25, 0.7, hair);
  // carried cat rides on the shoulder
  if (p.carryingCat) {
    put(boxes, 0.6, y + 1.9, 0, 0.4, 0.35, 0.5, p.carryingCat.colour);
  }
  // parachute canopy
  if (p.parachute) {
    put(boxes, 0, y + 3.6, 0, 3.4, 0.25, 2.2, [0.95, 0.3, 0.3]);
  }
  // blob shadow (only on the ground, not while flying/falling)
  if (!p.parachute && (p.y || 0) < 1) {
    boxes.push({ x: p.x, y: 0.06, z: p.z, sx: 1.4, sy: 0.05, sz: 1.4, c: [0, 0, 0], yaw, a: 0.22 });
  }
  return boxes;
}
