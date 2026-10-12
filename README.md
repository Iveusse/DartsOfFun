# Darts of Fun

Jeu de fléchettes solo en 3D, dans le navigateur, pensé pour le téléphone.
Pas de jetons, pas d'achat : tout se gagne en jouant.

## Où on en est (étape 1)

- Arène néon sombre, cible lumineuse, scores en tours de cubes qui éclatent, fléchettes 3D (Three.js)
- Contrôle comme Darts of Fury : on pose le doigt, on fait glisser la pointe sur la cible, on relâche : la fléchette part en cloche et retombe un peu plus haut que la pointe, très vite (aucun hasard : le même geste donne toujours le même tir)
- Match en 201 contre Gérard, 3 fléchettes par volée, bust géré
- Sortie libre par défaut (le double out est prêt dans le code, à activer dans `src/main.js`)
- Phrases d'ambiance dans `src/jokes.js`

## Prévu

- Progression 201 → 701
- Modes Count Up, Shanghai, Cricket
- Mode histoire avec adversaires
- Pièces gagnées en jouant, fléchettes à compromis (pas de pay to win)

## Lancer en local

```bash
npm install
npm run dev      # serveur de dev
npm test         # tests de la logique
npm run build    # version à déployer (dossier dist)
```

## Régler le feeling de la visée

Tout est dans `src/throw.js` (`AIM_CONFIG`) :

| Réglage | Effet |
| --- | --- |
| `fingerOffsetPx` | décalage de la fléchette au-dessus du doigt, pour la voir |
| `swayStart` / `swayMax` | dérive lente et régulière de la main (mm) au début et au maximum |
| `swayRamp` | temps (s) pour passer de la dérive minimum à la maximum |
| `lift` | de combien la fléchette monte plus haut que la pointe (la cloche), en mm |
| `leadSeconds` / `maxLead` | élan au lâcher : la fléchette continue dans le sens du mouvement du doigt |

La difficulté de Gérard se règle avec `opponentSigma` dans `src/main.js`.

## Publier sur GitHub Pages

Le workflow `.github/workflows/pages.yml` construit et déploie à chaque push sur `main`.
À faire une seule fois : dans le dépôt, Settings > Pages > Source : **GitHub Actions**.
