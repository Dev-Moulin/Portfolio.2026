// La carte d'un projet, ouverte EN GRAND, sur place.
//
// Jusqu'au 23/09, c'était un panneau qui glissait de la droite, par-dessus un
// voile sombre, avec un bouton « Ressortir ». Paul veut que ce soit la CARTE
// elle-même qui s'ouvre : les deux autres cartes et le texte de la salle
// s'en vont, celle qu'on a cliquée glisse au centre, grandit, son en-tête
// monte en haut et le reste de son contenu apparaît ligne par ligne. Un clic
// à côté, Échap ou la croix, et tout se rejoue à l'envers.
//
// POURQUOI UNE COPIE DE LA VIGNETTE, ET PAS LA VIGNETTE ELLE-MÊME. La vignette
// vit dans la salle, que la page rend `inert` quand un projet est ouvert : on
// n'y pourrait ni faire défiler le contenu ni poser le focus. Elle est aussi
// rognée par sa boîte. La carte ouverte est donc posée par-dessus la page,
// exactement sur la vignette (`departCarte`), et la vignette est masquée tant
// qu'elle est là. Pour l'œil, c'est la même carte.
//
// La navigation n'a pas changé : l'état reste `universOuvert`, et c'est
// toujours lui que le hash, Échap et le `inert` de la page suivent. Ce
// composant ne fait que le jouer à l'écran.
//
// SANS ATTENDRE LA FIN DE LA FERMETURE (Paul, 27/09). Une carte qui se
// referme ne bloque plus rien : on peut cliquer une autre vignette pendant
// qu'elle regagne sa place. Elle finit son retour pendant que la nouvelle
// s'ouvre — deux cartes à l'écran, chacune dans son propre élément, pour que
// la première garde son mouvement en cours (le reprendre dans le même
// élément la ferait sauter vers la nouvelle vignette).

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { projetsDans, type Projet } from '../../coeur/contenu';
import { LangueSite } from '../../langue';
import { departCarte, departCarteEtroite } from '../../coeur/presentation';
import { SILENCE_MOLETTE, tourner } from '../../coeur/pages';
import { Inclinaison } from '../vignette/inclinaison';

/**
 * Combien de temps la carte reste à l'écran après la fermeture, le temps de
 * rejouer son ouverture à l'envers. DOIT suivre `--mouvement` (`styles.css`),
 * la durée de ce retour, plus une marge.
 */
const DUREE_FERMETURE = 2100;

/**
 * Quand la carte a fini de s'ouvrir : `--ouverture-delai` + `--mouvement`
 * (`univers.css`), plus une marge. Avant, pas de barre de défilement.
 */
const DUREE_OUVERTURE = 2400;

/** Les mots fixes de la carte ouverte, par langue ; les textes des projets sont dans `contenu.ts`. */
const MOTS = {
  fr: {
    fermer: 'Fermer',
    extraits: 'Extraits de la démo',
    extrait: 'Extrait',
    sur: 'sur',
    projet: 'Le projet',
    part: 'Ma part',
    difficulte: 'La difficulté',
    suite: 'La suite',
    titres: ['le projet', 'ma part'],
  },
  en: {
    fermer: 'Close',
    extraits: 'Demo clips',
    extrait: 'Clip',
    sur: 'of',
    projet: 'The project',
    part: 'My part',
    difficulte: 'The challenge',
    suite: "What's next",
    titres: ['the project', 'my part'],
  },
} as const;

/** Combien de pastilles de la pile la vignette montre ; la carte ouverte les montre toutes. */
const PILE_VIGNETTE = 4;

type Phase = 'depart' | 'ouverte' | 'fermeture';

