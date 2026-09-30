<h1 align="center">Portfolio.2026</h1>
<p align="center">Développeur full-stack · <em>Full-stack developer</em></p>

<p align="center">
  <a href="https://dev-moulin.github.io/Portfolio.2026/"><img src="https://img.shields.io/badge/Site-en_ligne_·_live-F7B267?style=for-the-badge" alt="Site en ligne"/></a>
  <a href="https://github.com/Dev-Moulin/Portfolio.2026/actions/workflows/deploy.yml"><img src="https://github.com/Dev-Moulin/Portfolio.2026/actions/workflows/deploy.yml/badge.svg" alt="Déploiement"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular_22-DD0031?style=flat-square&logo=angular&logoColor=white" alt="Angular 22"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white" alt="Three.js"/>
  <img src="https://img.shields.io/badge/Blender-F5792A?style=flat-square&logo=blender&logoColor=white" alt="Blender"/>
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest"/>
  <img src="https://img.shields.io/badge/GitHub_Pages-222222?style=flat-square&logo=githubpages&logoColor=white" alt="GitHub Pages"/>
</p>

<p align="center">
  <a href="https://dev-moulin.github.io/Portfolio.2026/">
    <img src=".github/apercu.webp" width="900" alt="Une balade dans le site, du profil à la salle Hermès"/>
  </a>
</p>

<p align="center"><a href="#français">Français</a> · <a href="#english">English</a></p>

---

## Français

### Bienvenue chez moi

Comme Alice au pays des merveilles, descendez de salle en salle, à la molette, au clavier ou du bout des doigts. Vous y trouverez mon profil, trois projets (Intuition, Overmind 3D et Overmind Founders Collection), puis mon travail sur les agents IA. Chaque projet s'ouvre en grand sur place.

### Côté technique

- **Les passages d'une salle à l'autre** sont des pyramides d'images générées en local, recalées entre elles pour que le zoom ne saute jamais, et dessinées sur une toile.
- **Les décors** sont des boucles vidéo faites dans Blender, lues sans couture grâce aux Media Source Extensions.
- **Les logos THP et Intuition** sont des nuages de particules en Three.js, reliés par des filaments.
- **Le téléphone** a sa propre version : images portrait, une carte de projet par geste, une barre de navigation en bas.
- **Deux langues**, choisies selon le navigateur et changeables d'un bouton.
- **Des tests Vitest** sur la navigation, les contenus et les deux langues.

### Lancer le projet

```bash
npm install
npm start          # http://localhost:4200
npm test           # les tests, sans navigateur
npm run build      # dist/portfolio-zoom/browser/
```

---

## English

### Welcome to my place

Like Alice in Wonderland, go down from room to room with the mouse wheel, the keyboard or your fingertips. You will find my profile, three projects (Intuition, Overmind 3D and Overmind Founders Collection), then my work on AI agents. Each project opens up right where it is.

### The technical side

- **The passages between rooms** are pyramids of locally generated images, aligned with each other so the zoom never jumps, and drawn on a canvas.
- **The backgrounds** are video loops made in Blender, played seamlessly with Media Source Extensions.
- **The THP and Intuition logos** are Three.js particle clouds, linked by filaments.
- **Mobile** has its own version: portrait images, one project card per swipe, a navigation bar at the bottom.
- **Two languages**, picked from the browser and switchable with a button.
- **Vitest tests** covering navigation, content and both languages.

### Run the project

```bash
npm install
npm start          # http://localhost:4200
npm test           # the tests, no browser needed
npm run build      # dist/portfolio-zoom/browser/
```
