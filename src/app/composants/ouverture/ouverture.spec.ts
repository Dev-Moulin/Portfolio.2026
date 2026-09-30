// Une ouverture DANS une salle : une vignette qui ouvre un projet. Depuis le
// 23/09, les passages de profondeur ne sont plus des `pz-ouverture` (voir
// `pz-portes` et `PieceBase`) : ce qui reste ici, c'est un bouton.

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OuvertureComponent } from './ouverture';
import { Navigation } from '../../navigation';
import { LangueSite } from '../../langue';
import { GRAPHE } from '../../coeur/contenu';

// La vraie vignette « intuition » du graphe réel — pas un modèle inventé :
// le clic doit se comporter exactement comme en production.
const VIGNETTE = GRAPHE['projets']!.ouvertures.find((o) => o.id === 'intuition')!;

/** Le glissement de caméra est coupé : les tests observent l'état, pas l'animation. */
function sansGlissement() {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion'),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

@Component({
  selector: 'pz-hote',
  imports: [OuvertureComponent],
  template: `<pz-ouverture [ouverture]="ouverture" />`,
})
class Hote {
  ouverture = VIGNETTE;
}

describe('pz-ouverture — une vignette', () => {
  let fixture: ComponentFixture<Hote>;
  let nav: Navigation;

  beforeEach(async () => {
    sansGlissement();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [Hote] }).compileComponents();
    // Le libellé testé est le français ; le navigateur de test est anglais.
    TestBed.inject(LangueSite).langue.set('fr');
    fixture = TestBed.createComponent(Hote);
    nav = TestBed.inject(Navigation);
    fixture.detectChanges();
  });

  it('en anglais, annonce son libellé anglais', () => {
    TestBed.inject(LangueSite).langue.set('en');
    fixture.detectChanges();
    const host = (fixture.nativeElement as HTMLElement).querySelector('pz-ouverture')!;
    expect(host.getAttribute('aria-label')).toBe('Open: Intuition, Chrome extension');
  });

  it('est un bouton nommé, atteignable au clavier', () => {
    const host = (fixture.nativeElement as HTMLElement).querySelector('pz-ouverture')!;
    expect(host.getAttribute('role')).toBe('button');
    expect(host.getAttribute('tabindex')).toBe('0');
    expect(host.getAttribute('aria-label')).toBe(VIGNETTE.libelle);
  });

  it('se pose aux coordonnées exactes du modèle, au ratio de l’écran', () => {
    const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('pz-ouverture')!;
    expect(parseFloat(host.style.left)).toBeCloseTo(VIGNETTE.x * 100, 6);
    expect(parseFloat(host.style.top)).toBeCloseTo(VIGNETTE.y * 100, 6);
    expect(host.style.width).toBe(host.style.height);
  });

  it('ouvre son projet au clic, sans changer de profondeur', () => {
    nav.viserProfondeur(1);
    const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('pz-ouverture')!;
    host.click();
    expect(nav.universOuvert()).toBe('intuition');
    expect(nav.etat().profondeur).toBe(1);
  });
});
