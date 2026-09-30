// Les repères : l'unique élément d'interface qui ne fait pas partie de la
// scène. Il dit où l'on est dans la descente et permet de sauter d'une pièce
// à l'autre — au clavier comme à la souris.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { LangueSite } from '../../langue';
import { invite } from '../../coeur/presentation';
import { Inclinaison } from '../vignette/inclinaison';

/** Au bout de combien de temps sans rien la barre s'efface d'un quart. */
const REPOS = 5000;

@Component({
  selector: 'pz-reperes',
  imports: [Inclinaison],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.reperes--repos]': 'repos()',
    '(window:touchstart)': 'reveiller()',
    '(window:pointerdown)': 'reveiller()',
    '(window:wheel)': 'reveiller()',
    '(window:keydown)': 'reveiller()',
  },
  template: `
    <nav class="reperes" aria-label="Profondeur" [style.--pieces]="pieces().length">
      <ol class="reperes__liste">
        @for (piece of pieces(); track piece.id; let i = $index) {
          <li>
            <button
              type="button"
              class="repere"
              [class.repere--actif]="piece.actif"
              [attr.aria-current]="piece.actif ? 'true' : null"
              (click)="nav.viserProfondeur(i)"
            >
              <span class="repere__point" aria-hidden="true"></span>
              <!-- Le même reflet de vitre que les cartes et les boutons, sous la
                   souris (Paul, 29/09). -->
              <span class="repere__nom verre reflet" pzInclinaison>{{ piece.nom }}</span>
            </button>
          </li>
        }
      </ol>
      <p class="reperes__jauge" aria-hidden="true">
        <span class="reperes__curseur" [style]="curseur()"></span>
      </p>
      @if (invite(); as mot) {
        <p class="reperes__invite" aria-hidden="true" [style.opacity]="mot.opacite">
          {{ mot.texte }}
        </p>
      }
    </nav>
  `,
  styleUrl: './reperes.css',
})
export class Reperes {
  protected readonly nav = inject(Navigation);
  private readonly site = inject(LangueSite);

  /**
   * AU REPOS (Paul, 29/09) : 5 s sans geste ni mouvement de caméra, et la
   * barre s'efface d'un quart (`reperes.css`, téléphone). Elle revient au
   * premier toucher, ou dès que la caméra bouge.
   */
  protected readonly repos = signal(false);
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.nav.profondeurAffichee();
      untracked(() => this.reveiller());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.minuteur !== null) clearTimeout(this.minuteur);
    });
  }

  protected reveiller(): void {
    this.repos.set(false);
    if (this.minuteur !== null) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.repos.set(true), REPOS);
  }

  readonly pieces = computed(() => {
    const courante = Math.round(this.nav.profondeurAffichee());
    return this.nav.chemin().map((id, i) => ({
      id,
      nom: this.site.nom(id, this.nav.graphe()[id]?.nom ?? id),
      actif: i === courante,
    }));
  });

  private readonly avancement = computed(
    () => (this.nav.profondeurAffichee() / Math.max(this.nav.profondeurMax(), 1)) * 100,
  );

  /**
   * Le mot qui invite à continuer, quand la caméra bute contre le bord d'une
   * pièce. `null` quand il n'y a rien à dire. La règle vit dans
   * `coeur/presentation.ts` ; ici on ne fait qu'y accrocher les noms.
   */
  readonly invite = computed<{ readonly texte: string; readonly opacite: number } | null>(() => {
    const i = invite(
      this.nav.butee(),
      Math.round(this.nav.profondeurAffichee()),
      this.nav.chemin().length,
    );
    if (i === null) return null;
    const id = this.nav.chemin()[i.vers]!;
    return {
      texte: `${i.fleche} ${this.site.nom(id, this.nav.graphe()[id]?.nom ?? id)}`,
      opacite: i.opacite,
    };
  });

  /** La jauge est verticale sur grand écran, horizontale sur téléphone. */
  readonly curseur = computed(() => `top:${this.avancement()}%;left:${this.avancement()}%`);
}
