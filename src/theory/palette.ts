// palette.ts — the home, its scale, the skeletal chords, and how they lead into each other.
//
// Strengths in the pairing table are the catalogue's "common motion" guesses, meant to be
// tuned by ear. Anything not listed falls back to smoothness in scoring.

import { type SpelledNote, type Interval, pcOf, mod, transpose, parseNote, noteName } from './pitch';
import { type Chord, type Quality, chord, rootPc, chordPcs } from './chords';

export type Mode = 'major' | 'minor';
export type Home = { root: SpelledNote; mode: Mode };

export type Group = 'diatonic' | 'minor' | 'modes';

export type SkeletalDef = {
  id: string;
  numeral: string;          // as the catalogue writes it: Imaj7, ♭VII7, ♯ivø7
  interval: Interval;       // from home
  quality: Quality;
  group: Group;
  blurb: string;
  starting?: boolean;
};

export type Skeletal = SkeletalDef & { chord: Chord };

const iv = (steps: number, semis: number): Interval => ({ steps, semis });

export const MAJOR_PALETTE: SkeletalDef[] = [
  { id: 'I',    numeral: 'Imaj7',   interval: iv(0, 0),  quality: 'maj7', group: 'diatonic', starting: true,
    blurb: 'Home. It can go anywhere, and it is reached from V7, IV, iv, ♭VI, or ♭VII.' },
  { id: 'ii',   numeral: 'ii7',     interval: iv(1, 2),  quality: 'm7',   group: 'diatonic', starting: true,
    blurb: 'Soft subdominant and a common starting chord. Leads to V7 or steps up to iii. Near-twin of IV.' },
  { id: 'iii',  numeral: 'iii7',    interval: iv(2, 4),  quality: 'm7',   group: 'diatonic',
    blurb: 'A lighter stand-in for I. Falls to vi, or steps to IV or ii.' },
  { id: 'IV',   numeral: 'IVmaj7',  interval: iv(3, 5),  quality: 'maj7', group: 'diatonic', starting: true,
    blurb: 'Subdominant and a common starting chord. Goes to V7, back to I, or turns minor (iv).' },
  { id: 'V',    numeral: 'V7',      interval: iv(4, 7),  quality: '7',    group: 'diatonic',
    blurb: 'Dominant of home. Resolves to I, or deceptively to vi.' },
  { id: 'vi',   numeral: 'vi7',     interval: iv(5, 9),  quality: 'm7',   group: 'diatonic', starting: true,
    blurb: 'The relative minor and a second possible home. Near-twin of I.' },
  { id: 'vii',  numeral: 'viiø7',   interval: iv(6, 11), quality: 'ø7',   group: 'diatonic',
    blurb: 'Rarely a resting chord. It works as the ii of vi: Bø7, E7, Am7.' },

  { id: 'i',    numeral: 'i7',      interval: iv(0, 0),  quality: 'm7',   group: 'minor',
    blurb: 'Home turned minor for a moment. Opens the way to the other borrowed chords.' },
  { id: 'iiø',  numeral: 'iiø7',    interval: iv(1, 2),  quality: 'ø7',   group: 'minor',
    blurb: 'The minor-key ii. Pairs with iv and leads to V7.' },
  { id: 'bIII', numeral: '♭IIImaj7', interval: iv(2, 3), quality: 'maj7', group: 'minor',
    blurb: 'Goes to IV, ♭VI, or iv. The first chord of ♭III, IV, I.' },
  { id: 'iv',   numeral: 'iv7',     interval: iv(3, 5),  quality: 'm7',   group: 'minor',
    blurb: 'Minor plagal. Usually follows IV and resolves to I, with ♭6 falling to 5.' },
  { id: 'bVI',  numeral: '♭VImaj7', interval: iv(5, 8),  quality: 'maj7', group: 'minor',
    blurb: 'Near-twin of iv, and it shares the root and fifth of home. The first chord of ♭VI, ♭VII, I.' },
  { id: 'bVII7', numeral: '♭VII7',  interval: iv(6, 10), quality: '7',    group: 'minor',
    blurb: 'The backdoor dominant. Resolves up a whole step to I.' },

  { id: 'v',    numeral: 'v7',      interval: iv(4, 7),  quality: 'm7',   group: 'modes',
    blurb: 'Mixolydian. The ii of IV. Pairs with I7 to point at IV.' },
  { id: 'bVIImaj7', numeral: '♭VIImaj7', interval: iv(6, 10), quality: 'maj7', group: 'modes',
    blurb: 'Dorian, Mixolydian. The IV of IV. A softer ♭VII with no dominant pull.' },
  { id: 'bII',  numeral: '♭IImaj7', interval: iv(1, 1),  quality: 'maj7', group: 'modes',
    blurb: 'Phrygian. Sits a half step above home. Slides down to I or slips around ii.' },
  { id: '#ivø', numeral: '♯ivø7',   interval: iv(3, 6),  quality: 'ø7',   group: 'modes',
    blurb: 'Lydian. Descends by half step to IV, or works as the ii of iii.' },
  { id: 'IV7',  numeral: 'IV7',     interval: iv(3, 5),  quality: '7',    group: 'modes',
    blurb: 'Dorian, blues. The blues IV. Returns to I or drops a half step to V7 of vi.' },
];

