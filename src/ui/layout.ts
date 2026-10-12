import type { PaletteChord } from '../theory/palette'

/**
 * Where each chord sits in the sky, in unit-disk coordinates:
 * home at the centre, diatonic chords on an inner ring, the two borrowed
 * groups further out. Angle follows the root's pitch class like a clock,
 * so a borrowed chord sits roughly outside the diatonic chord on its root.
 */

export interface StarPlacement {
  id: string
  x: number // -1..1
  y: number // -1..1
  phase: [number, number]
  speed: [number, number]
  amp: number
}

/** Small deterministic PRNG so the sky looks the same every visit. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RING: Record<PaletteChord['group'], number> = {
  diatonic: 0.42,
  minor: 0.7,
  modes: 0.95,
}

export function layoutSky(chords: PaletteChord[], seed = 7): StarPlacement[] {
  const rand = mulberry32(seed)
  return chords.map((c) => {
    const isHome = c.group === 'diatonic' && c.degree === 0
    const jitterA = (rand() - 0.5) * 0.3
    const jitterR = (rand() - 0.5) * 0.1
    const angle = (c.degree / 12) * Math.PI * 2 - Math.PI / 2 + jitterA
    const r = isHome ? 0 : RING[c.group] + jitterR
    return {
      id: c.id,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      phase: [rand() * Math.PI * 2, rand() * Math.PI * 2],
      speed: [0.12 + rand() * 0.1, 0.09 + rand() * 0.1],
      amp: isHome ? 0.006 : 0.014 + rand() * 0.01,
    }
  })
}

/** Current drifted position in unit-disk coordinates. */
export function driftedPosition(p: StarPlacement, t: number): [number, number] {
  return [
    p.x + Math.sin(t * p.speed[0] + p.phase[0]) * p.amp,
    p.y + Math.cos(t * p.speed[1] + p.phase[1]) * p.amp,
  ]
}
