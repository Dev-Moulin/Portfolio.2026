// Le décor vivant de la salle Hermès : le visage H6 dans les nuages, et le
// logo Hermes Agent qui sort de la brume (Blender, scène « Hermes » de
// niveau2Background.blend ; `scripts/blender-salle-hermes.py`).
//
// UNE APPARITION, PUIS UNE BOUCLE. Le logo doit SORTIR de la brume à chaque
// arrivée (Paul, 23/09) ; une boucle unique le referait naître toutes les
// 18 s. La piste contient donc les deux à la suite : l'APPARITION (8 s), puis
// la BOUCLE (18 s), dont la première image continue exactement la dernière de
// l'apparition (mesuré au rendu). Le lecteur commun (`tapis-video`) pose
// l'apparition une fois, puis les tours de boucle à sa suite, sans fin : une
// seule vidéo, aucun relais. À chaque arrivée, on revient au début.
//
// (Jusqu'au 23/09 au soir : deux balises vidéo et un relais entre elles — et
// un bogue : si le navigateur refusait de lancer la boucle, le filet de
// secours relançait l'apparition, déjà finie, et le décor restait figé.)
//
// POURQUOI AUCUN FONDU À L'ARRIVÉE. La première image de l'apparition est H6
// elle-même, sans brume ni logo — exactement ce que la toile du passage
// affiche déjà, étiré de la même façon à la taille de la fenêtre (d'où
// `object-fit: fill`, et pas `cover`). La vidéo peut donc apparaître d'un
// coup : on ne voit que la brume se lever. Et tant qu'elle n'a pas d'image à
// montrer, une vidéo est transparente : on voit la toile, c'est-à-dire la
// même chose.
//
// AU DÉPART, UN FONDU COURT. Dès qu'on quitte la salle (premier cran de
// molette), la caméra part et la toile se remet à zoomer : un décor fixe
// resterait collé par-dessus. Il s'efface donc en 0,35 s, sur la toile qui
// porte la même image sans la brume.
//
// AU TÉLÉPHONE (29/09), la même salle en portrait
// (`scripts/blender-salle-hermes-mobile.py`) : sa première image est
// l'étage 20 du passage téléphone, que la toile y montre en `cover`, centré —
// la vidéo se cadre donc de la même façon (classe `fond-hermes--portrait`).
// Le format est lu une fois : `app.html` recrée ce décor quand il change.
//
// La lecture elle-même — lancement, relances, secours — est celle de tous
// les décors : `composants/tapis-video/`.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { TapisVideo } from '../tapis-video/tapis-video';

/** Le temps du fondu de sortie (`fond-hermes.css`), plus une marge. */
const FONDU_SORTIE = 400;

function mouvementReduit(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

@Component({
  selector: 'pz-fond-hermes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fond-hermes',
    'aria-hidden': 'true',
    '[class.fond-hermes--visible]': 'presente()',
    '[class.fond-hermes--portrait]': 'portrait',
  },
  template: `
    <video
      #video
      class="fond-hermes__video"
      [poster]="affiche"
      muted
      playsinline
      preload="auto"
    ></video>
  `,
  styleUrl: './fond-hermes.css',
})
export class FondHermes {
  private readonly nav = inject(Navigation);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  /** On est posé dans la salle Hermès. */
  protected readonly presente = computed(() => this.nav.sallePresente() === 'orchestrateur');

  /** Le téléphone a sa propre salle, en portrait. */
  protected readonly portrait = this.nav.format() === 'etroit';

  /** Même règle que la salle 2 : la grande version pour les grands écrans. */
  private readonly taille =
    typeof window !== 'undefined' && window.innerWidth * (window.devicePixelRatio || 1) > 1400
      ? 1664
      : 1280;

  /**
   * L'image fixe : la boucle, logo visible. C'est ce qu'on voit en mouvement
   * réduit, et tant que l'appareil refuse de lancer la vidéo (un iPhone en
   * économie d'énergie, par exemple).
   */
  protected readonly affiche = this.portrait
    ? 'salle-hermes/hermes-boucle-poster-portrait.jpg'
    : this.taille === 1664
      ? 'salle-hermes/hermes-boucle-poster-1664.jpg'
      : 'salle-hermes/hermes-boucle-poster.jpg';

  private tapis: TapisVideo | null = null;
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      // En mouvement réduit, pas de brume qui bouge : l'affiche seule.
      if (mouvementReduit()) return;
      const t = this.taille;
      this.tapis = new TapisVideo(this.video().nativeElement, {
        nom: this.portrait ? 'salle Hermès · brume portrait' : 'salle Hermès · brume',
        intro: 8,
        duree: 18,
        pistes: this.portrait
          ? [
              { url: 'salle-hermes/hermes-piste-portrait-h264.mp4', codec: 'avc1.640028' },
              { url: 'salle-hermes/hermes-piste-portrait-vp9.mp4', codec: 'vp09.00.40.08' },
            ]
          : [
              { url: `salle-hermes/hermes-piste-${t}-h264.mp4`, codec: t === 1664 ? 'avc1.640028' : 'avc1.64001f' },
              { url: `salle-hermes/hermes-piste-${t}-vp9.mp4`, codec: t === 1664 ? 'vp09.00.40.08' : 'vp09.00.31.08' },
            ],
      });
      if (this.presente()) this.arriver();
    });

    effect(() => {
      const la = this.presente();
      untracked(() => (la ? this.arriver() : this.partir()));
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.minuteur !== null) clearTimeout(this.minuteur);
      this.tapis?.detruire();
    });
  }

  /** À chaque arrivée : l'apparition repart du début. */
  private arriver(): void {
    if (this.minuteur !== null) clearTimeout(this.minuteur);
    this.minuteur = null;
    this.tapis?.revenirAuDebut();
    this.tapis?.souhaite(true);
  }

  /** En partant : tout s'arrête, et revient au début une fois effacé. */
  private partir(): void {
    this.tapis?.souhaite(false);
    if (this.minuteur !== null) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.minuteur = null;
      this.tapis?.revenirAuDebut();
    }, FONDU_SORTIE);
  }
}
