// Solmar Bay — the in-game phone: contacts, messages, calls.
// Written fresh for rebuild #18.

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Fixer' },
  { id: 'maya', name: 'Maya', role: 'Date' },
  { id: 'taxi', name: 'Taxi', role: 'Solmar Cab' },
  { id: 'mechanic', name: 'Mechanic', role: 'Repairs' },
];

export function togglePhone(g) {
  if (g.mode === 'menu' || g.mode === 'card' || g.mode === 'passed') return false;
  if (g.phoneOpen) {
    g.phoneOpen = false;
    g.mode = 'play';
    return false;
  }
  g.phoneOpen = true;
  g.mode = 'phone';
  if (!g.phoneTab) g.phoneTab = 'messages';
  return true;
}

export function phoneTab(g, tab) {
  g.phoneTab = tab;
  if (tab === 'messages') g.unread = 0;
}

export function notifyMessage(g, from, text) {
  if (!g.messages) g.messages = [];
  g.messages.push({ from, text });
  g.unread = (g.unread || 0) + 1;
  return g.messages[g.messages.length - 1];
}

export function callContact(g, id) {
  if (id === 'rico') {
    const tip = 'Rico: the garage is east of downtown. Bring the Comet in one piece and the next job is yours.';
    notifyMessage(g, 'Rico', tip);
    return tip;
  }
  if (id === 'maya') {
    const rel = g.maya ? (g.maya.rel || 0) : 0;
    if (rel >= 75) {
      const msg = 'Maya: the Sharks are moving on the harbour tonight. Stay away from the docks, okay?';
      notifyMessage(g, 'Maya', msg);
      return msg;
    }
    const msg = 'Maya: meet me at the beach when you are free. I will be by the water.';
    notifyMessage(g, 'Maya', msg);
    return msg;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    const msg = 'Taxi: a cab is on its way to you.';
    notifyMessage(g, 'Taxi', msg);
    return msg;
  }
  if (id === 'mechanic') {
    const v = g.player ? g.player.inCar : null;
    if (!v) return false;
    if ((g.cash || 0) < 30) return false;
    g.cash -= 30;
    v.condition = 100;
    const msg = 'Mechanic: good as new. $30, please.';
    notifyMessage(g, 'Mechanic', msg);
    return msg;
  }
  return false;
}

export function phoneText(g) {
  const lines = [];
  lines.push('PHONE');
  lines.push('Contacts: Rico, Maya, Taxi, Mechanic');
  lines.push(`Cash: $${g.cash}`);
  lines.push(`Day ${g.day} · ${String(Math.floor(g.clock || 8)).padStart(2, '0')}:00`);
  lines.push('Messages:');
  const msgs = g.messages || [];
  if (msgs.length === 0) lines.push('(no messages yet)');
  for (const m of msgs.slice(-6)) {
    lines.push(`${m.from}: ${m.text}`);
  }
  lines.push('Tab or Esc to close the phone.');
  return lines.join('\n');
}
