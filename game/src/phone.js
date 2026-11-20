// Solmar Bay — smartphone.
//
// Tab opens the phone: Contacts, Messages, Map. Contacts: Rico
// (missions), Maya (dating), Taxi (call a cab), Mechanic (repair
// the car for $30). Calling the taxi dispatches a cab that drives
// to the player; get in with E. Messages arrive from the story
// and from Maya.

import { showToast } from './state.js';
import { dist } from './config.js';

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Boss' },
  { id: 'maya', name: 'Maya', role: 'Date' },
  { id: 'taxi', name: 'Solmar Cab', role: 'Taxi' },
  { id: 'mechanic', name: 'Manny', role: 'Mechanic' },
];

export function togglePhone(game) {
  if (game.mode === 'phone') {
    game.mode = 'play';
    game.phoneOpen = false;
    return false;
  }
  if (game.mode === 'play') {
    game.mode = 'phone';
    game.phoneOpen = true;
    game.phoneTab = 'contacts';
    return true;
  }
  return false;
}

export function phoneTab(game, tab) {
  game.phoneTab = tab;
  if (tab === 'messages') game.unread = 0;
}

export function callContact(game, id) {
  if (id === 'rico') {
    const c = game.chapter;
    const tips = [
      'Steal a car and bring it to the garage on Bay Street.',
      'Pick up the package at the harbour. Timer is running.',
      'Lose the heat. Hide, outrun, outsmart.',
      'Three passengers tonight. Be nice, get tips.',
      'The harbour vault. Grab the cash, lose four stars, reach the safehouse.',
    ];
    game.messages.push({ from: 'Rico', text: tips[c - 1] || 'Free roam, kid. Make money.', t: game.time });
    return true;
  }
  if (id === 'maya') {
    if (game.maya.rel >= 75) {
      game.messages.push({ from: 'Maya', text: 'I heard the Sharks are moving goods through the harbour tonight.', t: game.time });
    } else {
      game.messages.push({ from: 'Maya', text: 'Come find me at the beach house when you have time.', t: game.time });
    }
    return true;
  }
  if (id === 'taxi') {
    // Dispatch a cab (taxi.js does the driving).
    game._taxiRequested = true;
    showToast(game, 'Taxi called — a cab is on its way.');
    return true;
  }
  if (id === 'mechanic') {
    const p = game.player;
    if (!p.inCar) {
      showToast(game, 'Manny: bring a car to me first.');
      return false;
    }
    if (game.cash < 30) {
      showToast(game, 'Manny charges $30 for a repair.');
      return false;
    }
    game.cash -= 30;
    p.inCar.condition = 100;
    showToast(game, 'Manny: good as new. $30.');
    return true;
  }
  return false;
}

export function notifyMessage(game, from, text) {
  game.messages.push({ from, text, t: game.time });
  game.unread += 1;
  if (game.audio) game.audio.sfx('phone');
}
