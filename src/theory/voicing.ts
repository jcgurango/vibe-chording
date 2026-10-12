import { chordTones, ninth, type Chord } from './chords'

/**
 * Two-layer voicing, as described in "Skeleton and Moves":
 * a bass note on the root in its own low register, and a close-position
 * upper shape sitting in a fixed window around middle C.
 *
 * This first version has no memory of the previous shape; it simply picks
 * the rotation whose centre sits nearest a home point.
 */

export interface Voicing {
  bass: number // MIDI
  upper: number[] // MIDI, ascending
}

const WINDOW_LOW = 55 // G3
const WINDOW_HIGH = 79 // G5
const CENTER = 65 // F4-ish: where shapes like to live
const BASS_LOW = 36 // C2

/** Upper-shape pitch classes: 3rd, 5th, 7th, plus the 9th in place of the root. */
function upperPitchClasses(c: Chord): number[] {
  const tones = chordTones(c)
  if (tones.length < 4) return tones
  const [, third, fifth, seventh] = tones
  return [third, fifth, seventh, ninth(c)]
}

/** Stack a set of pitch classes in close position starting from a given bottom note. */
function stackFrom(bottom: number, pcs: number[]): number[] {
  const out: number[] = []
  let cur = bottom
  for (const p of pcs) {
    while (((cur % 12) + 12) % 12 !== p) cur++
    out.push(cur)
    cur++
  }
  return out
}

export function voice(c: Chord): Voicing {
  const pcs = upperPitchClasses(c)
  const sorted = [...new Set(pcs)].sort((a, b) => a - b)

  let best: number[] | null = null
  let bestCost = Infinity

  for (let r = 0; r < sorted.length; r++) {
    const rotation = [...sorted.slice(r), ...sorted.slice(0, r)]
    for (let bottom = WINDOW_LOW; bottom <= WINDOW_HIGH; bottom++) {
      if (((bottom % 12) + 12) % 12 !== rotation[0]) continue
      const shape = stackFrom(bottom, rotation)
      if (shape[shape.length - 1] > WINDOW_HIGH) continue
      const centre = shape.reduce((a, b) => a + b, 0) / shape.length
      const cost = Math.abs(centre - CENTER)
      if (cost < bestCost) {
        bestCost = cost
        best = shape
      }
    }
  }

  const bass = BASS_LOW + ((c.root - BASS_LOW) % 12 + 12) % 12
  return { bass, upper: best ?? stackFrom(60, sorted) }
}
