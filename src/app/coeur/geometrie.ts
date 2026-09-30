// La géométrie du zoom. Module pur : aucun DOM, aucun Angular, tout est
// testable directement. C'est ici que vit la formule qui décide de tout.

import type { Cadre, Graphe, Ouverture, Piece, Transformation } from './modele';

/** L'ouverture d'une pièce qui mène à la pièce suivante en profondeur. */
export function ouvertureProfondeur(piece: Piece): Ouverture | undefined {
  return piece.ouvertures.find((o) => o.cible.genre === 'profondeur');
}

/**
 * Les identifiants des pièces le long de l'axe de profondeur, de la racine
 * au fond. `chemin.length - 1` est la profondeur maximale N.
 */
export function cheminProfondeur(graphe: Graphe, racine: string): readonly string[] {
  const chemin: string[] = [];
  let id: string | undefined = racine;
  while (id !== undefined && graphe[id] !== undefined && !chemin.includes(id)) {
    chemin.push(id);
    id = ouvertureProfondeur(graphe[id]!)?.id;
  }
  return chemin;
}

/** N : la profondeur du fond. Trois pièces enchaînées donnent N = 2. */
export function profondeurMax(graphe: Graphe, racine: string): number {
  return cheminProfondeur(graphe, racine).length - 1;
}

/**
 * Les cadres aux profondeurs entières, en coordonnées de la pièce racine.
 * Le cadre 0 est l'écran entier ; chaque pas suivant se compose : l'ouverture
 * traversée est exprimée dans la pièce qu'on quitte, donc sa position se
 * ramène au repère racine en la mettant à l'échelle du cadre courant.
 */
export function cadresEntiers(graphe: Graphe, racine: string): readonly Cadre[] {
  const cadres: Cadre[] = [{ x: 0, y: 0, w: 1 }];
  for (const id of cheminProfondeur(graphe, racine)) {
    const o = ouvertureProfondeur(graphe[id]!);
    if (o === undefined) break;
    const parent = cadres[cadres.length - 1]!;
    cadres.push({
      x: parent.x + parent.w * o.x,
      y: parent.y + parent.w * o.y,
      w: parent.w * o.w,
    });
  }
  return cadres;
}

const borner = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * L'indice du segment affiché : la paire de pièces (k, k+1) entre lesquelles
 * la caméra se trouve. `d` hors de [0, N] est saturé, jamais une erreur.
 *
 * Le calcul était écrit deux fois — dans `cadre` et dans
 * `cadreAvecDefilement` — et il fallait le connaître une troisième fois,
 * côté navigation, pour savoir de quelles pièces parlent les deux
 * défilements. Il n'existe donc plus qu'ici.
 */
export function segmentDe(graphe: Graphe, racine: string, d: number): number {
  const n = cadresEntiers(graphe, racine).length - 1;
  const db = borner(d, 0, n);
  return Math.min(Math.floor(db), Math.max(n - 1, 0));
}

/**
 * L'interpolation géométrique entre deux cadres entiers consécutifs — la
 * formule de `cadre`, extraite pour être partagée avec `cadreAvecDefilement`.
 * `t` vaut 0 au départ, 1 à l'arrivée ; la largeur est interpolée
 * géométriquement (le rapport entre deux images consécutives est constant) et
 * non linéairement : sinon le zoom paraît ralentir en approchant du but.
 * Le centre suit la même loi, ce qui fait glisser le cadre de façon régulière
 * avec le grossissement.
 */
export function interpole(a: Cadre, b: Cadre, t: number): Cadre {
  if (t === 0 || a === b) return a;
  const w = a.w * Math.pow(b.w / a.w, t);
  // La fraction parcourue est mesurée en largeur, pas en profondeur.
  const s = (w - a.w) / (b.w - a.w);
  const centre = (ca: number, cb: number) => ca + s * (cb - ca);
  return {
    x: centre(a.x + a.w / 2, b.x + b.w / 2) - w / 2,
    y: centre(a.y + a.w / 2, b.y + b.w / 2) - w / 2,
    w,
  };
}

/**
 * Le cadre visé à une profondeur quelconque, entière ou non.
 *
 * Entre deux pièces, la LARGEUR est interpolée géométriquement (le rapport
 * entre deux images consécutives est constant) et non linéairement : sinon le
 * zoom paraît ralentir en approchant du but. Le centre suit la même loi, ce
 * qui fait glisser le cadre de façon régulière avec le grossissement.
 *
 * `d` hors de [0, N] est saturé, jamais une erreur : on peut molette-r
 * au-delà du fond sans rien casser.
 */
export function cadre(graphe: Graphe, racine: string, d: number): Cadre {
  const cadres = cadresEntiers(graphe, racine);
  const n = cadres.length - 1;
  const db = borner(d, 0, n);
  const k = segmentDe(graphe, racine, d);
  const t = db - k;
  return interpole(cadres[k]!, cadres[Math.min(k + 1, n)]!, t);
}