// A minor home has its own short list: the relative major's diatonic chords with V7 in place of v.
export const MINOR_PALETTE: SkeletalDef[] = [
  { id: 'i',    numeral: 'i7',      interval: iv(0, 0),  quality: 'm7',   group: 'diatonic', starting: true,
    blurb: 'Home.' },
  { id: 'iiø',  numeral: 'iiø7',    interval: iv(1, 2),  quality: 'ø7',   group: 'diatonic',
    blurb: 'The minor-key ii. Pairs with iv and leads to V7.' },
  { id: 'bIII', numeral: '♭IIImaj7', interval: iv(2, 3), quality: 'maj7', group: 'diatonic', starting: true,
    blurb: 'The relative major. Near-twin of i.' },
  { id: 'iv',   numeral: 'iv7',     interval: iv(3, 5),  quality: 'm7',   group: 'diatonic', starting: true,
    blurb: 'Subdominant. Leads to V7, ♭VII, or back home.' },
  { id: 'V',    numeral: 'V7',      interval: iv(4, 7),  quality: '7',    group: 'diatonic',
    blurb: 'Dominant of home. Resolves to i, or deceptively to ♭VI.' },
  { id: 'bVI',  numeral: '♭VImaj7', interval: iv(5, 8),  quality: 'maj7', group: 'diatonic', starting: true,
    blurb: 'Near-twin of iv. The first chord of ♭VI, ♭VII, i.' },
  { id: 'bVII', numeral: '♭VII7',   interval: iv(6, 10), quality: '7',    group: 'diatonic',
    blurb: 'Dominant of the relative major. Steps up to i or lands on ♭III.' },
];

// Common motions between skeletal chords, from → to → strength. Starting guesses.
type Pairings = Record<string, Record<string, number>>;

export const MAJOR_PAIRINGS: Pairings = {
  I:    { ii: .6, iii: .5, IV: .7, V: .6, vi: .7, vii: .3, i: .4, iiø: .3, bIII: .4, iv: .4, bVI: .4, bVII7: .4,
          v: .4, bVIImaj7: .5, bII: .3, '#ivø': .3, IV7: .4 },
  ii:   { V: .9, iii: .6, I: .4, IV: .4, vi: .3, bII: .4, iiø: .3, '#ivø': .3, bIII: .3 },
  iii:  { vi: .7, IV: .6, ii: .6, I: .4, V: .3, '#ivø': .2 },
  IV:   { V: .8, I: .7, iv: .8, ii: .4, iii: .4, vi: .5, IV7: .5, bVII7: .4, '#ivø': .3, bVIImaj7: .3, bIII: .3 },
  V:    { I: 1, vi: .6, IV: .3, iii: .3 },
  vi:   { IV: .7, ii: .7, iv: .5, v: .5, iii: .4, I: .5, V: .4, bVI: .4, bIII: .3, bVIImaj7: .3, vii: .3 },
  vii:  { vi: .6, I: .4, iii: .3, bIII: .2 },
  i:    { iiø: .6, bIII: .6, iv: .6, bVI: .6, bVII7: .6, IV: .4, I: .3, v: .4, ii: .3, bVIImaj7: .4 },
  iiø:  { V: .9, iv: .5, i: .4, bVI: .3, bII: .3 },
  bIII: { IV: .8, bVI: .7, iv: .6, I: .5, bVIImaj7: .3, ii: .3, i: .3 },
  iv:   { I: .9, V: .5, bVI: .4, bVII7: .4, i: .4, ii: .3, bII: .3 },
  bVI:  { bVII7: .7, bVIImaj7: .7, I: .7, iv: .4, V: .4, bIII: .3, i: .3, IV: .3 },
  bVII7: { I: .9, IV: .3, bVI: .3, vi: .3, bIII: .3 },
  v:    { IV: .7, I: .4, bVIImaj7: .4, bIII: .3, vi: .3, iv: .3, ii: .3, IV7: .5 },
  bVIImaj7: { IV: .7, I: .6, bVI: .5, bIII: .4, vi: .3, v: .3, ii: .3 },
  bII:  { I: .8, ii: .6, V: .3, bIII: .2, iii: .2 },
  '#ivø': { IV: .8, iii: .6, vi: .3, V: .3, I: .3 },
  IV7:  { I: .8, vi: .5, V: .4, iv: .4, bVII7: .3, ii: .3 },
};

