# Darts of Fun

Jeu de fléchettes solo en 3D, dans le navigateur, pensé pour le téléphone.
Pas de jetons, pas d'achat : tout se gagne en jouant.

## Où on en est (étape 1)

- Cible 3D (Three.js), lancer au swipe vers le haut
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

## Régler le feeling du lancer

Tout est dans `src/throw.js` (`THROW_CONFIG`) :

| Réglage | Effet |
| --- | --- |
| `idealSpeed` | vitesse de swipe qui vise le centre (plus haut = il faut swiper plus vite) |
| `speedSensitivity` | à quel point la vitesse décale le tir en hauteur |
| `angleSensitivity` | à quel point l'inclinaison du swipe décale le tir sur le côté |
| `wobble` | tremblement aléatoire en mm |

Après chaque lancer, l'écran affiche "trop fort", "trop mou", "trop à droite"... pour aider au réglage.
La difficulté de Gérard se règle avec `opponentSigma` dans `src/main.js`.

## Publier sur GitHub Pages

Le workflow `.github/workflows/pages.yml` construit et déploie à chaque push sur `main`.
À faire une seule fois : dans le dépôt, Settings > Pages > Source : **GitHub Actions**.
