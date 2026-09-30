// La coquille : elle tient la scène zoomée, capte les gestes du visiteur, et
// n'en fait rien elle-même — tout part vers le service de navigation, qui
// s'appuie sur les fonctions pures de `coeur/`.

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Navigation } from './navigation';
import { Seuil } from './composants/seuil/seuil';
import { Projets } from './composants/projets/projets';
import { Orchestrateur } from './composants/orchestrateur/orchestrateur';
import { Portes } from './composants/portes/portes';
import { Univers } from './composants/univers/univers';
import { Reperes } from './composants/reperes/reperes';
import { Descente } from './composants/descente/descente';
import { Trame } from './composants/trame/trame';
import { FondSalle2 } from './composants/fond-salle2/fond-salle2';
import { FondHermes } from './composants/fond-hermes/fond-hermes';
import { DiagVideo } from './composants/diag-video/diag-video';
import { ReglageEmblemes } from './composants/reglage-emblemes/reglage-emblemes';
import { PlacementLibre } from './composants/placement-libre/placement-libre';
import { ParticulesLogo } from './composants/particules-logo/particules-logo';
import { Fumee } from './composants/fumee/fumee';
import { BoutonLangue } from './composants/bouton-langue/bouton-langue';
import { LangueSite } from './langue';
import { EMBLEMES, PROJETS } from './coeur/contenu';
import { Placement, REGLAGES, placeDepart } from './placement';
import {
  CENTRE_X,
  EMBLEME_ETROIT,
  EMBLEME_LARGE,
  HAUT_ETROIT,
  HAUT_LARGE,
} from './coeur/embleme';
import { PASSAGE_HERMES, PASSAGE_HERMES_ETROIT } from './coeur/passages';
import { SILENCE_MOLETTE } from './coeur/pages';

/**
 * La largeur d'un emblème, en fraction de la largeur de la PIÈCE qui le
 * porte. `zoneEcran` la multiplie par la taille de la pièce à l'écran, donc
 * quand la salle remplit la fenêtre, l'emblème occupe exactement cette
 * fraction de la largeur — 0,19 de 1920 px font 365 px de côté.
 *
 * Deux valeurs, parce que les deux formats ne posent pas le même nombre
 * d'emblèmes : deux côte à côte au bureau, un seul sur téléphone.
 */

/**
 * Le nombre de particules à la taille d'origine, pour chaque format. Sur
 * grand écran, 6 532 depuis que le logo est passé de 0,123 à 0,180 (25/09) :
 * c'est ce que la loi du carré donnait à Paul quand il l'a réglé
 * (3 050 × (0,180 / 0,123)²), donc la densité qu'il a vue.
 */
const PARTICULES_LARGE = 6532;
/**
 * Au téléphone, 1 429 depuis que le logo y est passé de 0,28 à 0,40 (Paul,
 * 29/09) : la loi du carré depuis les 700 d'avant (700 × (0,40 / 0,28)²), que
 * la règle lui proposait et qu'il a gardée.
 */
const PARTICULES_ETROIT = 1429;

/**
 * LES RÉGLAGES ARRÊTÉS PAR PAUL LE 11/09, à la règle, sur 2109 × 1194.
 *
 * Ils ne sont pas dérivés : ils ont été trouvés à l'œil, curseur par curseur,
 * et relevés tels quels — largeur 0,123 (259 px de côté quand la salle remplit
 * l'écran), position 0 / −216 px, profondeur −1,10, point 1,2 px, 3 filaments
 * par point, 3 050 particules, pour 5 % de couverture d'encre.
 *
 * (Ces constantes vivent dans `coeur/embleme.ts`, avec la salle qui s'y cale.)
 *
 * Le décalage vertical reste un ÉCART plutôt que d'être fondu dans
 * `HAUT_LARGE` : le curseur de la règle le convertit en fraction de la hauteur
 * de fenêtre, quand `HAUT_LARGE` est une fraction de la largeur de la pièce.
 * Les additionner changerait la position dès qu'on change d'écran.
 */
const ECART_Z = -1.1;

