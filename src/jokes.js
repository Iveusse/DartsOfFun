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
      ? `Game shot ! ${names[1]} va devoir payer sa tournée.`
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

// Phrases pour les autres modes.
export function calloutForGame(game, event) {
  if (game.kind === 'x01') return calloutFor(event, game.names);
  const { hit } = event;
  const who = game.names[event.player];

  if (game.kind === 'countup') {
    if (event.turnOver && event.turnTotal >= 150) return `${event.turnTotal} sur la volée ! Le pub retient son souffle.`;
    if (hit.ring === 'miss') return pick(MISS);
    if (hit.ring === 'treble') return `${pick(TREBLE)} ${hit.label} : ${hit.score}`;
    if (hit.ring === 'bull') return pick(BULL);
    return `${hit.label} : ${hit.score}. ${pick(LOW)}`;
  }

  if (game.kind === 'shanghai') {
    if (event.shanghai) return 'SHANGHAI ! Victoire immédiate, le bar est en feu.';
    if (event.good) return `${hit.label} : +${event.points}. ${pick(LOW)}`;
    return hit.ring === 'miss' ? pick(MISS) : `Pas le ${game.target}. ${who} regarde ailleurs.`;
  }

  // cricket
  if (event.win) return `${who} ferme tout. Dr Fléchette est impressionné.`;
  if (event.closedNow) return `${hit.number === 25 ? 'Le bull' : `Le ${hit.number}`} est fermé !`;
  if (event.points > 0) return `+${event.points} points, bien vu.`;
  if (event.marks > 0) return `${event.marks} marque${event.marks > 1 ? 's' : ''} sur le ${hit.number === 25 ? 'bull' : hit.number}.`;
  return hit.ring === 'miss' ? pick(MISS) : 'Ce numéro ne compte pas au Cricket.';
}
