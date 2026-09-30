// L'adresse de la page reflète l'endroit où l'on se trouve, pour qu'un lien
// vers un projet précis soit partageable. Deux fonctions pures, testables
// sans navigateur ; la lecture et l'écriture du vrai `location.hash` restent
// dans le service.

import type { Etat, Graphe } from './modele';
import { cheminProfondeur } from './geometrie';
import { universConnus } from './etats';

/** L'ancre correspondant à un état, sans le « # ». Vide à l'accueil. */
export function versHash(etat: Etat, graphe: Graphe, racine: string): string {
  if (etat.univers !== null) return etat.univers;
  const chemin = cheminProfondeur(graphe, racine);
  const k = Math.round(etat.profondeur);
  return k <= 0 ? '' : (chemin[Math.min(k, chemin.length - 1)] ?? '');
}

/**
 * L'état décrit par une ancre. Une ancre inconnue ramène à l'accueil plutôt
 * que d'échouer : une adresse partagée qui a vieilli doit ouvrir le site, pas
 * une page cassée.
 */
export function depuisHash(hash: string, graphe: Graphe, racine: string): Etat {
  const ancre = hash.replace(/^#/, '');
  const chemin = cheminProfondeur(graphe, racine);
  if (universConnus(graphe).has(ancre)) {
    // Un univers s'ouvre par-dessus la pièce qui le contient : on rétablit
    // AUSSI la profondeur de cette pièce, sinon fermer le panneau depuis un
    // lien partagé ferait atterrir sur l'accueil.
    const hote = chemin.findIndex((id) =>
      (graphe[id]?.ouvertures ?? []).some(
        (o) => o.cible.genre === 'laterale' && o.cible.univers === ancre,
      ),
    );
    return { profondeur: Math.max(hote, 0), univers: ancre };
  }
  const k = chemin.indexOf(ancre);
  return { profondeur: k > 0 ? k : 0, univers: null };
}