/**
 * La hauteur déclarée d'une pièce, en écrans. Absente vaut 1 — le
 * comportement d'avant. C'est `verifierGraphe` qui refuse l'oubli d'une
 * déclaration, pas ce calcul : ici on ne plante jamais.
 */
export function hauteurDe(graphe: Graphe, id: string): number {
  return graphe[id]?.hauteur ?? 1;
}

/**
 * Le même cadre, descendu de `ecrans` hauteurs de vue.
 *
 * Un cadre a la forme de l'écran : sa largeur `w` est aussi sa hauteur. Un
 * écran de descente vaut donc `c.w` en coordonnées racine. Ni `x` ni `w` ne
 * changent : descendre n'est pas zoomer.
 *
 * Deux choses s'en servent, et elles n'ont rien à voir : le défilement dans
 * une pièce (`decalerCadre`) et le dépassement élastique de la butée.
 */
export function decalerEcrans(c: Cadre, ecrans: number): Cadre {
  return { ...c, y: c.y + ecrans * c.w };
}

/**
 * Le même cadre, descendu à l'intérieur de sa pièce.
 *
 * Une pièce de `hauteur` écrans s'étend sur `hauteur × c.w` en coordonnées
 * racine, alors que la vue n'en montre que `c.w`. L'amplitude du défilement
 * vaut donc `(hauteur − 1) × c.w`, et `defilement` en parcourt la fraction :
 * 0 en haut, 1 en bas. À hauteur 1 l'amplitude est nulle et le cadre ne
 * bouge pas, quelle que soit la valeur de `defilement`.
 *
 * Ni `x` ni `w` ne changent : défiler n'est pas zoomer.
 */
export function decalerCadre(c: Cadre, hauteur: number, defilement: number): Cadre {
  return decalerEcrans(c, defilement * (hauteur - 1));
}

/**
 * Le cadre RÉELLEMENT affiché, défilement compris.
 *
 * Même interpolation géométrique que `cadre`, mais entre deux extrémités
 * décalées : on part de la pièce qu'on quitte AU POINT OÙ L'ON EST
 * (`defilementDepart`) et on arrive dans la suivante au point voulu
 * (`defilementArrivee`). Sans cela, amorcer une transition depuis le bas
 * d'une pièce ferait d'abord remonter la caméra en haut.
 *
 * Les deux défilements sont OBLIGATOIRES et sans valeur par défaut : un
 * défaut implicite serait une règle d'arrivée cachée ici, alors qu'elle
 * appartient à l'appelant (voir « Décisions différées » dans TASK.md).
 */
export function cadreAvecDefilement(
  graphe: Graphe,
  racine: string,
  d: number,
  defilementDepart: number,
  defilementArrivee: number,
): Cadre {
  const cadres = cadresEntiers(graphe, racine);
  const chemin = cheminProfondeur(graphe, racine);
  const n = cadres.length - 1;
  const db = borner(d, 0, n);
  const k = segmentDe(graphe, racine, d);
  const t = db - k;

  // On part de la pièce quittée au point où l'on EST, et l'on arrive dans la
  // pièce suivante au point voulu — d'où deux extrémités décalées.
  const a = decalerCadre(cadres[k]!, hauteurDe(graphe, chemin[k]!), defilementDepart);
  const b = decalerCadre(
    cadres[Math.min(k + 1, n)]!,
    hauteurDe(graphe, chemin[Math.min(k + 1, n)]!),
    defilementArrivee,
  );
  return interpole(a, b, t);
}

/**
 * La transformation qui amène un cadre au plein écran.
 *
 * C'EST LA FORMULE QUI AVAIT ÉTÉ ÉCRITE À L'ENVERS sur la première version :
 * pour cadrer un rectangle situé en x, il faut RECULER de x (signe négatif),
 * et le recul s'exprime APRÈS le grossissement (donc multiplié par lui).
 * Écrite ici, elle est testable — c'était le trou : aucun test ne regardait
 * le rendu.
 */
export function transformation(c: Cadre): Transformation {
  const echelle = 1 / c.w;
  return { echelle, dx: -c.x * echelle, dy: -c.y * echelle };
}

/** Où arrive un point de la pièce racine, en fraction d'écran. */
export function projeter(t: Transformation, u: number, v: number): { u: number; v: number } {
  return { u: t.echelle * u + t.dx, v: t.echelle * v + t.dy };
}

/**
 * La transformation en CSS. `translate` en pourcentage se rapporte à la boîte
 * non transformée de l'élément (donc à l'écran), et il est écrit APRÈS
 * `scale` pour être appliqué dans le repère déjà grossi : le déplacement vaut
 * bien echelle × (−x), soit dx.
 */
export function transformationCss(c: Cadre): string {
  const t = transformation(c);
  return `scale(${t.echelle.toFixed(6)}) translate(${(-c.x * 100).toFixed(5)}%, ${(-c.y * 100).toFixed(5)}%)`;
}

