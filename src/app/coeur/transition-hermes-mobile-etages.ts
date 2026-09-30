// ENGENDRÉ par `scripts/transition-hermes-mobile.py` — ne pas éditer à la main.
//
// Le passage vers la salle Hermès au téléphone : huit crans de zoom vers le
// haut des marches, puis, à cadrage fixe, le temple qui se dissout dans les
// nuages et le visage d'Hermès Agent qui s'y dessine. Les cadres sont en
// fractions de l'image d'origine (941 × 1672) : voir l'en-tête du script.

import type { EtageDescente } from './modele';

/** La largeur à laquelle un étage montre sa zone : celle des images. */
export const LARGEUR_UTILE_HERMES_ETROIT = 941;

/** Les proportions des images (largeur ÷ hauteur). */
export const RAPPORT_HERMES_ETROIT = 941 / 1672;

/** Le point fixe du zoom, en fractions de l'image d'origine. */
export const POINT_HERMES_ETROIT = { x: 0.5063381659326985, y: 0.7328870690418677 } as const;

/** La profondeur où le zoom s'arrête ; au-delà, la vue est figée. */
export const FIN_ZOOM_HERMES_ETROIT = 1.6;

export const ETAGES_HERMES_ETROIT: readonly EtageDescente[] = [
  {
    image: 'transition-hermes-mobile/etage-00.webp',
    profondeur: 1.0,
    cadre: { x: 0.0, y: 0.0, w: 1.0 },
  },
  {
    image: 'transition-hermes-mobile/etage-01.webp',
    profondeur: 1.0752044381013668,
    cadre: { x: 0.0, y: 0.0, w: 1.0 },
  },
  {
    image: 'transition-hermes-mobile/etage-02.webp',
    profondeur: 1.1501367650522931,
    cadre: { x: 0.10061848169175379, y: 0.145637815001909, w: 0.8012820512820521 },
  },
  {
    image: 'transition-hermes-mobile/etage-03.webp',
    profondeur: 1.2256130963536163,
    cadre: { x: 0.18098156269216512, y: 0.2619574346874497, w: 0.6425678037546535 },
  },
  {
    image: 'transition-hermes-mobile/etage-04.webp',
    profondeur: 1.3008175344549833,
    cadre: { x: 0.24584448839824394, y: 0.355841725283326, w: 0.5144658156562484 },
  },
  {
    image: 'transition-hermes-mobile/etage-05.webp',
    profondeur: 1.375204983853933,
    cadre: { x: 0.29760925765188534, y: 0.43076740256867696, w: 0.41223222408353277 },
  },
  {
    image: 'transition-hermes-mobile/etage-06.webp',
    profondeur: 1.4501373108048594,
    cadre: { x: 0.33868442434168383, y: 0.49022067026822036, w: 0.33111022014741615 },
  },
  {
    image: 'transition-hermes-mobile/etage-07.webp',
    profondeur: 1.5242519931003442,
    cadre: { x: 0.3718925030690138, y: 0.5382869096403861, w: 0.2655254371671343 },
  },
  {
    image: 'transition-hermes-mobile/etage-08.webp',
    profondeur: 1.6,
    cadre: { x: 0.39826287424163354, y: 0.5764560727384258, w: 0.21344488518258398 },
  },
  {
    image: 'transition-hermes-mobile/etage-09.webp',
    profondeur: 1.6304166666666668,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-10.webp',
    profondeur: 1.6608333333333334,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-11.webp',
    profondeur: 1.6912500000000001,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-12.webp',
    profondeur: 1.7216666666666667,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-13.webp',
    profondeur: 1.7520833333333334,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-14.webp',
    profondeur: 1.7825000000000002,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-15.webp',
    profondeur: 1.8129166666666667,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-16.webp',
    profondeur: 1.8433333333333335,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-17.webp',
    profondeur: 1.87375,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-18.webp',
    profondeur: 1.9041666666666668,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-19.webp',
    profondeur: 1.9345833333333333,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
  {
    image: 'transition-hermes-mobile/etage-20.webp',
    profondeur: 1.965,
    cadre: { x: 0.4198779325798464, y: 0.607742271999114, w: 0.1707559081460674 },
  },
];
