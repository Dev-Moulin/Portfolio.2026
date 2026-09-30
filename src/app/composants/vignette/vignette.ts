// L'aperçu d'un projet, tel qu'on le voit à travers son ouverture depuis la
// salle des projets. C'est du contenu réellement posé dans l'ouverture, pas
// une image : en s'approchant, il grossit comme une vraie pièce.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Projet } from '../../coeur/contenu';

@Component({
  selector: 'pz-vignette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'piece' },
  template: `
    <div class="vignette verre reflet">
      <p class="vignette__baseline">{{ projet().baseline }}</p>
      <h3 class="vignette__nom">{{ projet().nom }}</h3>
      <p class="vignette__accroche">{{ projet().accroche }}</p>
      <ul class="vignette__stack">
        @for (outil of projet().stack.slice(0, 4); track outil) {
          <li class="verre"><span class="vignette__outil">{{ outil }}</span></li>
        }
      </ul>
    </div>
  `,
  styleUrl: './vignette.css',
})
export class Vignette {
  readonly projet = input.required<Projet>();
}
