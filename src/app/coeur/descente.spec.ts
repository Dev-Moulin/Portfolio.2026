import { describe, expect, it } from 'vitest';
import { calquesDeDescente, couvertureDescente, poseDuCalque } from './descente';
import { ETAGES_DESCENTE, MARGE_ETAGE } from './descente-etages';
import { grapheDe, RACINE } from './contenu';
import { cadre } from './geometrie';
import { ARRIVEE } from './presentation';
import type { Cadre, EtageDescente } from './modele';

const VUE: Cadre = { x: 0.2, y: 0.4, w: 0.1 };

/** Une pyramide minuscule et ronde, pour raisonner sans sortir la calculette. */
const ETAGES: readonly EtageDescente[] = [
  { image: 'a.jpg', profondeur: 0.3, cadre: { x: 0, y: 0, w: 0.4 } },
  { image: 'b.jpg', profondeur: 0.4, cadre: { x: 0, y: 0, w: 0.2 } },
  { image: 'c.jpg', profondeur: 0.5, cadre: { x: 0, y: 0, w: 0.1 } },
];

describe('poser un étage sur la vue', () => {
  it('un étage qui est exactement la vue remplit l’écran', () => {
    expect(poseDuCalque(VUE, VUE)).toEqual({ gauche: 0, haut: 0, taille: 100 });
  });

  it('un étage deux fois plus large déborde de moitié de chaque côté', () => {
    const image: Cadre = { x: 0.15, y: 0.35, w: 0.2 };
    const pose = poseDuCalque(image, VUE);
    expect(pose.taille).toBeCloseTo(200);
    expect(pose.gauche).toBeCloseTo(-50);
    expect(pose.haut).toBeCloseTo(-50);
  });

  it('la position verticale se rapporte à la largeur de la vue, pas à autre chose', () => {
    // Le cadre a les proportions de l'écran : son étendue verticale EST `w`.
    // Un étage décalé d'un demi-cadre vers le bas doit sortir de 50 %.
    const image: Cadre = { x: 0.2, y: 0.45, w: 0.1 };
    expect(poseDuCalque(image, VUE).haut).toBeCloseTo(50);
  });
});