/**
 * Le côté d'un point, en unités du monde, pour 1,2 px sur 1194 de haut.
 *
 * La conversion est celle de la règle, à l'envers : `gl_PointSize = taille ×
 * (hauteur/2) / distance`, avec la distance caméra de 1,9.
 */
const POINT_MONDE = (1.2 * 2 * 1.9) / 1194;

/**
 * La plage utile, arrêtée par Paul le 10/09 après l'avoir parcourue à l'œil.
 *
 * En dessous de 1080, le logo cesse d'être reconnaissable quelle que soit la
 * finesse du réseau — chiffre trouvé à l'œil par Paul le 10/09, en parcourant
 * la plage. La loi du carré propose bien moins que ça aux petites tailles
 * (140 à `w: 0.060`) : c'est là qu'elle atteint sa limite, elle préserve la
 * densité mais pas la FORME, et c'est ce plancher qui la rattrape.
 *
 * Le plafond de 10 000 est tenable : la recherche de voisins est en O(N²) et
 * coûte 205 ms à 10 000 points (mesuré le 10/09), soit ~0,4 s pour les deux
 * logos — une pause au relâchement du curseur, pas un gel.
 */
const PARTICULES_MIN = 1080;
const PARTICULES_MAX = 10000;

/**
 * Le CENTRE de chaque emplacement, lui, ne bouge pas quand la taille change.
 * Sans ça, régler la largeur ferait grossir les emblèmes vers la droite et le
 * second sortirait de l'écran avant qu'on ait pu juger le premier.
 */
