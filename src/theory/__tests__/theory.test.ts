import { describe, expect, it } from 'vitest'
import { chordName, chordTones } from '../chords'
import { applyMove, constellationFor } from '../moves'
import { C_MAJOR, paletteFor } from '../palette'
import { pc } from '../pitch'
import { voice } from '../voicing'

describe('palette', () => {
  it('names the 18 chords of a C major home', () => {
    const names = paletteFor(C_MAJOR).map((c) => c.name)
    expect(names).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7',
      'Cm7', 'Dø7', 'E♭maj7', 'Fm7', 'A♭maj7', 'B♭7',
      'Gm7', 'B♭maj7', 'D♭maj7', 'F♯ø7', 'F7',
    ])
  })

  it('transposes to another home with sensible spelling', () => {
    const names = paletteFor({ letter: 6, acc: -1 }).map((c) => c.name)
    expect(names.slice(0, 7)).toEqual(['B♭maj7', 'Cm7', 'Dm7', 'E♭maj7', 'F7', 'Gm7', 'Aø7'])
  })
})

describe('moves', () => {
  const byName = Object.fromEntries(paletteFor(C_MAJOR).map((c) => [c.name, c.chord]))
  const names = (chords: ReturnType<typeof applyMove>) => chords.map(chordName)

  it('produces the catalogue examples into Am7', () => {
    const am = byName['Am7']
    expect(names(applyMove('dominant', am))).toEqual(['E7'])
    expect(names(applyMove('ii-V', am))).toEqual(['Bø7', 'E7'])
    expect(names(applyMove('tritone', am))).toEqual(['B♭7'])
    expect(names(applyMove('slide', am))).toEqual(['B♭maj7'])
    expect(names(applyMove('diminished', am))).toEqual(['G♯dim7'])
  })

  it('produces the catalogue examples into Cmaj7', () => {
    const c = byName['Cmaj7']
    expect(names(applyMove('backdoor', c))).toEqual(['B♭7'])
    expect(names(applyMove('plagal', c))).toEqual(['Fm7'])
    expect(names(applyMove('ii-V', c))).toEqual(['Dm7', 'G7'])
    expect(names(applyMove('diminished', c))).toEqual(['Bdim7'])
  })

  it('spells the dominant of Bø7 as F♯7', () => {
    expect(names(applyMove('dominant', byName['Bø7']))).toEqual(['F♯7'])
  })

  it('reuses palette chords and chains the ii into the V', () => {
    const palette = paletteFor(C_MAJOR)
    const home = palette[0]
    const resolve = (c: { root: number; quality: string }) =>
      palette.find((p) => p.chord.root === c.root && p.chord.quality === c.quality)?.id
    const k = constellationFor(home.chord, home.id, resolve)
    // Dm7, G7, Fm7, B♭7 and D♭maj7 all live in the palette already; the rest materialise.
    expect(k.nodes.map((n) => chordName(n.chord)).sort()).toEqual(['Bdim7', 'D♭7'])
    expect(k.links).toContainEqual({ from: 'ii7', to: 'V7', kind: 'ii-V', label: 'ii–V' })
    expect(k.links).toContainEqual({ from: 'V7', to: 'Imaj7', kind: 'dominant', label: 'dominant' })
    expect(k.links).toContainEqual({ from: '♭VII7', to: 'Imaj7', kind: 'backdoor', label: 'backdoor' })
  })
})

describe('voicing', () => {
  it('puts the root in the bass and 3-5-7-9 in a close shape', () => {
    const v = voice({ root: 0, quality: 'maj7' })
    expect(pc(v.bass)).toBe(0)
    expect(v.bass).toBeGreaterThanOrEqual(36)
    expect(v.bass).toBeLessThan(48)
    expect(v.upper.map(pc).sort((a, b) => a - b)).toEqual([2, 4, 7, 11])
    const span = v.upper[v.upper.length - 1] - v.upper[0]
    expect(span).toBeLessThan(12)
    expect(v.upper[0]).toBeGreaterThanOrEqual(55)
    expect(v.upper[v.upper.length - 1]).toBeLessThanOrEqual(79)
  })

  it('voices every palette chord inside the window', () => {
    for (const c of paletteFor(C_MAJOR)) {
      const v = voice(c.chord)
      expect(v.upper).toHaveLength(4)
      expect(v.upper[0]).toBeGreaterThanOrEqual(55)
      expect(v.upper[3]).toBeLessThanOrEqual(79)
      const tones = new Set([...chordTones(c.chord), (c.chord.root + 2) % 12])
      for (const m of v.upper) expect(tones.has(pc(m))).toBe(true)
    }
  })
})
