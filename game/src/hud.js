// Solmar Bay — the HUD: cash, health, stars, clock, respect,
// mission, police list, district, speed, weapon, car, radio,
// toast, dialogue, armour, minimap, chapter card, modal, pause
// overlay, and the phone panel. Uses textContent only — never
// innerHTML — so no markup can be injected through game text.

import { CHAPTERS, RESPECT } from './config.js';
import { respectLevel } from './config.js';
import { chapterTitle } from './state.js';
import { districtAt } from './world.js';
import { policeList } from './police.js';
import { stationLabel } from './audio.js';
import { phoneText } from './phone.js';

export { RESPECT, respectLevel };

const IDS = {
  hud: 'hud', menu: 'hud-menu', cash: 'hud-cash', health: 'hud-health',
  wanted: 'hud-wanted', clock: 'hud-clock', respect: 'hud-respect',
  completion: 'hud-completion', mission: 'hud-mission', police: 'hud-police',
  district: 'hud-district', speed: 'hud-speed', weapon: 'hud-weapon',
  car: 'hud-car', radio: 'hud-radio', toast: 'hud-toast',
  dialogue: 'hud-dialogue', armour: 'hud-armour', minimap: 'hud-minimap',
  card: 'hud-card', cardTitle: 'hud-card-title', modal: 'hud-modal',
  modalTitle: 'hud-modal-title', pause: 'hud-pause', phone: 'hud-phone',
  bottom: 'hud-bottom', top: 'hud-top',
};

export function createHud(doc) {
  const el = {};
  for (const [key, id] of Object.entries(IDS)) {
    el[key] = doc ? doc.getElementById(id) : null;
  }
  return { el, doc };
}

function setText(el, text) {
  if (el) el.textContent = text;
}

function fmtClock(g) {
  const h = Math.floor(g.clock) % 24;
  const m = Math.floor((g.clock % 1) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `Day ${g.day} · ${hh}:${mm} · ${g._phase || 'day'} · ${g.weather}`;
}

export function updateHud(g, hud) {
  if (!hud || !hud.el) return;
  const el = hud.el;
  // Visibility by mode.
  if (el.hud) el.hud.style.display = g.mode === 'menu' ? 'none' : 'block';
  if (el.menu) el.menu.style.display = g.mode === 'menu' ? 'flex' : 'none';
  if (el.card) el.card.style.display = g.mode === 'card' || g.mode === 'passed' ? 'flex' : 'none';
  if (el.cardTitle && g.card) el.cardTitle.textContent = g.card.title || '';
  if (el.modal) el.modal.style.display = g.modal ? 'block' : 'none';
  if (el.modalTitle && g.modal) el.modalTitle.textContent = g.modal.title || g.modal.kind || '';
  if (el.pause) el.pause.style.display = g.mode === 'pause' ? 'flex' : 'none';
  if (el.phone) {
    el.phone.style.display = g.phoneOpen ? 'block' : 'none';
    if (g.phoneOpen) el.phone.textContent = phoneText(g);
  }
  // Readouts.
  setText(el.cash, `$${g.cash}`);
  setText(el.health, String(Math.floor(g.health)));
  setText(el.wanted, '★'.repeat(g.wanted) + '☆'.repeat(5 - g.wanted));
  setText(el.clock, fmtClock(g));
  const lvl = respectLevel(g.respect);
  setText(el.respect, `Respect ${g.respect} · ${lvl.name}${lvl.next ? ` · Next: ${lvl.next}` : ''}`);
  setText(el.completion, `${g.completion || 0}%`);
  if (el.mission) {
    if (g.chapter >= 6) {
      el.mission.textContent = 'Free Roam';
    } else {
      const c = CHAPTERS[Math.max(0, Math.min(4, g.chapter - 1))];
      el.mission.textContent = `${chapterTitle(g)}\n${c.objective}`;
    }
  }
  setText(el.police, policeList(g).join('\n'));
  setText(el.district, districtAt(g.player.x, g.player.z));
  const speed = g.player.inCar ? Math.abs(g.player.inCar.speed) * 3.6 : Math.abs(g.player.speed || 0) * 3.6;
  setText(el.speed, `${Math.round(speed)} km/h`);
  const wnames = ['Pistol', 'SMG', 'Shotgun'];
  const wname = wnames[g.player.weapon] || 'Pistol';
  const ammo = g.player.ammo[g.player.weapon];
  setText(el.weapon, `[${wname} ${ammo === Infinity ? '∞' : ammo}]`);
  if (g.player.inCar) {
    setText(el.car, `${g.player.inCar.name} · Condition ${Math.round(g.player.inCar.condition)}%`);
  } else {
    setText(el.car, 'On foot');
  }
  setText(el.radio, stationLabel(g.station, g.song));
  setText(el.toast, g.toastTimer > 0 ? g.toast : '');
  if (el.dialogue) {
    if (g.dialogue && g.dialogue.t > 0) {
      el.dialogue.style.display = 'block';
      el.dialogue.textContent = `${g.dialogue.name}: ${g.dialogue.text}`;
    } else {
      el.dialogue.style.display = 'none';
      el.dialogue.textContent = '';
    }
  }
  setText(el.armour, g.armour > 0 ? `Armour ${Math.floor(g.armour)}` : '');
}

// Minimap: roads, buildings, mission marker, player, police, taxi.
export function drawMinimap(g, hud) {
  if (!hud || !hud.el || !hud.el.minimap) return;
  const cv = hud.el.minimap;
  let ctx = null;
  try { ctx = cv.getContext('2d'); } catch (e) { return; }
  if (!ctx) return;
  const S = 200;
  const toMap = (x, z) => [((x + 400) / 800) * S, ((z + 400) / 800) * S];
  try {
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.fillStyle = '#3a3a3e';
    for (const r of [-360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360]) {
      const [rx] = toMap(r, 0);
      ctx.fillRect(rx - 1, 0, 2, S);
      const [, rz] = toMap(0, r);
      ctx.fillRect(0, rz - 1, S, 2);
    }
    // Buildings.
    ctx.fillStyle = '#888';
    if (g.city) {
      for (const b of g.city.buildings) {
        const [bx, bz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
        ctx.fillRect(bx, bz, Math.max(1, (b.w / 800) * S), Math.max(1, (b.d / 800) * S));
      }
    }
    // Mission marker.
    if (g.missionMarker) {
      const [mx, mz] = toMap(g.missionMarker.x, g.missionMarker.z);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(mx - 3, mz - 3, 6, 6);
    }
    // Police blips.
    ctx.fillStyle = '#3355ff';
    for (const c of g.cops || []) {
      const [cx, cz] = toMap(c.x, c.z);
      ctx.fillRect(cx - 2, cz - 2, 4, 4);
    }
    // Taxi cab.
    if (g._taxiCab) {
      const [tx, tz] = toMap(g._taxiCab.x, g._taxiCab.z);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(tx - 2, tz - 2, 4, 4);
    }
    // Player.
    const [px, pz] = toMap(g.player.x, g.player.z);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 3, pz - 3, 6, 6);
  } catch (e) { /* minimap is best-effort */ }
}
