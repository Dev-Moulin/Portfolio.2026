import { describe, expect, it } from 'vitest';
import { depuisHash, versHash } from './lien-hash';
import { GRAPHE, RACINE } from './contenu';

describe('l’adresse de la page', () => {
  it('l’accueil n’a pas d’ancre', () => {
    expect(versHash({ profondeur: 0, univers: null }, GRAPHE, RACINE)).toBe('');
    expect(versHash({ profondeur: 0.3, univers: null }, GRAPHE, RACINE)).toBe('');
  });

  it('nomme la pièce la plus proche', () => {
    expect(versHash({ profondeur: 1, univers: null }, GRAPHE, RACINE)).toBe('projets');
    expect(versHash({ profondeur: 2.4, univers: null }, GRAPHE, RACINE)).toBe('orchestrateur');
  });

  it('un projet ouvert prend le pas sur la profondeur', () => {
    expect(versHash({ profondeur: 1, univers: 'overmind' }, GRAPHE, RACINE)).toBe('overmind');
  });

  it('relit ce qu’elle a écrit', () => {
    for (const etat of [
      { profondeur: 0, univers: null },
      { profondeur: 2, univers: null },
      { profondeur: 1, univers: null },
    ] as const) {
      expect(depuisHash(versHash(etat, GRAPHE, RACINE), GRAPHE, RACINE)).toEqual(etat);
    }
  });

  it('un lien vers un projet rétablit AUSSI la pièce qui le contient', () => {
    // Sans cela, fermer le panneau depuis un lien partagé ramènerait à l’accueil.
    expect(depuisHash('#founders', GRAPHE, RACINE)).toEqual({ profondeur: 1, univers: 'founders' });
  });

  it('une ancre inconnue ouvre l’accueil plutôt qu’une page cassée', () => {
    expect(depuisHash('#vieille-adresse', GRAPHE, RACINE)).toEqual({ profondeur: 0, univers: null });
    expect(depuisHash('', GRAPHE, RACINE)).toEqual({ profondeur: 0, univers: null });
  });

  it('accepte l’ancre avec ou sans le croisillon', () => {
    expect(depuisHash('orchestrateur', GRAPHE, RACINE)).toEqual(
      depuisHash('#orchestrateur', GRAPHE, RACINE),
    );
  });
});
