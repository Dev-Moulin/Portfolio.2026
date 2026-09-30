// La carte de texte au GABARIT UNIQUE (Paul, 23/09) : la taille de la carte
// de Paul Moulin, dans toutes les salles. Un texte plus long ne la fait pas
// grandir : il passe en pages, et la molette les feuillette avant de changer
// de salle (voir `coeur/pages.ts` et `Navigation.pieceSuivante`).
//
// Les pages sont ÉCRITES, pas calculées : chaque salle les déclare dans son
// gabarit, une `<ng-template pzPage>` par page. Un découpage automatique à la
// mesure dépendrait de la police et de l'écran ; et c'est Paul qui écrira les
// histoires, page par page.
//
// Chaque page est sa propre carte de verre, empilée au même endroit : celle
// qu'on lit est en place, celles déjà lues attendent au-dessus de l'écran,
// les suivantes en dessous. Tourner la page, c'est la faire partir vers le
// haut pendant que la suivante monte du bas.

import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Navigation } from '../../navigation';

/** Une page de la carte : `<ng-template pzPage>…</ng-template>`. */
@Directive({ selector: 'ng-template[pzPage]' })
export class PageCarte {
  readonly modele = inject(TemplateRef);
}

@Component({
  selector: 'pz-carte-texte',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { class: 'carte-texte' },
  template: `
    @for (p of modeles(); track p; let i = $index) {
      <section
        class="carte-texte__page verre"
        [class.carte-texte__page--lue]="i < page()"
        [class.carte-texte__page--suivante]="i > page()"
        [attr.inert]="i === page() ? null : ''"
        [attr.aria-hidden]="i === page() ? null : 'true'"
      >
        <ng-container [ngTemplateOutlet]="p.modele" />
      </section>
    }
    @if (modeles().length > 1) {
      <ol class="carte-texte__points" aria-label="Pages">
        @for (p of modeles(); track p; let i = $index) {
          <li>
            <button
              type="button"
              class="carte-texte__point"
              [class.carte-texte__point--actif]="i === page()"
              [attr.aria-current]="i === page() ? 'page' : null"
              [attr.aria-label]="'Page ' + (i + 1) + ' sur ' + modeles().length"
              (click)="nav.allerPage(salle(), i + pagesAvant())"
            ></button>
          </li>
        }
      </ol>
    }
  `,
  styleUrl: './carte-texte.css',
})
export class CarteTexte {
  protected readonly nav = inject(Navigation);

  /** La salle qui porte la carte : c'est sous son nom que la page est tenue. */
  readonly salle = input.required<string>();

  /**
   * Les pages de la SALLE qui passent avant celles de la carte : au téléphone,
   * l'accueil du seuil (sa photo) est la page 0, et la carte commence à la
   * page 1 (Paul, 28/09). La salle tient donc une page de plus que la carte.
   */
  readonly pagesAvant = input(0);

  protected readonly modeles = contentChildren(PageCarte);
  protected readonly page = computed(() =>
    Math.max(0, (this.nav.pages().get(this.salle())?.page ?? 0) - this.pagesAvant()),
  );

  constructor() {
    effect(() => {
      const salle = this.salle();
      const total = this.modeles().length + this.pagesAvant();
      untracked(() => this.nav.declarerPages(salle, total));
    });
  }
}
