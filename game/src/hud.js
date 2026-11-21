// Solmar Bay — the HUD: readouts, minimap, menus, cards, phone.
// Written fresh for rebuild #18. Elements are looked up by id
// (the page provides them; the fake doc creates them on demand).
// Text is set via textContent only (no innerHTML anywhere).

import { CHAPTERS, STATIONS } from './config.js';
import { chapterTitle, completionPercent, respectLevel } from './state.js';
import { districtAt } from './world.js';
import { stationLabel } from './audio.js';
import { phoneText } from './phone.js';
import { policeList } from './police.js';

// Full id -> short name used on hud.el.
const IDS = [
  ['hud', 'root'],
  ['hud-card', 'card'],
  ['hud-card-title', 'cardTitle'],
  ['hud-card-text', 'cardText'],
  ['hud-card-hint', 'cardHint'],
  ['hud-cash', 'cash'],
  ['hud-wanted', 'wanted'],
  ['hud-health', 'health'],
  ['hud-car', 'car'],
  ['hud-phone', 'phone'],
  ['hud-pause', 'pause'],
  ['hud-minimap', 'minimap'],
  ['hud-bottom', 'bottom'],
  ['btn-pause', 'btnPause'],
  ['btn-resume', 'btnResume'],
  ['btn-continue', 'btnContinue'],
  ['btn-new', 'btnNew'],
  ['hud-top', 'top'],
  ['hud-clock', 'clock'],
  ['hud-respect', 'respect'],
  ['hud-completion', 'completion'],
  ['hud-mission', 'mission'],
  ['hud-police', 'police'],
  ['hud-district', 'district'],
  ['hud-speed', 'speed'],
  ['hud-weapon', 'weapon'],
  ['hud-radio', 'radio'],
  ['hud-toast', 'toast'],
  ['hud-dialogue', 'dialogue'],
  ['hud-modal', 'modal'],
  ['hud-modal-title', 'modalTitle'],
  ['hud-armour', 'armour'],
  ['hud-menu', 'menu'],
];

export function createHud(doc) {
  const el = {};
  for (const [id, short] of IDS) {
    let node = null;
    if (doc && typeof doc.getElementById === 'function') {
      try {
        node = doc.getElementById(id);
      } catch {
        node = null;
      }
    }
    el[short] = node;
    el[id] = node;
  }
  return { el, doc: doc || null };
}

function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function setDisplay(node, value) {
  if (!node || !node.style) return;
  node.style.display = value;
}

