import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangueSite } from './langue';
import { App } from './app';
import { Navigation } from './navigation';
import { PROJETS } from './coeur/contenu';

/** Le glissement de caméra est coupé : les tests observent l’état, pas l’animation. */
function sansGlissement() {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion'),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('la page', () => {
  let fixture: ComponentFixture<App>;
  let nav: Navigation;

  beforeEach(async () => {
    sansGlissement();
    location.hash = '';
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    // Les tests lisent les textes français ; le navigateur de test est anglais.
    TestBed.inject(LangueSite).langue.set('fr');
    fixture = TestBed.createComponent(App);
    nav = TestBed.inject(Navigation);
    await fixture.whenStable();
  });

  it('chaque salle est un calque à part, sans transformation quand on y est', () => {
    // Depuis le 23/09, les salles ne sont plus emboîtées : emboîtées, elles
    // étaient grossies ×457 et ×3 000, et peintes jusqu'à 200 px à côté de
    // leur place dès que l'écran n'était pas en densité 1.
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.vue > pz-seuil')).toBeTruthy();
    expect(page.querySelector('pz-projets')).toBeNull(); // derrière le « H », rien encore

    nav.viserProfondeur(1);
    fixture.detectChanges();
    const projets = page.querySelector<HTMLElement>('.vue > pz-projets');
    expect(projets).toBeTruthy();
    expect(projets!.style.transform).toBe('none'); // grossissement 1 : rien à arrondir
    expect(page.querySelector('pz-seuil')).toBeNull();

    nav.viserProfondeur(2);
    fixture.detectChanges();
    const hermes = page.querySelector<HTMLElement>('.vue > pz-orchestrateur');
    expect(hermes!.style.transform).toBe('none');
    // Une salle entrevue est un calque frère, réduit, et jamais un descendant
    // de celle qui la contient : juste avant d'arriver dans la salle Hermès,
    // elle est dans la vue, pas dans la salle 2.
    (nav as unknown as { profondeurAfficheeInterne: { set(d: number): void } }).profondeurAfficheeInterne.set(1.99);
    fixture.detectChanges();
    const apercu = page.querySelector<HTMLElement>('.vue > pz-orchestrateur');
    expect(apercu!.style.transform).toContain('scale(');
    expect(page.querySelector('pz-projets pz-orchestrateur')).toBeNull();
  });

  it('porte les trois projets, avec leur vrai contenu', () => {
    const texte = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const projet of PROJETS) expect(texte).toContain(projet.nom);
    expect(texte).toContain('Paul Moulin');
    expect(texte).toContain('Orchestrateur');
  });

  it('une salle quittée est démontée : ses vignettes n’existent plus', () => {
    // Le 23/09, la carte graphique de Paul peignait la vignette Overmind
    // par-dessus la salle Hermès, alors qu'elle était mise en page hors écran.
    const page = fixture.nativeElement as HTMLElement;
    const vignettes = () => page.querySelectorAll('pz-vignette').length;
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(vignettes()).toBe(PROJETS.length);
    nav.viserProfondeur(2);
    fixture.detectChanges();
    expect(vignettes()).toBe(0);
    expect(page.querySelector('.seuil__photo')).toBeNull();
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(vignettes()).toBe(PROJETS.length);
  });

  it('offre un plan textuel pour les lecteurs d’écran', () => {
    const plan = (fixture.nativeElement as HTMLElement).querySelector('.pour-lecteur');
    expect(plan?.querySelectorAll('a').length).toBe(3 + PROJETS.length);
  });

  it('les flèches descendent et remontent d’une pièce', () => {
    fixture.detectChanges();
    nav.allerPage('seuil', 1); // la dernière page du seuil : la flèche change de pièce
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(nav.etat().profondeur).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    expect(nav.etat().profondeur).toBe(2);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(nav.etat().profondeur).toBe(1);
  });

  it('Début et Fin vont d’un bout à l’autre', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(nav.etat().profondeur).toBe(2);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(nav.etat().profondeur).toBe(0);
  });

  it('cliquer une vignette ouvre le projet SANS changer de profondeur', async () => {
    nav.viserProfondeur(1);
    fixture.detectChanges();
    const vignette = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'pz-ouverture[aria-label*="Intuition"]',
    );
    expect(vignette).toBeTruthy();
    vignette!.click();
    fixture.detectChanges();
    expect(nav.universOuvert()).toBe('intuition');
    expect(nav.etat().profondeur).toBe(1);
  });

  it('Échap referme le projet et laisse la profondeur où elle était', () => {
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('founders');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(nav.universOuvert()).toBeNull();
    expect(nav.etat().profondeur).toBe(1);
  });

  it('un projet ouvert rend les flèches au panneau', () => {
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('overmind');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(nav.etat().profondeur).toBe(1);
  });

  it('tous les passages sont invisibles sur grand écran : ni bouton, ni libellé', () => {
    // Depuis le 23/09, la carte du portfolio 3D est retirée aussi : on n'y
    // descendra que par le zoom des images, dans la pupille du visage.
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(2);
    fixture.detectChanges();
    expect(page.querySelectorAll('pz-portes button').length).toBe(0);
  });

  it('le « H » et la porte du temple sont des passages invisibles sur grand écran', () => {
    // Ni bouton, ni libellé : on n'y entre que par le zoom des images.
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('pz-portes button').length).toBe(0); // au seuil
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(page.querySelectorAll('pz-portes button').length).toBe(0); // dans la salle 2
    expect(page.querySelector('[aria-label*="arrière-salle"]')).toBeNull();
  });

  it('la carte Hermès a trois pages, que la molette tourne', () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(2);
    fixture.detectChanges();
    const carte = page.querySelector('pz-orchestrateur pz-carte-texte')!;
    expect(carte.querySelectorAll('.carte-texte__page').length).toBe(3);
    const points = carte.querySelectorAll<HTMLElement>('.carte-texte__point');
    expect(points.length).toBe(3);
    expect(points[0]!.getAttribute('aria-current')).toBe('page');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(nav.etat().profondeur).toBe(2);
    expect(points[1]!.getAttribute('aria-current')).toBe('page');
    // La page qu'on a quittée sort de la lecture et du clavier.
    expect(carte.querySelectorAll('.carte-texte__page')[0]!.hasAttribute('inert')).toBe(true);

    points[0]!.click(); // un point ramène à sa page
    fixture.detectChanges();
    expect(points[0]!.getAttribute('aria-current')).toBe('page');
  });

  it('la salle 2 en deux temps : un cran fait naître les cartes, le suivant descend', () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(1);
    fixture.detectChanges();
    const salle = page.querySelector('pz-projets')!;
    const cartes = () => [...page.querySelectorAll('.projets__carte')];
    // Premier temps : le titre et l'intro, les cartes cachées et inertes.
    expect(salle.classList.contains('projets--cartes')).toBe(false);
    expect(cartes().length).toBe(PROJETS.length);
    expect(cartes().every((c) => c.hasAttribute('inert'))).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(nav.etat().profondeur).toBe(1);
    expect(salle.classList.contains('projets--cartes')).toBe(true);
    expect(salle.classList.contains('projets--cartes-revelees')).toBe(true);
    expect(cartes().some((c) => c.hasAttribute('inert'))).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(nav.etat().profondeur).toBe(2);

    // En remontant, on retrouve les cartes, pas le premier temps.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    fixture.detectChanges();
    expect(nav.etat().profondeur).toBe(1);
    const retrouvee = page.querySelector('pz-projets')!;
    expect(retrouvee.classList.contains('projets--cartes-revelees')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    fixture.detectChanges();
    expect(nav.etat().profondeur).toBe(1);
    expect(retrouvee.classList.contains('projets--cartes')).toBe(false);
  });

  it('les outils de réglage sont masqués sans « ?reglages »', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('pz-placement-libre')).toBeNull();
    expect(page.querySelector('pz-reglage-emblemes')).toBeNull();
  });

  it('la carte Hermès entre par la gauche une fois la salle posée, et repart', () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(2);
    fixture.detectChanges();
    const salle = page.querySelector('pz-orchestrateur')!;
    expect(salle.classList.contains('choree--presente')).toBe(true);
    nav.viserProfondeur(1);
    fixture.detectChanges();
    // Quittée : la carte repart hors de l'écran (voir `orchestrateur.css`).
    expect(page.querySelector('pz-orchestrateur')?.classList.contains('choree--presente') ?? false).toBe(false);
  });

  it('la carte du seuil : deux pages au même gabarit, les liens toujours visibles dehors', () => {
    const seuil = (fixture.nativeElement as HTMLElement).querySelector('pz-seuil')!;
    const carte = seuil.querySelector('pz-carte-texte')!;
    expect(carte.querySelectorAll('.carte-texte__page').length).toBe(2);
    expect(carte.querySelectorAll('.carte-texte__point').length).toBe(2);
    // Les liens ne sont dans aucune page : on n'a jamais à feuilleter pour écrire.
    const liens = seuil.querySelectorAll('.seuil__liens a');
    expect(liens.length).toBe(3);
    for (const a of liens) expect(carte.contains(a)).toBe(false);
    // Plus d'invite ni de sur-titre (Paul, 24/09).
    expect(seuil.querySelector('.seuil__invite')).toBeNull();
    expect(carte.querySelector('.piece__sur-titre')).toBeNull();
    // Jamais de tiret long dans un texte affiché sous le nom de Paul.
    expect(seuil.textContent).not.toMatch(/[—–]/);
  });

  it('la salle Hermès a son décor vivant : visible une fois posé, effacé en partant', async () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const decor = page.querySelector('pz-fond-hermes');
    expect(decor).toBeTruthy();
    expect(decor!.classList.contains('fond-hermes--visible')).toBe(true);
    expect(decor!.querySelectorAll('video').length).toBe(1); // l'apparition PUIS la boucle, sur un seul tapis
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(decor!.classList.contains('fond-hermes--visible')).toBe(false);
  });

  it('l’adresse de la page suit la navigation', () => {
    nav.viserProfondeur(2);
    expect(location.hash).toBe('#orchestrateur');
    nav.ouvrirUnivers('overmind');
    expect(location.hash).toBe('#overmind');
  });
});

