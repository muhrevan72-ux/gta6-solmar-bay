// Solmar Bay — the phone.
//
// Contacts, messages and calls. Rico gives chapter tips, Maya's
// advice depends on the relationship, the taxi dispatches a cab and
// the mechanic repairs the car the player is sitting in.

export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Boss' },
  { id: 'maya', name: 'Maya', role: 'Beach House' },
  { id: 'taxi', name: 'Solmar Cab', role: 'Taxi' },
  { id: 'mechanic', name: 'Manny', role: 'Mechanic' },
];

// Open the phone (mode 'phone'), or close it back to 'play'.
// Nothing happens from the title screen.
export function togglePhone(g) {
  if (g.mode === 'menu') return false;
  if (g.mode === 'phone' || g.phoneOpen) {
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
  g.messages = g.messages || [];
  g.messages.push({ from, text, t: g.time || 0 });
  g.unread = (g.unread || 0) + 1;
  return g.messages[g.messages.length - 1];
}

export function callContact(g, id) {
  if (id === 'rico') {
    const tips = [
      'First wheels: steal any car and bring it to the garage at the east side, near (150, -126).',
      'The package is at the harbour docks. Pick it up and deliver it to the hideout.',
      'Lose the cops: break line of sight and stay hidden for 14 seconds per star.',
      'Taxi nights: pick up three passengers around the city for good money.',
      'The big one: grab the vault cash, then reach the safehouse with no stars on you.',
    ];
    const tip = tips[Math.min((g.chapter || 1) - 1, tips.length - 1)];
    notifyMessage(g, 'Rico', tip);
    return true;
  }
  if (id === 'maya') {
    if ((g.maya.rel || 0) >= 75) {
      notifyMessage(g, 'Maya', 'Careful near the harbour — the Sharks are watching the docks tonight.');
    } else {
      notifyMessage(g, 'Maya', 'Come find me at the beach house on the west beach. Bring food and we can talk.');
    }
    return true;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    notifyMessage(g, 'Solmar Cab', 'Cab dispatched. Wait for it to reach you.');
    return true;
  }
  if (id === 'mechanic') {
    const v = g.player.inCar;
    if (!v) return false;
    if ((g.cash || 0) < 30) return false;
    g.cash -= 30;
    v.condition = 100;
    notifyMessage(g, 'Manny', 'Fixed up like new. That will be $30.');
    return true;
  }
  return false;
}
