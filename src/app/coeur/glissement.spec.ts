import { describe, expect, it } from 'vitest';
import { avancerGlissement, cibleRetenue, glissementArrive, type Glissement } from './glissement';

const TAU = 0.22;
const IMAGE = 1 / 60; // une image à 60 Hz

/** Fait tourner le ressort pendant `secondes` et rend l'état final. */
function pendant(secondes: number, depart: Glissement, cible: number, dt = IMAGE): Glissement {
  let e = depart;
  for (let t = 0; t < secondes; t += dt) e = avancerGlissement(e, cible, dt, TAU);
  return e;
}

describe('le glissement de la caméra', () => {
  const REPOS: Glissement = { position: 0, vitesse: 0 };

  it('part immobile — c’est toute la raison d’être du ressort', () => {
    // L'ancienne loi partait à sa vitesse maximale : Paul le voyait comme
    // « une sorte de petit saut ». Après une image, on a à peine bougé.
    const apres = avancerGlissement(REPOS, 1, IMAGE, TAU);
    expect(Math.abs(apres.position)).toBeLessThan(0.01);
    expect(apres.vitesse).toBeGreaterThan(0);
  });

  it('accélère puis freine, au lieu de freiner tout du long', () => {
    const a = pendant(0.05, REPOS, 1);
    const b = pendant(0.05, a, 1);
    const c = pendant(0.45, b, 1);
    expect(b.vitesse).toBeGreaterThan(a.vitesse); // ça accélère encore
    expect(c.vitesse).toBeLessThan(b.vitesse); // puis ça freine
  });

  it('arrive, et s’arrête', () => {
    // Un ressort critique met plus longtemps qu'une exponentielle à finir :
    // il est à 95 % au bout de 4,7 TAU, mais il lui faut 13 TAU pour tenir le
    // critère d'arrêt. C'est sans conséquence à l'œil — sur les dernières
    // images il reste 0,14 px de déplacement sur une vue de 1440 — mais le
    // test doit lui laisser ce temps-là.
    const fin = pendant(14 * TAU, REPOS, 1);
    expect(fin.position).toBeCloseTo(1, 3);
    expect(glissementArrive(fin, 1, TAU)).toBe(true);
  });

  it('a parcouru l’essentiel du chemin bien avant de s’être posé', () => {
    expect(pendant(4.7 * TAU, REPOS, 1).position).toBeGreaterThan(0.94);
  });

  it('ne dépasse jamais sa cible — critiquement amorti, pas élastique', () => {
    let e = REPOS;
    for (let t = 0; t < 3; t += IMAGE) {
      e = avancerGlissement(e, 1, IMAGE, TAU);
      expect(e.position).toBeLessThanOrEqual(1.000001);
    }
  });

  it('descend aussi bien qu’il monte', () => {
    const fin = pendant(14 * TAU, REPOS, -1);
    expect(fin.position).toBeCloseTo(-1, 3);
  });

  it('reste stable quand une image met longtemps à arriver', () => {
    // Un onglet en arrière-plan, un ralentissement : le pas doit encaisser
    // sans se mettre à osciller. C'est ce que garantit le schéma
    // semi-implicite, et ce qu'un schéma naïf ne garantit pas.
    let e = REPOS;
    for (let i = 0; i < 60; i++) e = avancerGlissement(e, 1, 0.1, TAU);
    expect(e.position).toBeCloseTo(1, 3);
    expect(Math.abs(e.vitesse)).toBeLessThan(0.01);
  });

  it('un pas de durée nulle ne change rien', () => {
    const e = { position: 0.3, vitesse: 2 };
    expect(avancerGlissement(e, 1, 0, TAU)).toBe(e);
  });

  it('n’est pas arrivé tant qu’il bouge encore, même au bon endroit', () => {
    // Sinon on couperait l'animation en plein élan, et la caméra
    // s'arrêterait net au passage de la cible.
    expect(glissementArrive({ position: 1, vitesse: 3 }, 1, TAU)).toBe(false);
    expect(glissementArrive({ position: 1, vitesse: 0 }, 1, TAU)).toBe(true);
  });
});

describe('la cible retenue au départ d’une salle', () => {
  it('part de là où l’on est, et rejoint la vraie cible au bout de la durée', () => {
    expect(cibleRetenue(0, 1, 0, 0.5)).toBe(0);
    expect(cibleRetenue(0, 1, 0.25, 0.5)).toBeCloseTo(0.5);
    expect(cibleRetenue(0, 1, 0.5, 0.5)).toBe(1);
    expect(cibleRetenue(0, 1, 3, 0.5)).toBe(1);
  });

  it('démarre imperceptiblement : presque rien au premier cinquième', () => {
    expect(cibleRetenue(0, 1, 0.1, 0.5)).toBeLessThan(0.11);
  });

  it('sans retenue, la cible est la vraie cible tout de suite', () => {
    expect(cibleRetenue(0, 1, 0, 0)).toBe(1);
  });
});