describe('accessibilité du panneau projet', () => {
  let fixture: ComponentFixture<App>;
  let nav: Navigation;

  beforeEach(async () => {
    sansGlissement();
    location.hash = '';
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    // Les tests lisent les textes français ; le navigateur de test est anglais.
    TestBed.inject(LangueSite).langue.set('fr');
    fixture = TestBed.createComponent(App);
    nav = TestBed.inject(Navigation);
    await fixture.whenStable();
  });

  it('rend le reste de la page inerte tant qu’un projet est ouvert', async () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.vue')!.hasAttribute('inert')).toBe(false);
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('intuition');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.querySelector('.vue')!.hasAttribute('inert')).toBe(true);
    expect(page.querySelector('pz-reperes')!.hasAttribute('inert')).toBe(true);
    nav.fermerUnivers();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.querySelector('.vue')!.hasAttribute('inert')).toBe(false);
  });

  it('la carte ouverte fait partir le reste de la salle, et y revient', async () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('intuition');
    fixture.detectChanges();
    await fixture.whenStable();
    const salle2 = page.querySelector('pz-projets')!;
    expect(salle2.classList.contains('projets--carte-ouverte')).toBe(true);
    // La vignette choisie cède la place à sa copie ouverte.
    expect(page.querySelector('.projets__carte--choisie[aria-label*="Intuition"]')).toBeTruthy();
    expect(page.querySelector('.carte.carte--ouverte')).toBeTruthy();
    nav.fermerUnivers();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(salle2.classList.contains('projets--carte-ouverte')).toBe(false);
    expect(page.querySelector('.carte')).toBeNull();
  });

  it('la croix et un clic à côté referment la carte, sans changer de profondeur', async () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(1);
    for (const fermer of ['.carte__fermer', '.attrape-clic']) {
      nav.ouvrirUnivers('founders');
      fixture.detectChanges();
      await fixture.whenStable();
      page.querySelector<HTMLElement>(fermer)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(nav.universOuvert()).toBeNull();
      expect(nav.etat().profondeur).toBe(1);
      expect(page.querySelector('.carte')).toBeNull();
    }
  });

  it('une autre carte s’ouvre sans attendre la fin de la fermeture', async () => {
    const page = fixture.nativeElement as HTMLElement;
    // Avec le mouvement : c'est lui qui retient la carte qui se referme.
    vi.stubGlobal('matchMedia', (requete: string) => ({
      matches: false,
      media: requete,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('intuition');
    fixture.detectChanges();
    await fixture.whenStable();
    nav.fermerUnivers();
    fixture.detectChanges();
    await fixture.whenStable();
    // Elle se referme encore, et ne retient aucun clic.
    expect(page.querySelector('.carte.carte--fermeture')).toBeTruthy();
    expect(page.querySelector('.attrape-clic')).toBeNull();

    nav.ouvrirUnivers('overmind');
    fixture.detectChanges();
    await fixture.whenStable();
    // Deux cartes : l'une finit son retour, l'autre s'ouvre.
    expect(page.querySelectorAll('.carte')).toHaveLength(2);
    expect(page.querySelector('.carte--fermeture')!.getAttribute('aria-label')).toBe('Intuition');
    expect(page.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Overmind 3D');
    expect(nav.cartesAffichees()).toEqual(['intuition', 'overmind']);

    // Son retour fini, la première s'en va, et sa vignette revient.
    await new Promise((r) => setTimeout(r, 2200));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.querySelectorAll('.carte')).toHaveLength(1);
    expect(nav.cartesAffichees()).toEqual(['overmind']);
  }, 10000);

  it('la carte d’Intuition s’ouvre en deux pages, que la molette et les points tournent', async () => {
    const page = fixture.nativeElement as HTMLElement;
    nav.viserProfondeur(1);
    nav.ouvrirUnivers('intuition');
    fixture.detectChanges();
    await fixture.whenStable();
    const pages = page.querySelectorAll('.carte__page');
    expect(pages).toHaveLength(2);
    expect(pages[0]!.hasAttribute('inert')).toBe(false);
    expect(pages[1]!.hasAttribute('inert')).toBe(true);
    expect(page.querySelectorAll('.carte__boucle')).toHaveLength(3);

    // Un cran de molette : page 2. La profondeur ne bouge pas.
    page.querySelector('pz-univers')!.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pages[0]!.hasAttribute('inert')).toBe(true);
    expect(pages[1]!.hasAttribute('inert')).toBe(false);
    expect(nav.etat().profondeur).toBe(1);
    expect(nav.universOuvert()).toBe('intuition');

    // Le premier point ramène à la page 1.
    page.querySelector<HTMLElement>('.carte__point')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pages[0]!.hasAttribute('inert')).toBe(false);
  });

  it('Overmind et Founders : cinq extraits légendés, et le code à côté de la démo', async () => {
    for (const [id, nom] of [['overmind', 'Overmind 3D'], ['founders', 'Overmind Founders Collection']]) {
      nav.ouvrirUnivers(id!);
      fixture.detectChanges();
      await fixture.whenStable();
      const carte = (fixture.nativeElement as HTMLElement).querySelector(`pz-univers [role="dialog"][aria-label="${nom}"]`)!;
      expect(carte.querySelectorAll('.carte__page')).toHaveLength(2);
      expect(carte.querySelectorAll('.carte__boucle')).toHaveLength(5);
      expect(carte.querySelector('.carte__legende')?.textContent).toBeTruthy();
      const boutons = [...carte.querySelectorAll('.carte__demo-liens a')].map((a) => a.textContent?.trim());
      expect(boutons).toEqual(['Démo en ligne', 'Code']);
      expect(carte.querySelector('.carte__liens')).toBeNull();
      nav.fermerUnivers();
      fixture.detectChanges();
      await fixture.whenStable();
    }
  });

  it('en anglais, la carte ouverte a ses textes et ses intertitres anglais', async () => {
    TestBed.inject(LangueSite).langue.set('en');
    nav.ouvrirUnivers('overmind');
    fixture.detectChanges();
    await fixture.whenStable();
    const carte = (fixture.nativeElement as HTMLElement).querySelector('pz-univers [role="dialog"]')!;
    expect(carte.querySelector('.carte__baseline')?.textContent).toContain('Real-time robotic eye');
    const intertitres = [...carte.querySelectorAll('.carte__intertitre')].map((h) => h.textContent?.trim());
    expect(intertitres).toEqual(['The project', 'My part', 'The challenge', "What's next"]);
    expect(carte.querySelector('.carte__fermer')?.getAttribute('aria-label')).toBe('Close');
  });

  it('la carte ouverte est une boîte de dialogue nommée', async () => {
    nav.ouvrirUnivers('overmind');
    fixture.detectChanges();
    await fixture.whenStable();
    const dialogue = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    expect(dialogue?.getAttribute('aria-label')).toBe('Overmind 3D');
    expect(dialogue?.getAttribute('aria-modal')).toBe('true');
  });
});
