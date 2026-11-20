// Solmar Bay — the HUD.
//
// updateHud writes textContent only (never innerHTML). The clock
// line is 'Day 1 · 08:00 · day · clear'; wanted is ★/☆ stars;
// the mission panel shows the chapter title + objective, or
// 'Free Roam' after chapter 5. drawMinimap sketches the roads,
// buildings, player, marker and taxi on the round minimap canvas.

import { CHAPTERS, respectLevel } from './config.js';
import { phaseAt } from './weather.js';
import { districtAt, ROAD_LINES } from './world.js';
import { policeList } from './police.js';
import { stationLabel } from './audio.js';
import { WEAPONS } from './combat.js';

const IDS = [
  'hud', 'hud-menu', 'hud-card', 'hud-card-title', 'hud-card-text',
  'hud-modal', 'hud-modal-title', 'hud-modal-lines', 'hud-pause',
  'hud-minimap', 'hud-cash', 'hud-health', 'hud-wanted', 'hud-clock',
  'hud-respect', 'hud-completion', 'hud-mission', 'hud-police',
  'hud-district', 'hud-speed', 'hud-weapon', 'hud-car', 'hud-radio',
  'hud-toast', 'hud-dialogue', 'hud-armour',
];

export function createHud(doc) {
  const el = {};
  for (const id of IDS) {
    el[id] = doc ? doc.getElementById(id) : null;
    // Short alias too (hud.el.cash as well as hud.el['hud-cash']).
    const short = id.startsWith('hud-') ? id.slice(4) : id;
    if (!(short in el)) el[short] = el[id];
  }
  return { el, doc: doc || null };
}

function setText(hud, id, text) {
  const el = hud && hud.el ? hud.el[id] : null;
  if (el) el.textContent = text;
}

function setDisplay(hud, id, value) {
  const el = hud && hud.el ? hud.el[id] : null;
  if (el && el.style) el.style.display = value;
}

export function updateHud(game, hud) {
  if (!hud || !hud.el) return;
  const set = (id, text) => setText(hud, id, text);
  // Money, health, wanted, clock.
  set('hud-cash', `$${game.cash || 0}`);
  set('hud-health', `${game.health || 0}`);
  const wanted = game.wanted || 0;
  set('hud-wanted', '★'.repeat(wanted) + '☆'.repeat(5 - wanted));
  const h = Math.floor(game.clock || 0);
  const m = Math.floor(((game.clock || 0) - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const phase = game._phase || phaseAt(game.clock || 0);
  set('hud-clock', `Day ${game.day || 1} · ${hh}:${mm} · ${phase} · ${game.weather || 'clear'}`);
  // Respect: value, level name and the next level.
  const rep = game.respect || 0;
  const level = respectLevel(rep);
  set('hud-respect', `Respect ${rep} · ${level.name}${level.next ? ` → ${level.next}` : ' · Max'}`);
  // Completion.
  set('hud-completion', `${game.completion || 0}%`);
  // Mission: chapter title + objective, or Free Roam.
  if ((game.chapter || 1) > 5) {
    set('hud-mission', 'Free Roam');
  } else {
    const ch = CHAPTERS[(game.chapter || 1) - 1];
    set('hud-mission', ch ? `${ch.title}: ${ch.objective}` : 'Free Roam');
  }
  // Police response.
  set('hud-police', policeList(game).join(' · '));
  // District + speed.
  set('hud-district', districtAt(game.player.x, game.player.z));
  const speed = game.player.inCar && game.player.inCar.speed !== undefined
    ? Math.abs(game.player.inCar.speed)
    : Math.abs(game.player.speed || 0);
  set('hud-speed', `${Math.round(speed * 3.6)} km/h`);
  // Weapon: [Pistol ∞].
  const weapon = WEAPONS[game.player.weapon || 0] || WEAPONS[0];
  const ammo = game.player.ammo ? game.player.ammo[game.player.weapon || 0] : Infinity;
  const ammoText = ammo === Infinity ? '∞' : `${ammo}`;
  set('hud-weapon', `[${weapon.name} ${ammoText}]`);
  // Car.
  if (game.player.inCar) {
    const v = game.player.inCar;
    set('hud-car', `${v.name} · Condition ${v.condition}%`);
  } else {
    set('hud-car', 'On foot');
  }
  // Radio.
  set('hud-radio', stationLabel(game.station || 0, game.song || 0));
  // Toast + dialogue.
  set('hud-toast', (game.toastTimer || 0) > 0 ? (game.toast || '') : '');
  if (game.dialogue && (game.dialogue.t || 0) > 0) {
    set('hud-dialogue', `${game.dialogue.name}: ${game.dialogue.text}`);
    setDisplay(hud, 'hud-dialogue', 'block');
  } else {
    set('hud-dialogue', '');
    setDisplay(hud, 'hud-dialogue', 'none');
  }
  // Armour.
  set('hud-armour', (game.armour || 0) > 0 ? `Armour ${game.armour}` : '');
  // Overlays.
  const mode = game.mode || 'menu';
  setDisplay(hud, 'hud', mode === 'menu' ? 'none' : 'block');
  setDisplay(hud, 'hud-menu', mode === 'menu' ? 'flex' : 'none');
  const showCard = (mode === 'card' || mode === 'passed') && game.card;
  setDisplay(hud, 'hud-card', showCard ? 'flex' : 'none');
  if (showCard) {
    set('hud-card-title', game.card.title || '');
    set('hud-card-text', game.card.text || '');
  }
  const showModal = !!game.modal;
  setDisplay(hud, 'hud-modal', showModal ? 'block' : 'none');
  if (showModal) {
    set('hud-modal-title', game.modal.title || '');
    const linesEl = hud.el['hud-modal-lines'];
    if (linesEl) linesEl.textContent = (game.modal.lines || []).join('\n');
  }
  setDisplay(hud, 'hud-pause', mode === 'pause' || game.menu === 'pause' ? 'flex' : 'none');
}

// The round minimap: roads, buildings, the player, the marker and
// the taxi cab. Never throws on a stub 2d context.
export function drawMinimap(game, hud) {
  const canvas = hud && hud.el ? hud.el['hud-minimap'] : null;
  if (!canvas || !canvas.getContext) return;
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;
  const size = canvas.width || 200;
  const half = size / 2;
  const scale = size / 800; // world -400..400 maps to the canvas
  const toX = (x) => half + x * scale;
  const toY = (z) => half + z * scale;
  try {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, size, size);
    // Roads.
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 2;
    for (const line of ROAD_LINES) {
      ctx.beginPath();
      ctx.moveTo(toX(line), toY(-300));
      ctx.lineTo(toX(line), toY(300));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-300), toY(line));
      ctx.lineTo(toX(300), toY(line));
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#5a6270';
    if (game.city) {
      for (const b of game.city.buildings) {
        ctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), Math.max(1, b.w * scale), Math.max(1, b.d * scale));
      }
    }
    // The mission marker.
    if (game.missionMarker) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(toX(game.missionMarker.x), toY(game.missionMarker.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The taxi cab.
    if (game._taxiCab) {
      ctx.fillStyle = '#ff0';
      ctx.fillRect(toX(game._taxiCab.x) - 3, toY(game._taxiCab.z) - 3, 6, 6);
    }
    // The player.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(toX(game.player.x), toY(game.player.z), 4, 0, Math.PI * 2);
    ctx.fill();
  } catch {
    // A stub context must never break the frame.
  }
}
