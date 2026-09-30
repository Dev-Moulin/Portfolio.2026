// Le contenu réel du portfolio : géométrie des pièces d'un côté, texte de
// l'autre, une seule source pour les deux. Rien n'est dupliqué dans les
// gabarits — un titre de pièce change ici et nulle part ailleurs.

import type { Cible, Graphe, Ouverture, Piece } from './modele';
import type { LogoDefini } from './particules';
import { OUVERTURE_HERMES } from './transition-hermes-etages';
import { POINT_HERMES_ETROIT } from './transition-hermes-mobile-etages';

export const RACINE = 'seuil';

/**
 * Deux mises en page d'ouvertures : une pour les écrans larges (le texte à
 * côté de l'ouverture), une pour les écrans étroits (le texte en dessous).
 * Seul le PLACEMENT change — la mécanique, elle, ne connaît que des
 * rectangles, et la règle des proportions tient dans les deux cas puisqu'une
 * ouverture n'a toujours qu'une largeur.
 */
export type Format = 'large' | 'etroit';

/** Un rectangle d'ouverture, par format. */
type Placement = Readonly<
  Record<
    Format,
    { readonly x: number; readonly y: number; readonly w: number; readonly invisible?: boolean }
  >
>;

const PLACEMENTS: Readonly<Record<string, Placement>> = {
  projets: {
    // Sur grand écran, l'ouverture n'est plus décorative : elle est posée
    // DANS LE NOIR DU « H » DE THP, sur l'écran du portable du moine du
    // tee-shirt. Trois pixels de large sur un écran de 1440 : le
    // grossissement est de ×457, ce qui est voulu — « il faut que l'effet de
    // zoom soit fort et même très fort ». On n'y voit rien parce qu'il n'y a
    // rien à y voir : l'ouverture est transparente au seuil et la salle se
    // révèle en approchant (`opaciteOuvertureInvisible`).
    //
    // POURQUOI DANS LE NOIR, ET PAS SIMPLEMENT DANS LE H. La descente
    // s'arrêtait sur la lettre entière, contreformes blanches comprises, et
    // la salle 2 apparaissait par-dessus ce damier — « on arrive sur la
    // dernière image, mais la dernière image contient du blanc un peu
    // partout ». Elle finit maintenant DANS la barre du H : à l'arrivée
    // l'écran est noir d'un bord à l'autre, ce qui donne à la salle une
    // obscurité déjà installée où apparaître.
    //
    // Ces trois chiffres sont mesurés, pas devinés : c'est la plus grande
    // zone aux proportions de l'écran qui reste noire (luminance 14 ± 4,
    // maximum 31) même élargie de 12 %, dans le coude du H, à l'endroit qui
    // déplace le moins la trajectoire déjà engendrée (mesuré le 07/09).
    //
    // Ils valent pour un écran ~16/10. La photo étant cadrée en `cover`, le H
    // se décale si la fenêtre change de proportions — c'est ce qui fait
    // « bouger THP » au raccord entre la photo et le premier étage.
    large: { x: 0.113017, y: 0.657678, w: 0.002188, invisible: true },
    etroit: { x: 0.36, y: 0.025, w: 0.28, invisible: true },
  },
  // Les trois cartes, descendues sous le titre et l'intro (Paul, 25/09 : 0,34
  // avant). Sur téléphone aussi (0,34 → 0,44).
  intuition: {
    large: { x: 0.075, y: 0.5, w: 0.26 },
    etroit: { x: 0.03, y: 0.44, w: 0.29 },
  },
  overmind: {
    large: { x: 0.37, y: 0.5, w: 0.26 },
    etroit: { x: 0.355, y: 0.44, w: 0.29 },
  },
  founders: {
    large: { x: 0.665, y: 0.5, w: 0.26 },
    etroit: { x: 0.68, y: 0.44, w: 0.29 },
  },
  orchestrateur: {
    // Sur grand écran, l'ouverture est la PORTE DU TEMPLE, en haut des marches
    // du décor de la salle 2 — invisible, comme celle du « H ». Ses trois
    // nombres ne s'écrivent pas ici : ils sont calculés par
    // `scripts/transition-hermes.py` sur le point fixe des images du passage,
    // pour que la caméra zoome exactement autour de la porte. Les recopier à
    // la main désaccorderait la caméra et les images au premier recalage.
    // Avant le 23/09, c'était une carte visible sous les vignettes.
    large: { ...OUVERTURE_HERMES, invisible: true },
    // Au téléphone aussi depuis le 29/09 (ses images portrait) : invisible,
    // sur le point fixe du passage, pour que la caméra et la toile zooment
    // vers la même porte. Le temple est en `cover` sur un écran plus étroit
    // que lui, donc à la hauteur près ce point tombe au même endroit de
    // l'écran : l'écart en largeur reste sous 0,002.
    etroit: {
      x: POINT_HERMES_ETROIT.x * (1 - 0.245),
      y: POINT_HERMES_ETROIT.y * (1 - 0.245),
      w: 0.245,
      invisible: true,
    },
  },
  portfolio3d: {
    // Invisible sur grand écran depuis le 23/09 : la carte d'aperçu est
    // retirée (Paul) en attendant le vrai passage — un faux zoom par images
    // dans la pupille du visage de la salle Hermès, comme les deux autres.
    large: { x: 0.62, y: 0.56, w: 0.28, invisible: true },
    etroit: { x: 0.41, y: 0.79, w: 0.18 },
  },
  sortie: {
    large: { x: 0.44, y: 0.24, w: 0.4 },
    etroit: { x: 0.25, y: 0.26, w: 0.5 },
  },
};

