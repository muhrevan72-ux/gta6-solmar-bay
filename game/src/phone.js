// Solmar Bay — the smartphone (Tab): map, contacts, messages.
// Contacts: Rico (tips), Maya (dates), Taxi (cab), Mechanic (repairs).

import { SPAWNS } from './config.js';

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Fixer' },
  { id: 'maya', name: 'Maya', role: 'Date' },
  { id: 'taxi', name: 'Solmar Cab', role: 'Taxi' },
  { id: 'mechanic', name: 'Mechanic', role: 'Repairs' },
];

// Returns true when the phone opens, false when it closes or when
// the phone cannot open (title screen).
export function togglePhone(g) {
  if (g.mode === 'menu') return false;
  if (g.mode === 'phone') {
    g.mode = 'play';
    g.phoneOpen = false;
    return false;
  }
  if (g.mode === 'play') {
    g.mode = 'phone';
    g.phoneOpen = true;
    return true;
  }
  return false;
}

export function phoneTab(g, tab) {
  g.phoneTab = tab;
  if (tab === 'messages') {
    g.unread = 0;
    for (const m of g.messages || []) m.read = true;
  }
}

export function notifyMessage(g, name, text) {
  if (!g.messages) g.messages = [];
  g.messages.push({ name, text, read: false });
  g.unread = (g.unread || 0) + 1;
}

export function callContact(g, id) {
  if (id === 'rico') {
    notifyMessage(g, 'Rico', 'Yo! The cops are thick near the harbour tonight. Lay low or bring a fast car.');
    g.dialogue = { name: 'Rico', role: 'Contact', text: 'The cops are thick near the harbour tonight.', t: 10 };
    return true;
  }
  if (id === 'maya') {
    if ((g.maya.rel || 0) >= 75) {
      notifyMessage(g, 'Maya', 'The Sharks are moving product through the harbour at night. Be careful down there.');
      g.dialogue = { name: 'Maya', role: 'Contact', text: 'The Sharks are moving product through the harbour at night.', t: 10 };
    } else {
      notifyMessage(g, 'Maya', 'Hey! Meet me at the beach house when you have time. The sunset is gorgeous there.');
      g.dialogue = { name: 'Maya', role: 'Contact', text: 'Meet me at the beach house when you have time.', t: 10 };
    }
    return true;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    notifyMessage(g, 'Solmar Cab', 'A cab is on its way to you.');
    return true;
  }
  if (id === 'mechanic') {
    const car = g.player.inCar;
    if (!car) {
      notifyMessage(g, 'Mechanic', 'Bring a car to the garage first and I can fix it up.');
      return false;
    }
    if (g.cash < 30) {
      notifyMessage(g, 'Mechanic', 'A full repair is $30. Come back when you have the cash.');
      return false;
    }
    g.cash -= 30;
    car.condition = 100;
    notifyMessage(g, 'Mechanic', 'Good as new. $30, thanks.');
    return true;
  }
  return false;
}
