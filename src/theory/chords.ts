// chords.ts — chord qualities, naming, and the notes a chord contributes to a voicing.

import { I, type Interval, type SpelledNote, noteName, pcOf, mod, transpose } from './pitch';

export type Quality =
  | 'maj7' | 'm7' | '7' | 'ø7' | 'dim7'
  | 'maj' | 'min' | '7sus4' | 'aug' | '6' | 'mMaj7';

export type Chord = {
  root: SpelledNote;
  quality: Quality;
  bass?: SpelledNote;      // slash bass, when it differs from the root
  flat9?: boolean;         // dominant with ♭9 (aimed at a minor landing)
};

type QualityDef = {
  symbol: string;
  tones: number[];         // semitones above the root, full chord
  shape: number[];         // what the upper layer plays once the bass has the root
  family: 'major' | 'minor' | 'dominant' | 'diminished' | 'other';
};

// Upper shapes follow the voicing chapter: the 3rd and 7th are always present, the root is
// left to the bass and the 9th takes its place, and on dominants the 13th replaces the 5th.
export const QUALITIES: Record<Quality, QualityDef> = {
  maj7:  { symbol: 'maj7',  tones: [0, 4, 7, 11],  shape: [4, 7, 11, 2],  family: 'major' },
  m7:    { symbol: 'm7',    tones: [0, 3, 7, 10],  shape: [3, 7, 10, 2],  family: 'minor' },
  '7':   { symbol: '7',     tones: [0, 4, 7, 10],  shape: [4, 10, 2, 9],  family: 'dominant' },
  'ø7':  { symbol: 'ø7',    tones: [0, 3, 6, 10],  shape: [0, 3, 6, 10],  family: 'minor' },
  dim7:  { symbol: 'dim7',  tones: [0, 3, 6, 9],   shape: [0, 3, 6, 9],   family: 'diminished' },
  maj:   { symbol: '',      tones: [0, 4, 7],      shape: [0, 4, 7],      family: 'major' },
  min:   { symbol: 'm',     tones: [0, 3, 7],      shape: [0, 3, 7],      family: 'minor' },
  '7sus4': { symbol: '7sus4', tones: [0, 5, 7, 10], shape: [5, 10, 2, 7], family: 'dominant' },
  aug:   { symbol: 'aug',   tones: [0, 4, 8],      shape: [0, 4, 8],      family: 'other' },
  '6':   { symbol: '6',     tones: [0, 4, 7, 9],   shape: [0, 4, 9],      family: 'major' },
  mMaj7: { symbol: 'mMaj7', tones: [0, 3, 7, 11],  shape: [3, 7, 11, 2],  family: 'minor' },
};

export const chord = (root: SpelledNote, quality: Quality, extra: Partial<Chord> = {}): Chord =>
  ({ root, quality, ...extra });

export function chordName(c: Chord): string {
  let name = noteName(c.root) + QUALITIES[c.quality].symbol;
  if (c.flat9 && c.quality === '7') name += '♭9';
  if (c.bass && pcOf(c.bass) !== pcOf(c.root)) name += '/' + noteName(c.bass);
  return name;
}

export const family = (c: Chord) => QUALITIES[c.quality].family;
export const isMajorish = (c: Chord) => family(c) === 'major' || family(c) === 'dominant';
export const isMinorish = (c: Chord) => family(c) === 'minor';

export const rootPc = (c: Chord) => pcOf(c.root);
export const bassPc = (c: Chord) => pcOf(c.bass ?? c.root);

// Full pitch-class set of the chord, including the ♭9 when marked.
export function chordPcs(c: Chord): number[] {
  const r = rootPc(c);
  const pcs = QUALITIES[c.quality].tones.map(t => mod(r + t, 12));
  if (c.flat9) pcs.push(mod(r + 1, 12));
  if (c.bass) pcs.push(bassPc(c));
  return [...new Set(pcs)];
}

// What the upper layer plays, as pitch classes.
export function shapePcs(c: Chord): number[] {
  const r = rootPc(c);
  let shape = QUALITIES[c.quality].shape;
  if (c.flat9 && c.quality === '7') shape = [4, 7, 10, 1]; // 3, 5, 7, ♭9: the diminished-with-root sound
  return shape.map(t => mod(r + t, 12));
}

export const sameChord = (a: Chord, b: Chord) =>
  rootPc(a) === rootPc(b) && a.quality === b.quality && bassPc(a) === bassPc(b) && !!a.flat9 === !!b.flat9;

export const chordKey = (c: Chord) => `${rootPc(c)}:${c.quality}:${bassPc(c)}:${c.flat9 ? 'b9' : ''}`;

export function transposeChord(c: Chord, iv: Interval, preferFlats: boolean): Chord {
  return {
    ...c,
    root: transpose(c.root, iv, preferFlats),
    bass: c.bass ? transpose(c.bass, iv, preferFlats) : undefined,
  };
}

export { I };
