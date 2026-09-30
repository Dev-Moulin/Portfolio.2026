import { describe, expect, it } from 'vitest';
import {
  cadre,
  cadresEntiers,
  cheminProfondeur,
  largeurA,
  profondeurDe,
  profondeurMax,
  projeter,
  transformation,
  transformationCss,
  transformationSalle,
  zoneEcran,
} from './geometrie';
import { GRAPHE, RACINE, grapheDe } from './contenu';
import type { Graphe } from './modele';

/** Un graphe minuscule, pour raisonner sur des nombres qu'on tient de tête. */
const jouet: Graphe = {
  a: {
    id: 'a',
    nom: 'A',
    ouvertures: [
      { id: 'b', x: 0.25, y: 0.5, w: 0.5, cible: { genre: 'profondeur' }, libelle: 'b' },
    ],
  },
  b: {
    id: 'b',
    nom: 'B',
    ouvertures: [{ id: 'c', x: 0.5, y: 0, w: 0.25, cible: { genre: 'profondeur' }, libelle: 'c' }],
  },
  c: { id: 'c', nom: 'C', ouvertures: [] },
};

describe('chaîne de profondeur', () => {
  it('suit les ouvertures « profondeur » depuis la racine', () => {
    expect(cheminProfondeur(jouet, 'a')).toEqual(['a', 'b', 'c']);
    expect(profondeurMax(jouet, 'a')).toBe(2);
  });

  it('le portfolio compte trois pièces en profondeur', () => {
    // Le portfolio 3D est retiré le 24/09, en attendant son vrai passage.
    expect(cheminProfondeur(GRAPHE, RACINE)).toEqual(['seuil', 'projets', 'orchestrateur']);
    expect(profondeurMax(GRAPHE, RACINE)).toBe(2);
  });

  it('ne boucle pas si une pièce se contient elle-même', () => {
    const boucle: Graphe = {
      a: {
        id: 'a',
        nom: 'A',
        ouvertures: [
          { id: 'a', x: 0.1, y: 0.1, w: 0.5, cible: { genre: 'profondeur' }, libelle: 'a' },
        ],
      },
    };
    expect(cheminProfondeur(boucle, 'a')).toEqual(['a']);
  });
});

describe('cadre visé', () => {
  it('à la profondeur 0, c’est l’écran entier', () => {
    expect(cadre(jouet, 'a', 0)).toEqual({ x: 0, y: 0, w: 1 });
  });

  it('à une profondeur entière, c’est exactement l’ouverture traversée', () => {
    expect(cadre(jouet, 'a', 1)).toEqual({ x: 0.25, y: 0.5, w: 0.5 });
    // Pièce 2 : l’ouverture de b, ramenée dans le repère de a.
    expect(cadre(jouet, 'a', 2)).toEqual({ x: 0.5, y: 0.5, w: 0.125 });
  });

  it('entre deux pièces, le cadre est strictement intermédiaire', () => {
    const c0 = cadre(jouet, 'a', 0);
    const c = cadre(jouet, 'a', 0.5);
    const c1 = cadre(jouet, 'a', 1);
    expect(c.w).toBeLessThan(c0.w);
    expect(c.w).toBeGreaterThan(c1.w);
    expect(c.x).toBeGreaterThan(c0.x);
    expect(c.x).toBeLessThan(c1.x);
  });

  it('la largeur décroît de façon géométrique, pas linéaire', () => {
    // Un pas de 0,25 doit multiplier la largeur par un facteur CONSTANT.
    const w = [0, 0.25, 0.5, 0.75, 1].map((d) => cadre(jouet, 'a', d).w);
    const rapports = w.slice(1).map((x, i) => x / w[i]!);
    for (const r of rapports) expect(r).toBeCloseTo(rapports[0]!, 12);
    // Une interpolation linéaire donnerait un cadre plus large à mi-chemin.
    expect(cadre(jouet, 'a', 0.5).w).toBeLessThan((1 + 0.5) / 2);
  });

  it('une profondeur hors bornes est saturée, jamais une erreur', () => {
    expect(cadre(jouet, 'a', -12)).toEqual(cadre(jouet, 'a', 0));
    expect(cadre(jouet, 'a', 99)).toEqual(cadre(jouet, 'a', 2));
  });

  it('un graphe d’une seule pièce reste manipulable', () => {
    const seule: Graphe = { a: { id: 'a', nom: 'A', ouvertures: [] } };
    expect(profondeurMax(seule, 'a')).toBe(0);
    expect(cadre(seule, 'a', 3)).toEqual({ x: 0, y: 0, w: 1 });
  });
});

