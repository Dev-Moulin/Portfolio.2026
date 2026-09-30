// Les passages pré-calculés entre deux salles : ce qui distingue l'un de
// l'autre, pour que la même toile (`composants/descente`) les joue tous.
// Module pur : l'opacité est une fonction de la profondeur, rien d'autre.
//
// DEUX PASSAGES, DEUX FAÇONS DE SE POSER.
//
// Le « H » de THP (seuil → salle 2) prolonge une PHOTO qui vit dans la scène :
// la toile se pose PAR-DESSUS la scène pour la recouvrir, et s'efface quand la
// salle 2 arrive, puisqu'elle la masquerait.
//
// La porte du temple (salle 2 → salle Hermès) prolonge un DÉCOR qui vit
// derrière la scène — la boucle vidéo du temple. La toile se pose donc
// DERRIÈRE la scène, à la place du décor : c'est le fond qui zoome, et les
// cartes de la salle 2 s'envolent par-dessus, comme n'importe quel contenu
// qu'on quitte. À l'arrivée, elle ne s'efface pas : son dernier étage — le
// visage d'Hermès dans les nuages — EST le décor de la salle Hermès, et le
// texte de la salle se pose dessus.
//
// ET ELLE A SA PROPRE CAMÉRA. Celle du « H » suit la caméra du site. Celle de
// la porte zoome ×20 vers la porte, quand la caméra du site ne zoome que ×6,7
// vers le même point : accorder les deux exigeait de grossir le DOM ×66 000,
// et à cette échelle le navigateur ne sait plus placer une boîte à 500 pixels
// près (mesuré le 23/09). L'histoire complète est dans l'en-tête de
// `scripts/transition-hermes.py`.

import { couvertureDescente } from './descente';
import { ETAGES_DESCENTE, LARGEUR_UTILE } from './descente-etages';
import { interpole } from './geometrie';
import { opaciteOuvertureInvisible } from './presentation';
import {
  ETAGES_HERMES,
  FIN_ZOOM_HERMES,
  LARGEUR_UTILE_HERMES,
} from './transition-hermes-etages';
import {
  ETAGES_HERMES_ETROIT,
  LARGEUR_UTILE_HERMES_ETROIT,
} from './transition-hermes-mobile-etages';
import { calquesHermesEtroits } from './transition-hermes-etroite';
import type { CalqueEtroit } from './descente-etroite';
import type { Cadre, EtageDescente } from './modele';

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export interface Passage {
  readonly etages: readonly EtageDescente[];
  /** La largeur qu'un étage montre à l'écran : au-delà, la toile ne gagne rien. */
  readonly largeurUtile: number;
  /**
   * La vue de la toile à une profondeur donnée, ou `null` pour suivre la
   * caméra du site. Une vue propre peut zoomer à un autre rythme que la
   * scène, et se figer pendant que la scène continue sa route.
   */
  readonly vue: ((profondeur: number) => Cadre) | null;
  /** Vrai : la toile se pose derrière la scène, à la place du décor. */
  readonly derriere: boolean;
  /** L'opacité de toute la toile, selon la profondeur affichée. */
  readonly opacite: (profondeur: number) => number;
  /**
   * Au téléphone : les calques, chacun avec sa largeur ET sa hauteur, pour
   * un écran de proportions `rapportEcran`. Absent : le passage n'a pas
   * d'images au format étroit, et la toile n'y peint rien.
   */
  readonly calquesEtroits?: (profondeur: number, rapportEcran: number) => readonly CalqueEtroit[];
}

/** La salle 2 et la salle Hermès, dans le chemin de profondeur. */
const SALLE2 = 1;
const SALLE_HERMES = 2;

/**
 * Le « H » de THP. Rien ne change par rapport à la descente d'origine : la
 * pyramide recouvre la photo sur un cran, et s'efface quand la salle 2 se
 * révèle.
 */
export const PASSAGE_SEUIL: Passage = {
  etages: ETAGES_DESCENTE,
  largeurUtile: LARGEUR_UTILE,
  vue: null,
  derriere: false,
  opacite: (d) => couvertureDescente(d, ETAGES_DESCENTE) * (1 - opaciteOuvertureInvisible(d, SALLE2)),
};

/**
 * Sur combien de profondeur la toile remplace la vidéo du temple, en sortant
 * de la salle 2.
 *
 * Court, parce que les deux ne bougent pas pareil : la vidéo est un décor
 * FIXE, la toile zoome déjà. Sur 0,012 de profondeur la caméra grossit de
 * 6 % : un fondu plus long ferait voir deux temples à deux échelles. Et il
 * se voit à peine de toute façon — l'étage 00 est l'image même dont la vidéo
 * a été tirée, seules la brume et les halos animés s'effacent.
 */
export const ENTREE_HERMES = 0.012;

/** Combien la toile du passage Hermès a remplacé le décor du temple, de 0 à 1. */
export function entreeHermes(profondeur: number): number {
  return borner((profondeur - SALLE2) / ENTREE_HERMES, 0, 1);
}

/** Le temple entier, et le cadre où la toile se fige : celui des étages fixes. */
const TEMPLE = ETAGES_HERMES[0]!.cadre;
const FIGE = ETAGES_HERMES[ETAGES_HERMES.length - 1]!.cadre;

/**
 * La vue de la toile de la porte : un zoom géométrique du temple entier
 * (profondeur 1) au cadre des étages fixes (fin du zoom), puis immobile.
 * L'interpolation est celle de la caméra du site — entre deux cadres
 * emboîtés, c'est un zoom autour d'un point fixe, ici la porte.
 */
export function vueHermes(profondeur: number): Cadre {
  return interpole(TEMPLE, FIGE, borner((profondeur - SALLE2) / (FIN_ZOOM_HERMES - SALLE2), 0, 1));
}

/**
 * La porte du temple. Entrée brève sur le décor, puis la toile reste : son
 * dernier étage est le décor de la salle Hermès. Elle ne s'efface qu'en
 * quittant cette salle vers la suivante, au rythme où s'efface son contenu
 * (`opaciteContenu`, côté disparition).
 */
export const PASSAGE_HERMES: Passage = {
  etages: ETAGES_HERMES,
  largeurUtile: LARGEUR_UTILE_HERMES,
  vue: vueHermes,
  derriere: true,
  opacite: (d) => entreeHermes(d) * borner((0.9 - (d - SALLE_HERMES)) / 0.7, 0, 1),
};

/**
 * La porte du temple au téléphone (Paul, 29/09) : les mêmes trois mouvements,
 * sur des images portrait, avec sa propre fenêtre (`transition-hermes-
 * etroite.ts`). Elle entre, reste et s'efface comme celle du bureau.
 */
export const PASSAGE_HERMES_ETROIT: Passage = {
  ...PASSAGE_HERMES,
  etages: ETAGES_HERMES_ETROIT,
  largeurUtile: LARGEUR_UTILE_HERMES_ETROIT,
  vue: null,
  calquesEtroits: calquesHermesEtroits,
};
