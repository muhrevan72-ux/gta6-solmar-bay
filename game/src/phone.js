// Solmar Bay — smartphone: a DOM phone UI with contacts, messages
// and a big map view.
//
// Toggle with Tab. Contacts: call a taxi to your location, call
// Maya, call Rico. Messages: mission notifications arrive here.
// The map tab shows the city + markers. The world keeps running
// while the phone is open; E/F/G/weapon switching is blocked while
// it is open; Esc closes the phone before pausing.
// Pure logic here — the DOM panel is wired in main.js.

import { showToast, showDialogue } from './state.js';

export function createPhone() {
  return {
    open: false,
    tab: 'contacts', // contacts | messages | map
    contacts: [
      { name: 'Taxi', role: 'Bay Taxi Co.' },
      { name: 'Maya', role: 'Girlfriend' },
      { name: 'Rico', role: 'Crew boss' },
    ],
    messages: [], // {from, text, t, unread}
    unread: 0,
    pendingTaxi: false, // set by callContact; main.js starts the fare
  };
}

// Mission notifications arrive as messages with an unread badge.
export function notifyPhone(game, from, text) {
  const ph = game.phone;
  ph.messages.unshift({ from, text, t: game.state.clock, unread: true });
  if (ph.messages.length > 20) ph.messages.pop();
  ph.unread++;
}

export function openPhone(game) {
  game.phone.open = true;
}

export function closePhone(game) {
  game.phone.open = false;
}

export function togglePhone(game) {
  game.phone.open = !game.phone.open;
  return game.phone.open;
}

export function readMessages(game) {
  for (const m of game.phone.messages) m.unread = false;
  game.phone.unread = 0;
}

export function callContact(game, name) {
  const s = game.state;
  if (name === 'Taxi') {
    // The fare starts from the phone: a taxi is dispatched to the
    // player's location.
    game.phone.pendingTaxi = true;
    showToast(s, 'Taxi called — it is on its way to you.', 3);
    return true;
  }
  if (name === 'Maya') {
    if (game.dating.onDate) {
      showDialogue(s, 'Maya', 'Girlfriend', 'I\'m right here with you, silly!', 4);
    } else {
      showDialogue(s, 'Maya', 'Girlfriend', 'Hey! Come find me at the beach house when you\'re free.', 5);
    }
    return true;
  }
  if (name === 'Rico') {
    const ch = game.missions.chapter;
    const tip = ch <= 5
      ? 'Chapter ' + ch + ' is open. Follow the yellow marker on your minimap.'
      : 'Story\'s done, kid. The city is yours — go make money.';
    showDialogue(s, 'Rico', 'Crew boss', tip, 5);
    return true;
  }
  return false;
}

// The phone's map data (for the map tab + the minimap): markers.
export function phoneMapData(game) {
  const m = game.missions;
  const markers = [];
  if (m.marker) markers.push({ x: m.marker.x, z: m.marker.z, label: m.marker.label, kind: 'mission' });
  if (m.active) markers.push({ x: m.active.x, z: m.active.z, label: m.active.label, kind: 'job' });
  if (game.taxi.fare) markers.push({ x: game.taxi.fare.dx, z: game.taxi.fare.dz, label: 'Fare drop-off', kind: 'taxi' });
  if (game.events.active) markers.push({ x: game.events.active.x, z: game.events.active.z, label: 'Event', kind: 'event' });
  return {
    player: { x: game.state.player.x, z: game.state.player.z },
    markers,
    police: game.police.cops.map((c) => ({ x: c.x, z: c.z })),
  };
}
