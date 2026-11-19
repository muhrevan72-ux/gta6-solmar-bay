// Drawing only: the world state and the camera in, pixels out. The
// camera follows the player and stays inside the city; everything is
// flat vector shapes drawn on the canvas, so the game needs no assets.
import {
  COLORS, FONT, ROAD_W, ROAD_X, ROAD_Y, SAND_X, VIEW_H, VIEW_W,
  WATER_X, clamp,
} from './config.js';

export function createCamera() {
  return { x: VIEW_W / 2, y: VIEW_H / 2, shake: 0 };
}

export function updateCamera(camera, focusX, focusY, dt) {
  camera.x += (focusX - camera.x) * Math.min(1, 6 * dt);
  camera.y += (focusY - camera.y) * Math.min(1, 6 * dt);
  if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 2);
}

function shakeOffset(camera) {
  if (camera.shake <= 0) return { x: 0, y: 0 };
  const s = camera.shake * 8;
  return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
}

export function worldToScreen(camera, x, y) {
  const off = shakeOffset(camera);
  return {
    x: x - camera.x + VIEW_W / 2 + off.x,
    y: y - camera.y + VIEW_H / 2 + off.y,
  };
}

function onScreen(camera, x, y, margin) {
  return (
    x > camera.x - VIEW_W / 2 - margin && x < camera.x + VIEW_W / 2 + margin
    && y > camera.y - VIEW_H / 2 - margin && y < camera.y + VIEW_H / 2 + margin
  );
}

function drawGround(ctx, world, camera) {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Mow stripes, cheap and cheerful: alternating bands across the grass.
  ctx.fillStyle = COLORS.grassDark;
  const top = camera.y - VIEW_H / 2;
  const first = Math.floor(top / 120) * 120;
  for (let y = first; y < top + VIEW_H + 120; y += 240) {
    const s = worldToScreen(camera, 0, y);
    ctx.fillRect(0, s.y, VIEW_W, 120);
  }
  // Sand, then water, on the west edge.
  const sand = worldToScreen(camera, SAND_X, 0);
  const water = worldToScreen(camera, WATER_X, 0);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, 0, sand.x, VIEW_H);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(0, 0, water.x, VIEW_H);
  ctx.fillStyle = COLORS.waterDeep;
  for (let y = 0; y < VIEW_H; y += 46) {
    ctx.fillRect(0, ((y + Math.floor(camera.y / 3)) % 46), water.x, 3);
  }
}

