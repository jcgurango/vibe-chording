import { chordName, type Chord, type Quality } from './chords'
import { spellingPc, transposeSpelling, type Spelling } from './spelling'

/**
 * The skeletal palette for a major home, after "Skeleton and Moves":
 * seven diatonic chords, six borrowed from the parallel minor, and five
 * borrowed from other parallel modes. Roots are degrees above home.
 */

export type Group = 'diatonic' | 'minor' | 'modes'

export interface PaletteEntry {
  numeral: string
  degree: number // semitones above home
  quality: Quality
  group: Group
  source?: string
  fit: string
}

export const MAJOR_PALETTE: PaletteEntry[] = [
  // Diatonic
  { numeral: 'Imaj7', degree: 0, quality: 'maj7', group: 'diatonic', fit: 'Home. It can go anywhere, and it is reached from V7, IV, iv, ♭VI, or ♭VII.' },
  { numeral: 'ii7', degree: 2, quality: 'm7', group: 'diatonic', fit: 'Soft subdominant and a common starting chord. Leads to V7 or steps up to iii. Near-twin of IV.' },
  { numeral: 'iii7', degree: 4, quality: 'm7', group: 'diatonic', fit: 'A lighter stand-in for I. Falls to vi, or steps to IV or ii.' },
  { numeral: 'IVmaj7', degree: 5, quality: 'maj7', group: 'diatonic', fit: 'Subdominant and a common starting chord. Goes to V7, back to I, or turns minor (iv).' },
  { numeral: 'V7', degree: 7, quality: '7', group: 'diatonic', fit: 'Dominant of home. Resolves to I, or deceptively to vi.' },
  { numeral: 'vi7', degree: 9, quality: 'm7', group: 'diatonic', fit: 'The relative minor and a second possible home. Near-twin of I. A common starting chord.' },
  { numeral: 'viiø7', degree: 11, quality: 'ø7', group: 'diatonic', fit: 'Rarely a resting chord. It works as the ii of vi: Bø7, E7, Am7.' },
  // Borrowed from the parallel minor
  { numeral: 'i7', degree: 0, quality: 'm7', group: 'minor', fit: 'Home turned minor for a moment. Opens the way to the other borrowed chords.' },
  { numeral: 'iiø7', degree: 2, quality: 'ø7', group: 'minor', fit: 'The minor-key ii. Pairs with iv and leads to V7.' },
  { numeral: '♭IIImaj7', degree: 3, quality: 'maj7', group: 'minor', fit: 'Goes to IV, ♭VI, or iv. The first chord of ♭III, IV, I.' },
  { numeral: 'iv7', degree: 5, quality: 'm7', group: 'minor', fit: 'Minor plagal. Usually follows IV and resolves to I, with A♭ falling to G.' },
  { numeral: '♭VImaj7', degree: 8, quality: 'maj7', group: 'minor', fit: 'Near-twin of iv, and it shares C and G with home. The first chord of ♭VI, ♭VII, I.' },
  { numeral: '♭VII7', degree: 10, quality: '7', group: 'minor', fit: 'The backdoor dominant. Resolves up a whole step to I.' },
  // Borrowed from other parallel modes
  { numeral: 'v7', degree: 7, quality: 'm7', group: 'modes', source: 'Mixolydian', fit: 'The ii of IV. Pairs with I7 to point at IV.' },
  { numeral: '♭VIImaj7', degree: 10, quality: 'maj7', group: 'modes', source: 'Dorian, Mixolydian', fit: 'The IV of IV. A softer ♭VII with no dominant pull.' },
  { numeral: '♭IImaj7', degree: 1, quality: 'maj7', group: 'modes', source: 'Phrygian', fit: 'Sits a half step above home. Slides down to I or slips around ii.' },
  { numeral: '♯ivø7', degree: 6, quality: 'ø7', group: 'modes', source: 'Lydian', fit: 'Descends by half step to IV, or works as the ii of iii.' },
  { numeral: 'IV7', degree: 5, quality: '7', group: 'modes', source: 'Dorian, blues', fit: 'The blues IV. Returns to I or drops a half step to V7 of vi.' },
]

const ROMAN_DEGREES: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 }

/** The scale degree (0..6) and accidental a numeral names, e.g. ♭VImaj7 → degree 5, acc -1. */
export function parseNumeral(numeral: string): { step: number; acc: number } {
  const m = /^([♭♯]?)([ivIV]+)/.exec(numeral)
  if (!m) throw new Error(`Bad numeral: ${numeral}`)
  const acc = m[1] === '♭' ? -1 : m[1] === '♯' ? 1 : 0
  return { step: ROMAN_DEGREES[m[2].toLowerCase()], acc }
}

export interface PaletteChord extends PaletteEntry {
  id: string
  chord: Chord
  name: string
}

export const C_MAJOR: Spelling = { letter: 0, acc: 0 }

/** Realise the palette against a spelled home. */
export function paletteFor(home: Spelling): PaletteChord[] {
  return MAJOR_PALETTE.map((e) => {
    const { step } = parseNumeral(e.numeral)
    const spelling = transposeSpelling(home, step, e.degree)
    const chord: Chord = { root: spellingPc(spelling), quality: e.quality, spelling }
    return { ...e, id: e.numeral, chord, name: chordName(chord) }
  })
}
