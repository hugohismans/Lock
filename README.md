# Le Casse

Un jeu de perception au gyroscope. Le téléphone **est** le cadran : on le tient
devant soi, écran face à soi, et on le fait tourner dans son plan comme un
volant. Il faut trouver une combinaison en **sentant les crans** — l'écran ne
montre jamais le cadran, jamais le chiffre en cours, jamais de chronomètre.

Mobile uniquement. Web Audio et `devicemotion` en direct, sans moteur de jeu,
sans framework CSS, sans librairie audio.

## Lancer en local

```bash
npm install
npm run dev          # http://localhost:5173/Lock/
```

## Tester sur téléphone

`devicemotion` exige une origine sécurisée : `http://<ip-locale>` ne suffit pas,
il faut du HTTPS (ou `localhost`).

```bash
HTTPS=1 npm run dev:host
```

Le certificat est généré par `vite-plugin-mkcert`. Ouvrir l'URL réseau affichée
sur le téléphone et accepter l'avertissement de certificat. Sur iOS 13+, le
bouton **entrer** sert de geste utilisateur : il demande la permission de
mouvement et débloque l'audio en même temps. Si la permission a été refusée une
fois, il faut la rendre depuis Réglages → Safari → Mouvement et orientation.

Sur ordinateur, il n'y a pas de repli souris : un écran dédié affiche un QR code
vers l'URL courante.

## Déployer sur GitHub Pages

`.github/workflows/deploy.yml` construit et publie à chaque push sur `main`.
Il faut activer Pages une fois, dans Settings → Pages → Source : **GitHub
Actions**. La base d'URL suit automatiquement le nom du dépôt.

Pour un build manuel :

```bash
BASE_PATH=/Lock/ npm run build   # défaut ; BASE_PATH=/ pour une racine de domaine
npm run preview
```

## Vérifier

```bash
npm run check        # TypeScript strict, aucun any
npm test             # le modèle de serrure, en pur
npm run playthrough  # une partie complète jouée par un robot, contre le serveur de dev
```

`playthrough` a besoin de Chromium (`npx playwright install chromium`) et d'un
`npm run dev` déjà lancé. Il lit la combinaison, la joue, et vérifie que le
coffre s'ouvre — c'est le seul moyen de tester la boucle sans téléphone.

## Où se règle quoi

| Fichier | Ce qu'il décide |
| --- | --- |
| `src/lib/tuning.ts` | **toutes** les constantes de feel : démultiplication, largeur de gorge, vitesse seuil, durées d'impulsion, rendu |
| `src/lib/levels.ts` | les niveaux, en données. Ajouter un niveau = ajouter une entrée |
| `src/lib/lock/` | le modèle de serrure. Aucune référence au DOM |
| `src/lib/haptics/` | le moteur de feedback : vibration, audio grave, audio audible |
| `src/render/` | la boucle de rendu, hors du cycle réactif de Svelte |

En développement, une partie expose `window.casse` : `casse.combinaison` donne
les chiffres, `casse.ronde(0.9)` avance la ronde, `casse.etat` donne l'état de
la scène.

## État

Le niveau 1 se joue de bout en bout. Les niveaux 2 (vibration) et 3 (fausses
gorges) sont conçus et outillés — l'abstraction de feedback et la génération de
leurres existent — mais pas encore montés : le feel des crans se règle d'abord.
