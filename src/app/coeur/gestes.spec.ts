// Tests d'acceptation du lot PH-2 : les gestes du doigt.
//
// Comme ceux de PH-1, ils portent tous sur des VALEURS CALCULÉES — des
// nombres, des cadres — et jamais sur un événement tactile ou une chaîne
// dans un gabarit. Le moteur des gestes ne connaît ni le DOM ni le pixel :
// il raisonne en hauteurs de vue, ce qui le rend jouable dans le conteneur,
// sans navigateur.
//
// Ce fichier couvre aussi les deux briques de `geometrie.ts` et la règle
// d'affichage de `presentation.ts` que ce lot ajoute : elles font partie du
// même travail, et les rassembler ici évite de toucher aux specs existantes.

import { describe, expect, it } from 'vitest';
import {
  BUTEE_MAX,
  SEUIL_FRANCHISSEMENT,
  SEUIL_INVITE,
  defilementsDuSegment,
  glisser,
  poser,
  type Trajet,
} from './gestes';
import { cadre, cadreAvecDefilement, decalerCadre, decalerEcrans, segmentDe } from './geometrie';
import { invite } from './presentation';
import { RACINE, grapheDe } from './contenu';

/** Une pièce de 3 écrans de haut : 2 écrans d'amplitude, des nombres ronds. */
const HAUTE = 3;
/** Une pièce d'un écran : amplitude nulle, le cas de tout le contenu actuel. */
const PLATE = 1;

describe('glisser — le doigt fait défiler la pièce', () => {
  it('avance dans la pièce en proportion de sa hauteur', () => {
    // 1 écran de doigt sur 2 écrans d'amplitude : on est à la moitié.
    expect(glisser(poser(0), 1, HAUTE).defilement).toBeCloseTo(0.5, 10);
  });

  it('mesure la course en écrans de PIÈCE, pas en fraction fixe', () => {
    // Le même geste ne va pas aussi loin dans une pièce plus haute.
    expect(glisser(poser(0), 0.25, 2).defilement).toBeCloseTo(0.25, 10);
    expect(glisser(poser(0), 0.25, HAUTE).defilement).toBeCloseTo(0.125, 10);
  });

  it('accumule la course d’un déplacement à l’autre', () => {
    const premier = glisser(poser(0), 0.5, HAUTE);
    expect(glisser(premier.geste, 0.5, HAUTE).defilement).toBeCloseTo(0.5, 10);
  });

  it('repart du point où le doigt s’est posé, pas du haut de la pièce', () => {
    expect(glisser(poser(0.5), -1, HAUTE).defilement).toBeCloseTo(0, 10);
  });

  it('ne sort jamais de [0, 1], si loin qu’on pousse', () => {
    expect(glisser(poser(0), 10, HAUTE).defilement).toBe(1);
    expect(glisser(poser(1), -10, HAUTE).defilement).toBe(0);
  });

  it('ne défile pas — et ne divise pas par zéro — dans une pièce d’un écran', () => {
    const r = glisser(poser(0), 0.5, PLATE);
    expect(r.defilement).toBe(0);
    expect(Number.isNaN(r.defilement)).toBe(false);
  });

  it('rend un geste reportable tel quel au déplacement suivant', () => {
    const r = glisser(poser(0.25), 0.4, HAUTE);
    expect(r.geste.defilementAuPoser).toBe(0.25);
    expect(r.geste.parcouru).toBeCloseTo(0.4, 10);
  });
});

describe('la butée — ce qui dépasse du bord', () => {
  it('ne dépasse pas tant qu’il reste de la pièce à parcourir', () => {
    expect(glisser(poser(0), 1, HAUTE).butee).toBe(0);
  });

  it('suit le doigt au départ, à mieux que 5 % près', () => {
    // La pente vaut 1 à l'origine : les premiers pixels ne résistent pas.
    const r = glisser(poser(0), 0.004, PLATE);
    expect(r.butee).toBeLessThanOrEqual(0.004);
    expect(r.butee).toBeGreaterThan(0.004 * 0.95);
  });

  it('ne franchit jamais BUTEE_MAX, si fort qu’on tire', () => {
    const r = glisser(poser(0), 100, PLATE);
    expect(r.butee).toBeLessThan(BUTEE_MAX);
    expect(r.butee).toBeGreaterThan(BUTEE_MAX * 0.99);
  });

  it('grandit avec la course, sans jamais reculer', () => {
    const butees = [0.02, 0.05, 0.1, 0.3, 1].map((c) => glisser(poser(0), c, PLATE).butee);
    for (let i = 1; i < butees.length; i++) {
      expect(butees[i]!).toBeGreaterThan(butees[i - 1]!);
    }
  });

  it('est signée : négative quand on tire vers le haut', () => {
    const r = glisser(poser(0), -1, PLATE);
    expect(r.butee).toBeLessThan(0);
    expect(r.butee).toBeGreaterThan(-BUTEE_MAX);
  });

  it('compte à partir du bord, pas du poser : partir du milieu ne bute pas plus tôt', () => {
    // 0,5 dans une pièce de 3 écrans = 1 écran déjà parcouru ; il en reste 1.
    expect(glisser(poser(0.5), 1, HAUTE).butee).toBe(0);
    expect(glisser(poser(0.5), 1.1, HAUTE).butee).toBeGreaterThan(0);
  });
});

