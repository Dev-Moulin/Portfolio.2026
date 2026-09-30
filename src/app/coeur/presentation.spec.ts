import { describe, expect, it } from 'vitest';
import { grapheDe, RACINE } from './contenu';
import { cheminProfondeur } from './geometrie';
import { ARRIVEE, opaciteContenu, opaciteOuvertureInvisible, opaciteTrame, pieceMontee, DEPART_TRAME, sallesMontees, departCarte, departCarteEtroite } from './presentation';

describe('opacité du contenu d’une pièce', () => {
  it('est pleine quand on est dedans', () => {
    expect(opaciteContenu(2, 2)).toBe(1);
  });

  it('s’efface une fois la pièce dépassée', () => {
    expect(opaciteContenu(3, 2)).toBe(0);
    expect(opaciteContenu(2.4, 2)).toBeGreaterThan(0);
    expect(opaciteContenu(2.4, 2)).toBeLessThan(1);
  });

  it('la pièce suivante est déjà lisible à travers son ouverture', () => {
    expect(opaciteContenu(0, 1)).toBeGreaterThan(0.5);
  });

  it('une pièce encore trop lointaine reste cachée (pas de bouillie grise)', () => {
    expect(opaciteContenu(0, 2)).toBe(0);
  });

  it('reste toujours entre 0 et 1', () => {
    for (let d = -2; d <= 6; d += 0.1) {
      for (let k = 0; k <= 3; k++) {
        const o = opaciteContenu(d, k);
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('la trame du seuil', () => {
  it('est pleine au seuil, et éteinte dès le début du zoom', () => {
    expect(opaciteTrame(0)).toBe(1);
    expect(opaciteTrame(DEPART_TRAME / 2)).toBeCloseTo(0.5);
    expect(opaciteTrame(DEPART_TRAME)).toBe(0);
    // Plus aucun résidu pendant la descente du « H » : elle couvre l'écran
    // à partir de 0,37, bien après.
    expect(opaciteTrame(0.3)).toBe(0);
  });
});

describe('le contenu monté d’une pièce', () => {
  it('existe exactement quand il a une opacité', () => {
    for (let d = 0; d <= 3; d += 0.01) {
      for (let k = 0; k <= 3; k++) expect(pieceMontee(d, k)).toBe(opaciteContenu(d, k) > 0);
    }
  });

  it('une pièce quittée pour la suivante n’existe plus', () => {
    // Le cas vu par Paul le 23/09 : la vignette Overmind (salle 2) peinte
    // par-dessus le visage, dans la salle Hermès.
    expect(pieceMontee(2, 1)).toBe(false);
    expect(pieceMontee(2, 0)).toBe(false);
  });
});

describe('les salles montées, posées à part (23/09)', () => {
  const montees = (format: 'large' | 'etroit', d: number) => {
    const g = grapheDe(format);
    return [...sallesMontees(d, cheminProfondeur(g, RACINE), g)];
  };

  it('grand écran : une salle au repos, jamais plus de deux', () => {
    expect(montees('large', 0)).toEqual(['seuil']);
    expect(montees('large', 1)).toEqual(['projets']);
    // Plus de carte d'aperçu du portfolio 3D dans la salle Hermès (23/09) :
    // son passage est invisible, en attendant le zoom dans la pupille.
    expect(montees('large', 2)).toEqual(['orchestrateur']);
    for (let d = 0; d <= 3; d += 0.005) expect(montees('large', d).length).toBeLessThanOrEqual(2);
  });

  it('grand écran : derrière une porte invisible, rien n’existe avant d’arriver', () => {
    // Pendant la descente du « H », seule la toile se voit : la salle 2 n'est
    // montée qu'une fois le noir atteint.
    expect(montees('large', 0.95)).toEqual([]);
    expect(montees('large', 0.98)).toEqual(['projets']);
    // Pendant la porte du temple, pareil jusqu'au visage entier.
    expect(montees('large', 1.95)).toEqual([]);
    expect(montees('large', 1.98)).toEqual(['orchestrateur']);
  });

  it('téléphone : la porte du temple est invisible aussi (29/09), la salle Hermès attend son passage', () => {
    expect(montees('etroit', 1)).toEqual(['projets']);
  });
});

describe('opacité d’une ouverture invisible', () => {
  it('ne montre RIEN depuis la pièce d’avant — c’est tout l’enjeu', () => {
    // Au seuil (0), la salle 2 est à l'index 1 : on ne doit pas voir
    // d'avance la fenêtre dans laquelle on va.
    expect(opaciteOuvertureInvisible(0, 1)).toBe(0);
    expect(opaciteOuvertureInvisible(0, 2)).toBe(0);
  });

  it('se révèle en approchant, et est entière avant qu’on entre', () => {
    // Écrit en fonction d'ARRIVEE, et pas de chiffres en dur : ces deux
    // bornes sont un RÉGLAGE, qui a déjà bougé une fois le jour où les
    // étages engendrés ont rendu inutile de masquer le flou. Le test doit
    // survivre au prochain réglage, pas être recalé à chaque fois.
    const milieu = 1 + (ARRIVEE.debut + ARRIVEE.fin) / 2;
    expect(opaciteOuvertureInvisible(milieu, 1)).toBeGreaterThan(0);
    expect(opaciteOuvertureInvisible(milieu, 1)).toBeLessThan(1);
    // Pile aux bornes : entière et nulle, à l'erreur de virgule flottante près.
    expect(opaciteOuvertureInvisible(1 + ARRIVEE.fin, 1)).toBeCloseTo(1);
    expect(opaciteOuvertureInvisible(1 + ARRIVEE.debut, 1)).toBeCloseTo(0);
    // Franchement au-delà : bornée, sans approximation.
    expect(opaciteOuvertureInvisible(1 + ARRIVEE.fin + 0.01, 1)).toBe(1);
    expect(opaciteOuvertureInvisible(1 + ARRIVEE.debut - 0.01, 1)).toBe(0);
  });

  it('laisse la descente pré-calculée occuper la quasi-totalité du trajet', () => {
    // La raison d'être des seize étages engendrés : si la salle arrivait tôt,
    // elle les masquerait. Elle ne doit donc rien montrer avant les trois
    // quarts de la descente.
    expect(opaciteOuvertureInvisible(0.75, 1)).toBe(0);
  });

  it('reste entière une fois qu’on est dedans ou au-delà', () => {
    expect(opaciteOuvertureInvisible(1, 1)).toBe(1);
    expect(opaciteOuvertureInvisible(3, 1)).toBe(1);
  });

  it('ne sort jamais de [0, 1]', () => {
    for (let d = -1; d <= 4; d += 0.05) {
      const o = opaciteOuvertureInvisible(d, 1);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});

describe('la carte d’un projet ouverte en grand', () => {
  it('démarre pile sur sa vignette, dans les deux formats', () => {
    for (const format of ['large', 'etroit'] as const) {
      const salle2 = grapheDe(format)['projets']!;
      for (const o of salle2.ouvertures.filter((v) => v.cible.genre === 'laterale')) {
        const c = departCarte(o);
        // Ses bords retombent exactement sur ceux de la vignette.
        expect(c.centreX - c.largeur / 2).toBeCloseTo(o.x * 100, 9);
        expect(c.centreY - c.hauteur / 2).toBeCloseTo(o.y * 100, 9);
        expect(c.largeur).toBeCloseTo(o.w * 100, 9);
        expect(c.hauteur).toBeCloseTo(o.w * 100, 9);
      }
    }
  });
});

describe('la carte ouverte au téléphone', () => {
  it('part de la carte présentée au centre, la même pour les trois projets', () => {
    expect(departCarteEtroite()).toEqual({ centreX: 50, centreY: 60, largeur: 76, hauteur: 36 });
  });
});
