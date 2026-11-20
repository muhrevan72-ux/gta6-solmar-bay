// Solmar Bay — the dense HUD (rebuild #14).
// Every field is written by textContent (never innerHTML). HP is
// shown as an integer (fix (e)). The layout keeps the minimap
// away from the radio/respect block and the Pause button away
// from the clock (fix (c)) — see index.html for the positions.

import { STATIONS, WEAPONS, respectLevel } from './config.js';
import { chapterTitle } from './state.js';
import { districtAt } from './world.js';
import { phaseAt } from './weather.js';
import { policeList } from './police.js';
import { stationLabel } from './audio.js';

const IDS = {
  cash: 'hud-cash', health: 'hud-health', armour: 'hud-armour',
  wanted: 'hud-wanted', clock: 'hud-clock', respect: 'hud-respect',
  completion: 'hud-completion', mission: 'hud-mission', police: 'hud-police',
  district: 'hud-district', speed: 'hud-speed', weapon: 'hud-weapon',
  car: 'hud-car', radio: 'hud-radio', toast: 'hud-toast',
  dialogue: 'hud-dialogue', card: 'hud-card', cardTitle: 'hud-card-title',
  cardText: 'hud-card-text', modal: 'hud-modal', modalTitle: 'hud-modal-title',
  modalBody: 'hud-modal-body', pause: 'hud-pause', menu: 'hud-menu',
  hud: 'hud', minimap: 'hud-minimap',
};

export function createHud(doc) {
  const el = {};
  for (const [key, id] of Object.entries(IDS)) {
    el[key] = doc && typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
  }
  return { el, doc: doc || null };
}

function setText(el, text) {
  if (el) el.textContent = text;
}
function setDisplay(el, value) {
  if (el) el.style.display = value;
}

function fmtClock(g) {
  const h = Math.floor(g.clock || 0);
  const m = Math.floor(((g.clock || 0) - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function updateHud(g, hud) {
  if (!hud || !hud.el) return;
  const el = hud.el;
  const s = g.g || g; // the state (the game is its own state)
  // Cash / health / armour / wanted.
  setText(el.cash, `$${Math.floor(s.cash)}`);
  setText(el.health, `${Math.round(s.health)}`);
  setText(el.armour, s.armour > 0 ? `Armour ${Math.round(s.armour)}` : '');
  const stars = Math.max(0, Math.min(5, s.wanted || 0));
  setText(el.wanted, '★'.repeat(stars) + '☆'.repeat(5 - stars));
  // Clock: "Day 1 · 08:00 · day · clear".
  const phase = s._phase || phaseAt(s.clock || 8);
  setText(el.clock, `Day ${s.day || 1} · ${fmtClock(s)} · ${phase} · ${s.weather || 'clear'}`);
  // Respect.
  const lvl = respectLevel(s.respect || 0);
  setText(el.respect, `Respect ${s.respect || 0} · ${lvl.name} → ${lvl.next || 'Max'}`);
  setText(el.completion, `${s.completion || 0}%`);
  // Mission panel.
  if ((s.chapter || 1) >= 6) {
    setText(el.mission, 'Free Roam');
  } else {
    const ch = s.chapter || 1;
    setText(el.mission, `${chapterTitle(s)} — ${missionObjective(s, ch)}`);
  }
  // Police list.
  setText(el.police, policeList(s).join(' · '));
  // District / speed / weapon / car / radio.
  setText(el.district, districtAt(s.player.x, s.player.z));
  const speed = s.player.inCar ? Math.abs(s.player.inCar.speed || 0) : (s.player.speed || 0);
  setText(el.speed, `${Math.round(speed * 3.6)} km/h`);
  const w = WEAPONS[s.player.weapon || 0] || WEAPONS[0];
  const ammo = s.player.ammo ? s.player.ammo[s.player.weapon || 0] : Infinity;
  setText(el.weapon, `[${w.name} ${ammo === Infinity ? '∞' : ammo}]`);
  if (s.player.inCar) {
    const v = s.player.inCar;
    setText(el.car, `${v.name} — Condition ${Math.round(v.condition)}%`);
  } else {
    setText(el.car, 'On foot');
  }
  const song = s.radio ? Math.floor((s.radio.songStep || 0) / 32) % 2 : 0;
  setText(el.radio, stationLabel(s.station || 0, song));
  // Toast / dialogue.
  setText(el.toast, (s.toastTimer || 0) > 0 ? (s.toast || '') : '');
  const d = s.dialogue;
  if (d) {
    const text = typeof d === 'string' ? d : `${d.name || ''}: ${d.text || ''}`;
    setText(el.dialogue, text);
    setDisplay(el.dialogue, 'block');
  } else {
    setText(el.dialogue, '');
    setDisplay(el.dialogue, 'none');
  }
  // Card (chapter / passed / wasted / busted).
  const showCard = !!s.card && (s.mode === 'card' || s.mode === 'passed' || s.mode === 'wasted' || s.mode === 'busted');
  setDisplay(el.card, showCard ? 'flex' : 'none');
  if (s.card) {
    setText(el.cardTitle, s.card.title || '');
    setText(el.cardText, s.card.text || '');
  }
  // Modal.
  setDisplay(el.modal, s.modal ? 'block' : 'none');
  if (s.modal) {
    setText(el.modalTitle, s.modal.title || '');
    setText(el.modalBody, (s.modal.lines || []).join('\n'));
  }
  // Pause overlay.
  setDisplay(el.pause, s.mode === 'pause' ? 'flex' : 'none');
  // Menu vs in-game HUD.
  if (s.mode === 'menu') {
    setDisplay(el.hud, 'none');
    setDisplay(el.menu, 'flex');
  } else {
    setDisplay(el.hud, 'block');
    setDisplay(el.menu, 'none');
  }
}

function missionObjective(s, ch) {
  const briefs = {
    1: 'Steal a car and drive to the garage',
    2: 'Pick up the package at the harbour, deliver it to the hideout',
    3: 'Lose the heat — get wanted to 0',
    4: 'Pick up 3 passengers',
    5: 'Grab the vault cash, then reach the safehouse clean',
  };
  return briefs[ch] || 'Free Roam';
}

// The round minimap: roads, the player arrow, the mission marker.
export function drawMinimap(g, canvas, camera) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
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
  ctx.fillStyle = '#3a3a3e';
  for (let i = -360; i <= 360; i += 60) {
    ctx.fillRect(toX(i) - 1, 0, 2, H);
    ctx.fillRect(0, toZ(i) - 1, W, 2);
  }
  ctx.fillStyle = '#2f7fc4';
  ctx.fillRect(0, 0, toX(-300), H);
  if (g.missionMarker) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(toX(g.missionMarker.x), toZ(g.missionMarker.z), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(toX(g.player.x), toZ(g.player.z), 4, 0, Math.PI * 2);
  ctx.fill();
}
