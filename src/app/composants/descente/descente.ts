// La descente pré-calculée, dessinée sur une toile posée par-dessus la scène.
//
// POURQUOI PAR-DESSUS ET PAS DEDANS. Une image placée dans la scène subirait
// le `transform` du zoom, et le navigateur la tramerait une fois pour toutes
// à sa taille de mise en page, minuscule : on aurait fabriqué des étages nets
// pour les afficher flous. Posée par-dessus, la toile est dimensionnée à
// l'écran et dessinée à cette taille-là. C'est net, par construction.
//
// Le prix à payer est que ce calque recouvre aussi la salle 2, qui vit dans
// la scène. D'où le fondu de sortie, réglé sur `ARRIVEE` : la pyramide
// s'efface exactement quand la salle apparaît.
//
// POURQUOI UNE TOILE ET PLUS DES `<img>`. Deux versions ont précédé. La
// première posait les étages en `left/top/width/height` : animer une largeur
// oblige le navigateur à refaire mise en page, peinture et tramation à chaque
// image — ça saccadait franchement. La seconde passait par `transform`, ce
// qui a beaucoup amélioré, mais laissait cinq calques composés vivre leur vie
// dans le navigateur : montage et démontage aux bords de la fenêtre, tramages
// de deux fois la taille de l'écran, `will-change` sur cinq éléments. Paul
// voyait encore, en dézoomant, « comme si une image disparaissait, hop,
// réapparaissait ».
//
// Aucune de ces heuristiques n'est observable depuis ici : ce projet se
// vérifie sans navigateur. Plutôt que de continuer à deviner, on reprend la
// main. Une seule toile, deux `drawImage` par image, sur des images qu'on
// garde décodées soi-même. Rien à monter, rien à démonter, rien à tramer en
// urgence — et un comportement qui ne dépend plus de ce que le navigateur
// décide dans notre dos.
//
// UNE TOILE, PLUSIEURS PASSAGES (23/09). La même toile joue maintenant aussi
// la porte du temple, de la salle 2 à la salle Hermès. Ce qui distingue un
// passage d'un autre — ses étages, où se pose la toile, quand elle se fige et
// s'efface — est décrit dans `coeur/passages.ts`. Sans passage donné, c'est
// le « H » de THP, exactement comme avant.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { calquesDeDescente, type CalqueDescente } from '../../coeur/descente';
import { PASSAGE_SEUIL, type Passage } from '../../coeur/passages';
import { PHOTO_SEUIL, calquesEtroits, type CalqueEtroit } from '../../coeur/descente-etroite';
import { opaciteOuvertureInvisible } from '../../coeur/presentation';

@Component({
  selector: 'pz-descente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'descente',
    'aria-hidden': 'true',
    '[style.opacity]': 'opacite()',
    '[class.descente--derriere]': 'passage().derriere',
  },
  template: `<canvas #toile class="descente__toile"></canvas>`,
  styleUrl: './descente.css',
})
export class Descente implements OnInit {
  private readonly nav = inject(Navigation);
  private readonly destroyRef = inject(DestroyRef);
  // Pas `required` : l'effet de dessin peut s'exécuter avant que la vue
  // existe, et lever une exception au premier tour serait absurde alors
  // qu'il n'y a simplement rien encore à dessiner.
  private readonly toile = viewChild<ElementRef<HTMLCanvasElement>>('toile');

  /** Le passage que cette toile joue. Par défaut, le « H » de THP. */
  readonly passage = input<Passage>(PASSAGE_SEUIL);

  /**
   * Les étages, chargés et décodés une fois pour toutes, et GARDÉS.
   *
   * La référence compte autant que le décodage : sans elle, l'objet devient
   * collectable et le navigateur s'autorise à jeter le décodage qu'on vient
   * de payer, pour le refaire en pleine descente.
   */
  private readonly images = new Map<string, HTMLImageElement>();
  private ctx: CanvasRenderingContext2D | null = null;
  private largeur = 0;
  private hauteur = 0;

  readonly calques = computed(() => {
    // En format étroit, rien n'est peint ici : les images des passages sont
    // cadrées pour le grand écran. Le « H » de THP y a son propre dessin
    // (`dessinerEtroit`), la porte du temple ses images portrait
    // (`passage.calquesEtroits`).
    if (this.nav.format() !== 'large') return [];
    const passage = this.passage();
    const d = this.nav.profondeurAffichee();
    // Un passage peut avoir sa propre vue — zoomer à son rythme, puis se
    // figer pendant que ses derniers étages se fondent sur place. Sinon, la
    // toile suit la caméra du site.
    const vue = passage.vue !== null ? passage.vue(d) : this.nav.cadreAffiche();
    return calquesDeDescente(d, vue, passage.etages);
  });

