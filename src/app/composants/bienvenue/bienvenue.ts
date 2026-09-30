// « WELCOME » DANS VINGT LANGUES (Paul, 28/09), sur l'accueil du téléphone.
//
// Comme dans un terminal : le mot s'écrit lettre par lettre, suivi de trois
// points, un curseur plein clignote au bout ; puis il s'efface, vite, et le
// suivant s'écrit — dans une autre langue, et souvent une autre typographie.
// C'est le même esprit que les mots qui défilent pendant qu'un assistant d'IA
// réfléchit.
//
// La typographie est tirée AU HASARD à chaque mot, sans lien avec la langue
// (Paul, 28/09) — jamais deux fois la même de suite. Et chaque mot est mis à
// la taille qui le fait tenir dans l'écran : « Добро пожаловать » débordait.
//
// Les lettres sont coupées en GRAPHÈMES (`Intl.Segmenter`) et pas en
// caractères : en hindi ou en coréen, un caractère seul peut être un morceau
// de lettre, et l'écrire à part ferait apparaître des signes cassés.
//
// Au mouvement réduit, rien ne défile : « Welcome… » est simplement là.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

export interface Salut {
  readonly mot: string;
  readonly langue: string;
}

const SERIF = 'var(--serif)';
const MONO = 'var(--mono)';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAIN = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';
const GRAS = '"Arial Black", "Helvetica Neue", Impact, sans-serif';

/** Les typographies du défilé, tirées au hasard pour chaque mot. */
export const POLICES: readonly string[] = [SERIF, MONO, SANS, MAIN, GRAS];

export const SALUTS: readonly Salut[] = [
  { mot: 'Welcome', langue: 'en' },
  { mot: 'Bienvenue', langue: 'fr' },
  { mot: 'Bienvenido', langue: 'es' },
  { mot: 'Willkommen', langue: 'de' },
  { mot: 'ようこそ', langue: 'ja' },
  { mot: 'Benvenuto', langue: 'it' },
  { mot: 'أهلاً وسهلاً', langue: 'ar' },
  { mot: 'Bem-vindo', langue: 'pt' },
  { mot: 'Добро пожаловать', langue: 'ru' },
  { mot: '欢迎', langue: 'zh' },
  { mot: 'Welkom', langue: 'nl' },
  { mot: 'Καλώς ήρθες', langue: 'el' },
  { mot: 'स्वागत है', langue: 'hi' },
  { mot: 'Välkommen', langue: 'sv' },
  { mot: '환영합니다', langue: 'ko' },
  { mot: 'Hoş geldin', langue: 'tr' },
  { mot: 'ברוך הבא', langue: 'he' },
  { mot: 'Witaj', langue: 'pl' },
  { mot: 'Karibu', langue: 'sw' },
  { mot: 'Aloha', langue: 'haw' },
];

/** Les rythmes, en millisecondes. */
const FRAPPE = 95;
const FRAPPE_POINTS = 190;
const TENUE = 1500;
const EFFACEMENT = 38;
const ENTRE_DEUX = 380;

const POINTS = '...';

function graphemes(texte: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter === undefined) return Array.from(texte);
  return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(texte), (s) => s.segment);
}