function ouverture(id: string, format: Format, cible: Cible, libelle: string): Ouverture {
  const p = PLACEMENTS[id]![format];
  return p.invisible === true
    ? { id, x: p.x, y: p.y, w: p.w, cible, libelle, invisible: true }
    : { id, x: p.x, y: p.y, w: p.w, cible, libelle };
}

const PROFONDEUR: Cible = { genre: 'profondeur' };

/** Le graphe complet, pour un format d'écran donné. */
export function grapheDe(format: Format): Graphe {
  const vide = (id: string, nom: string): Piece => ({ id, nom, hauteur: 1, ouvertures: [] });
  return {
    seuil: {
      id: 'seuil',
      // Le nom de la SALLE, dans les repères (Paul, 28/09) : « Profil ». Le
      // nom de Paul, lui, est le titre de sa carte (`PROFIL.nom`).
      nom: 'Profil',
      hauteur: 1,
      ouvertures: [ouverture('projets', format, PROFONDEUR, 'Descendre vers les projets')],
    },
    projets: {
      id: 'projets',
      nom: 'Projects',
      hauteur: 1,
      ouvertures: [
        ouverture(
          'intuition',
          format,
          { genre: 'laterale', univers: 'intuition' },
          'Ouvrir : Intuition, extension Chrome',
        ),
        ouverture(
          'overmind',
          format,
          { genre: 'laterale', univers: 'overmind' },
          'Ouvrir : Overmind 3D',
        ),
        ouverture(
          'founders',
          format,
          { genre: 'laterale', univers: 'founders' },
          'Ouvrir : Founders Collection',
        ),
        ouverture(
          'orchestrateur',
          format,
          PROFONDEUR,
          "Descendre vers l'arrière-salle : Orchestrateur",
        ),
      ],
    },
    orchestrateur: {
      id: 'orchestrateur',
      nom: 'Orchestrateur',
      hauteur: 1,
      // Plus de pièce en dessous depuis le 24/09 (Paul) : le portfolio 3D
      // reviendra avec son vrai passage, le faux zoom dans la pupille du
      // visage. Son composant (`composants/portfolio3d/`), son texte
      // (`PORTFOLIO_3D`) et ses placements restent prêts ; il suffira de
      // remettre ici l'ouverture et, en dessous, la pièce :
      //   ouvertures: [ouverture('portfolio3d', format, PROFONDEUR, 'Descendre encore : le portfolio 3D')]
      //   portfolio3d: { id, nom: 'Le portfolio 3D', hauteur: 1,
      //     ouvertures: [ouverture('sortie', …, { genre: 'externe', href: PORTFOLIO_3D.href }, …)] }
      ouvertures: [],
    },
    intuition: vide('intuition', 'Intuition'),
    overmind: vide('overmind', 'Overmind 3D'),
    founders: vide('founders', 'Founders Collection'),
  };
}

/** Le graphe des écrans larges — la référence des tests et du rendu serveur. */
export const GRAPHE: Graphe = grapheDe('large');

// — Le texte —

/**
 * Un bloc de la carte de profil : un domaine, d'où il vient (une ou deux
 * phrases, pas plus), et sa stack. Paul, le 24/09 : « montrer les stacks et
 * où est-ce que je les ai apprises, avec quoi et pourquoi ».
 */
export interface Bloc {
  readonly domaine: string;
  readonly paragraphes?: readonly string[];
  /** La stack du bloc, sur une ligne. */
  readonly outils?: readonly string[];
  /** Ou, pour le bloc de fin, une ligne par famille d'outils. */
  readonly familles?: readonly { readonly nom: string; readonly outils: readonly string[] }[];
}

export interface Profil {
  readonly nom: string;
  readonly titre: string;
  readonly accroche: string;
  /** Les blocs, page par page : la première page porte aussi l'entête. */
  readonly pages: readonly [readonly Bloc[], readonly Bloc[]];
  /** `court` : le libellé du téléphone, où les trois adresses ne tiennent pas côte à côte. */
  readonly liens: readonly { readonly libelle: string; readonly court: string; readonly href: string }[];
}

// Écrit avec Paul le 24/09/2026. Les textes affichés sous son nom n'ont JAMAIS
// de tiret long (« c'est tout de suite IA, spotted »), ni de deux-points dans
// l'accroche ; tiret court, et « | » entre les technos. La carte parle de LUI
// en trois temps qui suivent l'accroche (formation, Web3, 3D) : le détail des
// projets est dans la salle suivante, l'IA dans la salle de l'Orchestrateur.
export const PROFIL: Profil = {
  nom: 'Paul Moulin',
  titre: 'Développeur full-stack - React | TypeScript | Ruby on Rails',
  accroche: "Full-stack par formation, 3D par passion, et l'IA comme outil de tous les jours.",
  pages: [
    [
      {
        // Le rôle dans CoinTribe est vérifié dans ses commits
        // (DevFullstackCo/CoinTribe, 2 au 13/12/2024).
        domaine: 'The Hacking Project',
        paragraphes: [
          'Formation Dev++ en peer to peer, titre RNCP 5. Projet final présenté devant un jury, ' +
            'le MVP de CoinTribe, une plateforme crypto développée à cinq en Rails 8.',
        ],
        outils: ['Ruby on Rails', 'PostgreSQL', 'JavaScript', 'React', 'Heroku'],
      },
      {
        domaine: '3D',
        paragraphes: [
          "Je voulais un peu de 3D dans l'extension Chrome, et j'y ai réalisé un œil animé " +
            "qui est ensuite devenu l'Overmind, un projet à part entière. Je continue de me " +
            'former avec Three.js Journey de Bruno Simon, et sur Blender pour la modélisation.',
        ],
        outils: ['Three.js', 'GLSL', 'Blender', 'XState'],
      },
    ],
    [
      {
        domaine: 'Web3',
        paragraphes: [
          'Stage de fin de formation avec le protocole Intuition, en équipe de six, et ' +
            "développement from scratch d'une extension Chrome qui affiche un indicateur de " +
            "confiance calculé sur les données on-chain. Avec elle, on a candidaté à l'Artizen " +
            'Fund et à Base Batch Europe, puis on est partis à ETHGlobal Cannes pour tenter de ' +
            'gagner un hackathon.',
        ],
        outils: ['TypeScript', 'React', 'wagmi', 'viem', 'RainbowKit', 'Intuition'],
      },
      {
        domaine: 'Stack complète',
        familles: [
          { nom: 'Front', outils: ['Angular', 'Tailwind', 'Vite'] },
          { nom: 'Back', outils: ['Node.js', 'GraphQL'] },
          { nom: 'Tests et livraison', outils: ['Vitest', 'Playwright', 'Docker', 'GitHub Actions'] },
        ],
      },
    ],
  ],
  liens: [
    { libelle: 'github.com/Dev-Moulin', court: 'GitHub', href: 'https://github.com/Dev-Moulin' },
    { libelle: 'linkedin.com/in/DevMoulin', court: 'LinkedIn', href: 'https://linkedin.com/in/DevMoulin' },
    { libelle: 'p.moulin.95@gmail.com', court: 'E-mail', href: 'mailto:p.moulin.95@gmail.com' },
  ],
};

