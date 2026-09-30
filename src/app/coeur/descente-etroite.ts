// LE PLONGEON DANS LE « H », AU TÉLÉPHONE (Paul, 28/09). Module pur.
//
// Au bureau, la photo et la carte sont côte à côte, et la caméra plonge dans
// le t-shirt, dans la colonne de gauche. Au téléphone, on ne voit qu'un
// morceau à la fois : la photo plein écran (l'accueil), puis la carte. En
// partant vers la salle 2, on revient sur la photo, puis on plonge — avec les
// MÊMES étages que le bureau, simplement vus par une fenêtre verticale.
//
// L'ESPACE DES ÉTAGES. Les étages ont été fabriqués sur un écran de référence
// de 1440 × 900 (`scripts/pyramide-descente.py`) : dans leur repère, `x` et
// `w` sont des fractions de sa largeur, `y` une fraction de sa hauteur, et un
// cadre de côté `w` couvre `w` en largeur ET `w` en hauteur — un rectangle aux
// proportions 1,6. Au bureau, ce repère est l'écran lui-même. Au téléphone,
// c'est un espace où l'on promène une fenêtre haute et étroite : sa hauteur,
// en fractions, vaut sa largeur × 1,6 × (hauteur ÷ largeur de l'écran).
//
// LE PREMIER ÉTAGE EST LA PHOTO. Posée exactement comme le script la pose
// (hauteur pleine, recadrée au centre de la colonne de 32 %), elle fait le
// raccord avec l'écran d'accueil — où la même photo est affichée en
// `object-fit: cover` — puis la pyramide se fond par-dessus, comme au bureau.

import { calquesDeDescente, couvertureDescente } from './descente';
import { MARGE_ETAGE } from './descente-etages';
import type { EtageDescente } from './modele';

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Les proportions du repère des étages : l'écran de référence, 1440 × 900. */
export const RAPPORT_ETAGES = 1440 / 900;

/** Un rectangle du repère des étages : `x`, `w` en largeur ; `y`, `h` en hauteur. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * La photo du seuil dans le repère des étages. Comme `seuil.css` et le script
 * la posent au bureau : hauteur pleine, 2508 × 2732 réduits à 900 px de haut
 * (826 px de large), centrés sur la colonne de 32 %.
 */
export const PHOTO_SEUIL = {
  image: 'paul-portrait.webp',
  rect: { x: 0.16 - 826.2 / 1440 / 2, y: 0, w: 826.2 / 1440, h: 1 } satisfies Rect,
} as const;

/** Un calque prêt à dessiner, en POURCENTAGE de la toile dans chaque sens. */
export interface CalqueEtroit {
  readonly image: string;
  readonly gauche: number;
  readonly haut: number;
  readonly largeur: number;
  readonly hauteur: number;
  readonly opacite: number;
}

/**
 * La fenêtre de l'accueil : la photo en `object-fit: cover` sur un écran de
 * proportions `largeur / hauteur`, centrée — exactement ce que montre
 * `.seuil__photo` au téléphone.
 */
export function vueAccueil(rapportEcran: number): Rect {
  const p = PHOTO_SEUIL.rect;
  const rapportPhoto = (p.w * RAPPORT_ETAGES) / p.h;
  if (rapportEcran <= rapportPhoto) {
    const w = (p.h * rapportEcran) / RAPPORT_ETAGES;
    return { x: p.x + (p.w - w) / 2, y: p.y, w, h: p.h };
  }
  const h = (p.w * RAPPORT_ETAGES) / rapportEcran;
  return { x: p.x, y: p.y + (p.h - h) / 2, w: p.w, h };
}

/** Le cadre d'un étage, rectangle plein du repère (il est carré en fractions). */
const rectDe = (e: EtageDescente): Rect => ({ x: e.cadre.x, y: e.cadre.y, w: e.cadre.w, h: e.cadre.w });

/**
 * La fenêtre d'arrivée : DANS le noir du « H », le centre du dernier étage,
 * à 90 % de la zone qu'il montre en hauteur.
 */
