// La règle des emblèmes : un curseur pour voir tout de suite ce que vaut une
// taille, et le chiffre qui va avec.
//
// CE QUE CE N'EST PAS. Ce n'est pas un réglage du site : rien n'est gardé,
// rien n'est écrit, rien ne survit au rechargement. C'est une règle graduée
// qu'on pose sur l'écran le temps de choisir un nombre — après quoi le
// nombre part dans `app.html` et l'outil peut disparaître.
//
// POURQUOI IL N'EXISTE QU'EN DÉVELOPPEMENT, ET COMMENT. `@defer (when dev)`
// dans `app.html` : le morceau part dans un fichier à part que la production
// ne demande jamais. ATTENTION au piège mesuré le 09/09 sur le panneau de la
// trame — il suffit que `app.ts` touche à CE fichier, ne serait-ce qu'une
// constante ou une méthode statique, pour que l'import redevienne statique
// et que tout reparte dans le paquet principal. Rien ne doit importer d'ici.
//
// POURQUOI IL CALCULE LE CÔTÉ LUI-MÊME. Le composant des emblèmes place son
// viewport dans sa boucle de rendu, hors de toute détection de changement :
// lui demander sa taille obligerait à lui ajouter une sortie et à la pousser
// image par image. `zoneEcran` étant une fonction pure et `cadreAffiche` un
// signal, la règle refait le même calcul de son côté, sans rien coupler.
//
// POURQUOI IL ARRÊTE LES GESTES. La coquille écoute la molette, le doigt et
// les flèches pour piloter la profondeur : sans cela, un coup de molette sur
// le curseur ferait changer de salle, et les flèches aussi.

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { zoneEcran } from '../../coeur/geometrie';

/** La pièce qui porte les emblèmes. */
const PIECE = 'projets';

/** La distance caméra→nuage, telle que `particules-logo.ts` la pose. */
const DISTANCE_CAMERA = 1.9;

@Component({
  selector: 'pz-reglage-emblemes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'regle' },
  templateUrl: './reglage-emblemes.html',
  styleUrl: './reglage-emblemes.css',
})
export class ReglageEmblemes {
  private readonly nav = inject(Navigation);

  /** La largeur d'emblème en cours, en fraction de la largeur de la PIÈCE. */
  readonly valeur = input.required<number>();
  /** La valeur figée dans `app.html`, pour pouvoir y revenir. */
  readonly origine = input.required<number>();
  /** Le nombre de particules en cours — calculé par la coquille. */
  readonly particules = input.required<number>();
  readonly point = input.required<number>();
  readonly liens = input.required<number>();
  /** Ce que la loi du carré propose à cette largeur — une référence. */
  readonly loi = input.required<number>();
  /** Vrai quand le nombre a été imposé à la main. */
  readonly libre = input.required<boolean>();
  /** Les trois décalages : X et Y en fractions d'écran, Z en unités de scène. */
  readonly ecartX = input.required<number>();
  readonly ecartY = input.required<number>();
  readonly ecartZ = input.required<number>();

  readonly modifie = output<number>();
  readonly modifiePoint = output<number>();
  readonly modifieLiens = output<number>();
  readonly modifieNombre = output<number>();
  readonly suivre = output<void>();
  readonly remettre = output<void>();
  readonly modifieX = output<number>();
  readonly modifieY = output<number>();
  readonly modifieZ = output<number>();

  /** La plage utile en nombre de particules, arrêtée par Paul le 10/09. */
  protected readonly PLANCHER = 1080;
  protected readonly PLAFOND = 10000;

  /**
   * Le point ne se règle pas au-delà de 2 px.
   *
   * C'est ce qu'il vaut à la taille d'origine (mesuré : 1,99 px), et rien
   * au-dessus n'a d'usage — un point plus gros ne ferait qu'accélérer le
   * recouvrement qu'on cherche justement à éviter. Le plancher de 0,4 px
   * garde un point encore visible après lissage.
   */
  protected readonly POINT_MIN = 0.4;
  protected readonly POINT_MAX = 2;

  /**
   * Le côté d'une particule à l'écran, en pixels.
   *
   * Il ne dépend PAS de la taille de l'emblème : three calcule
   * `gl_PointSize = size × (hauteur / 2) / distance`, et cette hauteur est
   * celle de la FENÊTRE, pas du viewport. C'est la mesure qui explique tout —
   * en rapetissant l'emblème, les points ne s'effacent pas, ils se
   * chevauchent.
   */
  protected readonly pointPx = computed(
    () => Math.round((this.point() * (this.fenetre().h / 2) * 100) / DISTANCE_CAMERA) / 100,
  );

  /**
   * La part de l'emblème réellement couverte d'encre. C'est le chiffre qui
   * dit « pâté » ou « réseau » : au-delà d'un cinquième, les points se
   * touchent et le côté particule disparaît.
   */
  protected readonly encre = computed(() => {
    const cote = this.coteMaintenant();
    if (cote <= 0) return 0;
    const r = this.pointPx() / 2;
    return Math.round((this.particules() * Math.PI * r * r * 100) / (cote * cote));
  });

