// The HUD and the minimap, drawn on the same canvas as the game.
// All the numbers a player needs: cash, health, armour, wanted stars,
// the current objective, speed, and where the mission marker is.
import { COLORS, FONT, TUNING, VIEW_H, VIEW_W, clamp } from './config.js';
import { currentObjective, missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function drawHud(ctx, state) {
  const player = state.player;
  // Top-left: cash, health, armour.
  panel(ctx, 14, 14, 250, 84);
  text(ctx, `$${state.cash}`, 28, 46, 28, COLORS.gold, 'left', true);
  text(ctx, 'HEALTH', 28, 68, 12, COLORS.hudText, 'left', true);
  bar(ctx, 92, 58, 150, 12, player.health / TUNING.maxHealth, player.health > 30 ? COLORS.green : COLORS.red);
  if (player.armor > 0) {
    text(ctx, 'ARMOUR', 28, 88, 12, COLORS.hudText, 'left', true);
    bar(ctx, 92, 78, 150, 10, player.armor / TUNING.maxArmor, COLORS.blue);
  }

  // Top-right: wanted stars.
  panel(ctx, VIEW_W - 214, 14, 200, 44);
  text(ctx, 'WANTED', VIEW_W - 200, 42, 14, COLORS.hudText, 'left', true);
  for (let i = 0; i < TUNING.maxWanted; i += 1) {
    text(ctx, i < state.wanted ? '★' : '☆', VIEW_W - 128 + i * 22, 44, 22, i < state.wanted ? COLORS.gold : '#8a8a8a', 'left', true);
  }

  // Minimap, under the stars.
  drawMinimap(ctx, state, VIEW_W - 214, 66, 200, 150);

  // Bottom-left: the current objective.
  const objective = currentObjective(state);
  if (objective) {
    const w = Math.min(560, ctx.measureText(objective).width + 28);
    panel(ctx, 14, VIEW_H - 58, Math.max(320, w), 44);
    text(ctx, objective, 28, VIEW_H - 30, 16, COLORS.hudText, 'left', true);
  }

  // Bottom-right: speed, only while driving.
  if (!player.onFoot && player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.24);
    panel(ctx, VIEW_W - 134, VIEW_H - 58, 120, 44);
    text(ctx, `${kmh}`, VIEW_W - 84, VIEW_H - 26, 26, COLORS.hudText, 'center', true);
    text(ctx, 'km/h', VIEW_W - 30, VIEW_H - 26, 12, COLORS.hudText, 'center');
  }

  // Controls hint, small and out of the way.
  text(ctx, 'WASD move/drive · E enter car · F punch · P pause · M mute', VIEW_W / 2, VIEW_H - 12, 13, 'rgba(242,240,232,0.75)', 'center');

  // A banner across the top-centre for mission results and busts.
  // Mission banners live on the mission state; bust/wreck banners on the game state.
  const bannerText = state.bannerT > 0 ? state.banner
    : state.mission.bannerT > 0 ? state.mission.banner : '';
  if (bannerText) {
    const b = bannerText;
    ctx.font = `700 22px ${FONT}`;
    const w = ctx.measureText(b).width + 36;
    panel(ctx, (VIEW_W - w) / 2, 70, w, 44);
    text(ctx, b, VIEW_W / 2, 100, 22, COLORS.gold, 'center', true);
  }
  if (state.mission.introT > 0 && state.mission.intro) {
    const lines = wrapText(ctx, state.mission.intro, 26, 640);
    const h = 30 + lines.length * 30;
    panel(ctx, (VIEW_W - 680) / 2, 130, 680, h);
    lines.forEach((line, i) => text(ctx, line, VIEW_W / 2, 162 + i * 30, 20, COLORS.hudText, 'center'));
  }
}

function wrapText(ctx, value, size, maxWidth) {
  ctx.font = `20px ${FONT}`;
  const lines = [];
  let current = '';
  for (const word of value.split(' ')) {
    const trial = (current + ' ' + word).trim();
    if (ctx.measureText(trial).width <= maxWidth) current = trial;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// A small map of the whole city: roads, water, the player, police,
// other cars, and the pulsing mission marker.
export function drawMinimap(ctx, state, x, y, w, h) {
  const world = state.world;
  const sx = w / world.w;
  const sy = h / world.h;
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#5a7a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x, y, (90 * sx), h);
  ctx.strokeStyle = '#2c2f36';
  ctx.lineWidth = 3;
  for (const cx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
    ctx.beginPath();
    ctx.moveTo(x + cx * sx, y);
    ctx.lineTo(x + cx * sx, y + h);
    ctx.stroke();
  }
  for (const cy of [200, 600, 1000, 1400, 1800, 2200]) {
    ctx.beginPath();
    ctx.moveTo(x, y + cy * sy);
    ctx.lineTo(x + w, y + cy * sy);
    ctx.stroke();
  }
  // Other cars as grey dots, police as red ones.
  for (const car of state.cars) {
    ctx.fillStyle = car.kind === 'police' ? COLORS.red : '#d8d8d8';
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  // The mission marker pulses.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 5 + Math.sin(state.time * 5) * 2;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white triangle pointing where they face.
  const p = state.player;
  const px = x + (p.car ? p.car.x : p.x) * sx;
  const py = y + (p.car ? p.car.y : p.y) * sy;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(p.angle) * 7, py + Math.sin(p.angle) * 7);
  ctx.lineTo(px + Math.cos(p.angle + 2.5) * 5, py + Math.sin(p.angle + 2.5) * 5);
  ctx.lineTo(px + Math.cos(p.angle - 2.5) * 5, py + Math.sin(p.angle - 2.5) * 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPanel(ctx, title, lines, prompt) {
  const w = 640;
  const h = 170 + lines.length * 32;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  panel(ctx, x, y, w, h);
  text(ctx, title, VIEW_W / 2, y + 64, 44, COLORS.gold, 'center', true);
  lines.forEach((line, i) => text(ctx, line, VIEW_W / 2, y + 108 + i * 32, 20, COLORS.hudText, 'center'));
  text(ctx, prompt, VIEW_W / 2, y + h - 30, 20, COLORS.gold, 'center', true);
}

export function drawTitle(ctx, hasSave, cash) {
  drawPanel(ctx, 'SOLMAR BAY', [
    'An open-world crime game in the spirit of GTA 6.',
    'Steal cars. Lose the cops. Run five missions for Vic and Mara.',
    'A city of your own — no names, cars or music from any other game.',
    hasSave ? `Save found: $${cash} in the bank.` : '',
  ].filter(Boolean), hasSave ? 'Enter — continue · N — new game' : 'Press Enter to start');
}

export function drawPaused(ctx) {
  drawPanel(ctx, 'PAUSED', ['The bay will wait for you.'], 'P or Esc — resume · M — mute');
}

export function drawBusted(ctx, fine) {
  drawPanel(ctx, 'BUSTED', [
    'The Solmar Bay police caught up with you.',
    fine > 0 ? `Fine paid: $${fine}.` : 'No fine this time — you were broke.',
    'You wake up at the hospital, patched up and free.',
  ], 'Press Enter to get back out there');
}
