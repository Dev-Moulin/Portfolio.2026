// Pièce 2 — l'arrière-salle. Le projet qui ne figurait nulle part sur le
// profil public : des agents locaux construits pour les comprendre, et les
// chiffres mesurés qui disent si le système tient ses promesses.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PieceBase } from '../piece-base';
import { CarteTexte, PageCarte } from '../carte-texte/carte-texte';
import { ORCHESTRATEUR, ORCHESTRATEUR_EN } from '../../coeur/contenu';
import { LangueSite } from '../../langue';

@Component({
  selector: 'pz-orchestrateur',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarteTexte, PageCarte],
  host: {
    // La salle se pose sur le visage d'Hermès Agent, que la toile du passage
    // laisse en place derrière la scène : son propre fond doit donc
    // s'effacer. Au téléphone aussi depuis le 29/09 (ses images portrait).
    class: 'piece piece--orchestrateur piece--sur-decor',
    // La chorégraphie : la carte entre par la gauche (`orchestrateur.css`).
    '[class.choree--presente]': 'presente()',
  },
  templateUrl: './orchestrateur.html',
  styleUrl: './orchestrateur.css',
})
export class Orchestrateur extends PieceBase {
  override readonly id = 'orchestrateur';
  private readonly site = inject(LangueSite);
  /** La carte dans la langue du site (Paul, 29/09). */
  readonly donnees = computed(() => (this.site.langue() === 'en' ? ORCHESTRATEUR_EN : ORCHESTRATEUR));
  /** Ses intertitres. « MySkill.md » et « Harness is everything » ne se traduisent pas. */
  readonly mots = computed(() =>
    this.site.langue() === 'en'
      ? { depart: 'The starting point', part: 'My part', difficulte: 'The challenge', suite: "What's next" }
      : { depart: 'Le point de départ', part: 'Ma part', difficulte: 'La difficulté', suite: 'La suite' },
  );
}
