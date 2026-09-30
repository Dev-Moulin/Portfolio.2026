import { describe, expect, it } from 'vitest';
import {
  densiteDepuisLuminance,
  echantillonner,
  filaments,
  fondDominant,
  normaliser,
  renforcer,
  dansLaZone,
  trierParAngle,
  type Particule,
  type ZoneImage,
} from './particules';

/**
 * Un aléa reproductible : les tirages doivent être vérifiables, et un
 * `Math.random` rendrait ces tests tantôt verts tantôt rouges.
 */
function hasardSeme(graine: number): () => number {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

describe('fond dominant', () => {
  it('prend le niveau le plus fréquent, pas les coins', () => {
    // La forme du PNG du logo : un champ à 10 majoritaire, du noir pur en
    // quantité (l'extérieur du badge ET le disque du centre), l'anneau blanc
    // en minorité. Les coins vaudraient 0 et feraient tout produire.
    const image = [0, 0, 0, 10, 10, 10, 10, 255];
    expect(fondDominant(image)).toBe(10);
  });

  it('vaut 0 sur une image vide', () => {
    expect(fondDominant([])).toBe(0);
  });
});

describe('densité depuis la luminosité', () => {
  it('retire le fond, et le disque noir avec lui', () => {
    // Les trois niveaux réellement mesurés dans le PNG du logo : le disque
    // plein (0), le fond #0a0a0a (10), l'anneau blanc (255).
    expect(densiteDepuisLuminance([0, 10, 255], 10)).toEqual([0, 0, 245]);
  });

  it('ne rend jamais de densité négative', () => {
    expect(densiteDepuisLuminance([0, 5], 10)).toEqual([0, 0]);
  });

  it('ignore le tremblement du champ sous le plancher', () => {
    // Le champ du badge tremble entre 8 et 14 autour d'un fond à 10 ; le bord
    // anticrénelé de l'anneau, lui, dépasse largement. Sans plancher, le
    // tremblement semait des particules dans tout le vide.
    expect(densiteDepuisLuminance([8, 12, 14, 40, 255], 10, 8)).toEqual([0, 0, 0, 30, 245]);
  });
});

describe('échantillonnage', () => {
  it('ne tire rien quand toute la densité est nulle', () => {
    expect(echantillonner([0, 0, 0, 0], 2, 2, 100, hasardSeme(1))).toEqual([]);
  });

  it('ne tire rien quand on ne demande aucune particule', () => {
    expect(echantillonner([1, 1, 1, 1], 2, 2, 0, hasardSeme(1))).toEqual([]);
  });

  it('tire le nombre demandé', () => {
    expect(echantillonner([1, 1, 1, 1], 2, 2, 50, hasardSeme(1))).toHaveLength(50);
  });

  it('place les particules dans le seul pixel qui porte de la densité', () => {
    // Densité au pixel du haut-gauche seulement : en repère de scène, ça met
    // les particules à gauche (x < 0) et EN HAUT (y > 0) — l'axe Y est
    // retourné par rapport à l'image.
    const tirage = echantillonner([1, 0, 0, 0], 2, 2, 30, hasardSeme(7));
    for (const p of tirage) {
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.x).toBeLessThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(0.5);
      expect(p.z).toBe(0);
    }
  });

  it('retourne bien l’axe Y : le bas de l’image descend sous zéro', () => {
    const tirage = echantillonner([0, 0, 0, 1], 2, 2, 30, hasardSeme(3));
    for (const p of tirage) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(0);
    }
  });

  it('ne pose pas les particules sur la grille des pixels', () => {
    // Sans décalage dans le pixel, toutes les particules d'une même case
    // tomberaient exactement au même endroit et le nuage trahirait l'image.
    const tirage = echantillonner([1, 0, 0, 0], 2, 2, 20, hasardSeme(11));
    const distinctes = new Set(tirage.map((p) => `${p.x}|${p.y}`));
    expect(distinctes.size).toBeGreaterThan(1);
  });
});

describe('normalisation du nuage', () => {
  /** Un anneau posé loin de l'origine, mince selon x — le cas des anneaux
   *  d'Intuition tels qu'ils sortent de Blender. */
  const anneauLointain: Particule[] = [
    { x: 10, y: 4, z: 4 },
    { x: 10.2, y: 6, z: 6 },
    { x: 10.1, y: 4, z: 6 },
    { x: 10.1, y: 6, z: 4 },
  ];

  it('ne plante pas sur un nuage vide', () => {
    expect(normaliser([])).toEqual([]);
  });

  it('recentre le nuage sur l’origine', () => {
    const n = normaliser(anneauLointain);
    const moyenne = (axe: 'x' | 'y' | 'z') => n.reduce((s, p) => s + p[axe], 0) / n.length;
    for (const axe of ['x', 'y', 'z'] as const) {
      expect(Math.abs(moyenne(axe))).toBeLessThan(1e-9);
    }
  });

  it('amène l’axe le plus mince sur z, face à la caméra', () => {
    const n = normaliser(anneauLointain);
    const etendue = (axe: 'x' | 'y' | 'z') =>
      Math.max(...n.map((p) => p[axe])) - Math.min(...n.map((p) => p[axe]));
    expect(etendue('z')).toBeLessThan(etendue('x'));
    expect(etendue('z')).toBeLessThan(etendue('y'));
  });

  it('met le nuage à l’échelle d’une unité dans son plan', () => {
    const n = normaliser(anneauLointain);
    const demiLargeur = Math.max(...n.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
    expect(demiLargeur).toBeCloseTo(0.5, 9);
  });

  it('ne retourne PAS le logo en miroir', () => {
    // Le produit mixte change de signe sous un miroir, pas sous une rotation
    // ni une mise à l'échelle positive. Un logo miroir est un logo faux, donc
    // ce test garde la permutation circulaire honnête.
    const repere: Particule[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0.1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -0.1, y: -1, z: -1 },
    ];
    const mixte = (p: readonly Particule[]) => {
      const v = (i: number) => ({
        x: p[i]!.x - p[0]!.x,
        y: p[i]!.y - p[0]!.y,
        z: p[i]!.z - p[0]!.z,
      });
      const [a, b, c] = [v(1), v(2), v(3)];
      return (
        a.x * (b.y * c.z - b.z * c.y) -
        a.y * (b.x * c.z - b.z * c.x) +
        a.z * (b.x * c.y - b.y * c.x)
      );
    };
    expect(Math.sign(mixte(normaliser(repere)))).toBe(Math.sign(mixte(repere)));
  });
});

