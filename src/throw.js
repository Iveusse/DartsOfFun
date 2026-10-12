// Visée : on fait glisser la fléchette au bon endroit, on relâche pour lancer.
// Rien n'est aléatoire : le même geste (même position, même durée, même vitesse au lâcher)
// donne toujours exactement le même tir. Tous les réglages de "feeling" sont ici.

export const AIM_CONFIG = {
  // Décalage de la fléchette au-dessus du doigt, pour qu'il ne la cache pas (px).
  fingerOffsetPx: 100,
  // Dérive lente de la main (mm) : part de swayStart et monte jusqu'à swayMax en swayRamp secondes.
  // Elle est régulière et part du moment où le doigt se pose : mêmes durées, mêmes dérives.
  swayStart: 1.5,
  swayMax: 4.5,
  swayRamp: 5,
  // Élan au lâcher : la fléchette continue un peu dans le sens du mouvement (secondes de mouvement, mm max).
  leadSeconds: 0.05,
  maxLead: 22,
  // Rayon max de visée (mm), pour rester dans l'image.
  maxRadius: 255,
};

// Phases fixes : la dérive est toujours la même d'un lancer à l'autre.
export const FIXED_PHASES = [0, 1.3, 0.6, 2.1];

export function gaussian(rng = Math.random) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Amplitude de la dérive après `held` secondes. `stability` > 1 = fléchette plus stable.
export function swayAmplitude(held, cfg = AIM_CONFIG, stability = 1) {
  const k = Math.min(1, Math.max(0, held / cfg.swayRamp));
  return (cfg.swayStart + (cfg.swayMax - cfg.swayStart) * k) / stability;
}

// Décalage de la main (mm) au temps `held`, deux oscillations lentes mélangées.
export function swayAt(held, phases = FIXED_PHASES, cfg = AIM_CONFIG, stability = 1) {
  const a = swayAmplitude(held, cfg, stability);
  return {
    x: a * (0.7 * Math.sin(held * 1.9 + phases[0]) + 0.3 * Math.sin(held * 4.1 + phases[1])),
    y: a * (0.7 * Math.cos(held * 1.5 + phases[2]) + 0.3 * Math.sin(held * 3.3 + phases[3])),
  };
}

// Vitesse du doigt au lâcher (mm/s) -> décalage d'élan (mm), plafonné.
export function releaseLead(velocity, cfg = AIM_CONFIG) {
  const x = velocity.x * cfg.leadSeconds;
  const y = velocity.y * cfg.leadSeconds;
  const len = Math.hypot(x, y);
  if (len <= cfg.maxLead) return { x, y };
  const k = cfg.maxLead / len;
  return { x: x * k, y: y * k };
}

// Point visé + élan + dérive -> point d'impact. Entièrement déterministe.
export function aimToHit(aim, held, lead = { x: 0, y: 0 }, phases = FIXED_PHASES, cfg = AIM_CONFIG, stability = 1) {
  const s = swayAt(held, phases, cfg, stability);
  return {
    x: aim.x + lead.x + s.x,
    y: aim.y + lead.y + s.y,
  };
}

export function clampToRadius(point, maxRadius = AIM_CONFIG.maxRadius) {
  const r = Math.hypot(point.x, point.y);
  if (r <= maxRadius) return point;
  const k = maxRadius / r;
  return { x: point.x * k, y: point.y * k };
}
