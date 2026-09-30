// Les salles qui ont une CHORÉGRAPHIE : leurs éléments arrivent une fois la
// salle posée, et repartent avant que la caméra ne prenne son élan.
//
// Jusqu'au 23/09, tout suivait la molette : chaque élément avait une opacité
// fonction de la profondeur. Paul veut autre chose pour la salle 2 — « une
// fois que c'est chargé visuellement », le logo, puis le texte, puis les
// cartes qui entrent par les bords ; et au départ l'inverse, pendant que la
// caméra démarre à peine. C'est une séquence dans le TEMPS, pas dans la
// profondeur : `Navigation.sallePresente` dit quand elle se joue, les feuilles
// de style des salles disent comment (délais et durées y sont réglables).

/**
 * Quand les cartes de la salle 2 ont fini de disparaître dans la fumée, en
 * secondes : `--delai-disparition-cartes` + `--disparition-cartes`, dans
 * `projets.css` (0,1 + 0,7). Les deux se règlent ensemble.
 */
export const FIN_DISPARITION_CARTES = 0.8;

/**
 * Combien de secondes la caméra met à prendre son élan en quittant chaque
 * salle chorégraphiée (voir `cibleRetenue`). Absente : départ immédiat.
 *
 * Pour la salle 2 : réglée le 23/09 sur ses cartes, qui sortaient alors par les
 * bords en 0,8 s. Depuis le 25/09, les cartes partent AVANT, dans leur fumée
 * (`ATTENTE_AU_DEPART`, plus bas) ; la retenue accompagne la sortie du titre
 * et du logo. Paul, le 23/09 : que la caméra démarre quand elles ont fait
 * « cinquante, soixante-dix pour cent de leur parcours ». Mesuré dans le
 * navigateur le 23/09 avec 0,9 s : tant que les cartes n'ont fait que 45 % du
 * chemin, la caméra glisse à peine (profondeur 1,00 → 1,10) ; elle prend son
 * élan entre 60 et 70 %. Avec 0,7 s, elle décollait dès 30 %.
 */
export const RETENUE_AU_DEPART: Readonly<Record<string, number>> = {
  projets: 0.9,
};

/**
 * L'ATTENTE AVANT LE DÉPART, caméra immobile, selon la page où l'on quitte la
 * salle — avant même la retenue ci-dessus. Paul, le 25/09 : en quittant la
 * salle 2 depuis ses cartes, la fumée, la disparition des cartes et le départ
 * vers l'Orchestrateur se faisaient « en même temps », et « ça ne devrait pas
 * faire deux choses en même temps ». D'abord la fumée emporte les cartes ;
 * c'est quand elles ont fini de disparaître que la salle part pour de bon —
 * titre, logo et caméra, comme avant — et la fumée finit de se dissiper
 * pendant que la caméra avance. Attendre la fin de la fumée (1,65 s) « met
 * trop de temps » (Paul, même jour).
 *
 * Pendant l'attente, la salle reste présente (`Navigation.sallePresente`) et
 * seule sa sortie préalable se joue (`Navigation.salleEnPartance`).
 */
export const ATTENTE_AU_DEPART: Readonly<Record<string, readonly number[]>> = {
  // Au repos, rien : il n'y a pas de cartes. Aux cartes, leur disparition.
  projets: [0, FIN_DISPARITION_CARTES],
};

/**
 * Au téléphone, le seuil a un temps de plus (Paul, 28/09) : parti de la
 * carte, on revient d'abord sur la photo — la carte monte, la photo revient
 * par le bas (29/09 ; de côté avant) — et le plongeon ne commence qu'ensuite.
 * Ses pages sont l'accueil (la photo), puis les deux pages de la carte ;
 * seule la dernière mène à la salle 2. C'est aussi la durée de ce glissement,
 * joué par `seuil.ts`.
 */
export const GLISSEMENT_ACCUEIL = 0.7;

export const ATTENTE_AU_DEPART_ETROIT: Readonly<Record<string, readonly number[]>> = {
  ...ATTENTE_AU_DEPART,
  seuil: [0, 0, GLISSEMENT_ACCUEIL],
  // Une page par carte (Paul, 29/09) : on part toujours depuis une carte.
  projets: [0, FIN_DISPARITION_CARTES, FIN_DISPARITION_CARTES, FIN_DISPARITION_CARTES],
};

export function attenteAuDepart(salle: string, page: number, format: 'large' | 'etroit' = 'large'): number {
  const table = format === 'etroit' ? ATTENTE_AU_DEPART_ETROIT : ATTENTE_AU_DEPART;
  return table[salle]?.[page] ?? 0;
}
