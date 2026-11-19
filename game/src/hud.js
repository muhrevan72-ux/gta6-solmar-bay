// Solmar Bay — HUD: DOM panels + 2D top-down minimap canvas.
// All DOM lookups happen once in createHud; update() runs every frame.

import { COL } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  return {
    cash: $('cash'),
    healthFill: $('health-fill'),
    armorFill: $('armor-fill'),
    stars: $('stars'),
    weapon: $('weapon'),
    ammo: $('ammo'),
    bombs: $('bombs'),
    speed: $('speed'),
    objective: $('objective'),
    chapter: $('chapter-label'),
    toast: $('toast'),
    crosshair: $('crosshair'),
    minimap: $('minimap'),
    overlays: {
      menu: $('menu-screen'),
      pause: $('pause-screen'),
      busted: $('busted-screen'),
      chapter: $('chapter-screen'),
      complete: $('complete-screen'),
    },
    chapterTitle: $('chapter-title'),
    chapterText: $('chapter-text'),
    bustedReason: $('busted-reason'),
    completeStats: $('complete-stats'),
    menuContinue: $('btn-continue'),
  };
}

const WEAPON_LABELS = { pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun' };

export function updateHud(hud, game) {
  const s = game.state;
  hud.cash.textContent = '$' + s.cash;
  hud.healthFill.style.width = Math.max(0, s.health) + '%';
  hud.armorFill.style.width = Math.max(0, s.armor) + '%';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
  hud.stars.textContent = stars;
  hud.stars.style.color = s.wanted > 0 ? '#ffd23a' : '#888';
  hud.weapon.textContent = WEAPON_LABELS[s.weapon] || s.weapon;
  const ammo = s.weapon === 'pistol' ? '∞' : (s.ammo[s.weapon] || 0);
  hud.ammo.textContent = ammo;
  hud.bombs.textContent = '💣 ' + s.bombs;
  const v = game.player.inVehicle;
  const spd = v ? Math.abs(v.speed) : game.player.speed;
  hud.speed.textContent = Math.round(spd * 3.6) + ' km/h';
  hud.objective.textContent = s.objective || '';
  hud.chapter.textContent = s.chapterActive
    ? 'Chapter ' + (game.missions.chapter + 1) + ' of 5'
    : (s.chapter >= 5 ? 'Free roam' : 'Chapter ' + (s.chapter + 1) + ' of 5');
  if (s.toastTimer > 0) {
    hud.toast.textContent = s.toast;
    hud.toast.style.opacity = Math.min(1, s.toastTimer) ;
  } else {
    hud.toast.style.opacity = 0;
  }
  hud.crosshair.style.display = (s.mode === 'playing') ? 'block' : 'none';
  drawMinimap(hud, game);
}

export function showOverlay(hud, name) {
  for (const key of Object.keys(hud.overlays)) {
    hud.overlays[key].style.display = key === name ? 'flex' : 'none';
  }
}

function drawMinimap(hud, game) {
  const ctx = hud.minimap.getContext('2d');
  const S = hud.minimap.width;
  const scale = S / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.clearRect(0, 0, S, S);
  // ground
  ctx.fillStyle = '#3f7a30';
  ctx.fillRect(0, 0, S, S);
  // water
  ctx.fillStyle = '#2f7fc9';
  for (const w of game.city.water) {
    ctx.fillRect(toX(w.x1), toZ(w.z1), (w.x2 - w.x1) * scale, (w.z2 - w.z1) * scale);
  }
  // roads
  ctx.strokeStyle = '#33363d';
  ctx.lineWidth = Math.max(1, 12 * scale);
  for (const r of game.city.roads) {
    ctx.beginPath();
    ctx.moveTo(toX(r.x1), toZ(r.z1));
    ctx.lineTo(toX(r.x2), toZ(r.z2));
    ctx.stroke();
  }
  // buildings
  ctx.fillStyle = '#7a7f88';
  for (const b of game.city.buildings) {
    ctx.fillRect(toX(b.x - b.w / 2), toZ(b.z - b.d / 2), b.w * scale, b.d * scale);
  }
  // mission marker
  const m = game.missions.marker;
  if (m) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(toX(m.x), toZ(m.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(toX(m.x), toZ(m.z), 8 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // police blips
  ctx.fillStyle = '#3a6aff';
  for (const v of game.vehicles.list) {
    if (v.police) {
      ctx.beginPath();
      ctx.arc(toX(v.x), toZ(v.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const c of game.police.cops) {
    ctx.fillStyle = '#3a6aff';
    ctx.fillRect(toX(c.x) - 2, toZ(c.z) - 2, 4, 4);
  }
  // player arrow
  const p = game.player;
  const px = p.inVehicle ? p.inVehicle.x : p.x;
  const pz = p.inVehicle ? p.inVehicle.z : p.z;
  const heading = p.inVehicle ? p.inVehicle.heading : p.heading;
  ctx.save();
  ctx.translate(toX(px), toZ(pz));
  ctx.rotate(-heading + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
