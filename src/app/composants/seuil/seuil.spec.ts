// PH-3 lot 1 : la photo dans le seuil, et le passage invisible vers la
// salle 2. Ce que jsdom NE PEUT PAS vérifier — l'objet réel de la photo
// sous @media (orientation: portrait), sa taille à l'écran, la sensation du
// défilement — reste « à vérifier à l'œil » ; ces tests couvrent ce qui est
// vérifiable sans rendu réel : la présence, le texte alternatif, et le fait
// que le passage a bien perdu son liseré.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Seuil } from './seuil';
import { Navigation } from '../../navigation';

/**
 * Le glissement de caméra est coupé : les tests observent l'état, pas
 * l'animation. `etroit` simule en plus un téléphone en portrait.
 */
function sansGlissement(etroit = false) {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: requete.includes('prefers-reduced-motion') || (etroit && requete.includes('portrait')),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('pz-seuil — la photo et le passage invisible', () => {
  let fixture: ComponentFixture<Seuil>;
  let nav: Navigation;

  beforeEach(async () => {
    sansGlissement();
    await TestBed.configureTestingModule({ imports: [Seuil] }).compileComponents();
    fixture = TestBed.createComponent(Seuil);
    nav = TestBed.inject(Navigation);
    fixture.detectChanges();
  });

  it('affiche le portrait, avec un texte alternatif', () => {
    const photo = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>(
      '.seuil__photo',
    );
    expect(photo).toBeTruthy();
    expect(photo!.getAttribute('src')).toBe('paul-portrait.webp');
    expect(photo!.getAttribute('alt')?.length ?? 0).toBeGreaterThan(0);
  });

  it('la photo reste OPAQUE : c’est ce qui rend le raccord exact', () => {
    // Elle ne partage pas le fondu du contenu, et n'a pas d'opacité à elle.
    //
    // Deux calques translucides ne se relaient jamais proprement : à
    // mi-fondu il reste (1-a)(1-b) de fond qui passe au travers, et le fond
    // du seuil étant presque noir, l'écran s'assombrissait de 18 % au moment
    // où la descente pré-calculée prenait la main. Paul le voyait comme « un
    // petit glitch quand on revient en arrière » — au retour seulement,
    // parce qu'on arrive dessus en décélérant.
    //
    // Remettre la photo dans `piece__contenu`, ou lui rendre une opacité,
    // ramènerait le creux. D'où ce test.
    const hote = fixture.nativeElement as HTMLElement;
    const contenu = hote.querySelector('.piece__contenu')!;
    const photo = hote.querySelector<HTMLElement>('.seuil__photo')!;
    expect(photo).toBeTruthy();
    expect(contenu.contains(photo)).toBe(false);
    expect(photo.style.opacity).toBe('');
  });

  it('cesse d’être peint dès que la descente le recouvre entièrement', () => {
    // Pas une économie de confort : la photo est mise en page à 460 px et le
    // zoom l'agrandit sans limite. À 72 % de la descente elle serait rendue à
    // 19 000 px de large et franchirait le plafond de texture de 16 384 px
    // des navigateurs ; le re-tramage fait sauter l'animation. Paul l'a vu
    // « aux trois quarts, sur le logo THP ».
    const hote = fixture.nativeElement as HTMLElement;
    const photo = hote.querySelector('.seuil__photo')!;
    const contenu = hote.querySelector('.piece__contenu')!;

    // Au seuil, la descente ne couvre rien : tout est peint.
    expect(photo.classList.contains('seuil--couvert')).toBe(false);
    expect(contenu.classList.contains('seuil--couvert')).toBe(false);

    // Une fois dans la descente, plus rien à peindre derrière la toile.
    // Profondeur posée directement, comme au milieu d'un glissement.
    (nav as unknown as { profondeurAfficheeInterne: { set(d: number): void } }).profondeurAfficheeInterne.set(0.5);
    fixture.detectChanges();
    expect(photo.classList.contains('seuil--couvert')).toBe(true);
    expect(contenu.classList.contains('seuil--couvert')).toBe(true);
    // Et dans la salle 2, le seuil n'existe même plus : c'est la page qui le
    // démonte (`sallesMontees`, vérifié dans `app.spec.ts`).
  });

  it('la photo est peinte SOUS le texte et sous l’ouverture', () => {
    // Sortir la photo du conteneur ne doit pas la faire passer devant : elle
    // reste le fond de la pièce.
    const enfants = [...(fixture.nativeElement as HTMLElement).children].map((e) => e.className);
    const photo = enfants.findIndex((c) => c.includes('seuil__photo'));
    const contenu = enfants.findIndex((c) => c.includes('piece__contenu'));
    expect(photo).toBeGreaterThanOrEqual(0);
    expect(photo).toBeLessThan(contenu);
  });

  it('ne contient plus la salle 2 : elle est posée à part, pas dans le « H »', () => {
    // Emboîtée dans une boîte de 4 px au fond du H, la salle 2 était grossie
    // ×457 et peinte jusqu'à 200 px à côté de sa place (23/09). Le passage
    // invisible n'a plus de boîte du tout : ni bouton, ni liseré.
    const hote = fixture.nativeElement as HTMLElement;
    expect(hote.querySelector('pz-ouverture')).toBeNull();
    expect(hote.querySelector('pz-projets')).toBeNull();
  });
});

describe('pz-seuil — sur téléphone', () => {
  it('ne se masque JAMAIS : la descente n’y peint rien qui le remplacerait', async () => {
    // La descente est faite d'images de la photo du seuil, et la photo n'est
    // pas affichée en format étroit. Sans cette garde, le texte du seuil
    // disparaissait sur téléphone dès le premier étage — masqué par une
    // pyramide qui ne se dessinait pas.
    sansGlissement(true);
    await TestBed.configureTestingModule({ imports: [Seuil] }).compileComponents();
    const fixture = TestBed.createComponent(Seuil);
    const nav = TestBed.inject(Navigation);
    fixture.detectChanges();

    expect(nav.format()).toBe('etroit');
    nav.viserProfondeur(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.couvertParLaDescente()).toBe(false);
    const contenu = (fixture.nativeElement as HTMLElement).querySelector('.piece__contenu')!;
    expect(contenu.classList.contains('seuil--couvert')).toBe(false);
  });
});
