// La place de l'emblème de la salle 2 (le logo en particules), partagée entre
// la page, qui pose sa toile (`app.ts`), et la salle, qui cale son titre
// dessus (`composants/projets/`). Une seule source : le titre « THP × INTUITION »
// a le logo pour croix, il doit suivre chaque réglage.
//
// Tout est en fractions : `x`, `w` de la LARGEUR de la pièce, `haut` et
// `ecartY` de sa HAUTEUR (le curseur de la règle convertit l'écart en fraction
// de fenêtre). Le logo est un carré de côté `w × largeur`.

/** Le centre horizontal : le décor de la salle 2 est symétrique. */
export const CENTRE_X = 0.5;

/**
 * La largeur de l'emblème, par format. Réglée par Paul le 11/09 (0,123), puis
 * portée à 0,180 sur grand écran le 25/09, et à 0,400 au téléphone le 29/09
 * (1 429 particules : la loi du carré, que Paul a gardée).
 */
export const EMBLEME_LARGE = 0.18;
export const EMBLEME_ETROIT = 0.4;

/** Le haut du carré avant l'écart, par format. */
export const HAUT_LARGE = 0.3;
export const HAUT_ETROIT = 0.34;

/**
 * L'écart vertical du logo au repos. −216 px sur 1194 le 11/09, −160 px sur 999
 * le 25/09 au matin (la croix entre THP et INTUITION), puis placé à la main
 * par Paul le même jour sous le titre : +198, puis +212 px sur 999.
 */
export const ECART_Y = 0.21226939048721166;

/**
 * La place d'ORIGINE du titre et de l'intro : le centre du logo tel qu'il était
 * à −160 px. Le titre ne suit plus le logo depuis que Paul place l'un et
 * l'autre à la main ; ses décalages (`placement.ts`) se comptent depuis ici.
 */
export const ANCRE_TITRE_Y = -160 / 999;
/** Et la largeur du logo d'alors, par format : l'ancre ne suit pas la règle. */
export const ANCRE_TITRE_LARGE = 0.123;
export const ANCRE_TITRE_ETROIT = 0.28;
