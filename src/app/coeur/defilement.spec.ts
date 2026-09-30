// Tests d'acceptation du lot PH-1 : le second axe (défilement dans une pièce).
//
// Ils portent tous sur des VALEURS CALCULÉES — des cadres, des nombres — et
// jamais sur la présence d'une chaîne dans un gabarit. C'est ce qui permet de
// les jouer sans navigateur, dans le conteneur, et c'est la raison d'être de
// ce lot : poser le moteur pendant qu'il est encore entièrement calculable.

import { describe, expect, it } from 'vitest';
import { cadre, cadreAvecDefilement, decalerCadre, hauteurDe } from './geometrie';
import { deplacer, entrer, etatInitial, sortir, viser } from './etats';
import { verifierGraphe } from './verification';
import { GRAPHE, RACINE, grapheDe } from './contenu';
import type { Graphe } from './modele';

/**
 * Un graphe minimal à deux pièces, dont la première fait DEUX écrans de haut.
 * Ses cadres entiers valent { x: 0, y: 0, w: 1 } puis { x: 0,25, y: 0,5,
 * w: 0,5 } — des nombres ronds, pour que chaque attente reste lisible.
 */
const HAUTE: Graphe = {
  x: {
    id: 'x',
    nom: 'X',
    hauteur: 2,
    ouvertures: [
      { id: 'y', x: 0.25, y: 0.5, w: 0.5, cible: { genre: 'profondeur' }, libelle: 'vers y' },
    ],
  },
  y: { id: 'y', nom: 'Y', hauteur: 1, ouvertures: [] },
};

describe('hauteurDe', () => {
  it('rend la hauteur déclarée', () => {
    expect(hauteurDe(HAUTE, 'x')).toBe(2);
  });

  it('rend 1 quand la hauteur est absente — le comportement d’avant', () => {
    expect(hauteurDe(GRAPHE, RACINE)).toBe(1);
  });

  it('rend 1 pour une pièce inconnue, sans planter', () => {
    expect(hauteurDe(HAUTE, 'inexistante')).toBe(1);
  });
});

describe('decalerCadre', () => {
  const racine = { x: 0, y: 0, w: 1 };

  it('ne déplace rien quand la pièce fait un écran, quel que soit le défilement', () => {
    for (const d of [0, 0.5, 1]) {
      expect(decalerCadre(racine, 1, d)).toEqual(racine);
    }
  });

  it('descend d’exactement une hauteur de vue au bas d’une pièce de 2 écrans', () => {
    expect(decalerCadre(racine, 2, 1)).toEqual({ x: 0, y: 1, w: 1 });
  });

  it('parcourt l’amplitude proportionnellement au défilement', () => {
    expect(decalerCadre(racine, 2, 0.5).y).toBeCloseTo(0.5, 10);
    expect(decalerCadre(racine, 3, 0.25).y).toBeCloseTo(0.5, 10);
  });

  it('exprime l’amplitude dans le repère de la pièce, pas dans celui de l’écran', () => {
    // Une pièce deux fois plus petite défile deux fois moins loin en
    // coordonnées racine : (3 − 1) × 0,5 = 1.
    expect(decalerCadre({ x: 0.25, y: 0.5, w: 0.5 }, 3, 1).y).toBeCloseTo(1.5, 10);
  });

  it('ne touche jamais à x ni à w : défiler n’est pas zoomer', () => {
    const decale = decalerCadre({ x: 0.25, y: 0.5, w: 0.5 }, 4, 0.7);
    expect(decale.x).toBe(0.25);
    expect(decale.w).toBe(0.5);
  });
});

describe('cadreAvecDefilement', () => {
  it('rend le cadre d’aujourd’hui quand les deux défilements sont nuls', () => {
    for (const d of [0, 0.5, 1]) {
      expect(cadreAvecDefilement(HAUTE, 'x', d, 0, 0)).toEqual(cadre(HAUTE, 'x', d));
    }
  });

  it('cadre le bas de la pièce quand on y est descendu', () => {
    expect(cadreAvecDefilement(HAUTE, 'x', 0, 1, 0)).toEqual({ x: 0, y: 1, w: 1 });
  });

  it('arrive exactement sur la pièce cible, quel que soit le point de départ', () => {
    // C'est l'invariant qui empêche de rester coincé entre deux pièces.
    for (const depart of [0, 0.5, 1]) {
      expect(cadreAvecDefilement(HAUTE, 'x', 1, depart, 0)).toEqual(cadre(HAUTE, 'x', 1));
    }
  });

  it('part du cadre où l’on est réellement, pas du haut de la pièce', () => {
    // LE point du lot : à mi-transition, être parti du bas doit se voir.
    const duHaut = cadreAvecDefilement(HAUTE, 'x', 0.5, 0, 0);
    const duBas = cadreAvecDefilement(HAUTE, 'x', 0.5, 1, 0);
    expect(duBas.y).toBeGreaterThan(duHaut.y);
    // …sans que le grossissement en soit affecté.
    expect(duBas.w).toBeCloseTo(duHaut.w, 10);
  });

  it('laisse le site actuel rigoureusement identique — le critère « zéro pixel »', () => {
    // Toutes les pièces du contenu réel déclarent une hauteur de 1 écran :
    // aucune valeur de défilement ne doit pouvoir déplacer quoi que ce soit,
    // sur aucun des deux formats.
    for (const format of ['large', 'etroit'] as const) {
      const graphe = grapheDe(format);
      for (const d of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
        for (const [depart, arrivee] of [
          [0, 0],
          [1, 0],
          [0.5, 1],
          [1, 1],
        ]) {
          expect(cadreAvecDefilement(graphe, RACINE, d, depart!, arrivee!)).toEqual(
            cadre(graphe, RACINE, d),
          );
        }
      }
    }
  });
});

describe('les deux axes ne se marchent pas dessus', () => {
  const enBas = { ...etatInitial(), defilement: 0.7 };

  it('deplacer change la profondeur sans toucher au défilement', () => {
    expect(deplacer(enBas, 1, GRAPHE, RACINE).defilement).toBe(0.7);
  });

  it('viser change la profondeur sans toucher au défilement', () => {
    expect(viser(enBas, 2, GRAPHE, RACINE).defilement).toBe(0.7);
  });

  it('entrer dans un projet ne touche ni à la profondeur ni au défilement', () => {
    const entre = entrer({ ...enBas, profondeur: 1 }, 'intuition', GRAPHE);
    expect(entre.profondeur).toBe(1);
    expect(entre.defilement).toBe(0.7);
  });

  it('en ressortir ramène exactement au même endroit, sur les deux axes', () => {
    const depart = { ...enBas, profondeur: 1 };
    expect(sortir(entrer(depart, 'intuition', GRAPHE))).toEqual(depart);
  });
});

describe('verifierGraphe et la hauteur', () => {
  const avecHauteur = (hauteur?: number): Graphe => ({
    x: { id: 'x', nom: 'X', hauteur, ouvertures: [] },
  });

  it('refuse une pièce qui ne déclare pas sa hauteur', () => {
    expect(verifierGraphe(avecHauteur(undefined), 'x').some((e) => e.includes('hauteur'))).toBe(
      true,
    );
  });

  it('refuse une hauteur inférieure à un écran', () => {
    expect(verifierGraphe(avecHauteur(0.5), 'x').some((e) => e.includes('hauteur'))).toBe(true);
  });

  it('accepte une hauteur d’un écran ou plus', () => {
    for (const h of [1, 2, 2.5]) {
      expect(verifierGraphe(avecHauteur(h), 'x')).toEqual([]);
    }
  });
});
