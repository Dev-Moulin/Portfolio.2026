// La descente pré-calculée : comment poser les étages et fondre de l'un à
// l'autre. Module pur, comme tout ce qui se calcule ici.
//
// LE PRINCIPE. La photo du seuil n'a pas assez de pixels pour supporter le
// grossissement ×168 qui mène au « H » de THP. Plutôt que de masquer ça par
// un fondu, on prépare à l'avance une pyramide d'images de la même descente,
// chacune 1,25 fois plus zoomée que la précédente. Le navigateur n'a donc
// jamais à agrandir de plus de 25 % avant que l'étage suivant prenne le
// relais — et comme deux étages voisins montrent la MÊME zone, le fondu de
// l'un à l'autre ne fait pas bouger l'image : il la rend nette.

import type { Cadre, EtageDescente } from './modele';

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Un étage prêt à poser : où, à quelle taille, à quelle opacité. */
export interface CalqueDescente {
  readonly etage: EtageDescente;
  /** Position et taille en POURCENTAGE de la vue, prêtes pour le style. */
  readonly gauche: number;
  readonly haut: number;
  readonly taille: number;
  readonly opacite: number;
}

/**
 * Où poser une image qui couvre `image`, quand la caméra cadre `vue`.
 *
 * Les deux rectangles ont les proportions de l'écran (règle du modèle : un
 * cadre n'a qu'une largeur), donc une seule taille suffit pour la largeur et
 * la hauteur — et la position verticale se rapporte à `vue.w` elle aussi,
 * puisque c'est l'étendue verticale de la vue en coordonnées racine.
 */
export function poseDuCalque(
  image: Cadre,
  vue: Cadre,
): { readonly gauche: number; readonly haut: number; readonly taille: number } {
  return {
    gauche: ((image.x - vue.x) / vue.w) * 100,
    haut: ((image.y - vue.y) / vue.w) * 100,
    taille: (image.w / vue.w) * 100,
  };
}

/**
 * Combien la pyramide recouvre la photo du DOM, entre 0 et 1.
 *
 * Le premier étage ne surgit pas : il se fond par-dessus la vraie photo sur
 * la largeur d'un cran de pyramide, exactement comme un étage se fond dans
 * le suivant. La photo du seuil s'efface d'autant — c'est au composant de
 * poser `1 - couverture` sur elle, sans quoi on verrait le flou par-dessus
 * le net.
 */
export function couvertureDescente(profondeur: number, etages: readonly EtageDescente[]): number {
  if (etages.length === 0) return 0;
  const pas = cranDeDepart(etages);
  const debut = etages[0]!.profondeur - pas;
  return borner((profondeur - debut) / pas, 0, 1);
}

function cranDeDepart(etages: readonly EtageDescente[]): number {
  if (etages.length < 2) return 0.05; // repli : une pyramide d'un seul étage
  return etages[1]!.profondeur - etages[0]!.profondeur;
}

/**
 * Les étages à poser à une profondeur donnée, avec leur opacité.
 *
 * On en rend CINQ et pas deux : les deux qui se fondent, plus deux avant et
 * un après, à opacité nulle. Ce n'est pas du gaspillage — c'est ce qui met
 * leur image dans le DOM avant qu'on en ait besoin, donc ce qui évite qu'un
 * étage arrive en retard, en plein mouvement.
 *
 * La fenêtre est SYMÉTRIQUE, et elle ne l'était pas : deux étages d'avance en
 * descendant, un seul en remontant. Paul l'a senti sans le nommer — « à
 * l'aller comme au retour, ça fait comme une sorte de petit saut ». On
 * remonte aussi souvent qu'on descend.
 */
export function calquesDeDescente(
  profondeur: number,
  vue: Cadre,
  etages: readonly EtageDescente[],
): readonly CalqueDescente[] {
  if (etages.length === 0) return [];

  // Le bas de la paire : le dernier étage déjà atteint.
  let bas = 0;
  while (bas + 1 < etages.length && etages[bas + 1]!.profondeur <= profondeur) bas++;

  const haut = Math.min(bas + 1, etages.length - 1);
  const p0 = etages[bas]!.profondeur;
  const p1 = etages[haut]!.profondeur;
  // Avant le premier étage comme après le dernier, il n'y a rien à fondre.
  const fondu = haut === bas || profondeur <= p0 ? 0 : borner((profondeur - p0) / (p1 - p0), 0, 1);

  const calques: CalqueDescente[] = [];
  for (let i = bas - 2; i <= bas + 2; i++) {
    const etage = etages[i];
    if (etage === undefined) continue;
    const opacite = i < bas ? 0 : i === bas ? 1 : i === haut ? fondu : 0;
    calques.push({ etage, opacite, ...poseDuCalque(etage.cadre, vue) });
  }
  return calques;
}