describe('la couverture de la photo par la pyramide', () => {
  it('vaut 0 tant que la descente n’a pas commencé', () => {
    expect(couvertureDescente(0, ETAGES)).toBe(0);
    expect(couvertureDescente(0.15, ETAGES)).toBe(0);
    // Pile au démarrage du fondu : zéro, à l'erreur de virgule flottante près.
    expect(couvertureDescente(0.2, ETAGES)).toBeCloseTo(0);
  });

  it('monte sur un cran, et vaut 1 au premier étage', () => {
    expect(couvertureDescente(0.25, ETAGES)).toBeCloseTo(0.5);
    expect(couvertureDescente(0.3, ETAGES)).toBe(1);
    expect(couvertureDescente(0.9, ETAGES)).toBe(1);
  });

  it('ne sort jamais de [0, 1], et vaut 0 sans pyramide', () => {
    expect(couvertureDescente(0.4, [])).toBe(0);
    for (let d = -1; d <= 2; d += 0.05) {
      const c = couvertureDescente(d, ETAGES);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe('choisir les étages à afficher', () => {
  it('à la profondeur exacte d’un étage, lui seul est visible', () => {
    const calques = calquesDeDescente(0.4, VUE, ETAGES);
    const visibles = calques.filter((c) => c.opacite > 0);
    expect(visibles).toHaveLength(1);
    expect(visibles[0]!.etage.image).toBe('b.jpg');
    expect(visibles[0]!.opacite).toBe(1);
  });

  it('à mi-chemin, le suivant se fond par-dessus', () => {
    const calques = calquesDeDescente(0.45, VUE, ETAGES);
    const b = calques.find((c) => c.etage.image === 'b.jpg')!;
    const c = calques.find((cc) => cc.etage.image === 'c.jpg')!;
    expect(b.opacite).toBe(1);
    expect(c.opacite).toBeCloseTo(0.5);
  });

  it('garde les voisins dans le DOM à opacité nulle, pour qu’ils soient déjà chargés', () => {
    const calques = calquesDeDescente(0.42, VUE, ETAGES);
    expect(calques.map((c) => c.etage.image)).toContain('a.jpg');
    expect(calques.find((c) => c.etage.image === 'a.jpg')!.opacite).toBe(0);
  });

  it('la fenêtre est symétrique : autant d’avance en remontant qu’en descendant', () => {
    // Sinon le retour saccade là où l'aller passe bien, parce qu'un étage
    // n'est mis dans le DOM qu'au moment où il faut l'afficher.
    const grande = Array.from({ length: 9 }, (_, i) => ({
      image: `e${i}.jpg`,
      profondeur: 0.1 * i,
      cadre: { x: 0, y: 0, w: 0.5 / (i + 1) },
    }));
    const indices = calquesDeDescente(0.42, VUE, grande).map((c) =>
      grande.findIndex((e) => e.image === c.etage.image),
    );
    const bas = 4; // profondeur 0,4
    expect(Math.min(...indices)).toBe(bas - 2);
    expect(Math.max(...indices)).toBe(bas + 2);
  });

  it('au fond, le dernier étage reste seul et entier', () => {
    const calques = calquesDeDescente(0.9, VUE, ETAGES);
    const visibles = calques.filter((c) => c.opacite > 0);
    expect(visibles).toHaveLength(1);
    expect(visibles[0]!.etage.image).toBe('c.jpg');
    expect(visibles[0]!.opacite).toBe(1);
  });

  it('sans pyramide, aucun calque — et jamais d’exception', () => {
    expect(calquesDeDescente(0.5, VUE, [])).toEqual([]);
  });

  it('aucune opacité hors de [0, 1], à aucune profondeur', () => {
    for (let d = -0.5; d <= 1.5; d += 0.01) {
      for (const c of calquesDeDescente(d, VUE, ETAGES)) {
        expect(c.opacite).toBeGreaterThanOrEqual(0);
        expect(c.opacite).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('la pyramide réellement engendrée', () => {
  it('existe, et va du premier étage jusqu’à l’ouverture', () => {
    expect(ETAGES_DESCENTE.length).toBeGreaterThan(5);
    expect(ETAGES_DESCENTE[ETAGES_DESCENTE.length - 1]!.profondeur).toBeCloseTo(1);
  });

  it('est ordonnée, et chaque étage est plus zoomé que le précédent', () => {
    for (let i = 1; i < ETAGES_DESCENTE.length; i++) {
      const avant = ETAGES_DESCENTE[i - 1]!;
      const apres = ETAGES_DESCENTE[i]!;
      expect(apres.profondeur).toBeGreaterThan(avant.profondeur);
      expect(apres.cadre.w).toBeLessThan(avant.cadre.w);
    }
  });

  it('chaque étage tient dans la colonne photo — sinon il montrerait du texte', () => {
    for (const e of ETAGES_DESCENTE) {
      expect(e.cadre.x).toBeGreaterThanOrEqual(0);
      expect(e.cadre.x + e.cadre.w).toBeLessThanOrEqual(0.32);
      expect(e.cadre.y).toBeGreaterThanOrEqual(0);
      expect(e.cadre.y + e.cadre.w).toBeLessThanOrEqual(1);
    }
  });

  it('AUCUN étage visible ne laisse voir son bord, à aucune profondeur', () => {
    // L'invariant qui tient toute la descente. Un calque qu'on fond par-dessus
    // un autre doit déjà couvrir tout l'écran, sinon on aperçoit ses bords —
    // un rectangle plus clair au milieu de l'image, exactement ce qu'on a vu
    // à la première version de la pyramide. C'est la marge des fichiers (×1,3,
    // supérieure à l'espacement ×1,25) qui le garantit ; ce test la surveille.
    const graphe = grapheDe('large');
    const debut = ETAGES_DESCENTE[0]!.profondeur;
    for (let d = debut; d <= 1.0001; d += 0.002) {
      const vue = cadre(graphe, RACINE, Math.min(d, 1));
      for (const calque of calquesDeDescente(d, vue, ETAGES_DESCENTE)) {
        if (calque.opacite <= 0) continue;
        expect(calque.gauche).toBeLessThanOrEqual(0.001);
        expect(calque.haut).toBeLessThanOrEqual(0.001);
        expect(calque.gauche + calque.taille).toBeGreaterThanOrEqual(99.999);
        expect(calque.haut + calque.taille).toBeGreaterThanOrEqual(99.999);
      }
    }
  });

  it('la salle 2 n’apparaît qu’une fois le dernier étage entièrement en place', () => {
    // Sinon on ne voit jamais le noir. La descente vise le noir du « H »
    // précisément pour arriver sur un écran noir d'un bord à l'autre ; si le
    // fondu de la salle commençait plus tôt, elle se poserait sur une lettre
    // encore blanche et noire — le défaut que Paul a nommé « la dernière
    // image contient du blanc un peu partout ».
    //
    // 0,975 est MESURÉ, pas déduit : c'est la profondeur à laquelle le
    // dernier pixel blanc quitte l'écran, lue sur le rendu simulé
    // (`python3 scripts/apercu-descente.py --mesurer`). Aucun raisonnement sur
    // le code ne donne ce nombre — il dépend de l'image, donc il est refait à
    // la main chaque fois que la pyramide change. Ce test est là pour que
    // personne ne déplace `ARRIVEE` sans refaire la mesure.
    expect(1 + ARRIVEE.debut).toBeGreaterThanOrEqual(0.975);
    // Et pour que personne ne l'élargisse par le début, ce qui reviendrait au
    // même : la fenêtre de révélation doit rester courte.
    expect(ARRIVEE.fin - ARRIVEE.debut).toBeLessThanOrEqual(0.05);
  });

  it('deux étages voisins sont espacés de moins que leur marge', () => {
    // La condition qui rend l'invariant précédent atteignable : si l'écart
    // entre deux étages dépassait la marge, l'étage entrant serait plus petit
    // que l'écran au moment où il commence à apparaître, quoi qu'on fasse.
    //
    // La marge est LUE et non écrite en dur : elle valait 1,3 quand les étages
    // étaient espacés de 1,25, elle vaut 1,56 depuis qu'ils le sont de 1,5.
    // Un nombre recopié ici aurait fait échouer ce test pour la mauvaise
    // raison — la pyramide a changé, pas l'invariant.
    for (let i = 1; i < ETAGES_DESCENTE.length; i++) {
      const rapport = ETAGES_DESCENTE[i - 1]!.cadre.w / ETAGES_DESCENTE[i]!.cadre.w;
      expect(rapport).toBeLessThanOrEqual(MARGE_ETAGE + 1e-9);
    }
  });
});
