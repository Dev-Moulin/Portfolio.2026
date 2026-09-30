// La place des éléments de la salle 2 qu'on règle à la main : les trois textes
// (THP, INTUITION, l'intro) et le logo. Paul, le 25/09 : « je veux pouvoir
// déplacer les textes et le logo, et il refera la liaison en conséquence ».
//
// DEUX MOMENTS. Au REPOS, le titre et le logo occupent la salle. Quand les
// cartes apparaissent (à venir : elles naîtront de la fumée), les textes et le
// logo se déplacent d'abord pour leur faire de la place — « on fait un
// déplacement des textes et du logo, et là on fait la deuxième action avec
// l'apparition des cartes ». Chaque moment a donc sa place.
//
// Ce service GARDE les places. On les change à la souris avec l'outil
// `composants/placement-libre/`, qui n'existe qu'en développement ; une fois
// une place trouvée, ses valeurs partent dans `PLACE_REPOS` / `PLACE_CARTES`.
//
// POURQUOI ELLES SURVIVENT AU RECHARGEMENT, AVEC L'OUTIL SEULEMENT. Chaque
// enregistrement d'un fichier recharge la page : sans mémoire, Paul perdrait
// sa mise en place à chaque retouche du code. Le stockage du navigateur ne
// sert qu'à ça : il n'est lu que quand les outils de réglage sont affichés
// (`REGLAGES`), jamais en production.
//
// LE MOMENT, C'EST LA MOLETTE (25/09). La salle 2 se lit en deux temps, comme
// une carte de texte en deux pages : un cran vers le bas fait passer du repos
// aux cartes, un second descend à la salle suivante. Le moment n'est donc pas
// un état à part : c'est la « page » de la salle, tenue par `Navigation`
// (voir `Navigation.pieceSuivante`), et c'est elle que l'outil tourne aussi.

