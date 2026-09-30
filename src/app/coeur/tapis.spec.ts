import { describe, expect, it } from 'vitest';
import { aRetirer, lirePiste, morceauA, prochainMorceau } from './tapis';

// — Une piste fabriquée, au format de `scripts/pistes-video.sh` —

function boite(type: string, ...contenu: Uint8Array[]): Uint8Array {
  const taille = 8 + contenu.reduce((s, c) => s + c.length, 0);
  const o = new Uint8Array(taille);
  new DataView(o.buffer).setUint32(0, taille);
  for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  let p = 8;
  for (const c of contenu) {
    o.set(c, p);
    p += c.length;
  }
  return o;
}
const u32 = (n: number) => {
  const o = new Uint8Array(4);
  new DataView(o.buffer).setUint32(0, n);
  return o;
};
const octets = (...n: number[]) => Uint8Array.from(n);

/** Une piste H.264 à l'échelle 1000, un fragment toutes les 2 s. */
function piste(fragments: number): Uint8Array {
  const mdhd = boite('mdhd', octets(0, 0, 0, 0), u32(0), u32(0), u32(1000), u32(0));
  const avcC = boite('avcC', octets(1, 0x64, 0x00, 0x28));
  const avc1 = boite('avc1', new Uint8Array(78), avcC);
  const stsd = boite('stsd', octets(0, 0, 0, 0), u32(1), avc1);
  const moov = boite('moov', boite('trak', boite('mdia', mdhd, boite('minf', boite('stbl', stsd)))));
  const parties = [boite('ftyp', octets(105, 115, 111, 109)), moov];
  for (let i = 0; i < fragments; i++) {
    const tfdt = boite('tfdt', octets(0, 0, 0, 0), u32(i * 2000));
    parties.push(boite('moof', boite('traf', tfdt)), boite('mdat', octets(i)));
  }
  const tout = new Uint8Array(parties.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const x of parties) {
    tout.set(x, p);
    p += x.length;
  }
  return tout;
}

describe('la lecture d’une piste', () => {
  it('lit le codec dans l’en-tête', () => {
    expect(lirePiste(piste(9), 0).codec).toBe('avc1.640028');
  });

  it('sans apparition, tout est boucle', () => {
    const p = lirePiste(piste(9), 0);
    expect(p.intro.length).toBe(0);
    expect(p.boucle.length).toBeGreaterThan(0);
    expect(p.entete[4]).toBe('f'.charCodeAt(0)); // ftyp en tête
  });

  it('coupe l’apparition sur la frontière de fragment', () => {
    const p = lirePiste(piste(13), 8);
    // 4 fragments avant 8 s, 9 après : les deux parties se suivent.
    expect(p.intro.byteOffset + p.intro.length).toBe(p.boucle.byteOffset);
    expect(String.fromCharCode(...p.boucle.subarray(4, 8))).toBe('moof');
  });

  it('refuse une apparition qui tomberait au milieu d’un fragment', () => {
    expect(() => lirePiste(piste(13), 7)).toThrow(/frontière/);
  });
});

describe('le planning du tapis', () => {
  it('le tapis d’Hermès : l’apparition, puis les tours de boucle à la suite', () => {
    expect(morceauA(3, 8, 18)).toEqual({ quoi: 'intro', decalage: 0, debut: 0, fin: 8 });
    expect(morceauA(8, 8, 18)).toEqual({ quoi: 'boucle', decalage: 0, debut: 8, fin: 26 });
    expect(morceauA(30, 8, 18)).toEqual({ quoi: 'boucle', decalage: 18, debut: 26, fin: 44 });
  });

  it('la salle 2 n’a que des tours', () => {
    expect(morceauA(40, 0, 18)).toEqual({ quoi: 'boucle', decalage: 36, debut: 36, fin: 54 });
  });

  it('pose ce qui manque, dans l’ordre, jusqu’à l’horizon', () => {
    expect(prochainMorceau(0, 20, 8, 18, [])?.quoi).toBe('intro');
    expect(prochainMorceau(0, 20, 8, 18, [[0, 8]])).toMatchObject({ quoi: 'boucle', decalage: 0 });
    expect(prochainMorceau(0, 20, 8, 18, [[0, 26]])).toBeNull();
    // Le tour suivant est posé AVANT la fin du tour en cours.
    expect(prochainMorceau(20, 12, 8, 18, [[0, 26]])).toMatchObject({ debut: 26, decalage: 18 });
  });

  it('tolère les bords arrondis à l’image par MSE', () => {
    expect(prochainMorceau(0, 10, 0, 18, [[0.02, 17.99]])).toBeNull();
  });

  it('retire ce qui est loin derrière, et ce qui traîne loin devant', () => {
    expect(aRetirer(100, 4, 40, [[60, 120]])).toEqual([[60, 96]]);
    // Après un retour au début : les tours d'avant ne servent plus.
    expect(aRetirer(0, 4, 40, [[0, 26], [80, 116]])).toEqual([[80, 116]]);
    expect(aRetirer(10, 4, 40, [[0, 30]])).toEqual([[0, 6]]);
  });
});
