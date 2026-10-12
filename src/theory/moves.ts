// moves.ts — the move recipes. Give a recipe a landing (and sometimes a jumpoff) and it
// produces the chords that lead there. Every candidate in a gap is a Path: zero or more
// passing chords, then the landing.

import { I, invert, transpose, mod, noteName, pcOf, type SpelledNote } from './pitch';
import {
  type Chord, type Quality, chord, chordKey, chordName, isMajorish, isMinorish, rootPc, QUALITIES,
} from './chords';
import { type Home, type Skeletal, prefersFlats, scalePcs, scaleChords, pairingStrength } from './palette';

export type PathKind =
  | 'bare' | 'dominant' | 'ii–V' | 'tritone sub' | 'slide' | 'diminished' | 'backdoor' | 'plagal'
  | 'diatonic walk' | 'chromatic passing' | 'pre-echo'
  | 'quality flip' | 'bass walk' | 'flip + bass walk' | 'line cliché' | 'sus delay' | 'side-slip';

export type Path = {
  id: string;
  kind: PathKind;
  chords: Chord[];          // passing chords in order (empty for a bare connector)
  landing: Chord;
  strength?: number;        // recipe strength; undefined means "unlisted, let smoothness decide"
  deceptive?: Chord;        // the landing the move promised, when it lands on a near-twin
  variation?: boolean;      // decorates the jumpoff rather than adding a new chord
  note: string;
};

// Recipe strengths from the catalogue.
export const STRENGTH = {
  dominant: 1, 'ii–V': 1, 'tritone sub': .8, diminished: .8, 'diatonic walk': .7, 'chromatic passing': .7,
  backdoorMajor: .7, backdoorMinor: .4, plagal: .6, slide: .6, 'pre-echo': .5,
  flipDominant: .9, flipMinor: .6, bassWalk: .6, flipWalk: .8, cliche: .5, clicheIntoIV: .7, sus: .6, sideSlip: .5,
  deceptiveDiscount: .6,
};

const dominantOf = (L: Chord, flats: boolean): Chord =>
  chord(transpose(L.root, I.P5, flats), '7', { flat9: isMinorish(L) });

const relatedTwoOf = (L: Chord, flats: boolean): Chord =>
  chord(transpose(L.root, I.M2, flats), isMinorish(L) ? 'ø7' : 'm7');

// The near-twins of L: chords that share most of its notes. A dominant that promises one of
// them can land on L instead (a deceptive landing), and one of them can sound just before L (a pre-echo).
export function nearTwins(L: Chord, flats: boolean): Chord[] {
  if (isMajorish(L)) return [chord(transpose(L.root, invert(I.m3), flats), 'm7'), chord(transpose(L.root, I.M3, flats), 'm7')];
  if (isMinorish(L)) return [chord(transpose(L.root, I.m3, flats), 'maj7'), chord(transpose(L.root, invert(I.M3), flats), 'maj7')];
  return [];
}

// Spelled chord tones, so a bass walk through E7's G♯ is written G♯ and not A♭.
const TONE_STEPS: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
function spelledTones(c: Chord, flats: boolean): SpelledNote[] {
  return QUALITIES[c.quality].tones.map(t => transpose(c.root, { steps: TONE_STEPS[t], semis: t }, flats));
}

function scaleNotes(home: Home): SpelledNote[] {
  return scaleChords(home).map(c => c.root);
}

type Ctx = { home: Home; pal: Skeletal[]; flats: boolean };

const dominantType = (kind: PathKind) => kind === 'dominant' || kind === 'ii–V' || kind === 'tritone sub' || kind === 'diminished';

