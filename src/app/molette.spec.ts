// PH-3 lot 1 : un geste de molette = une pièce.
//
// Avant, la molette poussait la profondeur au prorata des pixels : il
// fallait deux ou trois crans pour changer de pièce, ce qui n'est pas ce
// qu'on veut d'un site qui se parcourt pièce par pièce. Maintenant, c'est
// la RAFALE qui compte : le premier événement décide, les suivants sont
// avalés jusqu'au silence. Une roue crantée envoie un événement, un pavé
// tactile en envoie trente pour le même coup de doigt — les deux font une
// pièce et une seule.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { Navigation } from './navigation';

function sansGlissement() {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion'),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('la molette', () => {
  let fixture: ComponentFixture<App>;
  let nav: Navigation;

  function crans(nombre: number, deltaY: number): void {
    const hote = fixture.nativeElement as HTMLElement;
    for (let i = 0; i < nombre; i++) {
      hote.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
    }
  }

  /** Le temps passe assez pour que la rafale se referme. */
  function silence(): void {
    vi.advanceTimersByTime(400);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    sansGlissement();
    location.hash = '';
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    fixture = TestBed.createComponent(App);
    nav = TestBed.inject(Navigation);
    fixture.detectChanges();
    // La carte du seuil a deux pages : on part de la dernière, pour que le
    // premier cran change de pièce (le feuilletage a ses tests à lui).
    nav.allerPage('seuil', 1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('un seul cran descend d’exactement une pièce', () => {
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(1);
  });

  it('une rafale de pavé tactile ne descend que d’une pièce', () => {
    crans(30, 14);
    expect(nav.etat().profondeur).toBe(1);
  });

  it('trois gestes séparés par un silence font trois pas : la salle 2 en compte deux', () => {
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(1);
    silence();
    // Le second temps de la salle 2 : les cartes, sans changer de salle.
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(1);
    expect(nav.pages().get('projets')?.page).toBe(1);
    silence();
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(2);
  });

  it('vers le haut, ça remonte d’une pièce', () => {
    nav.viserProfondeur(2);
    crans(1, -120);
    expect(nav.etat().profondeur).toBe(1);
  });

  it('au fond, un cran de plus ne fait rien', () => {
    nav.viserProfondeur(nav.profondeurMax());
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(nav.profondeurMax());
  });

  it('un projet ouvert garde la molette pour lui', () => {
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('intuition');
    crans(1, 120);
    expect(nav.etat().profondeur).toBe(1);
  });
});
