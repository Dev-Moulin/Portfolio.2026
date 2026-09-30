# Portfolio.2026

Le portfolio de Paul Moulin, développeur full-stack.
**[dev-moulin.github.io/Portfolio.2026](https://dev-moulin.github.io/Portfolio.2026/)**

*Paul Moulin's portfolio, full-stack developer. The site opens in English when
your browser is not set to French.*

## Un portfolio qui se visite en descendant

On y entre par le profil, puis on descend de salle en salle, à la molette, au
clavier ou au doigt : les projets, puis l'Orchestrateur, un système d'agents
IA locaux. Chaque passage est un zoom continu dans l'image de la salle, jusqu'à
la suivante.

- **Les passages** sont des pyramides d'images générées en local, recalées
  entre elles pour que le zoom ne saute jamais, et dessinées sur une toile.
- **Les décors** sont des boucles vidéo faites dans Blender, lues sans couture
  grâce aux Media Source Extensions.
- **Les logos** de la salle des projets sont des nuages de particules en
  Three.js, reliés par des filaments.
- **Le téléphone** a sa propre version : images portrait, une carte par geste,
  une barre de navigation en bas.
- **Deux langues**, français et anglais, choisies selon le navigateur et
  changeables d'un bouton.

## Stack

Angular 22 (signals, OnPush) · TypeScript strict · Three.js · Vitest et jsdom

## Lancer le projet

```bash
npm install
npm start          # http://localhost:4200
npm test           # 328 tests, sans navigateur
npm run build      # dist/portfolio-zoom/browser/
```

Chaque push sur `main` lance les tests, construit le site et le publie sur
GitHub Pages (`.github/workflows/deploy.yml`).
