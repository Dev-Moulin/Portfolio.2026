import { describe, expect, it } from 'vitest';
import {
  PHOTO_SEUIL,
  calquesEtroits,
  vueAccueil,
  vueArrivee,
  vuePlongeon,
} from './descente-etroite';
import { ETAGES_DESCENTE } from './descente-etages';
import { attenteAuDepart } from './choregraphie';

const IPHONE = 375 / 640;

describe('le plongeon au téléphone', () => {
  it('part exactement de la photo de l’accueil : la toile la recouvre bord à bord', () => {
    const [photo] = calquesEtroits(1e-6, IPHONE, ETAGES_DESCENTE);
    expect(photo!.image).toBe(PHOTO_SEUIL.image);
    // La photo déborde à gauche et à droite (cover), et remplit la hauteur.
    expect(photo!.haut).toBeCloseTo(0);
    expect(photo!.hauteur).toBeCloseTo(100);
    expect(photo!.gauche).toBeLessThanOrEqual(0);
    expect(photo!.gauche + photo!.largeur).toBeGreaterThanOrEqual(100);
    expect(photo!.gauche + photo!.largeur / 2).toBeCloseTo(50);
  });

  it('garde les proportions des étages : rien n’est écrasé', () => {
    const vue = vueAccueil(IPHONE);
    // Largeur ÷ hauteur de la fenêtre, en pixels : celles de l'écran.
    expect(((vue.w * 1440) / (vue.h * 900))).toBeCloseTo(IPHONE);
  });

  it('finit dans le noir du « H », entièrement couvert par le dernier étage', () => {
    const fin = vuePlongeon(1, IPHONE, ETAGES_DESCENTE);
    const der = ETAGES_DESCENTE[ETAGES_DESCENTE.length - 1]!.cadre;
    expect(fin).toEqual(vueArrivee(IPHONE, ETAGES_DESCENTE));
    expect(fin.x).toBeGreaterThanOrEqual(der.x);
    expect(fin.y).toBeGreaterThanOrEqual(der.y);
    expect(fin.x + fin.w).toBeLessThanOrEqual(der.x + der.w);
    expect(fin.y + fin.h).toBeLessThanOrEqual(der.y + der.w);
  });

  it('zoome sans jamais reculer', () => {
    let avant = Infinity;
    for (let s = 0; s <= 1; s += 0.02) {
      const h = vuePlongeon(s, IPHONE, ETAGES_DESCENTE).h;
      expect(h).toBeLessThan(avant);
      avant = h;
    }
  });

  it('au téléphone seulement, le seuil repasse par la photo avant de plonger', () => {
    expect(attenteAuDepart('seuil', 2, 'etroit')).toBeGreaterThan(0);
    expect(attenteAuDepart('seuil', 1, 'large')).toBe(0);
    expect(attenteAuDepart('projets', 1, 'etroit')).toBe(attenteAuDepart('projets', 1, 'large'));
  });
});