describe('le franchissement — un balayage de plus', () => {
  it('LE point du lot : le balayage qui ATTEINT la butée ne franchit pas', () => {
    // Un seul geste qui traverse toute la pièce et pousse bien au-delà.
    const r = glisser(poser(0), 2 + SEUIL_FRANCHISSEMENT * 3, HAUTE);
    expect(r.defilement).toBe(1);
    expect(r.butee).toBeGreaterThan(0);
    expect(r.franchir).toBe(0);
  });

  it('le balayage SUIVANT, lui, franchit', () => {
    // Le doigt s'est levé et se repose : la pièce était déjà en bas.
    expect(glisser(poser(1), SEUIL_FRANCHISSEMENT * 1.5, HAUTE).franchir).toBe(1);
  });

  it('une pièce d’un écran est armée dès le premier balayage', () => {
    // Elle est à la fois en haut et en bas d'elle-même : c'est ce qui garde
    // au contenu actuel son geste unique par pièce.
    expect(glisser(poser(0), SEUIL_FRANCHISSEMENT * 1.5, PLATE).franchir).toBe(1);
    expect(glisser(poser(0), -SEUIL_FRANCHISSEMENT * 1.5, PLATE).franchir).toBe(-1);
  });

  it('demande une vraie poussée, pas un frôlement', () => {
    expect(glisser(poser(0), SEUIL_FRANCHISSEMENT * 0.5, PLATE).franchir).toBe(0);
  });

  it('remonte quand on est en haut d’une pièce haute', () => {
    expect(glisser(poser(0), -SEUIL_FRANCHISSEMENT * 1.5, HAUTE).franchir).toBe(-1);
  });

  it('n’arme que du côté où le doigt part', () => {
    // En bas d'une pièce haute, tirer vers le haut, c'est y remonter.
    const r = glisser(poser(1), -SEUIL_FRANCHISSEMENT * 1.5, HAUTE);
    expect(r.franchir).toBe(0);
    expect(r.defilement).toBeLessThan(1);
  });

  it('un doigt immobile ne franchit rien', () => {
    expect(glisser(poser(0), 0, PLATE).franchir).toBe(0);
  });
});

describe('defilementsDuSegment — où la caméra se pose', () => {
  const trajet = (origine: number, cible: number, defilementCible: number): Trajet => ({
    origine,
    cible,
    defilementCible,
  });

  it('immobile dans une pièce : seul son défilement compte', () => {
    expect(defilementsDuSegment(1, trajet(1, 1, 0.5))).toEqual([0.5, 0]);
  });

  it('immobile dans la pièce du fond, qui est le bout profond de son segment', () => {
    expect(defilementsDuSegment(2, trajet(3, 3, 0.5))).toEqual([1, 0.5]);
  });

  it('en descendant : on quitte par le bas, on arrive en haut', () => {
    expect(defilementsDuSegment(1, trajet(1, 2, 0))).toEqual([1, 0]);
  });

  it('en remontant : on quitte par le haut, on arrive en bas', () => {
    // Même paire qu'en descendant, et c'est le résultat intéressant : la
    // convention ne dépend pas du sens, seule la pièce quittée en dépend.
    expect(defilementsDuSegment(1, trajet(2, 1, 1))).toEqual([1, 0]);
  });

  it('la première image d’une remontée montre la pièce quittée par son HAUT', () => {
    // Sans cette règle, le premier instant du retour ferait sauter la caméra
    // au bas de la pièce qu'on vient de quitter — d'où l'origine du trajet.
    expect(defilementsDuSegment(2, trajet(2, 1, 1))).toEqual([0, 0]);
  });

  it('une pièce simplement traversée suit la convention, dans les deux sens', () => {
    expect(defilementsDuSegment(1, trajet(0, 3, 0))).toEqual([1, 0]);
    expect(defilementsDuSegment(1, trajet(3, 0, 1))).toEqual([1, 0]);
  });

  it('la cible l’emporte sur l’origine, des deux côtés du segment', () => {
    expect(defilementsDuSegment(1, trajet(1, 1, 0.3))).toEqual([0.3, 0]);
    expect(defilementsDuSegment(0, trajet(1, 1, 0.3))).toEqual([1, 0.3]);
  });

  it('laisse le site actuel rigoureusement identique — le critère « zéro pixel »', () => {
    // Toutes les pièces du contenu réel font un écran de haut : aucun trajet,
    // dans aucun sens, ne doit déplacer la caméra d'un cheveu. C'est ce qui
    // protège le bureau, dont ce lot ne change rien.
    const trajets = [trajet(0, 0, 0), trajet(0, 3, 0), trajet(3, 0, 1), trajet(1, 2, 0.4)];
    for (const format of ['large', 'etroit'] as const) {
      const graphe = grapheDe(format);
      for (const d of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
        for (const t of trajets) {
          const [depart, arrivee] = defilementsDuSegment(segmentDe(graphe, RACINE, d), t);
          expect(cadreAvecDefilement(graphe, RACINE, d, depart, arrivee)).toEqual(
            cadre(graphe, RACINE, d),
          );
        }
      }
    }
  });
});

