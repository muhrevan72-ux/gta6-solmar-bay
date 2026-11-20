// Solmar Bay — smartphone (Tab).
//
// A DOM phone UI with contacts (call a taxi to your location,
// call Maya, call Rico), messages (mission notifications arrive
// as messages) and a big map view. Opening the phone pauses the
// world for the player but the world keeps running (peds keep
// walking — the round-5 flaky test caught the phone freezing
// them). The phone is a DOM overlay; hud.js renders it.

import { showToast } from './state.js';

export const CONTACTS = [
  { key: '4', name: 'Taxi', desc: 'Call a cab to your location' },
  { key: '5', name: 'Maya', desc: 'Your girl — date ideas' },
  { key: '6', name: 'Rico', desc: 'Your fixer — mission tips' },
];

export function togglePhone(game) {
  if (game.mode === 'play') {
    game.phoneOpen = true;
    game.mode = 'phone';
    game.phoneTab = 'contacts';
    return true;
  }
  if (game.mode === 'phone') {
    game.phoneOpen = false;
    game.mode = 'play';
    return true;
  }
  return false;
}

export function phoneTab(game, tab) {
  if (game.mode !== 'phone') return false;
  game.phoneTab = tab;
  game.unread = tab === 'messages' ? 0 : game.unread;
  return true;
}

// Call contact by number key (4 = taxi, 5 = Maya, 6 = Rico).
export function callContact(game, key) {
  if (game.mode !== 'phone') return false;
  if (key === '4') {
    // Taxi: the taxi system spawns a cab that drives to the player.
    game.taxiCalled = true;
    showToast(game, 'Taxi called — a cab is on its way');
    game.messages.push({ from: 'Taxi', text: 'Cab dispatched to your location.' });
    return 'taxi';
  }
  if (key === '5') {
    game.messages.push({ from: 'Maya', text: 'Hey! Come see me at the beach house sometime. x' });
    showToast(game, 'Maya: come see me at the beach house');
    return 'maya';
  }
  if (key === '6') {
    const tip = game.chapter === 1
      ? 'Rico: steal any car and bring it to the garage on Bay Street.'
      : game.chapter === 5
        ? 'Rico: the vault container is at the harbour. Be quick.'
        : 'Rico: keep your head down and watch the stars.';
    game.messages.push({ from: 'Rico', text: tip });
    showToast(game, 'Rico texted you a tip');
    return 'rico';
  }
  return false;
}

// A mission notification arrives as a phone message.
export function notifyMessage(game, from, text) {
  game.messages.push({ from, text });
  game.unread += 1;
}
