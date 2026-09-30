// LE BOUTON DE LANGUE (Paul, 29/09) : un globe, et le code de la langue qu'il
// propose. Au téléphone, il est posé dans la carte du profil ; sur grand
// écran, en haut à droite de l'écran, dans toutes les salles. Le même verre
// que les boutons de liens.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangueSite } from '../../langue';
import { autreLangue } from '../../coeur/langue';
import { Inclinaison } from '../vignette/inclinaison';

@Component({
  selector: 'pz-bouton-langue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Inclinaison],
  template: `
    <button
      type="button"
      class="langue verre reflet"
      pzInclinaison
      [attr.lang]="cible()"
      [attr.aria-label]="libelle()"
      [attr.title]="libelle()"
      (click)="site.basculer(); $event.stopPropagation()"
    >
      <svg class="langue__globe" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M4.6 7.5h14.8M4.6 16.5h14.8" />
      </svg>
      <span class="langue__code" aria-hidden="true">{{ cible() === 'en' ? 'EN' : 'FR' }}</span>
    </button>
  `,
  styleUrl: './bouton-langue.css',
})
export class BoutonLangue {
  protected readonly site = inject(LangueSite);
  /** La langue que le bouton propose : l'autre. */
  protected readonly cible = computed(() => autreLangue(this.site.langue()));
  protected readonly libelle = computed(() =>
    this.cible() === 'en' ? 'Switch to English' : 'Passer en français',
  );
}
