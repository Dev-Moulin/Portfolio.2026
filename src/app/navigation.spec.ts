import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigation } from './navigation';
import { RACINE, grapheDe } from './coeur/contenu';
import { cadre } from './coeur/geometrie';

/** Pilote `matchMedia`, que jsdom ne fournit pas tel qu’on en a besoin. */
function simulerMedia(reponse: (requete: string) => boolean) {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: reponse(requete),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function service(): Navigation {
  TestBed.resetTestingModule();
  return TestBed.inject(Navigation);
}

describe('service de navigation', () => {
  beforeEach(() => simulerMedia(() => false));

  it('démarre au seuil, caméra posée', () => {
    const nav = service();
    expect(nav.etat()).toEqual({ profondeur: 0, univers: null });
    expect(nav.profondeurAffichee()).toBe(0);
    expect(nav.profondeurMax()).toBe(2);
    expect(nav.chemin()).toEqual(['seuil', 'projets', 'orchestrateur']);
  });

  it('convertit un défilement en pixels en avancée de profondeur', () => {
    const nav = service();
    nav.defiler(420); // un « écran » de molette = une pièce
    expect(nav.etat().profondeur).toBeCloseTo(1, 10);
    nav.defiler(-10000);
    expect(nav.etat().profondeur).toBe(0);
  });

  it('le clavier saute de pièce en pièce depuis la plus proche', () => {
    const nav = service();
    nav.defiler(180); // ~0,43 : on est encore le plus près du seuil
    nav.pieceSuivante(1);
    expect(nav.etat().profondeur).toBe(1);
    nav.pieceSuivante(-1);
    expect(nav.etat().profondeur).toBe(0);
  });

  it('la caméra ne saute jamais : viser une pièce ne la téléporte pas', () => {
    const nav = service();
    nav.viserProfondeur(2);
    expect(nav.etat().profondeur).toBe(2); // la cible, elle, est immédiate
    expect(nav.profondeurAffichee()).toBe(0); // la caméra, non : elle converge
    expect(nav.cadreAffiche()).toEqual(cadre(grapheDe('large'), RACINE, 0));
  });

  it('au démarrage, on est posé dans la salle de départ', () => {
    location.hash = '';
    const nav = service();
    nav.demarrer();
    expect(nav.sallePresente()).toBeNull(); // posée, mais pas encore présente…
    nav.poserAuChargement();
    expect(nav.sallePresente()).toBe('seuil'); // …tant que la page n'est pas chargée
  });

  it('quitter une salle la rend absente TOUT DE SUITE, avant que la caméra bouge', () => {
    // C'est ce qui lance la chorégraphie de sortie au premier cran de molette.
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.poserAuChargement();
    nav.viserProfondeur(1);
    expect(nav.profondeurAffichee()).toBe(0);
    expect(nav.sallePresente()).toBeNull();
  });

  /** Posé dans la salle 2, à la page voulue (0 : le repos, 1 : les cartes), mouvement rétabli. */
  function poseEnSalle2(page: number): Navigation {
    simulerMedia((r) => r.includes('prefers-reduced-motion'));
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.viserProfondeur(1);
    nav.declarerPages('projets', 2);
    nav.allerPage('projets', page);
    simulerMedia(() => false);
    return nav;
  }

  it('quitter la salle 2 depuis ses cartes : elle reste là le temps que la fumée les emporte', () => {
    const nav = poseEnSalle2(1);
    nav.viserProfondeur(2);
    // La salle reste présente et la caméra ne bouge pas : seules les cartes partent.
    expect(nav.sallePresente()).toBe('projets');
    expect(nav.salleEnPartance()).toBe('projets');
    expect(nav.profondeurAffichee()).toBe(1);
    // Revenir pendant l'attente annule le départ.
    nav.viserProfondeur(1);
    expect(nav.salleEnPartance()).toBeNull();
    expect(nav.sallePresente()).toBe('projets');
  });

  it('quitter la salle 2 depuis le repos : pas de cartes, départ tout de suite', () => {
    const nav = poseEnSalle2(0);
    nav.viserProfondeur(0);
    expect(nav.salleEnPartance()).toBeNull();
    expect(nav.sallePresente()).toBeNull();
  });

  it('les cartes disparues, la salle 2 part pour de bon, et alors seulement la caméra', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      const nav = poseEnSalle2(1);
      nav.viserProfondeur(2);
      vi.advanceTimersByTime(500);
      expect(nav.sallePresente()).toBe('projets');
      expect(nav.profondeurAffichee()).toBeCloseTo(1, 9); // immobile, aux arrondis près
      nav.pieceSuivante(1); // un second cran pendant l'attente ne la relance pas
      vi.advanceTimersByTime(400); // 0,9 s : les cartes ont disparu à 0,8 s
      expect(nav.sallePresente()).toBeNull();
      expect(nav.salleEnPartance()).toBeNull();
      vi.advanceTimersByTime(3000);
      expect(nav.profondeurAffichee()).toBeGreaterThan(1);
      expect(nav.etat().profondeur).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('en mouvement réduit, on est posé dans la nouvelle salle aussitôt', () => {
    simulerMedia((r) => r.includes('prefers-reduced-motion'));
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.viserProfondeur(1);
    expect(nav.sallePresente()).toBe('projets');
    nav.ouvrirUnivers('intuition'); // entrée latérale : on reste posé
    expect(nav.sallePresente()).toBe('projets');
  });

  it('le cadre publié est celui du cœur, sans recalcul local', () => {
    simulerMedia((r) => r.includes('prefers-reduced-motion'));
    const nav = service();
    nav.viserProfondeur(2);
    expect(nav.cadreAffiche()).toEqual(cadre(grapheDe('large'), RACINE, 2));
  });

  it('ouvrir puis fermer un projet laisse la profondeur intacte', () => {
    const nav = service();
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('overmind');
    expect(nav.etat().profondeur).toBe(1);
    expect(nav.universOuvert()).toBe('overmind');
    nav.fermerUnivers();
    // `defilement: 0` est arrivé avec le lot PH-2 : `viserProfondeur` pose
    // désormais le point d'arrivée dans la pièce (en haut quand on descend).
    // L'assertion en dit du coup un peu plus qu'avant — le défilement aussi
    // survit à l'aller-retour dans un projet.
    expect(nav.etat()).toEqual({ profondeur: 1, univers: null, defilement: 0 });
  });

  it('nomme la pièce courante d’après la caméra, pas d’après la cible', () => {
    const nav = service();
    nav.viserProfondeur(3);
    expect(nav.pieceCourante()).toBe('seuil'); // la caméra n’a pas encore bougé
  });

  it('mouvement réduit : la caméra se pose sans glissement', () => {
    simulerMedia((r) => r.includes('prefers-reduced-motion'));
    const nav = service();
    nav.viserProfondeur(2);
    expect(nav.profondeurAffichee()).toBe(2);
    expect(nav.pieceCourante()).toBe('orchestrateur');
  });

  it('choisit la mise en page empilée en portrait étroit', () => {
    simulerMedia((r) => r.includes('orientation: portrait'));
    const nav = service();
    const etroit = grapheDe('etroit');
    expect(nav.graphe()['seuil']!.ouvertures[0]!.w).toBe(etroit['seuil']!.ouvertures[0]!.w);
  });
});

describe('les pages des cartes de texte', () => {
  // Mouvement réduit : la caméra se pose aussitôt, on observe l'état.
  beforeEach(() => simulerMedia((requete) => requete.includes('prefers-reduced-motion')));

  // Le mécanisme ne dépend pas de la salle : on l'éprouve sur le seuil, qui a
  // une salle en dessous (Hermès n'en a plus depuis que le portfolio 3D est
  // retiré, le 24/09).
  function auSeuil(pages: number): Navigation {
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.declarerPages('seuil', pages);
    return nav;
  }

  it('la molette tourne la page avant de changer de salle', () => {
    const nav = auSeuil(2);
    expect(nav.pages().get('seuil')?.page).toBe(0);
    nav.pieceSuivante(1);
    expect(nav.etat().profondeur).toBe(0); // la salle ne change pas…
    expect(nav.pages().get('seuil')?.page).toBe(1); // …la page, si
    nav.pieceSuivante(1); // dernière page : on descend
    expect(nav.etat().profondeur).toBe(1);
  });

  it('en remontant, on retrouve la dernière page, puis on feuillette à l’envers', () => {
    const nav = auSeuil(2);
    nav.viserProfondeur(1);
    nav.pieceSuivante(-1);
    expect(nav.etat().profondeur).toBe(0);
    expect(nav.pages().get('seuil')?.page).toBe(1);
    nav.pieceSuivante(-1);
    expect(nav.pages().get('seuil')?.page).toBe(0);
    nav.pieceSuivante(-1); // première page de la première salle : rien au-dessus
    expect(nav.etat().profondeur).toBe(0);
    expect(nav.pages().get('seuil')?.page).toBe(0);
  });

  it('une carte pas encore montée s’ouvre quand même à sa dernière page par le bas', () => {
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.viserProfondeur(1);
    nav.pieceSuivante(-1); // la carte n'a encore rien déclaré
    nav.declarerPages('seuil', 3);
    expect(nav.pages().get('seuil')?.page).toBe(2);
  });

  it('les sauts directs ne feuillettent pas : ils changent de salle', () => {
    const nav = auSeuil(2);
    nav.viserProfondeur(1); // un repère, ou Fin
    expect(nav.etat().profondeur).toBe(1);
    nav.allerPage('seuil', 1);
    expect(nav.pages().get('seuil')?.page).toBe(1);
  });

  it('à la dernière page de la dernière salle, la molette ne mène nulle part', () => {
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.declarerPages('orchestrateur', 2);
    nav.viserProfondeur(2);
    nav.pieceSuivante(1);
    expect(nav.pages().get('orchestrateur')?.page).toBe(1);
    nav.pieceSuivante(1);
    expect(nav.etat().profondeur).toBe(2);
    expect(nav.pages().get('orchestrateur')?.page).toBe(1);
  });

  it('une carte d’une seule page ne retient pas la molette', () => {
    location.hash = '';
    const nav = service();
    nav.demarrer();
    nav.declarerPages('seuil', 1);
    nav.pieceSuivante(1);
    expect(nav.etat().profondeur).toBe(1);
  });
});
