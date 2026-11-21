// Solmar Bay — the in-game phone.
// Tab opens a visible panel (top-right, dark, gold border) with
// contacts, messages and cash. Tab, Escape and the Pause button
// all close it; it never traps the game.

import { CHAPTERS } from './config.js';

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Fixer' },
  { id: 'maya', name: 'Maya', role: 'Beach House' },
  { id: 'taxi', name: 'Taxi', role: 'Solmar Cab' },
  { id: 'mechanic', name: 'Mechanic', role: 'Garage' },
];

export function togglePhone(g) {
  if (g.mode === 'menu') return false;
  if (g.phoneOpen) {
    g.phoneOpen = false;
    g.mode = 'play';
    return false;
  }
  g.phoneOpen = true;
  g.mode = 'phone';
  return true;
}

export function phoneTab(g, tab) {
  g.phoneTab = tab;
  if (tab === 'messages') g.unread = 0;
  return tab;
}

export function notifyMessage(g, from, text) {
  g.messages.push({ from, text });
  g.unread++;
  return g.messages.length;
}

const RICO_TIPS = [
  'Steal a car and bring it to the garage — that is chapter 1, kid.',
  'The package is at the harbour. Pick it up, deliver it to the hideout, and do not be slow.',
  'The cops are on you. Break line of sight and lay low until the stars fade.',
  'Three passengers tonight. Pick them all up and the money is yours.',
  'The harbour vault. Grab the cash, lose the heat, reach the safehouse clean.',
];

export function callContact(g, id) {
  if (id === 'rico') {
    const tip = RICO_TIPS[Math.max(0, Math.min(RICO_TIPS.length - 1, g.chapter - 1))];
    g.messages.push({ from: 'Rico', text: tip });
    g.unread++;
    return true;
  }
  if (id === 'maya') {
    if (g.maya.rel >= 75) {
      g.messages.push({ from: 'Maya', text: 'The Sharks are moving on the harbour tonight. Stay away from the docks after dark.' });
    } else {
      g.messages.push({ from: 'Maya', text: 'Come find me at the beach house when you are free. The sunset is beautiful here.' });
    }
    g.unread++;
    return true;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    g.messages.push({ from: 'Taxi', text: 'Cab on its way to your location.' });
    g.unread++;
    return true;
  }
  if (id === 'mechanic') {
    const car = g.player.inCar;
    if (!car) return false;
    if (car.condition >= 100) return false;
    if (g.cash < 30) return false;
    g.cash -= 30;
    car.condition = 100;
    g.messages.push({ from: 'Mechanic', text: 'Car repaired to full condition. That will be $30.' });
    g.unread++;
    return true;
  }
  return false;
}

export function phoneText(g) {
  const lines = [];
  lines.push('PHONE — Solmar Bay');
  lines.push(`Cash $${g.cash}`);
  lines.push('');
  lines.push('Contacts:');
  for (const c of CONTACTS) lines.push(`  ${c.name} — ${c.role}`);
  lines.push('');
  lines.push('Messages:');
  if (g.messages.length === 0) lines.push('  (no messages yet)');
  for (const m of g.messages.slice(-5)) lines.push(`  ${m.from}: ${m.text}`);
  if (g.unread > 0) lines.push(`  (${g.unread} unread)`);
  lines.push('');
  lines.push('Tab / Esc to close');
  return lines.join('\n');
}
