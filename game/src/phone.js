// Solmar Bay — in-game smartphone (rebuild #13).
export const CONTACTS = [
  { id: 'rico', name: 'Rico', role: 'Boss' },
  { id: 'maya', name: 'Maya', role: 'Beach House' },
  { id: 'taxi', name: 'Taxi', role: 'Solmar Cab Co.' },
  { id: 'mechanic', name: 'Mechanic', role: 'Garage' },
];

export function togglePhone(g) {
  if (g.mode === 'menu') return false;
  if (g.mode === 'phone') {
    g.mode = 'play';
    g.phoneOpen = false;
    return false;
  }
  if (g.mode !== 'play') return false;
  g.mode = 'phone';
  g.phoneOpen = true;
  return true;
}

export function phoneTab(g, tab) {
  g.phoneTab = tab;
  if (tab === 'messages') g.unread = 0;
}

export function notifyMessage(g, from, text) {
  g.messages.push({ from, text });
  g.unread += 1;
}

export function callContact(g, id) {
  if (id === 'rico') {
    const tips = [
      'Rico: First job — get wheels from the garage, then come see me.',
      'Rico: The harbour package is hot. Keep your wanted low.',
      'Rico: Lose the heat before the big one. Cops forget in 14 seconds out of sight.',
    ];
    notifyMessage(g, 'Rico', tips[Math.min(g.chapter - 1, tips.length - 1)]);
    return true;
  }
  if (id === 'maya') {
    if (g.maya.rel >= 75) {
      notifyMessage(g, 'Maya', 'The Sharks move their stash through the harbour at night. Just saying.');
    } else {
      notifyMessage(g, 'Maya', 'Come find me at the beach house, by the palms. I like the sunset there.');
    }
    return true;
  }
  if (id === 'taxi') {
    g._taxiRequested = true;
    notifyMessage(g, 'Taxi', 'A cab is on its way to you.');
    return true;
  }
  if (id === 'mechanic') {
    const v = g.player.inCar;
    if (!v) return false;
    if (g.cash < 30) return false;
    g.cash -= 30;
    v.condition = 100;
    notifyMessage(g, 'Mechanic', 'Fixed up. Good as new — $30.');
    return true;
  }
  return false;
}
