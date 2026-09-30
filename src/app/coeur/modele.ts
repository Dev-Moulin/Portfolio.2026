// Le modèle du portfolio : des pièces emboîtées les unes dans les autres.
//
// LA RÈGLE : une ouverture a les proportions de l'écran. En coordonnées
// relatives à la pièce qui la contient, cela s'écrit simplement « hauteur =
// largeur » — quelle que soit la forme de l'écran. (Démonstration : une
// ouverture de largeur relative w mesure w·L pixels de large et w·H de haut
// sur un écran L×H, soit exactement le ratio L/H de l'écran.)
//
// Cette règle n'est pas vérifiée ici, elle est RENDUE IMPOSSIBLE À ENFREINDRE :
// une ouverture ne porte pas de hauteur. C'est le bug qui avait coûté deux
// itérations sur la maquette ; il ne peut plus s'écrire.

/** Ce qui se passe quand on ouvre une ouverture. */
export type Cible =
  /** Descendre d'une pièce : c'est l'axe de la profondeur (le défilement). */
  | { readonly genre: 'profondeur' }
  /** Entrer latéralement dans l'univers d'un projet, à profondeur inchangée. */
  | { readonly genre: 'laterale'; readonly univers: string }
  /** Quitter le site (le dernier niveau : l'ancien portfolio 3D). */
  | { readonly genre: 'externe'; readonly href: string };

/** Un rectangle découpé dans une pièce, où la pièce suivante est posée. */
export interface Ouverture {
  readonly id: string;
  /** Coin supérieur gauche, en fraction de la pièce qui contient l'ouverture. */
  readonly x: number;
  readonly y: number;
  /** Largeur ET hauteur relatives (la règle des proportions d'écran). */
  readonly w: number;
  readonly cible: Cible;
  /** Lu par les lecteurs d'écran, et affiché en surimpression au survol. */
  readonly libelle: string;
  /**
   * Vrai : un PASSAGE INVISIBLE, qu'on ne franchit qu'au défilement — ni
   * liseré, ni libellé, ni clic, et la pièce suivante ne se voit pas d'avance
   * (`opaciteOuvertureInvisible`). Le « H » de THP, la porte du temple.
   * Absent : une ouverture ordinaire, visible.
   */
  readonly invisible?: boolean;
}

/** Une pièce : du contenu, et une ou plusieurs ouvertures vers d'autres pièces. */
export interface Piece {
  readonly id: string;
  readonly nom: string;
  readonly ouvertures: readonly Ouverture[];
  /**
   * La hauteur de la pièce, EN ÉCRANS. 1 = la pièce tient exactement dans la
   * vue ; 2,5 = il faut descendre d'un écran et demi pour en voir le bas.
   *
   * Le champ est optionnel POUR LES TYPES seulement — toute pièce du contenu
   * réel doit le déclarer, et `verifierGraphe` refuse celles qui l'oublient.
   * Absent au moment du calcul, il vaut 1 : le comportement d'avant.
   */
  readonly hauteur?: number;
}

/** Le rectangle que la caméra vise, en coordonnées de la pièce racine. */
export interface Cadre {
  readonly x: number;
  readonly y: number;
  /** Largeur = hauteur, comme une ouverture : le cadre garde le ratio écran. */
  readonly w: number;
}

/**
 * La transformation qui amène un cadre au plein écran.
 * Un point (u, v) en coordonnées racine arrive en
 * (echelle·u + dx, echelle·v + dy) en coordonnées écran, où (0,0) est le coin
 * supérieur gauche de l'écran et (1,1) le coin inférieur droit.
 */
export interface Transformation {
  readonly echelle: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * L'état de navigation. Deux axes, jamais confondus :
 * `profondeur` avance par le défilement, `univers` par le clic latéral.
 */
export interface Etat {
  /** Continu, borné à [0, N]. Entier = pile dans une pièce. */
  readonly profondeur: number;
  /** L'univers de projet ouvert par-dessus, ou null. N'affecte PAS la profondeur. */
  readonly univers: string | null;
  /**
   * Où l'on en est DANS la pièce courante : 0 en haut, 1 en bas. Sans effet
   * tant que la pièce fait un écran de haut — c'est ce qui protège le bureau.
   *
   * Absent vaut 0. Ce n'est pas la même convention que `Piece.hauteur` et
   * c'est voulu : une hauteur est du contenu, qu'on écrit une fois et qu'on
   * doit déclarer ; un défilement est un état transitoire, dont l'absence
   * signifie légitimement « en haut ».
   */
  readonly defilement?: number;
}

export type Graphe = Readonly<Record<string, Piece>>;

/**
 * Un étage de la descente pré-calculée : une image de la même descente, prise
 * à un grossissement fixe, et le rectangle de la pièce racine qu'elle couvre.
 *
 * La photo du seuil fait 627×683 pixels et l'ouverture vers la salle 2 en
 * mesure dix : la fin de la descente n'existe donc pas dans le fichier. On la
 * fabrique à l'avance, étage par étage, et le site ne fait plus que poser les
 * images et fondre de l'une à l'autre.
 *
 * Engendré par `scripts/pyramide-descente.py` dans `descente-etages.ts`.
 */
export interface EtageDescente {
  /** Chemin relatif à la racine du site, tel quel dans un `src`. */
  readonly image: string;
  /** La profondeur à laquelle cette image est à sa taille naturelle. */
  readonly profondeur: number;
  /** Ce qu'elle couvre, en coordonnées de la pièce racine. */
  readonly cadre: Cadre;
}
