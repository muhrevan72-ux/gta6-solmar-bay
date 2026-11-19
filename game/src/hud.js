// Solmar Bay — HUD: the dense top-4 style interface.
//
// Mission panel (chapter + stage + objective + NEXT + respect +
// location + completion %), police response list (named units +
// distance + status), Day N · HH:MM · phase · weather clock, weapon
// slots with ammo, car name + condition while driving, radio
// station + song, district name, dialogue box with a named NPC +
// role. All the data comes from pure functions (headless-testable);
// updateHud writes it into the DOM. drawMinimap is exported and
// called in the menu branch too, so the title screen never shows an
// empty green box.

import { districtAt, respectLevel } from './config.js';
import { missionPanelData } from './missions.js';
import { policeListData } from './police.js';
import { clockText } from './weather.js';
import { radioNow } from './audio.js';
import { completionPct } from './missions.js';

export const HUD_IDS = [
  'hud-cash', 'hud-health', 'hud-armour', 'hud-wanted', 'hud-objective',
  'hud-speed', 'hud-mission', 'hud-police', 'hud-respect', 'hud-clock',
  'hud-weapons', 'hud-car', 'hud-radio', 'hud-district', 'hud-dialogue',
  'hud-toast', 'hud-menu', 'hud-card', 'hud-minimap', 'hud-phone',
];

export function weaponSlots(game) {
  const s = game.state;
  const slots = [];
  slots.push({ key: '1', name: 'Pistol', ammo: '∞', owned: true, active: s.weapon === 'pistol' });
  slots.push({ key: '2', name: 'SMG', ammo: String(s.ammo.smg), owned: s.weapons.smg, active: s.weapon === 'smg' });
  slots.push({ key: '3', name: 'Shotgun', ammo: String(s.ammo.shotgun), owned: s.weapons.shotgun, active: s.weapon === 'shotgun' });
  return slots;
}

export function respectInfo(game) {
  const s = game.state;
  const lvl = respectLevel(s.respect);
  return {
    name: lvl.name,
    rep: s.respect,
    next: lvl.next,
    nextMin: lvl.nextMin,
    pct: lvl.nextMin ? Math.round(((s.respect - lvl.min) / (lvl.nextMin - lvl.min)) * 100) : 100,
  };
}

export function carInfo(game) {
  const v = game.state.player.inCar;
  if (!v) return null;
  return {
    name: v.name,
    condition: Math.max(0, 100 - v.damage),
    speed: Math.round(Math.abs(v.speed) * 3.6), // km/h
  };
}

export function hudData(game) {
  const s = game.state;
  return {
    cash: s.cash,
    bank: s.bank,
    health: Math.round(s.health),
    armour: Math.round(s.armour),
    wanted: s.wanted,
    speed: Math.round(Math.abs(s.player.speed) * 3.6),
    mission: missionPanelData(game),
    police: policeListData(game),
    respect: respectInfo(game),
    clock: clockText(game),
    weapons: weaponSlots(game),
    car: carInfo(game),
    radio: radioNow(game.radio),
    district: districtAt(s.player.x, s.player.z),
    dialogue: s.hud.dialogue,
    completion: completionPct(game),
    bombs: s.bombs,
    relationship: game.dating.relationship,
  };
}