/**
 * LA MÊME CARTE EN ANGLAIS (Paul, 29/09 : le bouton de langue, en commençant
 * par la page profil). Une traduction fidèle, rien d'ajouté, et les mêmes
 * règles que le français : pas de tiret long, pas de deux-points dans
 * l'accroche. À relire par Paul avant publication.
 */
export const PROFIL_EN: Profil = {
  nom: 'Paul Moulin',
  titre: 'Full-stack developer - React | TypeScript | Ruby on Rails',
  accroche: 'Full-stack by training, 3D by passion, and AI as an everyday tool.',
  pages: [
    [
      {
        domaine: 'The Hacking Project',
        paragraphes: [
          'Dev++ peer-to-peer program, French RNCP level 5 certification. Final project presented ' +
            'to a jury, the MVP of CoinTribe, a crypto platform built by a team of five in Rails 8.',
        ],
        outils: PROFIL.pages[0][0]!.outils,
      },
      {
        domaine: '3D',
        paragraphes: [
          'I wanted some 3D in the Chrome extension, so I built an animated eye for it, which ' +
            'later became the Overmind, a project in its own right. I keep learning with Bruno ' +
            "Simon's Three.js Journey, and Blender for modeling.",
        ],
        outils: PROFIL.pages[0][1]!.outils,
      },
    ],
    [
      {
        domaine: 'Web3',
        paragraphes: [
          'End-of-program internship with the Intuition protocol, in a team of six, building from ' +
            'scratch a Chrome extension that displays a trust indicator computed from on-chain ' +
            'data. With it, we applied to the Artizen Fund and Base Batch Europe, then went to ' +
            'ETHGlobal Cannes to try to win a hackathon.',
        ],
        outils: PROFIL.pages[1][0]!.outils,
      },
      {
        domaine: 'Full stack',
        familles: [
          { nom: 'Front', outils: ['Angular', 'Tailwind', 'Vite'] },
          { nom: 'Back', outils: ['Node.js', 'GraphQL'] },
          { nom: 'Testing and delivery', outils: ['Vitest', 'Playwright', 'Docker', 'GitHub Actions'] },
        ],
      },
    ],
  ],
  liens: PROFIL.liens,
};

export interface Projet {
  readonly id: string;
  readonly nom: string;
  readonly baseline: string;
  /**
   * La phrase d'usage (Paul, 27/09) : ce que le projet fait pour qui s'en
   * sert, pas sa technique. Écrite une fois, elle ouvre la vignette ET la
   * carte ouverte, à la même place — elle ne bouge pas quand la carte grandit.
   */
  readonly accroche: string;
  readonly contexte: string;
  readonly description: string;
  readonly stack: readonly string[];
  /**
   * La carte ouverte EN DEUX PAGES (Paul, 27/09) : le projet d'abord, puis ce
   * que Paul y a fait. Tout projet en a une : la carte d'une seule page, qui
   * servait le temps d'écrire les autres, a été retirée (Paul, 28/09).
   */
  readonly ouverte: CarteOuverte;
}

/** Un extrait du carrousel, avec sa légende s'il en a une. */
export interface Boucle {
  readonly src: string;
  readonly legende?: string;
}

/** Le contenu de la carte ouverte en deux pages. */
export interface CarteOuverte {
  /** Des extraits en boucle, muets, de la démo ; un clic ouvre la démo entière. */
  readonly demo: {
    readonly href: string;
    /** Le texte du bouton qui ouvre la démo. */
    readonly libelle: string;
    /**
     * Le chemin de chaque boucle, sans extension : `.mp4` (H.264 seul — le
     * WebM du 27/09 levait une erreur de décodage dans Chrome, et une erreur
     * de décodage ne passe pas à la source suivante), `.webp` pour l'affiche.
     */
    readonly boucles: readonly Boucle[];
    /** D'autres boutons, à côté de celui de la démo (le code d'Overmind). */
    readonly liens?: readonly { readonly libelle: string; readonly href: string }[];
  };
  /** Page 2 : ce que Paul a fait, lui. */
  readonly part: readonly string[];
  readonly difficulte: string;
  readonly suite: string;
  readonly liens: readonly { readonly libelle: string; readonly href: string }[];
}

