// Les garde-fous du graphe. Ce qui ne peut pas être rendu impossible par les
// types est vérifié ici, et cette vérification tourne dans les tests — pas
// seulement à la relecture visuelle.
//
// À noter : « une ouverture mal proportionnée » ne figure PAS dans cette
// liste. Ce n'est pas un oubli — le modèle ne permet plus de donner une
// hauteur à une ouverture (voir modele.ts), donc le bug de la maquette ne
// peut plus s'écrire du tout.

import type { Graphe } from './modele';
import { cheminProfondeur } from './geometrie';

export function verifierGraphe(graphe: Graphe, racine: string): readonly string[] {
  const erreurs: string[] = [];
  const dire = (m: string) => erreurs.push(m);

  if (graphe[racine] === undefined) dire(`la racine « ${racine} » n'existe pas`);

  for (const piece of Object.values(graphe)) {
    const vues = new Set<string>();
    let profondeurs = 0;

    // La hauteur est du contenu à déclarer : absente, elle rend le défilement
    // ambigu ; inférieure à un écran, elle n'aurait pas de sens.
    if (piece.hauteur === undefined) {
      dire(`pièce « ${piece.id} » : hauteur absente — déclarer une hauteur en écrans`);
    } else if (piece.hauteur < 1) {
      dire(`pièce « ${piece.id} » : hauteur ${piece.hauteur} inférieure à un écran`);
    }

    for (const o of piece.ouvertures) {
      const ou = `pièce « ${piece.id} », ouverture « ${o.id} »`;
      if (vues.has(o.id)) dire(`${ou} : identifiant en double`);
      vues.add(o.id);

      if (!(o.w > 0 && o.w <= 1)) dire(`${ou} : largeur ${o.w} hors de ]0, 1]`);
      if (o.x < 0 || o.x + o.w > 1) dire(`${ou} : déborde horizontalement de sa pièce`);
      if (o.y < 0 || o.y + o.w > 1) dire(`${ou} : déborde verticalement de sa pièce`);

      switch (o.cible.genre) {
        case 'profondeur':
          profondeurs += 1;
          if (graphe[o.id] === undefined) dire(`${ou} : mène à une pièce inconnue`);
          break;
        case 'laterale':
          if (graphe[o.cible.univers] === undefined) {
            dire(`${ou} : univers « ${o.cible.univers} » inconnu`);
          }
          break;
        case 'externe':
          if (!o.cible.href.startsWith('https://')) dire(`${ou} : lien externe non https`);
          break;
      }
    }

    // Deux ouvertures « profondeur » dans la même pièce rendraient l'axe du
    // défilement ambigu : laquelle serait « la suivante » ?
    if (profondeurs > 1) dire(`pièce « ${piece.id} » : ${profondeurs} ouvertures de profondeur`);
  }

  // Toute pièce doit être atteignable, sinon c'est du contenu invisible.
  const atteignables = new Set<string>(cheminProfondeur(graphe, racine));
  for (const id of [...atteignables]) {
    for (const o of graphe[id]?.ouvertures ?? []) {
      if (o.cible.genre === 'laterale') atteignables.add(o.cible.univers);
    }
  }
  for (const id of Object.keys(graphe)) {
    if (!atteignables.has(id)) dire(`pièce « ${id} » : inatteignable depuis « ${racine} »`);
  }

  return erreurs;
}