// Minimap (2D canvas, top-down): player, mission marker, police
// blips, gang turf, car. Exported so the title screen can draw it
// behind the menu.
export function drawMinimap(ctx, game, w, h) {
  if (!ctx) return;
  const size = Math.min(w, h);
  const scale = size / 800;
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#0d2b1a';
  ctx.fillRect(0, 0, w, h);
  // Water + sand (west edge).
  ctx.fillStyle = '#2a6a8a';
  ctx.fillRect(0, 0, (400 - 340) * scale * 0 + 30 * scale, h);
  ctx.fillStyle = '#c8a86a';
  ctx.fillRect(30 * scale, 0, 40 * scale, h);
  // Roads.
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 7 * scale;
  for (const l of [-300, -200, -100, 0, 100, 200, 300]) {
    const px = cx + l * scale;
    const py = cy + l * scale;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
  // Gang turf.
  ctx.fillStyle = 'rgba(240, 190, 40, 0.25)';
  ctx.fillRect(cx - 160 * scale, cy - 240 * scale, 320 * scale, 280 * scale);
  ctx.fillStyle = 'rgba(40, 180, 180, 0.25)';
  ctx.fillRect(cx + 230 * scale, cy - 210 * scale, 180 * scale, 220 * scale);
  // Buildings.
  ctx.fillStyle = '#777';
  for (const b of game.city.buildings) {
    ctx.fillRect(cx + (b.x - b.sx / 2) * scale, cy + (b.z - b.sz / 2) * scale, b.sx * scale, b.sz * scale);
  }
  // Mission marker (yellow).
  const m = game.missions.marker;
  if (m) {
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(cx + m.x * scale, cy + m.z * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips (blue).
  ctx.fillStyle = '#3a6cff';
  for (const c of game.police.cops) {
    ctx.beginPath();
    ctx.arc(cx + c.x * scale, cy + c.z * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player (white triangle).
  const p = game.state.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + p.x * scale, cy + p.z * scale, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function updateHud(game, els) {
  if (typeof document === 'undefined' || !els) return;
  const d = hudData(game);
  const set = (id, text) => {
    const el = els[id];
    if (el) el.textContent = text;
  };
  set('hud-cash', '$' + d.cash + (d.bank ? '  ·  bank $' + d.bank : ''));
  set('hud-health', 'HP ' + d.health + (d.armour ? ' · Armour ' + d.armour : ''));
  set('hud-wanted', '★'.repeat(d.wanted) + '☆'.repeat(5 - d.wanted));
  set('hud-objective', d.mission.objective);
  set('hud-speed', d.car ? d.car.speed + ' km/h' : Math.round(d.speed) + ' km/h');
  set('hud-clock', d.clock);
  set('hud-district', d.district);
  set('hud-respect', d.respect.name + ' · ' + d.respect.rep + ' REP' + (d.respect.next ? ' → ' + d.respect.next + ' (' + d.respect.nextMin + ')' : ''));
  set('hud-radio', d.radio.station + ' ' + d.radio.freq + ' — ' + d.radio.song);
  set('hud-car', d.car ? d.car.name + ' · ' + d.car.condition + '%' : '');
  const wEl = els['hud-weapons'];
  if (wEl) {
    wEl.innerHTML = d.weapons.map((w) => (w.active ? '<b>' : '') + '[' + w.name + ' ' + (w.owned ? w.ammo : '—') + ']' + (w.active ? '</b>' : '')).join(' ');
  }
  const mEl = els['hud-mission'];
  if (mEl) {
    mEl.innerHTML = '<b>' + d.mission.chapter + '</b><br>' + d.mission.objective +
      (d.mission.next ? '<br>NEXT: ' + d.mission.next : '') +
      (d.mission.sideJob ? '<br>JOB: ' + d.mission.sideJob : '') +
      '<br>Complete: ' + d.mission.completion + '%';
  }
  const pEl = els['hud-police'];
  if (pEl) {
    pEl.innerHTML = d.police.length
      ? d.police.map((u) => u.name + ' ' + u.status + ' ' + u.dist + 'm').join('<br>')
      : 'No police response';
  }
  const dg = els['hud-dialogue'];
  if (dg) {
    dg.style.display = d.dialogue ? 'block' : 'none';
    if (d.dialogue) dg.innerHTML = '<b>' + d.dialogue.name + '</b> <i>' + d.dialogue.role + '</i><br>' + d.dialogue.text;
  }
  const tEl = els['hud-toast'];
  if (tEl) {
    tEl.innerHTML = game.state.hud.toasts.map((t) => '<div>' + t.text + '</div>').join('');
  }
  const menu = els['hud-menu'];
  if (menu) {
    const m = game.state.hud.menu;
    menu.style.display = m ? 'block' : 'none';
    if (m) menu.innerHTML = '<h2>' + m.title + '</h2><p>' + m.body + '</p><p><i>' + m.hint + '</i></p>';
  }
  const card = els['hud-card'];
  if (card) {
    const c = game.state.hud.card;
    card.style.display = c ? 'block' : 'none';
    if (c) card.innerHTML = '<h2>' + c.title + '</h2><p>' + c.text + '</p><p><i>Press Enter to start.</i></p>';
  }
}