/** Un seul emblème désormais, et le décor de la salle 2 le veut au centre. */

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Seuil,
    Projets,
    Orchestrateur,
    Portes,
    Univers,
    BoutonLangue,
    Reperes,
    Descente,
    ParticulesLogo,
    Fumee,
    Trame,
    FondSalle2,
    FondHermes,
    DiagVideo,
    ReglageEmblemes,
    PlacementLibre,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly nav = inject(Navigation);
  protected readonly projets = PROJETS;
  protected readonly site = inject(LangueSite);
  protected readonly emblemes = EMBLEMES;

  /**
   * Les outils de réglage n'existent qu'en développement : ce sont des
   * instruments de mesure, pas des fonctionnalités. `@defer (when reglages)`
   * dans le gabarit fait le reste — en production le morceau n'est jamais
   * demandé. Et depuis le 25/09, même en développement, il faut « ?reglages »
   * dans l'adresse : les places sont trouvées, les panneaux gênaient.
   */
  protected readonly reglages = REGLAGES;

  /**
   * La largeur en cours. Rien n'est gardé d'une séance à l'autre : la règle
   * sert à TROUVER un nombre, qu'on recopie ensuite dans les constantes
   * ci-dessus. Un rechargement revient donc aux valeurs du code, et c'est
   * voulu.
   */
  protected readonly largeurLarge = signal(EMBLEME_LARGE);
  protected readonly largeurEtroit = signal(EMBLEME_ETROIT);
  protected readonly taillePoint = signal(POINT_MONDE);
  protected readonly voisins = signal(3);

  /**
   * LE NOMBRE DE PARTICULES SUIT LE CARRÉ DE LA TAILLE.
   *
   * Ce que l'œil lit, ce n'est pas le nombre de points, c'est leur densité à
   * l'écran : `N / côté²`. Un emblème deux fois plus étroit occupe quatre
   * fois moins de surface — à nombre constant, sa densité quadruple et le
   * réseau se referme en pâté. Mesuré le 10/09 : à 0,19 la couverture d'encre
   * est de 3 %, à 0,06 elle passe à 33 %.
   *
   * Et c'est bien le nombre qu'il faut corriger, pas la taille du point :
   * celle-ci ne dépend pas de l'emblème (voir `taillePoint` dans
   * `particules-logo.ts`), un point vaut ~2 px quoi qu'il arrive. En
   * rapetissant, les points ne s'effacent pas — ils se chevauchent.
   */
  protected readonly nombreLoi = computed(() => {
    const large = this.nav.format() === 'large';
    const origine = large ? EMBLEME_LARGE : EMBLEME_ETROIT;
    const depart = large ? PARTICULES_LARGE : PARTICULES_ETROIT;
    const rapport = this.largeurEmbleme() / origine;
    return Math.max(PARTICULES_MIN, Math.round(depart * rapport * rapport));
  });

  /**
   * Le nombre imposé à la main, ou `null` pour suivre la loi.
   *
   * La loi ne dit que ce qu'il faut pour garder la MÊME densité qu'à la
   * taille d'origine. C'est une référence, pas une contrainte : à 0,060 elle
   * propose 140 points, et 140 points ne dessinent plus le logo. Le bon
   * nombre est donc un compromis entre densité et lisibilité, et il se juge à
   * l'œil — d'où ce réglage, qui prend le pas sur elle.
   */
  protected readonly nombreImpose = signal<number | null>(null);

  protected readonly nombreEmbleme = computed(() => this.nombreImpose() ?? this.nombreLoi());
  protected readonly nombreLibre = computed(() => this.nombreImpose() !== null);

  /**
   * Le décor de la salle 2 a décodé sa première image.
   *
   * C'est LUI qui déclenche le chargement de Three.js, et pas l'inverse.
   * Demande de Paul, le 11/09 : « il faut que ce soit après avoir chargé le
   * contenu de la deuxième page, surtout pas avant ». Une bibliothèque 3D de
   * 588 Ko qui part en même temps que 8,6 Mo de vidéo se dispute la bande
   * passante avec elle, et les deux arrivent en retard.
   */
  protected readonly decorPret = signal(false);

  /**
   * La porte du temple, de la salle 2 à la salle Hermès — voir `app.html`.
   * Au téléphone, ses images portrait (Paul, 29/09).
   */
  protected readonly passageHermes = computed(() =>
    this.nav.format() === 'etroit' ? PASSAGE_HERMES_ETROIT : PASSAGE_HERMES,
  );

  protected readonly largeurEmbleme = computed(() =>
    this.nav.format() === 'large' ? this.largeurLarge() : this.largeurEtroit(),
  );
  protected readonly largeurOrigine = computed(() =>
    this.nav.format() === 'large' ? EMBLEME_LARGE : EMBLEME_ETROIT,
  );

  /** Le décalage à la main, en fractions d'écran ; z est en unités de scène. */
  // Gardés par `Placement` : l'outil de placement libre les règle à la souris.
  protected readonly placement = inject(Placement);
  protected readonly ecartX = computed(() => this.placement.courante().logoX);
  protected readonly ecartY = computed(() => this.placement.courante().logoY);
  protected readonly ecartZ = signal(ECART_Z);

  protected readonly zoneEmbleme = computed(() => {
    const large = this.nav.format() === 'large';
    const w = large ? this.largeurLarge() : this.largeurEtroit();
    const haut = large ? HAUT_LARGE : HAUT_ETROIT;
    return { x: CENTRE_X - w / 2 + this.ecartX(), y: haut + this.ecartY(), w };
  });

  protected reglerEmbleme(w: number): void {
    (this.nav.format() === 'large' ? this.largeurLarge : this.largeurEtroit).set(w);
    // Changer la largeur repart de la loi : sinon un nombre choisi pour une
    // taille resterait collé à la suivante, où il ne veut plus rien dire.
    this.nombreImpose.set(null);
  }

  protected reglerNombre(n: number): void {
    this.nombreImpose.set(Math.max(PARTICULES_MIN, Math.min(PARTICULES_MAX, Math.round(n))));
  }

  protected suivreLoi(): void {
    this.nombreImpose.set(null);
  }

  protected revenirEmbleme(): void {
    this.largeurLarge.set(EMBLEME_LARGE);
    this.largeurEtroit.set(EMBLEME_ETROIT);
    this.taillePoint.set(POINT_MONDE);
    this.voisins.set(3);
    this.nombreImpose.set(null);
    this.placement.poserLogo({ x: 0, y: placeDepart(this.nav.format(), 'repos').logoY });
    this.ecartZ.set(ECART_Z);
  }

  private tactileY: number | null = null;
  /** Le minuteur de fin de rafale de molette ; `null` hors rafale. */
  private rafale: ReturnType<typeof setTimeout> | null = null;

  /**
   * Quand un projet est ouvert, tout le reste de la page devient `inert` :
   * ni cliquable, ni atteignable au clavier, ni lu par un lecteur d'écran.
   * Sans cela, la tabulation continuerait de parcourir des ouvertures cachées
   * derrière le panneau.
   */
  protected readonly fond = computed(() => (this.nav.universOuvert() === null ? null : ''));

  /** « ?diag » dans l'adresse : le panneau de diagnostic des vidéos. */
  protected readonly diag =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('diag');

  ngOnInit(): void {
    this.nav.demarrer();
    if (typeof window === 'undefined') return;
    // La salle d'arrivée ne s'anime qu'une fois la page chargée — images,
    // polices — et peinte deux fois, pour que le verre ait son flou avant
    // d'entrer. Trois secondes au plus : un réseau lent ne la retient pas.
    const charge =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((ok) => addEventListener('load', () => ok(), { once: true }));
    const polices = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
    const auPlusTard = new Promise<void>((ok) => setTimeout(ok, 3000));
    const deuxImages = (ok: () => void) =>
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => requestAnimationFrame(ok))
        : ok();
    void Promise.race([Promise.all([charge, polices]), auPlusTard]).then(() =>
      deuxImages(() => this.nav.poserAuChargement()),
    );
  }

  // — Axe vertical : la profondeur —

  @HostListener('wheel', ['$event'])
  molette(evenement: WheelEvent): void {
    if (this.nav.universOuvert() !== null) return; // le panneau défile pour lui-même
    evenement.preventDefault();

    // UN geste de molette = UNE pièce. Une roue crantée envoie un événement,
    // un pavé tactile en envoie trente pour le même coup de doigt : on ne
    // compte donc pas les pixels, on compte les RAFALES. La première prend
    // la décision, les suivantes sont avalées jusqu'au silence.
    const nouvelle = this.rafale === null;
    if (this.rafale !== null) clearTimeout(this.rafale);
    this.rafale = setTimeout(() => (this.rafale = null), SILENCE_MOLETTE);
    if (nouvelle) this.nav.pieceSuivante(evenement.deltaY > 0 ? 1 : -1);
  }

  @HostListener('touchstart', ['$event'])
  toucher(evenement: TouchEvent): void {
    if (evenement.touches.length !== 1 || this.nav.universOuvert() !== null) return;
    this.tactileY = evenement.touches[0]!.clientY;
    this.nav.poserDoigt();
  }

  @HostListener('touchmove', ['$event'])
  glisser(evenement: TouchEvent): void {
    if (this.tactileY === null || this.nav.universOuvert() !== null) return;
    evenement.preventDefault();
    const y = evenement.touches[0]!.clientY;
    // Un écran de doigt vaut un écran de défilement — le facteur de
    // conversion est la hauteur de la vue, pas une constante arbitraire.
    const vue = window.innerHeight || 1; // repli pour ne jamais diviser par 0
    this.nav.glisserDoigt((this.tactileY - y) / vue);
    this.tactileY = y;
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  relacher(): void {
    this.tactileY = null;
    this.nav.leverDoigt();
  }

  @HostListener('window:keydown', ['$event'])
  clavier(evenement: KeyboardEvent): void {
    if (evenement.key === 'Escape') {
      this.nav.fermerUnivers();
      return;
    }
    // Tant qu'un projet est ouvert, les flèches appartiennent au panneau.
    if (this.nav.universOuvert() !== null) return;

    switch (evenement.key) {
      case 'ArrowDown':
      case 'PageDown':
        evenement.preventDefault();
        this.nav.pieceSuivante(1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        evenement.preventDefault();
        this.nav.pieceSuivante(-1);
        break;
      case 'Home':
        evenement.preventDefault();
        this.nav.viserProfondeur(0);
        break;
      case 'End':
        evenement.preventDefault();
        this.nav.viserProfondeur(this.nav.profondeurMax());
        break;
      default:
        break;
    }
  }

  @HostListener('window:hashchange')
  adresseChangee(): void {
    this.nav.appliquerHash();
  }
}
