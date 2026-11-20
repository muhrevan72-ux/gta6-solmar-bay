// Solmar Bay — HUD + minimap.
//
// THE TITLE FIX (play-test #5): #hud-menu is STATIC HTML in
// index.html. updateHud NEVER writes its innerHTML and never
// hides it by overwriting — it only flips style.display between
// 'flex' (mode === 'menu') and 'none'. The modal is a separate
// #hud-modal, the chapter card a third centred panel #hud-card.
// The old build ran updateHud every frame doing
// menu.style.display = hud.menu ? 'block' : 'none' with
// hud.menu null at boot (title hidden on frame 1) and overwrote
// menu.innerHTML whenever a menu showed (destroying SOLMAR BAY
// + the buttons from the DOM).
//
// The HUD is dense (top-4 formula): mission panel, named police
// response list, wanted, cash, day + time, health/armour/
// respect, weapon slots + ammo, speed + car name/condition,
// radio + song, round minimap, location name, named-NPC
// dialogue box. In Node (no document) every method is a stub
// that records what it would have shown, so headless tests can
// assert on it.

import { STATIONS, clamp } from './config.js';
import { phaseAt } from './weather.js';
import { districtAt } from './world.js';
import { policeList } from './police.js';
import { stationLabel } from './audio.js';

function stubEl() {
  return {
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    width: 200,
    height: 200,
    getContext: () => null,
    appendChild() {},
  };
}

export function createHud(game, doc) {
  const get = (id) => {
    if (doc && typeof doc.getElementById === 'function') {
      return doc.getElementById(id) || stubEl();
    }
    return stubEl();
  };
  const hud = {
    game,
    els: {
      menu: get('hud-menu'),
      modal: get('hud-modal'),
      modalTitle: get('hud-modal-title'),
      modalBody: get('hud-modal-body'),
      card: get('hud-card'),
      cardTitle: get('hud-card-title'),
      cardText: get('hud-card-text'),
      cash: get('hud-cash'),
      health: get('hud-health'),
      armour: get('hud-armour'),
      wanted: get('hud-wanted'),
      clock: get('hud-clock'),
      weapon: get('hud-weapon'),
      car: get('hud-car'),
      radio: get('hud-radio'),
      district: get('hud-district'),
      respect: get('hud-respect'),
      mission: get('hud-mission'),
      police: get('hud-police'),
      dialogue: get('hud-dialogue'),
      toast: get('hud-toast'),
      minimap: get('hud-minimap'),
      speed: get('hud-speed'),
      completion: get('hud-completion'),
    },
    last: {}, // what the HUD last showed (for headless tests)
  };
  return hud;
}

