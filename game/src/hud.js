// Solmar Bay — HUD: DOM overlay (cash, health, wanted stars,
// objective, speed, toasts, menus) + a 2D canvas minimap drawn
// behind the menus too (the title screen must not show an empty box).

export function createHud(documentRef) {
  const doc = documentRef || (typeof document !== 'undefined' ? document : null);
  const hud = {
    doc,
    els: {},
    wantedFlash: 0,
    minimapCtx: null,
  };
  hud.flashWanted = () => {
    hud.wantedFlash = 1;
  };
  if (doc) {
    const ids = ['cash', 'health', 'healthbar', 'armour', 'wanted', 'objective', 'speed', 'toast', 'chapter', 'weapon', 'bombs', 'relationship', 'minimap', 'menu', 'menu-title', 'menu-body', 'menu-hint'];
    for (const id of ids) {
      hud.els[id] = doc.getElementById(id);
    }
    const mm = hud.els.minimap;
    if (mm && mm.getContext) hud.minimapCtx = mm.getContext('2d');
  }
  return hud;
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

export function updateHud(game) {
  const hud = game.hud;
  const state = game.state;
  if (!hud || !hud.doc) return;
  setText(hud.els.cash, '$' + state.cash);
  setText(hud.els.health, Math.ceil(state.health) + ' HP');
  if (hud.els.healthbar) hud.els.healthbar.style.width = Math.max(0, state.health) + '%';
  setText(hud.els.armour, state.armour > 0 ? 'Armour ' + Math.ceil(state.armour) : '');
  const stars = '\u2605'.repeat(state.wanted) + '\u2606'.repeat(5 - state.wanted);
  setText(hud.els.wanted, stars);
  if (hud.els.wanted) {
    hud.els.wanted.style.color = state.wanted > 0 ? '#ff4444' : '#ffd75e';
    hud.els.wanted.style.opacity = hud.wantedFlash > 0.5 ? '1' : '0.85';
  }
  hud.wantedFlash = Math.max(0, hud.wantedFlash - 0.02);
  const marker = game.missions ? currentMarker(game) : null;
  setText(hud.els.objective, marker ? marker.label : chapterObjective(game));
  const speed = game.player.inVehicle ? Math.abs(game.player.inVehicle.speed || 0) : Math.abs(game.player.speed || 0);
  setText(hud.els.speed, Math.round(speed * 3.6) + ' km/h');
  if (hud.els.toast) {
    setText(hud.els.toast, state.toastT > 0 ? state.toast : '');
  }
  if (hud.els.weapon) {
    const w = game.combat ? game.combat : null;
    setText(hud.els.weapon, w ? 'Weapon: ' + ['Pistol', 'SMG', 'Shotgun'][w.weapon] : '');
  }
  if (hud.els.bombs) {
    setText(hud.els.bombs, game.combat ? 'Bombs: ' + game.combat.bombs : '');
  }
  if (hud.els.relationship) {
    setText(hud.els.relationship, state.relationship > 0 ? 'Maya \u2665 ' + Math.round(state.relationship) + '%' : '');
  }
  drawMinimap(game);
}

function chapterObjective(game) {
  const ch = game.state.chapter;
  if (ch > 5) return 'Free roam — side jobs still pay.';
  const CHAPTERS = [
    'Steal a car and drive to the garage.',
    'Pick up the package, deliver it before time runs out.',
    'Escape the 3-star wanted level.',
    'Pick up 3 passengers and drop them off.',
    'Grab the cash, lose the heat, reach the safehouse.',
  ];
  return CHAPTERS[ch - 1] || '';
}

function currentMarker(game) {
  if (game.missions) {
    const m = game.missions.marker || null;
    if (m) return m;
  }
  if (game.dating) {
    const d = game.dating;
    if (d.onDate) return { label: 'Date with Maya' };
  }
  return null;
}

// 2D top-down minimap: roads, water, buildings, player, mission
// marker, police blips, gang turf. Drawn every frame, including
// behind the title menu.
export function drawMinimap(game) {
  const hud = game.hud;
  const ctx = hud && hud.minimapCtx;
  if (!ctx) return;
  const S = 200; // canvas pixels
  const W = 800; // world units
  const scale = S / W;
  const toX = (x) => (x + 400) * scale;
  const toZ = (z) => (z + 400) * scale;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(0, 0, S, S);
  // water west
  ctx.fillStyle = '#2a6f9f';
  ctx.fillRect(0, 0, (70) * scale, S);
  // sand
  ctx.fillStyle = '#d8c27a';
  ctx.fillRect((70) * scale, 0, (70) * scale, S);
  // roads
  ctx.fillStyle = '#3a3a3e';
  for (let g = -300; g <= 300; g += 100) {
    ctx.fillRect(toX(g) - 1.5, 0, 3, S);
    ctx.fillRect(0, toZ(g) - 1.5, S, 3);
  }
  // buildings
  ctx.fillStyle = '#8a8a90';
  for (const b of game.city.buildings) {
    ctx.fillRect(toX(b.x - b.sx / 2), toZ(b.z - b.sz / 2), Math.max(1, b.sx * scale), Math.max(1, b.sz * scale));
  }
  // gang turf
  ctx.fillStyle = 'rgba(255, 200, 40, 0.25)';
  ctx.fillRect(toX(-150), toZ(-150), 300 * scale, 300 * scale);
  ctx.fillStyle = 'rgba(40, 200, 200, 0.25)';
  ctx.fillRect(toX(230), toZ(220), 170 * scale, 180 * scale);
  // mission marker (yellow diamond)
  const marker = currentMarker(game);
  if (marker) {
    ctx.fillStyle = '#ffd75e';
    const mx = toX(marker.x);
    const mz = toZ(marker.z);
    ctx.beginPath();
    ctx.moveTo(mx, mz - 6);
    ctx.lineTo(mx + 5, mz);
    ctx.lineTo(mx, mz + 6);
    ctx.lineTo(mx - 5, mz);
    ctx.closePath();
    ctx.fill();
  }
  // police blips (blue)
  if (game.police) {
    ctx.fillStyle = '#3a7bff';
    for (const c of game.police.copCars) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toZ(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // player (white dot + heading tick)
  const p = game.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(toX(p.x), toZ(p.z), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(toX(p.x), toZ(p.z));
  ctx.lineTo(toX(p.x) + Math.sin(p.heading) * 8, toZ(p.z) + Math.cos(p.heading) * 8);
  ctx.stroke();
}

export function showMenu(hud, title, body, hint) {
  if (!hud || !hud.doc) return;
  setText(hud.els['menu-title'], title || '');
  if (hud.els['menu-body']) hud.els['menu-body'].innerHTML = body || '';
  setText(hud.els['menu-hint'], hint || '');
  if (hud.els.menu) hud.els.menu.style.display = 'block';
}

export function hideMenu(hud) {
  if (!hud || !hud.doc) return;
  if (hud.els.menu) hud.els.menu.style.display = 'none';
}
