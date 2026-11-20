// Solmar Bay — HUD.
//
// The in-game HUD is static HTML (index.html) plus this updater.
// RULE (play-test #5): the JS only flips display and writes
// textContent — it never writes innerHTML into #hud-menu, because
// overwriting the menu destroyed SOLMAR BAY + the buttons from
// the DOM.
//
// PAUSE (round-9 fix, after play-test #7): the pause state
// machine already worked (Escape toggled mode play <-> pause),
// but updateHud showed NO pause overlay at all — no PAUSED text,
// no Resume button — so the player saw nothing change and
// reported "Escape does not open pause". updateHud now shows a
// dedicated #hud-pause overlay (PAUSED + Resume button) whenever
// mode === 'pause', and the HUD pause button (#btn-pause) toggles
// pause as a fallback in case the browser swallows Escape.

import { respectLevel, CHAPTERS } from './config.js';
import { stationLabel } from './audio.js';
import { policeList } from './police.js';
import { districtAt } from './world.js';

export function createHud(doc) {
  const $ = (id) => (doc ? doc.getElementById(id) : null);
  return {
    doc,
    el: {
      menu: $('hud-menu'),
      card: $('hud-card'),
      cardTitle: $('hud-card-title'),
      cardText: $('hud-card-text'),
      modal: $('hud-modal'),
      modalTitle: $('hud-modal-title'),
      modalBody: $('hud-modal-body'),
      pause: $('hud-pause'),
      hud: $('hud'),
      cash: $('hud-cash'),
      health: $('hud-health'),
      armour: $('hud-armour'),
      wanted: $('hud-wanted'),
      clock: $('hud-clock'),
      respect: $('hud-respect'),
      completion: $('hud-completion'),
      mission: $('hud-mission'),
      police: $('hud-police'),
      district: $('hud-district'),
      speed: $('hud-speed'),
      weapon: $('hud-weapon'),
      car: $('hud-car'),
      radio: $('hud-radio'),
      dialogue: $('hud-dialogue'),
      toast: $('hud-toast'),
      minimap: $('hud-minimap'),
      phone: $('hud-phone'),
      phoneBody: $('hud-phone-body'),
      err: $('hud-err'),
    },
  };
}