function stars(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

export function updateHud(game, hud) {
  if (!hud || !hud.el) return;
  const g = game;
  const e = hud.el;
  const inMenu = g.mode === 'menu';
  const inCard = g.mode === 'card' || g.mode === 'passed';
  const paused = g.mode === 'pause' || g.menu === 'pause';
  const phoneOpen = !!g.phoneOpen && g.mode === 'phone';

  setDisplay(e.root, 'block');
  setDisplay(e.menu, inMenu ? 'flex' : 'none');
  setDisplay(e.top, inMenu ? 'none' : 'block');
  setDisplay(e.clock, inMenu ? 'none' : 'block');
  setDisplay(e.bottom, inMenu ? 'none' : 'block');
  setDisplay(e.minimap, inMenu ? 'none' : 'block');
  setDisplay(e.card, inCard ? 'flex' : 'none');
  setDisplay(e.pause, paused ? 'flex' : 'none');
  setDisplay(e.phone, phoneOpen ? 'block' : 'none');

  if (inCard && g.card) {
    setText(e.cardTitle, g.card.title || '');
    setText(e.cardText, g.card.text || '');
    setText(e.cardHint, g.card.hint || 'Press Enter to start');
  }
  setText(e.cash, `$${g.cash}`);
  setText(e.wanted, stars(g.wanted || 0));
  setText(e.health, String(Math.round(g.health)));
  const v = g.player ? g.player.inCar : null;
  setText(e.car, v ? `${v.name} · Condition ${Math.round(v.condition)}%` : 'On foot');
  const hh = Math.floor(g.clock || 8);
  const mm = Math.floor(((g.clock || 8) - hh) * 60);
  const phase = g._phase || 'day';
  const wObj = g.weatherObj || null;
  const weather = wObj && wObj.current ? wObj.current : (typeof g.weather === 'string' ? g.weather : 'clear');
  setText(e.clock, `Day ${g.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${phase} · ${weather}`);
  const rl = respectLevel(g.respect || 0);
  setText(e.respect, `Respect ${g.respect || 0} · ${rl.name}${rl.next ? ` · next: ${rl.next}` : ''}`);
  setText(e.completion, `Completion ${completionPercent(g)}%`);
  const ch = CHAPTERS[(g.chapter || 1) - 1];
  if (g.chapter > 5 || g.chapterDone >= 5) {
    setText(e.mission, 'Free Roam');
  } else if (ch) {
    setText(e.mission, `${chapterTitle(g)} — ${ch.objective}`);
  }
  const plist = policeList(g);
  setText(e.police, plist.length ? plist.join(', ') : '');
  setText(e.district, districtAt(g.player.x, g.player.z));
  const speed = v ? Math.abs(v.speed || 0) * 3.6 : 0;
  setText(e.speed, v ? `${Math.round(speed)} km/h` : '0 km/h');
  const wnames = ['Pistol', 'SMG', 'Shotgun'];
  const pw = g.player ? g.player.weapon : 0;
  const ammo = g.player && g.player.ammo ? g.player.ammo[pw] : Infinity;
  setText(e.weapon, `[${wnames[pw] || 'Pistol'} ${ammo === Infinity ? '∞' : ammo}]`);
  setText(e.radio, stationLabel(g.station, g.song));
  if (g.toastTimer > 0 && g.toast) {
    setText(e.toast, g.toast);
  } else {
    setText(e.toast, '');
  }
  if (g.dialogue && g.dialogue.t > 0) {
    setText(e.dialogue, `${g.dialogue.name}: ${g.dialogue.text}`);
  } else {
    setText(e.dialogue, '');
  }
  if (g.modal) {
    setDisplay(e.modal, 'block');
    setText(e.modalTitle, g.modal.title || '');
  } else {
    setDisplay(e.modal, 'none');
  }
  setText(e.armour, (g.armour || 0) > 0 ? `Armour ${Math.round(g.armour)}` : '');
  if (phoneOpen) {
    setText(e.phone, phoneText(g));
  }
}

export function drawMinimap(game, hud) {
  const cv = hud && hud.el ? (hud.el.minimap || hud.el['hud-minimap']) : null;
  if (!cv || typeof cv.getContext !== 'function') return;
  let ctx = null;
  try {
    ctx = cv.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;
  const W = cv.width || 200;
  const H = cv.height || 200;
  const scale = W / 800;
  const px = (x) => (x + 400) * scale;
  const pz = (z) => (z + 400) * scale;
  try {
    ctx.fillStyle = '#0b2a1a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#555';
    for (let r = -360; r <= 360; r += 60) {
      ctx.fillRect(0, pz(r) - 3, W, 6);
      ctx.fillRect(px(r) - 3, 0, 6, H);
    }
    ctx.fillStyle = '#c9a35c';
    if (game.city) {
      for (const b of game.city.buildings) {
        ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
      }
    }
    if (game.missionMarker) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(px(game.missionMarker.x) - 4, pz(game.missionMarker.z) - 4, 8, 8);
    }
    if (game._taxiCab) {
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(px(game._taxiCab.x) - 3, pz(game._taxiCab.z) - 3, 6, 6);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px(game.player.x), pz(game.player.z), 4, 0, Math.PI * 2);
    ctx.fill();
  } catch {
    // A fake 2d context must never break the frame.
  }
}
