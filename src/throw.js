// Visée : on fait glisser la fléchette au bon endroit, on relâche pour lancer.
// La main tremble de plus en plus quand on garde le doigt posé, il faut viser vite et propre.
// Tous les réglages de "feeling" sont ici.

export const AIM_CONFIG = {
  // Décalage de la fléchette au-dessus du doigt, pour qu'il ne la cache pas (px).
  fingerOffsetPx: 100,
  // Tremblement de la main (mm) : part de swayStart et monte jusqu'à swayMax en swayRamp secondes.
  swayStart: 2.5,
  swayMax: 11,
  swayRamp: 4,
  // Petite imprécision aléatoire au moment du lâcher (écart-type en mm).
  jitter: 1.5,
  // Rayon max de visée (mm), pour rester dans l'image.
  maxRadius: 255,
};

export function gaussian(rng = Math.random) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function newPhases(rng = Math.random) {
  return [0, 1, 2, 3].map(() => rng() * Math.PI * 2);
}

// Amplitude du tremblement après `held` secondes. `stability` > 1 = fléchette plus stable.
export function swayAmplitude(held, cfg = AIM_CONFIG, stability = 1) {
  const k = Math.min(1, Math.max(0, held / cfg.swayRamp));
  return (cfg.swayStart + (cfg.swayMax - cfg.swayStart) * k) / stability;
}

// Décalage de la main (mm) au temps `held`, deux oscillations mélangées pour que ça ne soit pas régulier.
export function swayAt(held, phases, cfg = AIM_CONFIG, stability = 1) {
  const a = swayAmplitude(held, cfg, stability);
  return {
    x: a * (0.7 * Math.sin(held * 1.9 + phases[0]) + 0.3 * Math.sin(held * 4.1 + phases[1])),
    y: a * (0.7 * Math.cos(held * 1.5 + phases[2]) + 0.3 * Math.sin(held * 3.3 + phases[3])),
  };
}

// Point visé par le doigt -> point d'impact réel.
export function aimToHit(aim, held, phases, rng = Math.random, cfg = AIM_CONFIG, stability = 1) {
  const s = swayAt(held, phases, cfg, stability);
  return {
    x: aim.x + s.x + gaussian(rng) * cfg.jitter,
    y: aim.y + s.y + gaussian(rng) * cfg.jitter,
  };
}

export function clampToRadius(point, maxRadius = AIM_CONFIG.maxRadius) {
  const r = Math.hypot(point.x, point.y);
  if (r <= maxRadius) return point;
  const k = maxRadius / r;
  return { x: point.x * k, y: point.y * k };
}
