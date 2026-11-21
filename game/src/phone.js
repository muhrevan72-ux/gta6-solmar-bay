// Solmar Bay — the in-game phone.
//
// Tab opens it; Tab or Escape closes it. Four contacts: Rico (chapter
// tips), Maya (dates), Taxi (call a cab), and the Mechanic (repair the
// car you are sitting in for $30). Messages live on the game object
// (g.messages / g.unread / g.phoneTab) and are mirrored onto g.phone.

import { chapterTitle } from './state.js';

export const CONTACTS = [
  { id: 'rico', name: 'Rico' },
  { id: 'maya', name: 'Maya' },
  { id: 'taxi', name: 'Taxi' },
  { id: 'mechanic', name: 'Mechanic' },
];

export function ensurePhone(g) {
  if (!Array.isArray(g.messages)) g.messages = [];
  if (typeof g.unread !== 'number') g.unread = 0;
  if (typeof g.phoneTab !== 'string') g.phoneTab = 'messages';
  g.phone = { tab: g.phoneTab, unread: g.unread, messages: g.messages };
  return g.phone;
}

export function togglePhone(g) {
  if (g.mode === 'menu' || g.mode === 'card' || g.mode === 'passed' || g.mode === 'busted' || g.mode === 'wasted') {
    return false;
  }
  ensurePhone(g);
  if (g.mode === 'phone') {
    g.mode = 'play';
    g.phoneOpen = false;
    return false;
  }
  g.mode = 'phone';
  g.phoneOpen = true;
  return true;
}

export function phoneTab(g, tab) {
  ensurePhone(g);
  g.phoneTab = tab;
  if (tab === 'messages') g.unread = 0;
  g.phone.tab = tab;
  g.phone.unread = g.unread;
  return true;
}

export function notifyMessage(g, from, text) {
  ensurePhone(g);
  g.messages.push({ from, text });
  g.unread += 1;
  g.phone.unread = g.unread;
  return true;
}

export function callContact(g, id) {
  ensurePhone(g);
  const p = g.player;
  if (id === 'rico') {
    const tip = `Rico: ${chapterTitle(g)} — follow the marker on your map, and keep an eye on your wanted stars.`;
    g.messages.push({ from: 'Rico', text: tip });
    return true;
  }
  if (id === 'maya') {
    const rel = (g.maya && g.maya.rel) || 0;
    const text = rel >= 75
      ? 'Maya: The Sharks are watching the beach tonight. Be careful out there.'
      : 'Maya: Meet me at the beach sometime? I love the sunset there.';
    g.messages.push({ from: 'Maya', text });
    return true;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    g.messages.push({ from: 'Taxi', text: 'Taxi: A cab is on its way to you.' });
    return true;
  }
  if (id === 'mechanic') {
    if (!p.inCar) {
      g.messages.push({ from: 'Mechanic', text: 'Mechanic: Get in your car first, then call me.' });
      return false;
    }
    if (g.cash < 30) {
      g.messages.push({ from: 'Mechanic', text: 'Mechanic: A repair costs $30 — come back when you have it.' });
      return false;
    }
    g.cash -= 30;
    p.inCar.condition = 100;
    g.messages.push({ from: 'Mechanic', text: 'Mechanic: Good as new. That will be $30.' });
    return true;
  }
  return false;
}

export function phoneText(g) {
  ensurePhone(g);
  const lines = [];
  lines.push('PHONE');
  lines.push(`Cash: $${g.cash}`);
  lines.push('Contacts: Rico · Maya · Taxi · Mechanic');
  lines.push('Messages:');
  const msgs = g.messages.slice(-6);
  for (const m of msgs) {
    lines.push(`${m.from}: ${m.text}`);
  }
  if (g.unread > 0) lines.push(`(${g.unread} unread)`);
  lines.push('Press Tab to close');
  return lines.join('\n');
}
