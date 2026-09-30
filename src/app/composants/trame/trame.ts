// Le fond du seuil : un champ de fumée rendu en trame de points, qui change
// de couleur toutes les cinq secondes.
//
// POURQUOI LA TOILE EST HORS DE LA SCÈNE. Même raison que les emblèmes et la
// descente, mesurée le 07/09 : la scène porte un `transform: scale(457)` et
// le navigateur compose de travers une toile WebGL placée dedans — elle
// n'était peinte que sur les deux tiers de sa surface. La trame est donc un
// calque plein écran posé DERRIÈRE la scène, et c'est le fond du seuil qui
// devient transparent pour la laisser voir.
//
// POURQUOI ELLE NE ZOOME PAS. Un fond qui suivrait le zoom devrait grandir
// sans fin, et retomberait sur le plafond de texture de 16 384 px qui a déjà
// fait sauter la photo du seuil aux trois quarts de la descente. Un fond
// fixe, lui, coûte la même chose à toutes les profondeurs.
//
// POURQUOI DEUX PASSES. Le champ ne vaut qu'une valeur par point : le
// calculer par pixel referait 36 fois le même travail à 6 px de cellule. La
// passe 1 le rend dans une texture d'un texel par cellule (57 600 valeurs
// pour un écran 1080p, au lieu de 2 millions) ; la passe 2 s'y contente
// d'une lecture et d'un disque. C'est ce qui met l'effet à portée d'un
// téléphone.
//
// POURQUOI LE RAYON MONTE À 0,73 CELLULE. Un disque ne couvre sa cellule
// entière qu'au-delà de la demi-diagonale, √2/2 ≈ 0,707. En dessous il reste
// toujours de la couleur dans les angles : c'est ce qui manquait au premier
// essai, où Paul a vu qu'« il n'y a toujours pas assez de noir ».
//
// POURQUOI LA COULEUR SE DIFFUSE. La suivante ne remplace pas la précédente
// d'un bloc : elle envahit en suivant le champ, des creux vers les crêtes.
// Un fondu uniforme aurait fait clignoter la page entière.
//
// POURQUOI IL Y A UN REPLI CSS. Sans WebGL2 — un vieux navigateur, un pilote
// refusé, un rendu serveur — la page doit rester celle d'avant. L'hôte porte
// donc les dégradés d'origine du seuil, et la toile ne fait que se poser
// dessus quand elle y arrive.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Navigation } from '../../navigation';
import { opaciteTrame } from '../../coeur/presentation';
import { REGLAGES_TRAME, type ReglagesTrame, grilleTrame, rvb } from '../../coeur/trame';

/** Le sommet : un unique triangle qui déborde de l'écran, sans tampon. */
const SOMMET = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Le bruit, et sa double déformation : c'est elle qui fait la fumée. */
const BRUIT = `
float alea(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float bruit(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(alea(i),            alea(i + vec2(1,0)), u.x),
             mix(alea(i + vec2(0,1)), alea(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){
    v += a * bruit(p);
    p = p * 2.03 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}
// Le bruit déplace le bruit qui déplace le bruit. Une seule couche donnerait
// des taches ; trois donnent des volutes qui s'enroulent sur elles-mêmes.
float champ(vec2 p, float t){
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + 0.12 * t),
                fbm(p + vec2(5.2, 1.3) - 0.10 * t));
  vec2 r = vec2(fbm(p + 2.4 * q + vec2(1.7, 9.2) + 0.08 * t),
                fbm(p + 2.4 * q + vec2(8.3, 2.8) - 0.07 * t));
  return fbm(p + 2.4 * r);
}`;

/** Passe 1 — une valeur de champ par cellule, dans une texture minuscule. */
const CHAMP = `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uCellule;
uniform float uTemps;
uniform float uEchelle;
uniform float uContraste;
uniform float uDensite;
uniform vec2  uSouris;    // en pixels, origine en bas comme gl_FragCoord
uniform float uRayon;     // portée du remous, en pixels
uniform float uPoussee;   // amplitude, en unités de champ
out vec4 sortie;
${BRUIT}
void main(){
  vec2 centre = (floor(gl_FragCoord.xy) + 0.5) * uCellule;
  vec2 p = centre / uRes.y * uEchelle;

  // LA SOURIS AVANCE LE TEMPS, ELLE NE DÉPLACE PAS LA MATIÈRE.
  //
  // Premier essai, écarté par Paul : décaler le point de lecture du champ.
  // Ça marche, mais ça COURBE — c'est une lentille posée sur le motif, et
  // « on ne veut pas cette distorsion ». Le défaut est dans le principe et
  // non dans le dosage : déplacer le domaine, c'est plier la géométrie.
  //
  // Ici le domaine ne bouge pas d'un pixel. Seul le TEMPS du champ prend de
  // l'avance sous le curseur : la fumée continue d'y couler comme partout
  // ailleurs, simplement un peu plus loin dans son écoulement. Aucune ligne
  // n'est tordue, il n'y a que du mouvement — et le raccord avec le reste de
  // l'écran est un fondu temporel, donc invisible par construction.
  vec2 ecart = centre - uSouris;
  float influence = 1.0 - smoothstep(0.0, 1.0, length(ecart) / max(uRayon, 1.0));

  float v = champ(p, uTemps + influence * uPoussee);
  v = smoothstep(0.30, 0.70, v);
  v = clamp((v - 0.5) * uContraste + 0.5, 0.0, 1.0);
  v = pow(v, uDensite);
  sortie = vec4(v, 0.0, 0.0, 1.0);
}`;

