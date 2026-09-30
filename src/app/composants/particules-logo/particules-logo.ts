// Un ou plusieurs logos en particules reliées par des filaments, en vraie 3D,
// qui se transforment l'un en l'autre.
//
// POURQUOI DE LA VRAIE 3D, ET PAS UNE FAUSSE. Quelques milliers de points
// dans un `Points` Three.js, c'est UN seul appel de dessin ; simuler la
// perspective en 2D obligerait à trier et redessiner à la main ce que la
// carte graphique fait gratuitement, pour un volume moins bon. Décision prise
// le 07/09, elle n'est pas à reprendre.
//
// POURQUOI LES FILAMENTS NE SONT PAS UN ORNEMENT. Mot de Paul, en capitales :
// « il est INDISPENSABLE d'avoir des filaments de liaison entre les
// particules ». Des points isolés font un ciel étoilé, pas un réseau — et
// c'est le réseau qui est la signature d'Intuition.
//
// POURQUOI LE MORPHE. Idée de Paul, le 07/09 : sur un téléphone il n'y a pas
// la place pour deux emblèmes, mais si UN emblème devient l'autre par
// intervalles, les deux institutions restent présentes pour moitié moins de
// particules. Sur grand écran on garde deux emplacements, DÉPHASÉS : quand
// l'un montre Intuition l'autre montre THP, et ils échangent. Les deux logos
// sont donc toujours visibles, jamais les deux fois le même.
//
// CE QUE LE MORPHE IMPOSE. Chaque particule voyage d'une position à l'autre,
// donc les deux nuages doivent avoir EXACTEMENT le même nombre de particules,
// et être appariés. Ils sont triés par angle autour du centre avant
// l'appariement : sans ça, chaque point traverserait le logo en diagonale et
// la transformation serait un brouillard au lieu d'un mouvement.
//
// POURQUOI LA CONTRE-ROTATION SURVIT. Les deux anneaux d'Intuition tournent en
// sens contraires — c'était deux sous-nuages, ce que le morphe interdit
// (il lui faut un seul tableau apparié). Le sens est donc porté PAR PARTICULE,
// chacune sachant de quel anneau elle vient, et il s'estompe pendant la
// transformation. Rien n'est perdu.
//
// POURQUOI LA TOILE EST POSÉE PAR-DESSUS LA SCÈNE, JAMAIS DEDANS. Le § 3 du
// doc de la salle 2 pariait qu'une toile placée DANS la salle serait nette,
// l'échelle nette y valant 1. C'est vrai d'une image, c'est FAUX d'une toile
// WebGL : mesuré le 07/09, une toile de 373×373 posée dans la salle n'était
// peinte que sur 251×270, décalée de (122, 43) ; la même, hors de la scène,
// est peinte à 300×300 sur 300×300. La scène porte un `transform: scale(457)`
// et le navigateur compose la toile de travers. On la pose donc par-dessus —
// comme la descente, pour une raison voisine — et c'est `zoneEcran` qui
// calcule où la poser.
//
// POURQUOI LA BOUCLE S'ARRÊTE. Hors de la salle, la boucle de rendu est
// réellement stoppée, pas seulement masquée : une boucle arrêtée coûte zéro
// batterie.
//
// POURQUOI DEUX SOURCES DE GÉOMÉTRIE. Les anneaux d'Intuition viennent d'un
// maillage `.glb` modélisé par Paul : ils ont un vrai volume, et les
// particules sont semées sur leur SURFACE. THP n'a pas de modèle 3D — c'est
// une image plate, échantillonnée par sa luminosité puis épaissie sur ses
// flancs de la même profondeur que les anneaux.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { Navigation } from '../../navigation';
import { zoneEcran } from '../../coeur/geometrie';
import { opaciteContenu, opaciteOuvertureInvisible } from '../../coeur/presentation';
import {
  dansLaZone,
  densiteDepuisLuminance,
  echantillonner,
  filaments,
  fondDominant,
  normaliser,
  renforcer,
  trierParAngle,
  type LogoDefini,
  type Particule,
} from '../../coeur/particules';
import type { Cadre } from '../../coeur/modele';

/** Le gris des particules : la lumière est rare chez Intuition, donc franche. */
const GRIS_PARTICULE = 0xececec;
/** Celui des filaments : le réseau se devine, il ne domine pas. */
const GRIS_FILAMENT = 0x8a8a8a;
/** L'opacité des filaments au repos ; elle tombe à zéro pendant le morphe. */
const OPACITE_FILAMENT = 0.4;

/**
 * L'épaisseur du flanc, en fraction de la largeur du logo.
 *
 * Ce n'est pas un chiffre choisi : c'est celui MESURÉ sur les anneaux de Paul
 * une fois normalisés (z ∈ [-0,054 ; +0,054]).
 */
const FLANC = 0.108;

/** Sous quel niveau au-dessus du fond un pixel ne produit aucune particule. */
const PLANCHER = 8;

/** Un logo prêt à être affiché et apparié avec un autre. */
/** Le temps de main immobile avant de relancer un semis, en millisecondes. */
const ATTENTE_SEMIS = 160;

/**
 * La constante de temps du glissement de la zone, en secondes : d'une place à
 * l'autre, le logo a fait 95 % du chemin en trois fois ce temps (1,35 s).
 */
const GLISSE_ZONE = 0.45;

/** Le plafond de résolution de rendu — voir `ajusterToile`. */
const PIXELS_MAX = 1.5;

/** L'ouverture verticale de la caméra, en degrés, et sa distance au nuage. */
const CHAMP = 35;
const CAMERA_Z = 1.9;

/**
 * L'ENTRÉE ET LA SORTIE. Les particules ne sont pas posées : elles arrivent de
 * hors écran et se rassemblent, et elles repartent quand on quitte la salle.
 *
 * POURQUOI C'EST UNE PRÉSENCE ET PAS UNE ANIMATION. Une animation se joue une
 * fois ; ici il faut que le mouvement soit RÉVERSIBLE et se rejoue à chaque
 * passage — Paul, le 11/09 : « quand tu quittes une pièce, tu fais l'inverse,
 * les particules repartent vers l'extérieur de l'écran ; et quand tu
 * re-rentres, elles reviennent ». On tient donc une seule valeur, la
 * `presence`, qui poursuit sa consigne (1 dans la salle, 0 ailleurs) à vitesse
 * bornée. Toutes les positions en découlent. Changer d'avis à mi-chemin
 * inverse le mouvement sans le moindre saut, et ça marche dans les deux sens
 * comme avec n'importe quelle pièce voisine.
 *
 * POURQUOI LA SORTIE EST TROIS FOIS PLUS COURTE. Elle est en concurrence avec
 * le zoom : dès qu'on remonte, la salle rapetisse et l'emblème avec elle. À
 * 3,6 s la présence n'aurait pas baissé d'un tiers que la pièce serait déjà
 * hors de vue, et on ne verrait rien partir.
 *
 * POURQUOI LA VUE S'ÉLARGIT PENDANT CE TEMPS. Le rendu ordinaire découpe un
 * carré de quelques centaines de pixels (`setScissor`) : tout ce qui en sort
 * est coupé net, donc une particule « venue de l'extérieur » apparaîtrait sur
 * le bord du carré au lieu de traverser l'écran. Tant que la présence n'est
 * pas pleine, on peint donc l'écran entier — et `setViewOffset` décale le
 * tronc de projection exactement de ce qu'il faut pour que l'emblème reste, au
 * pixel près, à la place et à la taille qu'il aura ensuite.
 *
 * POURQUOI LES DÉPARTS SONT ÉCHELONNÉS. Toutes les particules parties
 * ensemble font un mur qui se referme ; échelonnées, elles font un afflux.
 *
 * POURQUOI LE HAUT DOMINE. Demande de Paul : « soixante pour cent viennent du
 * haut, le reste vient de tout le reste de l'écran ». Une direction
 * privilégiée donne un sens de lecture ; les quatre bords à parts égales
 * donneraient une implosion symétrique, beaucoup plus banale.
 */
const ENTREE_DUREE = 3.6;
/**
 * La sortie, elle, court contre le zoom. Le glissement de caméra est un
 * ressort critiquement amorti de temps caractéristique 0,22 s : en quittant la
 * salle 2 vers le seuil, l'emblème passait de 259 px à 7 px en 0,44 s — d'où
 * 0,45 s jusqu'au 23/09. Depuis, la caméra est RETENUE au départ de la salle 2
 * (`RETENUE_AU_DEPART`) et la sortie démarre dès le premier cran de molette,
 * au lieu d'attendre que la salle s'efface : elle a le temps de se voir en
 * 0,7 s, avec les cartes et le texte.
 */
