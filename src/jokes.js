// Phrases d'ambiance. Ton humour, à réécrire à ta sauce.

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const MISS = [
  'Dans le mur. Le mur n\'a rien demandé.',
  'Raté. Même le chat a vu venir.',
  'La fléchette a pris une initiative.',
  'Pas dans la cible. Pas dans le même département non plus.',
];

const BUST = [
  'Bust ! Trop gourmand.',
  'Bust. On remet les compteurs, on respire.',
  'Bust ! Les maths, c\'est dur à 22h.',
];

const TREBLE = ['Triple !', 'Joli triple !', 'Là, on respecte.'];
const DOUBLE = ['Double !', 'Un double, proprement.'];
const BULL = ['Dans le mille !', 'Bullseye ! Le pub applaudit.'];
const OUTER_BULL = ['Presque le mille.', 'Le 25, c\'est déjà ça.'];
const LOW = ['Bof.', 'Ça compte quand même.', 'C\'est un début.'];

export function calloutFor(event, names) {
  const who = names[event.player];
  const { hit } = event;

  if (event.win) {
    return event.player === 0
      ? 'Game shot ! Gérard va devoir payer sa tournée.'
      : `${who} gagne. Il va en parler pendant des années.`;
  }
  if (event.bust) return pick(BUST);
  if (event.turnOver && event.turnTotal === 180) return 'CENT QUATRE-VINGTS !';

  if (hit.ring === 'miss') return pick(MISS);
  if (hit.ring === 'bull') return pick(BULL);
  if (hit.ring === 'outerBull') return pick(OUTER_BULL);
  if (hit.ring === 'treble') return `${pick(TREBLE)} ${hit.label} : ${hit.score}`;
  if (hit.ring === 'double') return `${pick(DOUBLE)} ${hit.label} : ${hit.score}`;
  return `${hit.label} : ${hit.score}. ${pick(LOW)}`;
}
