// Le nuage de particules d'un logo, et les filaments qui le tiennent. Module
// pur : ni DOM, ni Three.js, ni Angular. La lecture de l'image et le rendu
// vivent ailleurs ; ici il n'y a que des nombres, donc des tests.

/** Un point du nuage. `z` vaut 0 tant que la source est plate. */
export interface Particule {
  x: number;
  y: number;
  z: number;
}

/** Une source d'aléa injectable, pour que les tests soient reproductibles. */
export type Hasard = () => number;

/**
 * Le niveau du fond, mesuré comme le niveau de gris DOMINANT de l'image.
 *
 * Ni une constante ni les quatre coins : le PNG du logo est un badge rond
 * posé sur du noir pur, donc ses coins valent 0 alors que son champ vaut 10
 * (#0a0a0a, la couleur mesurée de la référence Intuition). Prendre les coins
 * ferait produire des particules à tout le disque ; prendre le niveau
 * dominant retrouve le vrai fond, et le noir pur passe alors sous lui — donc
 * à densité nulle, ce qu'on veut.
 */
export function fondDominant(luminances: readonly number[]): number {
  const comptes = new Map<number, number>();
  for (const l of luminances) {
    const niveau = Math.round(l);
    comptes.set(niveau, (comptes.get(niveau) ?? 0) + 1);
  }
  let dominant = 0;
  let meilleur = -1;
  for (const [niveau, compte] of comptes) {
    if (compte > meilleur) {
      meilleur = compte;
      dominant = niveau;
    }
  }
  return dominant;
}

/**
 * La densité de particules d'après la luminosité, le fond retiré.
 *
 * C'est la même règle que pour la figure de la salle 2 : le noir ne se
 * détoure pas, il disparaît. Un pixel au niveau du fond — ou plus sombre que
 * lui, ce qui est le cas du disque plein au centre du logo — ne produit
 * aucune particule ; seules les hautes lumières de l'anneau en produisent, et
 * d'autant plus qu'elles sont claires.
 *
 * `plancher` vient de l'aperçu : le champ du badge n'est pas plat, il tremble
 * de quelques niveaux (8 à 14 autour d'un fond à 10). Chacun de ces pixels ne
 * pèse presque rien, mais ils sont dix mille et finissent par tirer. Un pixel
 * doit donc dépasser le fond d'au moins `plancher` niveaux pour compter ; le
 * bord anticrénelé de l'anneau, lui, monte bien au-dessus.
 *
 * Ce que le plancher ne règle PAS, et qu'il ne faut pas lui prêter : les
 * particules isolées loin du centre ne sont pas du bruit, c'est la jante du
 * badge — un cercle fin et lumineux au rayon 45-55 px, qui pèse 7,8 % de la
 * densité. Fin et long, il reçoit peu de particules, donc ses filaments
 * s'étirent. Le garder ou non est une décision de dessin, pas de seuil.
 */
export function densiteDepuisLuminance(
  luminances: readonly number[],
  fond: number,
  plancher = 0,
): readonly number[] {
  return luminances.map((l) => (l - fond >= plancher ? Math.max(0, l - fond) : 0));
}

