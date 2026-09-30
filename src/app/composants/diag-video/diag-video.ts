// Le panneau de diagnostic des vidéos : visible seulement avec `?diag` dans
// l'adresse (`http://…/?diag#orchestrateur`).
//
// Paul voit des pannes que mon navigateur de test ne voit pas : sa machine,
// sa carte graphique, ses réglages. Et lire la console au bon moment n'est
// pas praticable. Ce panneau montre, en direct et à l'écran, ce que fait
// chaque lecteur — une capture d'écran suffit à me le transmettre.

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { lecteursActifs } from '../tapis-video/tapis-video';

@Component({
  selector: 'pz-diag-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="diag__titre">diagnostic vidéo · {{ navigateur }}</p>
    @for (l of lecteurs(); track l['nom']) {
      <section class="diag__lecteur">
        <p class="diag__nom">{{ l['nom'] }}</p>
        <dl>
          <dt>mode</dt><dd>{{ l['mode'] }}</dd>
          <dt>état</dt><dd>{{ l['lecture'] }}</dd>
          <dt>temps</dt><dd>{{ l['temps'] }}</dd>
          <dt>réserve</dt><dd>{{ l['reserve'] }}</dd>
          <dt>images</dt><dd>{{ l['images'] }}</dd>
        </dl>
        <pre class="diag__journal">{{ l['journal'] }}</pre>
      </section>
    } @empty {
      <p>aucun lecteur monté</p>
    }
  `,
  styleUrl: './diag-video.css',
})
export class DiagVideo {
  protected readonly lecteurs = signal<Record<string, string>[]>([]);
  protected readonly navigateur =
    typeof navigator !== 'undefined' ? navigator.userAgent.replace(/^Mozilla\/5\.0 /, '') : '';

  constructor() {
    const suivre = setInterval(() => this.lecteurs.set([...lecteursActifs].map((l) => l.etat())), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(suivre));
  }
}
