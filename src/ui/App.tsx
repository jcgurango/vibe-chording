import { useCallback, useEffect, useMemo, useState } from 'react'
import { playVoicing } from '../audio/player'
import { chordKey, chordName } from '../theory/chords'
import { moveGraph, type GraphNode, type MoveKind } from '../theory/moves'
import { C_MAJOR, paletteFor, type PaletteChord } from '../theory/palette'
import { spellingName } from '../theory/spelling'
import { voice } from '../theory/voicing'
import { Legend } from './Legend'
import { Sky } from './Sky'
import { Starfield } from './Starfield'

const HOME = C_MAJOR

interface HudInfo {
  name: string
  sub: string
  source?: string
  detail: string
}

export function App() {
  const chords = useMemo(() => paletteFor(HOME), [])
  const graph = useMemo(() => {
    const byKey = new Map(chords.map((c) => [chordKey(c.chord), c.id]))
    return moveGraph(
      chords.map((c) => ({ id: c.id, chord: c.chord })),
      (c) => byKey.get(chordKey(c)),
    )
  }, [chords])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hiddenKinds, setHiddenKinds] = useState<Set<MoveKind>>(() => new Set())
  const [last, setLast] = useState<HudInfo | null>(null)

  const nameOf = useCallback(
    (id: string) => chords.find((c) => c.id === id)?.name ?? chordName(graph.nodes.find((n) => n.id === id)!.chord),
    [chords, graph],
  )

  const handlePalette = useCallback((c: PaletteChord) => {
    playVoicing(voice(c.chord))
    setSelectedId(c.id)
    setLast({ name: c.name, sub: c.numeral, source: c.source, detail: c.fit })
  }, [])

  const handleMove = useCallback(
    (n: GraphNode) => {
      playVoicing(voice(n.chord))
      setSelectedId(n.id)
      const into = graph.links
        .filter((l) => l.from === n.id && !hiddenKinds.has(l.kind))
        .map((l) => `${l.label} → ${nameOf(l.to)}`)
      setLast({ name: chordName(n.chord), sub: 'move chord', detail: into.join('  ·  ') })
    },
    [graph, hiddenKinds, nameOf],
  )

  const clearSelection = useCallback(() => setSelectedId(null), [])

  const toggleKind = useCallback((kind: MoveKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  return (
    <div className="app">
      <Starfield />
      <Sky
        chords={chords}
        graph={graph}
        hiddenKinds={hiddenKinds}
        selectedId={selectedId}
        onPlayPalette={handlePalette}
        onPlayMove={handleMove}
        onClear={clearSelection}
      />

      <header className="hud top">
        <h1>Chord Sky</h1>
        <span className="home-label">home · {spellingName(HOME)} major</span>
      </header>

      <Legend hidden={hiddenKinds} onToggle={toggleKind} />

      <footer className={`hud bottom${last ? ' visible' : ''}`}>
        {last ? (
          <>
            <div className="hud-title">
              <span className="hud-name">{last.name}</span>
              <span className="hud-numeral">{last.sub}</span>
              {last.source && <span className="hud-source">{last.source}</span>}
            </div>
            <p className="hud-fit">{last.detail}</p>
          </>
        ) : (
          <p className="hud-fit">Click a chord to hear it. Hover to see what points where.</p>
        )}
      </footer>
    </div>
  )
}
