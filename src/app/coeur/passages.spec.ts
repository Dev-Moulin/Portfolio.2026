import { describe, expect, it } from 'vitest';
import { calquesDeDescente, couvertureDescente } from './descente';
import { ETAGES_DESCENTE } from './descente-etages';
import { grapheDe, RACINE } from './contenu';
import { cadresEntiers } from './geometrie';
import { ARRIVEE, opaciteOuvertureInvisible } from './presentation';
import { ENTREE_HERMES, entreeHermes, PASSAGE_HERMES, PASSAGE_SEUIL, vueHermes } from './passages';
import {
  ETAGES_HERMES,
  FIN_ZOOM_HERMES,
  OUVERTURE_HERMES,
} from './transition-hermes-etages';

/** Les crans de zoom sont 00 à 13 ; les onze suivants sont à cadrage fixe. */
const NB_ZOOM = 13;

/** La largeur du cadre figé, en fraction de la salle 2 : le zoom total de la toile. */
const FIGE_RELATIF = () =>
  vueHermes(FIN_ZOOM_HERMES).w / cadresEntiers(grapheDe('large'), RACINE)[1]!.w;

describe('le passage du « H » ne change pas', () => {
  it('a exactement l’opacité de la descente d’origine, à toute profondeur', () => {
    for (let d = 0; d <= 2; d += 0.005) {
      const avant = couvertureDescente(d, ETAGES_DESCENTE) * (1 - opaciteOuvertureInvisible(d, 1));
      expect(PASSAGE_SEUIL.opacite(d)).toBe(avant);
    }
  });

  it('suit la caméra jusqu’au bout, par-dessus la scène', () => {
    expect(PASSAGE_SEUIL.vue).toBeNull();
    expect(PASSAGE_SEUIL.derriere).toBe(false);
  });
});

describe('la porte du temple : la toile', () => {
  it('reste invisible tant qu’on est dans la salle 2 ou au-dessus', () => {
    for (const d of [0, 0.5, 0.99, 1]) expect(PASSAGE_HERMES.opacite(d)).toBe(0);
  });

  it('remplace le décor du temple sur un fondu très court en partant', () => {
    expect(entreeHermes(1 + ENTREE_HERMES / 2)).toBeCloseTo(0.5);
    expect(PASSAGE_HERMES.opacite(1 + ENTREE_HERMES)).toBe(1);
  });

  it('reste entière dans la salle Hermès : son dernier étage en est le décor', () => {
    // Au flottant près : 2,2 − 2 ne vaut pas exactement 0,2.
    for (const d of [1.5, 1.9, 2, 2.2]) expect(PASSAGE_HERMES.opacite(d)).toBeCloseTo(1, 12);
  });

  it('s’efface en quittant la salle Hermès vers la suivante', () => {
    expect(PASSAGE_HERMES.opacite(2.55)).toBeCloseTo(0.5);
    expect(PASSAGE_HERMES.opacite(2.9)).toBeCloseTo(0, 12);
  });

  it('se pose derrière la scène, à la place du décor, avec sa propre caméra', () => {
    expect(PASSAGE_HERMES.derriere).toBe(true);
    expect(PASSAGE_HERMES.vue).toBe(vueHermes);
  });

  it('sa caméra part du temple entier et s’immobilise à la fin du zoom', () => {
    const salle2 = cadresEntiers(grapheDe('large'), RACINE)[1]!;
    expect(vueHermes(1)).toEqual(salle2);
    expect(vueHermes(0.5)).toEqual(salle2);
    expect(vueHermes(1.8)).toEqual(vueHermes(FIN_ZOOM_HERMES));
    expect(vueHermes(2.5)).toEqual(vueHermes(FIN_ZOOM_HERMES));
  });
});