/**
 * La transformation CSS d'UNE salle, posée à part comme un calque de la
 * taille de l'écran : ce qui l'amène là où la caméra la voit.
 *
 * POURQUOI UNE PAR SALLE (23/09). Jusque-là, les salles étaient emboîtées —
 * la salle 2 dans une boîte de 4 px au fond du « H », la salle Hermès dans la
 * porte du temple — et une seule transformation, sur toute la scène, les
 * grossissait ×457 et ×3 000. Le navigateur arrondit une position au
 * demi-pixel d'écran AVANT de la grossir : dès que la densité de l'écran
 * n'est pas 1, l'erreur devenait 150 à 200 px à l'écran. Mesuré chez Paul :
 * −206 px sur son 27" (densité 1,1), +158 px sur son 16" (1,25). La mise en
 * page était juste ; la peinture, fausse.
 *
 * Posée à part, une salle où l'on est N'A AUCUNE transformation : `none`,
 * grossissement 1, rien à arrondir. Pendant une transition, celle où l'on
 * arrive est RÉDUITE — une erreur réduite rapetisse — et celle qu'on quitte,
 * grossie, a déjà vidé ses éléments (la chorégraphie).
 *
 * C'est la même formule que la scène emboîtée : un point (a, b) de la salle
 * arrive à l'écran en ((salle.x + a·salle.w) − camera.x) / camera.w. Les
 * tests vérifient l'équivalence point par point.
 */
export function transformationSalle(salle: Cadre, camera: Cadre): string {
  const echelle = salle.w / camera.w;
  const u = (salle.x - camera.x) / camera.w;
  const v = (salle.y - camera.y) / camera.w;
  if (Math.abs(echelle - 1) < 1e-9 && Math.abs(u) < 1e-9 && Math.abs(v) < 1e-9) return 'none';
  // `translate` en pourcentage se rapporte au calque, qui a la taille de
  // l'écran : u et v sont donc déjà dans la bonne unité. Écrit AVANT `scale`,
  // il n'est pas grossi.
  return `translate(${(u * 100).toPrecision(10)}%, ${(v * 100).toPrecision(10)}%) scale(${echelle.toPrecision(10)})`;
}

/**
 * Le rectangle d'une zone d'une pièce, ramené en fractions d'écran.
 *
 * POURQUOI CETTE FONCTION EXISTE. Une toile WebGL ne peut pas vivre DANS la
 * scène : mesuré le 07/09, une toile de 373×373 posée dans la salle 2 n'était
 * peinte que sur 251×270, décalée de (122, 43), parce que la scène porte un
 * `transform: scale(457)` et que le navigateur compose la toile de travers.
 * Hors de la scène, la même toile est peinte à 300×300 sur 300×300 — exacte.
 * C'est la même leçon que pour la descente : « posée PAR-DESSUS la scène,
 * jamais dedans ».
 *
 * Il faut donc calculer soi-même OÙ la zone atterrit à l'écran. `zone` est
 * exprimée en fractions de la pièce ; le résultat l'est en fractions de
 * l'écran, prêt pour un `setViewport`. Le défilement est compris, puisqu'il
 * vit déjà dans `cadreAffiche`.
 */
export function zoneEcran(
  graphe: Graphe,
  racine: string,
  idPiece: string,
  cadreAffiche: Cadre,
  zone: Cadre,
): Cadre {
  const chemin = cheminProfondeur(graphe, racine);
  const k = chemin.indexOf(idPiece);
  if (k < 0) return { x: 0, y: 0, w: 0 }; // pièce hors de l'axe : rien à placer
  const piece = cadresEntiers(graphe, racine)[k]!;
  const t = transformation(cadreAffiche);
  const coin = projeter(t, piece.x + zone.x * piece.w, piece.y + zone.y * piece.w);
  return { x: coin.u, y: coin.v, w: zone.w * piece.w * t.echelle };
}

/** La largeur du cadre à une profondeur donnée. */
export function largeurA(graphe: Graphe, racine: string, d: number): number {
  return cadre(graphe, racine, d).w;
}

/**
 * L'inverse exact de `largeurA` : à quelle profondeur correspond une largeur.
 * Sert au glissement de la caméra, qui converge en LARGEUR (le mouvement doit
 * être géométrique) alors que tout le reste du code raisonne en profondeur.
 */
export function profondeurDe(graphe: Graphe, racine: string, w: number): number {
  const cadres = cadresEntiers(graphe, racine);
  const n = cadres.length - 1;
  const cible = borner(w, cadres[n]!.w, cadres[0]!.w);
  for (let k = 0; k < n; k++) {
    const a = cadres[k]!.w;
    const b = cadres[k + 1]!.w;
    if (cible >= b) return k + Math.log(cible / a) / Math.log(b / a);
  }
  return n;
}
