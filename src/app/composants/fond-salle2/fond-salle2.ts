// Le décor de la salle 2 : la boucle vidéo du temple, posée derrière la scène.
//
// POURQUOI ELLE N'EST PAS DANS LA PIÈCE. Même raison que la trame et les
// emblèmes : la scène porte un `transform: scale()` qui monte jusqu'à 457, et
// une image mise en page dedans est agrandie sans limite — la photo du seuil
// atteignait 19 000 px de large aux trois quarts de la descente et franchissait
// le plafond de texture de 16 384 px des navigateurs, ce qui faisait sauter
// l'animation (commit 6b98ab6). Le décor est donc un calque plein écran, fixe,
// posé DERRIÈRE la scène — et le fond de la pièce devient transparent.
//
// POURQUOI CE N'EST PAS `opaciteContenu`. C'était l'erreur du 10/09, et elle se
// voyait dès la page d'accueil : `opaciteContenu` fait apparaître le CONTENU
// d'une pièce une pièce et demie à l'avance, exprès — c'est ce pré-affichage
// qui donne la sensation d'emboîtement quand on approche d'une salle. Appliqué
// à un décor plein écran, il mettait le temple à 71 % d'opacité SUR la trame du
// seuil, dès la profondeur 0, et à 100 % au début du zoom. Un décor n'est pas
// un contenu : il se relaie à l'ARRIVÉE, pas avant. `opaciteOuvertureInvisible`
// est la fonction de cette arrivée-là, et ce sont ses deux nombres — mesurés,
// pas choisis — qui commandent déjà le fondu de sortie de la pyramide. Les deux
// calques se croisent donc exactement, sur du noir des deux côtés : le noir du
// « H » devient le temple sans trou ni recouvrement.
//
// POURQUOI LA LECTURE DÉMARRE AVANT D'ÊTRE VUE. Arriver sur une image figée se
// voit. La boucle est donc lancée un peu en amont de l'arrivée, alors qu'elle
// est encore invisible, et réellement mise en pause partout ailleurs : décoder
// 24 images par seconde qu'on ne voit pas coûte du courant pour rien.
//
// LA LECTURE ELLE-MÊME — lancement, boucle, relances, secours — est celle de
// tous les décors : `composants/tapis-video/`. Jusqu'au 23/09, ce fichier
// avait la sienne, avec un chien de garde qui relançait la vidéo à chaque
// pause, y compris celles que Chrome impose à un onglet caché.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { opaciteOuvertureInvisible } from '../../coeur/presentation';
import { entreeHermes } from '../../coeur/passages';
import { TapisVideo, type ReglageTapis } from '../tapis-video/tapis-video';

/** La profondeur de la salle 2 dans le chemin. */
const PROFONDEUR_SALLE2 = 1;

/** Combien de profondeur avant la salle la boucle se met à tourner. */
const PRE_LECTURE = 0.15;

@Component({
  selector: 'pz-fond-salle2',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fond-salle2', '[style.opacity]': 'opacite()' },
  template: `
    <!-- Au téléphone, le temple PORTRAIT (Paul, 29/09) : la même salle,
         rendue en 936 × 1664 depuis l'image d'où part le passage vers la
         salle Hermès. Deux balises, et pas une : faire pivoter l'appareil
         remplace la vidéo, et le lecteur avec elle. -->
    @if (large()) {
      <video
        #boucle
        class="fond-salle2__boucle"
        [poster]="affiche"
        aria-hidden="true"
        muted
        playsinline
        preload="auto"
      ></video>
    } @else {
      <video
        #boucle
        class="fond-salle2__boucle"
        [poster]="affichePortrait"
        aria-hidden="true"
        muted
        playsinline
        preload="auto"
      ></video>
    }
  `,
  styleUrl: './fond-salle2.css',
})
export class FondSalle2 {
  private readonly nav = inject(Navigation);
  private readonly boucle = viewChild<ElementRef<HTMLVideoElement>>('boucle');

  /**
   * Émis quand la première image est décodée. C'est le signal d'accrochage du
   * reste : Three.js et les emblèmes ne se chargent qu'après, jamais avant.
   */
  readonly pret = output<void>();

  /** La boucle paysage au grand écran, la boucle portrait au téléphone. */
  protected readonly large = computed(() => this.nav.format() === 'large');

  private readonly reglageLarge: ReglageTapis = {
    nom: 'salle 2 · temple',
    intro: 0,
    duree: 18,
    pistes: [
      { url: 'salle2/salle2-piste-1664-h264.mp4', codec: 'avc1.640028' },
      { url: 'salle2/salle2-piste-1664-vp9.mp4', codec: 'vp09.00.40.08' },
    ],
  };
  private readonly reglagePortrait: ReglageTapis = {
    nom: 'salle 2 · temple portrait',
    intro: 0,
    duree: 18,
    pistes: [
      { url: 'salle2/salle2-piste-portrait-h264.mp4', codec: 'avc1.640028' },
      { url: 'salle2/salle2-piste-portrait-vp9.mp4', codec: 'vp09.00.40.08' },
    ],
  };
  protected readonly affiche = 'salle2/salle-boucle-poster-1664.jpg';
  protected readonly affichePortrait = 'salle2/salle-boucle-poster-portrait.jpg';

  /**
   * Le décor se relaie deux fois : avec la trame du seuil à l'arrivée, et
   * avec la toile de la porte du temple au départ vers la salle Hermès. Sans
   * ce second relais, le temple réapparaîtrait sous la salle Hermès quand on
   * la quitte, au moment où sa toile s'efface.
   */
  protected readonly opacite = computed(() => {
    const d = this.nav.profondeurAffichee();
    return opaciteOuvertureInvisible(d, PROFONDEUR_SALLE2) * (1 - entreeHermes(d));
  });

  /**
   * Vrai tant que la boucle doit tourner : un peu avant d'arriver, et
   * jusqu'à un peu après être parti, quand la toile du passage la recouvre
   * entièrement depuis longtemps. La même avance des deux côtés : en
   * remontant de la salle Hermès, la boucle doit tourner AVANT que la toile
   * ne s'efface, sinon on retomberait sur une image figée.
   */
  protected readonly tourne = computed(() => {
    const d = this.nav.profondeurAffichee();
    return d >= PROFONDEUR_SALLE2 - PRE_LECTURE && d <= PROFONDEUR_SALLE2 + PRE_LECTURE;
  });

  private tapis: TapisVideo | null = null;

  constructor() {
    // Un lecteur par vidéo : faire pivoter un téléphone en change.
    effect(() => {
      const boucle = this.boucle();
      untracked(() => {
        this.tapis?.detruire();
        this.tapis = null;
        if (boucle === undefined) return;
        const reglage = this.large() ? this.reglageLarge : this.reglagePortrait;
        this.tapis = new TapisVideo(boucle.nativeElement, reglage, () => this.pret.emit());
        this.tapis.souhaite(this.tourne());
      });
    });
    effect(() => {
      const tourne = this.tourne();
      untracked(() => this.tapis?.souhaite(tourne));
    });
    inject(DestroyRef).onDestroy(() => this.tapis?.detruire());
  }
}
