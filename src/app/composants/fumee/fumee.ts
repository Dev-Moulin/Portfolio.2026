// La fumée d'où naissent les cartes de la salle 2 (Paul, 25/09 : « le petit
// brouillard » qui les fait apparaître).
//
// UN SANDWICH À TROIS COUCHES. Derrière, la vidéo du temple et sa propre
// brume ; au milieu, les cartes de verre ; devant, cette fumée. Elle
// s'épaissit sur les cartes pendant que leur verre se forme (`projets.css`),
// puis se dissipe EN COMMENÇANT PAR LE CENTRE de chaque carte : la carte a
// l'air de sortir de la brume, et pas d'un rond qui s'agrandit. Les courbes
// dans le temps sont dans `coeur/fumee.ts`.
//
// POURQUOI UNE TOILE À ELLE, ET EN PETIT. Une fumée est floue par nature : la
// calculer au tiers de la taille de l'écran ne se voit pas, et coûte neuf fois
// moins de pixels — c'est le navigateur qui l'agrandit en l'affichant, sans
// rien calculer. La toile du logo, elle, doit rester nette ; y loger la fumée
// obligerait à la calculer à part puis à la recopier en grand, pour le même
// résultat et plus de travail.
//
// ELLE NE TOURNE QUE QUAND IL Y A DE LA FUMÉE. Hors des bouffées, la boucle est
// arrêtée et la toile masquée : rien à peindre, rien à composer.
//
// SES COULEURS VIENNENT DU DÉCOR. Mesurées sur la vidéo du temple : sa brume
// est un gris à peine froid (le bleu passe le rouge de 1 à 4 sur 255), sombre
// dans l'épaisseur, et la colonne de lumière qui l'éclaire d'en haut monte à
// 105-113. La fumée reprend ce gris, éclairé par le haut.
//
// MOUVEMENT RÉDUIT : pas de fumée, les cartes apparaissent seules.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import {
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';
import { Placement } from '../../placement';
import { epaisseur, vivantes, type Bouffee, type Genre } from '../../coeur/fumee';

/** Un pixel de fumée pour 3 × 3 pixels d'écran. */
const REDUCTION = 3;
/** Combien de cartes la fumée sait envelopper. */
const CARTES_MAX = 4;
/** Relire la place des cartes toutes les N images : elles suivent la caméra au départ. */
const RELEVE = 4;

