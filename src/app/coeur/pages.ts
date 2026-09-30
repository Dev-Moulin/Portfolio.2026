// Les cartes de texte au GABARIT UNIQUE, feuilletées à la molette.
//
// Paul, le 23/09 : toutes les cartes de texte ont la taille de celle de Paul
// Moulin. Un texte plus long ne fait pas grandir la carte : il passe en
// pages. Chaque cran de molette tourne une page — la carte part vers le haut,
// la suivante arrive par le bas — et ce n'est qu'après la dernière que la
// molette reprend son rôle et change de salle. Des points disent combien il
// y a de pages et laquelle on lit.
//
// Ici, seulement l'arithmétique des pages ; l'état vit dans `Navigation`, le
// dessin dans `composants/carte-texte/`.

/** Où en est la carte d'une salle. */
export interface Pages {
  readonly page: number;
  readonly total: number;
}

/**
 * La page voisine dans le sens `sens` (1 : vers le bas), ou `null` au bord —
 * c'est ce `null` qui laisse la molette passer à la salle voisine.
 */
export function tourner(page: number, total: number, sens: 1 | -1): number | null {
  const suivante = page + sens;
  return suivante >= 0 && suivante < total ? suivante : null;
}

/**
 * La page sur laquelle on arrive dans une salle : la première en descendant,
 * la DERNIÈRE en remontant — le chemin inverse exact, on retrouve la carte
 * telle qu'on l'avait quittée.
 */
export function pageArrivee(total: number, sens: 1 | -1): number {
  return sens === 1 ? 0 : Math.max(0, total - 1);
}

/**
 * Le silence, en millisecondes, qui referme une rafale de molette. Assez
 * long pour qu'un pavé tactile qui s'arrête doucement compte pour un seul
 * geste, assez court pour que deux coups de roue voulus fassent deux pages.
 * Le même pour les salles (`app.ts`) et pour la carte ouverte (`univers.ts`).
 */
export const SILENCE_MOLETTE = 260;
