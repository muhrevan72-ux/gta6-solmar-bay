// Solmar Bay — the phone (Tab) (rebuild #14).
// Contacts: Rico (tips), Maya (dating), Taxi, Mechanic.
// Tabs: messages / map / contacts. Tab toggles it open and closed;
// it does nothing on the title screen. Calls land in g.messages
// and raise g.unread.

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Boss' },
  { id: 'maya', name: 'Maya', role: 'Beach' },
  { id: 'taxi', name: 'Taxi', role: 'Cab' },
  { id: 'mechanic', name: 'Mechanic', role: 'Garage' },
];

export function togglePhone(g) {
  if (g.mode === 'menu') return false;
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
  g.phoneTab = tab;
  if (tab === 'messages') g.unread = 0;
  return g.phoneTab;
}

function addMessage(g, from, text) {
  if (!g.messages) g.messages = [];
  g.messages.push({ from, text });
  return text;
}

export function callContact(g, id) {
  if (id === 'rico') {
    return addMessage(g, 'Rico', 'Rico: The Kings run downtown. Lay low near the garage and watch the harbour at night.');
  }
  if (id === 'maya') {
    const rel = (g.maya && g.maya.rel) || 0;
    if (rel >= 75) {
      return addMessage(g, 'Maya', 'Maya: The Sharks are moving product through the harbour tonight. Stay away from the docks.');
    }
    return addMessage(g, 'Maya', 'Maya: Meet me at the beach house sometime. Bring flowers.');
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    return addMessage(g, 'Taxi', 'Taxi: Cab on its way.');
  }
  if (id === 'mechanic') {
    const v = g.player.inCar;
    if (!v) return false;
    if (g.cash < 30) return false;
    g.cash -= 30;
    v.condition = 100;
    return addMessage(g, 'Mechanic', 'Mechanic: Good as new. $30 charged.');
  }
  return false;
}

export function notifyMessage(g, from, text) {
  if (!g.messages) g.messages = [];
  g.messages.push({ from, text });
  g.unread = (g.unread || 0) + 1;
  return g.unread;
}