  /** Repliée d'office au téléphone : dépliée, elle couvre la moitié de l'écran. */
  protected readonly replie = signal(this.nav.format() === 'etroit');

  /** La fenêtre, relue à chaque redimensionnement. */
  private readonly fenetre = signal(this.mesurerFenetre());

  private mesurerFenetre(): { readonly l: number; readonly h: number } {
    return typeof window === 'undefined'
      ? { l: 0, h: 0 }
      : { l: window.innerWidth, h: window.innerHeight };
  }

  @HostListener('window:resize')
  protected redimensionner(): void {
    this.fenetre.set(this.mesurerFenetre());
  }

  /**
   * Le côté de l'emblème EN CE MOMENT, en pixels d'écran.
   *
   * Il change tout le temps : la pièce grossit avec la descente, donc le même
   * réglage vaut cent pixels au loin et six cents une fois la salle atteinte.
   * C'est bien cette valeur-là qu'il faut regarder pour juger « trop petit »,
   * mais ce n'est pas elle qu'on note — voir `cotePlein`.
   */
  protected readonly coteMaintenant = computed(() => {
    const zone = zoneEcran(
      this.nav.graphe(),
      this.nav.chemin()[0] ?? '',
      PIECE,
      this.nav.cadreAffiche(),
      { x: 0, y: 0, w: this.valeur() },
    );
    // Sous deux pixels, l'emblème n'est pas « petit », il est HORS de la
    // salle : l'arrondi le remontait à 1 px et la couverture d'encre, qui
    // divise par le carré du côté, affichait 344 947 %.
    const px = zone.w * this.fenetre().l;
    return px < 2 ? 0 : Math.round(px);
  });

  /**
   * Le côté quand la salle remplit l'écran — le chiffre de référence.
   *
   * À cette profondeur, `piece.w × echelle` vaut exactement 1, donc le côté
   * se réduit à `w × largeur de fenêtre`. C'est la seule valeur qui ne dépende
   * pas d'où se trouve la caméra, et donc la seule qui se compare d'une
   * séance à l'autre.
   */
  protected readonly cotePlein = computed(() => Math.round(this.valeur() * this.fenetre().l));

  protected readonly taille = computed(() => this.fenetre());
  protected readonly bouge = computed(() => this.valeur() !== this.origine());

  protected glisser(evenement: Event): void {
    this.modifie.emit(Number((evenement.target as HTMLInputElement).value));
  }

  protected revenir(): void {
    this.remettre.emit();
  }

  /**
   * Le curseur est gradué en PIXELS, le matériau attend des unités du monde.
   *
   * C'est dans ce sens qu'il faut convertir, et pas l'inverse : ce qu'on juge
   * à l'écran c'est une taille en pixels, alors que `size` dépend de la
   * hauteur de la fenêtre (`gl_PointSize = size × (h/2) / distance`). Un
   * curseur gradué en unités du monde ne voudrait pas dire la même chose d'un
   * écran à l'autre.
   */
  protected glisserPoint(evenement: Event): void {
    const px = Number((evenement.target as HTMLInputElement).value);
    const h = this.fenetre().h;
    if (!Number.isFinite(px) || h <= 0) return;
    this.modifiePoint.emit((px * 2 * DISTANCE_CAMERA) / h);
  }

  protected glisserLiens(evenement: Event): void {
    this.modifieLiens.emit(Number((evenement.target as HTMLInputElement).value));
  }

  /** X et Y en pixels d'écran, pour un réglage qui parle à l'œil. */
  protected readonly ecartXpx = computed(() => Math.round(this.ecartX() * this.fenetre().l));
  protected readonly ecartYpx = computed(() => Math.round(this.ecartY() * this.fenetre().h));

  protected glisserX(evenement: Event): void {
    const px = Number((evenement.target as HTMLInputElement).value);
    const l = this.fenetre().l;
    if (Number.isFinite(px) && l > 0) this.modifieX.emit(px / l);
  }

  protected glisserY(evenement: Event): void {
    const px = Number((evenement.target as HTMLInputElement).value);
    const h = this.fenetre().h;
    if (Number.isFinite(px) && h > 0) this.modifieY.emit(px / h);
  }

  protected glisserZ(evenement: Event): void {
    const v = Number((evenement.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.modifieZ.emit(v);
  }

  protected glisserNombre(evenement: Event): void {
    const v = Number((evenement.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.modifieNombre.emit(v);
  }

  @HostListener('wheel', ['$event'])
  @HostListener('touchstart', ['$event'])
  @HostListener('touchmove', ['$event'])
  @HostListener('keydown', ['$event'])
  protected garder(evenement: Event): void {
    evenement.stopPropagation();
  }
}
