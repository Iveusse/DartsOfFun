// Transforme un swipe en point d'impact sur la cible (mm).
// Tous les réglages de "feeling" sont ici, à ajuster après essai sur téléphone.

export const THROW_CONFIG = {
  // Vitesse de swipe "idéale" en hauteurs d'écran par seconde (centre de la cible).
  idealSpeed: 2.2,
  // mm de décalage vertical par unité d'écart de vitesse (1.0 = 100 % trop fort).
  speedSensitivity: 140,
  // mm de décalage horizontal par unité de rapport dx/dy du swipe.
  angleSensitivity: 230,
  // Tremblement de base (écart-type en mm).
  wobble: 5,
  // Swipe minimal pour compter comme un lancer (fraction de la hauteur d'écran).
  minSwipe: 0.08,
  // Zone de tolérance pour le message d'aide (mm).
  hintThreshold: 28,
};

export function gaussian(rng = Math.random) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// swipe : { dx, dy (px, dy > 0 = vers le haut), speed (hauteurs d'écran / s) }
export function swipeToHit(swipe, rng = Math.random, cfg = THROW_CONFIG) {
  const ratio = swipe.dy > 0 ? swipe.dx / swipe.dy : 0;
  const speedRatio = swipe.speed / cfg.idealSpeed;

  const cleanX = clamp(ratio * cfg.angleSensitivity, -260, 260);
  const cleanY = clamp((speedRatio - 1) * cfg.speedSensitivity, -260, 260);

  const x = cleanX + gaussian(rng) * cfg.wobble;
  const y = cleanY + gaussian(rng) * cfg.wobble;

  return { x, y, hint: hintFor(cleanX, cleanY, cfg.hintThreshold) };
}

function hintFor(x, y, threshold) {
  const parts = [];
  if (y > threshold) parts.push('trop fort');
  else if (y < -threshold) parts.push('trop mou');
  if (x > threshold) parts.push('trop à droite');
  else if (x < -threshold) parts.push('trop à gauche');
  return parts.join(', ');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
