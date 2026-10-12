// Adversaire simple : il choisit une cible raisonnable puis rate avec un écart gaussien.
import { segmentPoint } from './board.js';
import { gaussian } from './throw.js';

export function chooseTarget(remaining, doubleOut) {
  if (doubleOut) {
    if (remaining === 50) return { number: 25, ring: 'bull' };
    if (remaining <= 40 && remaining % 2 === 0) return { number: remaining / 2, ring: 'double' };
    if (remaining <= 40) return { number: 1, ring: 'single' }; // on se laisse un nombre pair
    if (remaining <= 60) return { number: remaining - 40, ring: 'single' }; // on se laisse 40
    return { number: 20, ring: 'treble' };
  }

  if (remaining >= 60) return { number: 20, ring: 'treble' };
  if (remaining <= 20) return { number: remaining, ring: 'single' };
  if (remaining <= 40 && remaining % 2 === 0) return { number: remaining / 2, ring: 'double' };
  return { number: 20, ring: 'single' };
}

// sigma : écart-type en mm (plus petit = meilleur joueur)
export function aiThrow({ remaining, doubleOut, sigma = 30 }, rng = Math.random) {
  const target = chooseTarget(remaining, doubleOut);
  const point = segmentPoint(target.number, target.ring);
  return {
    x: point.x + gaussian(rng) * sigma,
    y: point.y + gaussian(rng) * sigma,
  };
}

// Cible de l'adversaire selon le mode de jeu.
export function aiTarget(game) {
  const me = game.current;
  if (game.kind === 'x01') return chooseTarget(game.scores[me], game.doubleOut);
  if (game.kind === 'countup') return { number: 20, ring: 'treble' };
  if (game.kind === 'shanghai') {
    // simple, double, triple dans l'ordre pour tenter le Shanghai, triple sinon
    const n = Math.min(game.round, 20);
    const seen = new Set(game.turnHits.filter((h) => h.number === n).map((h) => h.multiplier));
    if (!seen.has(1) && game.dartsInTurn === 0) return { number: n, ring: 'single' };
    return { number: n, ring: seen.has(3) ? 'double' : 'treble' };
  }
  // cricket : fermer d'abord ses numéros, puis marquer sur ceux que l'autre n'a pas fermés
  const order = [20, 19, 18, 17, 16, 15, 25];
  const open = order.find((n) => !game.closed(me, n));
  const n = open ?? order.find((k) => !game.closed(1 - me, k)) ?? 20;
  return n === 25 ? { number: 25, ring: 'bull' } : { number: n, ring: 'treble' };
}

export function aiThrowAt(target, sigma = 30, rng = Math.random) {
  const point = segmentPoint(target.number, target.ring);
  return {
    x: point.x + gaussian(rng) * sigma,
    y: point.y + gaussian(rng) * sigma,
  };
}