export const PROJETS: readonly Projet[] = [
  {
    id: 'intuition',
    nom: 'Intuition',
    baseline: 'Extension Chrome',
    accroche:
      'Le web, avec une couche de confiance en plus. Retrouver le signal dans le bruit, ' +
      'grâce à la réputation et à la communauté.',
    contexte: 'Stage THP × protocole Intuition · équipe de 6 · mars → mai 2025 · un MVP construit de zéro',
    description:
      'Une couche de confiance décentralisée posée dans le navigateur. Signaux ' +
      "anti-phishing, avis contextuels, et création d'Atoms, Triples et Claims " +
      "directement depuis la page visitée, pour alimenter le Knowledge Graph d'Intuition. " +
      'En équipe, nous avons livré un indicateur de confiance calculé à partir des données ' +
      'on-chain du protocole, un cercle de confiance, des tags et des alertes anti-phishing.',
    stack: [
      'TypeScript',
      'React',
      'Plasmo',
      'Three.js',
      'GLSL',
      'Blender',
      'Tailwind',
      'GraphQL',
      'viem',
      'MetaMask',
    ],
    ouverte: {
      demo: {
        href: 'https://www.youtube.com/watch?v=YJwcXQ3oAWY',
        libelle: 'Démo · 1 min',
        boucles: [
          { src: 'projets/intuition/demo-a' },
          { src: 'projets/intuition/demo-b' },
          { src: 'projets/intuition/demo-f' },
        ],
      },
      part: [
        '2ᵉ contributeur sur 6, avec 93 commits de code et 38 PR de l’équipe fusionnées',
        'Un œil 3D modélisé sous Blender et animé avec Three.js. Il suit la souris et son iris pulse.',
        'Deux systèmes de particules qui réagissent à la souris et adaptent leur nombre à la taille de l’écran',
        'Les popups au survol des Atoms, enrichies ensuite par l’équipe',
        'La navigation en arc et le thème clair/sombre',
      ],
      difficulte:
        "Une même interface pour deux formats, la petite popup de l'extension et le panneau " +
        'latéral pleine hauteur. Boutons, thème, œil 3D et particules devaient rester lisibles ' +
        "dans les deux. Sans designer dans l'équipe, le style s'est trouvé à force d'essais. " +
        'Et la 3D était toute nouvelle pour moi : Blender et Three.js, appris en quelques ' +
        'semaines avec des tutoriels, la documentation, les Discord spécialisés et l’aide de l’IA.',
      suite:
        'MVP présenté à la communauté Intuition, au hackathon Base Batch Europe et sur Artizen ' +
        "(saisons 6 et 7), sans obtenir le financement qui l'aurait transformé en application " +
        "complète. Le protocole était encore sur testnet. James, de l'équipe, a ensuite porté " +
        "seul l'extension sur le mainnet, en janvier 2026. Mon premier œil, lui, est devenu Overmind 3D.",
      liens: [
        { libelle: 'Démo', href: 'https://www.youtube.com/watch?v=YJwcXQ3oAWY' },
        { libelle: 'Code', href: 'https://github.com/intuition-box/Extension' },
        { libelle: 'Base Batch Europe', href: 'https://devfolio.co/projects/intuition-chromeextention-afea' },
        { libelle: 'Artizen', href: 'https://artizen.fund/index/p/intuition-chrome-extension?season=7' },
      ],
    },
  },
  {
    id: 'overmind',
    nom: 'Overmind 3D',
    baseline: 'Œil robotique temps réel',
    accroche:
      "Transformer une donnée abstraite, la confiance, en une émotion qu'on lit tout de suite dans un regard.",
    contexte: "Né dans l'extension Intuition, poursuivi en projet autonome",
    description:
      'Un œil robotique qui traduit la confiance en émotion. Né comme l’organe visuel de ' +
      'l’extension Intuition, il devait réagir à chaque situation d’une recherche : en cours, ' +
      'rien trouvé, avis partagés, site fiable, suspect ou dangereux, dans un thème clair comme ' +
      'sombre. Devenu un projet à part entière, il est intégré au portfolio 3D.',
    stack: ['React 19', 'TypeScript', 'Three.js', 'XState', 'Blender', 'GLSL'],
    ouverte: {
      // Les étapes dans l'ordre où elles ont été filmées (Paul, 28/09) : la
      // date est celle enregistrée dans la vidéo, ou celle du fichier pour
      // les exports Clipchamp, qui l'effacent.
      demo: {
        href: 'https://overmind.intuition.box/',
        libelle: 'Démo en ligne',
        boucles: [
          { src: 'projets/overmind/demo-a', legende: 'Mai 2025 · les bras en inverse kinematics, sous Blender' },
          { src: 'projets/overmind/demo-b', legende: 'Mai 2025 · premier passage dans le navigateur' },
          { src: 'projets/overmind/demo-c', legende: 'Mai 2025 · premier bloom avec Three.js' },
          { src: 'projets/overmind/demo-d', legende: 'Août 2025 · un œil plus léger, et ses anneaux' },
          { src: 'projets/overmind/demo-e', legende: 'Septembre 2025 · enfin du bloom dans un décor clair' },
        ],
        // Le code à côté de la démo, sous le carrousel (Paul, 28/09) : la
        // page 2 n'a donc pas de liens.
        liens: [{ libelle: 'Code', href: 'https://github.com/intuition-box/Overmind' }],
      },
      part: [
        'Seul sur le projet, de la modélisation sous Blender à la mise en ligne',
        'Un œil et des bras articulés en inverse kinematics, chaque bras avec ses propres animations',
        "Des bras arrière avec beaucoup moins d'os, donc beaucoup moins de calcul",
        '35 animations Blender jouées dans le navigateur, avec les transitions de l’une à l’autre et un clignement automatique des paupières',
        '9 machines à états XState pour la lumière, le bloom, les matériaux et les apparitions, réglables depuis un panneau à 8 onglets',
      ],
      difficulte:
        'Tout apprendre en même temps, Blender comme Three.js. Les animations d’abord : réussir ' +
        'à les exporter correctement, puis passer d’une animation en cours à une autre. Le bloom ' +
        'ensuite : il fonctionnait dans une scène sombre, pas dans une scène claire. Il fallait ' +
        'savoir quoi régler dans Blender, quoi dans Three.js, et quelles textures sont utilisables ' +
        'dans un navigateur avec Three.js. Les Discord Blender parlent de vidéo et de jeu, ' +
        'rarement de 3D dans un navigateur. Enfin, Zustand ne suffisait plus à tenir tous ces ' +
        'réglages ensemble. Bloqué plusieurs semaines, j’ai suivi le conseil de Zet, formateur de ' +
        'THP, et tout repris avec XState.',
      suite:
        'Le bloom en décor clair a fini par marcher. Plusieurs réactions et les deux thèmes ' +
        'fonctionnaient, mais je n’ai pas pu continuer pour les intégrer à l’extension et y ' +
        'implémenter toutes les situations prévues. J’ai aimé faire de l’UX et de la 3D. Mais en full-stack, j’ai envie de tout ' +
        'comprendre : j’explore maintenant le back-end et l’IA.',
      liens: [],
    },
  },
  {
    id: 'founders',
    nom: 'Overmind Founders Collection',
    baseline: 'Vote on-chain',
    accroche:
      "Rendre hommage aux 42 fondateurs d'Intuition, en laissant la communauté élire leurs symboles.",
    contexte: 'Projet solo · novembre 2025 → février 2026 · protocole Intuition, sur testnet',
    description:
      'Une collection de NFT 3D pour rendre hommage aux 42 fondateurs d’Intuition, builders, ' +
      'investisseurs et soutiens. Pour choisir le totem de chacun, les idées se perdaient dans ' +
      'le flux de Discord. J’ai donc construit une application sur le protocole Intuition : la ' +
      'communauté parcourt les 42 fondateurs, propose des totems et vote pour ou contre en ' +
      'déposant des $TRUST. Chaque vote devient une donnée on-chain du Knowledge Graph. ' +
      // Des visiteurs prenaient les effets pour des bugs (Paul, 28/09).
      'L’univers est cyberpunk : les hologrammes, les glitchs et les images qui se figent sont ' +
      'des effets voulus, pas des bugs.',
    stack: ['React 19', 'TypeScript', 'wagmi', 'viem', 'Apollo GraphQL', 'Tailwind', 'Vitest', 'Playwright'],
    ouverte: {
      // Le parcours d'un votant, dans l'ordre (Paul, 28/09).
      demo: {
        href: 'https://dev-moulin.github.io/Overmind_Founders_Collection/',
        libelle: 'Démo en ligne',
        boucles: [
          { src: 'projets/founders/demo-a', legende: '1 · Se connecter avec son portefeuille' },
          { src: 'projets/founders/demo-b', legende: '2 · Parcourir les 42 fondateurs en carrousel 3D' },
          { src: 'projets/founders/demo-c', legende: '3 · Chercher un fondateur avec le dock A-Z' },
          { src: 'projets/founders/demo-d', legende: '4 · Choisir un totem et l’ajouter au panier' },
          { src: 'projets/founders/demo-e', legende: '5 · Valider plusieurs fondateurs en une transaction' },
        ],
        liens: [{ libelle: 'Code', href: 'https://github.com/Dev-Moulin/Overmind_Founders_Collection' }],
      },
      part: [
        'Seul sur le projet, de la conception au déploiement, avec 215 commits de code',
        'Un carrousel 3D des 42 fondateurs en CSS pur, dont les cartes se retournent en s’éloignant',
        'Un dock A-Z façon macOS, qui grossit les lettres sous la souris puis montre les photos des fondateurs',
        'Le vote on-chain en $TRUST, pour ou contre, sur deux courbes, et un panier qui valide plusieurs fondateurs en une seule transaction',
        'Recherche floue contre les doublons, images sur IPFS, interface en français et en anglais, tests unitaires et de bout en bout',
      ],
      difficulte:
        'La documentation d’Intuition est riche, et les problèmes techniques se réglaient bien. ' +
        'Le plus dur a été la conception : comment présenter 42 fondateurs, comment présenter le ' +
        'vote, comment y faire participer quelqu’un sans le perdre. Beaucoup d’essais aussi, pour ' +
        'voir ce qui était possible et ce qu’il fallait éviter, pour que le site reste cohérent. ' +
        'Puis le carrousel 3D : sous Chrome, le flou de verre ne fonctionne pas dans un espace 3D, ' +
        'alors la carte de face est affichée par-dessus, hors de la 3D. Et le dock A-Z, où ' +
        'j’aurais aimé peaufiner le fonctionnement et la fluidité.',
      suite:
        'Tout fonctionne, en testnet comme en mainnet, mais le vote n’a pas été ouvert à la ' +
        'communauté. Inscrire pour toujours sur une blockchain publique des données sur 42 ' +
        'personnes demandait leur accord, et je n’avais pas le temps de le recueillir. Le site ' +
        'reste donc sur le testnet. Pour voter, il faut détenir le NFT de l’airdrop Intuition.',
      liens: [],
    },
  },
];