const SOMMETS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENTS = /* glsl */ `
  uniform vec2 uTaille;
  uniform float uTemps;
  uniform float uEpaisseur;
  uniform vec4 uCartes[${CARTES_MAX}];
  uniform int uNombre;
  varying vec2 vUv;

  float hachage(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float bruit(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hachage(i);
    float b = hachage(i + vec2(1.0, 0.0));
    float c = hachage(i + vec2(0.0, 1.0));
    float d = hachage(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Un bruit sommé sur « octaves » échelles, ramené entre 0 et 1. Les
  // déformations et les nappes sont larges : trois octaves leur suffisent, et
  // c'est un quart du calcul en moins (mesuré sur l'iGPU, 25/09).
  float fbm(vec2 p, int octaves) {
    float s = 0.0;
    float a = 0.5;
    float total = 0.0;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      if (i >= octaves) break;
      s += a * bruit(p);
      total += a;
      p = r * p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return s / total;
  }

  void main() {
    // En HAUTEURS d'écran, y vers le bas : les unités des cartes (voir
    // releverCartes), et un bruit qui ne s'étire pas avec la fenêtre.
    vec2 p = vec2(vUv.x * uTaille.x / uTaille.y, 1.0 - vUv.y);

    // LA NAPPE (Paul, 25/09, sur croquis). UNE seule fumée posée au sol, qui
    // contient les trois cartes ENTIÈRES, coins compris : un plateau
    // au-dessus d'elles, avec un léger creux entre deux cartes, une pente en
    // S de chaque côté de la rangée, et une traîne fine qui court au ras du
    // sol jusqu'au bord de l'écran. Deux essais avant : les rectangles des
    // cartes agrandis (leur haut faisait une ligne droite, et leurs coins une
    // cassure), puis un ovale par carte (les coins des cartes en dépassaient,
    // et l'œil y relisait les rectangles).
    // c : la distance au centre de la carte la plus proche, 1 sur son bord.
    float c = 10.0;
    float gauche = 10.0;
    float droite = -10.0;
    float dessus = 10.0;
    float dessous = -10.0;
    // La distance au milieu du jour le plus proche entre deux cartes. Les
    // cartes sont relevées dans l'ordre de la page, qui est celui de la rangée.
    float jour = 10.0;
    float droitePrecedente = 0.0;
    for (int i = 0; i < ${CARTES_MAX}; i++) {
      if (i >= uNombre) break;
      vec2 q = p - uCartes[i].xy;
      vec2 h = uCartes[i].zw;
      c = min(c, length(q / h));
      gauche = min(gauche, uCartes[i].x - h.x);
      droite = max(droite, uCartes[i].x + h.x);
      dessus = min(dessus, uCartes[i].y - h.y);
      dessous = max(dessous, uCartes[i].y + h.y);
      if (i > 0) jour = min(jour, abs(p.x - (droitePrecedente + uCartes[i].x - h.x) * 0.5));
      droitePrecedente = uCartes[i].x + h.x;
    }

    // Une fumée qui monte doucement et s'enroule : un bruit légèrement
    // déformé par un autre, plus large. Déformé trop fort, il s'étire en
    // veines et fait du marbre (premier essai, 25/09).
    float t = uTemps;
    vec2 s = p * 1.9 + vec2(0.0, t * 0.12);
    vec2 w = vec2(
      fbm(s * 0.7 + vec2(0.0, t * 0.06), 3),
      fbm(s * 0.7 + vec2(5.2, 1.3) - vec2(t * 0.05, 0.0), 3)
    ) - 0.5;
    // Un bruit sommé est plat (tout près de 0,5) : on lui rend du contraste,
    // sinon la fumée n'a pas de volutes, rien qu'un voile.
    float n = clamp((fbm(s + 1.2 * w, 5) - 0.5) * 1.7 + 0.5, 0.0, 1.0);
    // De grandes nappes plus ou moins épaisses : sans elles, une dalle grise.
    float nappes = fbm(p * 0.8 + vec2(t * 0.02, t * 0.05) + 3.1, 3);

    // Le profil de la nappe : pour chaque x, la hauteur de son bord haut (y
    // vers le bas). Le sol est juste sous les cartes ; le plateau un peu
    // au-dessus d'elles ; la traîne, une mince couche au ras du sol.
    float sol = dessous + 0.05;
    float plateau = dessus - 0.06;
    float traine = sol - 0.06;
    // Hors de la rangée, la distance à son bord ; dedans, négatif.
    float dehors = max(gauche - p.x, p.x - droite);
    // Le creux entre deux cartes : une courbe douce, en U et pas en V, plus
    // large que le jour entre elles. Il descend presque jusqu'à leur haut au
    // milieu, et leurs coins restent couverts d'environ 20 px.
    float creux = 0.05 * (1.0 - smoothstep(0.0, 0.095, jour));
    // La pente tient dans ce qui reste de l'écran de chaque côté de la rangée
    // (les cartes vont de 7,5 à 92,5 % de la largeur : 140 px sur 1864).
    float pente = smoothstep(0.015, 0.14, dehors);
    float bord = mix(plateau + creux, traine, pente)
      // rongé par deux bruits larges : ni ligne droite, ni coin
      + 0.07 * w.y + 0.05 * (nappes - 0.5);
    float zone = smoothstep(bord - 0.02, bord + 0.07, p.y)
      // posée au sol, qu'elle quitte en fondu et pas sur une ligne
      * (1.0 - smoothstep(sol - 0.03, sol + 0.07, p.y))
      // la traîne s'amincit vers le bord de l'écran
      * (1.0 - 0.5 * smoothstep(0.15, 0.6, dehors));

    // Le seuil du bruit : haut quand la fumée est mince. Il est plus haut au
    // centre des cartes tant qu'elle n'est pas pleine — elle s'y dissipe en
    // premier, et s'y forme en dernier.
    float e = uEpaisseur;
    float seuil = mix(0.95, 0.2, e)
      + 0.36 * (1.0 - e) * (1.0 - smoothstep(0.0, 1.1, c))
      + 0.14 * (0.5 - nappes);
    float densite = smoothstep(seuil, seuil + 0.25, n) * zone;

    // Le relief : la lumière vient d'en haut, comme la colonne du temple, et
    // le cœur de la fumée est plus sombre que ses bords.
    float n2 = clamp((fbm(s + 1.2 * w - vec2(0.0, 0.12), 4) - 0.5) * 1.7 + 0.5, 0.0, 1.0);
    float relief = clamp(0.5 + (n - n2) * 3.0, 0.0, 1.0);
    vec3 couleur = mix(vec3(0.16, 0.165, 0.18), vec3(0.6, 0.615, 0.65), relief)
      * mix(1.0, 0.8, densite);

    float alpha = densite * 0.85 * smoothstep(0.0, 0.12, e);
    gl_FragColor = vec4(couleur * alpha, alpha);
  }
`;

@Component({
  selector: 'pz-fumee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fumee', 'aria-hidden': 'true' },
  template: `<canvas #toile class="fumee__toile"></canvas>`,
  styleUrl: './fumee.css',
})
export class Fumee {
  private readonly placement = inject(Placement);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hote = inject(ElementRef<HTMLElement>);
  private readonly toile = viewChild<ElementRef<HTMLCanvasElement>>('toile');

