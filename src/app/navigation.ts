// Le service de navigation : il tient l'état, fait glisser la caméra, et
// synchronise l'adresse de la page. Toute la mécanique de calcul vient de
// `coeur/` — rien n'est recodé ici.

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { grapheDe, RACINE, type Format } from './coeur/contenu';
import {
  cadreAvecDefilement,
  cadresEntiers,
  cheminProfondeur,
  decalerEcrans,
  hauteurDe,
  largeurA,
  profondeurDe,
  profondeurMax,
  segmentDe,
} from './coeur/geometrie';
import { sallesMontees } from './coeur/presentation';
import { deplacer, defiler, entrer, etatInitial, sortir, viser } from './coeur/etats';
import { defilementsDuSegment, glisser, poser, type Geste } from './coeur/gestes';
import {
  avancerGlissement,
  cibleRetenue,
  glissementArrive,
  type Glissement,
} from './coeur/glissement';
import { RETENUE_AU_DEPART, attenteAuDepart } from './coeur/choregraphie';
import { pageArrivee, tourner, type Pages } from './coeur/pages';
import { depuisHash, versHash } from './coeur/lien-hash';
import type { Etat } from './coeur/modele';

/**
 * Temps caractéristique du glissement, en secondes. La caméra suit un ressort
 * critiquement amorti (voir `coeur/glissement.ts`) : elle part immobile,
 * accélère, freine, et se pose sans dépasser — en gros au bout de 4 à 5 TAU.
 *
 * Exprimé en temps et non « par image » pour que le mouvement soit identique
 * à 60 et à 144 Hz.
 *
 * 0,22 parcourt 95 % du chemin en 1,04 s, contre 0,48 s pour l'approche
 * exponentielle du départ. Rallongé deux fois à la demande de Paul — mais
 * l'essentiel n'est pas là : c'est le DÉPART immobile qui a enlevé la
 * sensation de saut, et rallonger seul ne l'aurait pas donné. Au-delà, le
 * mouvement devient mou.
 */
const TAU = 0.22;

/**
 * À quel écart de la cible, en logarithme de largeur, la caméra est dite
 * posée : 0,005, soit un demi-pourcent de zoom — imperceptible.
 */
const POSE = 0.005;

/** Un cran de molette « standard » vaut environ 100 px de deltaY. */
const PIXELS_PAR_PIECE = 420;

/**
 * En portrait sous 900 px — téléphone ou petite tablette —, le texte passe
 * SOUS l'ouverture au lieu d'être posé à côté. La condition d'orientation
 * compte : un téléphone couché est large et court, la mise en page « à côté
 * de l'ouverture » lui convient mieux que l'empilement.
 * Cette requête DOIT rester identique à celle des feuilles de style, sans
 * quoi le placement des ouvertures et la mise en page du texte divergeraient.
 */
const REQUETE_ETROIT = '(orientation: portrait) and (max-width: 900px)';

function formatCourant(): Format {
  if (typeof matchMedia !== 'function') return 'large';
  return matchMedia(REQUETE_ETROIT).matches ? 'etroit' : 'large';
}

@Injectable({ providedIn: 'root' })
export class Navigation {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Le format d'écran choisit le placement des ouvertures. Il est suivi en
   * direct : faire pivoter un téléphone recompose les pièces, et la caméra
   * glisse vers le nouveau cadre au lieu de sauter.
   */
  private readonly formatInterne = signal<Format>(formatCourant());
  /**
   * Le format en cours. Public parce que la descente pré-calculée en dépend :
   * ses images sont celles de la photo du seuil, et la photo n'est PAS
   * affichée en format étroit. Les peindre là reviendrait à poser un
   * tee-shirt sur une mise en page qui ne le contient pas.
   */
  readonly format = this.formatInterne.asReadonly();
  readonly graphe = computed(() => grapheDe(this.formatInterne()));
  readonly chemin = computed(() => cheminProfondeur(this.graphe(), RACINE));
  readonly profondeurMax = computed(() => profondeurMax(this.graphe(), RACINE));

  private readonly etatInterne = signal<Etat>(etatInitial());
  /** Où l'on veut être. */
  readonly etat = this.etatInterne.asReadonly();

