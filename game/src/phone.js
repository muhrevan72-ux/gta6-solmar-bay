// Solmar Bay — the smartphone (Tab).
//
// A DOM panel with three tabs: Contacts, Messages, Map. The world
// keeps running while it is open. While open, E/F/G and weapon
// switching are blocked (the player is looking at the phone); Esc
// closes the phone before it pauses the game.
//
// Contacts: Taxi Co. (Digit 4 calls a taxi), Maya (Digit 5), Rico
// (Digit 6). Mission notifications arrive as messages with an unread
// badge. The Map tab shows the city (the same data the HUD minimap
// draws, at a larger scale).

import { showToast } from './state.js';
import { callTaxi } from './taxi.js';
import { callDateNPC } from './dating.js';

export function createPhone() {
  return {
    open: false,
    tab: 'contacts', // contacts | messages | map
    messages: [], // {from, text, read}
    unread: 0,
  };
}

export function togglePhone(game) {
  const ph = game.phone;
  ph.open = !ph.open;
  if (ph.open) {
    ph.unread = 0;
    for (const m of ph.messages) m.read = true;
  }
  return ph.open;
}

export function phoneMessage(game, from, text) {
  const ph = game.phone;
  ph.messages.push({ from, text, read: false });
  ph.unread++;
  showToast(game.state, 'Phone: ' + from + ' — ' + text, 5);
}

// Digit keys while the phone is open: 4 taxi, 5 Maya, 6 Rico.
export function phoneDigit(game, digit) {
  if (digit === 4) {
    callTaxi(game);
  } else if (digit === 5) {
    callDateNPC(game, 'Maya');
  } else if (digit === 6) {
    callDateNPC(game, 'Rico');
  }
}

// Render the phone panel into the DOM. Called every frame while the
// panel exists; a no-op in headless (no document).
export function renderPhone(game, el) {
  if (typeof document === 'undefined' || !el) return;
  const ph = game.phone;
  if (!ph.open) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  const tabBtn = (id, label) =>
    '<button data-tab="' + id + '" style="flex:1;padding:6px;background:' +
    (ph.tab === id ? '#f5a623' : '#333') + ';color:#fff;border:none;cursor:pointer">' + label + '</button>';
  let body = '';
  if (ph.tab === 'contacts') {
    body = '<div>4 — Taxi Co. (call a cab)</div><div>5 — Maya (lifeguard)</div><div>6 — Rico (mechanic)</div>';
  } else if (ph.tab === 'messages') {
    body = ph.messages.length === 0
      ? '<div>No messages yet.</div>'
      : ph.messages.slice(-6).map((m) => '<div><b>' + m.from + ':</b> ' + m.text + '</div>').join('');
  } else {
    body = '<div style="font-size:11px">Map — blue: beach west · yellow: downtown · ◆ garage · ● you</div>' +
      '<canvas id="phone-map" width="220" height="220" style="background:#1a2a3a"></canvas>';
  }
  el.innerHTML =
    '<div style="background:#111;color:#fff;padding:10px;border-radius:8px;width:240px">' +
    '<div style="display:flex;gap:4px;margin-bottom:8px">' +
    tabBtn('contacts', 'Contacts') + tabBtn('messages', 'Messages' + (ph.unread > 0 ? ' (' + ph.unread + ')' : '')) + tabBtn('map', 'Map') +
    '</div>' + body + '<div style="margin-top:8px;font-size:11px;color:#aaa">Tab — close · Esc — close</div></div>';
  // Wire the tab buttons.
  el.querySelectorAll('button[data-tab]').forEach((b) => {
    b.onclick = () => { ph.tab = b.getAttribute('data-tab'); renderPhone(game, el); };
  });
  // Draw the map tab's canvas.
  if (ph.tab === 'map') {
    const cv = el.querySelector('#phone-map');
    if (cv) drawPhoneMap(game, cv);
  }
}

function drawPhoneMap(game, cv) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = cv.width, H = cv.height;
  const scale = W / 800;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(0, 0, W, H);
  // Beach (west) + harbour basin.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(toX(-400), toZ(-400), 80 * scale, 800 * scale);
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(toX(-400), toZ(-400), 20 * scale, 800 * scale);
  // Downtown.
  ctx.fillStyle = '#e8c832';
  ctx.fillRect(toX(-100), toZ(-300), 300 * scale, 400 * scale);
  // Roads.
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (const r of game.city.roads) {
    ctx.beginPath();
    if (r.vertical) { ctx.moveTo(toX(r.coord), 0); ctx.lineTo(toX(r.coord), H); }
    else { ctx.moveTo(0, toZ(r.coord)); ctx.lineTo(W, toZ(r.coord)); }
    ctx.stroke();
  }
  // Garage diamond.
  ctx.fillStyle = '#f5a623';
  const gx = toX(150), gz = toZ(-150);
  ctx.beginPath();
  ctx.moveTo(gx, gz - 6); ctx.lineTo(gx + 6, gz); ctx.lineTo(gx, gz + 6); ctx.lineTo(gx - 6, gz);
  ctx.fill();
  // Player dot.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(toX(game.state.player.x), toZ(game.state.player.z), 4, 0, Math.PI * 2);
  ctx.fill();
}
