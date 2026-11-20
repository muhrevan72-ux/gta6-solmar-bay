// Solmar Bay — dense HUD + minimap (rebuild #13).
import { chapterTitle } from './state.js';
import { districtAt } from './world.js';
import { policeList } from './police.js';
import { stationLabel } from './audio.js';
import { respectLevel, CHAPTERS } from './config.js';
import { phaseAt } from './weather.js';
import { WEAPONS } from './combat.js';

const IDS = [
  'hud', 'hud-menu', 'hud-cash', 'hud-health', 'hud-armour', 'hud-wanted',
  'hud-clock', 'hud-respect', 'hud-completion', 'hud-mission', 'hud-police',
  'hud-district', 'hud-speed', 'hud-weapon', 'hud-car', 'hud-radio',
  'hud-toast', 'hud-dialogue', 'hud-card', 'hud-card-title', 'hud-card-text',
  'hud-modal', 'hud-modal-title', 'hud-modal-lines', 'hud-pause', 'hud-minimap',
  'btn-new', 'btn-continue', 'btn-resume', 'btn-pause',
];

export function createHud(doc) {
  const el = {};
  for (const id of IDS) {
    el[id] = doc ? doc.getElementById(id) : null;
    // Short alias (hud-cash -> cash) so logic can read hud.el.cash.
    if (id.startsWith('hud-')) el[id.slice(4)] = el[id];
  }
  return { el, doc };
}

function setText(el, id, text) {
  if (el[id]) el[id].textContent = text;
}
function setDisplay(el, id, disp) {
  if (el[id]) el[id].style.display = disp;
}

export function updateHud(game, hud) {
  if (!hud || !hud.el) return;
  const el = hud.el;
  const p = game.player;
  setText(el, 'hud-cash', `$${game.cash}`);
  setText(el, 'hud-health', `${game.health}`);
  setText(el, 'hud-armour', game.armour > 0 ? `Armour ${game.armour}` : '');
  const stars = '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted);
  setText(el, 'hud-wanted', stars);
  const hh = Math.floor(game.clock);
  const mm = Math.floor((game.clock - hh) * 60);
  const phase = game._phase || phaseAt(game.clock);
  setText(el, 'hud-clock', `Day ${game.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${phase} · ${game.weather}`);
  const rl = respectLevel(game.respect);
  setText(el, 'hud-respect', `Respect ${game.respect} · ${rl.name}${rl.next ? ` → ${rl.next}` : ''}`);
  setText(el, 'hud-completion', `${game.completion}%`);
  if (game.chapter > 5) {
    setText(el, 'hud-mission', 'Free Roam');
  } else {
    const ch = CHAPTERS[game.chapter - 1];
    setText(el, 'hud-mission', `${chapterTitle(game)} · ${ch.objective}`);
  }
  setText(el, 'hud-police', policeList(game).join(' · '));
  setText(el, 'hud-district', districtAt(p.x, p.z));
  const speed = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 3.6) : Math.round(p.speed || 0);
  setText(el, 'hud-speed', `${speed} km/h`);
  const w = WEAPONS[p.weapon];
  const ammo = p.ammo[p.weapon] === Infinity ? '∞' : p.ammo[p.weapon];
  setText(el, 'hud-weapon', `[${w.name} ${ammo}]`);
  if (p.inCar) {
    setText(el, 'hud-car', `${p.inCar.name} · Condition ${Math.round(p.inCar.condition)}%`);
  } else {
    setText(el, 'hud-car', 'On foot');
  }
  setText(el, 'hud-radio', stationLabel(game.station, game.song));
  setText(el, 'hud-toast', game.toastTimer > 0 ? game.toast : '');
  if (game.dialogue && game.dialogue.t > 0) {
    setText(el, 'hud-dialogue', `${game.dialogue.name} (${game.dialogue.role}): ${game.dialogue.text}`);
    setDisplay(el, 'hud-dialogue', 'block');
  } else {
    setText(el, 'hud-dialogue', '');
    setDisplay(el, 'hud-dialogue', 'none');
  }
  // Screens.
  setDisplay(el, 'hud', game.mode === 'menu' ? 'none' : 'block');
  setDisplay(el, 'hud-menu', game.mode === 'menu' ? 'flex' : 'none');
  const cardModes = ['card', 'passed', 'wasted', 'busted'];
  setDisplay(el, 'hud-card', cardModes.includes(game.mode) ? 'flex' : 'none');
  if (game.card) {
    setText(el, 'hud-card-title', game.card.title);
    setText(el, 'hud-card-text', game.card.text || '');
  }
  setDisplay(el, 'hud-pause', game.mode === 'pause' ? 'flex' : 'none');
  if (game.modal) {
    setDisplay(el, 'hud-modal', 'block');
    setText(el, 'hud-modal-title', game.modal.title || '');
    setText(el, 'hud-modal-lines', (game.modal.lines || []).join('\n'));
  } else {
    setDisplay(el, 'hud-modal', 'none');
  }
}

export function drawMinimap(game, hud) {
  if (!hud || !hud.doc) return;
  const canvas = hud.doc.getElementById('hud-minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width || 200;
  const H = canvas.height || 200;
  const scale = W / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f6fb8';
  ctx.fillRect(0, 0, 70 * scale, H);
  ctx.strokeStyle = '#444';
  for (let v = -360; v <= 360; v += 60) {
    ctx.beginPath(); ctx.moveTo(toX(v), 0); ctx.lineTo(toX(v), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toZ(v)); ctx.lineTo(W, toZ(v)); ctx.stroke();
  }
  if (game.city) {
    ctx.fillStyle = '#888';
    for (const b of game.city.buildings) {
      ctx.fillRect(toX(b.x - b.w / 2), toZ(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
  }
  if (game.missionMarker) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(toX(game.missionMarker.x), toZ(game.missionMarker.z), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game._taxiCab) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(toX(game._taxiCab.x) - 3, toZ(game._taxiCab.z) - 3, 6, 6);
  }
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(toX(game.player.x), toZ(game.player.z), 4, 0, Math.PI * 2);
  ctx.fill();
}
