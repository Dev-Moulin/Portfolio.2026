// Le pilotage du second axe : ce que le doigt fait DANS une pièce, et où la
// caméra se pose quand elle en change. Module pur — aucun DOM, aucun
// Angular, donc testable sans navigateur, comme tout le reste de `coeur/`.
//
// UNE CONVENTION TIENT TOUT LE MODULE : le doigt s'exprime en HAUTEURS DE
// VUE, jamais en pixels. C'est la couche d'affichage qui divise par la
// hauteur de la fenêtre ; ici, on ne sait pas ce qu'est un pixel. Positif =
// le doigt remonte, c'est-à-dire qu'on descend dans la pièce.

/**
 * Le dépassement élastique maximal, en hauteurs de vue. Si fort qu'on tire,
 * la caméra ne franchira jamais le bord de la pièce de plus que ça : c'est
 * ce qui fait « buter » au lieu de « glisser sans fin ».
 */
export const BUTEE_MAX = 0.08;

/**
 * La course qu'il faut pousser AU-DELÀ du bord pour franchir, en hauteurs de
 * vue — environ 100 px sur un téléphone. Elle se mesure sur la course brute
 * du doigt et non sur le dépassement affiché : l'effort demandé reste le
 * même quelle que soit la résistance qu'on voit.
 */
export const SEUIL_FRANCHISSEMENT = 0.12;

/**
 * Le dépassement (élastique, donc borné par `BUTEE_MAX`) auquel le mot
 * d'invite atteint sa pleine opacité. Choisi pour que le mot soit là AVANT
 * qu'on puisse franchir : il est complet vers 5 % d'écran de course, le
 * franchissement en demande 12 %.
 */
export const SEUIL_INVITE = 0.03;

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Le doigt posé sur l'écran, entre le poser et le lever. */
export interface Geste {
  /**
   * Le défilement de la pièce à l'instant du poser : 0 en haut, 1 en bas.
   * C'est lui qui décide si le geste a le droit de franchir — voir `glisser`.
   */
  readonly defilementAuPoser: number;
  /** La course du doigt depuis le poser, en hauteurs de vue. */
  readonly parcouru: number;
}

/** Ce que devient le geste après un déplacement, et ce qu'il faut en faire. */
export interface Reponse {
  /** Le geste, à reporter tel quel au déplacement suivant. */
  readonly geste: Geste;
  /** Où l'on en est dans la pièce : 0 en haut, 1 en bas. */
  readonly defilement: number;
  /** Le dépassement élastique, en hauteurs de vue. Signé : > 0 au-delà du bas. */
  readonly butee: number;
  /** Le franchissement déclenché : +1 vers le fond, −1 vers la surface, 0 sinon. */
  readonly franchir: -1 | 0 | 1;
}

/**
 * D'où l'on vient et où l'on va, sur l'axe de la profondeur. Un seul
 * défilement y figure — celui de la pièce visée — parce que c'est le seul
 * qu'on pilote : celui de la pièce quittée se déduit du sens du voyage, et
 * celui d'une pièce simplement traversée suit la convention (voir
 * `defilementsDuSegment`).
 */
export interface Trajet {
  /** La pièce quittée (profondeur entière). */
  readonly origine: number;
  /** La pièce visée. Égale à `origine` quand on est immobile. */
  readonly cible: number;
  /** Le défilement de la pièce visée : 0 en haut, 1 en bas. */
  readonly defilementCible: number;
}

/** Ouvre un geste : on retient où l'on était, la course repart de zéro. */
export function poser(defilement: number): Geste {
  return { defilementAuPoser: defilement, parcouru: 0 };
}

/**
 * Le doigt se déplace de `deltaEcrans` dans une pièce de `hauteur` écrans.
 *
 * Trois choses en sortent, et elles ne se confondent pas : le défilement
 * (borné à [0, 1] — ce qu'on voit de la pièce), la butée (ce qui dépasse,
 * amorti élastiquement) et le franchissement (le passage à la pièce
 * voisine).
 *
 * LA RÈGLE DU FRANCHISSEMENT : un balayage qui ATTEINT la butée ne franchit
 * pas. Il faut lever le doigt et rebalayer. Un geste n'est donc armé que si
 * la pièce était DÉJÀ au bord au moment du poser, du côté où le doigt part.
 * Une pièce d'un écran de haut est à la fois en haut et en bas d'elle-même :
 * tout balayage y est armé d'emblée, et le premier suffit — c'est ce qui
 * fait que le contenu actuel se parcourt encore d'un geste par pièce.
 *
 * @param deltaEcrans en hauteurs de vue, positif quand on descend.
 */
export function glisser(geste: Geste, deltaEcrans: number, hauteur: number): Reponse {
  const parcouru = geste.parcouru + deltaEcrans;
  const amplitude = hauteur - 1;
  const brut = geste.defilementAuPoser * amplitude + parcouru;
  const retenu = borner(brut, 0, amplitude);
  const defilement = amplitude === 0 ? 0 : retenu / amplitude;
  const exces = brut - retenu;
  const butee = (BUTEE_MAX * exces) / (Math.abs(exces) + BUTEE_MAX);

  // Un balayage qui ATTEINT la butée ne franchit pas : il faut lever le doigt
  // et rebalayer. Le geste n'est donc armé que si la pièce était déjà au bord,
  // du côté où le doigt est parti.
  const sens = parcouru > 0 ? 1 : parcouru < 0 ? -1 : 0;
  const arme =
    amplitude === 0 ||
    (sens > 0 && geste.defilementAuPoser >= 1) ||
    (sens < 0 && geste.defilementAuPoser <= 0);
  const franchir: -1 | 0 | 1 = arme && Math.abs(exces) >= SEUIL_FRANCHISSEMENT ? sens : 0;

  return {
    geste: { defilementAuPoser: geste.defilementAuPoser, parcouru },
    defilement,
    butee,
    franchir,
  };
}

/**
 * Les deux défilements à passer à `cadreAvecDefilement` pour le segment `k`,
 * c'est-à-dire la paire de pièces (k, k+1) entre lesquelles la caméra se
 * trouve. Rend `[defilementDepart, defilementArrivee]` — dans l'ordre des
 * paramètres de `cadreAvecDefilement`, donc [pièce k, pièce k+1].
 *
 * C'EST LA DÉCISION QUE PH-1 AVAIT DIFFÉRÉE : on arrive en haut d'une pièce
 * quand on descend, en bas quand on remonte — sinon remonter ferait sauter
 * tout le contenu qu'on vient de parcourir.
 *
 * Traduite ici, elle se passe du sens de marche. Une pièce qu'on TRAVERSE
 * est toujours vue par son bas quand elle est le bout peu profond du
 * segment, et par son haut quand elle en est le bout profond : la paire
 * (1, 0), quel que soit le sens du voyage. Le sens n'intervient qu'à un seul
 * endroit — la pièce QUITTÉE, laissée par son bas si l'on descend, par son
 * haut si l'on remonte.
 */
export function defilementsDuSegment(k: number, trajet: Trajet): readonly [number, number] {
  const defilementOrigine = trajet.cible > trajet.origine ? 1 : 0;
  const pour = (piece: number, convention: number) =>
    piece === trajet.cible
      ? trajet.defilementCible
      : piece === trajet.origine
        ? defilementOrigine
        : convention;
  return [pour(k, 1), pour(k + 1, 0)];
}
