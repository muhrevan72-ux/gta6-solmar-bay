// Solmar Bay — smartphone: a DOM phone UI (Tab to toggle) with
// contacts, messages and a big map. The world keeps running while
// the phone is open (like a real phone); E/F/G and shop menus are
// blocked while it is open so inputs never double-fire.
// Node-safe: all DOM work is guarded, the logic works headless.

import { showToast } from './state.js';
import { drawMinimap } from './hud.js';
import { callTaxiTo } from './taxi.js';

export function createPhone() {
  return {
    open: false,
    tab: 'contacts', // contacts | messages | map
    messages: [], // { from, text, t } newest last
    unread: 0,
  };
}

// Mission / system notifications arrive here as messages.
export function notifyPhone(game, from, text) {
  const phone = game.phone;
  if (!phone) return;
  phone.messages.push({ from, text, t: game.state.time });
  if (phone.messages.length > 30) phone.messages.shift();
  if (!phone.open || phone.tab !== 'messages') phone.unread += 1;
  if (phone.open) renderPhone(game);
}

export function openPhone(game) {
  const phone = game.phone;
  if (!phone || phone.open) return;
  phone.open = true;
  phone.unread = 0;
  renderPhone(game);
}

export function closePhone(game) {
  const phone = game.phone;
  if (!phone || !phone.open) return;
  phone.open = false;
  renderPhone(game);
}

export function togglePhone(game) {
  const phone = game.phone;
  if (!phone) return;
  if (phone.open) closePhone(game);
  else openPhone(game);
}

export function setPhoneTab(game, tab) {
  const phone = game.phone;
  if (!phone) return;
  phone.tab = tab;
  if (tab === 'messages') phone.unread = 0;
  renderPhone(game);
}

// --- contacts ---
export function callTaxi(game) {
  const p = game.player;
  if (game.taxi && game.taxi.called) {
    showToast(game.state, 'A taxi is already on its way to you.', 2);
    return false;
  }
  const veh = callTaxiTo(game, p.x, p.z);
  if (!veh) return false;
  notifyPhone(game, 'Taxi Co.', 'Your cab is on its way. Look for the yellow taxi.');
  showToast(game.state, 'Taxi called — it is driving to you.', 3);
  if (game.audio) game.audio.play('mission');
  return true;
}

export function callMaya(game) {
  const d = game.dating;
  if (d && d.onDate) {
    notifyPhone(game, 'Maya', 'I am waiting for you! Hurry up ♥');
  } else if (game.state.relationship > 0) {
    notifyPhone(game, 'Maya', 'Hey! Come see me at the beach house when you are free ♥');
  } else {
    notifyPhone(game, 'Maya', 'Who is this? Come find me at the beach house, by the sea.');
  }
  showToast(game.state, 'Called Maya.', 2);
  return true;
}

export function callRico(game) {
  const ch = game.state.chapter;
  const objectives = [
    'Steal a car and drive to the garage.',
    'Pick up the package, deliver it before time runs out.',
    'Escape the 3-star wanted level.',
    'Pick up 3 passengers and drop them off.',
    'Grab the cash, lose the heat, reach the safehouse.',
  ];
  const text = ch > 5
    ? 'Free roam, kid. Side jobs still pay — taxi, courier, turf. Stay sharp.'
    : 'Rico: ' + objectives[ch - 1] + ' Call me if you get stuck.';
  notifyPhone(game, 'Rico', text);
  showToast(game.state, 'Called Rico.', 2);
  return true;
}

// Digit keys while the phone is open. Returns true if a key was used.
export function handlePhoneKeys(game) {
  const input = game.input;
  const phone = game.phone;
  if (!phone || !phone.open) return false;
  if (input.pressedKey('Digit1')) { setPhoneTab(game, 'contacts'); return true; }
  if (input.pressedKey('Digit2')) { setPhoneTab(game, 'messages'); return true; }
  if (input.pressedKey('Digit3')) { setPhoneTab(game, 'map'); return true; }
  if (phone.tab === 'contacts') {
    if (input.pressedKey('Digit4')) { callTaxi(game); return true; }
    if (input.pressedKey('Digit5')) { callMaya(game); return true; }
    if (input.pressedKey('Digit6')) { callRico(game); return true; }
  }
  return false;
}

// --- DOM rendering (no-op without a document) ---
export function renderPhone(game) {
  const phone = game.phone;
  const hud = game.hud;
  if (!phone || !hud || !hud.doc) return;
  const panel = hud.doc.getElementById('phone');
  if (!panel) return;
  panel.style.display = phone.open ? 'block' : 'none';
  if (!phone.open) return;
  const body = hud.doc.getElementById('phone-body');
  const tabs = hud.doc.getElementById('phone-tabs');
  if (tabs) {
    const unread = phone.unread > 0 ? ' (' + phone.unread + ')' : '';
    tabs.innerHTML =
      '<button data-tab="contacts">Contacts</button>' +
      '<button data-tab="messages">Messages' + unread + '</button>' +
      '<button data-tab="map">Map</button>';
    const btns = tabs.querySelectorAll ? tabs.querySelectorAll('button') : [];
    for (const b of btns) {
      b.addEventListener('click', () => setPhoneTab(game, b.getAttribute('data-tab')));
    }
  }
  if (!body) return;
  if (phone.tab === 'contacts') {
    body.innerHTML =
      '<div class="phone-row"><b>Taxi Co.</b><button data-call="taxi">Call</button></div>' +
      '<div class="phone-row"><b>Maya</b> ' + (game.state.relationship > 0 ? '♥ ' + Math.round(game.state.relationship) + '%' : '') + '<button data-call="maya">Call</button></div>' +
      '<div class="phone-row"><b>Rico</b><button data-call="rico">Call</button></div>' +
      '<div class="phone-hint">Keys: 4 taxi · 5 Maya · 6 Rico · 1/2/3 tabs · Esc close</div>';
  } else if (phone.tab === 'messages') {
    if (!phone.messages.length) {
      body.innerHTML = '<div class="phone-empty">No messages yet. Mission updates arrive here.</div>';
    } else {
      body.innerHTML = phone.messages.slice(-8).reverse().map((m) =>
        '<div class="phone-msg"><b>' + escapeHtml(m.from) + ':</b> ' + escapeHtml(m.text) + '</div>').join('');
    }
  } else {
    body.innerHTML = '<canvas id="phone-map" width="280" height="280"></canvas>';
    const c = hud.doc.getElementById('phone-map');
    if (c && c.getContext) drawMinimap(game, c.getContext('2d'), 280);
  }
  const calls = body.querySelectorAll ? body.querySelectorAll('[data-call]') : [];
  for (const b of calls) {
    b.addEventListener('click', () => {
      const who = b.getAttribute('data-call');
      if (who === 'taxi') callTaxi(game);
      else if (who === 'maya') callMaya(game);
      else if (who === 'rico') callRico(game);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