/** Passe 2 — le tramage : un disque par cellule, et la couleur qui se diffuse. */
const TRAME = `#version 300 es
precision highp float;
uniform sampler2D uChamp;
uniform float uCellule;
uniform float uTemps;
uniform float uPeriode;
uniform float uRayon;
uniform vec3  uSombre;
uniform vec3  uPal[5];
out vec4 sortie;

vec3 pal(int i){ int k = i - (i / 5) * 5; return uPal[k]; }

void main(){
  vec2 cellule = floor(gl_FragCoord.xy / uCellule);
  vec2 centre  = (cellule + 0.5) * uCellule;
  float v = texelFetch(uChamp, ivec2(cellule), 0).r;

  // Rayon en racine carrée : c'est l'AIRE du point qui suit la valeur, et
  // c'est ainsi que l'œil lit une trame d'imprimerie.
  float rayon = uRayon * uCellule * sqrt(v);
  float d = length(gl_FragCoord.xy - centre);
  float a = 1.0 - smoothstep(rayon - 1.0, rayon + 1.0, d);

  // La couleur suivante envahit en suivant le champ, des creux vers les
  // crêtes — un fondu uniforme ferait clignoter la page entière.
  //
  // LE SEUIL DESCEND, ET C'EST TOUT LE SUJET. Il montait : la transition
  // était jouée à l'envers, si bien qu'un cycle FINISSAIT sur pal(k) pendant
  // que le suivant COMMENÇAIT sur pal(k+2). À chaque bouclage, la page
  // sautait donc deux teintes d'un coup — c'est la brutalité que Paul a vue.
  // En descendant, le cycle finit exactement où le suivant commence.
  //
  // La course (2,0) et la largeur de la bande (0,5) ne sont pas libres non
  // plus : il faut qu'à f=0 le seuil soit au-dessus de TOUTE valeur du champ
  // et qu'à f=1 il soit en dessous, sinon il reste une frange de pixels en
  // avance ou en retard, et la frange saute au bouclage. 1,5 → -0,5 avec une
  // demi-bande de 0,5 couvre exactement [0, 1], sans marge perdue.
  float cy = uTemps / uPeriode;
  float f  = fract(cy);
  int   k  = int(floor(cy));
  float seuil = 1.5 - f * 2.0;
  float m = smoothstep(seuil - 0.5, seuil + 0.5, 1.0 - v);
  vec3 couleur = mix(pal(k), pal(k + 1), clamp(m, 0.0, 1.0));

  // Inversé, comme Paul l'a arrêté : la couleur au fond, le sombre en points.
  sortie = vec4(mix(couleur, uSombre, a), 1.0);
}`;

/** Au-delà, on peint des pixels que personne ne distingue. */
const PIXELS_MAX = 2.2;