  /**
   * L'opacité de toute la toile, propre à chaque passage. Pour le « H » :
   * elle monte quand la pyramide prend le relais de la photo, et redescend
   * quand la salle 2 se révèle — sans quoi elle la masquerait, puisqu'elle
   * est posée par-dessus la scène. Pour la porte du temple, voir
   * `PASSAGE_HERMES`.
   */
  readonly opacite = computed(() => {
    const d = this.nav.profondeurAffichee();
    // Au téléphone, la toile prend TOUT l'écran dès que la caméra quitte le
    // seuil : elle part de la photo, qui est aussi celle de l'accueil — le
    // raccord est exact. Elle s'efface quand la salle 2 se révèle.
    if (this.plongeonEtroit()) return d > 0.0005 ? 1 - opaciteOuvertureInvisible(d, 1) : 0;
    return this.passage().opacite(d);
  });

  /**
   * LE PLONGEON AU TÉLÉPHONE (Paul, 28/09) : le « H » de THP en format étroit.
   * La porte du temple y a ses propres calques (`dessinerPassageEtroit`).
   */
  private readonly plongeonEtroit = computed(
    () => this.nav.format() === 'etroit' && this.passage() === PASSAGE_SEUIL,
  );

  /** Un passage qui a ses propres calques au téléphone : la porte du temple. */
  private readonly passageEtroit = computed(
    () => this.nav.format() === 'etroit' && this.passage().calquesEtroits !== undefined,
  );

  constructor() {
    // Redessiner à chaque changement de cadre. `calques()` dépend de la
    // profondeur affichée, donc cet effet suit la caméra image par image.
    effect(() => this.redessiner());
  }

  /** Dessiner ce que la toile doit montrer maintenant, selon le format. */
  private redessiner(): void {
    const d = this.nav.profondeurAffichee();
    if (this.plongeonEtroit()) this.dessinerEtroit(d);
    else if (this.passageEtroit()) this.dessinerPassageEtroit(d);
    else this.dessiner(this.calques());
  }

  ngOnInit(): void {
    if (typeof Image !== 'function') return; // rendu serveur : rien à précharger
    // Au téléphone, la photo est le premier étage du plongeon.
    if (this.plongeonEtroit()) this.charger(PHOTO_SEUIL.image, 'high');
    this.passage().etages.forEach((etage, rang) => {
      const im = new Image();
      // LES PREMIERS ÉTAGES D'ABORD. Mesuré le 08/09 sur réseau bridé : les
      // images partaient ensemble à priorité égale et finissaient
      // entre 1,5 s et 5,3 s, dans le désordre — l'étage 19 arrivait avant
      // qu'on ait besoin de l'étage 3. Or la descente les traverse DANS
      // L'ORDRE : les trois premiers doivent gagner la course à la bande
      // passante, le reste peut attendre son tour.
      im.fetchPriority = rang < 3 ? 'high' : 'low';
      im.src = etage.image;
      this.images.set(etage.image, im);
      // Redessiner dès qu'un étage est prêt. Sans cela, une page chargée
      // directement dans la salle Hermès (`#orchestrateur`) restait NOIRE :
      // la caméra ne bougeant pas, l'effet de dessin ne se relançait jamais,
      // et le premier dessin avait eu lieu avant l'arrivée des images
      // (mesuré le 23/09 : pixel central 0,0,0,0 après 8 s).
      void im
        .decode?.()
        .then(() => this.redessiner())
        .catch(() => {
          // Un étage qui ne se décode pas n'est pas une raison de tout arrêter :
          // il sera simplement sauté au dessin tant qu'il n'est pas prêt.
        });
    });
    if (typeof window !== 'undefined') {
      const redimensionner = () => this.ajusterToile();
      window.addEventListener('resize', redimensionner);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', redimensionner));
    }
  }

