// Solmar Bay — HUD (DOM) + 2D minimap (canvas). Importing this
// module is safe in Node: with no document, createHud returns a stub
// and every update is a no-op. drawMinimap is exported so the menu
// branch can draw the map behind the title screen (no empty box).

import { FOOD_MENU, OUTFIT } from './config.js';
import { OUTFIT_PARTS } from './outfit.js';

export function createHud() {
  if (typeof document === 'undefined') return stubHud();
  const el = (id) => document.getElementById(id);
  return {
    cash: el('hud-cash'),
    healthBar: el('hud-health-bar'),
    healthText: el('hud-health-text'),
    armourBar: el('hud-armour-bar'),
    stars: el('hud-stars'),
    weapon: el('hud-weapon'),
    speed: el('hud-speed'),
    objective: el('hud-objective'),
    toast: el('hud-toast'),
    rel: el('hud-rel'),
    event: el('hud-event'),
    minimap: el('minimap'),
    overlays: {
      menu: el('overlay-menu'),
      pause: el('overlay-pause'),
      chapter: el('overlay-chapter'),
      busted: el('overlay-busted'),
      complete: el('overlay-complete'),
    },
    chapterTitle: el('chapter-title'),
    chapterText: el('chapter-text'),
    bustedReason: el('busted-reason'),
    completeStats: el('complete-stats'),
    menuContinue: el('btn-continue'),
    menuSaveInfo: el('menu-save-info'),
    foodMenu: el('food-menu'),
    foodItems: el('food-items'),
    outfitMenu: el('outfit-menu'),
    outfitItems: el('outfit-items'),
  };
}

function stubHud() {
  return {
    cash: null, healthBar: null, healthText: null, armourBar: null,
    stars: null, weapon: null, speed: null, objective: null, toast: null,
    rel: null, event: null, minimap: null,
    overlays: { menu: null, pause: null, chapter: null, busted: null, complete: null },
    chapterTitle: null, chapterText: null, bustedReason: null,
    completeStats: null, menuContinue: null, menuSaveInfo: null,
    foodMenu: null, foodItems: null, outfitMenu: null, outfitItems: null,
  };
}

function setText(node, text) { if (node) node.textContent = text; }
function setWidth(node, pct) { if (node) node.style.width = pct + '%'; }
function show(node, on) { if (node) node.style.display = on ? 'block' : 'none'; }

