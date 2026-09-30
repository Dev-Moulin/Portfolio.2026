// Le « tapis roulant » vidéo des décors : la partie pure, sans navigateur.
//
// LE PROBLÈME. Une vidéo `loop` n'est pas une boucle parfaite : arrivé au bout
// du fichier, le lecteur revient au début, vide son décodeur et repart. Mesuré
// dans Chrome le 23/09 : à chaque tour, un événement « attente » et une image
// qui reste 50 ms au lieu de 42. Sur une machine chargée, c'est là que la
// boucle accroche — et là que Chrome la perd parfois. L'équipe de Chrome le
// dit elle-même : pas de boucle sans couture garantie avec `loop`, passer par
// Media Source Extensions (Dale Curtis, liste WHATWG, 2014).
//
// LE PRINCIPE. Avec MSE, c'est la page qui remplit la vidéo, morceau par
// morceau. On pose la boucle sur le tapis en la déclarant de 0 à 18 s, puis
// la même de 18 à 36, de 36 à 54… et on retire ce qui a été joué. Le lecteur
// voit UNE vidéo sans fin : il ne revient jamais au début, rien ne se vide.
// Pour la salle Hermès, l'apparition (8 s) est posée d'abord, une fois, et
// les tours de boucle à sa suite : même le relais entre les deux disparaît.
//
// Ici : lire une piste (MP4 fragmenté, voir `scripts/pistes-video.sh`),
// décider quels morceaux poser et quoi retirer. Le branchement au navigateur
// est dans `composants/tapis-video/`.

/** Une piste lue : son en-tête, et ses deux parties prêtes à poser. */
export interface PisteLue {
  /** Le codec, tel que `MediaSource.isTypeSupported` l'attend. */
  readonly codec: string;
  /** L'en-tête (`ftyp` + `moov`) : posé une seule fois. */
  readonly entete: Uint8Array;
  /** L'apparition : les fragments avant `intro` secondes (vide sans intro). */
  readonly intro: Uint8Array;
  /** La boucle : les fragments à partir de `intro` secondes. */
  readonly boucle: Uint8Array;
}

interface Boite {
  readonly type: string;
  readonly debut: number;
  readonly contenu: number;
  readonly fin: number;
}

function* boites(o: Uint8Array, debut: number, fin: number): Generator<Boite> {
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  let p = debut;
  while (p + 8 <= fin) {
    let taille = v.getUint32(p);
    const type = String.fromCharCode(o[p + 4]!, o[p + 5]!, o[p + 6]!, o[p + 7]!);
    let entete = 8;
    if (taille === 1) {
      taille = Number(v.getBigUint64(p + 8));
      entete = 16;
    } else if (taille === 0) {
      taille = fin - p;
    }
    if (taille < entete || p + taille > fin) return; // fichier tronqué : on s'arrête
    yield { type, debut: p, contenu: p + entete, fin: p + taille };
    p += taille;
  }
}

/**
 * Descend un chemin de boîtes. Quelques boîtes ont un préambule avant leurs
 * enfants : `stsd` (8 octets), et les entrées vidéo `avc1`/`vp09` (78).
 */
function trouver(o: Uint8Array, chemin: readonly string[], debut = 0, fin = o.byteLength): Boite | null {
  for (const b of boites(o, debut, fin)) {
    if (b.type !== chemin[0]) continue;
    if (chemin.length === 1) return b;
    const saut = b.type === 'stsd' ? 8 : b.type === 'avc1' || b.type === 'vp09' ? 78 : 0;
    const r = trouver(o, chemin.slice(1), b.contenu + saut, b.fin);
    if (r !== null) return r;
  }
  return null;
}

const DESCRIPTION = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'];

function codecDe(o: Uint8Array): string {
  const avc = trouver(o, [...DESCRIPTION, 'avc1', 'avcC']);
  if (avc !== null) {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    const c = avc.contenu;
    return `avc1.${h(o[c + 1]!)}${h(o[c + 2]!)}${h(o[c + 3]!)}`;
  }
  const vp = trouver(o, [...DESCRIPTION, 'vp09', 'vpcC']);
  if (vp !== null) {
    const c = vp.contenu + 4; // boîte « pleine » : version et drapeaux d'abord
    const d = (n: number) => String(n).padStart(2, '0');
    return `vp09.${d(o[c]!)}.${d(o[c + 1]!)}.${d(o[c + 2]! >> 4)}`;
  }
  throw new Error('piste : codec inconnu (ni avc1 ni vp09)');
}

function echelleDe(o: Uint8Array): number {
  const b = trouver(o, ['moov', 'trak', 'mdia', 'mdhd']);
  if (b === null) throw new Error('piste : pas de mdhd');
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  return v.getUint32(b.contenu + (o[b.contenu] === 0 ? 12 : 20));
}

