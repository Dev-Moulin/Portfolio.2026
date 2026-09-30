// Ce que toutes les pièces partagent : leur profondeur, l'opacité de leur
// contenu qui en découle, et — depuis le 23/09 — leur place de CALQUE. Une
// classe de base plutôt qu'un composant, parce que chaque pièce a une mise en
// page qui lui est propre.
//
// UNE SALLE N'EST PLUS DANS UNE AUTRE. Chaque salle est un calque de la taille
// de l'écran, frère des autres dans `.vue`, avec sa propre transformation
// (`transformationSalle`). Celle où l'on est n'en a AUCUNE : grossissement 1,
// donc rien que le navigateur puisse arrondir de travers — c'est ce qui la
// décalait de 150 à 200 px sur les écrans de Paul. Ce sont les liaisons
// d'hôte ci-dessous qui posent le calque ; elles valent pour les quatre salles.

import { computed, Directive, inject } from '@angular/core';
import { Navigation } from '../navigation';
import { opaciteContenu, opaciteSalle } from '../coeur/presentation';
import { transformationSalle } from '../coeur/geometrie';
import type { Ouverture, Piece } from '../coeur/modele';

@Directive({
  host: {
    '[style.transform]': 'transformCalque()',
    '[style.opacity]': 'opaciteCalque()',
    // L'ordre d'empilement suit la profondeur : une salle plus profonde se
    // peint par-dessus celle qui la montre en aperçu.
    '[style.z-index]': 'profondeur()',
    '[class.piece--apercu]': '!courante()',
  },
})
export abstract class PieceBase {
  protected readonly nav = inject(Navigation);
  abstract readonly id: string;

  readonly piece = computed<Piece>(() => this.nav.graphe()[this.id]!);
  readonly profondeur = computed(() => Math.max(this.nav.chemin().indexOf(this.id), 0));
  readonly opacite = computed(() =>
    opaciteContenu(this.nav.profondeurAffichee(), this.profondeur()),
  );

  /** Où la caméra voit ce calque. `none` quand on est dedans, posé. */
  readonly transformCalque = computed(() =>
    transformationSalle(this.nav.cadresSalles()[this.profondeur()]!, this.nav.cadreAffiche()),
  );

  /**
   * L'opacité des passages invisibles franchis pour arriver ici — portée
   * jusqu'au 23/09 par l'ouverture qui contenait la salle. `null` quand elle
   * est pleine : on ne pose rien, et le verre des cartes garde son flou (une
   * opacité inférieure à 1 sur un ancêtre le couperait).
   */
  readonly opaciteCalque = computed(() => {
    const o = opaciteSalle(
      this.nav.profondeurAffichee(),
      this.nav.chemin(),
      this.nav.graphe(),
      this.profondeur(),
    );
    return o >= 1 ? null : o;
  });

  /**
   * Vrai dans la salle où l'on est. Les autres ne sont que des aperçus : elles
   * laissent passer le pointeur, pour que le clic atteigne le cadre posé
   * par-dessus (`pz-portes`) ou la salle en dessous.
   */
  readonly courante = computed(() => this.nav.pieceCourante() === this.id);

  /**
   * Vrai quand la caméra est posée dans cette salle : c'est le moment où sa
   * chorégraphie d'entrée se joue (voir `coeur/choregraphie.ts`).
   */
  readonly presente = computed(() => this.nav.sallePresente() === this.id);

  ouverture(id: string): Ouverture {
    const trouvee = this.piece().ouvertures.find((o) => o.id === id);
    if (trouvee === undefined) {
      throw new Error(`la pièce « ${this.id} » n'a pas d'ouverture « ${id} »`);
    }
    return trouvee;
  }
}