function mouvementReduit(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

@Component({
  selector: 'pz-bienvenue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bienvenue', 'aria-label': 'Welcome', role: 'heading', 'aria-level': '1' },
  template: `
    <span
      class="bienvenue__texte"
      aria-hidden="true"
      [attr.lang]="salut().langue"
      [attr.dir]="salut().langue === 'ar' || salut().langue === 'he' ? 'rtl' : null"
      [style.font-family]="police()"
      [style.font-size.em]="echelle()"
      >{{ affiche() }}<span class="bienvenue__curseur" [class.bienvenue__curseur--frappe]="frappe()"></span
    ></span>
    <!-- Le mot entier, invisible, à la taille de base : c'est lui qu'on mesure. -->
    <span #mesure class="bienvenue__mesure" aria-hidden="true" [style.font-family]="police()"
      >{{ lettres().join('') }}<span class="bienvenue__curseur"></span
    ></span>
  `,
  styles: `
    :host {
      display: block;
      color: #0a0a0a;
      font-size: clamp(2.2rem, 11vw, 3.4rem);
      line-height: 1.15;
      text-shadow: 0 0 0.6em rgba(255, 255, 255, 0.55);
    }
    :host {
      position: relative;
      padding: 0 4vw;
    }
    .bienvenue__texte {
      display: inline-block;
      white-space: nowrap;
    }
    .bienvenue__mesure {
      position: absolute;
      left: 0;
      top: 0;
      visibility: hidden;
      white-space: nowrap;
      pointer-events: none;
    }
    /* Le curseur plein d'un terminal. Il clignote quand le mot est posé ;
       pendant qu'il écrit ou efface, il reste allumé. */
    .bienvenue__curseur {
      display: inline-block;
      width: 0.5em;
      height: 0.9em;
      margin-inline-start: 0.08em;
      vertical-align: -0.08em;
      background: currentColor;
      animation: clignote 1s steps(1) infinite;
    }
    .bienvenue__curseur--frappe {
      animation: none;
    }
    @keyframes clignote {
      50% {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bienvenue__curseur {
        animation: none;
      }
    }
  `,
})
export class Bienvenue {
  /** Faux : le défilé s'arrête (l'accueil n'est plus à l'écran). */
  readonly actif = input(true);

  private readonly rang = signal(0);
  private readonly longueur = signal(0);
  protected readonly frappe = signal(false);

  protected readonly salut = computed(() => SALUTS[this.rang() % SALUTS.length]!);
  protected readonly police = signal(POLICES[0]!);
  /** La taille du mot, en fraction de la taille de base : 1, sauf s'il déborde. */
  protected readonly echelle = signal(1);
  protected readonly lettres = computed(() => [...graphemes(this.salut().mot), ...POINTS]);
  private readonly mesure = viewChild<ElementRef<HTMLElement>>('mesure');
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly affiche = computed(() => this.lettres().slice(0, this.longueur()).join(''));

  private minuteur: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (mouvementReduit()) {
      this.longueur.set(this.lettres().length);
      return;
    }
    effect(() => {
      const actif = this.actif();
      this.arreter();
      if (actif) this.planifier(ENTRE_DEUX, () => this.ecrire());
    });
    inject(DestroyRef).onDestroy(() => this.arreter());
  }

  /** Le mot entier doit tenir dans la largeur de l'accueil. */
  private ajuster(): void {
    const mot = this.mesure()?.nativeElement;
    const style = getComputedStyle(this.hote);
    const place = this.hote.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const largeur = mot?.getBoundingClientRect().width ?? 0;
    this.echelle.set(largeur > 0 && place > 0 ? Math.min(1, place / largeur) : 1);
  }

  private ecrire(): void {
    const total = this.lettres().length;
    const n = this.longueur();
    if (n === 0) this.ajuster();
    if (n < total) {
      this.frappe.set(true);
      this.longueur.set(n + 1);
      const suivante = n + 1 >= total - POINTS.length ? FRAPPE_POINTS : FRAPPE;
      this.planifier(n + 1 < total ? suivante : 0, () => this.ecrire());
      return;
    }
    this.frappe.set(false);
    this.planifier(TENUE, () => this.effacer());
  }

  private effacer(): void {
    const n = this.longueur();
    if (n > 0) {
      this.frappe.set(true);
      this.longueur.set(n - 1);
      this.planifier(EFFACEMENT, () => this.effacer());
      return;
    }
    this.frappe.set(false);
    this.rang.update((r) => r + 1);
    // Une autre typographie, jamais la même deux fois de suite.
    const autres = POLICES.filter((p) => p !== this.police());
    this.police.set(autres[Math.floor(Math.random() * autres.length)]!);
    this.planifier(ENTRE_DEUX, () => this.ecrire());
  }

  private planifier(ms: number, suite: () => void): void {
    this.minuteur = setTimeout(suite, ms);
  }

  private arreter(): void {
    if (this.minuteur !== null) clearTimeout(this.minuteur);
    this.minuteur = null;
  }
}