const SORTIE_DUREE = 0.7;
/** La part de la présence sur laquelle les départs s'échelonnent. */
const ENTREE_ETALEMENT = 0.45;
/** Les parts cumulées : haut, puis gauche, puis droite, puis le bas. */
const ENTREE_BORDS = [0.6, 0.76, 0.92] as const;
/** De combien, au-delà du bord de l'écran, les particules attendent leur tour. */
const ENTREE_MARGE = 0.35;
/** À partir de quelle présence les filaments se rallument. */
const ENTREE_FILAMENTS = 0.55;
/** Sous ce côté en pixels, la salle est trop loin : plus rien à peindre. */
const COTE_MINIMAL = 4;

/**
 * LA RÉPULSION. La souris écarte les particules qu'elle approche, et le nuage
 * se recompose derrière elle.
 *
 * Choix de Paul le 11/09, après avoir vu le souffle : « c'est bien la
 * répulsion qu'il fallait ». La différence est de nature et pas de dosage — le
 * souffle dilatait le nuage entier en préservant la forme, la répulsion la
 * CREUSE là où passe le curseur, et les filaments s'étirent avec.
 *
 * Le curseur est ramené dans le repère du nuage par les rotations inverses,
 * sans quoi un logo tourné de 80° sur son axe vertical serait poussé de
 * travers : ce qu'on écarte, c'est ce qu'on voit sous la souris.
 */
/*
 * Les valeurs à l'essai, demandées par Paul le 11/09. Le nuage mesure
 * x ∈ [-0,466 ; 0,466] et y ∈ [-0,5 ; 0,5] : un rayon de 0,1 ne touche donc
 * qu'un dixième de la demi-hauteur, et une force de 0,5 projette la particule
 * du point de contact d'une demi-hauteur entière — cinq fois le rayon. C'est
 * une gerbe serrée et violente, là où 0,5 / 0,22 creusait largement et
 * doucement. Les deux extrêmes de la même mécanique, à juger à l'œil.
 */
const REPULSION_RAYON = 5.0;
const REPULSION_FORCE = 0.1;
/** La vitesse d'établissement, en fraction rattrapée par seconde. */
const REPULSION_VITESSE = 0.005;

/**
 * LES FLUX (Paul, 25/09). Des particules naissent DANS LES LETTRES des deux
 * mots du titre, THP à gauche et INTUITION à droite, et coulent vers le logo
 * pour l'alimenter : les deux partenaires nourrissent la même chose.
 *
 * Plus grosses au départ, pour qu'on les voie et qu'on voie leurs filaments ;
 * elles rétrécissent en chemin jusqu'à la taille exacte des particules du logo,
 * et finissent SUR l'une d'elles — là, elles s'y confondent et disparaissent
 * sans qu'on voie de coupure.
 *
 * Elles ne sont pas dans le groupe du logo, qui tourne : elles vivent dans le
 * repère du monde, et c'est leur CIBLE qu'on ramène du repère du logo à chaque
 * image, puisqu'elle tourne et se transforme avec lui.
 */
/** Combien de particules en vol au plus, les deux flux ensemble. */
const FLUX_MAX = 420;
/** Combien en naissent par seconde, les deux flux ensemble, à plein débit. */
const FLUX_DEBIT = 90;
/** La durée d'un trajet, en secondes : chacune tire la sienne dans cette plage. */
const FLUX_DUREE_MIN = 3;
const FLUX_DUREE_MAX = 4.6;
/** Le temps pour que le débit s'établisse, ou s'éteigne. */
const FLUX_MONTEE = 1.5;
/** La taille au départ, en multiple de celle des particules du logo. */
const FLUX_GROS = 4.8;
/** La part du trajet pendant laquelle une particule sort de sa lettre. */
const FLUX_ECLOSION = 0.12;
/** Le plafond des filaments par particule en vol (le nombre se règle en entrée). */
const FLUX_VOISINS_MAX = 8;
/** La courbure des trajets, en fraction de leur longueur (signée au hasard). */
const FLUX_COURBURE = 0.28;
/** La marge du rendu autour des mots et du logo, en fraction du logo. */
const FLUX_MARGE = 0.45;

/** Les points d'une particule de flux : un disque doux, à taille propre. */
const FLUX_SOMMETS = `
  attribute float taille;
  attribute float alpha;
  uniform float echelle;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(taille * echelle / -mv.z, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = alpha;
  }
`;
const FLUX_FRAGMENTS = `
  uniform vec3 couleur;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(couleur, vAlpha * 0.95 * smoothstep(0.5, 0.3, d));
  }
`;

/** Un rectangle d'écran, en pixels CSS. */
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly h: number;
}

/** L'état des particules en vol, en tableaux plats. */
interface EtatFlux {
  readonly vivant: Uint8Array;
  /** Le départ, en unités du monde : 3 par particule. */
  readonly depart: Float32Array;
  readonly cible: Int32Array;
  readonly naissance: Float64Array;
  readonly duree: Float32Array;
  readonly courbe: Float32Array;
}

interface EtatLogo {
  points: readonly Particule[];
  /** Le sens de circulation de chaque particule : +1, -1, ou 0. */
  sens: readonly number[];
  paires: readonly (readonly [number, number])[];
}