@Component({
  selector: 'pz-trame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'trame', '[style.opacity]': 'opacite()' },
  template: '<canvas #toile class="trame__toile" aria-hidden="true"></canvas>',
  styleUrl: './trame.css',
})
export class Trame {
  private readonly nav = inject(Navigation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toile = viewChild.required<ElementRef<HTMLCanvasElement>>('toile');

  readonly reglages = input<ReglagesTrame>(REGLAGES_TRAME);

  /**
   * Elle s'éteint dès que le zoom démarre (`opaciteTrame`). Posée sur l'hôte,
   * et pas seulement sur la boucle : une toile arrêtée garde sa dernière
   * image, et c'est elle qui restait figée derrière toute la descente.
   */
  protected readonly opacite = computed(() => opaciteTrame(this.nav.profondeurAffichee()));

  private gl: WebGL2RenderingContext | null = null;
  private passeChamp: WebGLProgram | null = null;
  private passeTrame: WebGLProgram | null = null;
  private cible: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  private lieux = new Map<string, WebGLUniformLocation | null>();
  private colonnes = 0;
  private lignes = 0;
  private image = 0;
  private temps = 0;
  private dernier = 0;

  /** Où la souris est vraiment, en pixels CSS ; `null` quand elle est sortie. */
  private visee: readonly [number, number] | null = null;
  /** Où le remous la croit : la même chose, en retard. */
  private souris = { x: 0, y: 0 };
  /** 0 quand il n'y a pas de souris, 1 quand elle est là — et l'entre-deux. */
  private presence = 0;

  constructor() {
    // `afterNextRender` seulement : WebGL n'existe pas au rendu serveur.
    afterNextRender(() => this.demarrer());
    effect(() => (this.opacite() > 0 ? this.jouer() : this.arreter()));
    this.destroyRef.onDestroy(() => this.detruire());
  }

  // Sur `window` et non sur l'hôte : la toile est derrière toute la page et
  // ne reçoit aucun pointeur (`pointer-events: none`). Un écran tactile
  // n'émet jamais ces événements, la présence y reste donc à zéro et le
  // remous ne coûte rien.
  @HostListener('window:pointermove', ['$event'])
  protected viser(evenement: PointerEvent): void {
    this.visee = [evenement.clientX, evenement.clientY];
  }

  // SUR `document`, ET NON SUR `window`. `pointerleave` ne remonte pas : il
  // est distribué à l'élément quitté et à ses ancêtres, chaîne qui s'arrête
  // au document. Posé sur `window`, l'écouteur ne se déclenchait donc jamais
  // — et le remous restait figé là où la souris avait quitté l'écran.
  // `blur` couvre le cas où l'on part vers un autre onglet sans passer par
  // un bord.
  @HostListener('document:pointerleave')
  @HostListener('document:mouseleave')
  @HostListener('window:blur')
  protected relacherSouris(): void {
    this.visee = null;
  }

  /**
   * Le remous suit la souris EN RETARD, et sa présence monte et descend.
   *
   * Un remous collé au curseur au pixel près donnerait un objet rigide ; ce
   * retard est ce qui fait la traînée. `1 - exp(-dt·k)` et non un pas fixe :
   * l'amortissement doit valoir la même chose à 30 et à 144 images/s.
   */
  private suivreSouris(dt: number): void {
    const k = 1 - Math.exp(-dt * 5);
    if (this.visee === null) {
      this.presence += (0 - this.presence) * k;
      return;
    }
    const [x, y] = this.visee;
    // Première apparition : on se pose là où elle est, sans traverser l'écran.
    if (this.presence < 0.001) {
      this.souris.x = x;
      this.souris.y = y;
    }
    this.souris.x += (x - this.souris.x) * k;
    this.souris.y += (y - this.souris.y) * k;
    this.presence += (1 - this.presence) * k;
  }

  private demarrer(): void {
    const toile = this.toile().nativeElement;
    const gl = toile.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'low-power',
    });
    // Pas de WebGL2 : on ne fait rien, et le dégradé de repli reste visible.
    if (gl === null) return;
    this.gl = gl;

