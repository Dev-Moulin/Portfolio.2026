// Tests d'acceptation du lot PH-2, côté câblage : ce que le service de
// navigation fait des gestes, et ce que les repères en affichent.
//
// Le moteur lui-même est éprouvé dans `coeur/gestes.spec.ts`, sans DOM. Ici
// on vérifie la couture — que les bonnes valeurs arrivent aux bons endroits —
// en pilotant le vrai service. Les gestes entrent par l'API du service, en
// hauteurs de vue : aucun `TouchEvent` n'est fabriqué, jsdom n'en rend pas
// une image fidèle et ce n'est pas là qu'est le risque.

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigation } from './navigation';
import { Reperes } from './composants/reperes/reperes';
import { RACINE, grapheDe } from './coeur/contenu';
import { cadre } from './coeur/geometrie';
import { SEUIL_FRANCHISSEMENT } from './coeur/gestes';

/** Caméra posée sans glissement : les tests observent l'état, pas l'animation. */
function sansGlissement() {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion'),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function service(): Navigation {
  TestBed.resetTestingModule();
  const nav = TestBed.inject(Navigation);
  nav.demarrer();
  return nav;
}

/** Une poussée franche, au-delà du seuil de franchissement. */
const POUSSEE = SEUIL_FRANCHISSEMENT * 1.5;
/** Une poussée qui bute sans franchir. */
const APPUI = SEUIL_FRANCHISSEMENT * 0.4;

describe('le doigt, branché sur la navigation', () => {
  beforeEach(() => {
    sansGlissement();
    location.hash = '';
  });

  it('appuyer sans pousser fait buter la caméra, sans changer de pièce', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    expect(nav.etat().profondeur).toBe(0);
    expect(nav.butee()).toBeGreaterThan(0);
  });

  it('un geste qui tourne une page ne fait rien suivre au doigt (Paul, 29/09)', () => {
    const nav = service();
    nav.viserProfondeur(1);
    nav.declarerPages('projets', 2);
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    // Une page à tourner vers le bas : pas de butée, la salle ne bouge pas.
    expect(nav.butee()).toBe(0);
    nav.glisserDoigt(POUSSEE);
    expect(nav.pages().get('projets')?.page).toBe(1);
    expect(nav.etat().profondeur).toBe(1);
    // À la dernière page, le geste annonce de nouveau le départ.
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    expect(nav.butee()).toBeGreaterThan(0);
  });

  it('la butée déplace réellement le cadre affiché', () => {
    // La couture : une butée qui ne se voit pas dans le cadre ne sert à rien.
    const nav = service();
    const avant = nav.cadreAffiche();
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    expect(nav.cadreAffiche().y).toBeGreaterThan(avant.y);
    expect(nav.cadreAffiche().w).toBe(avant.w);
  });

  it('un balayage franc descend d’une pièce', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(POUSSEE);
    expect(nav.etat().profondeur).toBe(1);
  });

  it('et pose la caméra en HAUT de la pièce où l’on entre', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(POUSSEE);
    expect(nav.etat().defilement).toBe(0);
  });

  it('en remontant, on arrive en BAS de la pièce', () => {
    // Sinon le retour ferait sauter tout ce qu'on vient de parcourir.
    const nav = service();
    nav.viserProfondeur(2);
    expect(nav.etat().defilement).toBe(0);
    nav.viserProfondeur(1);
    expect(nav.etat().defilement).toBe(1);
  });

  it('le franchissement consomme le geste : un balayage, une pièce', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(POUSSEE);
    nav.glisserDoigt(POUSSEE); // même geste, doigt jamais levé
    nav.glisserDoigt(POUSSEE);
    expect(nav.etat().profondeur).toBe(1);
  });

  it('un doigt qui n’a pas été posé ne fait rien du tout', () => {
    const nav = service();
    nav.glisserDoigt(POUSSEE * 10);
    expect(nav.etat().profondeur).toBe(0);
    expect(nav.butee()).toBe(0);
  });

  it('lever le doigt fait retomber la butée', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    nav.leverDoigt();
    expect(nav.butee()).toBe(0);
  });

  it('au seuil, tirer vers le haut bute sans jamais sortir du site', () => {
    const nav = service();
    nav.poserDoigt();
    nav.glisserDoigt(-POUSSEE * 5);
    expect(nav.etat().profondeur).toBe(0);
  });
});

describe('le bureau ne bouge pas', () => {
  beforeEach(() => {
    sansGlissement();
    location.hash = '';
  });

  it('la molette avance toujours en continu, sans butée ni défilement', () => {
    const nav = service();
    nav.defiler(210); // un demi-cran
    expect(nav.etat().profondeur).toBeCloseTo(0.5, 10);
    expect(nav.etat().defilement ?? 0).toBe(0);
    expect(nav.butee()).toBe(0);
  });

  it('le cadre publié reste exactement celui du cœur', () => {
    const nav = service();
    nav.defiler(420);
    expect(nav.cadreAffiche()).toEqual(cadre(grapheDe('large'), RACINE, 1));
  });
});

describe('les repères disent ce qu’il y a au-delà', () => {
  beforeEach(() => {
    sansGlissement();
    location.hash = '';
    TestBed.resetTestingModule();
  });

  it('ne montrent aucun mot tant que rien ne bute', async () => {
    const fixture = TestBed.createComponent(Reperes);
    TestBed.inject(Navigation).demarrer();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.reperes__invite')).toBeNull();
  });

  it('nomment la pièce d’à côté quand la caméra bute', async () => {
    const fixture = TestBed.createComponent(Reperes);
    const nav = TestBed.inject(Navigation);
    nav.demarrer();
    nav.poserDoigt();
    nav.glisserDoigt(APPUI);
    fixture.detectChanges();
    await fixture.whenStable();
    const mot = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.reperes__invite',
    );
    expect(mot?.textContent?.trim()).toBe('↓ Projects');
    expect(Number(mot?.style.opacity)).toBeGreaterThan(0);
  });
});
