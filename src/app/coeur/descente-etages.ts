// ENGENDRÉ par `scripts/pyramide-descente.py` — ne pas éditer à la main.
//
// Les étages de la descente dans le NOIR du « H » de THP. Chaque étage
// est une image de la même descente, prise à un grossissement 1.5 fois
// plus fort que le précédent, et `cadre` dit quelle part de la pièce
// racine elle couvre. Le lecteur n'a donc rien à calculer : il pose
// l'image sur ce rectangle et fond d'un étage au suivant.
//
// La matière vient de `art/pyramide-source/` — les seize images
// engendrées par Paul le 07/09 — redécoupées sur la trajectoire qui
// vise désormais le noir du H, et prolongées de quelques étages.

import type { EtageDescente } from './modele';

/** La largeur, en pixels, de chaque fichier d'étage. */
export const LARGEUR_ETAGE = 1997;

/**
 * La largeur RÉELLEMENT vue à l'écran, marge déduite.
 *
 * Un fichier couvre `MARGE_ETAGE` fois sa zone : le reste déborde de
 * l'écran et n'est jamais vu. C'est donc CETTE largeur, et non celle du
 * fichier, qui plafonne la toile — au-delà, on remplit des pixels que
 * la source ne peut pas nourrir.
 */
export const LARGEUR_UTILE = 1280;

/** Ce qu'un fichier couvre, en multiples de sa zone nominale. */
export const MARGE_ETAGE = 1.56;

export const ETAGES_DESCENTE: readonly EtageDescente[] = [
  {
    image: 'descente/etage-00.webp',
    profondeur: 0.365925,
    cadre: { x: 0.09200976, y: 0.55080394, w: 0.16587471 },
  },
  {
    image: 'descente/etage-01.webp',
    profondeur: 0.432126,
    cadre: { x: 0.09909478, y: 0.58690935, w: 0.11058314 },
  },
  {
    image: 'descente/etage-02.webp',
    profondeur: 0.498327,
    cadre: { x: 0.10381813, y: 0.61097962, w: 0.07372209 },
  },
  {
    image: 'descente/etage-03.webp',
    profondeur: 0.564528,
    cadre: { x: 0.10696703, y: 0.62702646, w: 0.04914806 },
  },
  {
    image: 'descente/etage-04.webp',
    profondeur: 0.630729,
    cadre: { x: 0.10906629, y: 0.63772436, w: 0.03276538 },
  },
  {
    image: 'descente/etage-05.webp',
    profondeur: 0.69693,
    cadre: { x: 0.1104658, y: 0.64485629, w: 0.02184358 },
  },
  {
    image: 'descente/etage-06.webp',
    profondeur: 0.763131,
    cadre: { x: 0.11139881, y: 0.64961091, w: 0.01456239 },
  },
  {
    image: 'descente/etage-07.webp',
    profondeur: 0.829332,
    cadre: { x: 0.11202081, y: 0.65278066, w: 0.00970826 },
  },
  {
    image: 'descente/etage-08.webp',
    profondeur: 0.895533,
    cadre: { x: 0.11243548, y: 0.65489383, w: 0.00647217 },
  },
  {
    image: 'descente/etage-09.webp',
    profondeur: 0.961734,
    cadre: { x: 0.11271193, y: 0.6563026, w: 0.00431478 },
  },
  {
    image: 'descente/etage-10.webp',
    profondeur: 1.0,
    cadre: { x: 0.11289623, y: 0.65724179, w: 0.00287652 },
  },
];
