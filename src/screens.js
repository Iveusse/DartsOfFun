// Écrans : menu, mode histoire, partie rapide, boutique. Tout est du HTML simple.
import { CHAPTERS, MODE_LABEL } from './story.js';
import { DARTS, FLIGHTS } from './darts.js';
import * as store from './save.js';

const LEVELS = {
  facile: { label: 'Facile', sigma: 48, mult: 0.6 },
  normal: { label: 'Normal', sigma: 36, mult: 1 },
  dur: { label: 'Difficile', sigma: 26, mult: 1.5 },
};

const quick = { mode: 'x01', start: 301, doubleOut: false, level: 'normal' };
let shopTab = 'dart';
let handlers = {};

const root = () => document.getElementById('screen');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function show(html) {
  const el = root();
  el.innerHTML = `<div class="wrap">${html}</div>`;
  el.hidden = false;
  el.scrollTop = 0;
}

export function hideScreens() {
  root().hidden = true;
}

export function initScreens(h) {
  handlers = h;
  root().addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    if (!target) return;
    act(target.dataset.act, target.dataset.val);
  });
}

const coinsLine = () => `<p class="coins">🪙 ${store.load().coins} pièces</p>`;

export function showMenu() {
  show(`
    <h1>Darts of Fun</h1>
    <p class="sub">Des fléchettes, de la mauvaise foi, zéro pay to win.</p>
    ${coinsLine()}
    <button class="menu-btn" data-act="story">Mode histoire</button>
    <button class="menu-btn ghost" data-act="quick">Partie rapide</button>
    <button class="menu-btn ghost" data-act="shop">Boutique</button>
  `);
}

function showStory() {
  const s = store.load();
  const items = CHAPTERS.map((c, i) => {
    const locked = i > s.chapter;
    const done = s.done.includes(i);
    return `
      <div class="item ${locked ? 'locked' : ''}">
        <div>
          <div class="t">${i + 1}. ${esc(c.title)} ${done ? '✓' : ''}</div>
          <div class="d">${esc(c.opponent)} · ${esc(MODE_LABEL[c.mode](c))} · 🪙 ${c.reward}</div>
        </div>
        <button data-act="chapter" data-val="${i}" ${locked ? 'disabled' : ''}>${done ? 'Rejouer' : locked ? '🔒' : 'Jouer'}</button>
      </div>`;
  }).join('');
  show(`
    <button class="ghost back" data-act="menu">‹ Menu</button>
    <h1>Mode histoire</h1>
    <p class="sub">Une tournée des bars, du 201 au 701.</p>
    ${items}
  `);
}

function showChapter(i) {
  const c = CHAPTERS[i];
  show(`
    <button class="ghost back" data-act="story">‹ Chapitres</button>
    <h1>${esc(c.title)}</h1>
    <p class="sub">${esc(c.opponent)} · ${esc(MODE_LABEL[c.mode](c))}</p>
    <p style="font-size:1.05rem;line-height:1.5">${esc(c.intro)}</p>
    <p class="coins">Victoire : 🪙 ${c.reward}</p>
    <button class="menu-btn" data-act="play-chapter" data-val="${i}">Jouer</button>
  `);
}

function showQuick() {
  const chip = (act, val, label, on) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-val="${val}">${label}</button>`;
  const modes = [
    ['x01', 'X01'],
    ['countup', 'Count Up'],
    ['shanghai', 'Shanghai'],
    ['cricket', 'Cricket'],
  ];
  show(`
    <button class="ghost back" data-act="menu">‹ Menu</button>
    <h1>Partie rapide</h1>
    <h2>Mode</h2>
    <div class="row">${modes.map(([v, l]) => chip('q-mode', v, l, quick.mode === v)).join('')}</div>
    ${
      quick.mode === 'x01'
        ? `<h2>Score de départ</h2>
           <div class="row">${[201, 301, 401, 501, 601, 701].map((v) => chip('q-start', v, v, quick.start === v)).join('')}</div>
           <h2>Sortie</h2>
           <div class="row">${chip('q-dbl', 0, 'Libre', !quick.doubleOut)}${chip('q-dbl', 1, 'Double out', quick.doubleOut)}</div>`
        : ''
    }
    <h2>Adversaire</h2>
    <div class="row">${Object.entries(LEVELS).map(([v, l]) => chip('q-level', v, l.label, quick.level === v)).join('')}</div>
    <button class="menu-btn" data-act="play-quick" style="margin-top:22px">Lancer la partie</button>
  `);
}

function showShop() {
  const s = store.load();
  const list = shopTab === 'dart' ? DARTS : FLIGHTS;
  const owned = shopTab === 'dart' ? s.ownedDarts : s.ownedFlights;
  const equipped = shopTab === 'dart' ? s.dart : s.flight;
  const items = list
    .map((it) => {
      const has = owned.includes(it.id);
      let button;
      if (equipped === it.id) button = '<button class="ghost" disabled>Équipée</button>';
      else if (has) button = `<button data-act="equip" data-val="${it.id}">Équiper</button>`;
      else button = `<button data-act="buy" data-val="${it.id}" ${s.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>`;
      const swatch = it.colors
        ? `<span class="swatch" style="background:linear-gradient(90deg,${it.colors.a},${it.colors.b},${it.colors.c})"></span>`
        : '';
      return `
        <div class="item">
          <div>
            <div class="t">${swatch}${esc(it.name)}</div>
            ${it.desc ? `<div class="d">${esc(it.desc)}</div>` : ''}
          </div>
          ${button}
        </div>`;
    })
    .join('');
  const chip = (v, l) => `<button class="chip ${shopTab === v ? 'on' : ''}" data-act="tab" data-val="${v}">${l}</button>`;
  show(`
    <button class="ghost back" data-act="menu">‹ Menu</button>
    <h1>Boutique</h1>
    <p class="sub">Les pièces se gagnent en jouant. Aucune fléchette n'est meilleure qu'une autre : chacune a un défaut.</p>
    ${coinsLine()}
    <div class="row" style="margin-bottom:8px">${chip('dart', 'Fléchettes')}${chip('flight', 'Ailerons')}</div>
    ${items}
  `);
}

function act(name, val) {
  switch (name) {
    case 'menu': return showMenu();
    case 'story': return showStory();
    case 'chapter': return showChapter(Number(val));
    case 'play-chapter': return handlers.playChapter(Number(val));
    case 'quick': return showQuick();
    case 'q-mode': quick.mode = val; return showQuick();
    case 'q-start': quick.start = Number(val); return showQuick();
    case 'q-dbl': quick.doubleOut = val === '1'; return showQuick();
    case 'q-level': quick.level = val; return showQuick();
    case 'play-quick': {
      const lv = LEVELS[quick.level];
      const base = { x01: quick.start / 10, countup: 30, shanghai: 35, cricket: 40 }[quick.mode];
      return handlers.playQuick({
        mode: quick.mode,
        start: quick.start,
        doubleOut: quick.doubleOut,
        rounds: quick.mode === 'shanghai' ? 7 : 8,
        opponent: 'Gérard',
        sigma: lv.sigma,
        reward: Math.round(base * lv.mult),
      });
    }
    case 'shop': return showShop();
    case 'tab': shopTab = val; return showShop();
    case 'buy': {
      const it = [...DARTS, ...FLIGHTS].find((x) => x.id === val);
      store.buy(shopTab, it);
      return showShop();
    }
    case 'equip':
      store.equip(shopTab, val);
      handlers.styleChanged();
      return showShop();
    default:
  }
}
