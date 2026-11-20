// Solmar Bay — HUD: all on-screen readouts + the minimap.
// The HUD is plain DOM updated by updateHud(); text is set through
// textContent only, never through markup strings (round-5 rule).

import { RESPECT, respectLevel } from './config.js';
import { completionPercent, chapterTitle } from './state.js';
import { stationLabel } from './audio.js';
import { WEAPONS } from './combat.js';
import { policeList } from './police.js';
import { missionObjective } from './missions.js';
import { districtAt } from './world.js';

const HUD_IDS = [
  'hud', 'hud-menu', 'hud-cash', 'hud-health', 'hud-wanted', 'hud-clock',
  'hud-respect', 'hud-completion', 'hud-mission', 'hud-police',
  'hud-district', 'hud-speed', 'hud-weapon', 'hud-car', 'hud-radio',
  'hud-toast', 'hud-dialogue', 'hud-armour', 'hud-card', 'hud-card-title',
  'hud-modal', 'hud-modal-title', 'hud-pause', 'hud-minimap',
];

// Short aliases so game code can write hud.el.cash instead of
// hud.el['hud-cash']. Both point at the same element.
const ALIASES = {
  cash: 'hud-cash', health: 'hud-health', wanted: 'hud-wanted',
  clock: 'hud-clock', respect: 'hud-respect', completion: 'hud-completion',
  mission: 'hud-mission', police: 'hud-police', district: 'hud-district',
  speed: 'hud-speed', weapon: 'hud-weapon', car: 'hud-car',
  radio: 'hud-radio', toast: 'hud-toast', dialogue: 'hud-dialogue',
  armour: 'hud-armour', card: 'hud-card', cardTitle: 'hud-card-title',
  modal: 'hud-modal', modalTitle: 'hud-modal-title', pause: 'hud-pause',
  menu: 'hud-menu', minimap: 'hud-minimap',
};

export function createHud(doc) {
  const el = {};
  for (const id of HUD_IDS) {
    el[id] = doc ? doc.getElementById(id) : null;
  }
  for (const [short, id] of Object.entries(ALIASES)) {
    el[short] = el[id];
  }
  return { el };
}

function setText(el, text) {
  if (el && typeof el === 'object') el.textContent = text;
}
function setDisplay(el, d) {
  if (el && el.style) el.style.display = d;
}

export function updateHud(game, hud) {
  const el = hud.el;
  const hours = Math.floor(game.clock);
  const minutes = Math.floor((game.clock - hours) * 60);
  const clockStr = `Day ${game.day} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} · ${game._phase || 'day'} · ${game.weather || 'clear'}`;
  setText(el['hud-cash'], `$${game.cash}`);
  setText(el['hud-health'], `${Math.max(0, Math.round(game.health))}`);
  setText(el['hud-wanted'], '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted));
  setText(el['hud-clock'], clockStr);
  const rep = game.respect || 0;
  const level = respectLevel(rep);
  setText(el['hud-respect'], `Respect ${rep} · ${level.name} · next ${level.next}`);
  setText(el['hud-completion'], `${completionPercent(game)}%`);
  if (game.chapter > 5 || (game.chapterDone || 0) >= 5) {
    setText(el['hud-mission'], 'Free Roam');
  } else {
    setText(el['hud-mission'], `${chapterTitle(game)} — ${missionObjective(game)}`);
  }
  setText(el['hud-police'], policeList(game).join(' · '));
  setText(el['hud-district'], districtAt(game.player.x, game.player.z));
  setText(el['hud-speed'], `${Math.round(game.player.speed || 0)} km/h`);
  const w = WEAPONS[game.player.weapon] || WEAPONS[0];
  const ammo = game.player.ammo && game.player.ammo[game.player.weapon] === Infinity ? '∞' : (game.player.ammo ? game.player.ammo[game.player.weapon] : '∞');
  setText(el['hud-weapon'], `[${w.name} ${ammo}]`);
  const car = game.player.inCar;
  if (car) {
    setText(el['hud-car'], `${car.name} · Condition ${Math.round(car.condition)}%`);
  } else {
    setText(el['hud-car'], 'On foot');
  }
  setText(el['hud-radio'], stationLabel(game.station || 0, game.song || 0));
  if (game.toastTimer > 0) {
    setText(el['hud-toast'], game.toast || '');
    setDisplay(el['hud-toast'], 'block');
  } else {
    setText(el['hud-toast'], '');
    setDisplay(el['hud-toast'], 'none');
  }
  if (game.dialogue && game.dialogue.t > 0) {
    setText(el['hud-dialogue'], `${game.dialogue.name} (${game.dialogue.role}): ${game.dialogue.text}`);
    setDisplay(el['hud-dialogue'], 'block');
  } else {
    setDisplay(el['hud-dialogue'], 'none');
  }
  setText(el['hud-armour'], game.armour > 0 ? `Armour ${game.armour}` : '');
  setDisplay(el['hud-card'], (game.mode === 'card' || game.mode === 'passed') ? 'flex' : 'none');
  setText(el['hud-card-title'], game.card ? game.card.title : '');
  setDisplay(el['hud-modal'], game.modal ? 'block' : 'none');
  setText(el['hud-modal-title'], game.modal ? game.modal.title : '');
  setDisplay(el['hud-pause'], game.mode === 'pause' ? 'flex' : 'none');
  setDisplay(el['hud'], game.mode === 'menu' ? 'none' : 'block');
  setDisplay(el['hud-menu'], game.mode === 'menu' ? 'flex' : 'none');
}

// The minimap: a round canvas showing the road grid, the player and
// the taxi cab. The 2d context is a no-op in headless tests.
export function drawMinimap(game, hud) {
  const canvas = hud.el['hud-minimap'];
  if (!canvas) return;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;
  const S = canvas.width || 160;
  const scale = S / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  try {
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2;
    for (const l of [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300]) {
      ctx.beginPath(); ctx.moveTo(toX(l), 0); ctx.lineTo(toX(l), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toZ(l)); ctx.lineTo(S, toZ(l)); ctx.stroke();
    }
    // Sea.
    ctx.fillStyle = '#1a5a8a';
    ctx.fillRect(0, 0, toX(-300), S);
    // Taxi cab (yellow) when one exists.
    const cab = game._taxiCab || (game.vehicles || []).find(v => v.kind === 'taxi');
    if (cab) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(toX(cab.x) - 3, toZ(cab.z) - 3, 6, 6);
    }
    // Player (white dot).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(toX(game.player.x), toZ(game.player.z), 4, 0, Math.PI * 2);
    ctx.fill();
  } catch (e) { /* minimap is best-effort */ }
}