  private readonly profondeurAfficheeInterne = signal(0);
  /** Où la caméra est réellement, en train de rattraper `etat.profondeur`. */
  readonly profondeurAffichee = this.profondeurAfficheeInterne.asReadonly();

  private readonly sallePresenteInterne = signal<string | null>(null);
  /**
   * La salle où l'on est POSÉ : la caméra y est arrivée et ne bouge plus.
   * `null` dès qu'on la quitte — au premier cran de molette, avant même que
   * la caméra ait bougé — et jusqu'à ce qu'elle se pose dans la suivante.
   *
   * C'est le signal des chorégraphies (voir `coeur/choregraphie.ts`) : les
   * éléments d'une salle entrent quand elle devient présente, et sortent dès
   * qu'elle cesse de l'être.
   */
  readonly sallePresente = this.sallePresenteInterne.asReadonly();

  /**
   * La retenue de la caméra au départ d'une salle chorégraphiée : d'où elle
   * part (en logarithme de largeur), quand, et pour combien de secondes.
   * `depart` : la salle qui reste présente jusqu'à `debut`, le temps de sa
   * sortie préalable (`ATTENTE_AU_DEPART`) ; la caméra ne bouge pas d'ici là.
   */
  private retenue: {
    depuis: number;
    debut: number;
    duree: number;
    depart: string | null;
  } | null = null;

  private readonly salleEnPartanceInterne = signal<string | null>(null);
  /**
   * La salle qu'on a quittée mais qui joue encore sa SORTIE PRÉALABLE : elle
   * reste présente, la caméra attend, immobile, et seul ce qui doit partir
   * d'abord s'en va — les cartes de la salle 2 dans leur fumée (Paul, 25/09).
   * `null` le reste du temps.
   */
  readonly salleEnPartance = this.salleEnPartanceInterne.asReadonly();

  private readonly pagesInterne = signal<ReadonlyMap<string, Pages>>(new Map());
  /**
   * Où en est la carte de texte de chaque salle (voir `coeur/pages.ts`). Gardé
   * même quand la salle est démontée : on la retrouve à la page où on l'a
   * laissée — ou à celle où l'on doit y arriver.
   */
  readonly pages = this.pagesInterne.asReadonly();

  private readonly buteeInterne = signal(0);
  /**
   * Le dépassement élastique au-delà du bord de la pièce, en hauteurs de vue.
   * Signé : positif au-delà du bas. Le doigt le pousse, il retombe seul.
   */
  readonly butee = this.buteeInterne.asReadonly();

  /** Le geste du doigt en cours : `null` tant qu'aucun doigt n'est posé. */
  private geste: Geste | null = null;

  /**
   * La pièce d'origine du trajet : la profondeur entière qu'on occupait avant
   * le dernier changement. Elle décide, avec la cible, par quel bord on
   * quitte la pièce (voir `defilementsDuSegment`).
   */
  private readonly origineInterne = signal(0);
  readonly origine = this.origineInterne.asReadonly();

  // Le cadre affiché compose enfin les trois morceaux que le lot assemble :
  // le segment de la caméra, la règle d'arrivée (où se pose la caméra) et la
  // butée élastique qui dépasse du bord.
  readonly cadreAffiche = computed(() => {
    const g = this.graphe();
    const d = this.profondeurAffichee();
    const [depart, arrivee] = defilementsDuSegment(segmentDe(g, RACINE, d), {
      origine: this.origine(),
      cible: Math.round(this.etat().profondeur),
      defilementCible: this.etat().defilement ?? 0,
    });
    return decalerEcrans(cadreAvecDefilement(g, RACINE, d, depart, arrivee), this.butee());
  });
  /**
   * Le cadre de chaque salle aux profondeurs entières : là où elle est posée
   * dans le repère de la caméra. Chaque salle en tire sa propre
   * transformation — il n'y a plus de `transform` unique sur une scène où
   * elles seraient emboîtées (voir `transformationSalle`, 23/09).
   */
  readonly cadresSalles = computed(() => cadresEntiers(this.graphe(), RACINE));

  /** Les salles qui existent dans la page : les autres sont démontées. */
  readonly sallesMontees = computed(() =>
    sallesMontees(this.profondeurAffichee(), this.chemin(), this.graphe()),
  );
  readonly universOuvert = computed(() => this.etat().univers);

