// Le lecteur des décors vidéo — le même pour la salle 2 et la salle Hermès.
//
// Il remplace, le 23/09, deux codes écrits séparément qui résolvaient le même
// problème de deux façons différentes, et dont l'analyse a montré les défauts :
//   - la salle Hermès restait FIGÉE si le navigateur refusait de lancer sa
//     boucle : le filet de secours relançait l'apparition, déjà finie ;
//   - la salle 2 relançait la vidéo à CHAQUE pause, y compris celles que
//     Chrome impose aux vidéos muettes d'un onglet caché depuis sa version
//     145 : elle tournait pour rien en arrière-plan, et ce chien de garde
//     masquait les vrais problèmes au lieu de les montrer ;
//   - toutes deux bouclaient avec `loop`, qui n'est pas sans couture.
//
// TROIS FAÇONS DE LIRE, choisies dans cet ordre selon ce que sait l'appareil :
//   1. `ManagedMediaSource` — la version de MSE des iPhone (iOS 17.1+) et de
//      Safari. Il faut désactiver AirPlay sur la vidéo, et l'appareil peut
//      demander d'arrêter d'alimenter le tapis pour économiser la batterie
//      (`streaming` passe à faux) : on obéit, il redemande quand il faut ;
//   2. `MediaSource` — Chrome, Edge, Firefox, sur tous les systèmes ;
//   3. la balise vidéo simple, en secours : même fichier, `loop` (ou un saut
//      au début de la boucle pour Hermès). Une petite couture, mais ça tourne.
// Si MSE échoue en route (fichier illisible, décodeur qui refuse), on bascule
// sur le secours au lieu de rester noir.
//
// DEUX FORMATS : H.264, puis VP9 pour les navigateurs qui ne lisent pas le
// H.264 (Firefox sur Fedora sans codec, par exemple). Le premier que
// l'appareil annonce savoir lire est pris.
//
// LE LANCEMENT. On demande la lecture quand elle est souhaitée, puis on
// réessaie seulement dans les cas où ça a un sens : la vidéo devient jouable,
// l'onglet redevient visible, l'utilisateur touche la page (ce qui lève les
// refus de lecture automatique, dont celui de l'iPhone en économie
// d'énergie). JAMAIS quand l'onglet est caché : c'est Chrome qui a mis en
// pause, et il relance lui-même au retour. Tant que rien ne tourne, la
// vidéo montre son affiche (`poster`).
//
// Tout ce qui se passe est noté, et visible avec `?diag` dans l'adresse
// (`composants/diag-video/`).

import { aRetirer, lirePiste, plagesDe, prochainMorceau, type PisteLue } from '../../coeur/tapis';

export interface Piste {
  readonly url: string;
  /** Le codec annoncé (voir `scripts/pistes-video.sh`) : on le vérifie au chargement. */
  readonly codec: string;
}

export interface ReglageTapis {
  /** Pour le diagnostic. */
  readonly nom: string;
  /** Par ordre de préférence. */
  readonly pistes: readonly Piste[];
  /** La durée de l'apparition jouée une fois au début, 0 sans apparition. */
  readonly intro: number;
  /** La durée d'un tour de boucle. */
  readonly duree: number;
}

type Mode = 'attente' | 'mms' | 'mse' | 'secours';

interface SourceMedia extends EventTarget {
  readonly readyState: string;
  duration: number;
  readonly streaming?: boolean;
  addSourceBuffer(type: string): SourceBuffer;
}
type ConstructeurSource = { new (): SourceMedia; isTypeSupported(type: string): boolean };

/** Ce que la réserve doit couvrir devant l'instant présent, en secondes. */
const HORIZON = 12;
/** Ce qu'on garde derrière, pour les petits retours en arrière du lecteur. */
const DERRIERE = 4;

/** Les lecteurs vivants, pour le panneau de diagnostic. */
export const lecteursActifs = new Set<TapisVideo>();