@Component({
  selector: 'pz-particules-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // L'opacité n'est PAS liée : elle est écrite image par image dans la boucle
  // de rendu. Une liaison relancerait la détection de changement soixante fois
  // par seconde, et surtout elle ne saurait pas garder le calque peint pendant
  // que les particules finissent de sortir.
  host: {
    class: 'particules-logo',
    'aria-hidden': 'true',
    style: 'opacity: 0',
  },
  template: `<canvas #toile class="particules-logo__toile"></canvas>`,
  styleUrl: './particules-logo.css',
})
export class ParticulesLogo {
  private readonly nav = inject(Navigation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hote = inject(ElementRef<HTMLElement>);
  private readonly toile = viewChild<ElementRef<HTMLCanvasElement>>('toile');

  /** Les logos à montrer tour à tour. Un seul : pas de morphe. */
  readonly logos = input.required<readonly LogoDefini[]>();
  /** La pièce à laquelle l'emblème appartient. */
  readonly piece = input.required<string>();
  /** Où l'emblème se pose DANS cette pièce, en fractions de pièce. */
  readonly zone = input.required<Cadre>();
  /** Combien de particules semer — le MÊME nombre pour tous les logos. */
  readonly nombre = input(1400);
  /** La portée d'un filament, en fraction de la largeur du logo. */
  readonly portee = input(0.03);
  /** Combien de filaments au plus par particule. */
  readonly voisins = input(3);
  /**
   * Le côté d'une particule, en unités du monde.
   *
   * ATTENTION, ce que ça vaut à l'écran ne dépend PAS de la taille de
   * l'emblème. Three calcule `gl_PointSize` à partir de `scale = hauteur/2`,
   * et cette hauteur est celle passée à `setSize` — donc la FENÊTRE, pas le
   * viewport de l'emblème (vérifié dans la source de three le 10/09). Un
   * point vaut donc ~2 px sur un écran de 1080 de haut, que l'emblème fasse
   * 365 px ou 115. C'est pour ça qu'en rapetissant les points ne s'effacent
   * pas : ils se CHEVAUCHENT.
   */
  readonly taillePoint = input(0.007);

  /**
   * Le décalage du nuage vers la caméra, en unités de scène.
   *
   * La caméra est à z = 1,9 et le nuage tient dans une sphère d'environ 0,5 :
   * au-delà de ±1,2 il traverse le plan de coupe ou sort du champ. Positif =
   * il s'approche, donc il grossit ET ses points grossissent, l'atténuation
   * de taille étant en 1/distance. C'est le seul réglage qui change à la fois
   * l'échelle et la perspective — la largeur, elle, ne fait que redimensionner
   * le viewport.
   *
   * Nommé `ecartZ` et non `profondeur` : ce composant a déjà une `profondeur`,
   * celle de la PIÈCE sur l'axe de la descente, qui commande sa visibilité.
   */
  readonly ecartZ = input(0);
  /** Combien de secondes un logo reste posé avant de se transformer. */
  readonly maintien = input(7);
  /** Combien de secondes dure la transformation. */
  readonly transition = input(2.6);
  /**
   * Le déphasage, en nombre de demi-cycles. Deux emplacements voisins mis à 0
   * et 1 montrent toujours des logos différents, et échangent ensemble.
   */
  readonly decalage = input(0);
  /** La circulation propre à chaque anneau, en tours par seconde. */
  readonly circulation = input(0.02);
  /** La rotation lente que TOUT le logo partage, en tours par seconde. */
  readonly rotation = input(0.008);
  /**
   * La durée d'un TOUR COMPLET sur l'axe vertical, en secondes.
   *
   * Sur y et non sur z, et la différence n'est pas un détail : sur z le logo
   * tournerait à plat, comme une aiguille d'horloge ; sur y il tourne sur
   * lui-même et MONTRE SES FLANCS — c'est-à-dire l'épaisseur qu'on a réglée.
   */
  readonly tourVertical = input(16);
  /**
   * Le sens du tour : +1 ou -1.
   *
   * Il appartient à l'EMPLACEMENT, pas au logo : celui de gauche tourne dans
   * un sens et celui de droite dans l'autre, quel que soit le logo qui s'y
   * trouve au moment où on regarde. C'est ce qui fait que les deux emblèmes
   * ne se ressemblent jamais tout à fait, même à mi-transformation.
   */
  readonly sensTour = input(1);
  /** La profondeur de la pièce sur l'axe, d'où découle sa visibilité. */
  private readonly profondeur = computed(() =>
    Math.max(this.nav.chemin().indexOf(this.piece()), 0),
  );
  /**
   * Visible seulement une fois la salle RÉVÉLÉE, et pas pendant qu'on y
   * descend. Sans ce second facteur, l'emblème — posé par-dessus la descente —
   * se voyait grossir au-dessus de la pyramide noire pendant tout le dernier
   * tiers du zoom : le logo était déjà là, et il n'y avait plus rien à faire
   * apparaître en arrivant. C'est la même arrivée que le décor de la salle,
   * donc les deux se lèvent ensemble.
   */
  readonly opacite = computed(
    () =>
      opaciteContenu(this.nav.profondeurAffichee(), this.profondeur()) *
      opaciteOuvertureInvisible(this.nav.profondeurAffichee(), this.profondeur()),
  );

  private rendu: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private groupe: Group | null = null;
  private etats: EtatLogo[] = [];
  private nuage: Points | null = null;
  private reseau: LineSegments | null = null;
  private image = 0;
  private debut = 0;
  /**
   * L'angle de circulation ACCUMULÉ de chaque logo, et l'instant de l'image
   * précédente.
   *
   * L'angle s'intègre image par image ; il ne se recalcule pas depuis le début
   * du temps. La version d'avant écrivait `circulation × t × (1 − avance)` :
   * au bout d'une minute cet angle valait plus d'un tour, et le facteur
   * d'estompage le ramenait à zéro en moins de deux secondes — le nuage de
   * départ se dévissait d'un tour entier pendant la transformation, de plus en
   * plus violemment à mesure que la page restait ouverte. Intégré, l'angle ne
   * saute jamais : la circulation ralentit, puis s'arrête, sans rien secouer.
   */
  private anglesCirculation: number[] = [];
  private tempsPrecedent = 0;
  /** Le numéro du dernier semis demandé — voir `construire`. */
  private jeton = 0;
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  /**
   * D'où part chaque particule, en FRACTIONS D'ÉCRAN, et son retard.
   *
   * En fractions d'écran et non en unités du monde, parce que la salle
   * rapetisse pendant la sortie : une position figée dans le repère du nuage
   * reviendrait vers le centre à mesure que la pièce s'éloigne, et les
   * particules se feraient ravaler au lieu de sortir. Fixées à l'écran, elles
   * restent dehors quoi qu'il arrive à la caméra.
   */
  private departs = new Float32Array(0);
  private retards = new Float32Array(0);
  /** La présence du nuage, de 0 (dispersé hors écran) à 1 (assemblé). */
  private presence = 0;
  /** La consigne en cours, l'instant où elle a basculé, et la présence d'alors. */
  private consigne = -1;
  private bascule = 0;
  private presenceBascule = 0;
  /** L'instant de l'image précédente, pour le pas de temps. */
  private tempsImage = 0;
  /**
   * Le temps de la SCÈNE, qui n'avance que nuage assemblé.
   *
   * Un nuage qui tournerait pendant l'entrée emporterait les positions de
   * départ avec lui — les particules « venues du bord gauche » entreraient par
   * le milieu, la rotation sur l'axe vertical les écrasant d'un facteur
   * cosinus. La rotation et le morphe attendent donc que tout soit en place.
   */
  private tempsScene = 0;

  /** Les mots d'où partent les flux : un sélecteur CSS, ou `null`. */
  readonly flux = input<string | null>(null);
  /** Combien de filaments par particule en vol. */
  readonly fluxVoisins = input(8);
  /**
   * Les bornes de la portée des filaments, en pixels. La portée ne reste pas
   * fixe : elle monte vers le haut de la plage, redescend vers le bas, et
   * remonte — chaque vague avec sa hauteur et sa durée tirées au hasard, et
   * adoucie aux deux bouts. Le réseau des flux respire.
   */
  readonly fluxPorteeMin = input(43);
  readonly fluxPorteeMax = input(60);

  /** La vague de portée en cours : d'où, vers où, depuis quand, pour combien. */
  private vague = { depuis: 0, vers: 0, debut: 0, duree: 0, monte: true };
  /**
   * Un flottement doux autour de la zone, ou `null` : l'amplitude en fractions
   * de pièce. Deux sinus de périodes premières entre elles par axe : le
   * mouvement ne se répète pas à l'œil.
   */
  readonly flottement = input<{ readonly x: number; readonly y: number } | null>(null);

  /**
   * La zone telle qu'on la peint : elle REJOINT la zone demandée au lieu d'y
   * sauter, pour que le logo glisse d'une place à l'autre (le repos, les
   * cartes) et que le flottement s'installe sans à-coup.
   */
  private zoneLisse: Cadre | null = null;

  private fluxNuage: Points | null = null;
  private fluxReseau: LineSegments | null = null;
  private etatFlux: EtatFlux | null = null;
  /** Les points des lettres de chaque mot, en pixels d'écran. */
  private sourcesFlux: { x: number; y: number }[][] = [];
  /** Les rectangles des mots au dernier relevé, et leur signature. */
  private rectsFlux: Rect[] = [];
  private signatureFlux = '';
  private imagesFlux = 0;
  private debitFlux = 0;
  private reliquatFlux = 0;
  private tourFlux = 0;
  private readonly cibleMonde = new Vector3();

  /** La souris, en pixels d'écran, ou `null` si elle est ailleurs. */
  private souris: { x: number; y: number } | null = null;
  /** La force de répulsion établie, de 0 à 1 : elle monte et retombe en douceur. */
  private poussee = 0;

  constructor() {
    // `afterNextRender` ne s'exécute que dans le navigateur : WebGL n'existe
    // pas au rendu serveur, et la page est pré-rendue.
    afterNextRender(() => void this.demarrer());
    // La boucle DÉMARRE sur la consigne, mais ne s'arrête pas avec elle : il
    // reste la sortie à jouer. C'est `dessiner` qui la coupe, une fois la
    // dernière particule hors écran.
    effect(() => {
      if (this.opacite() > 0) this.jouer();
    });

    // Changer le nombre de particules relance un semis complet. Il est
    // DIFFÉRÉ : un curseur qu'on glisse émet trente valeurs par seconde, et
    // semer trente fois de suite figerait la page. On ne sème que lorsque la
    // main s'arrête.
    effect(() => {
      const nombre = this.nombre();
      if (this.rendu === null) return; // premier passage : `demarrer` s'en charge
      if (this.minuteur !== null) clearTimeout(this.minuteur);
      this.minuteur = setTimeout(() => {
        this.minuteur = null;
        void this.construire(++this.jeton);
      }, ATTENTE_SEMIS);
      void nombre;
    });
    this.destroyRef.onDestroy(() => this.detruire());
  }

  private async demarrer(): Promise<void> {
    const ref = this.toile();
    if (ref === undefined) return;
    const toile = ref.nativeElement;

    // L'échec est PRÉVU et silencieux : jsdom n'a pas de WebGL, et une machine
    // sans contexte 3D non plus. Une salle sans emblème reste une salle
    // lisible ; une exception non rattrapée, elle, casserait la page entière.
    try {
      this.rendu = new WebGLRenderer({ canvas: toile, alpha: true, antialias: true });
    } catch {
      return;
    }
    this.rendu.setClearColor(new Color(0x000000), 0);
    this.rendu.setScissorTest(true); // on ne peint QUE le rectangle de l'emblème
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(CHAMP, 1, 0.1, 10);
    this.camera.position.z = CAMERA_Z;

    await this.construire(++this.jeton);
    if (this.groupe === null) return; // géométrie absente : rien à montrer
    if (this.flux() !== null) this.creerFlux();

    this.ajusterToile();
    if (typeof ResizeObserver === 'function') {
      const observateur = new ResizeObserver(() => this.ajusterToile());
      observateur.observe(toile);
      this.destroyRef.onDestroy(() => observateur.disconnect());
    }
    if (this.opacite() > 0) this.jouer();
  }

  /**
   * Sème les logos et bâtit le nuage. Séparé de `demarrer` parce qu'il faut
   * pouvoir le REFAIRE : changer le nombre de particules oblige à tout
   * reprendre — le morphe exige que les deux logos aient exactement le même
   * nombre de points, appariés par angle, et les tampons de position sont
   * dimensionnés une fois pour toutes.
   *
   * Le `jeton` protège du croisement : un curseur qu'on glisse peut lancer
   * plusieurs semis avant que le premier ait fini de charger ses images, et
   * seul le dernier demandé doit s'installer.
   */
  private async construire(jeton: number): Promise<void> {
    if (this.scene === null) return;

    // `nombre` est une entrée publique et rien n'empêche un appelant de la
    // mettre à zéro. Sans ce garde-fou, `preparer` rendrait `null`, `etats`
    // serait vide, et la sortie anticipée plus bas laisserait l'ANCIEN nuage
    // affiché : une demande sans effet visible, le pire des cas.
    if (this.nombre() <= 0) {
      this.remiser();
      return;
    }

    const etats: EtatLogo[] = [];
    for (const logo of this.logos()) {
      const etat = await this.preparer(logo);
      if (etat !== null) etats.push(etat);
    }
    if (jeton !== this.jeton) return; // un semis plus récent a pris la main
    if (etats.length === 0) return;

    this.remiser();
    this.etats = etats;
    this.anglesCirculation = [];
    this.tempsPrecedent = 0;

    const n = this.etats[0]!.points.length;
    const positions = new Float32Array(n * 3);
    const geometrie = new BufferGeometry();
    geometrie.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.nuage = new Points(
      geometrie,
      new PointsMaterial({
        color: GRIS_PARTICULE,
        size: this.taillePoint(),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
      }),
    );

    // Le réseau est reconstruit à chaque image à partir des positions du
    // moment : sinon les filaments resteraient accrochés aux positions de
    // départ pendant que les particules, elles, s'en vont.
    const maxPaires = Math.max(...this.etats.map((e) => e.paires.length));
    const lignes = new BufferGeometry();
    lignes.setAttribute('position', new Float32BufferAttribute(new Float32Array(maxPaires * 6), 3));
    this.reseau = new LineSegments(
      lignes,
      new LineBasicMaterial({
        color: GRIS_FILAMENT,
        transparent: true,
        opacity: OPACITE_FILAMENT,
      }),
    );

    this.groupe = new Group();
    this.groupe.add(this.nuage, this.reseau);
    this.scene.add(this.groupe);
  }

  /** Décroche et libère le nuage en place, avant d'en poser un autre. */
  private remiser(): void {
    if (this.groupe === null) return;
    this.scene?.remove(this.groupe);
    for (const objet of [this.nuage, this.reseau]) {
      objet?.geometry.dispose();
      const materiau = objet?.material;
      if (Array.isArray(materiau)) materiau.forEach((x) => x.dispose());
      else materiau?.dispose();
    }
    this.groupe = null;
    this.nuage = null;
    this.reseau = null;
  }

  /**
   * Un logo semé, normalisé, trié par angle, et relié.
   *
   * Le tri par angle EST l'appariement : la particule i de ce logo deviendra
   * la particule i de l'autre. Deux nuages triés de la même façon se
   * transforment par un mouvement tournant lisible ; non triés, chaque point
   * traverserait le logo au hasard.
   */
  private async preparer(logo: LogoDefini): Promise<EtatLogo | null> {
    const brut = logo.source.endsWith('.png')
      ? await this.semerImage(logo)
      : await this.semerMaillage(logo);
    if (brut.length === 0) return null;

    // Le sens de circulation vient du sous-nuage d'origine : un anneau sur
    // deux tourne à l'envers. Une image n'a qu'un sous-nuage, donc sens nul.
    const sensBrut: number[] = [];
    brut.forEach((groupe, i) => {
      const sens = brut.length > 1 ? (i % 2 === 0 ? 1 : -1) : 0;
      for (let k = 0; k < groupe.length; k++) sensBrut.push(sens);
    });

    // La normalisation porte sur l'ENSEMBLE des sous-nuages, sinon chaque
    // anneau serait recentré sur lui-même et ils se superposeraient.
    const tous = normaliser(brut.flat());
    const ordre = trierParAngle(tous);
    const points = ordre.map((i) => tous[i]!);
    const sens = ordre.map((i) => sensBrut[i]!);

    // Exactement `nombre` particules : les arrondis du prorata des aires
    // peuvent en donner une de plus ou de moins, et un morphe ne tolère pas
    // le moindre écart entre les deux nuages.
    const n = this.nombre();
    while (points.length > n) {
      points.pop();
      sens.pop();
    }
    while (points.length < n && points.length > 0) {
      points.push(points[points.length - 1]!);
      sens.push(sens[sens.length - 1]!);
    }
    return { points, sens, paires: filaments(points, this.portee(), this.voisins()) };
  }

  /** Semées sur la SURFACE du maillage, au prorata de l'aire de chacun. */
  private async semerMaillage(logo: LogoDefini): Promise<Particule[][]> {
    const gltf = await new GLTFLoader().loadAsync(logo.source).catch(() => null);
    if (gltf === null) return [];

    const maillages: Mesh[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh) maillages.push(o as Mesh);
    });
    if (maillages.length === 0) return [];

