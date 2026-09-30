// LA LANGUE DU SITE (Paul, 29/09). Module pur.
//
// En français pour la France et les pays francophones, en anglais pour tous
// les autres. Un site statique ne sait pas d'où vient un visiteur sans passer
// par un service extérieur ; la langue de son navigateur dit la même chose,
// et mieux : un Belge, un Québécois ou un Sénégalais a un navigateur en
// « fr-… ». Un choix fait au bouton l'emporte, et il est retenu.

export type Langue = 'fr' | 'en';

/** La langue de départ, d'après les langues préférées du navigateur. */
export function langueDuNavigateur(preferees: readonly string[]): Langue {
  const premiere = preferees[0]?.toLowerCase() ?? '';
  return premiere === 'fr' || premiere.startsWith('fr-') ? 'fr' : 'en';
}

/** Une langue retenue, si elle en est bien une. */
export function langueRetenue(valeur: string | null): Langue | null {
  return valeur === 'fr' || valeur === 'en' ? valeur : null;
}

/** L'autre langue : celle que propose le bouton. */
export function autreLangue(l: Langue): Langue {
  return l === 'fr' ? 'en' : 'fr';
}
