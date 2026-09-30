// La trame du seuil : le champ de fumée rendu en points, façon trame
// d'imprimerie. Ici, seulement ce qui se raisonne sans carte graphique —
// les réglages arrêtés par Paul, et le dimensionnement de la grille.
//
// POURQUOI UNE GRILLE, ET PAS UN CALCUL PAR PIXEL. Le champ ne vaut qu'UNE
// valeur par point : deux pixels de la même cellule donnent forcément le même
// disque. Le calculer par pixel d'écran, ce serait donc refaire cellule²
// fois le même travail — 36 fois de trop à 6 px. On le rend dans une texture
// d'un texel par cellule, et la passe de tramage se contente d'y lire.
// C'est ce qui met l'effet à portée d'un téléphone.

/** Les réglages, arrêtés par Paul le 09/09 devant l'aperçu. */
export interface ReglagesTrame {
  /** Côté d'une cellule, en pixels CSS. */
  readonly cellule: number;
  /** Vitesse d'écoulement du champ. */
  readonly vitesse: number;
  /** Taille du motif : petit = grandes volutes. */
  readonly echelle: number;
  /** Écart entre creux et crêtes. */
  readonly contraste: number;
  /**
   * Densité du noir. En dessous de 1, les points grossissent et finissent
   * par se souder — c'est ce réglage qui manquait au premier essai, où le
   * noir ne pouvait jamais former d'aplat.
   */
  readonly densite: number;
  /**
   * Secondes entre deux couleurs — MAIS en temps de champ, pas en secondes
   * de montre. L'horloge des couleurs est portée par celle du champ, qui
   * avance à `vitesse` : à 0,31, ces 5 unités valent seize secondes à
   * l'écran. C'est ce que Paul a validé ; le noter évite de chercher un jour
   * pourquoi « toutes les 5 s » en dure trois fois plus.
   */
  readonly periode: number;
  /** Le sombre : fond des points quand on inverse. */
  readonly sombre: string;
  /** Les teintes qui se relaient, dans l'ordre. */
  readonly palette: readonly string[];
  /** Rayon du halo de souris, en fraction de la hauteur d'écran. */
  readonly halo: number;
  /**
   * L'avance que le champ prend sous la souris, EN UNITÉS DE TEMPS DE CHAMP.
   * Le temps avance de `vitesse` par seconde : à 0,31, une force de 1,2 fait
   * voir sous le curseur un écoulement en avance de quatre secondes. C'est
   * du mouvement, pas une déformation — le domaine, lui, ne bouge jamais.
   */
  readonly force: number;
}

export const REGLAGES_TRAME: ReglagesTrame = {
  cellule: 6,
  vitesse: 0.31,
  echelle: 0.8,
  contraste: 0.95,
  densite: 0.4,
  periode: 5,
  sombre: '#0a0a0a',
  palette: ['#4182f2', '#8f5cf7', '#f25f82', '#f2a341', '#3fd2c0'],
  halo: 0.3,
  force: 1.2,
};

/**
 * Le rayon, en cellules, qu'un point doit atteindre pour couvrir sa cellule
 * ENTIÈRE, coins compris : c'est la demi-diagonale d'un carré de côté 1.
 * En dessous, il reste toujours de la couleur dans les angles et le noir ne
 * peut pas faire d'aplat — c'était le défaut du premier essai.
 */
export const RAYON_SOUDURE = Math.SQRT2 / 2;

/** Le rayon maximal retenu : au-delà de la soudure, donc les points fusionnent. */
export const RAYON_MAX = 0.73;

export interface Grille {
  readonly colonnes: number;
  readonly lignes: number;
}

/**
 * La taille de la texture du champ pour un écran donné.
 *
 * `ceil` et pas `round` : une cellule entamée au bord droit doit exister,
 * sinon la dernière colonne de l'écran lirait hors texture et resterait
 * noire. Et jamais zéro — une texture de côté nul n'est pas allouable, et
 * un écran d'un pixel de large arrive vraiment (le temps d'un pliage de
 * fenêtre, ou dans un test).
 */
export function grilleTrame(largeur: number, hauteur: number, cellule: number): Grille {
  const cote = Math.max(1, cellule);
  return {
    colonnes: Math.max(1, Math.ceil(Math.max(0, largeur) / cote)),
    lignes: Math.max(1, Math.ceil(Math.max(0, hauteur) / cote)),
  };
}

/**
 * Le nombre de valeurs de champ à calculer par image, pour un écran donné.
 * Sert à mesurer ce que coûte un réglage : c'est le seul chiffre qui grandit
 * quand on affine la trame.
 */
export function coutTrame(largeur: number, hauteur: number, cellule: number): number {
  const { colonnes, lignes } = grilleTrame(largeur, hauteur, cellule);
  return colonnes * lignes;
}

/** `#rrggbb` → trois flottants 0..1, tels que GLSL les attend. */
export function rvb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) throw new Error(`couleur illisible : « ${hex} » (attendu #rrggbb)`);
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
