import { describe, expect, it } from 'vitest';
import { RAYON_MAX, RAYON_SOUDURE, REGLAGES_TRAME, coutTrame, grilleTrame, rvb } from './trame';

describe('grilleTrame', () => {
  it('couvre un écran qui tombe juste', () => {
    expect(grilleTrame(1920, 1080, 6)).toEqual({ colonnes: 320, lignes: 180 });
  });

  it('arrondit au-dessus : une cellule entamée au bord doit exister', () => {
    // 1919 / 6 = 319,83 — sans le `ceil`, la dernière colonne de pixels
    // lirait hors texture et resterait noire.
    expect(grilleTrame(1919, 1079, 6)).toEqual({ colonnes: 320, lignes: 180 });
  });

  it("ne descend jamais à zéro, car une texture de côté nul n'est pas allouable", () => {
    expect(grilleTrame(0, 0, 6)).toEqual({ colonnes: 1, lignes: 1 });
    expect(grilleTrame(1, 1, 6)).toEqual({ colonnes: 1, lignes: 1 });
  });

  it('se défend contre une cellule nulle ou négative', () => {
    expect(grilleTrame(100, 100, 0)).toEqual({ colonnes: 100, lignes: 100 });
    expect(grilleTrame(100, 100, -4)).toEqual({ colonnes: 100, lignes: 100 });
  });
});

describe('coutTrame', () => {
  it("mesure l'économie de la grille sur un calcul par pixel", () => {
    const plein = 1920 * 1080;
    const trame = coutTrame(1920, 1080, REGLAGES_TRAME.cellule);
    expect(trame).toBe(57_600);
    // À 6 px, une cellule vaut 36 pixels : c'est tout le rapport.
    expect(plein / trame).toBe(36);
  });
});

describe('rayons', () => {
  it('le rayon retenu dépasse la soudure, sinon le noir ne fait pas d’aplat', () => {
    expect(RAYON_SOUDURE).toBeCloseTo(0.7071, 4);
    expect(RAYON_MAX).toBeGreaterThan(RAYON_SOUDURE);
  });
});

describe('rvb', () => {
  it('traduit les couleurs de la palette', () => {
    expect(rvb('#000000')).toEqual([0, 0, 0]);
    expect(rvb('#ffffff')).toEqual([1, 1, 1]);
    const [r, v, b] = rvb('#4182f2');
    expect(r).toBeCloseTo(0.2549, 4);
    expect(v).toBeCloseTo(0.5098, 4);
    expect(b).toBeCloseTo(0.949, 3);
  });

  it('refuse ce qui ne se lit pas, plutôt que de peindre du noir en silence', () => {
    expect(() => rvb('bleu')).toThrow(/illisible/);
    expect(() => rvb('#abc')).toThrow(/illisible/);
  });
});

describe('REGLAGES_TRAME', () => {
  it('porte les valeurs arrêtées par Paul', () => {
    expect(REGLAGES_TRAME).toMatchObject({
      cellule: 6,
      vitesse: 0.31,
      echelle: 0.8,
      contraste: 0.95,
      densite: 0.4,
      periode: 5,
      sombre: '#0a0a0a',
      halo: 0.3,
      force: 1.2,
    });
    expect(REGLAGES_TRAME.palette).toHaveLength(5);
    // La palette est lue telle quelle par le nuanceur : toute couleur
    // illisible doit sauter ici, pas à la première image.
    expect(() => REGLAGES_TRAME.palette.map(rvb)).not.toThrow();
  });
});