const pistesChargees = new Map<string, Promise<Uint8Array>>();
function charger(url: string): Promise<Uint8Array> {
  let p = pistesChargees.get(url);
  if (p === undefined) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} : HTTP ${r.status}`);
      return r.arrayBuffer().then((b) => new Uint8Array(b));
    });
    // Un échec ne doit pas rester en cache : on retentera au prochain montage.
    p.catch(() => pistesChargees.delete(url));
    pistesChargees.set(url, p);
  }
  return p;
}

export class TapisVideo {
  mode: Mode = 'attente';
  codec = '';
  refus = false;
  private souhaitee = false;
  private source: SourceMedia | null = null;
  private tampon: SourceBuffer | null = null;
  private piste: PisteLue | null = null;
  private urlObjet: string | null = null;
  private minuteur: ReturnType<typeof setInterval> | null = null;
  private readonly journal: string[] = [];
  private readonly debut = typeof performance !== 'undefined' ? performance.now() : 0;
  private readonly defaire: (() => void)[] = [];
  private detruit = false;

  constructor(
    readonly video: HTMLVideoElement,
    readonly reglage: ReglageTapis,
    private readonly premiereImage: () => void = () => {},
  ) {
    // Posé en JavaScript, pas seulement dans le gabarit : l'attribut `muted`
    // d'un élément créé par un framework ne règle que `defaultMuted`, et le
    // navigateur tient alors la vidéo pour audible — donc refuse la lecture
    // automatique (mesuré le 11/09 sur la salle 2).
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    // Exigé par l'iPhone pour `ManagedMediaSource`.
    (video as { disableRemotePlayback?: boolean }).disableRemotePlayback = true;

    this.ecouter(video, 'canplay', () => this.relancer('jouable'));
    this.ecouter(video, 'loadeddata', () => this.premiereImage());
    this.ecouter(video, 'seeking', () => this.entretenir());
    this.ecouter(video, 'error', () => this.echec(`erreur vidéo ${video.error?.code ?? ''}`));
    for (const t of ['waiting', 'stalled', 'pause', 'playing', 'ended']) {
      this.ecouter(video, t, () => this.noter(t));
    }
    this.ecouter(video, 'ended', () => this.finSecours());
    if (typeof document !== 'undefined') {
      this.ecouter(document, 'visibilitychange', () => this.relancer('onglet visible'));
      // Un geste lève les refus de lecture automatique.
      const geste = () => {
        if (this.refus) this.noter('geste : on réessaie');
        this.refus = false;
        this.relancer('geste');
      };
      for (const t of ['pointerdown', 'touchstart', 'keydown']) {
        this.ecouter(document, t, geste, { passive: true, capture: true });
      }
    }
    lecteursActifs.add(this);
    // Deux fois par seconde : l'entretien du tapis, et une garde discrète —
    // si la lecture voulue s'est arrêtée alors que l'onglet est VISIBLE et que
    // l'appareil ne l'a pas refusée, on la relance. Onglet caché, on ne touche
    // à rien (voir l'en-tête).
    this.minuteur = setInterval(() => {
      this.entretenir();
      if (this.video.readyState >= 3) this.relancer('garde');
    }, 500);
    this.demarrer();
  }

  /** La lecture est-elle voulue ? (Dans la salle : oui ; ailleurs : non.) */
  souhaite(oui: boolean): void {
    this.souhaitee = oui;
    if (oui) this.relancer('souhaitée');
    else if (!this.video.paused) this.video.pause();
  }

  /** Revient au tout début : l'apparition, s'il y en a une. */
  revenirAuDebut(): void {
    try {
      this.video.currentTime = 0;
    } catch {
      // Pas encore de métadonnées : la vidéo est déjà au début.
    }
    this.entretenir();
  }

  detruire(): void {
    this.detruit = true;
    lecteursActifs.delete(this);
    if (this.minuteur !== null) clearInterval(this.minuteur);
    for (const f of this.defaire) f();
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    if (this.urlObjet !== null) URL.revokeObjectURL(this.urlObjet);
  }

  /** L'état du moment, pour le panneau de diagnostic. */
  etat(): Record<string, string> {
    const v = this.video;
    const q = v.getVideoPlaybackQuality?.();
    const tampons = this.tampon ? plagesDe(this.tampon.buffered) : plagesDe(v.buffered);
    return {
      nom: this.reglage.nom,
      mode: this.mode + (this.codec ? ` · ${this.codec}` : ''),
      lecture: `${v.paused ? 'pause' : 'lecture'}${this.souhaitee ? ' (voulue)' : ''}${this.refus ? ' · REFUSÉE' : ''}`,
      temps: v.currentTime.toFixed(2) + ' s',
      reserve: tampons.map(([a, b]) => `${a.toFixed(1)}→${b.toFixed(1)}`).join(' ') || '—',
      images: q ? `${q.totalVideoFrames} (perdues ${q.droppedVideoFrames})` : '—',
      journal: this.journal.slice(-8).join('\n'),
    };
  }

  // — Démarrage —

  private demarrer(): void {
    const g = globalThis as {
      ManagedMediaSource?: ConstructeurSource;
      MediaSource?: ConstructeurSource;
    };
    const essais: [Mode, ConstructeurSource | undefined][] = [
      ['mms', g.ManagedMediaSource],
      ['mse', g.MediaSource],
    ];
    for (const [mode, Source] of essais) {
      if (Source === undefined || typeof fetch !== 'function') continue;
      const piste = this.reglage.pistes.find((p) => Source.isTypeSupported(this.type(p.codec)));
      if (piste !== undefined) {
        this.demarrerTapis(mode, Source, piste);
        return;
      }
    }
    this.demarrerSecours('pas de MSE pour ces formats');
  }

  private type(codec: string): string {
    return `video/mp4; codecs="${codec}"`;
  }

  private demarrerTapis(mode: Mode, Source: ConstructeurSource, piste: Piste): void {
    this.mode = mode;
    this.codec = piste.codec;
    this.noter(`${mode} · ${piste.url.split('/').pop()}`);
    const source = new Source();
    this.source = source;
    this.urlObjet = URL.createObjectURL(source as unknown as MediaSource);
    this.video.src = this.urlObjet;
    const octets = charger(piste.url);
    this.ecouter(source, 'sourceopen', () => {
      octets.then(
        (o) => this.ouvrir(source, piste, o),
        (e: unknown) => this.echec(`chargement : ${String(e)}`),
      );
    });
    this.ecouter(source, 'startstreaming', () => {
      this.noter('l’appareil redemande des images');
      this.entretenir();
    });
    this.ecouter(source, 'endstreaming', () => this.noter('l’appareil suspend l’alimentation'));
  }

  private ouvrir(source: SourceMedia, piste: Piste, octets: Uint8Array): void {
    if (this.detruit || source.readyState !== 'open') return;
    try {
      this.piste = lirePiste(octets, this.reglage.intro);
      if (this.piste.codec !== piste.codec) this.noter(`codec réel ${this.piste.codec}`);
      const tampon = source.addSourceBuffer(this.type(this.piste.codec));
      this.tampon = tampon;
      // Une vidéo sans fin : le tapis se prolonge tant qu'on reste.
      source.duration = Infinity;
      this.ecouter(tampon, 'updateend', () => this.entretenir());
      this.ecouter(tampon, 'error', () => this.echec('le décodeur a refusé un morceau'));
      tampon.appendBuffer(this.piste.entete as BufferSource);
    } catch (e) {
      this.echec(`ouverture : ${String(e)}`);
    }
  }

  /**
   * Garde la réserve à jour : retire ce qui ne sert plus, pose ce qui va
   * servir. Un seul geste à la fois — le tampon n'en prend pas deux.
   */
  private entretenir(): void {
    const t = this.tampon;
    const p = this.piste;
    if (t === null || p === null || t.updating || this.detruit) return;
    const temps = this.video.currentTime;
    const plages = plagesDe(t.buffered);
    const r = this.reglage;
    try {
      const retrait = aRetirer(temps, DERRIERE, HORIZON + r.duree, plages)[0];
      if (retrait !== undefined) {
        t.remove(retrait[0], retrait[1]);
        return;
      }
      // L'iPhone peut demander d'arrêter d'alimenter : on n'ajoute plus rien.
      if (this.source?.streaming === false) return;
      const m = prochainMorceau(temps, HORIZON, r.intro, r.duree, plages);
      if (m === null) return;
      t.timestampOffset = m.decalage;
      t.appendBuffer((m.quoi === 'intro' ? p.intro : p.boucle) as BufferSource);
      this.noter(`pose ${m.quoi} ${m.debut}→${m.fin} s`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        // Réserve pleine : on libère tout ce qui est derrière, et on réessaiera.
        this.noter('réserve pleine : on libère');
        if (temps > 1) t.remove(0, temps - 1);
        return;
      }
      this.echec(`entretien : ${String(e)}`);
    }
  }

  // — Le secours : la balise vidéo simple —

  private demarrerSecours(raison: string): void {
    const piste = this.reglage.pistes.find((p) => this.video.canPlayType?.(this.type(p.codec)) !== '');
    this.mode = 'secours';
    this.codec = piste?.codec ?? '';
    this.noter(`secours (${raison})`);
    if (piste === undefined) {
      this.noter('aucun format lisible : l’affiche reste');
      return;
    }
    // Sans apparition, la boucle native suffit. Avec, on saute au début de la
    // boucle à la fin du fichier (`finSecours`).
    this.video.loop = this.reglage.intro === 0;
    this.video.src = piste.url;
    this.relancer('secours');
  }

  private finSecours(): void {
    if (this.mode !== 'secours' || this.reglage.intro === 0) return;
    this.video.currentTime = this.reglage.intro;
    this.relancer('tour suivant');
  }

  private echec(raison: string): void {
    this.noter(`ÉCHEC ${raison}`);
    if (this.mode === 'secours' || this.detruit) return;
    // On repart proprement sur la balise simple.
    this.tampon = null;
    this.piste = null;
    this.source = null;
    if (this.urlObjet !== null) URL.revokeObjectURL(this.urlObjet);
    this.urlObjet = null;
    const temps = this.video.currentTime;
    this.demarrerSecours(raison);
    if (temps > 0 && this.reglage.intro > 0 && temps >= this.reglage.intro) {
      this.video.currentTime = this.reglage.intro;
    }
  }

  // — Le lancement —

  private relancer(pourquoi: string): void {
    if (this.detruit || !this.souhaitee || this.refus) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const v = this.video;
    if (!v.paused) return;
    v.muted = true;
    // `play()` rend une promesse dans un navigateur, mais RIEN sous jsdom.
    const lecture: unknown = v.play();
    if (!(lecture instanceof Promise)) return;
    lecture.then(
      () => this.noter(`lecture (${pourquoi})`),
      (e: unknown) => {
        const nom = e instanceof DOMException ? e.name : String(e);
        if (nom === 'NotAllowedError') {
          this.refus = true;
          this.noter('lecture REFUSÉE par l’appareil : on attend un geste');
        } else if (nom !== 'AbortError') {
          this.noter(`lecture impossible : ${nom}`);
        }
      },
    );
  }

  // — Outils —

  private ecouter(
    cible: EventTarget,
    type: string,
    f: () => void,
    options?: AddEventListenerOptions,
  ): void {
    cible.addEventListener(type, f, options);
    this.defaire.push(() => cible.removeEventListener(type, f, options));
  }

  private noter(quoi: string): void {
    const t = ((typeof performance !== 'undefined' ? performance.now() : 0) - this.debut) / 1000;
    this.journal.push(`${t.toFixed(1)} s  ${quoi}`);
    if (this.journal.length > 40) this.journal.shift();
  }
}