describe('la porte du temple : la table engendrée', () => {
  it('part de la salle 2, et va jusqu’au visage avant que la salle Hermès n’arrive', () => {
    expect(ETAGES_HERMES.length).toBe(25);
    expect(ETAGES_HERMES[0]!.profondeur).toBe(1);
    expect(ETAGES_HERMES[NB_ZOOM]!.profondeur).toBeCloseTo(FIN_ZOOM_HERMES, 9);
    // Le texte de la salle ne se pose que sur l'image finale entière — sinon
    // il apparaîtrait sur un visage encore à moitié dessiné.
    expect(ETAGES_HERMES[ETAGES_HERMES.length - 1]!.profondeur).toBeLessThan(2 + ARRIVEE.debut);
  });

  it('est ordonnée, et ne recule jamais dans le zoom', () => {
    for (let i = 1; i < ETAGES_HERMES.length; i++) {
      expect(ETAGES_HERMES[i]!.profondeur).toBeGreaterThan(ETAGES_HERMES[i - 1]!.profondeur);
      expect(ETAGES_HERMES[i]!.cadre.w).toBeLessThanOrEqual(ETAGES_HERMES[i - 1]!.cadre.w);
    }
  });

  it('l’étage 00 est le temple entier : exactement la salle 2', () => {
    const salle2 = cadresEntiers(grapheDe('large'), RACINE)[1]!;
    expect(ETAGES_HERMES[0]!.cadre).toEqual(salle2);
  });

  it('les étages à cadrage fixe partagent tous le cadre où la vue se fige', () => {
    const fige = vueHermes(FIN_ZOOM_HERMES);
    for (const e of ETAGES_HERMES.slice(NB_ZOOM + 1)) expect(e.cadre).toEqual(fige);
  });

  it('chaque cran de zoom est posé exactement là où passe la caméra de la toile', () => {
    // Le fichier de l'étage i couvre la vue qu'avait la toile à l'étage i−1 :
    // c'est sa couronne. Si la table et la caméra divergeaient, un bord
    // apparaîtrait au début de chaque fondu.
    for (let i = 1; i <= NB_ZOOM; i++) {
      const vue = vueHermes(ETAGES_HERMES[i - 1]!.profondeur);
      const c = ETAGES_HERMES[i]!.cadre;
      expect((c.x - vue.x) / vue.w).toBeCloseTo(0, 9);
      expect((c.y - vue.y) / vue.w).toBeCloseTo(0, 9);
      expect(c.w / vue.w).toBeCloseTo(1, 9);
    }
  });

  it('le DOM zoome autour du même point que la toile : la porte', () => {
    // Deux caméras, deux vitesses, un seul point fixe — sinon les cartes de la
    // salle 2 s'envoleraient d'ailleurs que de la porte.
    const salle2 = cadresEntiers(grapheDe('large'), RACINE)[1]!;
    const w = FIGE_RELATIF();
    const point = {
      x: (vueHermes(FIN_ZOOM_HERMES).x - salle2.x) / salle2.w / (1 - w),
      y: (vueHermes(FIN_ZOOM_HERMES).y - salle2.y) / salle2.w / (1 - w),
    };
    expect(OUVERTURE_HERMES.x / (1 - OUVERTURE_HERMES.w)).toBeCloseTo(point.x, 9);
    expect(OUVERTURE_HERMES.y / (1 - OUVERTURE_HERMES.w)).toBeCloseTo(point.y, 9);
  });

  it('le DOM n’est jamais grossi au point de ne plus savoir se placer', () => {
    // Mesuré le 23/09 : à ×66 000, le navigateur plaçait la salle Hermès à
    // 500 pixels près. À ×3 000, l'erreur reste sous 30 pixels.
    const salleHermes = cadresEntiers(grapheDe('large'), RACINE)[2]!;
    expect(1 / salleHermes.w).toBeLessThan(5000);
  });

  it('la porte du temple reste invisible : les vignettes peuvent passer devant', () => {
    // Avant le 23/09, la porte était un élément de la page, et une porte
    // invisible posée sous une vignette en aurait volé les clics : elle devait
    // passer SOUS les vignettes. Depuis, une ouverture invisible n'existe plus
    // que dans le graphe (`pz-portes` les saute), et les vignettes ont pu
    // descendre sous le titre THP × INTUITION (25/09) en recouvrant les
    // marches. Ce qui protège les clics, c'est donc qu'elle reste invisible.
    const salle2 = grapheDe('large')['projets']!;
    expect(salle2.ouvertures.filter((o) => o.cible.genre === 'laterale').length).toBe(3);
    expect(salle2.ouvertures.find((o) => o.id === 'orchestrateur')?.invisible).toBe(true);
  });

  it('l’ouverture vers la salle Hermès est celle que la table a calculée', () => {
    const salle2 = grapheDe('large')['projets']!;
    const porte = salle2.ouvertures.find((o) => o.id === 'orchestrateur')!;
    expect({ x: porte.x, y: porte.y, w: porte.w }).toEqual(OUVERTURE_HERMES);
  });

  it('AUCUN étage visible ne laisse voir son bord, à aucune profondeur', () => {
    // Le même invariant que pour le « H », et pour la même raison : un étage
    // qu'on fond par-dessus un autre doit déjà couvrir tout l'écran, sinon on
    // voit son rectangle apparaître au milieu de l'image. Les images de Paul
    // n'ont aucune marge ; c'est la couronne composée par le script (chaque
    // étage posé sur le précédent) qui le garantit, et ce test la surveille.
    for (let d = 1; d <= 2.0001; d += 0.001) {
      const vue = vueHermes(d);
      for (const calque of calquesDeDescente(d, vue, ETAGES_HERMES)) {
        if (calque.opacite <= 0) continue;
        expect(calque.gauche).toBeLessThanOrEqual(0.001);
        expect(calque.haut).toBeLessThanOrEqual(0.001);
        expect(calque.gauche + calque.taille).toBeGreaterThanOrEqual(99.999);
        expect(calque.haut + calque.taille).toBeGreaterThanOrEqual(99.999);
      }
    }
  });

  it('pendant le zoom, deux étages voisins ne sont jamais plus d’un cran d’écart', () => {
    // La couronne d'un fichier est l'étage précédent : elle ne suffit que si
    // la caméra ne dépasse pas un cran pendant un fondu.
    for (let i = 2; i <= NB_ZOOM; i++) {
      const rapport = ETAGES_HERMES[i - 1]!.cadre.w / ETAGES_HERMES[i]!.cadre.w;
      expect(rapport).toBeLessThan(1.3);
    }
  });
});
