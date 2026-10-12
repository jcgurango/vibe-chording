import { chordKey, isMinorQuality, type Chord, type Quality } from './chords'
import { spellingPc, spellPc, transposeSpelling, type Spelling } from './spelling'

/**
 * Moves framed by the landing, after "Skeleton and Moves". Each is a recipe:
 * give it the landing and it produces one or two chords that point at it.
 */

export type MoveKind = 'dominant' | 'ii-V' | 'tritone' | 'slide' | 'diminished' | 'backdoor' | 'plagal'

export interface MoveDef {
  kind: MoveKind
  label: string
  recipe: string
  /** How strongly the move points, per the catalogue. */
  strength: (landing: Chord) => number
}

export const MOVES: Record<MoveKind, MoveDef> = {
  dominant: { kind: 'dominant', label: 'dominant', recipe: 'The V7 of the landing.', strength: () => 1.0 },
  'ii-V': { kind: 'ii-V', label: 'ii–V', recipe: 'The related ii, then the V7. Into a minor landing: iiø, then V7.', strength: () => 1.0 },
  tritone: { kind: 'tritone', label: 'tritone sub', recipe: 'A dominant 7th a half step above.', strength: () => 0.8 },
  slide: { kind: 'slide', label: 'slide', recipe: 'A major 7th a half step above.', strength: () => 0.6 },
  diminished: { kind: 'diminished', label: 'diminished', recipe: "A diminished 7th a half step below. It is the landing's V7♭9 without its root.", strength: () => 0.8 },
  backdoor: { kind: 'backdoor', label: 'backdoor', recipe: 'A dominant 7th a whole step below. Strongest into a major landing.', strength: (l) => (isMinorQuality(l.quality) ? 0.4 : 0.7) },
  plagal: { kind: 'plagal', label: 'plagal', recipe: 'The iv of the landing.', strength: () => 0.6 },
}

export const MOVE_ORDER: MoveKind[] = ['dominant', 'ii-V', 'tritone', 'slide', 'diminished', 'backdoor', 'plagal']

export interface MoveResult {
  kind: MoveKind
  /** The chords in playing order. The last one points at the landing. */
  chords: Chord[]
}

function rel(landing: Chord, letterSteps: number, semitones: number, quality: Quality): Chord {
  const base: Spelling = landing.spelling ?? spellPc(landing.root)
  const spelling = transposeSpelling(base, letterSteps, semitones)
  return { root: spellingPc(spelling), quality, spelling }
}

/** The chords each move produces when aimed at a landing. */
export function applyMove(kind: MoveKind, landing: Chord): Chord[] {
  const minor = isMinorQuality(landing.quality)
  switch (kind) {
    case 'dominant':
      return [rel(landing, 4, 7, '7')]
    case 'ii-V':
      return [rel(landing, 1, 2, minor ? 'ø7' : 'm7'), rel(landing, 4, 7, '7')]
    case 'tritone':
      return [rel(landing, 1, 1, '7')]
    case 'slide':
      return [rel(landing, 1, 1, 'maj7')]
    case 'diminished':
      return [rel(landing, -1, -1, 'dim7')]
    case 'backdoor':
      return [rel(landing, -1, -2, '7')]
    case 'plagal':
      return [rel(landing, 3, 5, 'm7')]
  }
}

export function movesInto(landing: Chord): MoveResult[] {
  return MOVE_ORDER.map((kind) => ({ kind, chords: applyMove(kind, landing) }))
}

/** A chord produced by a move, with what it points at. */
export interface MoveNode {
  id: string
  chord: Chord
  /** The move this chord belongs to. */
  kind: MoveKind
  /** Id of the chord it points at: another node, or the landing. */
  target: string
  /** 1 = points straight at the landing, 2 = points at a level-1 chord. */
  level: number
}

export interface MoveLink {
  from: string
  to: string
  kind: MoveKind
  label: string
}

export interface Constellation {
  landingId: string
  nodes: MoveNode[]
  links: MoveLink[]
}

/**
 * Everything that points at a landing. `resolve` lets the caller map a chord
 * onto an id it already has (a palette star), so that no duplicate appears and
 * the arrow is drawn to the existing chord instead.
 */
export function constellationFor(
  landing: Chord,
  landingId: string,
  resolve: (c: Chord) => string | undefined,
): Constellation {
  const nodes = new Map<string, MoveNode>()
  const links = new Map<string, MoveLink>()

  for (const { kind, chords } of movesInto(landing)) {
    let target = landingId
    for (let i = chords.length - 1; i >= 0; i--) {
      const chord = chords[i]
      const level = chords.length - i
      const existing = resolve(chord)
      const id = existing ?? `move:${chordKey(chord)}`
      if (!existing && !nodes.has(id)) nodes.set(id, { id, chord, kind, target, level })
      const linkKey = `${id}>${target}`
      if (!links.has(linkKey)) links.set(linkKey, { from: id, to: target, kind, label: MOVES[kind].label })
      target = id
    }
  }

  return { landingId, nodes: [...nodes.values()], links: [...links.values()] }
}

/** A chord in the whole-sky graph: it may serve several landings through several moves. */
export interface GraphNode {
  id: string
  chord: Chord
  kinds: MoveKind[]
}

export interface GraphLink extends MoveLink {
  landingId: string
}

export interface MoveGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

/** Every move into every landing, with move chords shared across landings. */
export function moveGraph(
  landings: { id: string; chord: Chord }[],
  resolve: (c: Chord) => string | undefined,
): MoveGraph {
  const nodes = new Map<string, GraphNode>()
  const links = new Map<string, GraphLink>()
  for (const landing of landings) {
    const k = constellationFor(landing.chord, landing.id, resolve)
    for (const n of k.nodes) {
      const existing = nodes.get(n.id)
      if (existing) {
        if (!existing.kinds.includes(n.kind)) existing.kinds.push(n.kind)
      } else {
        nodes.set(n.id, { id: n.id, chord: n.chord, kinds: [n.kind] })
      }
    }
    for (const l of k.links) {
      const key = `${l.from}>${l.to}`
      if (!links.has(key)) links.set(key, { ...l, landingId: landing.id })
    }
  }
  return { nodes: [...nodes.values()], links: [...links.values()] }
}
