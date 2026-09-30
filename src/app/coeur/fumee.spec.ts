import { describe, expect, it } from 'vitest';
import { PROFILS, dureeBouffee, epaisseur, epaisseurBouffee, vivantes } from './fumee';

describe('la fumée des cartes', () => {
  const apparition = { genre: 'apparition', debut: 10 } as const;
  const p = PROFILS.apparition;

  it('une bouffée monte, tient, puis retombe à rien', () => {
    expect(epaisseurBouffee(apparition, 9)).toBe(0);
    expect(epaisseurBouffee(apparition, 10)).toBe(0);
    expect(epaisseurBouffee(apparition, 10 + p.montee / 2)).toBeCloseTo(0.5);
    expect(epaisseurBouffee(apparition, 10 + p.montee + p.tenue / 2)).toBe(1);
    expect(epaisseurBouffee(apparition, 10 + dureeBouffee('apparition'))).toBe(0);
  });

  // La pente la plus raide permise : celle d'une montée ou d'une descente
  // lissée (1,5 fois la pente moyenne), sur le temps le plus court. Au-delà,
  // ce serait un saut, pas un mouvement.
  const temps = Object.values(PROFILS).flatMap((q) => [q.montee, q.descente]);
  const PAS_MAX = (1.5 / Math.min(...temps)) / 60 + 1e-9;

  it('sans à-coup : aucune image ne saute plus que la pente la plus raide', () => {
    let avant = 0;
    for (let t = 10; t < 10 + dureeBouffee('apparition'); t += 1 / 60) {
      const e = epaisseurBouffee(apparition, t);
      expect(Math.abs(e - avant)).toBeLessThanOrEqual(PAS_MAX);
      avant = e;
    }
  });

  it('deux bouffées qui se croisent ne s’additionnent pas, et restent continues', () => {
    // La molette repart vers le haut alors que les cartes finissent d'apparaître.
    const aller = { genre: 'apparition', debut: 0 } as const;
    const retour = { genre: 'disparition', debut: 2 } as const;
    let avant = epaisseur([aller, retour], 0);
    for (let t = 0; t < 5; t += 1 / 60) {
      const e = epaisseur([aller, retour], t);
      expect(e).toBeLessThanOrEqual(1);
      expect(Math.abs(e - avant)).toBeLessThanOrEqual(PAS_MAX);
      avant = e;
    }
  });

  it('une bouffée retombée est oubliée, pas avant', () => {
    const b = { genre: 'disparition', debut: 0 } as const;
    expect(vivantes([b], dureeBouffee('disparition') - 0.01)).toHaveLength(1);
    expect(vivantes([b], dureeBouffee('disparition'))).toHaveLength(0);
  });

  it('les cartes repartent plus vite qu’elles n’arrivent', () => {
    expect(PROFILS.disparition.montee).toBeLessThan(PROFILS.apparition.montee);
    expect(dureeBouffee('disparition')).toBeLessThan(dureeBouffee('apparition'));
  });
});
