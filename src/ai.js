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
