// Pièce 3 — le fond. La mise en abyme cesse d'être une métaphore : la
// dernière ouverture donne sur le portfolio précédent.

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PieceBase } from '../piece-base';
import { OuvertureComponent } from '../ouverture/ouverture';
import { PORTFOLIO_3D } from '../../coeur/contenu';

@Component({
  selector: 'pz-portfolio3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OuvertureComponent],
  host: { class: 'piece piece--portfolio3d' },
  templateUrl: './portfolio3d.html',
  styleUrl: './portfolio3d.css',
})
export class Portfolio3d extends PieceBase {
  override readonly id = 'portfolio3d';
  readonly donnees = PORTFOLIO_3D;
}
