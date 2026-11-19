// Solmar Bay — the HUD.
//
// THE TITLE FIX (play-test #5, Blocker A): the title screen
// (#hud-menu) is STATIC HTML in index.html. updateHud NEVER
// overwrites its innerHTML and NEVER hides it except when the mode
// is not 'menu'. The old build did `menu.innerHTML = ...` for every
// menu and set `menu.style.display = m ? 'block' : 'none'` where m
// was null at boot — so the title was hidden on frame 1 and its
// buttons were destroyed from the DOM (a DOM search for "SOLMAR"
// found nothing). The modal (pause / busted / wasted / mission
// passed) is a SEPARATE element (#hud-modal) driven by
// state.hud.menu, and the chapter intro card is a third element
// (#hud-card), always rendered as a CENTRED flex panel (play-test
// #5: it was left-aligned and overlapped the HUD).
//
// updateHud is DOM-safe: every element access is guarded, so the
// game still runs (and tests still pass) when an element is missing.
// In headless tests the DOM is a stub object (see test-render7 /
// test-qa) — the same code path runs, so the boot test proves the
// real behaviour.

import { RESPECT, districtAt, respectLevel } from './config.js';
import { clockText } from './weather.js';
import { radioNow } from './audio.js';
import { policeResponseList } from './police.js';

