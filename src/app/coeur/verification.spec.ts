import { describe, expect, it } from 'vitest';
import { verifierGraphe } from './verification';
import { RACINE, grapheDe } from './contenu';
import type { Graphe } from './modele';

describe('le graphe du portfolio', () => {
  for (const format of ['large', 'etroit'] as const) {
    it(`format « ${format} » : aucune anomalie`, () => {
      expect(verifierGraphe(grapheDe(format), RACINE)).toEqual([]);
    });
  }
});

/** Construit un graphe minimal auquel on greffe le défaut à détecter. */
function avec(ouvertures: Graphe['x']['ouvertures']): Graphe {
  return { x: { id: 'x', nom: 'X', ouvertures } };
}

describe('les défauts que la vérification doit voir', () => {
  it('une ouverture qui déborde de sa pièce', () => {
    const erreurs = verifierGraphe(
      avec([{ id: 'y', x: 0.8, y: 0.1, w: 0.4, cible: { genre: 'externe', href: 'https://a.b' }, libelle: 'y' }]),
      'x',
    );
    expect(erreurs.some((e) => e.includes('déborde horizontalement'))).toBe(true);
  });

  it('une largeur nulle ou supérieure à 1', () => {
    for (const w of [0, -0.2, 1.5]) {
      const erreurs = verifierGraphe(
        avec([{ id: 'y', x: 0, y: 0, w, cible: { genre: 'externe', href: 'https://a.b' }, libelle: 'y' }]),
        'x',
      );
      expect(erreurs.some((e) => e.includes('hors de'))).toBe(true);
    }
  });

  it('deux ouvertures de profondeur dans la même pièce (axe ambigu)', () => {
    const graphe: Graphe = {
      x: {
        id: 'x',
        nom: 'X',
        ouvertures: [
          { id: 'a', x: 0, y: 0, w: 0.3, cible: { genre: 'profondeur' }, libelle: 'a' },
          { id: 'b', x: 0.5, y: 0, w: 0.3, cible: { genre: 'profondeur' }, libelle: 'b' },
        ],
      },
      a: { id: 'a', nom: 'A', ouvertures: [] },
      b: { id: 'b', nom: 'B', ouvertures: [] },
    };
    expect(verifierGraphe(graphe, 'x').some((e) => e.includes('2 ouvertures de profondeur'))).toBe(true);
  });

  it('un univers latéral qui n’existe pas', () => {
    const erreurs = verifierGraphe(
      avec([{ id: 'y', x: 0, y: 0, w: 0.3, cible: { genre: 'laterale', univers: 'nulle-part' }, libelle: 'y' }]),
      'x',
    );
    expect(erreurs.some((e) => e.includes('nulle-part'))).toBe(true);
  });

  it('un lien externe qui n’est pas en https', () => {
    const erreurs = verifierGraphe(
      avec([{ id: 'y', x: 0, y: 0, w: 0.3, cible: { genre: 'externe', href: 'http://a.b' }, libelle: 'y' }]),
      'x',
    );
    expect(erreurs.some((e) => e.includes('non https'))).toBe(true);
  });

  it('une pièce que personne ne peut atteindre', () => {
    const graphe: Graphe = {
      x: { id: 'x', nom: 'X', ouvertures: [] },
      orpheline: { id: 'orpheline', nom: 'O', ouvertures: [] },
    };
    expect(verifierGraphe(graphe, 'x').some((e) => e.includes('inatteignable'))).toBe(true);
  });

  it('une racine qui n’existe pas', () => {
    expect(verifierGraphe({}, 'absente').some((e) => e.includes('racine'))).toBe(true);
  });

  it('deux ouvertures portant le même identifiant', () => {
    const erreurs = verifierGraphe(
      avec([
        { id: 'y', x: 0, y: 0, w: 0.2, cible: { genre: 'externe', href: 'https://a.b' }, libelle: 'y' },
        { id: 'y', x: 0.5, y: 0, w: 0.2, cible: { genre: 'externe', href: 'https://a.b' }, libelle: 'y' },
      ]),
      'x',
    );
    expect(erreurs.some((e) => e.includes('en double'))).toBe(true);
  });
});
