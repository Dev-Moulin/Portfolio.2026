// Les portes VISIBLES entre deux salles : le liseré, le libellé au survol, et
// le bouton qui fait descendre. La carte « Le portfolio 3D » dans la salle
// Hermès, et sur téléphone la carte vers Hermès.
//
// POURQUOI UN CALQUE À PART, PAR-DESSUS LES SALLES (23/09). Avant, une porte
// était une boîte de la salle qui la contenait, et la salle suivante vivait
// DEDANS : le liseré se peignait par-dessus. Les salles étant désormais des
// calques frères (voir `PieceBase`), l'aperçu de la salle suivante se peint
// au-dessus de la salle qui porte la porte — un liseré laissé là serait
// caché. Il se pose donc ici, au-dessus de tout, à un rectangle calculé
// (`zoneEcran`, comme l'emblème en particules) : exact à l'écran, sans aucun
// grossissement.
//
// Les passages INVISIBLES (le « H », la porte du temple) n'ont rien ici : ni
// liseré, ni bouton. On ne les franchit qu'au défilement.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Navigation } from '../../navigation';
import { RACINE } from '../../coeur/contenu';
import { ouvertureProfondeur, zoneEcran } from '../../coeur/geometrie';

interface Porte {
  readonly id: string;
  readonly libelle: string;
  /** La profondeur de la salle où elle mène. */
  readonly vers: number;
  /** Son rectangle, en pourcentage de l'écran. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Le grossissement de la salle qui la porte : le liseré s'épaissit avec elle. */
  readonly echelle: number;
  readonly visee: boolean;
  readonly atteignable: boolean;
}

@Component({
  selector: 'pz-portes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (porte of portes(); track porte.id) {
      <button
        type="button"
        class="porte"
        [class.porte--visee]="porte.visee"
        [style.left.%]="porte.x"
        [style.top.%]="porte.y"
        [style.width.%]="porte.w"
        [style.height.%]="porte.w"
        [style.--echelle]="porte.echelle"
        [attr.aria-label]="porte.libelle"
        [attr.tabindex]="porte.atteignable ? 0 : -1"
        (click)="nav.viserProfondeur(porte.vers)"
      >
        <span class="porte__libelle" aria-hidden="true">{{ porte.libelle }}</span>
      </button>
    }
  `,
  styleUrl: './portes.css',
})
export class Portes {
  protected readonly nav = inject(Navigation);

  readonly portes = computed<readonly Porte[]>(() => {
    const graphe = this.nav.graphe();
    const chemin = this.nav.chemin();
    const montees = this.nav.sallesMontees();
    const camera = this.nav.cadreAffiche();
    const salles = this.nav.cadresSalles();
    const d = this.nav.profondeurAffichee();
    const portes: Porte[] = [];
    chemin.forEach((id, k) => {
      const o = ouvertureProfondeur(graphe[id]!);
      // Une porte n'existe qu'avec la salle qui la porte.
      if (o === undefined || o.invisible === true || !montees.has(id)) return;
      const zone = zoneEcran(graphe, RACINE, id, camera, o);
      portes.push({
        id: o.id,
        libelle: o.libelle,
        vers: k + 1,
        x: zone.x * 100,
        y: zone.y * 100,
        w: zone.w * 100,
        echelle: salles[k]!.w / camera.w,
        visee: d > k && d < k + 1,
        atteignable: this.nav.pieceCourante() === id,
      });
    });
    return portes;
  });
}