    // À parts égales, le petit anneau serait deux fois trop dense.
    const aires = maillages.map((m) => aireDe(m));
    const total = aires.reduce((s, a) => s + a, 0);
    if (total <= 0) return [];

    const position = new Vector3();
    return maillages.map((maillage, i) => {
      const combien = Math.round((aires[i]! / total) * this.nombre());
      const semeur = new MeshSurfaceSampler(maillage).build();
      const points: Particule[] = [];
      for (let n = 0; n < combien; n++) {
        semeur.sample(position);
        maillage.localToWorld(position);
        points.push({ x: position.x, y: position.y, z: position.z });
      }
      return points;
    });
  }

  /**
   * Semées d'après la LUMINOSITÉ d'une image, puis épaissies sur leurs flancs.
   * Le noir ne se détoure pas, il disparaît : un pixel au niveau du fond ne
   * produit rien.
   */
  private async semerImage(logo: LogoDefini): Promise<Particule[][]> {
    const image = await chargerImage(logo.source).catch(() => null);
    if (image === null) return [];
    const toile = document.createElement('canvas');
    toile.width = image.naturalWidth;
    toile.height = image.naturalHeight;
    const ctx = toile.getContext('2d');
    if (ctx === null) return [];
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, toile.width, toile.height).data;

    // Un pixel transparent ne vaut pas du noir : il ne vaut RIEN. Sans ça, le
    // hors-pentagone de THP compterait comme du fond et fausserait le niveau
    // dominant.
    const luminances: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3]! / 255;
      luminances.push(
        alpha * (0.2126 * pixels[i]! + 0.7152 * pixels[i + 1]! + 0.0722 * pixels[i + 2]!),
      );
    }
    const zones = logo.zonesFines ?? [];
    let densite = densiteDepuisLuminance(luminances, fondDominant(luminances), PLANCHER);
    for (const { zone, renfort } of zones) {
      densite = renforcer(densite, toile.width, zone, renfort);
    }
    const plat = echantillonner(densite, toile.width, toile.height, this.nombre());

    // L'épaisseur est donnée particule par particule : celles d'un détail fin
    // en reçoivent moins, sinon la profondeur noie le trait au lieu de
    // l'épaissir. La première zone qui contient la particule décide.
    return [
      plat.map((p) => {
        const trouvee = zones.find((z) => dansLaZone(p, z.zone, toile.width, toile.height));
        return { ...p, z: (Math.random() - 0.5) * (trouvee?.flanc ?? FLANC) };
      }),
    ];
  }

  /**
   * La toile couvre l'écran ; c'est le viewport qui découpe l'emblème.
   *
   * ET C'EST CE QUI COÛTE. Chaque emblème alloue donc une toile de la taille
   * de la FENÊTRE, avec antialiasing et tampon de profondeur, alors qu'il n'en
   * peint qu'un carré de 365 px. Sur un écran de 1920×1080, cela représente de
   * l'ordre de 250 Mo par emblème — et il y en a deux sur grand écran, sur un
   * iGPU qui partage la mémoire système. Le 10/09, le processus GPU de
   * Chromium a fini par tomber, puis a mis le domaine sur liste noire.
   *
   * Le plafond descend donc de 2 à 1,5 : la surface passe de 3840×2160 à
   * 2880×1620, soit **44 % de pixels en moins**, pour une perte de netteté que
   * l'œil ne voit pratiquement pas sur des points de 2 px. C'est le levier le
   * moins cher visuellement ; supprimer le tampon de profondeur en donnerait
   * autant, mais toucherait à l'ordre des anneaux d'Intuition.
   */
  private ajusterToile(): void {
    if (this.rendu === null) return;
    this.rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXELS_MAX));
    this.rendu.setSize(window.innerWidth, window.innerHeight, false);
  }

  private jouer(): void {
    if (this.rendu === null || this.image !== 0) return;
    this.debut = performance.now();
    this.tempsImage = this.debut;
    const boucle = () => {
      this.image = requestAnimationFrame(boucle);
      this.dessiner();
    };
    this.image = requestAnimationFrame(boucle);
  }

  private arreter(): void {
    if (this.image === 0) return;
    cancelAnimationFrame(this.image);
    this.image = 0;
  }

  /**
   * Où en est le cycle : de quel logo on part, vers lequel on va, et à quel
   * point du chemin. Un demi-cycle = un maintien puis une transformation.
   */
  private cycle(t: number): { depuis: number; vers: number; avance: number } {
    const combien = this.etats.length;
    if (combien < 2) return { depuis: 0, vers: 0, avance: 0 };
    const demi = this.maintien() + this.transition();
    const ecoule = t + this.decalage() * demi;
    const pas = Math.floor(ecoule / demi);
    const dans = ecoule - pas * demi;
    const depuis = pas % combien;
    const vers = (pas + 1) % combien;
    const avance = dans <= this.maintien() ? 0 : (dans - this.maintien()) / this.transition();
    return { depuis, vers, avance };
  }

  private dessiner(): void {
    if (this.rendu === null || this.scene === null || this.camera === null) return;

    const maintenant = performance.now();
    const dt = Math.min(Math.max((maintenant - this.tempsImage) / 1000, 0), 0.1);
    this.tempsImage = maintenant;

    const zone = zoneEcran(
      this.nav.graphe(),
      this.nav.chemin()[0] ?? '',
      this.piece(),
      this.nav.cadreAffiche(),
      this.zoneDuMoment(maintenant, dt),
    );
    // Un emblème carré EN PIXELS, dont le côté se prend sur la LARGEUR : c'est
    // la règle de l'ancien CSS (`width: 26%; aspect-ratio: 1`).
    const l = window.innerWidth;
    const h = window.innerHeight;
    const cote = zone.w * l;
    const gauche = zone.x * l;
    const haut = zone.y * h;
    // Le viewport WebGL part du BAS, la page part du haut.
    const bas = h - haut - cote;

    // La présence rejoint sa consigne — 1 dans la salle, 0 dehors — en un
    // temps fixe. C'est d'elle que découle tout le reste, et c'est pour ça que
    // le mouvement s'inverse proprement si l'on change d'avis en chemin : au
    // basculement, on note où elle en était, et elle repart de là dans l'autre
    // sens.
    //
    // ELLE SE CALCULE SUR LE TEMPS ÉCOULÉ, PAS EN CUMULANT LES IMAGES. Une
    // somme de pas `dt` bornés à 100 ms suppose que les images arrivent
    // régulièrement ; dès qu'elles s'espacent — onglet en arrière-plan, page
    // qui rame, rendu hors écran — le bornage mange la différence et la
    // présence n'arrive jamais à 1. Mesuré le 11/09 : en rendu headless, le
    // logo ne se formait plus du tout, même au bout de 45 secondes.
    // La consigne suit la CHORÉGRAPHIE de la salle et plus sa profondeur
    // (23/09) : le nuage se forme une fois la caméra posée, et repart dès
    // qu'on la quitte, pendant que la caméra prend son élan.
    // Une carte de projet ouverte en grand ne fait PAS partir l'emblème (Paul,
    // 25/09 : « c'est pas ce qu'on veut ») : il est la croix du titre, qui
    // reste. La carte ouverte passe par-dessus (z-index 20 contre 6).
    const presente = this.nav.sallePresente() === this.piece();
    const consigne = presente && this.opacite() > 0 && cote > COTE_MINIMAL ? 1 : 0;
    if (consigne !== this.consigne) {
      this.consigne = consigne;
      this.bascule = maintenant;
      this.presenceBascule = this.presence;
    }
    const avance =
      (maintenant - this.bascule) / 1000 / (consigne === 1 ? ENTREE_DUREE : SORTIE_DUREE);
    this.presence =
      consigne === 1
        ? Math.min(1, this.presenceBascule + avance)
        : Math.max(0, this.presenceBascule - avance);

    // L'hôte reste peint tant qu'il reste de la matière en vol, sinon on ne
    // verrait jamais partir personne : la consigne, elle, tombe à zéro dès le
    // seuil d'arrivée franchi.
    // Et il s'éteint quand la pièce devient trop petite pour vouloir dire
    // quelque chose — un fondu et non une coupure, sinon ce qui reste en vol
    // disparaîtrait d'un coup.
    const reste = Math.min(Math.max((cote - COTE_MINIMAL) / (3 * COTE_MINIMAL), 0), 1);
    const visible = Math.max(this.opacite(), this.presence) * reste;
    this.hote.nativeElement.style.opacity = String(visible);
    if (visible <= 0) {
      this.presence = 0;
      this.presenceBascule = 0;
      // Les départs sont oubliés : la prochaine entrée en tirera de nouveaux,
      // et le nuage ne se reformera pas deux fois par le même chemin.
      this.departs = new Float32Array(0);
      this.arreter();
      return;
    }

    // Un nouveau départ n'est tiré qu'une fois tout le monde sorti : le tirer
    // en vol ferait sauter les particules d'un bord de l'écran à l'autre.
    if (this.presence <= 0 || this.departs.length === 0) this.semerDeparts();

    if (this.presence >= 1) this.tempsScene += dt;
    const tScene = this.tempsScene;

    // Avec des flux en vol, le rendu s'élargit aux mots d'où ils partent : même
    // principe que l'entrée, par une fenêtre juste assez grande.
    const bande = this.presence < 1 ? null : this.bandeFlux(gauche, haut, cote, l, h);
    if (this.presence < 1) {
      // L'écran ENTIER est peint, et le tronc de projection est décalé pour que
      // l'emblème reste exactement où il sera : le carré de `cote` devient la
      // fenêtre de référence, et on en rend la sous-image « écran entier », qui
      // commence à (-gauche, -haut) de ce carré. Rien ne bouge au changement de
      // mode — c'est la même projection, vue par une fenêtre plus grande.
      this.rendu.setViewport(0, 0, l, h);
      this.rendu.setScissor(0, 0, l, h);
      this.camera.setViewOffset(cote, cote, -gauche, -haut, l, h);
    } else if (bande !== null) {
      const basBande = h - bande.y - bande.h;
      this.rendu.setViewport(bande.x, basBande, bande.l, bande.h);
      this.rendu.setScissor(bande.x, basBande, bande.l, bande.h);
      this.camera.setViewOffset(cote, cote, bande.x - gauche, bande.y - haut, bande.l, bande.h);
    } else {
      this.rendu.setViewport(gauche, bas, cote, cote);
      this.rendu.setScissor(gauche, bas, cote, cote);
      this.camera.clearViewOffset();
    }
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    // La taille du point est une simple propriété du matériau : la changer ne
    // coûte rien et ne demande aucun semis, contrairement au nombre.
    const materiau = this.nuage?.material as PointsMaterial | undefined;
    if (materiau !== undefined && materiau.size !== this.taillePoint()) {
      materiau.size = this.taillePoint();
    }

    // Le monde par pixel d'écran, à la profondeur du nuage. C'est le taux de
    // change entre les deux repères : il sert aux départs comme à la souris.
    const parPixel = (2 * Math.tan((CHAMP * Math.PI) / 360) * (CAMERA_Z - this.ecartZ())) / cote;
    const centreX = gauche + cote / 2;
    const centreY = haut + cote / 2;

    // La souris, ramenée dans le repère du nuage : d'abord en unités du monde,
    // puis dérotée des deux rotations que le groupe porte.
    const tour = 2 * Math.PI;
    const angleZ = tScene * this.rotation() * tour;
    const angleY = this.sensTour() * (tScene / this.tourVertical()) * tour;
    const vise = this.souris;
    this.poussee += ((vise === null ? 0 : 1) - this.poussee) * Math.min(1, dt * REPULSION_VITESSE);
    let sourisLocale: { x: number; y: number } | null = null;
    if (vise !== null && this.poussee > 0.001) {
      const mx = (vise.x - centreX) * parPixel;
      const my = -(vise.y - centreY) * parPixel;
      // Ry(-angleY) puis Rz(-angleZ), appliqués au point (mx, my, 0).
      const x1 = mx * Math.cos(angleY);
      const c = Math.cos(angleZ);
      const sn = Math.sin(angleZ);
      sourisLocale = { x: x1 * c + my * sn, y: -x1 * sn + my * c };
    }

    this.transformer(tScene, l, h, parPixel, centreX, centreY, sourisLocale);

    if (this.groupe !== null) {
      this.groupe.position.z = this.ecartZ();
      this.groupe.rotation.z = angleZ;
      this.groupe.rotation.y = angleY;
      this.groupe.updateMatrixWorld(true);
    }
    this.animerFlux(maintenant, dt, parPixel, centreX, centreY);
    this.rendu.render(this.scene, this.camera);
  }

  /**
   * Tire un point de départ HORS ÉCRAN pour chaque particule, et son retard.
   *
   * En fractions d'écran : 0 et 1 sont les bords, au-delà c'est dehors. La
   * conversion en unités du monde se refait à chaque image, avec le taux du
   * moment — c'est ce qui les tient dehors pendant que la salle s'éloigne.
   */
  private semerDeparts(): void {
    if (this.nuage === null) return;
    const n = this.nuage.geometry.getAttribute('position').count;
    if (n === 0 || this.departs.length === n * 3) return;

    const au = (a: number, b: number) => a + (b - a) * Math.random();
    const dehors = () => ENTREE_MARGE * (0.08 + 0.92 * Math.random());

    const departs = new Float32Array(n * 3);
    const retards = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const bord = Math.random();
      let sx: number;
      let sy: number;
      if (bord < ENTREE_BORDS[0]) {
        sx = au(0, 1);
        sy = -dehors();
      } else if (bord < ENTREE_BORDS[1]) {
        sx = -dehors();
        sy = au(0, 1);
      } else if (bord < ENTREE_BORDS[2]) {
        sx = 1 + dehors();
        sy = au(0, 1);
      } else {
        sx = au(0, 1);
        sy = 1 + dehors();
      }
      const k = i * 3;
      departs[k] = sx;
      departs[k + 1] = sy;
      departs[k + 2] = (Math.random() - 0.5) * 0.6;
      retards[i] = Math.random() * ENTREE_ETALEMENT;
    }
    this.departs = departs;
    this.retards = retards;
  }

  @HostListener('document:pointermove', ['$event'])
  protected viser(evenement: PointerEvent): void {
    this.souris = { x: evenement.clientX, y: evenement.clientY };
  }

  // Un `pointerleave` ne remonte PAS jusqu'à `window` : il faut l'écouter sur le
  // document. Mesuré le 10/09 sur la trame, qui gardait sa souris collée au
  // dernier point survolé quand le curseur quittait la page.
  @HostListener('document:pointerleave')
  @HostListener('document:mouseleave')
  @HostListener('window:blur')
  protected relacher(): void {
    this.souris = null;
  }


  /** Les positions de l'image courante : circulation, morphe, présence, souris. */
  private transformer(
    t: number,
    l: number,
    h: number,
    parPixel: number,
    centreX: number,
    centreY: number,
    souris: { x: number; y: number } | null,
  ): void {
    if (this.nuage === null || this.reseau === null) return;
    const { depuis, vers, avance } = this.cycle(t);
    const a = this.etats[depuis]!;
    const b = this.etats[vers]!;
    // Un adoucissement du cinquième degré : sa vitesse ET son accélération
    // sont nulles aux deux bouts, donc la transformation démarre et s'arrête
    // sans le moindre à-coup. Le troisième degré n'annulait que la vitesse.
    const p = avance * avance * avance * (avance * (avance * 6 - 15) + 10);
    const tour = 2 * Math.PI;

    // L'angle s'INTÈGRE : on ajoute ce qui s'est écoulé depuis l'image
    // précédente. Le pas est borné pour qu'un onglet resté en arrière-plan ne
    // rende pas la main sur un saut d'angle.
    const dt = Math.min(Math.max(t - this.tempsPrecedent, 0), 0.1);
    this.tempsPrecedent = t;
    const vitesse = this.circulation() * tour;
    if (depuis === vers) {
      this.anglesCirculation[depuis] = (this.anglesCirculation[depuis] ?? 0) + vitesse * dt;
    } else {
      this.anglesCirculation[depuis] =
        (this.anglesCirculation[depuis] ?? 0) + vitesse * (1 - p) * dt;
      this.anglesCirculation[vers] = (this.anglesCirculation[vers] ?? 0) + vitesse * p * dt;
    }
    const angleA = this.anglesCirculation[depuis]!;
    const angleB = this.anglesCirculation[vers]!;

    const positions = this.nuage.geometry.getAttribute('position');
    const tableau = positions.array as Float32Array;
    for (let i = 0; i < a.points.length; i++) {
      // Chaque anneau garde son propre angle : celui qu'on quitte ralentit
      // jusqu'à l'arrêt, celui qu'on rejoint prend sa vitesse. Aucun des deux
      // ne revient en arrière.
      const pa = tournerZ(a.points[i]!, a.sens[i]! * angleA);
      const pb = tournerZ(b.points[i]!, b.sens[i]! * angleB);
      const k = i * 3;
      tableau[k] = pa.x + (pb.x - pa.x) * p;
      tableau[k + 1] = pa.y + (pb.y - pa.y) * p;
      tableau[k + 2] = pa.z + (pb.z - pa.z) * p;
    }

    // LA PRÉSENCE se pose PAR-DESSUS les positions du moment, elle ne les
    // remplace pas : le nuage visé reste celui que le morphe vient de
    // calculer, chaque particule n'est que rappelée vers lui depuis son point
    // de départ — ou renvoyée dessus. Un adoucissement du troisième degré la
    // fait entrer vite et se poser doucement. Le garde-fou sur la longueur
    // couvre le cas où le nombre de particules change en vol : les départs
    // d'un semis précédent ne veulent alors plus rien dire.
    if (this.presence < 1 && this.departs.length === tableau.length) {
      const vol = 1 - ENTREE_ETALEMENT;
      for (let i = 0; i < a.points.length; i++) {
        const u = Math.min(Math.max((this.presence - this.retards[i]!) / vol, 0), 1);
        const reste = 1 - u;
        const q = 1 - reste * reste * reste;
        const k = i * 3;
        // La fraction d'écran redevient une position du monde ici, et pas au
        // semis : le taux de change suit la salle qui s'éloigne.
        const dx = (this.departs[k]! * l - centreX) * parPixel;
        const dy = -(this.departs[k + 1]! * h - centreY) * parPixel;
        tableau[k] = dx + (tableau[k]! - dx) * q;
        tableau[k + 1] = dy + (tableau[k + 1]! - dy) * q;
        tableau[k + 2] = this.departs[k + 2]! + (tableau[k + 2]! - this.departs[k + 2]!) * q;
      }
    }

    // LA RÉPULSION, en dernier : elle porte sur ce qu'on voit, pas sur la
    // forme théorique du logo. L'amplitude décroît en carré de la distance,
    // donc le creux a un bord net et le reste du nuage ne bouge pas.
    if (souris !== null && this.poussee > 0.001) {
      const rayon = REPULSION_RAYON;
      const force = REPULSION_FORCE * this.poussee;
      for (let i = 0; i < a.points.length; i++) {
        const k = i * 3;
        const ex = tableau[k]! - souris.x;
        const ey = tableau[k + 1]! - souris.y;
        const d = Math.hypot(ex, ey);
        if (d >= rayon) continue;
        const manque = 1 - d / rayon;
        // À distance nulle la direction n'existe pas : on pousse au hasard,
        // ce qui est exactement ce qu'on veut au point de contact.
        const angle = d > 1e-6 ? Math.atan2(ey, ex) : Math.random() * Math.PI * 2;
        const amplitude = force * manque * manque;
        tableau[k] += Math.cos(angle) * amplitude;
        tableau[k + 1] += Math.sin(angle) * amplitude;
      }
    }
    positions.needsUpdate = true;

    // Le réseau du logo dominant, redessiné sur les positions du moment, et
    // effacé au milieu du chemin : à mi-transformation, aucun des deux
    // réseaux n'a encore de sens.
    const dominant = p < 0.5 ? a : b;
    const liens = this.reseau.geometry.getAttribute('position');
    const versLiens = liens.array as Float32Array;
    dominant.paires.forEach(([i, j], n) => {
      const k = n * 6;
      versLiens[k] = tableau[i * 3]!;
      versLiens[k + 1] = tableau[i * 3 + 1]!;
      versLiens[k + 2] = tableau[i * 3 + 2]!;
      versLiens[k + 3] = tableau[j * 3]!;
      versLiens[k + 4] = tableau[j * 3 + 1]!;
      versLiens[k + 5] = tableau[j * 3 + 2]!;
    });
    // Les paires en trop (l'autre logo en a moins) sont repliées sur un point,
    // donc invisibles, plutôt que laissées sur de vieilles coordonnées.
    for (let n = dominant.paires.length * 6; n < versLiens.length; n++) versLiens[n] = 0;
    liens.needsUpdate = true;
    // Les filaments relient des paires FIXES : dessinés pendant que les
    // particules sont encore dispersées, ils barreraient l'écran entier d'un
    // bord à l'autre. Ils ne se rallument donc qu'à la fin de l'entrée, quand
    // les paires sont redevenues voisines.
    const veille = Math.min(
      Math.max((this.presence - ENTREE_FILAMENTS) / (1 - ENTREE_FILAMENTS), 0),
      1,
    );
    (this.reseau.material as LineBasicMaterial).opacity =
      OPACITE_FILAMENT * Math.abs(1 - 2 * p) * veille * veille;
  }

  /**
   * La zone de cette image : la zone demandée, plus le flottement du moment,
   * rejointe en douceur (constante de temps `GLISSE_ZONE`). La première image
   * y est posée d'emblée : rien ne doit glisser au chargement.
   */
  private zoneDuMoment(maintenant: number, dt: number): Cadre {
    const cible = this.zone();
    const f = this.flottement();
    const t = maintenant / 1000;
    const tour = 2 * Math.PI;
    const visee: Cadre =
      f === null
        ? cible
        : {
            ...cible,
            x: cible.x + f.x * (0.7 * Math.sin((tour * t) / 11) + 0.3 * Math.sin((tour * t) / 4.3 + 1.7)),
            y: cible.y + f.y * (0.7 * Math.sin((tour * t) / 7) + 0.3 * Math.sin((tour * t) / 2.9 + 0.6)),
          };
    const z = this.zoneLisse;
    if (z === null) {
      this.zoneLisse = visee;
      return visee;
    }
    const k = 1 - Math.exp(-dt / GLISSE_ZONE);
    this.zoneLisse = {
      ...visee,
      x: z.x + (visee.x - z.x) * k,
      y: z.y + (visee.y - z.y) * k,
      w: z.w + (visee.w - z.w) * k,
    };
    return this.zoneLisse;
  }

  /** La portée des filaments à cet instant, en pixels (voir `fluxPorteeMin`). */
  private porteeDuMoment(maintenant: number): number {
    const bas = Math.min(this.fluxPorteeMin(), this.fluxPorteeMax());
    const haut = Math.max(this.fluxPorteeMin(), this.fluxPorteeMax());
    const v = this.vague;
    if (v.duree === 0) {
      // Premier appel : on part du milieu, en montant.
      v.depuis = v.vers = (bas + haut) / 2;
      v.debut = maintenant;
    }
    const u = v.duree === 0 ? 1 : Math.min((maintenant - v.debut) / v.duree, 1);
    if (u >= 1) {
      // La vague suivante, dans l'autre sens : vers le quart haut ou le quart bas
      // de la plage, au hasard, en trois à six secondes.
      v.depuis = v.vers;
      v.monte = !v.monte;
      const quart = (haut - bas) / 4;
      v.vers = v.monte ? haut - Math.random() * quart : bas + Math.random() * quart;
      v.debut = maintenant;
      v.duree = 3000 + Math.random() * 3000;
      return v.depuis;
    }
    // Un demi-cosinus : vitesse nulle aux deux bouts, donc aucun à-coup.
    return v.depuis + (v.vers - v.depuis) * (1 - Math.cos(Math.PI * u)) / 2;
  }

  // — Les flux —

  /** Les deux objets des flux : les particules en vol, et leurs filaments. */
  private creerFlux(): void {
    if (this.scene === null || this.fluxNuage !== null) return;
    const n = FLUX_MAX;
    const points = new BufferGeometry();
    points.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3));
    points.setAttribute('taille', new Float32BufferAttribute(new Float32Array(n), 1));
    points.setAttribute('alpha', new Float32BufferAttribute(new Float32Array(n), 1));
    this.fluxNuage = new Points(
      points,
      new ShaderMaterial({
        vertexShader: FLUX_SOMMETS,
        fragmentShader: FLUX_FRAGMENTS,
        uniforms: { echelle: { value: 1 }, couleur: { value: new Color(GRIS_PARTICULE) } },
        transparent: true,
        depthWrite: false,
      }),
    );
    // Des filaments à opacité PAR SOMMET (couleur à 4 composantes) : chacun
    // s'efface avec la distance, et avec les particules qu'il relie.
    const lignes = new BufferGeometry();
    lignes.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * FLUX_VOISINS_MAX * 6), 3));
    lignes.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * FLUX_VOISINS_MAX * 8), 4));
    this.fluxReseau = new LineSegments(
      lignes,
      new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    );
    // Rien à peindre tant que rien ne vole.
    this.fluxNuage.frustumCulled = false;
    this.fluxReseau.frustumCulled = false;
    points.setDrawRange(0, 0);
    lignes.setDrawRange(0, 0);
    this.scene.add(this.fluxNuage, this.fluxReseau);
    this.etatFlux = {
      vivant: new Uint8Array(n),
      depart: new Float32Array(n * 3),
      cible: new Int32Array(n),
      naissance: new Float64Array(n),
      duree: new Float32Array(n),
      courbe: new Float32Array(n),
    };
  }

  /**
   * Relit la place des mots, et ne ré-échantillonne leurs lettres que si
   * elle a changé. Les lettres sont redessinées une à une à l'endroit exact
   * où la page les a posées (`Range`), ce qui respecte l'interlettrage et les
   * capitales sans rien deviner.
   */
  private releverMots(): void {
    const selecteur = this.flux();
    if (selecteur === null) return;
    const mots = [...document.querySelectorAll<HTMLElement>(selecteur)];
    const rects = mots.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left, y: r.top, l: r.width, h: r.height };
    });
    const signature = rects.map((r) => [r.x, r.y, r.l, r.h].map(Math.round).join(',')).join(';');
    this.rectsFlux = rects;
    if (signature === this.signatureFlux) return;
    this.signatureFlux = signature;
    this.sourcesFlux = mots.map((m, i) => lettresDe(m, rects[i]!)).filter((s) => s.length > 0);
  }

  /** La fenêtre de rendu qui couvre le logo ET les mots, ou `null` sans flux. */
  private bandeFlux(gauche: number, haut: number, cote: number, l: number, h: number): Rect | null {
    if (this.fluxNuage === null || this.rectsFlux.length === 0) return null;
    if (this.debitFlux <= 0 && this.fluxNuage.geometry.drawRange.count === 0) return null;
    const marge = cote * FLUX_MARGE;
    let x0 = gauche;
    let y0 = haut;
    let x1 = gauche + cote;
    let y1 = haut + cote;
    for (const r of this.rectsFlux) {
      x0 = Math.min(x0, r.x - marge);
      y0 = Math.min(y0, r.y - marge);
      x1 = Math.max(x1, r.x + r.l + marge);
      y1 = Math.max(y1, r.y + r.h + marge);
    }
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(l, Math.ceil(x1));
    y1 = Math.min(h, Math.ceil(y1));
    return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 };
  }

  /** Une image des flux : naissances, trajets, filaments. */
  private animerFlux(
    maintenant: number,
    dt: number,
    parPixel: number,
    centreX: number,
    centreY: number,
  ): void {
    const etat = this.etatFlux;
    if (this.fluxNuage === null || this.fluxReseau === null || etat === null) return;
    if (this.nuage === null || this.groupe === null || this.rendu === null) return;

    // Les flux ne coulent que vers un logo FORMÉ, et s'éteignent avec lui.
    const actif = this.presence >= 1;
    this.debitFlux = Math.min(1, Math.max(0, this.debitFlux + ((actif ? 1 : -1) * dt) / FLUX_MONTEE));
    // Toutes les dix images : un mot qu'on déplace à la main entraîne son flux.
    if (actif && this.imagesFlux++ % 10 === 0) this.releverMots();

    const logo = this.nuage.geometry.getAttribute('position');
    const nLogo = logo.count;
    const posLogo = logo.array as Float32Array;
    const z0 = this.ecartZ();

    // Les naissances, à tour de rôle d'un mot à l'autre : les deux flux pèsent
    // autant, quelle que soit la longueur des mots.
    if (actif && this.sourcesFlux.length > 0 && nLogo > 0) {
      this.reliquatFlux += FLUX_DEBIT * this.debitFlux * dt;
      for (let i = 0; i < FLUX_MAX && this.reliquatFlux >= 1; i++) {
        if (etat.vivant[i] === 1) continue;
        const lettres = this.sourcesFlux[this.tourFlux++ % this.sourcesFlux.length]!;
        const p = lettres[Math.floor(Math.random() * lettres.length)]!;
        etat.vivant[i] = 1;
        etat.depart[i * 3] = (p.x - centreX) * parPixel;
        etat.depart[i * 3 + 1] = -(p.y - centreY) * parPixel;
        etat.depart[i * 3 + 2] = z0 + (Math.random() - 0.5) * 0.08;
        etat.cible[i] = Math.floor(Math.random() * nLogo);
        etat.naissance[i] = maintenant;
        etat.duree[i] = FLUX_DUREE_MIN + Math.random() * (FLUX_DUREE_MAX - FLUX_DUREE_MIN);
        etat.courbe[i] = (Math.random() * 2 - 1) * FLUX_COURBURE;
        this.reliquatFlux -= 1;
      }
      this.reliquatFlux = Math.min(this.reliquatFlux, 1);
    }

    const positions = this.fluxNuage.geometry.getAttribute('position');
    const tailles = this.fluxNuage.geometry.getAttribute('taille');
    const alphas = this.fluxNuage.geometry.getAttribute('alpha');
    const pos = positions.array as Float32Array;
    const tai = tailles.array as Float32Array;
    const alp = alphas.array as Float32Array;
    // Hors salle, ce qui vole encore s'efface avec le logo.
    const fondu = actif ? 1 : this.presence * this.presence;
    const taille = this.taillePoint();
    let n = 0;
    for (let i = 0; i < FLUX_MAX; i++) {
      if (etat.vivant[i] !== 1) continue;
      const t = (maintenant - etat.naissance[i]!) / 1000 / etat.duree[i]!;
      if (t >= 1 || fondu <= 0) {
        etat.vivant[i] = 0;
        continue;
      }
      // La cible est une particule du logo, ramenée dans le monde : elle tourne
      // et se transforme avec lui, et la particule en vol la suit.
      const j = (etat.cible[i]! % nLogo) * 3;
      const c = this.cibleMonde
        .set(posLogo[j]!, posLogo[j + 1]!, posLogo[j + 2]!)
        .applyMatrix4(this.groupe.matrixWorld);
      const sx = etat.depart[i * 3]!;
      const sy = etat.depart[i * 3 + 1]!;
      const sz = etat.depart[i * 3 + 2]!;
      // Une courbe de Bézier du deuxième degré, dont le point d'appui est écarté
      // du droit chemin : les trajets s'arrondissent en gerbe au lieu de filer
      // en ligne droite.
      const dx = c.x - sx;
      const dy = c.y - sy;
      const mx = (sx + c.x) / 2 - dy * etat.courbe[i]!;
      const my = (sy + c.y) / 2 + dx * etat.courbe[i]!;
      const e = t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) * (2 - 2 * t)) / 2;
      const u = 1 - e;
      const k = n * 3;
      pos[k] = u * u * sx + 2 * u * e * mx + e * e * c.x;
      pos[k + 1] = u * u * sy + 2 * u * e * my + e * e * c.y;
      pos[k + 2] = sz + (c.z - sz) * e;
      tai[n] = taille * (FLUX_GROS + (1 - FLUX_GROS) * e);
      alp[n] = Math.min(1, t / FLUX_ECLOSION) * fondu;
      n++;
    }
    positions.needsUpdate = true;
    tailles.needsUpdate = true;
    alphas.needsUpdate = true;
    this.fluxNuage.geometry.setDrawRange(0, n);
    (this.fluxNuage.material as ShaderMaterial).uniforms['echelle']!.value =
      this.rendu.getPixelRatio() * (window.innerHeight / 2);

    // Les filaments : chaque particule vers ses plus proches voisines en vol,
    // dans la portée. Quelques centaines de points, donc la recherche directe
    // suffit (moins d'une milliseconde).
    const voisins = Math.min(Math.max(Math.round(this.fluxVoisins()), 0), FLUX_VOISINS_MAX);
    const portee = this.porteeDuMoment(maintenant) * parPixel;
    const portee2 = portee * portee;
    const lignes = this.fluxReseau.geometry;
    const lp = lignes.getAttribute('position').array as Float32Array;
    const lc = lignes.getAttribute('color').array as Float32Array;
    const gris = new Color(GRIS_FILAMENT);
    let s = 0;
    const proches: number[] = [];
    const distances: number[] = [];
    for (let a = 0; a < n; a++) {
      proches.length = 0;
      distances.length = 0;
      const ax = pos[a * 3]!;
      const ay = pos[a * 3 + 1]!;
      for (let b = a + 1; b < n; b++) {
        const ex = pos[b * 3]! - ax;
        const ey = pos[b * 3 + 1]! - ay;
        const d2 = ex * ex + ey * ey;
        if (d2 >= portee2) continue;
        // On garde les `voisins` plus proches, par insertion.
        let r = proches.length;
        while (r > 0 && distances[r - 1]! > d2) r--;
        if (r >= voisins) continue;
        proches.splice(r, 0, b);
        distances.splice(r, 0, d2);
        if (proches.length > voisins) {
          proches.pop();
          distances.pop();
        }
      }
      for (let q = 0; q < proches.length; q++) {
        const b = proches[q]!;
        const force = (1 - Math.sqrt(distances[q]!) / portee) * Math.min(alp[a]!, alp[b]!);
        const o = OPACITE_FILAMENT * force;
        const k = s * 6;
        lp[k] = ax;
        lp[k + 1] = ay;
        lp[k + 2] = pos[a * 3 + 2]!;
        lp[k + 3] = pos[b * 3]!;
        lp[k + 4] = pos[b * 3 + 1]!;
        lp[k + 5] = pos[b * 3 + 2]!;
        const kc = s * 8;
        for (let v = 0; v < 2; v++) {
          lc[kc + v * 4] = gris.r;
          lc[kc + v * 4 + 1] = gris.g;
          lc[kc + v * 4 + 2] = gris.b;
          lc[kc + v * 4 + 3] = o;
        }
        s++;
      }
    }
    lignes.getAttribute('position').needsUpdate = true;
    lignes.getAttribute('color').needsUpdate = true;
    lignes.setDrawRange(0, s * 2);
  }

  private detruire(): void {
    this.arreter();
    if (this.minuteur !== null) clearTimeout(this.minuteur);
    this.scene?.traverse((o) => {
      const m = o as Points;
      m.geometry?.dispose();
      const materiau = m.material;
      if (Array.isArray(materiau)) materiau.forEach((x) => x.dispose());
      else materiau?.dispose();
    });
    // `dispose()` libère les ressources GPU mais PAS le contexte WebGL : la
    // toile le garde jusqu'à un ramassage de mémoire qu'on ne contrôle pas.
    // Or un navigateur n'en accorde qu'une quinzaine par page. En
    // développement, chaque sauvegarde recrée les composants — trois contextes
    // de plus à chaque fois — et au bout de quelques enregistrements Chrome
    // refuse : « Web page caused context loss and was blocked », plus aucun
    // emblème. `forceContextLoss` le rend tout de suite.
    this.rendu?.forceContextLoss();
    this.rendu?.dispose();
    this.rendu = null;
  }
}

