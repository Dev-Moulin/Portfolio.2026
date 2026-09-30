// La langue affichée, pour tout le site (règle : `coeur/langue.ts`).
//
// Retenue dans le navigateur du visiteur, et seulement là : c'est une
// commodité, pas une donnée. Si le stockage est refusé (navigation privée),
// on repart de la langue du navigateur à chaque visite, sans rien casser.
// Tient aussi `lang` sur la page : les lecteurs d'écran prononcent alors
// l'anglais en anglais.

import { Injectable, effect, signal } from '@angular/core';
import { autreLangue, langueDuNavigateur, langueRetenue, type Langue } from './coeur/langue';
import { LIBELLES_EN, NOMS_EN } from './coeur/contenu';

const CLE = 'pz-langue';

function depart(): Langue {
  try {
    const retenue = langueRetenue(localStorage.getItem(CLE));
    if (retenue !== null) return retenue;
  } catch {
    // Stockage refusé : la langue du navigateur.
  }
  return typeof navigator === 'undefined'
    ? 'fr'
    : langueDuNavigateur(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

@Injectable({ providedIn: 'root' })
export class LangueSite {
  readonly langue = signal<Langue>(depart());

  constructor() {
    effect(() => {
      const l = this.langue();
      if (typeof document !== 'undefined') document.documentElement.lang = l;
    });
  }

  /** Le nom d'une salle : celui du graphe en français, sa traduction sinon. */
  nom(id: string, francais: string): string {
    return this.langue() === 'en' ? (NOMS_EN[id] ?? francais) : francais;
  }

  /** Ce qu'annonce une ouverture, dans la langue du site. */
  libelle(id: string, francais: string): string {
    return this.langue() === 'en' ? (LIBELLES_EN[id] ?? francais) : francais;
  }

  basculer(): void {
    const l = autreLangue(this.langue());
    this.langue.set(l);
    try {
      localStorage.setItem(CLE, l);
    } catch {
      // Stockage refusé : le choix vaut pour la visite.
    }
  }
}
