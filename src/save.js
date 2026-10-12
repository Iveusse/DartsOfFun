// Sauvegarde locale (pièces, progression, achats). Tout reste dans ton navigateur.
const KEY = 'dartsoffun-save-v1';

const DEFAULT = {
  coins: 0,
  chapter: 0, // prochain chapitre à jouer
  done: [], // chapitres gagnés
  ownedDarts: ['classique'],
  ownedFlights: ['pub'],
  dart: 'classique',
  flight: 'pub',
};

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = { ...DEFAULT, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    state = { ...DEFAULT };
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // navigation privée : on continue sans sauvegarde
  }
}

export function addCoins(n) {
  load().coins += n;
  save();
}

export function buy(kind, item) {
  const s = load();
  const list = kind === 'dart' ? s.ownedDarts : s.ownedFlights;
  if (list.includes(item.id) || s.coins < item.price) return false;
  s.coins -= item.price;
  list.push(item.id);
  save();
  return true;
}

export function equip(kind, id) {
  const s = load();
  if (kind === 'dart') s.dart = id;
  else s.flight = id;
  save();
}

export function completeChapter(index) {
  const s = load();
  if (!s.done.includes(index)) s.done.push(index);
  s.chapter = Math.max(s.chapter, index + 1);
  save();
}