export function updateHud(game) {
  const dom = game.dom;
  if (!dom) return;
  const s = game.state;
  // --- title screen: static HTML, shown iff mode === 'menu' ---
  if (dom.menu) {
    dom.menu.style.display = s.mode === 'menu' ? 'flex' : 'none';
    // innerHTML is NEVER touched here. The buttons live in the
    // static HTML and keep working.
  }
  // --- modal: pause / busted / wasted / mission passed ---
  if (dom.modal) {
    if (s.hud.menu) {
      dom.modal.style.display = 'flex';
      dom.modal.innerHTML =
        '<h2>' + s.hud.menu.title + '</h2>' +
        '<p>' + s.hud.menu.body + '</p>' +
        '<p class="hint">' + s.hud.menu.hint + '</p>';
    } else {
      dom.modal.style.display = 'none';
    }
  }
  // --- chapter intro card: a centred panel ---
  if (dom.card) {
    if (s.hud.card) {
      dom.card.style.display = 'flex';
      // The content goes into the .card-inner panel (its CSS centres
      // and borders it); #hud-card itself is only the flex overlay.
      const inner = dom.cardInner || dom.card;
      inner.innerHTML =
        '<h2>' + s.hud.card.title + '</h2>' +
        '<p>' + s.hud.card.text + '</p>' +
        '<p class="hint">Press Enter to start.</p>';
    } else {
      dom.card.style.display = 'none';
    }
  }
  // --- toasts (never an empty black oval: hidden when empty) ---
  if (dom.toast) {
    const texts = s.hud.toasts.map((t) => t.text);
    dom.toast.textContent = texts.join(' · ');
    dom.toast.style.display = texts.length > 0 ? 'block' : 'none';
  }
  // --- dialogue box (named NPC + role) ---
  if (dom.dialogue) {
    if (s.hud.dialogue) {
      dom.dialogue.style.display = 'block';
      dom.dialogue.innerHTML =
        '<b>' + s.hud.dialogue.name + '</b> <span>' + s.hud.dialogue.role + '</span><br>' +
        s.hud.dialogue.text;
    } else {
      dom.dialogue.style.display = 'none';
    }
  }
  if (dom.cash) dom.cash.textContent = '$' + s.cash + ' · Bank $' + s.bank;
  if (dom.health) dom.health.textContent = 'HP ' + Math.round(s.health) + ' · Armour ' + Math.round(s.armour);
  if (dom.wanted) {
    dom.wanted.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
  }
  if (dom.weapons) {
    // Weapon names are proper nouns/acronyms (SMG is an acronym, not
    // title case — the old code rendered "Smg").
    const names = { pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun' };
    const slots = ['pistol', 'smg', 'shotgun'].map((w) => {
      if (!s.weapons[w]) return names[w] + ' —';
      const ammo = s.ammo[w] === Infinity ? '∞' : s.ammo[w];
      const cur = s.weapon === w ? '[' + names[w] + ' ' + ammo + ']' : names[w] + ' ' + ammo;
      return cur;
    });
    dom.weapons.textContent = slots.join(' ');
  }
  if (dom.bombs) dom.bombs.textContent = 'Bombs: ' + s.bombs;
  if (dom.clock) dom.clock.textContent = clockText(game);
  if (dom.radio) {
    const r = radioNow(game.radio);
    dom.radio.textContent = r.station + ' / \'' + r.song + '\'';
  }
  if (dom.respect) {
    dom.respect.textContent = 'REP ' + respectLevel(s.respect).name + ' · ' + s.respect;
  }
  if (dom.location) {
    dom.location.textContent = districtAt(s.player.x, s.player.z) + ' · ' + completionPct(s) + '% complete';
  }
  if (dom.mission) {
    const ch = game.missions;
    const chapter = game.state.chapter;
    const obj = missionObjective(game);
    dom.mission.innerHTML =
      '<b>CH. ' + chapter + '</b> — ' + obj + '<br>' +
      '<span>NEXT: ' + nextHint(game) + '</span>';
  }
  if (dom.police) {
    const list = policeResponseList(game);
    dom.police.innerHTML = list.length === 0
      ? 'No police response'
      : list.map((u) => u.name + ' ' + u.dist + 'm ' + u.status).join('<br>');
  }
  if (dom.car) {
    const car = s.player.inCar;
    if (car) {
      dom.car.textContent = car.name + ' · Condition ' + Math.round(car.condition) + '% · ' + Math.round(Math.abs(car.speed) * 3.6) + ' km/h';
    } else {
      dom.car.textContent = Math.round(s.player.speed * 3.6) + ' km/h';
    }
  }
  if (dom.minimap && dom.minimap.getContext) {
    const ctx = dom.minimap.getContext('2d');
    if (ctx) drawMinimap(game, ctx);
  }
}

function completionPct(s) {
  const story = Math.min(5, s.chapter - 1) * 12;
  const side = Math.min(20, s.stats.sideJobsDone * 4);
  const garage = Math.min(8, s.ownedCars.length * 2);
  const rep = Math.min(12, Math.floor(s.respect / 100));
  return Math.min(100, story + side + garage + rep);
}

function missionObjective(game) {
  const s = game.state;
  const m = game.missions;
  switch (s.chapter) {
    case 1: return m.stage === 0 ? 'Steal a car' : 'Drive to the garage';
    case 2: return 'Deliver the package (' + Math.max(0, Math.ceil(m.timer)) + 's)';
    case 3: return 'Lose the heat (wanted ' + s.wanted + ')';
    case 4: return 'Pick up passengers ' + m.passengers + '/3';
    case 5: return m.stage === 0 ? 'Grab the cash at the harbour' : 'Lose the heat, reach the safehouse';
    default: return 'Free roam';
  }
}

function nextHint(game) {
  const t = game.missions.target;
  if (!t) return '—';
  return t.label + ' (' + Math.round(t.x) + ', ' + Math.round(t.z) + ')';
}

// The round minimap: city grid, beach, downtown, roads, the player
// (white dot), the garage (yellow diamond), the mission target
// (yellow ring), police (red dots), the called taxi (yellow dot).
export function drawMinimap(game, ctx) {
  const W = 140, H = 140;
  const scale = W / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#16222e';
  ctx.fillRect(0, 0, W, H);
  // Beach + water (west).
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(toX(-400), 0, 80 * scale, H);
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(toX(-400), 0, 20 * scale, H);
  // Downtown.
  ctx.fillStyle = '#3a3a22';
  ctx.fillRect(toX(-100), toZ(-300), 300 * scale, 400 * scale);
  // Roads.
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  for (const r of game.city.roads) {
    ctx.beginPath();
    if (r.vertical) { ctx.moveTo(toX(r.coord), 0); ctx.lineTo(toX(r.coord), H); }
    else { ctx.moveTo(0, toZ(r.coord)); ctx.lineTo(W, toZ(r.coord)); }
    ctx.stroke();
  }
  // Mission target.
  const t = game.missions.target;
  if (t) {
    ctx.strokeStyle = '#f5d020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(t.x), toZ(t.z), 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Garage.
  ctx.fillStyle = '#f5a623';
  const gx = toX(150), gz = toZ(-150);
  ctx.beginPath();
  ctx.moveTo(gx, gz - 4); ctx.lineTo(gx + 4, gz); ctx.lineTo(gx, gz + 4); ctx.lineTo(gx - 4, gz);
  ctx.fill();
  // Police (red dots).
  ctx.fillStyle = '#ff3030';
  for (const c of game.police.cars) {
    ctx.fillRect(toX(c.x) - 1.5, toZ(c.z) - 1.5, 3, 3);
  }
  for (const c of game.police.cops) {
    ctx.fillRect(toX(c.x) - 1, toZ(c.z) - 1, 2, 2);
  }
  // Called taxi (yellow dot).
  if (game.taxi.called) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(toX(game.taxi.called.x), toZ(game.taxi.called.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player (white dot).
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(toX(game.state.player.x), toZ(game.state.player.z), 3, 0, Math.PI * 2);
  ctx.fill();
}
