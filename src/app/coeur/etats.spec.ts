import { describe, expect, it } from 'vitest';
import { deplacer, entrer, etatInitial, sortir, universConnus, viser } from './etats';
import { GRAPHE, RACINE } from './contenu';

const initial = etatInitial();

describe('les deux axes de navigation', () => {
  it('part du seuil, sans univers ouvert', () => {
    expect(initial).toEqual({ profondeur: 0, univers: null });
  });

  it('le défilement fait varier la profondeur, bornée à [0, N]', () => {
    expect(deplacer(initial, 1.25, GRAPHE, RACINE).profondeur).toBe(1.25);
    expect(deplacer(initial, -5, GRAPHE, RACINE).profondeur).toBe(0);
    expect(deplacer(initial, 99, GRAPHE, RACINE).profondeur).toBe(2);
  });

  it('viser une profondeur revient au même que s’y déplacer', () => {
    expect(viser(initial, 2, GRAPHE, RACINE)).toEqual(deplacer(initial, 2, GRAPHE, RACINE));
  });

  // L'INVARIANT DU PROJET. Il n'est pas seulement testé : `entrer` et `sortir`
  // ne touchent pas au champ `profondeur`, donc il ne peut pas être faux.
  it('entrer dans un projet ne change PAS la profondeur', () => {
    const dans = viser(initial, 1.4, GRAPHE, RACINE);
    const entre = entrer(dans, 'overmind', GRAPHE);
    expect(entre.profondeur).toBe(1.4);
    expect(entre.univers).toBe('overmind');
  });

  it('on ressort exactement là où on était, même après un détour', () => {
    let etat = viser(initial, 1.75, GRAPHE, RACINE);
    etat = entrer(etat, 'intuition', GRAPHE);
    etat = entrer(etat, 'founders', GRAPHE); // changer d’univers en cours de route
    etat = sortir(etat);
    expect(etat).toEqual({ profondeur: 1.75, univers: null });
  });

  it('le défilement conserve l’univers ouvert', () => {
    const etat = deplacer(entrer(initial, 'intuition', GRAPHE), 1, GRAPHE, RACINE);
    expect(etat.univers).toBe('intuition');
  });
});

describe('entrées latérales', () => {
  it('connaît exactement les trois univers déclarés par le graphe', () => {
    expect([...universConnus(GRAPHE)].sort()).toEqual(['founders', 'intuition', 'overmind']);
  });

  it('refuse une pièce de profondeur : ce n’est pas un univers', () => {
    expect(() => entrer(initial, 'orchestrateur', GRAPHE)).toThrow(/n'est l'univers d'aucune/);
  });

  it('refuse un identifiant inconnu', () => {
    expect(() => entrer(initial, 'fantome', GRAPHE)).toThrow();
  });

  it('sortir sans être entré ne fait rien', () => {
    expect(sortir(initial)).toBe(initial);
  });
});

describe('fonctions pures', () => {
  it('ne mutent jamais l’état reçu', () => {
    const depart = viser(initial, 1, GRAPHE, RACINE);
    const copie = { ...depart };
    entrer(depart, 'overmind', GRAPHE);
    deplacer(depart, 1, GRAPHE, RACINE);
    sortir(depart);
    expect(depart).toEqual(copie);
  });

  it('renvoient l’objet d’origine quand rien ne change (rendu économe)', () => {
    const etat = viser(initial, 2, GRAPHE, RACINE);
    expect(deplacer(etat, 5, GRAPHE, RACINE)).toBe(etat); // déjà au fond
    expect(entrer(entrer(etat, 'overmind', GRAPHE), 'overmind', GRAPHE).univers).toBe('overmind');
  });
});