function drawRoads(ctx, world, camera) {
  ctx.fillStyle = COLORS.road;
  for (const cx of ROAD_X) {
    const s = worldToScreen(camera, cx, 0);
    ctx.fillRect(s.x - ROAD_W / 2, 0, ROAD_W, VIEW_H);
  }
  for (const cy of ROAD_Y) {
    const s = worldToScreen(camera, 0, cy);
    ctx.fillRect(0, s.y - ROAD_W / 2, VIEW_W, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = COLORS.dash;
  for (const cx of ROAD_X) {
    const s = worldToScreen(camera, cx, 0);
    const top = camera.y - VIEW_H / 2;
    const first = Math.floor(top / 64) * 64;
    for (let y = first; y < top + VIEW_H + 64; y += 64) {
      const p = worldToScreen(camera, cx, y);
      ctx.fillRect(s.x - 2, p.y, 4, 30);
    }
  }
  for (const cy of ROAD_Y) {
    const s = worldToScreen(camera, 0, cy);
    const left = camera.x - VIEW_W / 2;
    const first = Math.floor(left / 64) * 64;
    for (let x = first; x < left + VIEW_W + 64; x += 64) {
      const p = worldToScreen(camera, x, cy);
      ctx.fillRect(p.x, s.y - 2, 30, 4);
    }
  }
  // Road edges.
  ctx.strokeStyle = COLORS.roadEdge;
  ctx.lineWidth = 3;
  for (const cx of ROAD_X) {
    const s = worldToScreen(camera, cx, 0);
    ctx.beginPath();
    ctx.moveTo(s.x - ROAD_W / 2, 0);
    ctx.lineTo(s.x - ROAD_W / 2, VIEW_H);
    ctx.moveTo(s.x + ROAD_W / 2, 0);
    ctx.lineTo(s.x + ROAD_W / 2, VIEW_H);
    ctx.stroke();
  }
  for (const cy of ROAD_Y) {
    const s = worldToScreen(camera, 0, cy);
    ctx.beginPath();
    ctx.moveTo(0, s.y - ROAD_W / 2);
    ctx.lineTo(VIEW_W, s.y - ROAD_W / 2);
    ctx.moveTo(0, s.y + ROAD_W / 2);
    ctx.lineTo(VIEW_W, s.y + ROAD_W / 2);
    ctx.stroke();
  }
}

function drawBlocks(ctx, world, camera) {
  for (const park of world.parks) {
    const s = worldToScreen(camera, park.x, park.y);
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(s.x, s.y, park.w, park.h);
  }
  for (const tree of world.trees) {
    if (!onScreen(camera, tree.x, tree.y, 40)) continue;
    const s = worldToScreen(camera, tree.x, tree.y);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(s.x - 2, s.y - 2, 4, 8);
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 6, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of world.buildings) {
    if (!onScreen(camera, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    const s = worldToScreen(camera, b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.x + 5, s.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(s.x, s.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, b.w, b.h);
    // Windows in a loose grid.
    ctx.fillStyle = 'rgba(255,255,220,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((c + r) % 2 === 0) continue;
        ctx.fillRect(s.x + 10 + c * 34, s.y + 10 + r * 34, 16, 12);
      }
    }
    if (b.label) {
      ctx.font = `700 34px ${FONT}`;
      ctx.fillStyle = b.kind === 'hospital' ? '#c23b2e' : 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, s.x + b.w / 2, s.y + b.h / 2);
    }
  }
}

function drawCarShape(ctx, x, y, angle, color, police, damaged) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.roundRect(-24, -11, 48, 24, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 7);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.fillRect(4, -8, 10, 16);
  ctx.fillRect(-16, -8, 7, 16);
  // Wheels.
  ctx.fillStyle = '#16181c';
  ctx.fillRect(-16, -14, 10, 5);
  ctx.fillRect(-16, 9, 10, 5);
  ctx.fillRect(8, -14, 10, 5);
  ctx.fillRect(8, 9, 10, 5);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(21, -8, 3, 5);
  ctx.fillRect(21, 3, 3, 5);
  if (police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -11, 12, 22);
    ctx.fillStyle = COLORS.policeDark;
    ctx.font = '700 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', 0, 0);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-2, -11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6fd2';
    ctx.beginPath();
    ctx.arc(4, -11, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (damaged) {
    ctx.strokeStyle = 'rgba(30,30,30,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-18, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPedShape(ctx, x, y, angle, shirt, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(-11, -6, 22, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(0) * 0, -1, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22262c';
    ctx.beginPath();
    ctx.arc(6, -4, 2, 0, Math.PI * 2);
    ctx.arc(6, 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayerShape(ctx, x, y, angle, punchT, walkPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(walkPhase * 0.09) * 1.5;
  ctx.rotate(angle);
  // Jacket, with a swinging arm when punching.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22262c';
  ctx.beginPath();
  ctx.arc(7, -5, 3, 0, Math.PI * 2);
  ctx.arc(7, 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(8, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  if (punchT > 0) {
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPickupShape(ctx, x, y, kind, bob) {
  const yy = y + Math.sin(bob) * 3;
  ctx.save();
  ctx.translate(x, yy);
  if (kind === 'health') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-3, -9, 6, 18);
    ctx.fillRect(-9, -3, 18, 6);
  } else if (kind === 'armor') {
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(11, -6);
    ctx.lineTo(11, 3);
    ctx.lineTo(0, 13);
    ctx.lineTo(-11, 3);
    ctx.lineTo(-11, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 0, 0);
  } else {
    ctx.strokeStyle = '#c2c2c2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.fillStyle = '#c2c2c2';
    ctx.beginPath();
    ctx.arc(9, -9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e1420';
    ctx.beginPath();
    ctx.arc(9, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The mission marker: a pulsing ring with a bouncing arrow above it.
function drawMarker(ctx, camera, marker, time) {
  const s = worldToScreen(camera, marker.x, marker.y);
  const pulse = 26 + Math.sin(time * 5) * 5;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
  ctx.fill();
  const by = s.y - pulse - 14 + Math.sin(time * 4) * 4;
  ctx.beginPath();
  ctx.moveTo(s.x, by + 12);
  ctx.lineTo(s.x - 8, by);
  ctx.lineTo(s.x + 8, by);
  ctx.closePath();
  ctx.fill();
}

export function drawScene(ctx, state, camera) {
  const world = state.world;
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawGround(ctx, world, camera);
  drawRoads(ctx, world, camera);
  drawBlocks(ctx, world, camera);

  for (const pickup of state.pickups) {
    if (pickup.respawnT > 0 || !onScreen(camera, pickup.x, pickup.y, 30)) continue;
    const s = worldToScreen(camera, pickup.x, pickup.y);
    drawPickupShape(ctx, s.x, s.y, pickup.kind, pickup.bob);
  }

  const marker = state.marker;
  if (marker && onScreen(camera, marker.x, marker.y, 80)) drawMarker(ctx, camera, marker, state.time);

  for (const ped of state.peds) {
    if (!onScreen(camera, ped.x, ped.y, 30)) continue;
    const s = worldToScreen(camera, ped.x, ped.y);
    drawPedShape(ctx, s.x, s.y, ped.angle, ped.shirt, ped.state === 'down');
  }
  for (const cop of state.cops) {
    if (!onScreen(camera, cop.x, cop.y, 30)) continue;
    const s = worldToScreen(camera, cop.x, cop.y);
    drawPedShape(ctx, s.x, s.y, cop.angle, COLORS.policeDark, cop.downT > 0);
  }
  for (const car of state.cars) {
    if (!onScreen(camera, car.x, car.y, 60)) continue;
    const s = worldToScreen(camera, car.x, car.y);
    drawCarShape(ctx, s.x, s.y, car.angle, car.color, car.kind === 'police', car.hp < 40);
    if (car.smokeT > 0) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(s.x - Math.cos(car.angle) * 18, s.y - Math.sin(car.angle) * 18, 8 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const player = state.player;
  if (player.onFoot) {
    const s = worldToScreen(camera, player.x, player.y);
    const blink = player.invulnT > 0 && Math.floor(player.invulnT * 10) % 2 === 0;
    if (!blink) drawPlayerShape(ctx, s.x, s.y, player.angle, player.punchT, player.walkPhase);
  }

  for (const p of state.particles) {
    const s = worldToScreen(camera, p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