// Moves framed by the landing alone.
function landingMoves(L: Chord, flats: boolean, withDeceptive = true): Path[] {
  const out: Path[] = [];
  const add = (kind: PathKind, chords: Chord[], strength: number, note: string) =>
    out.push({ id: '', kind, chords, landing: L, strength, note });

  const dom = dominantOf(L, flats);
  add('dominant', [dom], STRENGTH.dominant, `V7 of ${chordName(L)}`);
  add('ii–V', [relatedTwoOf(L, flats), dom], STRENGTH['ii–V'], `related ii, then V7 of ${chordName(L)}`);
  add('tritone sub', [chord(transpose(L.root, I.m2, flats), '7')], STRENGTH['tritone sub'], 'a dominant 7th a half step above');
  if (L.quality !== 'dim7') {
    add('diminished', [chord(transpose(L.root, invert(I.m2), flats), 'dim7')], STRENGTH.diminished,
      `a diminished 7th a half step below: the V7♭9 of ${chordName(L)} without its root`);
  }
  const backStrength = isMinorish(L) ? STRENGTH.backdoorMinor : L.quality === 'maj7' || L.quality === 'maj' ? STRENGTH.backdoorMajor : .5;
  add('backdoor', [chord(transpose(L.root, invert(I.M2), flats), '7')], backStrength, 'a dominant 7th a whole step below');

  const slideQualities: Quality[] = [...new Set<Quality>([L.quality, 'maj7'])];
  for (const q of slideQualities) {
    add('slide', [chord(transpose(L.root, I.m2, flats), q)], STRENGTH.slide, 'a half step above, sliding down');
    add('slide', [chord(transpose(L.root, invert(I.A1), flats), q)], STRENGTH.slide, 'a half step below, sliding up');
  }

  add('plagal', [chord(transpose(L.root, I.P4, flats), 'maj7')], STRENGTH.plagal, `the IV of ${chordName(L)}`);
  if (isMajorish(L)) add('plagal', [chord(transpose(L.root, I.P4, flats), 'm7')], STRENGTH.plagal, `the iv of ${chordName(L)}: minor plagal`);

  // Pre-echo: the landing's near-twin just before it.
  if (isMajorish(L)) {
    add('pre-echo', [chord(transpose(L.root, invert(I.m3), flats), 'm7', { bass: L.root })], STRENGTH['pre-echo'], 'the relative minor over the landing bass');
    add('pre-echo', [chord(transpose(L.root, I.M3, flats), 'm7')], STRENGTH['pre-echo'], 'the iii of the landing');
  } else if (isMinorish(L)) {
    add('pre-echo', [chord(transpose(L.root, I.m3, flats), 'maj7')], STRENGTH['pre-echo'], 'the relative major');
    add('pre-echo', [chord(transpose(L.root, invert(I.M3), flats), 'maj7')], STRENGTH['pre-echo'], 'the ♭VI of the landing, which contains it');
  }

  // Deceptive landings: dominant-type moves that promise a near-twin and land here instead.
  if (!withDeceptive) return out;
  for (const P of nearTwins(L, flats)) {
    const promised = landingMoves(P, flats, false).filter(p => dominantType(p.kind));
    for (const p of promised) {
      out.push({ ...p, landing: L, strength: (p.strength ?? 0) * STRENGTH.deceptiveDiscount, deceptive: P,
        note: `${p.note}, promising ${chordName(P)} and landing on its near-twin` });
    }
  }
  return out;
}

// Moves framed by both neighbors.
function bothMoves(J: Chord, L: Chord, { home, flats }: Ctx): Path[] {
  const out: Path[] = [];
  const scale = scalePcs(home);
  const dJ = scale.indexOf(rootPc(J)), dL = scale.indexOf(rootPc(L));
  if (dJ >= 0 && dL >= 0 && dJ !== dL) {
    const up = mod(dL - dJ, 7), down = mod(dJ - dL, 7);
    const dir = up <= down ? 1 : -1;
    const n = Math.min(up, down) - 1;
    if (n >= 1 && n <= 3) {
      const chords = scaleChords(home);
      const passing = Array.from({ length: n }, (_, k) => chords[mod(dJ + dir * (k + 1), 7)]);
      out.push({ id: '', kind: 'diatonic walk', chords: passing, landing: L, strength: STRENGTH['diatonic walk'],
        note: `the scale chords stepping ${dir > 0 ? 'up' : 'down'} from ${chordName(J)}` });
    }
  }
  const diff = mod(rootPc(L) - rootPc(J), 12);
  if (diff === 2) {
    out.push({ id: '', kind: 'chromatic passing', chords: [chord(transpose(J.root, I.A1, flats), 'dim7')], landing: L,
      strength: STRENGTH['chromatic passing'], note: 'the diminished chord between two roots a whole step apart' });
  } else if (diff === 10) {
    out.push({ id: '', kind: 'chromatic passing', chords: [chord(transpose(J.root, invert(I.A1), flats), 'dim7')], landing: L,
      strength: STRENGTH['chromatic passing'], note: 'the diminished chord between two roots a whole step apart' });
  }
  return out;
}