  private readonly cartesAfficheesInterne = signal<readonly string[]>([]);
  /**
   * Les projets dont la carte est affichée en grand, TANT QU'ELLE EST À
   * L'ÉCRAN — y compris pendant son animation de fermeture, quand
   * `universOuvert` est déjà revenu à `null`. Il peut y en avoir deux : une
   * carte qui se referme encore, et une autre qu'on vient d'ouvrir sans
   * attendre (Paul, 27/09). C'est ce que suit la salle 2 : leurs vignettes
   * restent masquées tant que leur copie est là.
   * Seule la carte ouverte (`pz-univers`) l'écrit.
   */
  readonly cartesAffichees = this.cartesAfficheesInterne.asReadonly();

  /** Réservé à `pz-univers` : les cartes à l'écran. */
  afficherCartes(ids: readonly string[]): void {
    this.cartesAfficheesInterne.set(ids);
  }

  /** La pièce dont on est le plus proche : sert à l'indicateur et au hash. */
  readonly pieceCourante = computed(
    () => this.chemin()[Math.round(this.profondeurAffichee())] ?? RACINE,
  );

  private image: number | null = null;
  private horodatage = 0;
  /** La vitesse du glissement, en logarithme de largeur par seconde. */
  private vitesse = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.arreterGlissement());

    if (typeof matchMedia === 'function') {
      const etroit = matchMedia(REQUETE_ETROIT);
      const suivre = () => this.formatInterne.set(etroit.matches ? 'etroit' : 'large');
      etroit.addEventListener('change', suivre);
      this.destroyRef.onDestroy(() => etroit.removeEventListener('change', suivre));
    }
  }

  // — Mise en route (appelée par le composant racine, qui a le DOM) —

  demarrer(): void {
    this.appliquerHash();
    this.profondeurAfficheeInterne.set(this.etat().profondeur);
  }

  /**
   * La caméra est posée dès le démarrage, mais la salle ne devient PRÉSENTE
   * — ce qui lance sa chorégraphie d'entrée — qu'une fois la page chargée
   * (le composant racine appelle ceci). Paul, le 24/09 : au chargement, la
   * carte de la salle Hermès apparaissait en place, et son verre se floutait
   * une fraction de seconde après. Entrée depuis le bord de l'écran, elle
   * n'arrive à sa place qu'avec un flou déjà prêt. Si l'on a bougé entre-
   * temps, c'est l'arrivée de la caméra qui s'en est chargée.
   */
  poserAuChargement(): void {
    if (this.image !== null || this.sallePresente() !== null) return;
    this.sallePresenteInterne.set(this.salleDe(this.etat().profondeur));
  }

  /** La salle d'une profondeur entière, `null` entre deux salles. */
  private salleDe(profondeur: number): string | null {
    if (!Number.isInteger(profondeur)) return null;
    return this.chemin()[profondeur] ?? null;
  }

  appliquerHash(): void {
    if (typeof location === 'undefined') return;
    this.etatInterne.set(depuisHash(location.hash, this.graphe(), RACINE));
  }

  ecrireHash(): void {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    const ancre = versHash(this.etat(), this.graphe(), RACINE);
    const cible = ancre === '' ? location.pathname + location.search : `#${ancre}`;
    if (location.hash.replace(/^#/, '') !== ancre) {
      history.replaceState(null, '', cible);
    }
  }

  // — Les deux axes —

  /** Défilement : `pixels` est un deltaY de molette ou un glissement tactile. */
  defiler(pixels: number): void {
    this.majEtat(deplacer(this.etat(), pixels / PIXELS_PAR_PIECE, this.graphe(), RACINE));
  }

  /**
   * Aller à une profondeur précise (clic, clavier, lien). La règle d'arrivée
   * de PH-1 s'applique ici : on descend, on pose la caméra en haut de la
   * pièce visée ; on remonte, on pose en bas — remonter par le haut ferait
   * sauter tout le contenu qu'on vient de parcourir.
   */
  viserProfondeur(profondeur: number): void {
    const etat = viser(this.etat(), profondeur, this.graphe(), RACINE);
    if (etat === this.etat()) return;
    if (etat.profondeur !== this.etat().profondeur) {
      // La carte de la salle visée s'ouvre à sa première page en descendant,
      // à sa dernière en remontant.
      const salle = this.salleDe(etat.profondeur);
      if (salle !== null) this.arriverAuxPages(salle, etat.profondeur > this.etat().profondeur ? 1 : -1);
      // On descend (nouvelle profondeur plus grande) : on arrive en haut (0).
      // On remonte : on arrive en bas (1).
      const defilement = etat.profondeur < this.etat().profondeur ? 1 : 0;
      this.majEtat(defiler(etat, defilement));
    } else {
      this.majEtat(etat);
    }
  }

  /**
   * D'une pièce à la voisine, en repartant de la pièce la plus proche — SAUF
   * si la carte de texte de la salle où l'on est a encore une page dans ce
   * sens : c'est alors la page qui tourne, et la salle ne change pas.
   *
   * C'est la seule porte : la molette, les flèches et le doigt passent tous
   * par ici. Les sauts directs (repères, Début/Fin, liens) n'y passent pas,
   * et ne tournent donc jamais de page.
   */
  pieceSuivante(sens: 1 | -1): void {
    const ici = this.etat().profondeur;
    // La caméra doit être au moins à mi-chemin de la salle : pendant qu'on la
    // quitte, un second cran continue le voyage au lieu de feuilleter.
    const salle = Math.round(this.profondeurAffichee()) === ici ? this.salleDe(ici) : null;
    const pages = salle === null ? undefined : this.pages().get(salle);
    const page = pages === undefined ? null : tourner(pages.page, pages.total, sens);
    if (salle !== null && page !== null) {
      this.allerPage(salle, page);
      return;
    }
    this.viserProfondeur(Math.round(this.profondeurAffichee()) + sens);
  }

  // — Les pages des cartes de texte (voir `coeur/pages.ts`) —

  /** La carte de texte d'une salle dit combien elle a de pages. */
  declarerPages(salle: string, total: number): void {
    const avant = this.pages().get(salle);
    // Une page demandée avant que la carte existe (on arrive par le bas dans
    // une salle pas encore montée) est ramenée dans les bornes ici.
    const page = Math.min(avant?.page ?? 0, total - 1);
    if (avant?.page === page && avant.total === total) return;
    this.poserPages(salle, { page, total });
  }

  allerPage(salle: string, page: number): void {
    const avant = this.pages().get(salle);
    if (avant === undefined || page < 0 || page >= avant.total || page === avant.page) return;
    this.poserPages(salle, { page, total: avant.total });
  }

  private arriverAuxPages(salle: string, sens: 1 | -1): void {
    const avant = this.pages().get(salle);
    // Carte pas encore montée : on ne connaît pas son nombre de pages.
    // « La dernière » s'écrit alors comme un plafond, que `declarerPages`
    // ramènera à la vraie dernière page.
    const page =
      avant === undefined || avant.total === 0
        ? sens === 1
          ? 0
          : Number.MAX_SAFE_INTEGER
        : pageArrivee(avant.total, sens);
    this.poserPages(salle, { page, total: avant?.total ?? 0 });
  }

  private poserPages(salle: string, pages: Pages): void {
    const suite = new Map(this.pages());
    suite.set(salle, pages);
    this.pagesInterne.set(suite);
  }

  /** Entrée latérale : la profondeur n'est pas touchée. */
  ouvrirUnivers(univers: string): void {
    this.majEtat(entrer(this.etat(), univers, this.graphe()));
  }

  /** Sortie latérale : on ressort exactement là où on était. */
  fermerUnivers(): void {
    this.majEtat(sortir(this.etat()));
  }

  // — Le doigt (voir `coeur/gestes.ts`) —

  /** Le doigt se pose : un geste s'ouvre sur le défilement courant. */
  poserDoigt(): void {
    this.geste = poser(this.etat().defilement ?? 0);
  }

  /**
   * Le doigt glisse de `ecrans` hauteurs de vue, positif quand on descend.
   * Le défilement suit le doigt sans animation — c'est lui qui pilote — et
   * un franchissement, s'il se déclenche, referme le geste.
   */
  glisserDoigt(ecrans: number): void {
    if (this.geste === null) return; // un touchmove sans touchstart : on ne plante pas
    const g = this.graphe();
    const chemin = this.chemin();
    const piece = chemin[Math.round(this.etat().profondeur)] ?? RACINE;
    const r = glisser(this.geste, ecrans, hauteurDe(g, piece));
    this.geste = r.geste;
    // Le doigt pilote, il n'anime rien : on publie directement, sans passer
    // par `majEtat` (qui lancerait le glissement de la caméra). Le hash est
    // laissé tel quel — il n'encode pas le défilement.
    this.etatInterne.set(defiler(this.etat(), r.defilement));
    // Un geste qui va TOURNER UNE PAGE de la salle (une carte de projet, une
    // page de carte de texte) déclenche une action, pas un mouvement (Paul,
    // 29/09) : rien ne suit le doigt. La butée élastique reste pour les
    // départs vers une autre salle, où elle annonce le voyage.
    this.buteeInterne.set(this.pageATourner(Math.sign(r.butee)) ? 0 : r.butee);
    if (r.franchir !== 0) {
      // Le franchissement consomme le geste : on le referme comme un lever de
      // doigt, puis on part vers la pièce voisine.
      this.geste = null;
      this.buteeInterne.set(0);
      this.pieceSuivante(r.franchir);
    }
  }

  /** La salle où l'on est a-t-elle une page à tourner dans ce sens ? */
  private pageATourner(sens: number): boolean {
    if (sens === 0) return false;
    const ici = this.etat().profondeur;
    if (Math.round(this.profondeurAffichee()) !== ici) return false;
    const salle = this.salleDe(ici);
    const pages = salle === null ? undefined : this.pages().get(salle);
    return pages !== undefined && tourner(pages.page, pages.total, sens > 0 ? 1 : -1) !== null;
  }

  /** Le doigt se lève : le geste se referme et la butée retombe. */
  leverDoigt(): void {
    this.geste = null;
    // En mouvement réduit, la butée tombe à 0 d'un coup, comme la profondeur.
    if (this.mouvementReduit()) {
      this.buteeInterne.set(0);
      return;
    }
    // La butée doit revenir : on démarre la boucle même si la profondeur est
    // déjà à sa cible (c'est souvent le cas — la butée ne la change pas).
    if (this.image === null) this.demarrerGlissement();
  }

  // — Le glissement —

  private majEtat(etat: Etat): void {
    if (etat === this.etat()) return;
    // L'origine suit la cible : si la pièce la plus proche change, l'ancienne
    // valeur devient l'origine du trajet. Une ligne — et ça vaut pour la
    // molette, le clavier et les gestes à la fois.
    if (Math.round(etat.profondeur) !== Math.round(this.etat().profondeur)) {
      this.origineInterne.set(Math.round(this.etat().profondeur));
    }
    // Quitter la salle où l'on était posé : sa chorégraphie de sortie part
    // TOUT DE SUITE, et la caméra, si la salle le demande, prend son élan
    // en douceur pendant ce temps. Revenir vers elle en chemin annule la
    // retenue : on ne freine pas un retour.
    //
    // Sauf si la salle a d'abord une SORTIE PRÉALABLE à jouer (les cartes de
    // la salle 2 dans leur fumée) : elle reste alors présente, la caméra
    // attend sans bouger, et le départ habituel ne commence qu'après
    // (`ATTENTE_AU_DEPART`, dans `coeur/choregraphie.ts`).
    const presente = this.sallePresente();
    const quitte = presente !== null && this.salleDe(etat.profondeur) !== presente;
    // Un nouveau cran PENDANT l'attente ne la fait pas recommencer.
    const attenteEnCours = quitte && this.retenue?.depart === presente ? this.retenue : null;
    this.retenue = null;
    this.salleEnPartanceInterne.set(null);
    if (quitte && !this.mouvementReduit()) {
      const depuis = Math.log(largeurA(this.graphe(), RACINE, this.profondeurAffichee()));
      const duree = RETENUE_AU_DEPART[presente] ?? 0;
      const attente = attenteAuDepart(presente, this.pages().get(presente)?.page ?? 0, this.format());
      if (attente > 0) {
        this.salleEnPartanceInterne.set(presente);
        this.retenue = attenteEnCours ?? {
          depuis,
          debut: performance.now() + attente * 1000,
          duree,
          depart: presente,
        };
      } else {
        this.sallePresenteInterne.set(null);
        if (duree > 0) this.retenue = { depuis, debut: performance.now(), duree, depart: null };
      }
    } else if (quitte) {
      this.sallePresenteInterne.set(null);
    }
    this.etatInterne.set(etat);
    this.ecrireHash();
    if (this.mouvementReduit()) {
      this.profondeurAfficheeInterne.set(etat.profondeur);
      this.buteeInterne.set(0);
      this.vitesse = 0;
      this.sallePresenteInterne.set(this.salleDe(etat.profondeur));
      return;
    }
    this.demarrerGlissement();
  }

  private mouvementReduit(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private demarrerGlissement(): void {
    if (this.image !== null) return;
    this.horodatage = performance.now();
    this.image = requestAnimationFrame((t) => this.pas(t));
  }

  private arreterGlissement(): void {
    if (this.image !== null) cancelAnimationFrame(this.image);
    this.image = null;
  }

  private pas(t: number): void {
    const dt = Math.min((t - this.horodatage) / 1000, 0.1);
    this.horodatage = t;

    const arrivee = this.etat().profondeur;

    // La convergence se fait sur la LARGEUR du cadre, pas sur la profondeur :
    // c'est ce qui rend le zoom géométrique. À vitesse constante en
    // profondeur, l'approche paraîtrait ralentir près du but.
    const vraieCible = Math.log(largeurA(this.graphe(), RACINE, arrivee));
    let cible = vraieCible;
    if (this.retenue !== null) {
      const ecoule = (t - this.retenue.debut) / 1000;
      // La sortie préalable est jouée : la salle part pour de bon, et sa
      // chorégraphie de sortie habituelle commence.
      if (ecoule >= 0 && this.retenue.depart !== null) {
        this.retenue = { ...this.retenue, depart: null };
        this.salleEnPartanceInterne.set(null);
        this.sallePresenteInterne.set(null);
      }
      cible =
        ecoule < 0
          ? this.retenue.depuis
          : cibleRetenue(this.retenue.depuis, vraieCible, ecoule, this.retenue.duree);
      if (ecoule >= this.retenue.duree) this.retenue = null;
    }
    const ici: Glissement = {
      position: Math.log(largeurA(this.graphe(), RACINE, this.profondeurAffichee())),
      vitesse: this.vitesse,
    };
    const suivant = avancerGlissement(ici, cible, dt, TAU);
    this.vitesse = suivant.vitesse;

    // POSÉ, ce n'est pas ARRIVÉ. Le ressort finit sur une traîne très longue :
    // mesuré le 23/09, la caméra semble immobile depuis deux secondes quand il
    // se déclare arrivé. La chorégraphie d'entrée n'attend pas ça — à 0,5 %
    // de zoom près, plus rien ne bouge à l'œil.
    if (
      this.retenue === null &&
      this.sallePresente() === null &&
      Math.abs(suivant.position - vraieCible) < POSE
    ) {
      this.sallePresenteInterne.set(this.salleDe(arrivee));
    }

    // Pas d'arrivée tant que la cible est retenue : au premier instant, elle
    // est exactement là où l'on est, et on croirait être déjà arrivé.
    const profondeurArrivee = this.retenue === null && glissementArrive(suivant, cible, TAU);
    if (profondeurArrivee) {
      this.profondeurAfficheeInterne.set(arrivee);
      this.vitesse = 0;
      this.sallePresenteInterne.set(this.salleDe(arrivee));
    } else {
      this.profondeurAfficheeInterne.set(
        profondeurDe(this.graphe(), RACINE, Math.exp(suivant.position)),
      );
    }

    // La butée retombe toute seule — mais seulement quand aucun doigt n'est
    // posé : un doigt en cours de geste pilote la butée lui-même. Elle garde
    // sa détente exponentielle, qui lui va : elle ne « part » de nulle part,
    // elle relâche une tension déjà installée.
    if (this.geste === null) {
      const butee = this.butee() * Math.exp(-dt / TAU);
      this.buteeInterne.set(Math.abs(butee) < 1e-4 ? 0 : butee);
    }

    if (profondeurArrivee && this.butee() === 0) {
      this.image = null;
      return;
    }
    this.image = requestAnimationFrame((t2) => this.pas(t2));
  }
}
