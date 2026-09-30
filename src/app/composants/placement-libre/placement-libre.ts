// Le placement libre : attraper à la souris les trois textes de la salle 2
// (THP, INTUITION, l'intro) et le logo, et les poser où l'on veut. Les flux de
// particules suivent tout seuls : ils relisent la place des mots et partent
// du logo où qu'il soit (`particules-logo.ts`).
//
// COMME LA RÈGLE DES EMBLÈMES, CE N'EST PAS UN RÉGLAGE DU SITE. L'outil
// n'existe qu'en développement, et seulement avec « ?reglages » dans l'adresse
// (`@defer (when reglages)` dans `app.html`) ; rien ne doit l'importer, sans
// quoi il repartirait dans le paquet principal. Les places trouvées sont lues
// dans son panneau et recopiées dans le code.
//
// POURQUOI TOUT S'ATTRAPE PAR SA PLACE, ET PAS PAR LE CLIC. Rien de ce qu'on
// déplace ne reçoit la souris : le contenu des salles est en
// `pointer-events: none` (les vignettes seules le rétablissent), et la toile
// du logo aussi, sinon la répulsion des particules cesserait de marcher.
// L'outil teste donc lui-même si le clic tombe sur un texte ou dans le dessin
// du logo — pour ce dernier en refaisant le calcul de la toile (`zoneEcran`).

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { zoneEcran } from '../../coeur/geometrie';
import type { Cadre } from '../../coeur/modele';
import { FLUX_VOISINS_MAX, Placement, type Deplacable } from '../../placement';

/** La part centrale du carré du logo où son dessin se trouve. */
const DESSIN = 0.6;

interface Prise {
  readonly qui: Deplacable | 'logo';
  x: number;
  y: number;
}

@Component({
  selector: 'pz-placement-libre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'placement-libre' },
  template: `
    <p class="placement-libre__titre">Placement · glisser à la souris</p>
    <p class="placement-libre__moments">
      <button type="button" [class.actif]="placement.moment() === 'repos'" (click)="placement.montrer('repos')">
        Repos
      </button>
      <button type="button" [class.actif]="placement.moment() === 'cartes'" (click)="placement.montrer('cartes')">
        Cartes
      </button>
    </p>
    <dl class="placement-libre__valeurs">
      @for (ligne of lignes(); track ligne.nom) {
        <div>
          <dt>{{ ligne.nom }}</dt>
          <dd>{{ ligne.valeur }}</dd>
        </div>
      }
    </dl>
    <p class="placement-libre__titre placement-libre__filaments">Filaments des flux</p>
    <label class="placement-libre__curseur placement-libre__filaments">
      <span>Par particule</span>
      <input
        type="range"
        min="0"
        [max]="voisinsMax"
        step="1"
        [value]="placement.fluxVoisins()"
        (input)="placement.fluxVoisins.set(nombre($event))"
      />
      <output>{{ placement.fluxVoisins() }}</output>
    </label>
    <label class="placement-libre__curseur placement-libre__filaments">
      <span>Portée min</span>
      <input
        type="range"
        min="10"
        max="90"
        step="1"
        [value]="placement.fluxPorteeMin()"
        (input)="placement.fluxPorteeMin.set(nombre($event))"
      />
      <output>{{ placement.fluxPorteeMin() }} px</output>
    </label>
    <label class="placement-libre__curseur placement-libre__filaments">
      <span>Portée max</span>
      <input
        type="range"
        min="10"
        max="90"
        step="1"
        [value]="placement.fluxPorteeMax()"
        (input)="placement.fluxPorteeMax.set(nombre($event))"
      />
      <output>{{ placement.fluxPorteeMax() }} px</output>
    </label>
    <p class="placement-libre__actions">
      <button type="button" (click)="placement.revenir()">Revenir</button>
      <button type="button" class="placement-libre__copier" (click)="copier()">{{ copie() ? 'Copié' : 'Copier' }}</button>
    </p>
  `,
  styleUrl: './placement-libre.css',
})
export class PlacementLibre {
  protected readonly placement = inject(Placement);
  private readonly nav = inject(Navigation);

  /** La zone du logo dans la salle, comme la reçoit `pz-particules-logo`. */
  readonly zone = input.required<Cadre>();

  protected readonly copie = signal(false);
  protected readonly voisinsMax = FLUX_VOISINS_MAX;

  protected nombre(e: Event): number {
    return Number((e.target as HTMLInputElement).value);
  }
  private prise: Prise | null = null;
  /**
   * AU DOIGT (Paul, 29/09 : régler le téléphone sur le téléphone). Le doigt
   * qui a attrapé un texte ou le logo ne doit rien faire d'autre : sans ça, le
   * même glissement changeait aussi de salle (`app.ts` écoute le doigt).
   * `pointerdown` arrive AVANT `touchstart` : on sait donc déjà, au premier
   * événement tactile, s'il faut le garder. Vrai jusqu'à ce que le doigt se
   * lève — `pointerup` passe, lui, avant `touchend`.
   */
  private doigtPris = false;