describe('filaments', () => {
  const ligne: Particule[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0.1, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
  ];

  it('ne relie que les particules assez proches', () => {
    // 0 et 1 sont à 0,1 ; 1 et 2 à 0,4 : le vide du logo ne se fait pas
    // traverser.
    expect(filaments(ligne, 0.2, 5)).toEqual([[0, 1]]);
  });

  it('ne compte chaque filament qu’une fois', () => {
    const paire = filaments(ligne.slice(0, 2), 1, 5);
    expect(paire).toEqual([[0, 1]]);
  });

  it('plafonne le nombre de voisins par particule', () => {
    // Des écarts croissants et francs (0,10 / 0,15 / 0,20) : le plus proche
    // voisin de chacun est sans ambiguïté, là où des écarts égaux se
    // départageraient sur des poussières de flottant.
    const grappe: Particule[] = [0, 0.1, 0.25, 0.45].map((x) => ({ x, y: 0, z: 0 }));
    // Tout le monde est à portée : sans plafond on aurait les 6 paires.
    expect(filaments(grappe, 1, 5)).toHaveLength(6);
    expect(filaments(grappe, 1, 1)).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it('mesure la distance en 3D', () => {
    const enProfondeur: Particule[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0.5 },
    ];
    expect(filaments(enProfondeur, 0.2, 5)).toEqual([]);
    expect(filaments(enProfondeur, 0.6, 5)).toEqual([[0, 1]]);
  });

  it('ne plante pas sur un nuage vide', () => {
    expect(filaments([], 1, 5)).toEqual([]);
  });
});

describe('proportions et renfort de zone', () => {
  it('ne déforme pas une image non carrée', () => {
    // Une image deux fois plus large que haute, entièrement allumée : le
    // nuage doit rester deux fois plus large que haut. Diviser chaque axe par
    // sa propre taille l'aurait rendu carré — un logo étiré est un logo faux.
    const densite = [1, 1, 1, 1, 1, 1, 1, 1];
    const tirage = echantillonner(densite, 4, 2, 400, hasardSeme(5));
    const etendue = (axe: 'x' | 'y') =>
      Math.max(...tirage.map((p) => p[axe])) - Math.min(...tirage.map((p) => p[axe]));
    expect(etendue('x') / etendue('y')).toBeGreaterThan(1.7);
  });

  it('multiplie la densité dans la zone, et seulement là', () => {
    // Grille 4×2, toute allumée à 1 ; la zone couvre la colonne de droite.
    const renforcee = renforcer([1, 1, 1, 1, 1, 1, 1, 1], 4, { x0: 0.7, y0: 0, x1: 1, y1: 1 }, 5);
    expect(renforcee).toEqual([1, 1, 1, 5, 1, 1, 1, 5]);
  });

  it('laisse la densité intacte avec un facteur de 1', () => {
    const densite = [3, 7, 2, 9];
    expect(renforcer(densite, 2, { x0: 0, y0: 0, x1: 1, y1: 1 }, 1)).toEqual(densite);
  });

  it('retrouve la zone d’origine d’une particule normalisée', () => {
    // Le coin haut-droit de l'image doit être reconnu comme tel après le
    // passage en coordonnées de scène (centrées, axe Y retourné).
    const zone: ZoneImage = { x0: 0.5, y0: 0, x1: 1, y1: 0.5 };
    const hautDroite = echantillonner([0, 1, 0, 0], 2, 2, 20, hasardSeme(2));
    for (const p of hautDroite) expect(dansLaZone(p, zone, 2, 2)).toBe(true);
    const basGauche = echantillonner([0, 0, 1, 0], 2, 2, 20, hasardSeme(2));
    for (const p of basGauche) expect(dansLaZone(p, zone, 2, 2)).toBe(false);
  });
});

describe('tri par angle (l’appariement du morphe)', () => {
  it('ordonne les particules autour du centre', () => {
    // Quatre points aux quatre orients, donnés dans le désordre : le tri doit
    // les remettre dans l'ordre des angles croissants.
    const croix: Particule[] = [
      { x: 0, y: 1, z: 0 }, // haut, +90°
      { x: 1, y: 0, z: 0 }, // droite, 0°
      { x: 0, y: -1, z: 0 }, // bas, -90°
      { x: -1, y: 0, z: 0 }, // gauche, 180°
    ];
    expect(trierParAngle(croix)).toEqual([2, 1, 0, 3]);
  });

  it('rend une permutation complète, sans perdre ni doubler personne', () => {
    const nuage = Array.from({ length: 50 }, (_, i) => ({
      x: Math.cos(i * 2.4),
      y: Math.sin(i * 2.4),
      z: 0,
    }));
    const ordre = trierParAngle(nuage);
    expect(new Set(ordre).size).toBe(50);
    expect(Math.max(...ordre)).toBe(49);
  });

  it('ne plante pas sur un nuage vide', () => {
    expect(trierParAngle([])).toEqual([]);
  });
});
