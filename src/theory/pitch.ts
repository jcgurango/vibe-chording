/** Pitch utilities. MIDI numbers throughout; C4 = 60. */

export type PitchClass = number // 0..11, C = 0

export const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export const pc = (midi: number): PitchClass => ((midi % 12) + 12) % 12

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export const noteName = (midi: number, flats = true): string =>
  (flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc(midi)]
