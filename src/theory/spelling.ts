/**
 * Letter-based note spelling, so that moves name their chords the way a
 * musician would: the dominant of Bø7 is F♯7, the diminished chord below Am7
 * is G♯dim7, and the backdoor into Cmaj7 is B♭7.
 */

export interface Spelling {
  letter: number // 0 = C … 6 = B
  acc: number // -2 … 2
}

const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export const spellingPc = (s: Spelling): number => (((LETTER_PC[s.letter] + s.acc) % 12) + 12) % 12

/** Move a spelling by a number of letter steps and semitones, e.g. a perfect fifth down is (-4, -7). */
export function transposeSpelling(s: Spelling, letterSteps: number, semitones: number): Spelling {
  const letter = (((s.letter + letterSteps) % 7) + 7) % 7
  const targetPc = (((spellingPc(s) + semitones) % 12) + 12) % 12
  let acc = targetPc - LETTER_PC[letter]
  acc = ((((acc + 6) % 12) + 12) % 12) - 6
  return { letter, acc }
}

/** The printed name. Awkward spellings (E♯, C♭, double accidentals) fall back to plain names. */
export function spellingName(s: Spelling): string {
  const awkward = Math.abs(s.acc) > 1 || (s.acc === 1 && (s.letter === 2 || s.letter === 6)) || (s.acc === -1 && (s.letter === 0 || s.letter === 3))
  if (awkward) return (s.acc < 0 ? FLAT_NAMES : SHARP_NAMES)[spellingPc(s)]
  return LETTERS[s.letter] + (s.acc === 1 ? '♯' : s.acc === -1 ? '♭' : '')
}

/** A plain spelling for a pitch class, preferring flats. */
export const spellPc = (pc: number, flats = true): Spelling => {
  const name = (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
  const letter = LETTERS.indexOf(name[0])
  const acc = name.includes('♯') ? 1 : name.includes('♭') ? -1 : 0
  return { letter, acc }
}