  constructor() {
    const racine = document.documentElement;
    racine.classList.add('placement-libre-actif');
    const garderDoigt = (e: TouchEvent) => {
      if (!this.doigtPris) return;
      e.stopPropagation();
      if (e.type === 'touchend' || e.type === 'touchcancel') this.doigtPris = false;
    };
    const types = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;
    // À la capture, sur le document : avant que l'application ne l'entende.
    for (const t of types) document.addEventListener(t, garderDoigt, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      for (const t of types) document.removeEventListener(t, garderDoigt, { capture: true });
      racine.classList.remove('placement-libre-actif', 'placement-libre-tire', 'placement-libre-main');
    });
  }

  protected readonly lignes = computed(() => {
    const place = this.placement.courante();
    const t = place.textes;
    const f = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2);
    const px = (n: number) => String(Math.round(n));
    return [
      { nom: 'THP', valeur: `x ${f(t.thp.x)}  y ${f(t.thp.y)}` },
      { nom: 'INTUITION', valeur: `x ${f(t.intuition.x)}  y ${f(t.intuition.y)}` },
      { nom: 'Intro', valeur: `x ${f(t.intro.x)}  y ${f(t.intro.y)}` },
      {
        nom: 'Logo',
        valeur: `x ${px(place.logoX * innerWidth)} px  y ${px(place.logoY * innerHeight)} px`,
      },
    ];
  });

  /** Le dessin du logo à l'écran, en pixels, ou `null` hors de la salle 2. */
  private dessinLogo(): { x0: number; y0: number; x1: number; y1: number } | null {
    if (this.nav.pieceCourante() !== 'projets') return null;
    const z = zoneEcran(
      this.nav.graphe(),
      this.nav.chemin()[0] ?? '',
      'projets',
      this.nav.cadreAffiche(),
      this.zone(),
    );
    const cote = z.w * innerWidth;
    const cx = z.x * innerWidth + cote / 2;
    const cy = z.y * innerHeight + cote / 2;
    const demi = (cote * DESSIN) / 2;
    return { x0: cx - demi, y0: cy - demi, x1: cx + demi, y1: cy + demi };
  }

  /** Ce qui est sous la souris : un texte, le logo, ou rien. */
  private sous(e: PointerEvent): { qui: Prise['qui']; texte: HTMLElement | null } | null {
    if (this.nav.pieceCourante() !== 'projets') return null;
    for (const el of document.querySelectorAll<HTMLElement>('[data-placement]')) {
      const b = el.getBoundingClientRect();
      if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) {
        return { qui: el.dataset['placement'] as Deplacable, texte: el };
      }
    }
    const d = this.dessinLogo();
    const dedans =
      d !== null && e.clientX >= d.x0 && e.clientX <= d.x1 && e.clientY >= d.y0 && e.clientY <= d.y1;
    return dedans ? { qui: 'logo', texte: null } : null;
  }

  @HostListener('document:pointerdown', ['$event'])
  protected attraper(e: PointerEvent): void {
    if (e.button !== 0) return;
    // Un clic dans le panneau (un curseur) n'attrape rien derrière lui.
    if ((e.target as Element | null)?.closest('pz-placement-libre')) return;
    const qui = this.sous(e)?.qui ?? null;
    if (qui === null) return;
    e.preventDefault(); // pas de sélection de texte pendant qu'on tire
    this.prise = { qui, x: e.clientX, y: e.clientY };
    this.doigtPris = e.pointerType === 'touch';
    document.documentElement.classList.add('placement-libre-tire');
  }

  @HostListener('document:pointermove', ['$event'])
  protected tirer(e: PointerEvent): void {
    const p = this.prise;
    if (p === null) {
      // Au survol, la main s'ouvre et le texte visé se cerne.
      const s = this.sous(e);
      document.documentElement.classList.toggle('placement-libre-main', s !== null);
      for (const el of document.querySelectorAll<HTMLElement>('[data-placement]')) {
        el.toggleAttribute('data-survole', el === s?.texte);
      }
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.qui === 'logo') {
      this.placement.deplacerLogo(dx / innerWidth, dy / innerHeight);
    } else {
      // La salle posée remplit la fenêtre : un centième de salle = 1 % d'écran.
      this.placement.deplacer(p.qui, (dx / innerWidth) * 100, (dy / innerHeight) * 100);
    }
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  protected lacher(): void {
    this.prise = null;
    document.documentElement.classList.remove('placement-libre-tire');
  }

  // Le panneau garde la molette et le doigt pour lui : sans ça, les faire
  // passer dessus changerait de salle.
  @HostListener('wheel', ['$event'])
  @HostListener('touchstart', ['$event'])
  @HostListener('touchmove', ['$event'])
  protected garder(e: Event): void {
    e.stopPropagation();
  }

  protected copier(): void {
    const texte = JSON.stringify(
      {
        ...this.placement.toutes(),
        flux: {
          voisins: this.placement.fluxVoisins(),
          porteeMin: this.placement.fluxPorteeMin(),
          porteeMax: this.placement.fluxPorteeMax(),
        },
      },
      null,
      2,
    );
    void navigator.clipboard?.writeText(texte).then(() => {
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 1500);
    });
  }
}