import { Injectable, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { ECART_Y } from './coeur/embleme';
import { PROJETS } from './coeur/contenu';
import { Navigation } from './navigation';

/**
 * Les outils de réglage (la règle des emblèmes, le placement libre) : en
 * développement, et seulement avec « ?reglages » dans l'adresse. Les places
 * sont trouvées (Paul, 25/09) : les outils ne servaient plus qu'à prendre de
 * la place. Masqués, pas supprimés.
 */
export const REGLAGES =
  isDevMode() &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('reglages');

/** La salle dont on règle les places. */
const SALLE = 'projets';

/** Les moments de la salle, dans l'ordre de la molette : ses « pages ». */
export const MOMENTS: readonly Moment[] = ['repos', 'cartes'];

/** Au téléphone : le repos, puis une page par carte (voir `carteMontree`). */
export const PAGES_ETROIT = 1 + PROJETS.length;

/**
 * Un décalage de texte, en centièmes de la salle (`x` de sa largeur, `y` de sa
 * hauteur), compté depuis la place d'origine du titre (`ANCRE_TITRE_Y`).
 */
export interface Decalage {
  readonly x: number;
  readonly y: number;
}

export type Deplacable = 'thp' | 'intuition' | 'intro';
export type Moment = 'repos' | 'cartes';

export interface Place {
  readonly textes: Readonly<Record<Deplacable, Decalage>>;
  /** Le logo : l'écart de la règle, en fractions de fenêtre. */
  readonly logoX: number;
  readonly logoY: number;
  /**
   * Un flottement doux du logo autour de sa place, ou rien : l'amplitude,
   * en fractions de fenêtre (`x` de la largeur, `y` de la hauteur).
   */
  readonly flottement?: { readonly x: number; readonly y: number };
}

/**
 * LE REPOS, placé à la main par Paul le 25/09 (logo à 0,180 de large). Les
 * deux mots ont reçu la MOYENNE de leurs deux hauteurs (5,94 et 6,40), pour
 * être au même niveau, et le logo son centre exact ; INTUITION s'est ensuite
 * écarté du logo (3,36 → 6,03) et le logo est descendu (+198 → +212 px sur 999).
 */
const HAUTEUR_MOTS = (5.940594059405943 + 6.397562833206403) / 2;
export const PLACE_REPOS: Place = {
  textes: {
    thp: { x: -11.853448275862053, y: HAUTEUR_MOTS },
    intuition: { x: 6.034482758620692, y: HAUTEUR_MOTS },
    intro: { x: 0, y: 0 },
  },
  logoX: 0,
  logoY: ECART_Y,
};

/**
 * LES CARTES (Paul, 25/09). Seul le logo bouge : il monte, et flotte
 * doucement autour de sa place. Réglé deux fois le 25/09 : d'abord à −370 px
 * (±10 px de haut, ±4 px de côté, sur 1864 × 999), puis descendu de 20 px
 * — « il est un petit peu trop haut » — et un pixel de flottement de plus
 * dans toutes les directions : entre −339 et −361 px, ±5 px de côté. Les
 * textes restent où ils sont — « je sais pas encore si ça va me gêner ». Les
 * amplitudes sont en fractions de fenêtre, pour valoir la même chose sur tous
 * les écrans.
 */
export const PLACE_CARTES: Place = {
  textes: PLACE_REPOS.textes,
  logoX: 0,
  logoY: -350 / 999,
  flottement: { x: 5 / 1864, y: 11 / 999 },
};

/**
 * AU TÉLÉPHONE, placé au doigt par Paul le 29/09 sur son iPhone (393 × 852),
 * logo à 0,400 de large : les deux mots au même niveau, l'intro juste
 * dessous, le logo à +213 px. Les mots remontés ensuite de 20 px (même jour).
 */
const HAUTEUR_MOTS_ETROIT = 16.15 - (20 / 852) * 100;
export const PLACE_REPOS_ETROIT: Place = {
  textes: {
    thp: { x: -15.16, y: HAUTEUR_MOTS_ETROIT },
    intuition: { x: 2.22, y: HAUTEUR_MOTS_ETROIT },
    intro: { x: 0, y: 14.32 },
  },
  logoX: 0,
  logoY: 213 / 852,
};

/**
 * Les cartes, au téléphone : les deux mots montent de 15 px (Paul, 29/09) ;
 * l'intro et le logo gardent la place qu'ils avaient jusque-là aux cartes.
 */
const MONTEE_MOTS_ETROIT = (15 / 852) * 100;
export const PLACE_CARTES_ETROIT: Place = {
  ...PLACE_CARTES,
  textes: {
    ...PLACE_REPOS_ETROIT.textes,
    thp: { ...PLACE_REPOS_ETROIT.textes.thp, y: HAUTEUR_MOTS_ETROIT - MONTEE_MOTS_ETROIT },
    intuition: { ...PLACE_REPOS_ETROIT.textes.intuition, y: HAUTEUR_MOTS_ETROIT - MONTEE_MOTS_ETROIT },
  },
};

type Format = 'large' | 'etroit';
type Places = Readonly<Record<Moment, Place>>;

const DEPART: Readonly<Record<Format, Places>> = {
  large: { repos: PLACE_REPOS, cartes: PLACE_CARTES },
  etroit: { repos: PLACE_REPOS_ETROIT, cartes: PLACE_CARTES_ETROIT },
};

/** La place du code, pour un format et un moment. */
export function placeDepart(format: Format, moment: Moment): Place {
  return DEPART[format][moment];
}

/** Changer la clé oublie les places gardées : à faire quand on en fige dans le code. */
const CLE = 'pz-placement-salle2-v4';
const CLE_FLUX = 'pz-flux-salle2-v3';

/**
 * Les filaments des flux : combien par particule en vol, et leur portée en
 * pixels, qui VARIE entre deux bornes. Réglés par Paul le 25/09 : 8 filaments
 * (il y en avait 2), et une portée qui monte et descend entre 43 et 60 px,
 * « pas brutalement mais aléatoirement et progressivement ».
 */
export const FLUX_DEPART = { voisins: 8, porteeMin: 43, porteeMax: 60 } as const;
export const FLUX_VOISINS_MAX = 8;

/**
 * Au téléphone, réglés par Paul le 29/09 sur son iPhone : 5 filaments, et une
 * portée qui varie entre 10 et 25 px — ceux du bureau faisaient un pâté sur
 * un écran quatre fois plus petit.
 */
const FLUX_DEPART_ETROIT = { voisins: 5, porteeMin: 10, porteeMax: 25 } as const;

type Flux = { voisins: number; porteeMin: number; porteeMax: number };

function lireFlux(format: Format): Flux {
  const depart = format === 'etroit' ? FLUX_DEPART_ETROIT : FLUX_DEPART;
  if (!REGLAGES || typeof localStorage === 'undefined') return { ...depart };
  try {
    const brut = localStorage.getItem(`${CLE_FLUX}-${format}`);
    return brut === null ? { ...depart } : { ...depart, ...JSON.parse(brut) };
  } catch {
    return { ...depart };
  }
}

/** Les places de chaque format : chacun a les siennes (Paul, 29/09). */
function lire(): Readonly<Record<Format, Places>> {
  if (!REGLAGES || typeof localStorage === 'undefined') return DEPART;
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) return DEPART;
    const lu = JSON.parse(brut) as Partial<Record<Format, Partial<Places>>>;
    const fondre = (f: Format, m: Moment): Place => ({
      ...DEPART[f][m],
      ...lu[f]?.[m],
      textes: { ...DEPART[f][m].textes, ...lu[f]?.[m]?.textes },
    });
    const format = (f: Format): Places => ({ repos: fondre(f, 'repos'), cartes: fondre(f, 'cartes') });
    return { large: format('large'), etroit: format('etroit') };
  } catch {
    return DEPART;
  }
}