// Draw the minimap on a 2D canvas: roads, buildings, water,
// player, mission marker, police, cars, gang turf. Exported so
// the title screen can draw it behind the menu (round-3 fix:
// never leave an empty green box on the title screen).
export function drawMinimap(hud, game) {
  const canvas = hud.els.minimap;
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width || 200;
  const H = canvas.height || 200;
  const scale = W / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(0, 0, W, H);
  // Water (west + harbour).
  ctx.fillStyle = '#1d5a78';
  ctx.fillRect(0, 0, 80 * scale, H);
  ctx.fillRect(0, toZ(320), W, (400 - 320) * scale);
  // Roads.
  ctx.fillStyle = '#333';
  for (let i = -240; i <= 240; i += 60) {
    ctx.fillRect(toX(i) - 3, 0, 6, H);
    ctx.fillRect(0, toZ(i) - 3, W, 6);
  }
  // Buildings.
  ctx.fillStyle = '#888';
  for (const b of game.city.buildings) {
    ctx.fillRect(toX(b.x - b.w / 2), toZ(b.z - b.d / 2), b.w * scale, b.d * scale);
  }
  // Gang turf circles.
  ctx.strokeStyle = 'rgba(240,190,40,0.7)';
  ctx.beginPath();
  ctx.arc(toX(0), toZ(-40), 130 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,180,180,0.7)';
  ctx.beginPath();
  ctx.arc(toX(-180), toZ(180), 120 * scale, 0, Math.PI * 2);
  ctx.stroke();
  // Mission marker.
  if (game.missionMarker) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(toX(game.missionMarker.x), toZ(game.missionMarker.z), 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#3a6cff';
  for (const car of game.copCars) {
    ctx.fillRect(toX(car.x) - 2, toZ(car.z) - 2, 4, 4);
  }
  // Player.
  ctx.fillStyle = '#37e05a';
  ctx.beginPath();
  ctx.arc(toX(game.player.x), toZ(game.player.z), 4, 0, Math.PI * 2);
  ctx.fill();
  hud.last.minimapDrawn = true;
}

// Update every HUD element from the game state. Called once per
// frame. NEVER touches #hud-menu innerHTML.
export function updateHud(hud, game) {
  const e = hud.els;
  // Title menu: visibility only, content is static HTML.
  e.menu.style.display = game.mode === 'menu' ? 'flex' : 'none';
  // Chapter card: centred panel, shown in 'card' and 'passed'.
  if (game.mode === 'card' || game.mode === 'passed') {
    e.card.style.display = 'flex';
    if (game.card) {
      e.cardTitle.textContent = game.card.title;
      e.cardText.textContent = game.card.text;
    }
  } else {
    e.card.style.display = 'none';
  }
  // Modal: food / outfit / garage / busted / wasted.
  if (game.modal) {
    e.modal.style.display = 'block';
    e.modalTitle.textContent = game.modal.title;
    e.modalBody.textContent = game.modal.lines.join('\n');
  } else if (game.mode === 'busted') {
    e.modal.style.display = 'block';
    e.modalTitle.textContent = 'BUSTED';
    e.modalBody.textContent = `${game.bustedBy || 'The police got you.'}\nFine paid. Press Enter to respawn at the hospital.`;
  } else if (game.mode === 'wasted') {
    e.modal.style.display = 'block';
    e.modalTitle.textContent = 'WASTED';
    e.modalBody.textContent = `${game.bustedBy || 'You died.'}\nPress Enter to respawn at the hospital.`;
  } else {
    e.modal.style.display = 'none';
  }
  // Numbers.
  const set = (el, v) => {
    el.textContent = v;
  };
  set(e.cash, `$${game.cash}  (bank $${game.bank})`);
  set(e.health, `HP ${Math.round(game.health)}`);
  set(e.armour, game.armour > 0 ? `Armour ${Math.round(game.armour)}` : '');
  set(e.wanted, '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted));
  const hh = Math.floor(game.clock);
  const mm = Math.floor((game.clock - hh) * 60);
  const pad = (n) => String(n).padStart(2, '0');
  set(e.clock, `Day ${game.day} · ${pad(hh)}:${pad(mm)} · ${phaseAt(game.clock)} · ${game.weather}`);
  const w = game.player.weapon;
  const ammo = game.player.ammo[w] === Infinity ? '∞' : game.player.ammo[w];
  set(e.weapon, `1 Pistol ∞  2 SMG ${game.player.ammo[1]}  3 Shotgun ${game.player.ammo[2]}  — [${['Pistol', 'SMG', 'Shotgun'][w]} ${ammo}]`);
  if (game.player.inCar) {
    const v = game.player.inCar;
    set(e.car, `${v.name} — ${Math.round(Math.abs(v.speed) * 3.6)} km/h — condition ${Math.max(0, 100 - v.damage)}%`);
    set(e.speed, `${Math.round(Math.abs(v.speed) * 3.6)} km/h`);
  } else {
    set(e.car, 'On foot');
    set(e.speed, `${Math.round(game.player.speed * 3.6)} km/h`);
  }
  set(e.radio, stationLabel(game));
  set(e.district, districtAt(game.player.x, game.player.z));
  set(e.respect, `Respect ${game.respect} — ${respectName(game.respect)}`);
  set(e.completion, `Save slot ${game.saveSlot} · ${game.completion}% complete`);
  // Mission panel.
  const ch = game.chapter;
  const missionText = game.chapterDone >= 5
    ? 'Story complete — free roam'
    : `Chapter ${ch} — ${game.missionMarker ? game.missionMarker.label : 'follow the marker'}`;
  set(e.mission, `${missionText}${game.missionTimer > 0 ? ` — ${Math.ceil(game.missionTimer)}s left` : ''}${game.sideJob ? ` · Side: ${game.sideJob.label}` : ''}`);
  // Police response list.
  const list = policeList(game);
  set(e.police, list.length === 0 ? 'No police response' : list.map((u) => `${u.name} ${u.dist}m ${u.status}`).join(' · '));
  // Dialogue box (named NPC + role, 10 s).
  if (game.dialogue && game.dialogue.t > 0) {
    e.dialogue.style.display = 'block';
    set(e.dialogue, `${game.dialogue.name} (${game.dialogue.role}): ${game.dialogue.text}`);
  } else {
    e.dialogue.style.display = 'none';
  }
  // Toast (empty toasts stay hidden — the round-5 black-oval fix
  // is in CSS with :empty, this keeps the text in sync).
  set(e.toast, game.toastTimer > 0 ? game.toast : '');
  // Minimap (also drawn behind the title menu).
  drawMinimap(hud, game);
  hud.last.mode = game.mode;
  hud.last.menuVisible = e.menu.style.display === 'flex';
  hud.last.cash = game.cash;
  hud.last.wanted = game.wanted;
}

function respectName(rep) {
  if (rep >= 1000) return 'Legend';
  if (rep >= 500) return 'Kingpin';
  if (rep >= 250) return 'Shot Caller';
  if (rep >= 100) return 'Hustler';
  return 'Nobody';
}