/**
 * LES MÊMES PROJETS EN ANGLAIS (Paul, 29/09 : après le profil, la page
 * Projets). Seul le texte change : liens, extraits, stacks et chiffres sont
 * ceux du français, repris tels quels. Traduction fidèle, rien d'ajouté, à
 * relire par Paul.
 */
const [INTUITION_FR, OVERMIND_FR, FOUNDERS_FR] = PROJETS as [Projet, Projet, Projet];

/** Les légendes des extraits, traduites dans l'ordre. */
function legendes(p: Projet, textes: readonly string[]): readonly Boucle[] {
  return p.ouverte.demo.boucles.map((b, i) => (textes[i] ? { ...b, legende: textes[i] } : b));
}

export const PROJETS_EN: readonly Projet[] = [
  {
    ...INTUITION_FR,
    baseline: 'Chrome extension',
    accroche:
      'The web, with an extra layer of trust. Finding the signal in the noise, through ' +
      'reputation and community.',
    contexte: 'THP internship × Intuition protocol · team of 6 · March → May 2025 · an MVP built from scratch',
    description:
      'A decentralized trust layer in the browser. Anti-phishing signals, contextual ' +
      'reviews, and creating Atoms, Triples and Claims right from the visited page, to feed ' +
      "Intuition's Knowledge Graph. As a team, we shipped a trust indicator computed from the " +
      "protocol's on-chain data, a circle of trust, tags and anti-phishing alerts.",
    ouverte: {
      ...INTUITION_FR.ouverte,
      demo: { ...INTUITION_FR.ouverte.demo, libelle: 'Demo · 1 min' },
      part: [
        '2nd contributor out of 6, with 93 code commits and 38 of the team’s PRs merged',
        'A 3D eye modeled in Blender and animated with Three.js. It follows the mouse and its iris pulses.',
        'Two particle systems that react to the mouse and adapt their count to the screen size',
        'The hover popups on Atoms, later expanded by the team',
        'The arc navigation and the light/dark theme',
      ],
      difficulte:
        "One interface for two formats, the extension's small popup and the full-height side " +
        'panel. Buttons, theme, 3D eye and particles had to stay readable in both. With no ' +
        'designer on the team, the style was found through trial and error. And 3D was brand ' +
        'new to me: Blender and Three.js, learned in a few weeks with tutorials, the ' +
        'documentation, specialized Discord servers and help from AI.',
      suite:
        'MVP presented to the Intuition community, at the Base Batch Europe hackathon and on ' +
        'Artizen (seasons 6 and 7), without getting the funding that would have turned it into ' +
        'a full application. The protocol was still on testnet. James, from the team, later ' +
        'ported the extension to mainnet on his own, in January 2026. My first eye became Overmind 3D.',
      liens: INTUITION_FR.ouverte.liens.map((l) => (l.libelle === 'Démo' ? { ...l, libelle: 'Demo' } : l)),
    },
  },
  {
    ...OVERMIND_FR,
    baseline: 'Real-time robotic eye',
    accroche: 'Turning abstract data, trust, into an emotion you read instantly in a gaze.',
    contexte: 'Born in the Intuition extension, continued as a standalone project',
    description:
      'A robotic eye that translates trust into emotion. Born as the visual organ of the ' +
      'Intuition extension, it had to react to every state of a search: in progress, nothing ' +
      'found, mixed reviews, trusted site, suspicious or dangerous, in a light theme as well as ' +
      'a dark one. Now a project in its own right, it is part of the 3D portfolio.',
    ouverte: {
      ...OVERMIND_FR.ouverte,
      demo: {
        ...OVERMIND_FR.ouverte.demo,
        libelle: 'Live demo',
        boucles: legendes(OVERMIND_FR, [
          'May 2025 · the arms in inverse kinematics, in Blender',
          'May 2025 · first run in the browser',
          'May 2025 · first bloom with Three.js',
          'August 2025 · a lighter eye, and its rings',
          'September 2025 · bloom in a light scene, at last',
        ]),
      },
      part: [
        'Alone on the project, from modeling in Blender to going live',
        'An eye and arms rigged with inverse kinematics, each arm with its own animations',
        'Back arms with far fewer bones, so far less computation',
        '35 Blender animations played in the browser, with transitions between them and automatic eyelid blinking',
        '9 XState state machines for light, bloom, materials and appearances, tunable from an 8-tab panel',
      ],
      difficulte:
        'Learning everything at once, Blender as well as Three.js. Animations first: exporting ' +
        'them correctly, then switching from a running animation to another. Then bloom: it ' +
        'worked in a dark scene, not in a light one. I had to know what to tune in Blender, what ' +
        'in Three.js, and which textures work in a browser with Three.js. Blender Discord servers ' +
        'talk about video and games, rarely about 3D in a browser. Finally, Zustand could no ' +
        'longer hold all these settings together. Stuck for several weeks, I followed the advice ' +
        'of Zet, a THP instructor, and rebuilt everything with XState.',
      suite:
        'Bloom in a light scene finally worked. Several reactions and both themes worked, but I ' +
        'could not go on to integrate them into the extension and implement every planned ' +
        'situation. I enjoyed doing UX and 3D. But as a full-stack developer, I want to ' +
        'understand everything: I am now exploring the back end and AI.',
    },
  },
  {
    ...FOUNDERS_FR,
    baseline: 'On-chain vote',
    accroche: "Honoring Intuition's 42 founders, by letting the community elect their symbols.",
    contexte: 'Solo project · November 2025 → February 2026 · Intuition protocol, on testnet',
    description:
      'A collection of 3D NFTs honoring Intuition’s 42 founders, builders, investors and ' +
      'supporters. To choose each one’s totem, ideas got lost in the Discord feed. So I built ' +
      'an application on the Intuition protocol: the community browses the 42 founders, ' +
      'proposes totems and votes for or against by staking $TRUST. Every vote becomes on-chain ' +
      'data in the Knowledge Graph. The universe is cyberpunk: the holograms, glitches and ' +
      'freezing images are intended effects, not bugs.',
    ouverte: {
      ...FOUNDERS_FR.ouverte,
      demo: {
        ...FOUNDERS_FR.ouverte.demo,
        libelle: 'Live demo',
        boucles: legendes(FOUNDERS_FR, [
          '1 · Connect with your wallet',
          '2 · Browse the 42 founders in a 3D carousel',
          '3 · Find a founder with the A-Z dock',
          '4 · Pick a totem and add it to the cart',
          '5 · Confirm several founders in one transaction',
        ]),
      },
      part: [
        'Alone on the project, from design to deployment, with 215 code commits',
        'A pure-CSS 3D carousel of the 42 founders, whose cards flip as they move away',
        'A macOS-style A-Z dock that magnifies the letters under the mouse, then shows the founders’ photos',
        'On-chain voting in $TRUST, for or against, on two curves, and a cart that confirms several founders in a single transaction',
        'Fuzzy search against duplicates, images on IPFS, a French and English interface, unit and end-to-end tests',
      ],
      difficulte:
        'Intuition’s documentation is rich, and technical problems were solved easily. The ' +
        'hardest part was the design: how to present 42 founders, how to present the vote, how ' +
        'to get someone to take part without losing them. Lots of experiments too, to see what ' +
        'was possible and what to avoid, so the site stayed consistent. Then the 3D carousel: in ' +
        'Chrome, the glass blur does not work in a 3D space, so the front card is displayed on ' +
        'top, outside the 3D. And the A-Z dock, whose behavior and smoothness I would have liked ' +
        'to polish.',
      suite:
        'Everything works, on testnet as on mainnet, but the vote was not opened to the ' +
        'community. Writing data about 42 people forever on a public blockchain required their ' +
        'consent, and I did not have time to collect it. So the site stays on testnet. To vote, ' +
        'you need to hold the Intuition airdrop NFT.',
    },
  },
];