function debutFragment(o: Uint8Array, moof: Boite, echelle: number): number {
  const b = trouver(o, ['traf', 'tfdt'], moof.contenu, moof.fin);
  if (b === null) throw new Error('piste : fragment sans tfdt');
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  const t = o[b.contenu] === 1 ? Number(v.getBigUint64(b.contenu + 4)) : v.getUint32(b.contenu + 4);
  return t / echelle;
}

/**
 * Découpe une piste en en-tête, apparition et boucle. `intro` : la durée de
 * l'apparition en secondes (0 s'il n'y en a pas) ; elle DOIT tomber sur une
 * frontière de fragment, sinon la couture ne serait pas à l'image près.
 */
export function lirePiste(o: Uint8Array, intro: number): PisteLue {
  const echelle = echelleDe(o);
  let finEntete = -1;
  const fragments: { debut: number; de: number; a: number }[] = [];
  let ouvert: { debut: number; de: number } | null = null;
  for (const b of boites(o, 0, o.byteLength)) {
    if (b.type === 'moov') finEntete = b.fin;
    if (b.type === 'moof') ouvert = { debut: debutFragment(o, b, echelle), de: b.debut };
    if (b.type === 'mdat' && ouvert !== null) {
      fragments.push({ ...ouvert, a: b.fin });
      ouvert = null;
    }
  }
  if (finEntete < 0 || fragments.length === 0) throw new Error('piste : pas un MP4 fragmenté');
  const tolerance = 1e-3;
  const avant = fragments.filter((f) => f.debut < intro - tolerance);
  const apres = fragments.filter((f) => f.debut >= intro - tolerance);
  if (intro > 0 && Math.abs((apres[0]?.debut ?? -1) - intro) > tolerance) {
    throw new Error(`piste : l'apparition ne finit pas sur une frontière de fragment (${intro} s)`);
  }
  const tranche = (fs: typeof fragments) =>
    fs.length === 0 ? new Uint8Array(0) : o.subarray(fs[0]!.de, fs[fs.length - 1]!.a);
  return { codec: codecDe(o), entete: o.subarray(0, finEntete), intro: tranche(avant), boucle: tranche(apres) };
}

// — Le planning du tapis —

/** Un morceau à poser : l'apparition, ou le k-ième tour de boucle. */
export interface Morceau {
  readonly quoi: 'intro' | 'boucle';
  /** Le décalage à donner à `SourceBuffer.timestampOffset`. */
  readonly decalage: number;
  /** Où il se place sur le tapis, en secondes. */
  readonly debut: number;
  readonly fin: number;
}

export type Plages = readonly (readonly [number, number])[];

/** Ce que MSE a déjà en réserve (`SourceBuffer.buffered`), en paires. */
export function plagesDe(r: { length: number; start(i: number): number; end(i: number): number }): Plages {
  const p: [number, number][] = [];
  for (let i = 0; i < r.length; i++) p.push([r.start(i), r.end(i)]);
  return p;
}

/** Le morceau qui couvre l'instant `t` du tapis. */
export function morceauA(t: number, intro: number, duree: number): Morceau {
  if (intro > 0 && t < intro) return { quoi: 'intro', decalage: 0, debut: 0, fin: intro };
  const k = Math.max(0, Math.floor((t - intro) / duree));
  const debut = intro + k * duree;
  // Les fragments de boucle portent leurs temps d'origine, qui commencent à
  // `intro` : le k-ième tour se décale donc de k durées.
  return { quoi: 'boucle', decalage: k * duree, debut, fin: debut + duree };
}

/** Une plage de la réserve couvre-t-elle [debut, fin] ? */
function couvert(plages: Plages, debut: number, fin: number): boolean {
  // MSE arrondit les bords à l'image : on tolère un peu moins d'une image.
  const tol = 0.03;
  return plages.some(([a, b]) => a <= debut + tol && b >= fin - tol);
}

/**
 * Le prochain morceau à poser pour que la réserve couvre [t, t + horizon],
 * ou `null` si c'est déjà le cas. Un seul à la fois : un `SourceBuffer` ne
 * prend qu'un ajout à la fois.
 */
export function prochainMorceau(t: number, horizon: number, intro: number, duree: number, plages: Plages): Morceau | null {
  let m = morceauA(t, intro, duree);
  while (m.debut <= t + horizon) {
    if (!couvert(plages, Math.max(m.debut, t), m.fin)) return m;
    m = morceauA(m.fin, intro, duree);
  }
  return null;
}

/**
 * Ce qu'il faut retirer de la réserve : tout ce qui est loin derrière `t`, et
 * tout ce qui est loin devant (après un retour au début, les tours d'avant
 * restent en mémoire). Garde `derriere` secondes derrière et `devant` devant.
 */
export function aRetirer(t: number, derriere: number, devant: number, plages: Plages): Plages {
  const bas = Math.max(0, t - derriere);
  const haut = t + devant;
  const r: [number, number][] = [];
  for (const [a, b] of plages) {
    if (a < bas - 0.5) r.push([a, Math.min(b, bas)]);
    if (b > haut + 0.5) r.push([Math.max(a, haut), b]);
  }
  return r;
}
