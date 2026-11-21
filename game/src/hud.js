// Solmar Bay — the HUD.
//
// updateHud rewrites every readout from the game state each frame. It
// only writes textContent (never innerHTML), and it tolerates a null
// document: with no DOM every element is null and the update is a
// no-op. The container #hud stays visible in every mode so the chapter
// card can always be seen; only the in-game readouts hide in menu and
// card modes.

import { respectLevel, STATIONS } from './config.js';
import { completionPercent } from './state.js';
import { districtAt } from './world.js';
import { phaseAt } from './weather.js';
import { WEAPONS } from './combat.js';
import { policeList } from './police.js';
import { nearestEnterableVehicle } from './vehicles.js';
import { phoneText } from './phone.js';

const IDS = [
  ['hud', 'hud'],
  ['top', 'hud-top'],
  ['cash', 'hud-cash'],
  ['health', 'hud-health'],
  ['armour', 'hud-armour'],
  ['wanted', 'hud-wanted'],
  ['clock', 'hud-clock'],
  ['respect', 'hud-respect'],
  ['completion', 'hud-completion'],
  ['district', 'hud-district'],
  ['speed', 'hud-speed'],
  ['weapon', 'hud-weapon'],
  ['car', 'hud-car'],
  ['radio', 'hud-radio'],
  ['mission', 'hud-mission'],
  ['police', 'hud-police'],
  ['dialogue', 'hud-dialogue'],
  ['toast', 'hud-toast'],
  ['prompt', 'hud-prompt'],
  ['phone', 'hud-phone'],
  ['card', 'hud-card'],
  ['cardTitle', 'hud-card-title'],
  ['cardText', 'hud-card-text'],
  ['cardHint', 'hud-card-hint'],
  ['modal', 'hud-modal'],
  ['modalTitle', 'hud-modal-title'],
  ['modalLines', 'hud-modal-lines'],
  ['menu', 'hud-menu'],
  ['pause', 'hud-pause'],
  ['minimap', 'hud-minimap'],
  ['bottom', 'hud-bottom'],
  ['btnNew', 'btn-new'],
  ['btnContinue', 'btn-continue'],
  ['btnResume', 'btn-resume'],
  ['btnPause', 'btn-pause'],
];

export function createHud(doc) {
  const el = {};
  for (const [short, id] of IDS) {
    const node = doc ? doc.getElementById(id) : null;
    el[short] = node;
    el[id] = node;
  }
  return { doc, el };
}

function setText(node, text) {
  if (node) node.textContent = text;
}

function setDisplay(node, value) {
  if (node) node.style.display = value;
}

