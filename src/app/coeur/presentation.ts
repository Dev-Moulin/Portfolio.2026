import { SEUIL_INVITE } from './gestes';
import type { Graphe } from './modele';

// Les quelques règles d'affichage qui méritent d'être calculées plutôt
// qu'écrites à la main dans une feuille de style. Pures, donc testables.

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * L'opacité du contenu d'une pièce, selon la profondeur affichée.
 *
 * Deux raisons de ne pas tout laisser à 1. En s'éloignant, le texte d'une
 * pièce qu'on vient de quitter devient gigantesque et déborde ; en approchant,
 * une pièce encore minuscule ne donne qu'une bouillie grise. On la fait donc
 * apparaître un peu avant d'y entrer, et disparaître un peu après en être
 * sorti. Les ouvertures, elles, restent visibles : ce sont elles qui donnent
 * la sensation d'emboîtement.
 */
export function opaciteContenu(profondeurAffichee: number, profondeurPiece: number): number {
  const ecart = profondeurAffichee - profondeurPiece;
  const apparition = borner((ecart + 1.5) / 0.7, 0, 1);
  const disparition = borner((0.9 - ecart) / 0.7, 0, 1);
  return Math.min(apparition, disparition);
}

/**
 * Sur combien de profondeur le fond du seuil (la trame) s'éteint en partant.
 *
 * Presque tout de suite : Paul, le 23/09 — « au moment où on active le fait
 * de zoomer, il faut que tu démontes le background de Paul Moulin ». Jusque-là
 * la trame ne s'effaçait JAMAIS : sa boucle s'arrêtait à 0,9, mais sa toile
 * gardait sa dernière image, figée derrière toute la descente. « S'il doit y
 * avoir un résidu de background, il faudrait que ce soit noir » : dessous, il
 * n'y a que le fond de la page, presque noir.
 */
export const DEPART_TRAME = 0.06;

/** L'opacité de la trame : pleine au seuil, éteinte dès le début du zoom. */
export function opaciteTrame(profondeurAffichee: number): number {
  return borner(1 - profondeurAffichee / DEPART_TRAME, 0, 1);
}

/**
 * Vrai quand le contenu d'une pièce doit exister dans la page : exactement
 * quand `opaciteContenu` n'est pas nul. En pratique, la pièce où l'on est et,
 * pendant une transition, sa voisine — jamais plus de deux à la fois.
 *
 * Les pièces restent emboîtées (la salle Hermès vit DANS la porte du temple,
 * qui vit dans le « H ») : ce sont leurs boîtes qui portent le zoom, et elles
 * ne dessinent rien. Mais tout ce qui se voit — textes, vignettes, photo — est
 * démonté hors de cette fenêtre, vignettes comprises, bien qu'elles soient
 * des ouvertures.
 *
 * Pourquoi (23/09). Une pièce quittée n'était « partie » que parce que le
 * zoom la poussait hors de l'écran. Or à ces grossissements le navigateur ne
 * sait plus où il la dessine : chez Paul, à la profondeur 2, la vignette
 * Overmind était mise en page à y = −2 495 px — hors écran — et sa carte
 * graphique la peignait pourtant en plein milieu, par-dessus le visage
 * d'Hermès. Ce qui n'existe plus ne peut pas être peint de travers.
 */
export function pieceMontee(profondeurAffichee: number, profondeurPiece: number): boolean {
  return opaciteContenu(profondeurAffichee, profondeurPiece) > 0;
}

/**
 * L'opacité de la salle d'indice `k` : celle des passages invisibles qu'il a
 * fallu franchir pour y arriver. Tant qu'une porte invisible n'est pas
 * franchie, tout ce qui est derrière elle reste caché — la salle, et toutes
 * les plus profondes.
 *
 * C'était l'ouverture, en emboîtant les salles, qui portait cette opacité
 * pour tout son contenu ; les salles étant posées à part depuis le 23/09, le
 * produit se calcule ici.
 */
export function opaciteSalle(
  profondeurAffichee: number,
  chemin: readonly string[],
  graphe: Graphe,
  k: number,
): number {
  let opacite = 1;
  for (let j = 1; j <= k; j++) {
    const porte = graphe[chemin[j - 1]!]?.ouvertures.find((o) => o.id === chemin[j]);
    if (porte?.invisible === true) opacite *= opaciteOuvertureInvisible(profondeurAffichee, j);
  }
  return opacite;
}

/**
 * Les salles qui existent dans la page à cette profondeur : celles dont le
 * contenu a une opacité (`pieceMontee`) ET qu'aucune porte invisible encore
 * fermée ne cache. Une salle absente de cet ensemble est DÉMONTÉE, composant
 * compris.
 *
 * Sur grand écran, c'est une salle à la fois, deux pendant une transition :
 * la salle 2 n'existe qu'une fois le noir du « H » atteint, la salle Hermès
 * qu'une fois le visage entier.
 */
export function sallesMontees(
  profondeurAffichee: number,
  chemin: readonly string[],
  graphe: Graphe,
): ReadonlySet<string> {
  const montees = new Set<string>();
  chemin.forEach((id, k) => {
    if (
      pieceMontee(profondeurAffichee, k) &&
      opaciteSalle(profondeurAffichee, chemin, graphe, k) > 0
    ) {
      montees.add(id);
    }
  });
  return montees;
}

