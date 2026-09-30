// La fumée d'où naissent les cartes de la salle 2 : ses courbes dans le temps.
// Le dessin est dans `composants/fumee/`, le verre qui se forme dessous dans
// `composants/projets/projets.css`.
//
// Chaque changement — les cartes apparaissent, ou repartent — lâche une
// BOUFFÉE : son épaisseur monte, tient, puis retombe. Deux bouffées qui se
// chevauchent (un aller-retour de molette) ne s'additionnent pas : on garde la
// plus épaisse, ce qui rend la fumée continue quoi qu'on fasse — la nouvelle
// monte pendant que l'ancienne retombe, et prend le relais en la croisant.

export type Genre = 'apparition' | 'disparition';

/** Une bouffée : son genre, et l'instant où elle part, en secondes. */
export interface Bouffee {
  readonly genre: Genre;
  readonly debut: number;
}

/** Les trois temps d'une bouffée, en secondes. */
export interface Profil {
  readonly montee: number;
  readonly tenue: number;
  readonly descente: number;
}

/**
 * LES RÉGLAGES DE LA FUMÉE. Ils vont avec ceux des cartes (`projets.css`) :
 * le verre commence à se former quand la fumée est déjà presque pleine
 * (`--delai-apparition-cartes`, 0,55 s), et il a fini (0,55 + 1,9 s) quand
 * elle achève de se dissiper. Pour repartir, tout va plus vite : la fumée
 * couvre les cartes en 0,4 s et s'est dissipée à 1,65 s. La salle, elle,
 * part dès que les cartes ont disparu (0,8 s, `ATTENTE_AU_DEPART` dans
 * `choregraphie.ts`) : la fin de la fumée accompagne la caméra.
 */
export const PROFILS: Readonly<Record<Genre, Profil>> = {
  apparition: { montee: 0.9, tenue: 0.35, descente: 2.2 },
  disparition: { montee: 0.4, tenue: 0.25, descente: 1.0 },
};

export function dureeBouffee(genre: Genre): number {
  const p = PROFILS[genre];
  return p.montee + p.tenue + p.descente;
}

/** Départ et arrivée à vitesse nulle : pas d'à-coup au début ni à la fin. */
function lisse(u: number): number {
  const x = Math.min(Math.max(u, 0), 1);
  return x * x * (3 - 2 * x);
}

/** L'épaisseur d'une bouffée à l'instant `t`, de 0 à 1. */
export function epaisseurBouffee(b: Bouffee, t: number): number {
  const p = PROFILS[b.genre];
  const e = t - b.debut;
  if (e <= 0) return 0;
  if (e < p.montee) return lisse(e / p.montee);
  if (e < p.montee + p.tenue) return 1;
  return 1 - lisse((e - p.montee - p.tenue) / p.descente);
}

/** L'épaisseur de la fumée : celle de la bouffée la plus épaisse. */
export function epaisseur(bouffees: readonly Bouffee[], t: number): number {
  let e = 0;
  for (const b of bouffees) e = Math.max(e, epaisseurBouffee(b, t));
  return e;
}

/** Les bouffées qui ne sont pas encore retombées. */
export function vivantes(bouffees: readonly Bouffee[], t: number): Bouffee[] {
  return bouffees.filter((b) => t - b.debut < dureeBouffee(b.genre));
}