export function vueArrivee(rapportEcran: number, etages: readonly EtageDescente[]): Rect {
  const dernier = etages[etages.length - 1]!;
  const cx = dernier.cadre.x + dernier.cadre.w / 2;
  const cy = dernier.cadre.y + dernier.cadre.w / 2;
  const h = (0.9 * dernier.cadre.w) / MARGE_ETAGE;
  const w = (h * rapportEcran) / RAPPORT_ETAGES;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Où en est le plongeon, de 0 (l'accueil) à 1 (le noir du « H »), pour une
 * profondeur donnée. Il finit un peu avant la salle 2 : au bureau aussi,
 * l'écran est noir d'un bord à l'autre dès 0,975.
 */
export function avancementPlongeon(profondeur: number): number {
  return borner(profondeur / 0.975, 0, 1);
}

/**
 * La fenêtre à l'avancement `s`. Le zoom est géométrique (chaque instant
 * grossit du même facteur), et le « H » glisse doucement de sa place sur la
 * photo jusqu'au centre de l'écran.
 */
export function vuePlongeon(s: number, rapportEcran: number, etages: readonly EtageDescente[]): Rect {
  const a = vueAccueil(rapportEcran);
  const b = vueArrivee(rapportEcran, etages);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  // La place du « H » dans la fenêtre d'accueil, en fraction de la fenêtre.
  const u0 = (cx - a.x) / a.w;
  const v0 = (cy - a.y) / a.h;
  const u = u0 + (0.5 - u0) * s;
  const v = v0 + (0.5 - v0) * s;
  const h = a.h * Math.pow(b.h / a.h, s);
  const w = (h * rapportEcran) / RAPPORT_ETAGES;
  return { x: cx - u * w, y: cy - v * h, w, h };
}

/**
 * La profondeur « du bureau » qui correspond à une fenêtre de hauteur `h` :
 * celle où la caméra du bureau montre la même zone. C'est elle qui choisit
 * les étages et leurs fondus — le téléphone passe ainsi d'un étage au suivant
 * au même grossissement que le bureau, donc avec la même netteté.
 */
export function profondeurEquivalente(h: number, etages: readonly EtageDescente[]): number {
  const z = (e: EtageDescente) => Math.log(e.cadre.w / MARGE_ETAGE);
  const lh = Math.log(h);
  const pente = (etages[1]!.profondeur - etages[0]!.profondeur) / (z(etages[1]!) - z(etages[0]!));
  if (lh >= z(etages[0]!)) return etages[0]!.profondeur + (lh - z(etages[0]!)) * pente;
  for (let i = 0; i + 1 < etages.length; i++) {
    const a = etages[i]!;
    const b = etages[i + 1]!;
    if (lh <= z(a) && lh >= z(b)) {
      return a.profondeur + ((lh - z(a)) / (z(b) - z(a))) * (b.profondeur - a.profondeur);
    }
  }
  const der = etages[etages.length - 1]!;
  return der.profondeur + (lh - z(der)) * pente;
}

const poser = (r: Rect, vue: Rect) => ({
  gauche: ((r.x - vue.x) / vue.w) * 100,
  haut: ((r.y - vue.y) / vue.h) * 100,
  largeur: (r.w / vue.w) * 100,
  hauteur: (r.h / vue.h) * 100,
});

/**
 * Les calques du plongeon au téléphone : la photo dessous, toujours pleine,
 * puis les étages avec les fondus du bureau — le premier se posant sur la
 * photo sur un cran de pyramide, comme au bureau.
 */
export function calquesEtroits(
  profondeur: number,
  rapportEcran: number,
  etages: readonly EtageDescente[],
): readonly CalqueEtroit[] {
  if (etages.length < 2) return [];
  const vue = vuePlongeon(avancementPlongeon(profondeur), rapportEcran, etages);
  const p = profondeurEquivalente(vue.h, etages);
  const couverture = couvertureDescente(p, etages);
  const calques: CalqueEtroit[] = [
    { image: PHOTO_SEUIL.image, opacite: 1, ...poser(PHOTO_SEUIL.rect, vue) },
  ];
  for (const c of calquesDeDescente(p, etages[0]!.cadre, etages)) {
    const premier = c.etage === etages[0];
    calques.push({
      image: c.etage.image,
      opacite: premier ? c.opacite * couverture : c.opacite,
      ...poser(rectDe(c.etage), vue),
    });
  }
  return calques;
}