/** Les projets dans une langue. */
export function projetsDans(langue: 'fr' | 'en'): readonly Projet[] {
  return langue === 'en' ? PROJETS_EN : PROJETS;
}

/** Le texte de la carte Orchestrateur, dans une langue. */
export interface TexteOrchestrateur {
  readonly titre: string;
  readonly baseline: string;
  readonly depart: string;
  readonly part: readonly string[];
  readonly acquis: readonly string[];
  readonly difficulte: readonly string[];
  readonly harnais: string;
  readonly suite: readonly string[];
}

export const ORCHESTRATEUR: TexteOrchestrateur = {
  titre: 'Orchestrateur',
  // Réécrit avec Paul le 28/09 : l'objectif a changé le 14/09 (le système
  // local doit pouvoir travailler seul), et la carte s'arrêtait au 02/09.
  // Rien sur le coût, à sa demande.
  baseline: 'Comprendre les agents en les construisant',
  // Le 29/09, Paul reprend les deux listes de la première version : « Ma part »
  // (ce que j'ai fait) et « MySkill.md » (ce que j'ai appris), sans doublon.
  depart:
    'Les LLM ne se contentent plus de répondre, ils agissent : une fois le plan validé, ils ' +
    'cherchent, codent, testent et se contrôlent en boucle. Le métier de développeur évolue vers ' +
    'celui qui conçoit ces systèmes, fixe leurs règles et leurs droits, et vérifie ce qu’ils ' +
    'produisent. On parle d’agentic engineering. Mon but est un système d’agents entièrement ' +
    'local, capable à terme de mener seul un chantier de développement, de la spec à la ' +
    'relecture, avec un modèle de pointe comme Claude en simple conseiller.',
  part: [
    'Quatre agents aux rôles séparés (chef, codeur, relecteur, chercheur), qui se passent le ' +
      'travail par un kanban.',
    'Une cage de sécurité : les codeurs dans un conteneur Podman sans réseau, des approbations ' +
      'manuelles, et un chercheur web en quarantaine, dont les rapports sont lus comme des ' +
      'données, jamais comme des ordres.',
    'Un banc d’essai des harnais et des routeurs d’agents, qui a révélé un défaut dans ' +
      'llama.cpp. Correctif proposé sur le projet.',
  ],
  acquis: [
    'Le fonctionnement d’un modèle local : quantisation, taille du contexte, cache, vitesse, et ' +
      'ce qu’on gagne ou perd à chaque réglage.',
    'La sécurité des agents : un agent qui lit le web peut être manipulé par ce qu’il lit.',
    'Mesurer plutôt que se fier à une impression : chaque choix passe par un banc d’essai.',
  ],
  // Deux lignes d'un même paragraphe : Paul va à la ligne après « au mieux. » (29/09).
  difficulte: [
    'Préparer un modèle avec tout son environnement, le moteur, le harnais, le routeur et la ' +
      'sécurité, pour que l’ensemble fonctionne au mieux.',
    'Le domaine est en mutation permanente : les outils changent, les conseils deviennent vite ' +
      'obsolètes, et chacun a son avis. Le plus dur est de faire le tri, de suivre le signal dans ' +
      'le bruit.',
  ],
  // Réécrit avec Paul le 29/09 : le harnais compte, mais pas « tout », et la
  // question n'est pas « un harnais rend-il un modèle meilleur » mais « quelle
  // configuration pour ma machine » (vérifié contre les études de 2026).
  harnais:
    'On lit souvent « harness is everything » chez ceux qui font tourner des modèles en local. ' +
    'C’est en partie vrai, certains harnais donnent de meilleurs résultats. Mais entre le modèle, ' +
    'sa quantisation, le moteur, le harnais et le routeur, les réglages possibles sont nombreux, ' +
    'et le bon choix dépend du matériel et de ce qu’on veut en faire. Ma question est simple : ' +
    'avec ma machine, quelle est la meilleure configuration ? Pour y répondre, mon banc d’essai ' +
    'fait tourner une même tâche dans plusieurs harnais, avec plusieurs moteurs et plusieurs ' +
    'routeurs. Demain, des outils sauront sans doute le dire à notre place. Aujourd’hui, il faut ' +
    'essayer.',
  suite: [
    'Mon propre harnais, en Rust',
    'Le système sur un serveur, pas seulement sur ma machine',
    'Le fine-tuning, et des boucles autonomes qui savent se contrôler',
    'Le cache KV, et régler la réflexion d’un modèle qui réfléchit trop',
    'Des modèles d’un nouveau genre, comme Jev, qui décident au lieu d’écrire',
  ],
};

