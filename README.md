# Darts of Fun

Jeu de fléchettes solo en 3D, dans le navigateur, pensé pour le téléphone.
Pas de jetons, pas d'achat : tout se gagne en jouant.

## Où on en est

- Pub en briques, cible en relief, fléchettes 3D (Three.js), lancer inspiré de Darts of Fury (la fléchette se fait glisser puis part très vite, aucun hasard)
- Modes : X01 (201 à 701, sortie libre ou double out), Count Up, Shanghai, Cricket
- Mode histoire : 10 chapitres contre des adversaires humoristiques, du 201 au 701 (`src/story.js`)
- Pièces gagnées en jouant, boutique de fléchettes à compromis (aucune n'est meilleure qu'une autre) et d'ailerons de couleur (`src/darts.js`)
- Sauvegarde locale dans le navigateur (`src/save.js`)
- Le design néon est conservé sur la branche `neon`

## Prévu

- Plus d'adversaires et de chapitres, parties à plusieurs, stats

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