export const MINOR_PAIRINGS: Pairings = {
  i:    { iv: .7, iiø: .6, bVI: .7, bIII: .6, bVII: .6, V: .5 },
  iiø:  { V: .9, iv: .4, i: .3, bVI: .3 },
  bIII: { iv: .6, bVI: .7, bVII: .5, i: .5, V: .3 },
  iv:   { V: .8, i: .7, bVII: .6, bVI: .5, bIII: .4, iiø: .4 },
  V:    { i: 1, bVI: .6, iv: .3, bIII: .3 },
  bVI:  { bVII: .7, V: .7, i: .6, iv: .4, bIII: .3, iiø: .3 },
  bVII: { bIII: .8, i: .6, bVI: .3, iv: .3 },
};

export const HOME_ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'].map(parseNote);

// Flat keys and C spell their chromatic neighbors with flats.
export function prefersFlats(home: Home): boolean {
  const r = home.root;
  if (r.acc < 0) return true;
  if (r.acc > 0) return false;
  // Natural roots: F major and anything on the flat side of C prefers flats.
  const sharpNaturals = home.mode === 'major' ? [1, 2, 4, 6] : [2, 4, 6]; // D E G B major; E B ... minor keeps A/D flats
  return !sharpNaturals.includes(r.letter);
}

export const homeName = (h: Home) => `${noteName(h.root)} ${h.mode}`;

export function scalePcs(home: Home): number[] {
  const steps = home.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return steps.map(s => mod(pcOf(home.root) + s, 12));
}

// Diatonic seventh chords by degree, used by the diatonic walk.
export function scaleChords(home: Home): Chord[] {
  const flats = prefersFlats(home);
  const degrees: [Interval, Quality][] = home.mode === 'major'
    ? [[iv(0, 0), 'maj7'], [iv(1, 2), 'm7'], [iv(2, 4), 'm7'], [iv(3, 5), 'maj7'], [iv(4, 7), '7'], [iv(5, 9), 'm7'], [iv(6, 11), 'ø7']]
    : [[iv(0, 0), 'm7'], [iv(1, 2), 'ø7'], [iv(2, 3), 'maj7'], [iv(3, 5), 'm7'], [iv(4, 7), '7'], [iv(5, 8), 'maj7'], [iv(6, 10), '7']];
  return degrees.map(([ivl, q]) => chord(transpose(home.root, ivl, flats), q));
}

export function palette(home: Home): Skeletal[] {
  const defs = home.mode === 'major' ? MAJOR_PALETTE : MINOR_PALETTE;
  const flats = prefersFlats(home);
  return defs.map(d => ({ ...d, chord: chord(transpose(home.root, d.interval, flats), d.quality) }));
}

export const pairings = (home: Home) => (home.mode === 'major' ? MAJOR_PAIRINGS : MINOR_PAIRINGS);

// Which skeletal chord a concrete chord is, if any (slash bass and ♭9 ignored).
export function identify(c: Chord, pal: Skeletal[]): Skeletal | undefined {
  return pal.find(s => rootPc(s.chord) === rootPc(c) && s.quality === c.quality);
}

export function pairingStrength(from: Chord, to: Chord, home: Home, pal: Skeletal[]): number | undefined {
  const a = identify(from, pal), b = identify(to, pal);
  if (!a || !b) return undefined;
  return pairings(home)[a.id]?.[b.id];
}

// Tension levels from the scoring chapter.
//   0 diatonic · 1 borrowed · 2 dominants aimed away from home · 3 diminished and tritone subs
export function tensionLevel(c: Chord, home: Home, pal: Skeletal[]): number {
  if (c.quality === 'dim7') return 3;
  const sk = identify(c, pal);
  if (sk) return sk.group === 'diatonic' ? 0 : 1;
  if (c.quality === '7' || c.quality === '7sus4') return 2;
  if (c.quality === 'aug') return 2;
  const outside = outsideNotes(c, home);
  return outside === 0 ? 0 : 1;
}

export function outsideNotes(c: Chord, home: Home): number {
  const scale = scalePcs(home);
  return chordPcs(c).filter(p => !scale.includes(p)).length;
}

// The chain of fourths around home: G – C – F – B♭ – E♭ – A♭ – D♭ for C.
export function onChainOfFourths(c: Chord, home: Home): boolean {
  const h = pcOf(home.root);
  const chain = [7, 0, 5, 10, 3, 8, 1].map(s => mod(h + s, 12));
  return chain.includes(rootPc(c));
}

// Planing condition 1: the home note stays alive as a chord tone or a color tone (9th or 13th).
export function keepsHomeNote(c: Chord, home: Home): boolean {
  const h = pcOf(home.root);
  if (chordPcs(c).includes(h)) return true;
  const rel = mod(h - rootPc(c), 12);
  return rel === 2 || rel === 9;
}