/**
 * Quand la salle contenue par un passage invisible se révèle, exprimé en
 * ÉCART de profondeur : -1 = on est encore une pièce entière au-dessus.
 *
 * Ces deux nombres commandent aussi la fin de la descente pré-calculée : la
 * pyramide s'efface exactement quand la salle apparaît, sans quoi l'une
 * masquerait l'autre. Les déplacer, c'est déplacer les deux d'un coup.
 *
 * LA SALLE ARRIVE APRÈS LE NOIR, et ces deux nombres ne sont pas choisis :
 * ils sont mesurés. La descente vise maintenant le noir du « H », et le
 * rendu simulé (`scripts/apercu-descente.py --mesurer`) dit à quelle
 * profondeur le dernier blanc quitte l'écran : 0,975. Avant, l'arrivée
 * commençait à 0,88 — la salle se fondait donc par-dessus une lettre encore
 * blanche et noire, et le noir n'était jamais vu. « On arrive sur la
 * dernière image, mais la dernière image contient du blanc un peu partout. »
 *
 * Le fondu qui suit ne creuse pas la luminosité, parce que les trois couches
 * en présence sont le même noir : la pyramide arrive à 13,5, `--fond-seuil`
 * vaut 10 (noir neutre depuis le 23/09), la salle 18. Deux calques
 * translucides ne se relaient proprement que lorsqu'il n'y a rien à voir
 * entre eux — ici, c'est le cas.
 *
 * Étapes précédentes : { debut: -1, fin: -0.45 } avant les étages engendrés
 * (la salle arrivait à mi-chemin pour cacher le flou de la photo agrandie),
 * puis { debut: -0.12, fin: -0.02 } quand la descente s'arrêtait sur la
 * lettre entière.
 */
export const ARRIVEE = { debut: -0.025, fin: -0.005 } as const;

/**
 * L'opacité d'une ouverture INVISIBLE, selon la profondeur affichée.
 *
 * Une ouverture ordinaire se voit : c'est elle qui donne la sensation
 * d'emboîtement. Une ouverture invisible, non — sinon on verrait d'avance
 * la fenêtre dans laquelle on va, ce qui est exactement ce qu'on ne veut
 * pas. Elle est donc absolument transparente tant qu'on est dans la pièce
 * d'avant (écart ≤ -1), et la pièce qu'elle contient se révèle en
 * s'approchant, pour être entière bien avant d'y entrer.
 *
 * Conséquence voulue : au seuil, il n'y a rien à voir à l'endroit du
 * passage — juste la photo. C'est le noir du tee-shirt qui s'ouvre.
 */
export function opaciteOuvertureInvisible(
  profondeurAffichee: number,
  profondeurPiece: number,
): number {
  const ecart = profondeurAffichee - profondeurPiece;
  return borner((ecart - ARRIVEE.debut) / (ARRIVEE.fin - ARRIVEE.debut), 0, 1);
}

/**
 * Le mot qui invite à continuer, affiché quand la caméra bute contre le bord
 * d'une pièce. Rend la destination, la flèche et l'opacité — jamais le
 * texte : les noms des pièces vivent dans le graphe, pas ici.
 *
 * `null` quand il n'y a rien à dire : aucune butée, ou rien au-delà (le
 * seuil vers le haut, le fond vers le bas).
 *
 * @param butee le dépassement élastique, signé, en hauteurs de vue.
 * @param pieceCourante l'indice de la pièce où l'on est, dans le chemin.
 * @param nbPieces la longueur du chemin de profondeur.
 */
export function invite(
  butee: number,
  pieceCourante: number,
  nbPieces: number,
): { readonly vers: number; readonly fleche: '↓' | '↑'; readonly opacite: number } | null {
  if (butee === 0) return null;
  const vers = pieceCourante + (butee > 0 ? 1 : -1);
  if (vers < 0 || vers >= nbPieces) return null;
  return {
    vers,
    fleche: butee > 0 ? '↓' : '↑',
    opacite: borner(Math.abs(butee) / SEUIL_INVITE, 0, 1),
  };
}

/**
 * Où la carte d'un projet démarre quand on l'ouvre, et où elle revient quand
 * on la referme : exactement sur la vignette, en pour cent de l'écran.
 *
 * Calculé depuis le modèle et non mesuré dans la page : la salle 2 posée a la
 * taille de l'écran et aucune transformation, donc l'ouverture de la vignette
 * EST son rectangle à l'écran. C'est juste même quand la vignette est encore
 * hors écran (lien direct `#intuition`), et à toutes les densités.
 *
 * Donné par le CENTRE, parce que la carte est centrée sur son point
 * (`translate(-50 %, -50 %)`) : elle peut alors glisser puis grandir autour de
 * son milieu, deux mouvements qui ne se mélangent pas. Une ouverture a la
 * forme de l'écran : sa hauteur est `w` en fraction de la hauteur.
 */
export function departCarte(ouverture: { readonly x: number; readonly y: number; readonly w: number }): {
  readonly centreX: number;
  readonly centreY: number;
  readonly largeur: number;
  readonly hauteur: number;
} {
  return {
    centreX: (ouverture.x + ouverture.w / 2) * 100,
    centreY: (ouverture.y + ouverture.w / 2) * 100,
    largeur: ouverture.w * 100,
    hauteur: ouverture.w * 100,
  };
}

/**
 * AU TÉLÉPHONE, UNE SEULE CARTE, AU CENTRE (Paul, 29/09) : les trois projets
 * y sont présentés à la même place, un par geste, et c'est de là que la carte
 * s'ouvre et là qu'elle revient — la même animation pour les trois. En
 * pourcentages de l'écran ; `projets.css` (bloc téléphone) pose la carte à ces
 * mêmes valeurs, les deux se règlent ensemble.
 */
export const CARTE_ETROITE = { gauche: 12, haut: 42, largeur: 76, hauteur: 36 } as const;

export function departCarteEtroite(): ReturnType<typeof departCarte> {
  const c = CARTE_ETROITE;
  return {
    centreX: c.gauche + c.largeur / 2,
    centreY: c.haut + c.hauteur / 2,
    largeur: c.largeur,
    hauteur: c.hauteur,
  };
}