describe('geometrie — les deux briques que le lot ajoute', () => {
  const racine = { x: 0, y: 0, w: 1 };

  it('decalerEcrans descend d’exactement une hauteur de vue', () => {
    expect(decalerEcrans(racine, 1)).toEqual({ x: 0, y: 1, w: 1 });
    expect(decalerEcrans(racine, -0.5)).toEqual({ x: 0, y: -0.5, w: 1 });
  });

  it('decalerEcrans s’exprime dans le repère du cadre, et ne zoome pas', () => {
    const decale = decalerEcrans({ x: 0.25, y: 0.5, w: 0.5 }, 2);
    expect(decale.y).toBeCloseTo(1.5, 10);
    expect(decale.x).toBe(0.25);
    expect(decale.w).toBe(0.5);
  });

  it('decalerCadre n’est plus qu’un cas particulier de decalerEcrans', () => {
    // Le décalage vertical n'existe qu'à un seul endroit : c'est le critère
    // d'acceptation n° 5, et il se vérifie par le comportement.
    for (const c of [racine, { x: 0.25, y: 0.5, w: 0.5 }]) {
      for (const hauteur of [1, 2, 3.5]) {
        for (const defilement of [0, 0.25, 1]) {
          expect(decalerCadre(c, hauteur, defilement)).toEqual(
            decalerEcrans(c, defilement * (hauteur - 1)),
          );
        }
      }
    }
  });

  it('segmentDe nomme la paire de pièces entre lesquelles on se trouve', () => {
    const graphe = grapheDe('large'); // 3 pièces, donc N = 2
    expect(segmentDe(graphe, RACINE, 0)).toBe(0);
    expect(segmentDe(graphe, RACINE, 0.9)).toBe(0);
    expect(segmentDe(graphe, RACINE, 1)).toBe(1);
    expect(segmentDe(graphe, RACINE, 1.5)).toBe(1);
  });

  it('segmentDe sature aux deux bouts, sans jamais désigner le vide', () => {
    const graphe = grapheDe('large');
    expect(segmentDe(graphe, RACINE, -10)).toBe(0);
    // Au fond, le dernier segment est (N−1, N) : il n'y a pas de pièce N+1.
    expect(segmentDe(graphe, RACINE, 2)).toBe(1);
    expect(segmentDe(graphe, RACINE, 99)).toBe(1);
  });
});

describe('invite — le mot qui dit qu’il y a autre chose au-delà', () => {
  const CHEMIN = 3; // le vrai site : seuil, projets, orchestrateur

  it('ne dit rien tant que rien ne bute', () => {
    expect(invite(0, 1, CHEMIN)).toBeNull();
  });

  it('ne dit rien quand il n’y a rien au-delà', () => {
    expect(invite(0.05, 2, CHEMIN)).toBeNull(); // le fond, vers le bas
    expect(invite(-0.05, 0, CHEMIN)).toBeNull(); // le seuil, vers le haut
  });

  it('désigne la pièce d’à côté, avec sa flèche', () => {
    expect(invite(0.05, 1, CHEMIN)).toEqual({ vers: 2, fleche: '↓', opacite: 1 });
    expect(invite(-0.05, 1, CHEMIN)).toEqual({ vers: 0, fleche: '↑', opacite: 1 });
  });

  it('apparaît progressivement, puis sature', () => {
    expect(invite(SEUIL_INVITE / 2, 1, CHEMIN)!.opacite).toBeCloseTo(0.5, 10);
    expect(invite(BUTEE_MAX, 1, CHEMIN)!.opacite).toBe(1);
  });

  it('est complet AVANT qu’on puisse franchir — c’est sa raison d’être', () => {
    // Le mot doit avoir eu le temps d'être lu quand la poussée atteint le
    // seuil de franchissement ; sinon il ne sert à rien.
    const r = glisser(poser(0), SEUIL_FRANCHISSEMENT, PLATE);
    expect(invite(r.butee, 1, CHEMIN)!.opacite).toBe(1);
  });
});