describe('la règle des proportions d’écran', () => {
  // Une ouverture ne porte QU'UNE largeur (modele.ts) : sa hauteur lui est
  // égale par construction. Ce test vérifie la conséquence qui compte —
  // l'ouverture rendue a le format de l'écran, quel que soit cet écran.
  const ecrans = [
    [1920, 1080],
    [1600, 900],
    [1024, 768],
    [390, 844],
    [3440, 1440],
  ] as const;

  for (const format of ['large', 'etroit'] as const) {
    it(`format « ${format} » : chaque ouverture a le format de l’écran`, () => {
      const graphe = grapheDe(format);
      for (const piece of Object.values(graphe)) {
        for (const o of piece.ouvertures) {
          for (const [L, H] of ecrans) {
            // Une ouverture mesure w × L de large et w × H de haut.
            expect((o.w * L) / (o.w * H)).toBeCloseTo(L / H, 12);
          }
        }
      }
    });
  }

  it('le cadre visé garde lui aussi le format de l’écran à toute profondeur', () => {
    for (let d = 0; d <= 3; d += 0.1) {
      const c = cadre(GRAPHE, RACINE, d);
      // Le cadre n'a qu'une largeur : la hauteur en découle, comme pour une
      // ouverture. On vérifie qu'il reste dans la pièce racine.
      expect(c.w).toBeGreaterThan(0);
      expect(c.x).toBeGreaterThanOrEqual(-1e-12);
      expect(c.y).toBeGreaterThanOrEqual(-1e-12);
      expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-12);
      expect(c.y + c.w).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});

describe('transformation de rendu', () => {
  // LE test de non-régression. La première version du projet écrivait
  // `translate(x%, y%) scale(1/w)` : bon grossissement, mais déplacement dans
  // le mauvais sens ET appliqué avant le grossissement. On restait devant la
  // vitre. Aucun test ne regardait le rendu, donc rien ne l'avait vu.
  it('amène les coins du cadre visé sur les coins de l’écran', () => {
    for (const d of [0, 0.37, 1, 1.5, 2, 2.99, 3]) {
      const c = cadre(GRAPHE, RACINE, d);
      const t = transformation(c);
      const hautGauche = projeter(t, c.x, c.y);
      const basDroite = projeter(t, c.x + c.w, c.y + c.w);
      expect(hautGauche.u).toBeCloseTo(0, 10);
      expect(hautGauche.v).toBeCloseTo(0, 10);
      expect(basDroite.u).toBeCloseTo(1, 10);
      expect(basDroite.v).toBeCloseTo(1, 10);
    }
  });

  it('recule (signe négatif) au lieu d’avancer', () => {
    const t = transformation(cadre(GRAPHE, RACINE, 1));
    expect(t.echelle).toBeGreaterThan(1);
    expect(t.dx).toBeLessThan(0); // l’ouverture est à droite : la scène recule
  });

  it('écrit le déplacement APRÈS le grossissement, pour qu’il soit multiplié', () => {
    const c = cadre(GRAPHE, RACINE, 2);
    const css = transformationCss(c);
    expect(css.indexOf('scale(')).toBeLessThan(css.indexOf('translate('));
    expect(css).toContain(`translate(${(-c.x * 100).toFixed(5)}%`);
  });
});

describe('profondeur ↔ largeur', () => {
  it('profondeurDe est l’inverse exacte de largeurA', () => {
    for (let d = 0; d <= 2; d += 0.05) {
      expect(profondeurDe(GRAPHE, RACINE, largeurA(GRAPHE, RACINE, d))).toBeCloseTo(d, 9);
    }
  });

  it('les largeurs décroissent strictement avec la profondeur', () => {
    const cadres = cadresEntiers(GRAPHE, RACINE);
    for (let k = 1; k < cadres.length; k++) {
      expect(cadres[k]!.w).toBeLessThan(cadres[k - 1]!.w);
    }
  });

  it('sature au lieu d’extrapoler hors des bornes', () => {
    expect(profondeurDe(GRAPHE, RACINE, 12)).toBe(0);
    expect(profondeurDe(GRAPHE, RACINE, 1e-9)).toBe(2);
  });
});

describe('zone d’une pièce ramenée à l’écran', () => {
  it('rend la pièce entière quand la caméra la cadre exactement', () => {
    // Caméra sur le cadre de « b » : une zone qui couvre toute la pièce doit
    // couvrir tout l'écran.
    const cadreB = cadresEntiers(jouet, 'a')[1]!;
    const plein = zoneEcran(jouet, 'a', 'b', cadreB, { x: 0, y: 0, w: 1 });
    expect(plein.x).toBeCloseTo(0, 9);
    expect(plein.y).toBeCloseTo(0, 9);
    expect(plein.w).toBeCloseTo(1, 9);
  });

  it('place un quart de pièce au bon endroit et à la bonne taille', () => {
    const cadreB = cadresEntiers(jouet, 'a')[1]!;
    const coin = zoneEcran(jouet, 'a', 'b', cadreB, { x: 0.5, y: 0.25, w: 0.5 });
    expect(coin.x).toBeCloseTo(0.5, 9);
    expect(coin.y).toBeCloseTo(0.25, 9);
    expect(coin.w).toBeCloseTo(0.5, 9);
  });

  it('rétrécit la zone quand la caméra recule', () => {
    // Vue depuis la racine : « b » n'occupe que la moitié de l'écran, donc
    // toute zone qu'elle contient rétrécit d'autant.
    const racine = cadresEntiers(jouet, 'a')[0]!;
    const vueDeLoin = zoneEcran(jouet, 'a', 'b', racine, { x: 0, y: 0, w: 1 });
    expect(vueDeLoin.w).toBeCloseTo(0.5, 9);
  });

  it('rend une zone nulle pour une pièce hors de l’axe de profondeur', () => {
    expect(
      zoneEcran(jouet, 'a', 'inconnue', cadresEntiers(jouet, 'a')[0]!, {
        x: 0,
        y: 0,
        w: 1,
      }),
    ).toEqual({ x: 0, y: 0, w: 0 });
  });
});

describe('une salle posée à part, comme un calque (23/09)', () => {
  /** Lit la transformation écrite par `transformationSalle`. */
  function lire(css: string): { u: number; v: number; s: number } {
    if (css === 'none') return { u: 0, v: 0, s: 1 };
    const m = /translate\(([-\d.e+]+)%, ([-\d.e+]+)%\) scale\(([-\d.e+]+)\)/.exec(css)!;
    return { u: Number(m[1]) / 100, v: Number(m[2]) / 100, s: Number(m[3]) };
  }

  for (const format of ['large', 'etroit'] as const) {
    const g = grapheDe(format);
    const salles = cadresEntiers(g, RACINE);

    it(`${format} : chaque point arrive exactement où l'amenait la scène emboîtée`, () => {
      // L'ancienne scène : un point (a, b) de la salle k passe en coordonnées
      // racine, puis la transformation de la caméra l'amène à l'écran.
      for (let d = 0; d <= 3; d += 0.037) {
        const camera = cadre(g, RACINE, d);
        const t = transformation(camera);
        salles.forEach((salle, k) => {
          const { u, v, s } = lire(transformationSalle(salle, camera));
          for (const [a, b] of [[0, 0], [1, 1], [0.3, 0.8], [0.5, 0.5]] as const) {
            const avant = projeter(t, salle.x + a * salle.w, salle.y + b * salle.w);
            const ecartU = Math.abs(u + s * a - avant.u);
            const ecartV = Math.abs(v + s * b - avant.v);
            // Relatif à l'échelle : une salle grossie ×3 000 a des
            // coordonnées d'écran énormes, et l'arrondi à 10 chiffres aussi.
            expect(ecartU / Math.max(1, Math.abs(avant.u))).toBeLessThan(1e-8);
            expect(ecartV / Math.max(1, Math.abs(avant.v))).toBeLessThan(1e-8);
          }
          void k;
        });
      }
    });

    it(`${format} : la salle où l'on est n'a AUCUNE transformation`, () => {
      // Grossissement 1, rien à arrondir : c'est tout l'objet du changement.
      salles.forEach((salle, k) => {
        expect(transformationSalle(salle, cadre(g, RACINE, k))).toBe('none');
      });
    });
  }
});