  private rendu: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly cartes = Array.from({ length: CARTES_MAX }, () => new Vector4());
  private readonly uniformes = {
    uTaille: { value: new Vector2(1, 1) },
    uTemps: { value: 0 },
    uEpaisseur: { value: 0 },
    uCartes: { value: this.cartes },
    uNombre: { value: 0 },
  };

  private bouffees: Bouffee[] = [];
  private image = 0;
  private images = 0;
  private readonly origine = typeof performance === 'undefined' ? 0 : performance.now();

  constructor() {
    afterNextRender(() => this.demarrer());

    // Une bouffée à chaque CHANGEMENT : pas à la première lecture — des cartes
    // déjà là quand la fumée arrive (elle attend le décor) restent là. Au
    // téléphone, passer d'une carte à la suivante en est un aussi : l'une
    // repart dans la fumée pendant que l'autre en naît.
    let avant: string | null = null;
    effect(() => {
      const revelees = this.placement.cartesRevelees();
      const etat = revelees ? `carte ${this.placement.carteMontree() ?? 'toutes'}` : 'aucune';
      if (avant !== null && etat !== avant) this.lacher(revelees ? 'apparition' : 'disparition');
      avant = etat;
    });

    this.destroyRef.onDestroy(() => this.detruire());
  }

  private demarrer(): void {
    const ref = this.toile();
    if (ref === undefined) return;
    // L'échec est prévu et silencieux, comme pour le logo : sans WebGL, les
    // cartes apparaissent sans fumée, et la page reste entière.
    try {
      this.rendu = new WebGLRenderer({
        canvas: ref.nativeElement,
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }
    this.rendu.setClearColor(0x000000, 0);
    this.rendu.setPixelRatio(1);
    const materiau = new ShaderMaterial({
      uniforms: this.uniformes,
      vertexShader: SOMMETS,
      fragmentShader: FRAGMENTS,
      // Le shader écrit déjà une couleur prémultipliée, sur une toile vide.
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), materiau));

    this.ajuster();
    const ajuster = () => this.ajuster();
    window.addEventListener('resize', ajuster);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', ajuster));
  }

  private ajuster(): void {
    if (this.rendu === null) return;
    const l = Math.max(1, Math.ceil(window.innerWidth / REDUCTION));
    const h = Math.max(1, Math.ceil(window.innerHeight / REDUCTION));
    this.rendu.setSize(l, h, false);
    this.uniformes.uTaille.value.set(l, h);
  }

  private lacher(genre: Genre): void {
    if (this.rendu === null || this.mouvementReduit()) return;
    this.bouffees.push({ genre, debut: this.maintenant() });
    this.releverCartes();
    this.jouer();
  }

  /**
   * Où sont les cartes, en hauteurs d'écran : centre et demi-taille. Une salle
   * démontée (on est déjà ailleurs) garde les dernières places connues.
   */
  private releverCartes(): void {
    const h = window.innerHeight;
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>('[data-fumee]')) {
      if (n === CARTES_MAX) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      this.cartes[n++]!.set(
        (r.left + r.width / 2) / h,
        (r.top + r.height / 2) / h,
        r.width / 2 / h,
        r.height / 2 / h,
      );
    }
    if (n > 0) this.uniformes.uNombre.value = n;
  }

  private jouer(): void {
    if (this.image !== 0) return;
    this.hote.nativeElement.style.visibility = 'visible';
    const boucle = () => {
      this.image = requestAnimationFrame(boucle);
      this.dessiner();
    };
    this.image = requestAnimationFrame(boucle);
  }

  private dessiner(): void {
    if (this.rendu === null) return;
    const t = this.maintenant();
    this.bouffees = vivantes(this.bouffees, t);
    if (this.bouffees.length === 0) {
      this.arreter();
      return;
    }
    if (++this.images % RELEVE === 0) this.releverCartes();
    this.uniformes.uTemps.value = t;
    this.uniformes.uEpaisseur.value = epaisseur(this.bouffees, t);
    this.rendu.render(this.scene, this.camera);
  }

  private arreter(): void {
    if (this.image !== 0) cancelAnimationFrame(this.image);
    this.image = 0;
    this.rendu?.clear();
    this.hote.nativeElement.style.visibility = 'hidden';
  }

  private maintenant(): number {
    return (performance.now() - this.origine) / 1000;
  }

  private mouvementReduit(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private detruire(): void {
    this.arreter();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as ShaderMaterial | undefined)?.dispose();
    });
    // Comme pour le logo : rendre le contexte WebGL tout de suite, sinon les
    // rechargements du développement finissent par les épuiser.
    this.rendu?.forceContextLoss();
    this.rendu?.dispose();
    this.rendu = null;
  }
}