// Variations: the jumpoff changes before it leaves.
function variations(J: Chord, L: Chord, { home, flats }: Ctx): Path[] {
  const out: Path[] = [];
  const diff = mod(rootPc(L) - rootPc(J), 12);
  const sameChord = diff === 0 && J.quality === L.quality;

  if (sameChord) {
    for (const q of new Set<Quality>([J.quality, 'maj7'])) {
      out.push({ id: '', kind: 'side-slip', chords: [chord(transpose(J.root, I.m2, flats), q)], landing: L, strength: STRENGTH.sideSlip,
        variation: true, note: 'a half step up and straight back' });
      out.push({ id: '', kind: 'side-slip', chords: [chord(transpose(J.root, invert(I.A1), flats), q)], landing: L, strength: STRENGTH.sideSlip,
        variation: true, note: 'a half step down and straight back' });
    }
    if (J.quality === '7') {
      out.push({ id: '', kind: 'sus delay', chords: [chord(J.root, '7sus4')], landing: L, strength: STRENGTH.sus, variation: true,
        note: 'the sus4 sounds first and resolves inside the slot' });
    }
    return out;
  }

  let flipped: Chord | undefined;
  if (diff === 5 && J.quality !== '7') {
    flipped = chord(J.root, '7', { flat9: isMinorish(L) });
    out.push({ id: '', kind: 'quality flip', chords: [flipped], landing: L, strength: STRENGTH.flipDominant, variation: true,
      note: `${chordName(J)} turns dominant: it becomes the V7 of ${chordName(L)}` });
  } else if (diff === 7 && (J.quality === 'maj7' || J.quality === 'maj')) {
    flipped = chord(J.root, J.quality === 'maj' ? 'min' : 'm7');
    out.push({ id: '', kind: 'quality flip', chords: [flipped], landing: L, strength: STRENGTH.flipMinor, variation: true,
      note: `${chordName(J)} turns minor: a minor plagal move into ${chordName(L)}` });
  }

  // Bass walk: the harmony holds while the bass steps up toward the landing, through scale
  // notes and the chord's own tones. The flipped chord has its own tones, so it gets its own walk.
  if (diff >= 2 && diff <= 5) {
    const scale = scalePcs(home);
    const scaleSpelled = scaleNotes(home);
    const walkSteps = (c: Chord): SpelledNote[] => {
      const toneSpelled = spelledTones(c, flats);
      const tones = toneSpelled.map(pcOf); // the plain chord tones, without any ♭9
      const steps: SpelledNote[] = [];
      for (let s = 1; s < diff; s++) {
        const pc = mod(rootPc(c) + s, 12);
        const inScale = scale.indexOf(pc);
        if (tones.includes(pc)) steps.push(toneSpelled[tones.indexOf(pc)]);
        else if (inScale >= 0) steps.push(scaleSpelled[inScale]);
      }
      return steps;
    };
    const steps = walkSteps(J);
    if (steps.length >= 1 && steps.length <= 2) {
      out.push({ id: '', kind: 'bass walk', chords: steps.map(b => ({ ...J, bass: b })), landing: L, strength: STRENGTH.bassWalk,
        variation: true, note: `${chordName(J)} holds while the bass steps through ${steps.map(noteName).join(', ')}` });
    }
    if (flipped) {
      const fsteps = walkSteps(flipped);
      if (fsteps.length >= 1 && fsteps.length <= 2) {
        out.push({ id: '', kind: 'flip + bass walk', chords: [flipped, ...fsteps.map(b => ({ ...flipped!, bass: b }))], landing: L,
          strength: STRENGTH.flipWalk, variation: true, note: 'the quality flip and the bass walk stacked in one gap' });
      }
    }
  }

  // Line cliché: one inner voice climbs by half step while the chord holds.
  if (J.quality === 'maj7' || J.quality === 'maj') {
    out.push({ id: '', kind: 'line cliché', chords: [chord(J.root, 'aug'), chord(J.root, '6'), chord(J.root, '7')], landing: L,
      strength: diff === 5 ? STRENGTH.clicheIntoIV : STRENGTH.cliche, variation: true,
      note: 'the fifth climbs: 5, ♯5, 6, ♭7' });
  }
  return out;
}

// Every candidate path from a jumpoff into a landing. With no jumpoff, only the landing-framed moves apply.
export function pathsInto(J: Chord | null, L: Chord, home: Home, pal: Skeletal[]): Path[] {
  const ctx: Ctx = { home, pal, flats: prefersFlats(home) };
  const all: Path[] = [];

  const bareStrength = J ? pairingStrength(J, L, home, pal) : undefined;
  all.push({ id: '', kind: 'bare', chords: [], landing: L, strength: bareStrength, note: bareStrength !== undefined ? 'a listed common motion' : 'not a listed pairing; ranked by how it sounds' });

  // Into the same chord, a slide is a side-slip, so the variation keeps its name.
  const repeat = J !== null && rootPc(J) === rootPc(L) && J.quality === L.quality;
  all.push(...landingMoves(L, ctx.flats).filter(p => !(repeat && p.kind === 'slide')));
  if (J) {
    all.push(...bothMoves(J, L, ctx));
    all.push(...variations(J, L, ctx));
  }

  // Drop moves that just restate the jumpoff, and duplicates that another recipe already produced.
  const seen = new Map<string, Path>();
  for (const p of all) {
    if (J && p.chords.length === 1 && chordKey(p.chords[0]) === chordKey(J)) continue;
    const key = p.chords.map(chordKey).join('|');
    const prior = seen.get(key);
    if (!prior) { seen.set(key, { ...p, id: `${chordKey(L)}<${key}` }); continue; }
    // Two recipes produced the same chords: keep the stronger name (a later variation wins a tie) and mention the other.
    const [winner, loser] = (p.strength ?? 0) >= (prior.strength ?? 0) ? [p, prior] : [prior, p];
    seen.set(key, { ...winner, id: prior.id, note: `${winner.note} (also a ${loser.kind})` });
  }
  return [...seen.values()];
}

export const pathChords = (p: Path) => [...p.chords, p.landing];
