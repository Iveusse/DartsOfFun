// Géométrie d'une cible standard (unités : mm, origine au centre, y vers le haut).
// Module pur : aucune dépendance, testable avec node.

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const RADII = {
  bull: 6.35,
  outerBull: 15.9,
  trebleIn: 99,
  trebleOut: 107,
  doubleIn: 162,
  doubleOut: 170,
};

const SECTOR = Math.PI / 10;

export function scoreAt(x, y) {
  const r = Math.hypot(x, y);

  if (r <= RADII.bull) {
    return { score: 50, label: 'BULL', multiplier: 2, number: 25, isDouble: true, ring: 'bull' };
  }
  if (r <= RADII.outerBull) {
    return { score: 25, label: '25', multiplier: 1, number: 25, isDouble: false, ring: 'outerBull' };
  }
  if (r > RADII.doubleOut) {
    return { score: 0, label: 'MISS', multiplier: 0, number: 0, isDouble: false, ring: 'miss' };
  }

  // angle mesuré dans le sens horaire depuis le haut
  let angle = Math.atan2(x, y);
  if (angle < 0) angle += Math.PI * 2;
  const index = Math.floor(((angle + SECTOR / 2) % (Math.PI * 2)) / SECTOR);
  const number = ORDER[index];

  let multiplier = 1;
  let ring = 'single';
  if (r >= RADII.trebleIn && r <= RADII.trebleOut) {
    multiplier = 3;
    ring = 'treble';
  } else if (r >= RADII.doubleIn) {
    multiplier = 2;
    ring = 'double';
  }

  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S';
  return {
    score: number * multiplier,
    label: `${prefix}${number}`,
    multiplier,
    number,
    isDouble: multiplier === 2,
    ring,
  };
}

// Point visé au milieu d'une zone (utilisé par l'adversaire).
export function segmentPoint(number, ring = 'single') {
  if (number === 25 || ring === 'bull') {
    return { x: 0, y: 0 };
  }
  if (ring === 'outerBull') {
    return { x: 0, y: RADII.outerBull * 0.7 };
  }
  const index = ORDER.indexOf(number);
  if (index < 0) throw new Error(`Numéro inconnu : ${number}`);
  const theta = index * SECTOR;
  const radius = ring === 'treble' ? (RADII.trebleIn + RADII.trebleOut) / 2
    : ring === 'double' ? (RADII.doubleIn + RADII.doubleOut) / 2
    : (RADII.trebleOut + RADII.doubleIn) / 2; // grande zone simple, la plus facile à toucher
  return { x: radius * Math.sin(theta), y: radius * Math.cos(theta) };
}