export function updateHud(hud, game) {
  const s = game.state;
  const p = game.player;
  setText(hud.cash, '$' + s.cash);
  setWidth(hud.healthBar, s.health);
  setText(hud.healthText, Math.ceil(s.health) + '');
  setWidth(hud.armourBar, s.armour);
  setText(hud.stars, '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted));
  const ammo = s.weapon === 'pistol' ? '∞' : s.weapon === 'smg' ? s.ammo.smg : s.ammo.shotgun;
  setText(hud.weapon, s.weapon + ' ' + ammo + '  💣 ' + s.bombs);
  const speed = p.inVehicle ? Math.abs(p.inVehicle.speed) * 3.6 : Math.abs(p.speed) * 3.6;
  setText(hud.speed, Math.round(speed) + ' km/h');
  setText(hud.objective, s.objective);
  setText(hud.rel, s.relationship > 0 ? '♥ Maya ' + s.relationship + '%' : '');
  const ev = game.events && game.events.active;
  setText(hud.event, ev ? 'EVENT: ' + ev.type.toUpperCase() + ' — ' + Math.ceil(ev.t) + 's' : '');
  if (s.toastTimer > 0) {
    setText(hud.toast, s.toast);
    show(hud.toast, true);
  } else {
    show(hud.toast, false);
  }
  // food menu
  if (hud.foodMenu) {
    const open = game.food.menuOpen;
    show(hud.foodMenu, open);
    if (open && hud.foodItems) {
      hud.foodItems.innerHTML = FOOD_MENU.map((item, i) =>
        '<div>' + (i + 1) + '. ' + item.name + ' — $' + item.price +
        ' (+' + item.heal + ' HP' + (item.armour ? ', +' + item.armour + ' armour' : '') + ')</div>').join('');
    }
  }
  // outfit menu
  if (hud.outfitMenu) {
    const open = game.outfit.menuOpen;
    show(hud.outfitMenu, open);
    if (open && hud.outfitItems) {
      hud.outfitItems.innerHTML = OUTFIT_PARTS.map((part, i) => {
        const opts = OUTFIT[part];
        const cur = opts[s.outfit[part]];
        return '<div>' + (i + 1) + '. ' + part + ': ' + cur.name + ' ($' + cur.price + ')</div>';
      }).join('');
    }
  }
  // minimap
  if (hud.minimap) {
    const ctx = hud.minimap.getContext('2d');
    if (ctx) drawMinimap(ctx, game);
  }
}

export function showOverlay(hud, name) {
  for (const key of Object.keys(hud.overlays)) {
    show(hud.overlays[key], key === name);
  }
}

// The game sets these before calling showOverlay('chapter' | 'busted' | 'complete').
export function setChapterCard(hud, title, text) {
  setText(hud.chapterTitle, title);
  setText(hud.chapterText, text);
}
export function setBustedCard(hud, reason) {
  setText(hud.bustedReason, reason || '');
}
export function setCompleteCard(hud, statsText) {
  setText(hud.completeStats, statsText);
}

// 2D top-down minimap on a 200x200 canvas (world is 800x800).
export function drawMinimap(ctx, game) {
  const S = 200 / 800;
  const px = (x) => (x + 400) * S;
  const pz = (z) => (z + 400) * S;
  ctx.fillStyle = '#1d3320';
  ctx.fillRect(0, 0, 200, 200);
  // water (west strip)
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(0, 0, px(-360), 200);
  // sand
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(px(-360), 0, px(-320) - px(-360), 200);
  // roads
  ctx.fillStyle = '#555';
  for (const r of game.city.roads) {
    ctx.fillRect(px(r.x - r.w / 2), pz(r.z - r.d / 2), r.w * S, r.d * S);
  }
  // buildings
  ctx.fillStyle = '#9a9a92';
  for (const b of game.city.buildings) {
    ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * S, b.d * S);
  }
  // gang turf zones (translucent)
  if (game.gangs) {
    ctx.fillStyle = 'rgba(255, 200, 20, 0.25)';
    ctx.fillRect(px(-150), pz(-150), 300 * S, 300 * S);
    ctx.fillStyle = 'rgba(20, 190, 205, 0.25)';
    ctx.fillRect(px(-300), pz(250), 240 * S, 130 * S);
  }
  // train
  if (game.living) {
    ctx.strokeStyle = '#888';
    ctx.beginPath();
    ctx.arc(100, 100, 235 * S, 0, Math.PI * 2);
    ctx.stroke();
  }
  // mission marker
  const state = game.state;
  if (state.chapterActive) {
    const tgt = missionTarget(game);
    if (tgt) {
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.arc(px(tgt.x), pz(tgt.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // police blips
  ctx.fillStyle = '#3a6cff';
  for (const car of game.police.cars) {
    ctx.fillRect(px(car.x) - 2, pz(car.z) - 2, 4, 4);
  }
  for (const cop of game.police.cops) {
    if (cop.alive) ctx.fillRect(px(cop.x) - 2, pz(cop.z) - 2, 4, 4);
  }
  // player
  const p = game.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px(p.x), pz(p.z), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(px(p.x), pz(p.z));
  ctx.lineTo(px(p.x) + Math.sin(p.heading) * 8, pz(p.z) + Math.cos(p.heading) * 8);
  ctx.stroke();
}

function missionTarget(game) {
  const s = game.city.spawns;
  const state = game.state;
  const m = game.missions;
  switch (state.chapter) {
    case 0: return s.garage;
    case 1: return m.stage === 0 ? s.packagePickup : s.harbourOffice;
    case 2: return s.hideout;
    case 3: {
      const next = m.passengers.find((x) => !x.done);
      if (!next) return null;
      return next.picked ? { x: next.destX, z: next.destZ } : next;
    }
    case 4: return m.stage === 0 ? s.harbourOffice : s.safehouse;
    default: return null;
  }
}