/**
 * LA MÊME CARTE EN ANGLAIS (Paul, 29/09). Traduction fidèle, rien d'ajouté ;
 * le titre aussi se traduit (Paul, même jour). À relire par Paul.
 */
export const ORCHESTRATEUR_EN: TexteOrchestrateur = {
  titre: 'Orchestrator',
  baseline: 'Understanding agents by building them',
  depart:
    'LLMs no longer just answer, they act: once the plan is approved, they search, code, test ' +
    'and check themselves in a loop. The developer’s job is shifting toward designing these ' +
    'systems, setting their rules and permissions, and verifying what they produce. This is ' +
    'called agentic engineering. My goal is a fully local agent system, eventually able to ' +
    'carry out a development project on its own, from spec to review, with a frontier model ' +
    'like Claude as a mere advisor.',
  part: [
    'Four agents with separate roles (lead, coder, reviewer, researcher), who hand work to each ' +
      'other through a kanban.',
    'A security cage: coders in a Podman container with no network, manual approvals, and a ' +
      'quarantined web researcher whose reports are read as data, never as orders.',
    'A test bench for agent harnesses and routers, which revealed a bug in llama.cpp. Fix ' +
      'proposed to the project.',
  ],
  acquis: [
    'How a local model works: quantization, context size, cache, speed, and what each setting ' +
      'gains or loses.',
    'Agent security: an agent that reads the web can be manipulated by what it reads.',
    'Measuring rather than trusting an impression: every choice goes through a test bench.',
  ],
  difficulte: [
    'Preparing a model with its whole environment, the engine, the harness, the router and ' +
      'security, so that everything works as well as possible.',
    'The field is constantly changing: tools change, advice quickly goes out of date, and ' +
      'everyone has an opinion. The hardest part is sorting it out, following the signal in the ' +
      'noise.',
  ],
  harnais:
    'You often read “harness is everything” among people who run models locally. It is partly ' +
    'true, some harnesses give better results. But between the model, its quantization, the ' +
    'engine, the harness and the router, there are many possible settings, and the right choice ' +
    'depends on the hardware and on what you want to do with it. My question is simple: with my ' +
    'machine, what is the best configuration? To answer it, my test bench runs the same task in ' +
    'several harnesses, with several engines and several routers. Tomorrow, tools will probably ' +
    'tell us. Today, you have to try.',
  suite: [
    'My own harness, in Rust',
    'The system on a server, not only on my machine',
    'Fine-tuning, and autonomous loops that can check themselves',
    'The KV cache, and tuning the reasoning of a model that overthinks',
    'New kinds of models, like Jev, that decide instead of writing',
  ],
};

