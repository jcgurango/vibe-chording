import { spellingName, spellPc, type Spelling } from './spelling'

/** Chord qualities as intervals above the root, in semitones. */
export type Quality = 'maj7' | 'm7' | '7' | 'ø7' | 'dim7' | 'maj' | 'min'

export const QUALITY_INTERVALS: Record<Quality, number[]> = {
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'ø7': [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  maj: [0, 4, 7],
  min: [0, 3, 7],
}

export const QUALITY_SUFFIX: Record<Quality, string> = {
  maj7: 'maj7',
  m7: 'm7',
  '7': '7',
  'ø7': 'ø7',
  dim7: 'dim7',
  maj: '',
  min: 'm',
}

export interface Chord {
  root: number // pitch class
  quality: Quality
  /** How the root is spelled. Optional; plain flat names are used without it. */
  spelling?: Spelling
}

/** Pitch classes of a chord, root first. */
export const chordTones = (c: Chord): number[] =>
  QUALITY_INTERVALS[c.quality].map((i) => (c.root + i) % 12)

/** The 9th (two semitones above the root), used in place of the root in upper shapes. */
export const ninth = (c: Chord): number => (c.root + 2) % 12

/** Identity for de-duplication: same root and quality, spelling ignored. */
export const chordKey = (c: Chord): string => `${c.root}:${c.quality}`

export const chordName = (c: Chord): string =>
  spellingName(c.spelling ?? spellPc(c.root)) + QUALITY_SUFFIX[c.quality]

/** Whether a chord reads as a minor landing for the purposes of a move. */
export const isMinorQuality = (q: Quality): boolean =>
  q === 'm7' || q === 'min' || q === 'ø7' || q === 'dim7'
