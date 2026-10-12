// Fléchettes : toutes ont un défaut. Aucune n'est "la meilleure", on choisit selon son style.
// stability : plus grand = la main bouge moins. lift : la montée de la cloche. lead : poids de l'élan du doigt.
export const DARTS = [
  {
    id: 'classique',
    name: 'La Classique',
    price: 0,
    stability: 1,
    lift: 1,
    lead: 1,
    desc: 'Celle du bar. Rien de spécial, rien à lui reprocher.',
  },
  {
    id: 'lourde',
    name: 'La Lourde',
    price: 150,
    stability: 1.5,
    lift: 1.3,
    lead: 1,
    desc: 'Très stable, mais elle monte plus haut : vise plus bas.',
  },
  {
    id: 'plume',
    name: 'La Plume',
    price: 150,
    stability: 0.7,
    lift: 0.7,
    lead: 0.8,
    desc: 'Retombe près de la pointe, mais ta main tremble davantage.',
  },
  {
    id: 'boomerang',
    name: 'Le Boomerang',
    price: 220,
    stability: 1.2,
    lift: 1,
    lead: 1.7,
    desc: 'Elle adore ton élan : un geste rapide la pousse loin.',
  },
  {
    id: 'sniper',
    name: 'Le Sniper',
    price: 300,
    stability: 1.8,
    lift: 1.4,
    lead: 1.9,
    desc: 'Ultra stable, mais très sensible au moindre geste. Pour les puristes.',
  },
];

// Ailerons : purement esthétiques.
export const FLIGHTS = [
  { id: 'pub', name: 'Le Pub', price: 0, colors: { base: '#10143a', a: '#b3123f', b: '#2a6fb8', c: '#d9d6e6', d: '#3a1d7a', e: '#c99a2e' } },
  { id: 'tricolore', name: 'Tricolore', price: 60, colors: { base: '#13224f', a: '#d62839', b: '#2a5db8', c: '#f4f4f4', d: '#1c3a8a', e: '#d62839' } },
  { id: 'citron', name: 'Citron pressé', price: 80, colors: { base: '#1c2a10', a: '#d6e033', b: '#6ec23a', c: '#f6f7d0', d: '#2e5a1c', e: '#f0c933' } },
  { id: 'fantome', name: 'Fantôme', price: 80, colors: { base: '#2a2d36', a: '#e8ebf5', b: '#9aa3b8', c: '#ffffff', d: '#505870', e: '#c8cfe0' } },
  { id: 'braise', name: 'Braise', price: 100, colors: { base: '#1a0d08', a: '#ff6a1a', b: '#d62a0a', c: '#ffd79a', d: '#5a1a0c', e: '#ffb02e' } },
];

export const dartById = (id) => DARTS.find((d) => d.id === id) || DARTS[0];
export const flightIndex = (id) => Math.max(0, FLIGHTS.findIndex((f) => f.id === id));