/** Une particule tournée autour de l'axe z. */
function tournerZ(p: Particule, angle: number): Particule {
  if (angle === 0) return p;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/** L'aire d'un maillage : la somme des aires de ses triangles. */
function aireDe(maillage: Mesh): number {
  const geometrie = maillage.geometry;
  const position = geometrie.getAttribute('position');
  const index = geometrie.getIndex();
  const nombre = index !== null ? index.count : position.count;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let total = 0;
  for (let i = 0; i < nombre; i += 3) {
    const [i0, i1, i2] =
      index !== null ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1);
    c.fromBufferAttribute(position, i2);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return total;
}

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error(`image illisible : ${url}`));
    image.src = url;
  });
}

/**
 * Les points d'un mot, en pixels d'écran : chaque lettre est redessinée seule,
 * à la place exacte que la page lui donne, puis on garde un pixel sur deux de
 * ce qui est encré.
 */
function lettresDe(mot: HTMLElement, rect: Rect): { x: number; y: number }[] {
  const texte = mot.firstChild;
  if (texte === null || texte.nodeType !== Node.TEXT_NODE || rect.l < 1 || rect.h < 1) return [];
  const toile = document.createElement('canvas');
  toile.width = Math.ceil(rect.l);
  toile.height = Math.ceil(rect.h);
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return [];
  const style = getComputedStyle(mot);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const brut = texte.textContent ?? '';
  const majuscules = style.textTransform === 'uppercase';
  const plage = document.createRange();
  for (let i = 0; i < brut.length; i++) {
    plage.setStart(texte, i);
    plage.setEnd(texte, i + 1);
    const r = plage.getBoundingClientRect();
    const lettre = majuscules ? brut[i]!.toUpperCase() : brut[i]!;
    ctx.fillText(lettre, r.left - rect.x, r.top - rect.y + r.height / 2);
  }
  const pixels = ctx.getImageData(0, 0, toile.width, toile.height).data;
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < toile.height; y += 2) {
    for (let x = 0; x < toile.width; x += 2) {
      if (pixels[(y * toile.width + x) * 4 + 3]! > 128) points.push({ x: rect.x + x, y: rect.y + y });
    }
  }
  return points;
}