/**
 * En anglais, le nom des salles (la barre du bas, le plan du site) et ce
 * qu'annonce chaque ouverture à un lecteur d'écran. En français, ce sont ceux
 * du graphe (`grapheDe`). Les noms propres ne changent pas.
 */
export const NOMS_EN: Readonly<Record<string, string>> = {
  seuil: 'Profile',
  projets: 'Projects',
  orchestrateur: 'Orchestrator',
};
export const LIBELLES_EN: Readonly<Record<string, string>> = {
  projets: 'Go down to the projects',
  intuition: 'Open: Intuition, Chrome extension',
  overmind: 'Open: Overmind 3D',
  founders: 'Open: Founders Collection',
  orchestrateur: 'Go down to the back room: Orchestrator',
};

export const PORTFOLIO_3D = {
  titre: 'Le portfolio 3D',
  baseline: 'La mise en abyme, littéralement',
  texte:
    'Le dernier niveau de zoom ouvre sur le portfolio précédent : une scène ' +
    "spatiale Three.js qu'on visite aux commandes d'un vaisseau. Ce portfolio-ci " +
    'a été construit parce que celui-là demandait trop de temps à un recruteur ' +
    'pressé. Alors il le contient, plutôt que de le remplacer.',
  href: 'https://dev-moulin.github.io/my-portfolio',
} as const;

/**
 * Les deux emblèmes de la salle 2 : les institutions, pas les projets.
 *
 * Ils se transforment l'un en l'autre. Sur téléphone il n'y a la place que
 * pour UN emplacement, et l'alternance suffit à les montrer tous les deux ;
 * sur grand écran il y en a deux, déphasés, donc on voit toujours les deux
 * logos à la fois et jamais deux fois le même.
 *
 * Les zones renforcées ne sont pas des réglages de goût, elles sont mesurées :
 * les lettres « THP » pèsent 4 % du dessin et la capuche avec ses hachures
 * 22 %, alors que ce sont eux qui portent le sens — sans renfort ils fondent
 * les premiers quand on aère. Et le jambage d'une lettre fait 1,53 % de la
 * largeur, contre un flanc de 10,8 % : d'où leur épaisseur réduite.
 */
export const EMBLEMES: readonly LogoDefini[] = [
  {
    source: 'thp-black.png',
    zonesFines: [
      { zone: { x0: 0.4, y0: 0.7, x1: 0.61, y1: 0.8 }, renfort: 5.5, flanc: 0.02 },
      { zone: { x0: 0.25, y0: 0.12, x1: 0.75, y1: 0.42 }, renfort: 2.1, flanc: 0.05 },
    ],
  },
  { source: 'anneaux-intuition.glb' },
];
