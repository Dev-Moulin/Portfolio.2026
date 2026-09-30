// La loi qui fait avancer la caméra vers sa cible. Module pur : c'est du
// calcul, donc ça vit ici et ça se teste sans navigateur.
//
// POURQUOI PAS UNE APPROCHE EXPONENTIELLE. C'était la première version : à
// chaque image, on refermait une part fixe de l'écart restant. Simple, mais
// la vitesse y est proportionnelle à l'écart, donc MAXIMALE au premier
// instant. Un coup de molette faisait partir la caméra d'un coup avant de
// la laisser traîner longtemps — Paul l'a signalé deux fois, « une sorte de
// petit saut », et rallonger la durée ne l'aurait pas enlevé : ça n'aurait
// fait qu'étirer la traîne.
//
// Un ressort CRITIQUEMENT AMORTI part, lui, d'une vitesse nulle. Il
// accélère, puis freine, et se pose sans jamais dépasser sa cible. C'est le
// mouvement d'une porte d'amortisseur : celui qu'on ne remarque pas.

/** L'état du glissement : où l'on est, et à quelle vitesse on y va. */
export interface Glissement {
  /** La position, en logarithme de largeur de cadre (le zoom est géométrique). */
  readonly position: number;
  /** La vitesse, dans la même unité, par seconde. */
  readonly vitesse: number;
}

/**
 * Un pas de ressort critiquement amorti, intégré semi-implicitement.
 *
 * `tau` est le temps caractéristique : la pulsation vaut 1/tau, et le
 * mouvement se pose en gros au bout de 4 à 5 tau. L'amortissement est fixé à
 * exactement deux fois la racine de la raideur — c'est la valeur qui sépare
 * le rebond (en dessous) de la mollesse (au-dessus), donc la seule qui
 * arrive vite sans jamais dépasser.
 *
 * Semi-implicite veut dire qu'on met la vitesse à jour AVANT la position.
 * C'est ce qui rend le pas stable même quand une image met longtemps à
 * arriver, là où le schéma naïf se met à osciller.
 */
export function avancerGlissement(
  etat: Glissement,
  cible: number,
  dt: number,
  tau: number,
): Glissement {
  if (dt <= 0) return etat;
  const pulsation = 1 / tau;
  const raideur = pulsation * pulsation;
  const amortissement = 2 * pulsation;
  const vitesse =
    etat.vitesse + (-raideur * (etat.position - cible) - amortissement * etat.vitesse) * dt;
  return { position: etat.position + vitesse * dt, vitesse };
}

/**
 * Le glissement est-il arrivé ? Il ne suffit pas d'être au bon endroit : il
 * faut aussi ne plus bouger, sinon on couperait l'animation en plein élan.
 */
export function glissementArrive(etat: Glissement, cible: number, tau: number): boolean {
  return Math.abs(etat.position - cible) < 1e-4 && Math.abs(etat.vitesse) * tau < 1e-4;
}

/**
 * La cible RETENUE au départ d'une salle : elle glisse de `depuis` à `cible`
 * en `duree` secondes, sur une courbe en S, et le ressort la poursuit.
 *
 * Demande de Paul le 23/09, « un peu à la manière d'Apple » : quand on quitte
 * une salle, la caméra ne part pas sur-le-champ. Elle commence à bouger très
 * doucement pendant que les éléments de la salle s'en vont déjà, et ne prend
 * son vrai élan qu'une fois leur sortie bien entamée — ni tout de suite, ni
 * après la fin, « un entre-deux ».
 *
 * La cible bouge au lieu de sauter : le ressort, qui part d'une vitesse nulle,
 * est donc freiné deux fois au départ. C'est ce qui donne un démarrage
 * imperceptible plutôt qu'une attente.
 */
export function cibleRetenue(depuis: number, cible: number, ecoule: number, duree: number): number {
  if (duree <= 0 || ecoule >= duree) return cible;
  const u = Math.max(ecoule, 0) / duree;
  return depuis + (cible - depuis) * u * u * (3 - 2 * u);
}
