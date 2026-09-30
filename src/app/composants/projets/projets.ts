// Pièce 1 — la salle des projets. Trois vignettes côte à côte : cliquer y
// entre LATÉRALEMENT (la profondeur ne bouge pas), tandis que l'ouverture du
// bas continue la descente.
//
// UNE CARTE PAR GESTE AU TÉLÉPHONE (Paul, 29/09) : voir `Placement.carteMontree`.
//
// DEUX TEMPS (Paul, 25/09). On arrive sur le titre, le logo et l'intro. Un
// cran de molette : l'intro s'efface, le logo monte, et les cartes naissent
// d'une fumée (`pz-fumee`). Un second cran descend à la salle suivante. Ces
// deux temps sont les deux « pages » de la salle (`MOMENTS`), que la molette
// tourne comme celles d'une carte de texte.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { PieceBase } from '../piece-base';
import { MOMENTS, PAGES_ETROIT, Placement } from '../../placement';
import { OuvertureComponent } from '../ouverture/ouverture';
import { Vignette } from '../vignette/vignette';
import { Inclinaison } from '../vignette/inclinaison';
import { projetsDans } from '../../coeur/contenu';
import { LangueSite } from '../../langue';
import {
  ANCRE_TITRE_ETROIT,
  ANCRE_TITRE_LARGE,
  ANCRE_TITRE_Y,
  HAUT_ETROIT,
  HAUT_LARGE,
} from '../../coeur/embleme';

@Component({
  selector: 'pz-projets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OuvertureComponent, Vignette, Inclinaison],
  host: {
    class: 'piece piece--projets',
    // La chorégraphie de la salle : tout est dans `projets.css`.
    '[class.choree--presente]': 'presente()',
    // Une carte ouverte en grand (`pz-univers`) : le reste de la salle s'efface.
    // Suit la demande, pas la carte à l'écran : à la fermeture, le reste
    // revient PENDANT que la carte regagne sa place, pas après.
    '[class.projets--carte-ouverte]': 'nav.universOuvert() !== null',
    // Le second temps : l'intro s'en va dès le cran de molette ; les cartes,
    // elles, attendent que la caméra soit posée (`projets.css`).
    '[class.projets--cartes]': "placement.moment() === 'cartes'",
    '[class.projets--cartes-revelees]': 'placement.cartesRevelees()',
    // Où est le logo, pour que le titre s'y cale (`projets.css`).
    '[style.--logo-cote]': 'logo().cote',
    '[style.--logo-centre-y]': 'logo().centreY',
  },
  templateUrl: './projets.html',
  styleUrl: './projets.css',
})
export class Projets extends PieceBase {
  override readonly id = 'projets';
  private readonly site = inject(LangueSite);
  /** Les projets dans la langue du site (Paul, 29/09). */
  readonly projets = computed(() => projetsDans(this.site.langue()));
  protected readonly intro = computed(() =>
    this.site.langue() === 'en' ? 'Three projects, one world' : "Trois projets d'un même monde",
  );
  protected readonly placement = inject(Placement);

  /** Les décalages des trois textes, au moment affiché. */
  protected readonly textes = computed(() => this.placement.courante().textes);

  constructor() {
    super();
    // Comme une carte de texte : la salle dit combien elle a de temps. Au
    // téléphone, un de plus par carte (`Placement.carteMontree`).
    effect(() => {
      const total = this.nav.format() === 'etroit' ? PAGES_ETROIT : MOMENTS.length;
      untracked(() => this.nav.declarerPages(this.id, total));
    });
  }

  /**
   * Le carré d'ORIGINE du logo (`ANCRE_TITRE_Y`), sur lequel le titre se cale
   * avant ses décalages — dans les unités de la salle : son côté se prend sur la
   * largeur, son haut sur la hauteur (voir `coeur/embleme.ts`). La salle posée
   * remplit l'écran, donc `cqw`/`cqh` y valent exactement ce que la toile
   * compte en fractions de fenêtre.
   */
  readonly logo = computed(() => {
    const large = this.nav.format() === 'large';
    const w = large ? ANCRE_TITRE_LARGE : ANCRE_TITRE_ETROIT;
    const haut = (large ? HAUT_LARGE : HAUT_ETROIT) + ANCRE_TITRE_Y;
    return {
      cote: `${w * 100}cqw`,
      centreY: `calc(${haut * 100}cqh + ${w * 50}cqw)`,
    };
  });

  /** Une carte qu'on voit et qu'on peut ouvrir : révélée, et la sienne au téléphone. */
  montree(indice: number): boolean {
    const montree = this.placement.carteMontree();
    return this.placement.cartesRevelees() && (montree === null || montree === indice);
  }

  /**
   * Par quel bord de l'écran chaque carte s'écarte quand une autre s'ouvre en
   * grand : celle de gauche par la gauche, celle de droite par la droite,
   * celle du milieu par le bas.
   */
  entree(indice: number): 'gauche' | 'bas' | 'droite' {
    if (indice === 0) return 'gauche';
    return indice === this.projets().length - 1 ? 'droite' : 'bas';
  }
}
