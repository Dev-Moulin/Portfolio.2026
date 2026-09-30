import { describe, expect, it } from 'vitest';
import {
  calquesHermesEtroits,
  vueCouverture,
  vueHermesEtroite,
} from './transition-hermes-etroite';
import {
  ETAGES_HERMES_ETROIT,
  FIN_ZOOM_HERMES_ETROIT,
  RAPPORT_HERMES_ETROIT,
} from './transition-hermes-mobile-etages';

const IPHONE = 390 / 844;
const TABLETTE = 820 / 1180;

describe('la porte du temple au téléphone', () => {
  it('part du temple entier, en cover : la hauteur pleine, centré', () => {
    const [temple] = calquesHermesEtroits(1, IPHONE);
    expect(temple!.image).toBe(ETAGES_HERMES_ETROIT[0]!.image);
    expect(temple!.opacite).toBe(1);
    expect(temple!.haut).toBeCloseTo(0);
    expect(temple!.hauteur).toBeCloseTo(100);
    expect(temple!.gauche).toBeLessThanOrEqual(0);
    expect(temple!.gauche + temple!.largeur).toBeGreaterThanOrEqual(100);
    expect(temple!.gauche + temple!.largeur / 2).toBeCloseTo(50);
  });

  it('garde les proportions de l’écran, et donc celles des images : rien n’est écrasé', () => {
    for (const rapport of [IPHONE, TABLETTE, 1.2]) {
      const v = vueCouverture(rapport);
      expect((v.w * RAPPORT_HERMES_ETROIT) / v.h).toBeCloseTo(rapport);
      const [c] = calquesHermesEtroits(1.3, rapport);
      // Un calque de largeur L % et hauteur H % de l'écran garde le rapport
      // des images une fois ramené en pixels.
      expect(((c!.largeur / 100) * rapport) / (c!.hauteur / 100)).toBeCloseTo(RAPPORT_HERMES_ETROIT);
    }
  });

  it('se fige à la fin du zoom, dans le cadre des étages fixes', () => {
    const fin = vueHermesEtroite(FIN_ZOOM_HERMES_ETROIT, IPHONE);
    expect(vueHermesEtroite(1.9, IPHONE)).toEqual(fin);
    const fige = ETAGES_HERMES_ETROIT[ETAGES_HERMES_ETROIT.length - 1]!.cadre;
    expect(fin.x).toBeGreaterThanOrEqual(fige.x - 1e-9);
    expect(fin.y).toBeGreaterThanOrEqual(fige.y - 1e-9);
    expect(fin.x + fin.w).toBeLessThanOrEqual(fige.x + fige.w + 1e-9);
    expect(fin.y + fin.h).toBeLessThanOrEqual(fige.y + fige.w + 1e-9);
  });

  it('aucun étage visible ne laisse voir son bord : il couvre toute la fenêtre', () => {
    for (let d = 1; d <= 2; d += 0.01) {
      for (const c of calquesHermesEtroits(d, IPHONE)) {
        if (c.opacite <= 0) continue;
        expect(c.gauche).toBeLessThanOrEqual(1e-6);
        expect(c.haut).toBeLessThanOrEqual(1e-6);
        expect(c.gauche + c.largeur).toBeGreaterThanOrEqual(100 - 1e-6);
        expect(c.haut + c.hauteur).toBeGreaterThanOrEqual(100 - 1e-6);
      }
    }
  });

  it('finit sur le visage entier, seul', () => {
    const visibles = calquesHermesEtroits(2, IPHONE).filter((c) => c.opacite > 0);
    expect(visibles.map((c) => c.image)).toEqual([
      ETAGES_HERMES_ETROIT[ETAGES_HERMES_ETROIT.length - 1]!.image,
    ]);
    expect(visibles[0]!.opacite).toBe(1);
  });
});
