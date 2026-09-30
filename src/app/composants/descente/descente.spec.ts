// Ce que jsdom NE PEUT PAS vérifier : le dessin lui-même. Il n'y a pas de
// contexte 2D ici, donc rien à mesurer sur la toile — le rendu se vérifie
// ailleurs, hors navigateur (`python3 scripts/apercu-descente.py`). Restent
// les décisions, qui sont du calcul pur : quels calques, à quelle opacité, et
// dans quel format d'écran.

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Descente } from './descente';
import { Navigation } from '../../navigation';

function ecran(etroit: boolean) {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion') || (etroit && requete.includes('portrait')),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('pz-descente', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('pose des calques en grand écran, et s’efface entièrement une fois arrivé', async () => {
    ecran(false);
    await TestBed.configureTestingModule({ imports: [Descente] }).compileComponents();
    const fixture = TestBed.createComponent(Descente);
    const nav = TestBed.inject(Navigation);
    fixture.detectChanges();

    nav.viserProfondeur(1);
    fixture.detectChanges();
    const visibles = fixture.componentInstance.calques().filter((c) => c.opacite > 0);
    expect(visibles.length).toBeGreaterThan(0);
    // Arrivé dans la salle 2, la toile doit être TOTALEMENT transparente : elle
    // est posée par-dessus la scène, donc la moindre opacité résiduelle
    // voilerait la salle en permanence.
    expect(fixture.componentInstance.opacite()).toBe(0);
  });

  it('ne peint RIEN en format étroit', async () => {
    // Ses images sont celles de la photo du seuil, et la photo n'est pas
    // affichée sur téléphone : les peindre là poserait un tee-shirt sur une
    // mise en page qui ne le contient pas. Le téléphone attend son propre
    // chantier — l'axe horizontal —, pas les images du grand écran.
    ecran(true);
    await TestBed.configureTestingModule({ imports: [Descente] }).compileComponents();
    const fixture = TestBed.createComponent(Descente);
    const nav = TestBed.inject(Navigation);
    fixture.detectChanges();

    expect(nav.format()).toBe('etroit');
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.calques()).toEqual([]);
  });
});
