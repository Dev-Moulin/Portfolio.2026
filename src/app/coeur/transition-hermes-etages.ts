// ENGENDRÉ par `scripts/transition-hermes.py` — ne pas éditer à la main.
//
// Le passage de la salle 2 (le temple) à la salle Hermès : treize crans de
// zoom vers la porte en haut des marches, puis, à cadrage fixe, le temple
// qui se dissout dans les nuages et le visage d'Hermès Agent qui s'y dessine.
// La matière vient de `art/transition-hermes-source/` — les images engendrées
// par Paul le 22/09. Le pourquoi de chaque nombre est dans l'en-tête du script.

import type { EtageDescente } from './modele';

/** La largeur à laquelle un étage montre sa zone : celle des images de Paul. */
export const LARGEUR_UTILE_HERMES = 1672;

/**
 * La profondeur où le zoom s'arrête. Au-delà, la vue de la toile est figée :
 * les étages suivants partagent tous le cadre du dernier cran.
 */
export const FIN_ZOOM_HERMES = 1.6;

/**
 * L'ouverture vers la salle Hermès, en fractions de la salle 2. Posée sur le
 * point fixe de la porte (0.5012 ; 0.7607), pour que le DOM zoome
 * autour du même point que la toile — mais pas à la même vitesse : voir
 * l'en-tête du script, « deux caméras, un seul point fixe ».
 */
export const OUVERTURE_HERMES = { x: 0.4260354573357853, y: 0.6466039850557788, w: 0.15 } as const;

export const ETAGES_HERMES: readonly EtageDescente[] = [
  {
    image: 'transition-hermes/etage-00.webp',
    profondeur: 1.0,
    cadre: { x: 0.113017, y: 0.657678, w: 0.002188 },
  },
  {
    image: 'transition-hermes/etage-01.webp',
    profondeur: 1.0448361387108334,
    cadre: { x: 0.113017, y: 0.657678, w: 0.002188 },
  },
  {
    image: 'transition-hermes/etage-02.webp',
    profondeur: 1.0912733183549934,
    cadre: { x: 0.11323633307780016, y: 0.6580108869457181, w: 0.0017504000000000013 },
  },
  {
    image: 'transition-hermes/etage-03.webp',
    profondeur: 1.1372315238175856,
    cadre: { x: 0.11341736990392094, y: 0.6582856507739299, w: 0.0013892063492063527 },
  },
  {
    image: 'transition-hermes/etage-04.webp',
    profondeur: 1.1838281081301774,
    cadre: { x: 0.11355973103332868, y: 0.6585017155920267, w: 0.0011051760932429234 },
  },
  {
    image: 'transition-hermes/etage-05.webp',
    profondeur: 1.230583970749976,
    cadre: { x: 0.11367438358434409, y: 0.6586757264521721, w: 0.0008764283055058886 },
  },
  {
    image: 'transition-hermes/etage-06.webp',
    profondeur: 1.277021150394136,
    cadre: { x: 0.11376558155012861, y: 0.6588141397393524, w: 0.000694475677896902 },
  },
  {
    image: 'transition-hermes/etage-07.webp',
    profondeur: 1.3231391408146673,
    cadre: { x: 0.11383740837402287, y: 0.6589231529911, w: 0.0005511711729340501 },
  },
  {
    image: 'transition-hermes/etage-08.webp',
    profondeur: 1.3695763204588274,
    cadre: { x: 0.11389406521811216, y: 0.6590091424094406, w: 0.0004381328878649054 },
  },
  {
    image: 'transition-hermes/etage-09.webp',
    profondeur: 1.4153746137967675,
    cadre: { x: 0.11393937953908918, y: 0.6590779170149795, w: 0.000347724514178497 },
  },
  {
    image: 'transition-hermes/etage-10.webp',
    profondeur: 1.4619711981093593,
    cadre: { x: 0.11397490276964442, y: 0.6591318314534226, w: 0.00027685072784912215 },
  },
  {
    image: 'transition-hermes/etage-11.webp',
    profondeur: 1.5088862128753164,
    cadre: { x: 0.11400362366072453, y: 0.6591754218220339, w: 0.00021954855499533912 },
  },
  {
    image: 'transition-hermes/etage-12.webp',
    profondeur: 1.5551638612891665,
    cadre: { x: 0.1140265381298747, y: 0.6592101996481815, w: 0.00017383100157984132 },
  },
  {
    image: 'transition-hermes/etage-13.webp',
    profondeur: 1.6,
    cadre: { x: 0.11404446184720089, y: 0.6592374028934761, w: 0.00013807069227946114 },
  },
  {
    image: 'transition-hermes/etage-14.webp',
    profondeur: 1.6331818181818183,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-15.webp',
    profondeur: 1.6663636363636365,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-16.webp',
    profondeur: 1.6995454545454547,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-17.webp',
    profondeur: 1.732727272727273,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-18.webp',
    profondeur: 1.765909090909091,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-19.webp',
    profondeur: 1.7990909090909093,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-20.webp',
    profondeur: 1.8322727272727273,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-21.webp',
    profondeur: 1.8654545454545455,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-22.webp',
    profondeur: 1.8986363636363637,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-23.webp',
    profondeur: 1.9318181818181819,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
  {
    image: 'transition-hermes/etage-24.webp',
    profondeur: 1.965,
    cadre: { x: 0.11405830255556088, y: 0.6592584092604991, w: 0.00011045655382356901 },
  },
];