// Round minimap: roads, buildings, player, mission marker, taxi.
export function drawMinimap(game, hud) {
  const cv = hud.el.minimap;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const S = 200;
  const scale = S / 800;
  const toMap = (x, z) => [(x + 400) * scale, (z + 400) * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(0, 0, S, S);
  // Sea + beach.
  ctx.fillStyle = '#1d4a66';
  ctx.fillRect(0, 0, 20 * scale * 4, S);
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(20 * scale * 4, 0, 15 * scale * 4, S);
  // Roads.
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 3;
  for (const r of game.city.roads) {
    const [x1, y1] = toMap(-400, r);
    const [x2, y2] = toMap(400, r);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const [x3, y3] = toMap(r, -400);
    const [x4, y4] = toMap(r, 400);
    ctx.beginPath();
    ctx.moveTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#888';
  for (const b of game.city.buildings) {
    const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
    ctx.fillRect(x, y, b.w * scale, b.d * scale);
  }
  // Mission marker.
  if (game.missionMarker) {
    const [x, y] = toMap(game.missionMarker.x, game.missionMarker.z);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Taxi cab.
  if (game._taxiCab) {
    const [x, y] = toMap(game._taxiCab.x, game._taxiCab.z);
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  // Player.
  const [px, py] = toMap(game.player.x, game.player.z);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.stroke();
}

export function updateHud(game, hud) {
  const el = hud.el;
  const set = (node, text) => {
    if (node) node.textContent = text;
  };
  const show = (node, on, display) => {
    if (node) node.style.display = on ? display || 'block' : 'none';
  };
  // Title menu only in menu mode.
  show(el.menu, game.mode === 'menu', 'flex');
  // Chapter card (centred panel) in card/passed modes.
  const cardOn = (game.mode === 'card' || game.mode === 'passed') && !!game.card;
  show(el.card, cardOn, 'flex');
  if (cardOn) {
    set(el.cardTitle, game.card.title);
    set(el.cardText, game.card.text);
  }
  // Modal: food / outfit / garage / busted / wasted / ATM.
  const modalOn = !!game.modal;
  show(el.modal, modalOn);
  if (modalOn) {
    set(el.modalTitle, game.modal.title);
    set(el.modalBody, game.modal.lines.join('\n'));
  }
  // PAUSE OVERLAY (round-9 fix): visible whenever mode === 'pause'.
  show(el.pause, game.mode === 'pause', 'flex');
  // In-game HUD: hidden on the title screen.
  show(el.hud, game.mode !== 'menu');
  // Phone overlay.
  show(el.phone, game.mode === 'phone');
  if (game.mode === 'phone' && el.phoneBody) {
    if (game.phoneTab === 'contacts') {
      el.phoneBody.textContent = 'Contacts: Rico (Boss), Maya (Date), Solmar Cab (Taxi), Manny (Mechanic). Press 1-4 to call.';
    } else if (game.phoneTab === 'messages') {
      el.phoneBody.textContent = game.messages.length
        ? game.messages.slice(-5).map((m) => `${m.from}: ${m.text}`).join('\n')
        : '(No messages yet.)';
    } else {
      el.phoneBody.textContent = 'Map — see the minimap. Your marker is the white dot.';
    }
  }
  // Top-left block.
  set(el.cash, `$${game.cash} (bank $${game.bank})`);
  set(el.health, `HP ${Math.round(game.health)}`);
  set(el.armour, game.armour > 0 ? `Armour ${Math.round(game.armour)}` : '');
  set(el.wanted, game.wanted > 0 ? '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted) : '☆☆☆☆☆');
  const hh = String(Math.floor(game.clock)).padStart(2, '0');
  const mm = String(Math.floor((game.clock % 1) * 60)).padStart(2, '0');
  set(el.clock, `Day ${game.day} · ${hh}:${mm} · ${game._phase || ''} · ${game.weather}`);
  const rl = respectLevel(game.respect);
  set(el.respect, `Respect ${game.respect} — ${rl.name}${rl.next ? ` (next: ${rl.next} at ${rl.nextMin})` : ''}`);
  set(el.completion, `Save slot ${game.saveSlot} · ${game.completion}% complete`);
  // Mission panel (centred top).
  const ch = CHAPTERS[game.chapter - 1];
  let missionText = '';
  if (ch && game.chapter <= CHAPTERS.length) {
    missionText = `${ch.title} — ${ch.objective}`;
    if (game.missionTimer > 0) missionText += ` · ${Math.ceil(game.missionTimer)}s`;
  } else {
    missionText = 'Free Roam — explore Solmar Bay';
  }
  if (game.sideJob) missionText += ` · ${game.sideJob.label}`;
  set(el.mission, missionText);
  // Police response list.
  set(el.police, policeList(game).join(' · '));
  // Right block.
  set(el.district, districtAt(game.player.x, game.player.z));
  const speedKmh = Math.round(Math.abs(game.player.inCar ? game.player.inCar.speed : game.player.speed) * 3.6);
  set(el.speed, `${speedKmh} km/h`);
  // Bottom block.
  const weapons = ['Pistol', 'SMG', 'Shotgun'];
  const ammo = game.player.ammo.map((a) => (a === Infinity ? '∞' : a)).join(' ');
  set(el.weapon, `1 Pistol 2 SMG 3 Shotgun — [${weapons[game.player.weapon]} ${game.player.ammo[game.player.weapon] === Infinity ? '∞' : game.player.ammo[game.player.weapon]}]`);
  set(el.car, game.player.inCar ? `${game.player.inCar.name} · Condition ${Math.round(game.player.inCar.condition)}%` : 'On foot');
  set(el.radio, stationLabel(game.station, game.song));
  // Dialogue box.
  const dlgOn = !!game.dialogue && game.dialogue.t > 0;
  show(el.dialogue, dlgOn);
  if (dlgOn) set(el.dialogue, `${game.dialogue.name} (${game.dialogue.role}): ${game.dialogue.text}`);
  // Toast.
  set(el.toast, game.toastTimer > 0 ? game.toast : '');
  drawMinimap(game, hud);
}
