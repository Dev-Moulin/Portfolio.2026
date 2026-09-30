// Une ouverture DANS une salle : une vignette qui ouvre un projet, ou le
// hublot qui quitte le site. Positionnée aux coordonnées exactes du modèle —
// sa hauteur est sa largeur, donc son ratio est celui de l'écran.
//
// Jusqu'au 23/09, c'était aussi la boîte où la salle suivante était posée,
// et elle savait se rendre invisible (le « H », la porte du temple). Les
// salles étant désormais des calques à part (`PieceBase`), les passages de
// profondeur n'ont plus de boîte : les visibles sont dessinés par
// `pz-portes`, les invisibles n'existent plus que dans le graphe.

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Navigation } from '../../navigation';
import { LangueSite } from '../../langue';
import type { Ouverture as Modele } from '../../coeur/modele';

@Component({
  selector: 'pz-ouverture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ouverture',
    role: 'button',
    tabindex: '0',
    '[style.left.%]': 'ouverture().x * 100',
    '[style.top.%]': 'ouverture().y * 100',
    '[style.width.%]': 'ouverture().w * 100',
    '[style.height.%]': 'ouverture().w * 100',
    '[attr.aria-label]': 'libelle()',
    '(click)': 'activer($event)',
    '(keydown.enter)': 'activer($event)',
    '(keydown.space)': 'activer($event)',
  },
  template: `
    <ng-content />
    <span class="ouverture__cadre" aria-hidden="true"></span>
    <span class="ouverture__libelle" aria-hidden="true">{{ libelle() }}</span>
  `,
  styleUrl: './ouverture.css',
})
export class OuvertureComponent {
  private readonly nav = inject(Navigation);
  readonly ouverture = input.required<Modele>();
  private readonly site = inject(LangueSite);
  protected readonly libelle = computed(() =>
    this.site.libelle(this.ouverture().id, this.ouverture().libelle),
  );

  activer(evenement: Event): void {
    evenement.stopPropagation();
    evenement.preventDefault();

    const cible = this.ouverture().cible;
    switch (cible.genre) {
      case 'profondeur':
        this.nav.viserProfondeur(this.nav.chemin().indexOf(this.ouverture().id));
        break;
      case 'laterale':
        this.nav.ouvrirUnivers(cible.univers);
        break;
      case 'externe':
        window.open(cible.href, '_blank', 'noopener,noreferrer');
        break;
    }
  }
}