    this.passeChamp = this.lier(gl, CHAMP);
    this.passeTrame = this.lier(gl, TRAME);
    if (this.passeChamp === null || this.passeTrame === null) {
      this.gl = null;
      return;
    }
    for (const [p, noms] of [
      [
        this.passeChamp,
        [
          'uRes',
          'uCellule',
          'uTemps',
          'uEchelle',
          'uContraste',
          'uDensite',
          'uSouris',
          'uRayon',
          'uPoussee',
        ],
      ],
      [this.passeTrame, ['uChamp', 'uCellule', 'uTemps', 'uPeriode', 'uRayon', 'uSombre', 'uPal']],
    ] as const) {
      for (const n of noms)
        this.lieux.set(`${p === this.passeChamp ? 'c' : 't'}:${n}`, gl.getUniformLocation(p, n));
    }

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    for (const [c, v] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ] as const) {
      gl.texParameteri(gl.TEXTURE_2D, c, v);
    }
    this.cible = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cible);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    toile.classList.add('trame__toile--prete');
    if (this.opacite() > 0) this.jouer();
  }

  private lier(gl: WebGL2RenderingContext, source: string): WebGLProgram | null {
    const compiler = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (s === null) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS) === true) return s;
      // On ne jette pas : un pilote qui refuse le nuanceur doit laisser la
      // page vivre avec son dégradé, pas la casser.
      console.warn('trame — nuanceur refusé :', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    };
    const vs = compiler(gl.VERTEX_SHADER, SOMMET);
    const fs = compiler(gl.FRAGMENT_SHADER, source);
    const p = gl.createProgram();
    if (vs === null || fs === null || p === null) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true) {
      console.warn('trame — édition de liens refusée :', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  private jouer(): void {
    if (this.gl === null || this.image !== 0) return;
    this.dernier = performance.now();
    const boucle = (maintenant: number): void => {
      // Plafonné : un onglet réveillé après une minute ne doit pas faire
      // sauter le champ d'une minute d'un coup.
      const dt = Math.min(0.05, (maintenant - this.dernier) / 1000);
      this.temps += dt * this.reglages().vitesse;
      this.dernier = maintenant;
      this.suivreSouris(dt);
      this.dessiner();
      this.image = requestAnimationFrame(boucle);
    };
    this.image = requestAnimationFrame(boucle);
  }

  /**
   * Rend le contexte WebGL, et pas seulement ses ressources.
   *
   * Un navigateur n'accorde qu'une quinzaine de contextes par page, et il ne
   * les reprend qu'au ramassage de mémoire — moment qu'on ne choisit pas. En
   * développement, chaque sauvegarde recrée ce composant : sans cette
   * libération, les contextes s'empilent jusqu'à ce que Chrome refuse d'en
   * ouvrir un de plus (« context loss and was blocked ») et que les emblèmes
   * ET la trame disparaissent d'un coup.
   */
  private detruire(): void {
    this.arreter();
    const gl = this.gl;
    if (gl === null) return;
    gl.deleteFramebuffer(this.cible);
    gl.deleteTexture(this.texture);
    if (this.passeChamp !== null) gl.deleteProgram(this.passeChamp);
    if (this.passeTrame !== null) gl.deleteProgram(this.passeTrame);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  /** Vraiment arrêtée, pas seulement masquée : une boucle stoppée ne coûte rien. */
  private arreter(): void {
    if (this.image === 0) return;
    cancelAnimationFrame(this.image);
    this.image = 0;
  }

  private dessiner(): void {
    const gl = this.gl;
    const toile = this.toile().nativeElement;
    if (gl === null || this.passeChamp === null || this.passeTrame === null) return;

    const r = this.reglages();
    const densitePixels = Math.min(window.devicePixelRatio || 1, PIXELS_MAX);
    const l = Math.max(1, Math.round(toile.clientWidth * densitePixels));
    const h = Math.max(1, Math.round(toile.clientHeight * densitePixels));
    if (toile.width !== l || toile.height !== h) {
      toile.width = l;
      toile.height = h;
    }
    const cellule = Math.max(2, r.cellule * densitePixels);
    const grille = grilleTrame(l, h, cellule);
    if (grille.colonnes !== this.colonnes || grille.lignes !== this.lignes) {
      this.colonnes = grille.colonnes;
      this.lignes = grille.lignes;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        this.colonnes,
        this.lignes,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }

    // Passe 1 — le champ, en tout petit.
    const c = (n: string) => this.lieux.get(`c:${n}`) ?? null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cible);
    gl.viewport(0, 0, this.colonnes, this.lignes);
    gl.useProgram(this.passeChamp);
    gl.uniform2f(c('uRes'), l, h);
    gl.uniform1f(c('uCellule'), cellule);
    gl.uniform1f(c('uTemps'), this.temps);
    gl.uniform1f(c('uEchelle'), r.echelle);
    gl.uniform1f(c('uContraste'), r.contraste);
    gl.uniform1f(c('uDensite'), r.densite);
    // `h - y` : la souris compte depuis le haut, `gl_FragCoord` depuis le bas.
    gl.uniform2f(c('uSouris'), this.souris.x * densitePixels, h - this.souris.y * densitePixels);
    gl.uniform1f(c('uRayon'), r.halo * h);
    gl.uniform1f(c('uPoussee'), r.force * this.presence);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Passe 2 — la trame, plein écran.
    const t = (n: string) => this.lieux.get(`t:${n}`) ?? null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, l, h);
    gl.useProgram(this.passeTrame);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(t('uChamp'), 0);
    gl.uniform1f(t('uCellule'), cellule);
    gl.uniform1f(t('uTemps'), this.temps);
    gl.uniform1f(t('uPeriode'), r.periode);
    gl.uniform1f(t('uRayon'), 0.73);
    gl.uniform3fv(t('uSombre'), rvb(r.sombre));
    gl.uniform3fv(t('uPal'), r.palette.flatMap(rvb));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
