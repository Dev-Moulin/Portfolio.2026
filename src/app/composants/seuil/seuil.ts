// Pièce 0 — le seuil. La carte de profil : qui est là, et ce qu'il sait faire.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PieceBase } from '../piece-base';
import { CarteTexte, PageCarte } from '../carte-texte/carte-texte';
import { Inclinaison } from '../vignette/inclinaison';
import { Bienvenue } from '../bienvenue/bienvenue';
import { PROFIL, PROFIL_EN } from '../../coeur/contenu';
import { LangueSite } from '../../langue';
import { BoutonLangue } from '../bouton-langue/bouton-langue';
import { couvertureDescente } from '../../coeur/descente';
import { ETAGES_DESCENTE } from '../../coeur/descente-etages';
import { GLISSEMENT_ACCUEIL } from '../../coeur/choregraphie';

@Component({
  selector: 'pz-seuil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarteTexte, PageCarte, NgTemplateOutlet, Inclinaison, Bienvenue, BoutonLangue],
  host: {
    class: 'piece piece--seuil',
    '[class.seuil--sur-la-photo]': 'surLaPhoto()',
    '[class.seuil--accueil]': 'accueil()',
  },
  templateUrl: './seuil.html',
  styleUrl: './seuil.css',
})
export class Seuil extends PieceBase {
  override readonly id = 'seuil';
  private readonly site = inject(LangueSite);
  /** La carte dans la langue du site (Paul, 29/09 : le profil d'abord). */
  readonly profil = computed(() => (this.site.langue() === 'en' ? PROFIL_EN : PROFIL));
  readonly altPhoto = computed(() =>
    this.site.langue() === 'en' ? 'Portrait of Paul Moulin' : 'Portrait de Paul Moulin',
  );

  /** Le téléphone : la photo et la carte ne tiennent pas côte à côte. */
  readonly etroit = computed(() => this.nav.format() === 'etroit');

  /**
   * AU TÉLÉPHONE, LA PHOTO EST À L'ÉCRAN (Paul, 28/09) : à l'accueil (page 0),
   * pendant le glissement qui précède le plongeon (`GLISSEMENT_ACCUEIL`), et
   * tant que la caméra n'est pas posée sur le seuil — en revenant de la
   * salle 2, on retrouve la photo, puis la carte glisse à sa place.
   */
  /** L'accueil lui-même : la photo à l'arrêt, page 0, rien en partance. */
  readonly accueil = computed(
    () =>
      this.etroit() &&
      (this.nav.pages().get('seuil')?.page ?? 0) === 0 &&
      this.nav.salleEnPartance() !== 'seuil' &&
      this.nav.profondeurAffichee() <= 0.0005,
  );

  readonly surLaPhoto = computed(
    () =>
      this.etroit() &&
      ((this.nav.pages().get('seuil')?.page ?? 0) === 0 ||
        this.nav.salleEnPartance() === 'seuil' ||
        this.nav.profondeurAffichee() > 0.0005),
  );

  /**
   * Vrai quand la descente pré-calculée recouvre entièrement le seuil : on
   * cesse alors de le peindre.
   *
   * Ce n'est pas une économie de confort. La photo est mise en page à 460 px
   * et le zoom l'agrandit sans limite : à 72 % de la descente elle est rendue
   * à 19 000 px de large, et franchit le plafond de texture de 16 384 px que
   * la plupart des navigateurs imposent. Le re-tramage qui s'ensuit fait
   * sauter l'animation — Paul l'a vu « aux trois quarts, sur le logo THP ».
   *
   * `opacity: 0` ne suffirait pas : il faut que l'élément sorte de la mise en
   * page, donc `display: none`. Et la bascule ne se fait qu'à couverture
   * PLEINE : tant que la toile est translucide, la photo doit rester peinte
   * et opaque, sans quoi on rouvre le creux du raccord.
   *
   * En format ÉTROIT, jamais : la descente n'y peint rien, donc masquer le
   * seuil ferait disparaître son texte sans que rien vienne le remplacer.
   */
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    super();
    // LE GLISSEMENT EST VERTICAL (Paul, 29/09) : on descend toujours. De la
    // photo à la carte, la photo monte et sort par le haut, la carte arrive
    // par le bas ; en partant vers la salle 2, la carte monte à son tour et
    // la photo revient par le bas, avant le plongeon. En remontant, tout se
    // rejoue dans l'autre sens.
    //
    // Le côté d'où la photo arrive dépend donc du SENS du trajet, et non de
    // l'état où l'on va — ce qu'une feuille de style ne sait pas dire. Les
    // glissements sont joués ici (Web Animations) ; au repos, la feuille de
    // style range simplement ce qui est caché sous l'écran. En hauteurs
    // d'ÉCRAN (`vh`) : en pour cent de sa propre hauteur, la carte, plus
    // courte que l'écran, dépassait encore en bas.
    let avant: boolean | null = null;
    let pageAvant = 0;
    effect(() => {
      const photo = this.surLaPhoto();
      const page = this.nav.pages().get('seuil')?.page ?? 0;
      untracked(() => {
        if (avant !== null && photo !== avant && this.etroit()) {
          // Vers la photo : en remontant de la carte (page 0), ou en partant
          // vers la salle 2. Vers la carte : depuis l'accueil (on descend),
          // ou en revenant de la salle 2 (on remonte).
          const descend = photo ? page !== 0 : pageAvant === 0;
          this.glisser(photo, descend);
        }
        avant = photo;
        pageAvant = page;
      });
    });
  }

  /** Joue le glissement vertical entre la photo et la carte. */
  private glisser(versLaPhoto: boolean, descend: boolean): void {
    if (typeof this.hote.animate !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const photo = ['.seuil__photo', '.seuil__accueil'];
    const carte = ['.seuil__carte', '.seuil__liens'];
    const [entrent, sortent] = versLaPhoto ? [photo, carte] : [carte, photo];
    const sens = descend ? 1 : -1;
    // VERS LA CARTE, court et doux ; VERS LA PHOTO, la courbe du site sur
    // `GLISSEMENT_ACCUEIL` : c'est lui qui précède le plongeon (28/09).
    const temps: KeyframeAnimationOptions = versLaPhoto
      ? { duration: GLISSEMENT_ACCUEIL * 1000, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }
      : { duration: 600, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)' };
    const jouer = (selecteurs: string[], de: number, a: number) => {
      for (const s of selecteurs) {
        this.hote
          .querySelector(s)
          ?.animate([{ translate: `0 ${de}vh` }, { translate: `0 ${a}vh` }], temps);
      }
    };
    jouer(sortent, 0, -110 * sens);
    jouer(entrent, 110 * sens, 0);
  }

  readonly couvertParLaDescente = computed(
    () =>
      this.nav.format() === 'large' &&
      couvertureDescente(this.nav.profondeurAffichee(), ETAGES_DESCENTE) >= 1,
  );
}
