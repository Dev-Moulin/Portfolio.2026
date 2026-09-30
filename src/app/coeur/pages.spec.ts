import { describe, expect, it } from 'vitest';
import { pageArrivee, tourner } from './pages';

describe('les pages d’une carte de texte', () => {
  it('tournent d’une page dans chaque sens', () => {
    expect(tourner(0, 3, 1)).toBe(1);
    expect(tourner(2, 3, -1)).toBe(1);
  });

  it('s’arrêtent aux bords : la molette passe alors à la salle voisine', () => {
    expect(tourner(2, 3, 1)).toBeNull();
    expect(tourner(0, 3, -1)).toBeNull();
    expect(tourner(0, 1, 1)).toBeNull(); // une carte d'une seule page ne retient rien
  });

  it('on arrive sur la première page en descendant, la dernière en remontant', () => {
    expect(pageArrivee(4, 1)).toBe(0);
    expect(pageArrivee(4, -1)).toBe(3);
    expect(pageArrivee(1, -1)).toBe(0);
  });
});