  /**
   * Ajuste la mémoire de la toile à la fenêtre.
   *
   * Elle est plafonnée à la largeur UTILE d'un étage, et c'était la largeur du
   * FICHIER jusqu'au 09/09. La différence n'est pas cosmétique : un fichier
   * couvre `MARGE_ETAGE` fois sa zone, et cette marge déborde de l'écran — elle
   * n'est jamais vue. Se plafonner dessus faisait donc remplir 41 % de pixels
   * de plus que ce que la source peut nourrir, deux `drawImage` par image,
   * pour un résultat à l'écran rigoureusement identique.
   *
   * Au-delà de ce plafond, dessiner plus finement que l'image source ne
   * montrerait pas un pixel de plus. Sur un écran à forte densité, c'est donc
   * lui qui décide, pas le rapport de pixels.
   */
  private ajusterToile(): boolean {
    const ref = this.toile();
    if (ref === undefined) return false;
    const toile = ref.nativeElement;
    const largeurCss = toile.clientWidth;
    const hauteurCss = toile.clientHeight;
    if (largeurCss === 0 || hauteurCss === 0) return false;
    const densite = Math.min(
      window.devicePixelRatio || 1,
      this.passage().largeurUtile / largeurCss,
      2,
    );
    const l = Math.round(largeurCss * densite);
    const h = Math.round(hauteurCss * densite);
    if (l !== this.largeur || h !== this.hauteur) {
      toile.width = this.largeur = l;
      toile.height = this.hauteur = h;
      this.ctx = toile.getContext('2d');
    }
    return this.ctx !== null;
  }

  /** Une image de plus à garder décodée (la photo du plongeon au téléphone). */
  private charger(chemin: string, priorite: 'high' | 'low'): void {
    if (this.images.has(chemin)) return;
    const im = new Image();
    im.fetchPriority = priorite;
    im.src = chemin;
    this.images.set(chemin, im);
    void im
      .decode?.()
      .then(() => this.redessiner())
      .catch(() => {});
  }

  /**
   * Le plongeon au téléphone (`coeur/descente-etroite.ts`) : chaque calque a
   * sa largeur ET sa hauteur, puisque la fenêtre n'a plus les proportions
   * des étages.
   */
  private dessinerEtroit(profondeur: number): void {
    if (typeof window === 'undefined') return;
    if (!this.ajusterToile() || this.ctx === null) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.largeur, this.hauteur);
    if (profondeur <= 0.0005) return;
    this.charger(PHOTO_SEUIL.image, 'high');
    this.peindreEtroits(calquesEtroits(profondeur, this.largeur / this.hauteur, this.passage().etages));
  }

  /**
   * La porte du temple au téléphone (Paul, 29/09) : ses images portrait, dans
   * sa propre fenêtre (`coeur/transition-hermes-etroite.ts`). Les étages sont
   * demandés au fil du passage — le passage peut changer en cours de route,
   * quand l'écran pivote, et ceux du départ ont été chargés pour l'autre.
   */
  private dessinerPassageEtroit(profondeur: number): void {
    if (typeof window === 'undefined') return;
    if (!this.ajusterToile() || this.ctx === null) return;
    this.ctx.clearRect(0, 0, this.largeur, this.hauteur);
    const calques = this.passage().calquesEtroits?.(profondeur, this.largeur / this.hauteur) ?? [];
    calques.forEach((c, rang) => this.charger(c.image, rang < 3 ? 'high' : 'low'));
    this.peindreEtroits(calques);
  }

  /** Des calques qui ont chacun leur largeur et leur hauteur. */
  private peindreEtroits(calques: readonly CalqueEtroit[]): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    for (const c of calques) {
      if (c.opacite <= 0) continue;
      const im = this.images.get(c.image);
      if (im === undefined || !im.complete || im.naturalWidth === 0) continue;
      ctx.globalAlpha = c.opacite;
      ctx.drawImage(
        im,
        (c.gauche / 100) * this.largeur,
        (c.haut / 100) * this.hauteur,
        (c.largeur / 100) * this.largeur,
        (c.hauteur / 100) * this.hauteur,
      );
    }
    ctx.globalAlpha = 1;
  }

  private dessiner(calques: readonly CalqueDescente[]): void {
    if (typeof window === 'undefined') return;
    if (!this.ajusterToile() || this.ctx === null) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.largeur, this.hauteur);
    for (const calque of calques) {
      if (calque.opacite <= 0) continue;
      const im = this.images.get(calque.etage.image);
      // Un étage pas encore décodé est sauté plutôt que dessiné à moitié :
      // celui du dessous couvre déjà tout l'écran, on ne voit donc rien
      // manquer — juste un détail qui arrive une image plus tard.
      if (im === undefined || !im.complete || im.naturalWidth === 0) continue;
      ctx.globalAlpha = calque.opacite;
      ctx.drawImage(
        im,
        (calque.gauche / 100) * this.largeur,
        (calque.haut / 100) * this.hauteur,
        (calque.taille / 100) * this.largeur,
        (calque.taille / 100) * this.hauteur,
      );
    }
    ctx.globalAlpha = 1;
  }
}