@Injectable({ providedIn: 'root' })
export class Placement {
  private readonly nav = inject(Navigation);
  private readonly places = signal(lire());
  /**
   * Le moment affiché : la page où en est la salle (voir l'en-tête). Au
   * téléphone, la salle a une page par carte (`PAGES_ETROIT`) : toutes sont
   * le moment des cartes.
   */
  readonly moment = computed<Moment>(() =>
    (this.nav.pages().get(SALLE)?.page ?? 0) === 0 ? 'repos' : 'cartes',
  );
  /**
   * UNE CARTE À LA FOIS AU TÉLÉPHONE (Paul, 29/09) : côte à côte, les trois
   * y étaient trop serrées. Chaque geste en fait naître une de la fumée —
   * Intuition, puis Overmind 3D, puis Founders — et remonter les rend dans
   * l'autre sens. L'indice de celle qu'on montre ; `null` au grand écran,
   * où les trois sont là ensemble.
   */
  readonly carteMontree = computed<number | null>(() =>
    this.nav.format() === 'etroit' && this.moment() === 'cartes'
      ? (this.nav.pages().get(SALLE)?.page ?? 1) - 1
      : null,
  );
  /**
   * Les cartes sont là : on est POSÉ dans la salle, au moment des cartes. Le
   * moment seul ne suffit pas — il reste aux cartes quand on descend à la
   * salle suivante, et c'est voulu : en remontant, le logo est déjà en place
   * et les cartes renaissent de la fumée une fois la caméra posée.
   */
  readonly cartesRevelees = computed(
    () =>
      this.moment() === 'cartes' &&
      this.nav.sallePresente() === SALLE &&
      // En partant, les cartes s'en vont D'ABORD, seules, dans leur fumée ;
      // la salle ne part qu'ensuite (`ATTENTE_AU_DEPART`).
      this.nav.salleEnPartance() !== SALLE,
  );
  readonly courante = computed(() => this.places()[this.nav.format()][this.moment()]);
  /** Toutes les places du format affiché, pour les copier. */
  readonly toutes = computed(() => this.places()[this.nav.format()]);

  /** Lus au démarrage, dans le format de l'écran. */
  private readonly formatDepart = this.nav.format();
  private readonly fluxDepart = lireFlux(this.formatDepart);
  /** Combien de filaments par particule en vol, et entre quelles portées (px). */
  readonly fluxVoisins = signal(this.fluxDepart.voisins);
  readonly fluxPorteeMin = signal(this.fluxDepart.porteeMin);
  readonly fluxPorteeMax = signal(this.fluxDepart.porteeMax);

  constructor() {
    if (!REGLAGES || typeof localStorage === 'undefined') return;
    effect(() => {
      const places = this.places();
      const flux = {
        voisins: this.fluxVoisins(),
        porteeMin: this.fluxPorteeMin(),
        porteeMax: this.fluxPorteeMax(),
      };
      try {
        localStorage.setItem(CLE, JSON.stringify(places));
        localStorage.setItem(`${CLE_FLUX}-${this.formatDepart}`, JSON.stringify(flux));
      } catch {
        // Stockage refusé (navigation privée) : on garde les places pour la séance.
      }
    });
  }

  private changer(f: (p: Place) => Place): void {
    const m = this.moment();
    const fo = this.nav.format();
    this.places.update((ps) => ({ ...ps, [fo]: { ...ps[fo], [m]: f(ps[fo][m]) } }));
  }

  /** Ajoute un déplacement de texte, en centièmes de la salle. */
  deplacer(qui: Deplacable, dx: number, dy: number): void {
    this.changer((p) => ({
      ...p,
      textes: { ...p.textes, [qui]: { x: p.textes[qui].x + dx, y: p.textes[qui].y + dy } },
    }));
  }

  /** Ajoute un déplacement du logo, en fractions de fenêtre. */
  deplacerLogo(dx: number, dy: number): void {
    this.changer((p) => ({ ...p, logoX: p.logoX + dx, logoY: p.logoY + dy }));
  }

  /** Pose le logo, pour la règle des emblèmes. */
  poserLogo(place: { x?: number; y?: number }): void {
    this.changer((p) => ({ ...p, logoX: place.x ?? p.logoX, logoY: place.y ?? p.logoY }));
  }

  /** Passe à un moment, comme la molette : c'est la page de la salle qui tourne. */
  montrer(moment: Moment): void {
    this.nav.allerPage(SALLE, MOMENTS.indexOf(moment));
  }

  /** Le moment affiché revient à sa place du code. */
  revenir(): void {
    this.changer(() => DEPART[this.nav.format()][this.moment()]);
  }
}
