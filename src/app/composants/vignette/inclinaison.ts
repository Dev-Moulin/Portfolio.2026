// La carte qu'on presse du doigt (Paul, 27/09) : là où est la souris, la
// vignette s'enfonce légèrement, et en s'inclinant son verre attrape la
// lumière. Le reflet est celui d'une vraie vitre : une diagonale nette,
// quelques traînées, des éclats sur l'arête du côté qui se soulève.
//
// Ici, seulement la lecture de la souris : elle est confiée au CSS en
// variables (`vignette.css` fait l'inclinaison et le reflet). Les écouteurs
// sont posés à la main et pas par `@HostListener` : un mouvement de souris ne
// change rien au gabarit, il n'y a pas à relancer la détection de
// changement soixante fois par seconde.
//
// La souris seulement : au doigt, au clavier et en mouvement réduit, la carte
// reste à plat.

import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** L'inclinaison la plus forte, en degrés : une pression, pas une bascule. */
const INCLINAISON_MAX = 4;

@Directive({ selector: '[pzInclinaison]' })
export class Inclinaison {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const incliner = (inclX: number, inclY: number, appui: number) => {
      el.style.setProperty('--incl-x', inclX.toFixed(2));
      el.style.setProperty('--incl-y', inclY.toFixed(2));
      el.style.setProperty('--appui', String(appui));
    };
    // À plat, reflet éteint — en douceur, la transition est dans le CSS. Au
    // clic aussi : la carte ouverte part d'une vignette à plat. Le reflet
    // reste où il était pendant qu'il s'éteint : ramené au centre, il y
    // sauterait.
    const relacher = () => incliner(0, 0, 0);

    const bouger = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || mouvementReduit()) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // De -0,5 à 0,5 depuis le centre de la carte.
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      // Le côté sous la souris recule : à droite, `rotateY` positif ; en haut
      // (dy négatif), `rotateX` positif.
      // La place de la souris, pour le reflet (`vignette.css`).
      el.style.setProperty('--px', dx.toFixed(3));
      el.style.setProperty('--py', dy.toFixed(3));
      incliner(-dy * 2 * INCLINAISON_MAX, dx * 2 * INCLINAISON_MAX, 1);
    };

    el.addEventListener('pointermove', bouger);
    el.addEventListener('pointerleave', relacher);
    el.addEventListener('pointerdown', relacher);
    inject(DestroyRef).onDestroy(() => {
      el.removeEventListener('pointermove', bouger);
      el.removeEventListener('pointerleave', relacher);
      el.removeEventListener('pointerdown', relacher);
    });
  }
}

function mouvementReduit(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
