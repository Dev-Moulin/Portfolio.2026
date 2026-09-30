// LA PORTE DU TEMPLE, AU TÉLÉPHONE (Paul, 29/09). Module pur.
//
// Au bureau, la toile de la porte zoome dans des images paysage exprimées
// dans la pièce racine (`passages.ts`). Au téléphone, elle a ses PROPRES
// images, en portrait (`scripts/transition-hermes-mobile.py`) : un temple
// vertical, huit crans de zoom vers le haut des marches, puis la brume et le
// visage d'Hermès à cadrage fixe.
//
// LE REPÈRE EST L'IMAGE D'ORIGINE. Un cadre d'étage y est en fractions de
// l'image (x, w en largeur ; y en hauteur), et couvre w dans les deux sens
// puisque tous les étages ont ses proportions. La fenêtre, elle, a celles de
// l'écran : elle montre l'image en `object-fit: cover`, centrée, puis zoome
// autour du point fixe — la porte — jusqu'au cadre du dernier cran, où elle
// se fige pendant que la brume et le visage se fondent sur place.

import { calquesDeDescente } from './descente';
import type { CalqueEtroit, Rect } from './descente-etroite';
import type { EtageDescente } from './modele';
import {
  ETAGES_HERMES_ETROIT,
  FIN_ZOOM_HERMES_ETROIT,
  POINT_HERMES_ETROIT,
  RAPPORT_HERMES_ETROIT,
} from './transition-hermes-mobile-etages';

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** La salle 2, dans le chemin de profondeur : là où le passage commence. */
const SALLE2 = 1;

/**
 * L'image d'origine en `object-fit: cover` sur un écran de proportions
 * `rapportEcran` (largeur ÷ hauteur), centrée.
 */
export function vueCouverture(rapportEcran: number): Rect {
  if (rapportEcran <= RAPPORT_HERMES_ETROIT) {
    const w = rapportEcran / RAPPORT_HERMES_ETROIT;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = RAPPORT_HERMES_ETROIT / rapportEcran;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** Le cadre où la fenêtre se fige : celui des étages fixes. */
const FIGE = ETAGES_HERMES_ETROIT[ETAGES_HERMES_ETROIT.length - 1]!.cadre;

/**
 * La fenêtre à une profondeur donnée. Un zoom géométrique autour du point
 * fixe, du temple entier (salle 2) au grossissement du dernier cran (fin du
 * zoom), puis immobile. Comme tous les cadres d'étages sont centrés sur le
 * même point, la fenêtre de la fin tient dans chacun d'eux.
 */
export function vueHermesEtroite(profondeur: number, rapportEcran: number): Rect {
  const s = borner((profondeur - SALLE2) / (FIN_ZOOM_HERMES_ETROIT - SALLE2), 0, 1);
  const k = Math.pow(FIGE.w, s);
  const v = vueCouverture(rapportEcran);
  const p = POINT_HERMES_ETROIT;
  return { x: p.x + (v.x - p.x) * k, y: p.y + (v.y - p.y) * k, w: v.w * k, h: v.h * k };
}

const poser = (e: EtageDescente, vue: Rect) => ({
  gauche: ((e.cadre.x - vue.x) / vue.w) * 100,
  haut: ((e.cadre.y - vue.y) / vue.h) * 100,
  largeur: (e.cadre.w / vue.w) * 100,
  hauteur: (e.cadre.w / vue.h) * 100,
});

/**
 * Les calques du passage au téléphone : les étages avec les fondus de la
 * descente, posés dans la fenêtre. La profondeur choisit les étages
 * directement — la fenêtre et les étages suivent la même loi de zoom.
 */
export function calquesHermesEtroits(
  profondeur: number,
  rapportEcran: number,
): readonly CalqueEtroit[] {
  const vue = vueHermesEtroite(profondeur, rapportEcran);
  return calquesDeDescente(profondeur, FIGE, ETAGES_HERMES_ETROIT).map((c) => ({
    image: c.etage.image,
    opacite: c.opacite,
    ...poser(c.etage, vue),
  }));
}