/** Une carte à l'écran. */
interface Carte {
  /** Un numéro propre à chaque ouverture : il garde son élément à la carte. */
  readonly cle: number;
  readonly projet: Projet;
  readonly phase: Phase;
  /**
   * La hauteur de la carte ouverte : celle de son contenu, bornée à 82 % de
   * l'écran (au-delà, il défile). Mesurée juste avant de l'ouvrir, sur une
   * copie invisible : une hauteur `auto` ne s'anime pas, et une hauteur fixe
   * laissait la moitié basse vide pour un projet court.
   */
  readonly hauteurOuverte: number | null;
  /** Le contenu dépasse la carte ouverte : il faudra le faire défiler. */
  readonly defile: boolean;
  /** La carte a fini de s'ouvrir. */
  readonly posee: boolean;
  /** La page lue, pour une carte en deux pages (`Projet.ouverte`). */
  readonly page: number;
  /** L'extrait de la démo au centre du carrousel. */
  readonly extrait: number;
}

function mouvementReduit(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

@Component({
  selector: 'pz-univers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Inclinaison],
  host: {
    '[class.univers--etroit]': "nav.format() === 'etroit'",
    '(wheel)': 'molette($event)',
    '(window:keydown)': 'clavier($event)',
  },
  template: `
    @if (ouverte() !== null) {
      <div class="attrape-clic" (click)="nav.fermerUnivers()" aria-hidden="true"></div>
    }
    @for (c of cartes(); track c.cle) {
      @let p = c.projet;
      @let d = depart(p.id);
      <section
        #carte
        class="carte verre"
        [attr.data-cle]="c.cle"
        [class.carte--ouverte]="c.phase === 'ouverte'"
        [class.carte--fermeture]="c.phase === 'fermeture'"
        [class.carte--defile]="c.defile && c.posee"
        [class.carte--pages]="pagine()"
        (touchstart)="poserDoigt($event)"
        (touchend)="leverDoigt($event, c.cle)"
        [style.--x.%]="d?.centreX"
        [style.--y.%]="d?.centreY"
        [style.--l.%]="d?.largeur"
        [style.--h.%]="d?.hauteur"
        [style.--w]="largeurVignette(p.id)"
        [style.--hauteur-ouverte.px]="c.hauteurOuverte"
        [attr.role]="c.phase === 'fermeture' ? null : 'dialog'"
        [attr.aria-modal]="c.phase === 'fermeture' ? null : 'true'"
        [attr.aria-hidden]="c.phase === 'fermeture' ? 'true' : null"
        [attr.inert]="c.phase === 'fermeture' ? '' : null"
        tabindex="-1"
        [attr.aria-label]="p.nom"
      >
        <button type="button" class="carte__fermer" [attr.aria-label]="t().fermer" (click)="nav.fermerUnivers()">
          <span aria-hidden="true">×</span>
        </button>

        <div class="carte__defilement">
          <div class="carte__contenu">
            <p class="carte__baseline">{{ p.baseline }}</p>
            <h2 class="carte__nom">{{ p.nom }}</h2>
            <p class="carte__accroche">{{ p.accroche }}</p>

            @let o = p.ouverte;
            <div class="carte__pages">
                <div
                  class="carte__page"
                  [class.carte__page--lue]="pagine() && c.page > 0"
                  [attr.inert]="!pagine() || c.page === 0 ? null : ''"
                  [attr.aria-hidden]="!pagine() || c.page === 0 ? null : 'true'"
                >
                  <div class="ligne" style="--i: 0">
                    <div class="carte__demo">
                      <div class="carte__coverflow">
                        @for (b of o.demo.boucles; track b.src; let i = $index) {
                          @let rang = rangExtrait(i, c.extrait, o.demo.boucles.length);
                          <video
                            class="carte__boucle"
                            [attr.data-rang]="rang"
                            [muted]="true"
                            playsinline
                            preload="none"
                            [poster]="b.src + '.webp'"
                            aria-hidden="true"
                            (click)="rang === 0 ? ouvrirDemo(o.demo.href) : allerExtrait(c.cle, i)"
                            (ended)="extraitFini(c.cle, i, o.demo.boucles.length)"
                          >
                            <source [src]="b.src + '.mp4'" type="video/mp4" />
                          </video>
                        }
                      </div>
                      @if (o.demo.boucles[c.extrait]?.legende; as legende) {
                        <p class="carte__legende" aria-live="polite">{{ legende }}</p>
                      }
                      <div class="carte__demo-pied">
                        <div class="carte__demo-liens">
                          <a
                            class="carte__bouton verre reflet"
                            pzInclinaison
                            [href]="o.demo.href"
                            target="_blank"
                            rel="noopener noreferrer"
                          ><span class="carte__icone carte__icone--play" aria-hidden="true"></span>{{ o.demo.libelle }}</a>
                          @for (lien of o.demo.liens ?? []; track lien.href) {
                            <a
                              class="carte__bouton verre reflet"
                              pzInclinaison
                              [href]="lien.href"
                              target="_blank"
                              rel="noopener noreferrer"
                            ><span class="carte__icone" aria-hidden="true"></span>{{ lien.libelle }}</a>
                          }
                        </div>
                        <ol class="carte__extraits" [attr.aria-label]="t().extraits">
                          @for (b of o.demo.boucles; track b.src; let i = $index) {
                            <li>
                              <button
                                type="button"
                                class="carte__extrait"
                                [class.carte__extrait--actif]="i === c.extrait"
                                [attr.aria-current]="i === c.extrait ? 'true' : null"
                                [attr.aria-label]="t().extrait + ' ' + (i + 1) + ' ' + t().sur + ' ' + o.demo.boucles.length"
                                (click)="allerExtrait(c.cle, i)"
                              ></button>
                            </li>
                          }
                        </ol>
                      </div>
                    </div>
                  </div>
                  <div class="ligne" style="--i: 1">
                    <p class="carte__contexte">{{ p.contexte }}</p>
                  </div>
                  <div class="ligne" style="--i: 2">
                    <div>
                      <h3 class="carte__intertitre">{{ t().projet }}</h3>
                      <p class="carte__texte">{{ p.description }}</p>
                    </div>
                  </div>
                </div>

                <div
                  class="carte__page"
                  [class.carte__page--suivante]="pagine() && c.page < 1"
                  [attr.inert]="!pagine() || c.page === 1 ? null : ''"
                  [attr.aria-hidden]="!pagine() || c.page === 1 ? null : 'true'"
                >
                  @if (o.part.length) {
                  <div class="ligne" style="--i: 0">
                    <div>
                      <h3 class="carte__intertitre">{{ t().part }}</h3>
                      <ul class="carte__liste">
                        @for (fait of o.part; track fait) {
                          <li class="carte__fait">{{ fait }}</li>
                        }
                      </ul>
                    </div>
                  </div>
                  }
                  @if (o.difficulte) {
                  <div class="ligne" style="--i: 1">
                    <div>
                      <h3 class="carte__intertitre">{{ t().difficulte }}</h3>
                      <p class="carte__texte">{{ o.difficulte }}</p>
                    </div>
                  </div>
                  }
                  @if (o.suite) {
                  <div class="ligne" style="--i: 2">
                    <div>
                      <h3 class="carte__intertitre">{{ t().suite }}</h3>
                      <p class="carte__texte">{{ o.suite }}</p>
                    </div>
                  </div>
                  }
                  @if (o.liens.length) {
                  <div class="ligne" style="--i: 3">
                    <ul class="carte__liens">
                      @for (lien of o.liens; track lien.href) {
                        <li>
                          <a class="carte__bouton verre reflet"
                          pzInclinaison [href]="lien.href" target="_blank" rel="noopener noreferrer"
                            ><span
                              class="carte__icone"
                              [class.carte__icone--play]="lien.href === o.demo.href"
                              aria-hidden="true"
                            ></span
                            >{{ lien.href === o.demo.href ? o.demo.libelle : lien.libelle }}</a
                          >
                        </li>
                      }
                    </ul>
                  </div>
                  }
                </div>
            </div>

            <ul class="carte__pile">
              @for (outil of p.stack; track outil; let i = $index) {
                <li class="verre" [class.carte__pile-suite]="i >= pileVignette" style="--i: 4">
                  {{ outil }}
                </li>
              }
            </ul>
          </div>
        </div>

        @if (pagine()) {
          <ol class="carte__points" aria-label="Pages">
            @for (titre of t().titres; track titre; let i = $index) {
              <li>
                <button
                  type="button"
                  class="carte__point"
                  [class.carte__point--actif]="i === c.page"
                  [attr.aria-current]="i === c.page ? 'page' : null"
                  [attr.aria-label]="'Page ' + (i + 1) + ' ' + t().sur + ' ' + titresPages.length + ', ' + titre"
                  (click)="allerPage(c.cle, i)"
                ></button>
              </li>
            }
          </ol>
        }
      </section>
    }
  `,
  styleUrls: ['./univers.css', './univers-pages.css'],
})
export class Univers {
  protected readonly nav = inject(Navigation);
  private readonly site = inject(LangueSite);
  /** Les mots fixes de la carte, dans la langue du site (Paul, 29/09). */
  protected readonly t = computed(() => MOTS[this.site.langue()]);
  protected readonly pileVignette = PILE_VIGNETTE;
  /** Les deux pages d'une carte ouverte en deux temps, pour les points. */
  protected readonly titresPages = ['le projet', 'ma part'] as const;

  /** Les cartes à l'écran : celle qui est ouverte, et celles qui se referment encore. */
  readonly cartes = signal<readonly Carte[]>([]);
  /**
   * Les deux pages ne se tournent que sur grand écran. Au téléphone, même la
   * première ne tient pas dans l'écran : tourner des pages qu'il faut aussi
   * faire défiler serait déroutant. Elles se suivent donc en une seule
   * colonne, qu'on fait défiler (Paul, 28/09).
   */
  protected readonly pagine = computed(() => this.nav.format() !== 'etroit');
  /** La carte ouverte (ou qui s'ouvre) : au plus une. */
  readonly ouverte = computed(() => this.cartes().find((c) => c.phase !== 'fermeture') ?? null);

  private readonly elements = viewChildren<ElementRef<HTMLElement>>('carte');
  /** L'élément d'où l'on vient, pour y ramener le clavier à la fermeture. */
  private origine: HTMLElement | null = null;
  /** Les minuteries de chaque carte, par clé. */
  private readonly minuteurs = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly images = new Map<number, number>();
  private prochaineCle = 1;
  /** Où le doigt s'est posé sur la carte, et s'il était sur le carrousel. */
  private doigt: { x: number; y: number; carrousel: boolean } | null = null;
  /** La rafale de molette en cours : un geste = une page (voir `app.ts`). */
  private rafale: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const id = this.nav.universOuvert();
      // La carte part de la vignette : on attend donc que la salle 2 soit
      // posée (lien direct `#intuition`, ou arrivée en cours). Ouverte depuis
      // une autre salle — le plan pour lecteurs d'écran le permet —, elle
      // s'ouvre tout de suite.
      const pret =
        id !== null &&
        (this.nav.sallePresente() === 'projets' || this.nav.pieceCourante() !== 'projets');
      untracked(() => {
        if (id !== null && pret) this.ouvrir(id);
        else if (id === null) this.fermer();
      });
    });

    // Carte ouverte : la page rend le défilement au doigt (`styles.css`).
    effect(() => {
      const ouverte = this.ouverte() !== null;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('univers-ouvert', ouverte);
      }
    });

    // Le clavier entre dans la carte à l'ouverture, et revient à la vignette
    // d'origine à la fermeture — sinon la tabulation repartirait du début.
    effect(() => {
      const cle = this.ouverte()?.cle ?? null;
      const element =
        cle === null
          ? null
          : (this.elements().find((e) => e.nativeElement.dataset['cle'] === String(cle))
              ?.nativeElement ?? null);
      untracked(() => {
        if (element) {
          const actif = document.activeElement;
          if (actif instanceof HTMLElement && !actif.closest('pz-univers')) this.origine = actif;
          element.focus();
        } else if (cle === null && this.origine !== null) {
          this.origine.focus();
          this.origine = null;
        }
      });
    });

    // LE CARROUSEL DE LA DÉMO (Paul, 27/09) : seul l'extrait du centre tourne,
    // et seulement sur la page 1 d'une carte ouverte — jamais dans la
    // vignette qui s'ouvre, ni sur la page 2, ni en se refermant. Ceux de
    // côté restent en pause sur l'image où ils se sont arrêtés. Lancés à la
    // main, pas par `autoplay` : le mouvement réduit les laisse sur leur
    // affiche. À la fin d'un extrait, le suivant vient au centre (`ended`).
    afterRenderEffect(() => {
      const cartes = this.cartes();
      for (const ref of this.elements()) {
        const cle = Number(ref.nativeElement.dataset['cle']);
        const carte = cartes.find((c) => c.cle === cle);
        const visible =
          carte !== undefined &&
          carte.phase === 'ouverte' &&
          (carte.page === 0 || !this.pagine()) &&
          !mouvementReduit();
        for (const video of Array.from(ref.nativeElement.querySelectorAll('video'))) {
          video.muted = true;
          const jouer = visible && video.dataset['rang'] === '0';
          if (jouer && video.paused) {
            if (video.ended) video.currentTime = 0;
            video.play().catch(() => {});
          } else if (!jouer && !video.paused) {
            video.pause();
          }
        }
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.rafale !== null) clearTimeout(this.rafale);
      for (const c of this.cartes()) this.annulerMinuteries(c.cle);
    });
  }

  /**
   * Les tailles de départ d'une carte : celles de sa vignette dans la salle 2.
   * Au téléphone, la carte présentée au centre, la même pour les trois.
   */
  protected depart(id: string) {
    if (this.nav.format() === 'etroit') return departCarteEtroite();
    const o = this.vignette(id);
    return o === null ? null : departCarte(o);
  }

  /** La largeur de la vignette en fraction d'écran : l'échelle de sa typographie. */
  protected largeurVignette(id: string): number {
    return this.vignette(id)?.w ?? 0.26;
  }

  private vignette(id: string) {
    return this.nav.graphe()['projets']?.ouvertures.find((o) => o.id === id) ?? null;
  }

  private ouvrir(id: string): void {
    const projet = projetsDans(this.site.langue()).find((p) => p.id === id) ?? null;
    if (projet === null) return;
    const ouverte = this.ouverte();
    if (ouverte?.projet.id === id) return;
    // Une autre ouverte (par le hash) : elle se referme, sans attendre.
    if (ouverte !== null) this.refermer(ouverte.cle);

    const revenante = this.cartes().find((c) => c.projet.id === id);
    if (revenante !== undefined || mouvementReduit()) {
      // Rouverte pendant qu'elle se refermait : elle repart d'où elle en est.
      if (revenante !== undefined) {
        this.annulerMinuteries(revenante.cle);
        this.changer(revenante.cle, { phase: 'ouverte', posee: true });
      } else {
        this.poser([...this.cartes(), this.nouvelle(projet, 'ouverte', true)]);
      }
      return;
    }

    // Une image posée SUR la vignette, puis la bascule : sans cette image
    // d'écart, le navigateur ne verrait que l'état final et n'animerait rien.
    const carte = this.nouvelle(projet, 'depart', false);
    this.poser([...this.cartes(), carte]);
    this.images.set(
      carte.cle,
      requestAnimationFrame(() => {
        this.mesurer(carte.cle);
        this.images.set(
          carte.cle,
          requestAnimationFrame(() => {
            this.images.delete(carte.cle);
            this.changer(carte.cle, { phase: 'ouverte' });
            this.minuteurs.set(
              carte.cle,
              setTimeout(() => {
                this.minuteurs.delete(carte.cle);
                this.changer(carte.cle, { posee: true });
              }, DUREE_OUVERTURE),
            );
          }),
        );
      }),
    );
  }

  /** La place d'un extrait dans le carrousel : 0 au centre, 1 à droite, -1 à gauche. */
  protected rangExtrait(i: number, centre: number, total: number): number {
    const rang = (i - centre + total) % total;
    return rang > total / 2 ? rang - total : rang;
  }

  protected allerExtrait(cle: number, extrait: number): void {
    this.changer(cle, { extrait });
  }

  /** Un extrait fini laisse la place au suivant — s'il était bien au centre. */
  protected extraitFini(cle: number, i: number, total: number): void {
    const carte = this.cartes().find((c) => c.cle === cle);
    if (carte?.extrait === i) this.changer(cle, { extrait: (i + 1) % total });
  }

  protected ouvrirDemo(href: string): void {
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  /** Les points : aller à une page. */
  protected allerPage(cle: number, page: number): void {
    this.changer(cle, { page });
  }

  /**
   * La molette tourne les pages de la carte ouverte — UN geste = UNE page,
   * compté en rafales comme pour les salles. Au téléphone, où les pages se
   * suivent sans être tournées, elle ne fait rien (le contenu défile).
   */
  protected molette(evenement: WheelEvent): void {
    const carte = this.ouverte();
    if (carte === null || !this.pagine()) return;
    evenement.preventDefault();
    const nouvelle = this.rafale === null;
    if (this.rafale !== null) clearTimeout(this.rafale);
    this.rafale = setTimeout(() => (this.rafale = null), SILENCE_MOLETTE);
    if (nouvelle) this.tournerPage(evenement.deltaY > 0 ? 1 : -1);
  }

  /** Les flèches et Page préc./suiv. tournent aussi les pages. */
  protected clavier(evenement: KeyboardEvent): void {
    if (this.ouverte() === null || !this.pagine()) return;
    const sens =
      evenement.key === 'ArrowDown' || evenement.key === 'PageDown'
        ? 1
        : evenement.key === 'ArrowUp' || evenement.key === 'PageUp'
          ? -1
          : 0;
    if (sens === 0) return;
    evenement.preventDefault();
    this.tournerPage(sens);
  }

  /**
   * AU DOIGT (téléphone, Paul 28/09). Un glissement horizontal sur le
   * carrousel change d'extrait ; un glissement vertical n'importe où sur la
   * carte tourne la page (vers le haut : la suivante). Un simple toucher
   * reste un clic : la vidéo du centre ouvre la démo.
   */
  protected poserDoigt(evenement: TouchEvent): void {
    const t = evenement.touches[0];
    if (evenement.touches.length !== 1 || t === undefined) {
      this.doigt = null;
      return;
    }
    const cible = evenement.target instanceof Element ? evenement.target : null;
    this.doigt = { x: t.clientX, y: t.clientY, carrousel: cible?.closest('.carte__coverflow') !== null && cible !== null };
  }

  protected leverDoigt(evenement: TouchEvent, cle: number): void {
    const depart = this.doigt;
    const t = evenement.changedTouches[0];
    this.doigt = null;
    const carte = this.cartes().find((c) => c.cle === cle);
    if (depart === null || t === undefined || carte === undefined) return;
    const o = carte.projet.ouverte;
    const dx = t.clientX - depart.x;
    const dy = t.clientY - depart.y;
    const SEUIL = 40;
    if (Math.abs(dx) >= SEUIL && Math.abs(dx) > Math.abs(dy)) {
      if (!depart.carrousel || (this.pagine() && carte.page !== 0)) return;
      const total = o.demo.boucles.length;
      this.allerExtrait(cle, (carte.extrait + (dx < 0 ? 1 : -1) + total) % total);
    } else if (Math.abs(dy) >= SEUIL && Math.abs(dy) > Math.abs(dx) && !carte.defile && this.pagine()) {
      const page = tourner(carte.page, this.titresPages.length, dy < 0 ? 1 : -1);
      if (page !== null) this.changer(cle, { page });
    }
  }

  private tournerPage(sens: 1 | -1): void {
    const carte = this.ouverte();
    if (carte === null) return;
    const page = tourner(carte.page, this.titresPages.length, sens);
    if (page !== null) this.changer(carte.cle, { page });
  }

  private nouvelle(projet: Projet, phase: Phase, posee: boolean): Carte {
    return { cle: this.prochaineCle++, projet, phase, hauteurOuverte: null, defile: false, posee, page: 0, extrait: 0 };
  }

  /**
   * Pose une copie invisible de la carte, OUVERTE, au gabarit final, et lit la
   * hauteur de son contenu. La copie emporte les attributs de la carte, donc
   * ses styles et ses variables : elle se met en page exactement pareil.
   */
  private mesurer(cle: number): void {
    const carte = this.elements().find((e) => e.nativeElement.dataset['cle'] === String(cle))
      ?.nativeElement;
    const contenu = carte?.querySelector('.carte__contenu');
    if (!carte || !contenu || typeof window === 'undefined') return;
    const copie = carte.cloneNode(false) as HTMLElement;
    copie.classList.add('carte--ouverte', 'carte--mesure');
    copie.removeAttribute('role');
    copie.removeAttribute('data-cle');
    copie.setAttribute('aria-hidden', 'true');
    const defilement = document.createElement('div');
    defilement.className = 'carte__defilement';
    for (const attr of Array.from(contenu.parentElement!.attributes)) {
      if (attr.name.startsWith('_ngcontent')) defilement.setAttribute(attr.name, '');
    }
    defilement.appendChild(contenu.cloneNode(true));
    copie.appendChild(defilement);
    carte.parentElement!.appendChild(copie);
    // Arrondie au pixel SUPÉRIEUR : un demi-pixel de contenu en trop suffit à
    // faire déborder la carte.
    const hauteur = Math.ceil(
      (copie.querySelector('.carte__contenu') as HTMLElement).getBoundingClientRect().height,
    );
    copie.remove();
    // Au téléphone, la carte peut prendre un peu plus de hauteur : il n'y a
    // rien à voir autour, et chaque ligne gagnée évite de faire défiler.
    const part = this.nav.format() === 'etroit' ? 0.88 : 0.82;
    const plafond = Math.floor(window.innerHeight * part);
    this.changer(cle, { defile: hauteur > plafond, hauteurOuverte: Math.min(hauteur, plafond) });
  }

  private fermer(): void {
    const ouverte = this.ouverte();
    if (ouverte !== null) this.refermer(ouverte.cle);
  }

  /** La carte regagne sa vignette, puis quitte l'écran. */
  private refermer(cle: number): void {
    this.annulerMinuteries(cle);
    if (mouvementReduit()) {
      this.retirer(cle);
      return;
    }
    this.changer(cle, { phase: 'fermeture', posee: false });
    this.minuteurs.set(
      cle,
      setTimeout(() => {
        this.minuteurs.delete(cle);
        this.retirer(cle);
      }, DUREE_FERMETURE),
    );
  }

  private retirer(cle: number): void {
    this.poser(this.cartes().filter((c) => c.cle !== cle));
  }

  private changer(cle: number, modif: Partial<Omit<Carte, 'cle' | 'projet'>>): void {
    this.poser(this.cartes().map((c) => (c.cle === cle ? { ...c, ...modif } : c)));
  }

  /** Les cartes changent : la salle 2 masque les vignettes qui ont leur copie à l'écran. */
  private poser(cartes: readonly Carte[]): void {
    this.cartes.set(cartes);
    this.nav.afficherCartes([...new Set(cartes.map((c) => c.projet.id))]);
  }

  private annulerMinuteries(cle: number): void {
    const minuteur = this.minuteurs.get(cle);
    if (minuteur !== undefined) clearTimeout(minuteur);
    const image = this.images.get(cle);
    if (image !== undefined) cancelAnimationFrame(image);
    this.minuteurs.delete(cle);
    this.images.delete(cle);
  }
}