/** Une zone rectangulaire d'une image, en fractions de sa largeur/hauteur. */
export interface ZoneImage {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * La densité multipliée dans une zone, pour les détails trop fins.
 *
 * POURQUOI. Le tirage est proportionnel à la densité, donc à la SURFACE
 * allumée : un détail fin reçoit peu de particules même s'il porte tout le
 * sens. Mesuré sur le logo THP : les lettres « THP » ne pèsent que 4 % du
 * dessin, donc à 2600 particules elles n'en reçoivent qu'une centaine — trois
 * lettres illisibles. Les renforcer ne fausse rien : ça ne fait que corriger
 * le fait que la surface n'est pas l'importance.
 */
export function renforcer(
  densite: readonly number[],
  largeur: number,
  zone: ZoneImage,
  facteur: number,
): readonly number[] {
  const hauteur = densite.length / largeur;
  return densite.map((d, i) => {
    const u = (i % largeur) / largeur;
    const v = Math.floor(i / largeur) / hauteur;
    const dedans = u >= zone.x0 && u <= zone.x1 && v >= zone.y0 && v <= zone.y1;
    return dedans ? d * facteur : d;
  });
}

/** Un logo à afficher : sa géométrie, et ses zones à renforcer s'il en a. */
export interface LogoDefini {
  source: string;
  zonesFines?: readonly ZoneRenforcee[];
}

/**
 * L'ordre des particules par angle autour du centre.
 *
 * C'EST L'APPARIEMENT DU MORPHE. Deux logos triés de la même façon voient
 * leur particule i partir d'un angle et arriver à un angle voisin : la
 * transformation devient un mouvement tournant qu'on suit des yeux. Sans tri,
 * chaque point traverserait le logo en diagonale au hasard, et on ne verrait
 * qu'un brouillard entre deux dessins.
 */
export function trierParAngle(particules: readonly Particule[]): number[] {
  return particules
    .map((p, i) => ({ i, angle: Math.atan2(p.y, p.x) }))
    .sort((a, b) => a.angle - b.angle)
    .map((e) => e.i);
}

/** Une zone à renforcer : plus de particules, et si besoin moins d'épaisseur. */
export interface ZoneRenforcee {
  zone: ZoneImage;
  /** Par combien la densité y est multipliée. */
  renfort: number;
  /** L'épaisseur de flanc à y appliquer, en fraction de la largeur. */
  flanc?: number;
}

/** Vrai si une particule normalisée vient de cette zone de l'image. */
export function dansLaZone(
  p: Particule,
  zone: ZoneImage,
  largeur: number,
  hauteur: number,
): boolean {
  const taille = Math.max(largeur, hauteur);
  const u = (p.x * taille + largeur / 2) / largeur;
  const v = (hauteur / 2 - p.y * taille) / hauteur;
  return u >= zone.x0 && u <= zone.x1 && v >= zone.y0 && v <= zone.y1;
}

/**
 * `nombre` particules tirées au sort dans la grille, en proportion de la
 * densité. Les coordonnées sortent centrées, et l'axe Y est retourné : une
 * image descend, une scène 3D monte.
 *
 * Les deux axes sont divisés par la MÊME taille, celle du plus grand côté :
 * sinon une image de 850×768 verrait son contenu étiré de 11 % en hauteur,
 * puisque chaque axe serait ramené à [-0,5 ; 0,5] indépendamment. Un logo
 * déformé de 11 % est un logo faux.
 *
 * Le tirage est proportionnel et non par seuil, parce qu'un seuil rendrait
 * l'anticrénelage de l'anneau aussi dense que son cœur — le bord paraîtrait
 * épais et sale. Chaque particule est aussi décalée à l'intérieur de son
 * pixel, sans quoi le nuage trahirait la grille de l'image.
 */
export function echantillonner(
  densite: readonly number[],
  largeur: number,
  hauteur: number,
  nombre: number,
  hasard: Hasard = Math.random,
): Particule[] {
  const cumul: number[] = [];
  let total = 0;
  for (const d of densite) {
    total += d;
    cumul.push(total);
  }
  if (total <= 0 || nombre <= 0) return [];

  const taille = Math.max(largeur, hauteur);
  const particules: Particule[] = [];
  for (let n = 0; n < nombre; n++) {
    const indice = indiceCumule(cumul, hasard() * total);
    const px = indice % largeur;
    const py = Math.floor(indice / largeur);
    particules.push({
      x: (px + hasard() - largeur / 2) / taille,
      y: (hauteur / 2 - (py + hasard())) / taille,
      z: 0,
    });
  }
  return particules;
}

/** Le premier indice dont le cumul dépasse `cible`, par dichotomie. */
function indiceCumule(cumul: readonly number[], cible: number): number {
  let bas = 0;
  let haut = cumul.length - 1;
  while (bas < haut) {
    const milieu = (bas + haut) >> 1;
    if (cumul[milieu]! < cible) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

/**
 * Les paires de particules à relier. Mot de Paul, en capitales : il est
 * INDISPENSABLE d'avoir des filaments de liaison — des points isolés font un
 * ciel étoilé, pas un réseau.
 *
 * Deux garde-fous : `distanceMax`, pour qu'un filament ne traverse jamais le
 * vide du logo, et `maxParPoint`, sans lequel les zones denses deviendraient
 * un bloc opaque alors que les zones claires resteraient nues. Les paires
 * sont dédoublonnées : un filament appartient aux deux particules.
 *
 * La distance est calculée en 3D pour que la fonction serve telle quelle au
 * nuage tiré du maillage Blender, où z ne sera plus nul.
 */
export function filaments(
  particules: readonly Particule[],
  distanceMax: number,
  maxParPoint: number,
): readonly (readonly [number, number])[] {
  const carreMax = distanceMax * distanceMax;
  const paires = new Set<string>();
  const liens: [number, number][] = [];

  for (let i = 0; i < particules.length; i++) {
    const proches: { j: number; carre: number }[] = [];
    for (let j = 0; j < particules.length; j++) {
      if (i === j) continue;
      const carre = carreDistance(particules[i]!, particules[j]!);
      if (carre <= carreMax) proches.push({ j, carre });
    }
    proches.sort((a, b) => a.carre - b.carre);
    for (const { j } of proches.slice(0, maxParPoint)) {
      const cle = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (paires.has(cle)) continue;
      paires.add(cle);
      liens.push(i < j ? [i, j] : [j, i]);
    }
  }
  return liens;
}

/**
 * Le nuage recentré, mis à l'échelle, et tourné pour faire face à la caméra.
 *
 * Sans ça, le composant dépendrait de l'endroit où l'objet se trouve dans la
 * scène Blender : les anneaux d'Intuition sont posés en (3,37 ; -1,91 ; 2,85)
 * et tournés, ce qui les mettrait hors champ. On ne veut pas non plus coder
 * cette position en dur — elle changerait au prochain export.
 *
 * L'axe le plus MINCE du nuage est forcément la normale de l'anneau : on
 * l'amène sur z, par une permutation CIRCULAIRE des coordonnées. Le détail
 * compte : échanger deux axes serait un miroir, et un logo miroir est un logo
 * faux. Une permutation circulaire est une rotation, elle ne retourne rien.
 */
export function normaliser(particules: readonly Particule[]): Particule[] {
  if (particules.length === 0) return [];

  const axes = ['x', 'y', 'z'] as const;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of particules) {
    for (const a of axes) {
      min[a] = Math.min(min[a], p[a]);
      max[a] = Math.max(max[a], p[a]);
    }
  }
  const centre = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const etendue = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };

  // L'axe le plus mince, puis la permutation circulaire qui l'amène sur z.
  const mince = axes.reduce((a, b) => (etendue[a] <= etendue[b] ? a : b));
  const permute = (p: Particule): Particule => {
    const c = { x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z };
    if (mince === 'x') return { x: c.y, y: c.z, z: c.x };
    if (mince === 'y') return { x: c.z, y: c.x, z: c.y };
    return c;
  };

  // L'échelle se prend dans le PLAN de l'anneau, pas sur son épaisseur : le
  // nuage doit occuper une unité en largeur, quelle que soit sa minceur.
  const permutees = particules.map(permute);
  const largeur = Math.max(
    ...permutees.map((p) => Math.abs(p.x)),
    ...permutees.map((p) => Math.abs(p.y)),
  );
  const facteur = largeur > 0 ? 0.5 / largeur : 1;
  return permutees.map((p) => ({ x: p.x * facteur, y: p.y * facteur, z: p.z * facteur }));
}

function carreDistance(a: Particule, b: Particule): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