function clockText(g) {
  const h = Math.floor(g.clock);
  const m = Math.floor((g.clock - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

function promptText(g) {
  const p = g.player;
  if (p.inCar) return 'Press E to exit';
  const v = nearestEnterableVehicle(g);
  if (v) return `Press E to enter ${v.name}`;
  return '';
}

export function updateHud(g, hud) {
  if (!hud || !hud.el) return;
  const el = hud.el;
  const p = g.player;

  setText(el.cash, `$${g.cash}`);
  setText(el.health, String(Math.floor(g.health)));
  setText(el.armour, g.armour > 0 ? `Armour ${Math.floor(g.armour)}` : '');
  setDisplay(el.armour, g.armour > 0 ? 'block' : 'none');
  setText(el.wanted, '★'.repeat(g.wanted) + '☆'.repeat(Math.max(0, 5 - g.wanted)));
  const phase = g._phase || phaseAt(g.clock);
  setText(el.clock, `Day ${g.day} · ${clockText(g)} · ${phase} · ${g.weather}`);
  const level = respectLevel(g.respect);
  setText(el.respect, `Respect ${g.respect} · ${level.name} · Next: ${level.next || 'Max'}`);
  setText(el.completion, `${completionPercent(g)}%`);
  setText(el.district, districtAt(p.x, p.z));

  // Speed: the car in km/h, on foot the walking speed.
  const kmh = p.inCar ? Math.abs(p.inCar.speed || 0) * 3.6 : Math.abs(p.speed || 0) * 3.6;
  setText(el.speed, `${Math.round(kmh)} km/h`);

  const weapon = WEAPONS[p.weapon] || WEAPONS[0];
  const ammo = p.ammo && p.ammo[p.weapon];
  const ammoText = ammo === Infinity ? '∞' : String(ammo === undefined ? 0 : ammo);
  setText(el.weapon, `[${weapon.name} ${ammoText}]`);

  if (p.inCar) {
    setText(el.car, `${p.inCar.name} · Condition ${Math.round(p.inCar.condition)}%`);
  } else {
    setText(el.car, 'On foot');
  }

  const station = STATIONS[g.station] || STATIONS[0];
  setText(el.radio, station.name);

  if (g.chapter > 5) {
    setText(el.mission, 'Free Roam');
  } else {
    const ch = g.chapter;
    const title = ['First Wheels', 'Harbour Run', 'Lose the Heat', 'Three Fares', 'The Big One'][ch - 1] || 'Free Roam';
    const brief = [
      'Steal the Solmar Comet and bring it to the garage.',
      'Pick up the package at the harbour and deliver it to the hideout.',
      'Lose every wanted star and stay clean.',
      'Drive three passengers across town.',
      'Hit the vault, grab the cash, reach the safehouse with no stars.',
    ][ch - 1] || '';
    setText(el.mission, `${title} — ${brief}`);
  }

  const response = policeList(g);
  setText(el.police, response.join(' · '));

  // Toast: visible only while it has text and time left.
  const toastVisible = g.toastTimer > 0 && g.toast;
  setText(el.toast, toastVisible ? g.toast : '');
  setDisplay(el.toast, toastVisible ? 'block' : 'none');

  // The interact prompt is a real element with real text — never a toast.
  const prompt = promptText(g);
  setText(el.prompt, prompt);
  setDisplay(el.prompt, prompt ? 'block' : 'none');

  // Dialogue.
  if (g.dialogue && g.dialogue.t > 0) {
    setText(el.dialogue, `${g.dialogue.name}: ${g.dialogue.text}`);
    setDisplay(el.dialogue, 'block');
  } else {
    setDisplay(el.dialogue, 'none');
  }

  // Modal.
  if (g.modal) {
    setDisplay(el.modal, 'block');
    setText(el.modalTitle, g.modal.title || '');
    setText(el.modalLines, (g.modal.lines || []).join('\n'));
  } else {
    setDisplay(el.modal, 'none');
  }

  // Phone panel.
  if (g.phoneOpen) {
    setText(el.phone, phoneText(g));
    setDisplay(el.phone, 'block');
  } else {
    setDisplay(el.phone, 'none');
  }

  // Chapter / passed / busted / wasted card.
  const showCard = g.mode === 'card' || g.mode === 'passed' || g.mode === 'busted' || g.mode === 'wasted';
  if (showCard && g.card) {
    setDisplay(el.card, 'flex');
    setText(el.cardTitle, g.card.title || '');
    setText(el.cardText, g.card.text || '');
    setText(el.cardHint, g.card.hint || 'Press Enter to start');
  } else {
    setDisplay(el.card, 'none');
  }

  // Menu and pause overlays.
  setDisplay(el.menu, g.mode === 'menu' ? 'flex' : 'none');
  setDisplay(el.pause, g.mode === 'pause' ? 'flex' : 'none');

  // Readouts hide in menu and card modes; the container stays visible.
  const readouts = g.mode === 'play' || g.mode === 'phone' || g.mode === 'pause';
  setDisplay(el.top, readouts ? 'block' : 'none');
  setDisplay(el.clock, readouts ? 'block' : 'none');
  setDisplay(el.bottom, readouts ? 'block' : 'none');
  setDisplay(el.minimap, readouts ? 'block' : 'none');
  setDisplay(el.hud, 'block');

  drawMinimap(g, hud);
}

export function drawMinimap(g, hud) {
  const canvas = hud && hud.el ? hud.el.minimap : null;
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width || 200;
  const H = canvas.height || 200;
  const scale = W / 800;
  const toX = (x) => (x + 400) * scale;
  const toY = (z) => (z + 400) * scale;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
  ctx.fill();

  // Sea on the west edge.
  ctx.fillStyle = '#1d5a8a';
  ctx.fillRect(0, 0, 60 * scale, H);

  // Roads.
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (let L = -360; L <= 360; L += 60) {
    ctx.beginPath();
    ctx.moveTo(toX(L), 0);
    ctx.lineTo(toX(L), H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toY(L));
    ctx.lineTo(W, toY(L));
    ctx.stroke();
  }

  // Mission marker.
  if (g.missionMarker) {
    ctx.fillStyle = '#ffcf3f';
    const mx = toX(g.missionMarker.x);
    const my = toY(g.missionMarker.z);
    ctx.beginPath();
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx + 6, my);
    ctx.lineTo(mx, my + 7);
    ctx.lineTo(mx - 6, my);
    ctx.closePath();
    ctx.fill();
  }

  // Taxi cab.
  if (g._taxiCab) {
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(toX(g._taxiCab.x), toY(g._taxiCab.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(toX(g.player.x), toY(g.player.z), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath();
  ctx.arc(toX(g.player.x), toY(g.player.z), 2.5, 0, Math.PI * 2);
  ctx.fill();
}
