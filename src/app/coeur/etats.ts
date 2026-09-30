// L'état de navigation. Fonctions pures : chaque opération renvoie un NOUVEL
// état, jamais de mutation.
//
// L'invariant central du projet est ici, et il est structurel : `entrer` et
// `sortir` ne touchent pas au champ `profondeur`. « On ressort exactement là
// où on était » n'est donc pas une propriété à tester au petit bonheur, c'est
// une chose que le code ne peut pas rater.

import type { Etat, Graphe } from './modele';
import { profondeurMax } from './geometrie';

export function etatInitial(): Etat {
  return { profondeur: 0, univers: null };
}

/** Les univers atteignables latéralement, tels que déclarés par le graphe. */
export function universConnus(graphe: Graphe): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const piece of Object.values(graphe)) {
    for (const o of piece.ouvertures) {
      if (o.cible.genre === 'laterale') ids.add(o.cible.univers);
    }
  }
  return ids;
}

/** Défilement : avance la profondeur, saturée à [0, N]. L'univers est conservé. */
export function deplacer(etat: Etat, delta: number, graphe: Graphe, racine: string): Etat {
  const n = profondeurMax(graphe, racine);
  const profondeur = Math.min(Math.max(etat.profondeur + delta, 0), n);
  return profondeur === etat.profondeur ? etat : { ...etat, profondeur };
}

/** Aller droit à une profondeur donnée (clic sur une ouverture, clavier, hash). */
export function viser(etat: Etat, profondeur: number, graphe: Graphe, racine: string): Etat {
  return deplacer(etat, profondeur - etat.profondeur, graphe, racine);
}

/**
 * Poser le défilement de la pièce visée : 0 en haut, 1 en bas, borné.
 *
 * C'est la SEULE fonction qui touche à ce champ. `deplacer`, `viser`,
 * `entrer` et `sortir` ne le regardent même pas — l'invariant « on ressort
 * exactement là où on était » vaut pour les deux axes, et il tient parce que
 * le code ne peut pas le rater, pas parce qu'on le teste.
 */
export function defiler(etat: Etat, defilement: number): Etat {
  const borne = Math.min(Math.max(defilement, 0), 1);
  return etat.defilement === borne ? etat : { ...etat, defilement: borne };
}

/** Entrée latérale : la profondeur n'est PAS touchée. */
export function entrer(etat: Etat, univers: string, graphe: Graphe): Etat {
  if (!universConnus(graphe).has(univers)) {
    throw new Error(`entrer : « ${univers} » n'est l'univers d'aucune ouverture`);
  }
  return etat.univers === univers ? etat : { ...etat, univers };
}

/** Sortie latérale : la profondeur n'est PAS touchée non plus. */
export function sortir(etat: Etat): Etat {
  return etat.univers === null ? etat : { ...etat, univers: null };
}
