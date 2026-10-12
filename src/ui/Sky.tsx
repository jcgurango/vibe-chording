import { useEffect, useMemo, useRef, useState } from 'react'
import { chordName } from '../theory/chords'
import { MOVES, type GraphNode, type MoveGraph, type MoveKind } from '../theory/moves'
import type { PaletteChord } from '../theory/palette'
import { layoutGraph } from './graphLayout'
import { driftedPosition, layoutSky } from './layout'

interface SkyProps {
  chords: PaletteChord[]
  graph: MoveGraph
  hiddenKinds: Set<MoveKind>
  selectedId: string | null
  onPlayPalette: (chord: PaletteChord) => void
  onPlayMove: (node: GraphNode) => void
  onClear: () => void
}

const QUALITY_CLASS: Record<string, string> = { '7': 'q-dom', m7: 'q-min', maj7: 'q-maj', 'ø7': 'q-half', dim7: 'q-dim' }

/** The floating chord stars and the arrows between them. Positions are driven by requestAnimationFrame via refs. */
export function Sky({ chords, graph, hiddenKinds, selectedId, onPlayPalette, onPlayMove, onClear }: SkyProps) {
  const palettePlacements = useMemo(() => layoutSky(chords), [chords])
  const movePlacements = useMemo(() => layoutGraph(palettePlacements, graph), [palettePlacements, graph])
  const placements = useMemo(() => [...palettePlacements, ...movePlacements], [palettePlacements, movePlacements])
  const chordById = useMemo(() => new Map(chords.map((c) => [c.id, c])), [chords])
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph])

  const radiusById = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of chords) {
      const isHome = c.group === 'diatonic' && c.degree === 0
      m.set(c.id, isHome ? 10 : { diatonic: 7, minor: 5.5, modes: 4.5 }[c.group])
    }
    for (const n of graph.nodes) m.set(n.id, 6)
    return m
  }, [chords, graph])

  const visibleLinks = useMemo(() => graph.links.filter((l) => !hiddenKinds.has(l.kind)), [graph, hiddenKinds])
  const visibleNodes = useMemo(() => {
    const ids = new Set<string>()
    for (const l of visibleLinks) {
      ids.add(l.from)
      ids.add(l.to)
    }
    return new Set(graph.nodes.filter((n) => ids.has(n.id)).map((n) => n.id))
  }, [graph, visibleLinks])

  const [hoverId, setHoverId] = useState<string | null>(null)
  const activeId = hoverId ?? selectedId
  const hotIds = useMemo(() => {
    const s = new Set<string>()
    if (!activeId) return s
    s.add(activeId)
    for (const l of visibleLinks) {
      if (l.from === activeId) s.add(l.to)
      if (l.to === activeId) s.add(l.from)
    }
    return s
  }, [activeId, visibleLinks])

  const nameOf = (id: string) => chordById.get(id)?.name ?? (nodeById.get(id) ? chordName(nodeById.get(id)!.chord) : id)

  const starEls = useRef(new Map<string, HTMLButtonElement>())
  const lineEls = useRef(new Map<string, SVGLineElement>())
  const labelEls = useRef(new Map<string, SVGTextElement>())

  useEffect(() => {
    let raf = 0
    const tick = (ms: number) => {
      const t = ms / 1000
      const w = window.innerWidth
      const h = window.innerHeight
      const cx = w / 2
      const cy = h / 2
      const sx = (w / 2) * 0.86
      const sy = (h / 2) * 0.74

      const pos = new Map<string, [number, number]>()
      for (const p of placements) {
        const [x, y] = driftedPosition(p, t)
        pos.set(p.id, [cx + x * sx, cy + y * sy])
      }

      for (const [id, el] of starEls.current) {
        const p = pos.get(id)
        if (p) el.style.transform = `translate(${p[0]}px, ${p[1]}px)`
      }

      for (const [key, line] of lineEls.current) {
        const [from, to] = key.split('>')
        const a = pos.get(from)
        const b = pos.get(to)
        if (!a || !b) continue
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const startGap = (radiusById.get(from) ?? 6) + 6
        const endGap = (radiusById.get(to) ?? 6) + 9
        const x1 = a[0] + ux * startGap
        const y1 = a[1] + uy * startGap
        const x2 = b[0] - ux * endGap
        const y2 = b[1] - uy * endGap
        line.setAttribute('x1', x1.toFixed(1))
        line.setAttribute('y1', y1.toFixed(1))
        line.setAttribute('x2', x2.toFixed(1))
        line.setAttribute('y2', y2.toFixed(1))
        const label = labelEls.current.get(key)
        if (label) {
          let deg = (Math.atan2(dy, dx) * 180) / Math.PI
          if (deg > 90 || deg < -90) deg += 180
          label.setAttribute('transform', `translate(${((x1 + x2) / 2).toFixed(1)}, ${((y1 + y2) / 2).toFixed(1)}) rotate(${deg.toFixed(1)})`)
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [placements, radiusById])

  const flash = (el: HTMLElement) => {
    el.classList.remove('lit')
    void el.offsetWidth // restart the animation on a rapid second click
    el.classList.add('lit')
  }

  const starRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) starEls.current.set(id, el)
    else starEls.current.delete(id)
  }

  return (
    <div
      className={`sky${activeId ? ' has-active' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClear()
      }}
    >
      <svg className="links" aria-hidden="true">
        <defs>
          {Object.keys(MOVES).map((kind) => (
            <marker
              key={kind}
              id={`arrow-${kind}`}
              className={`move-${kind}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          ))}
        </defs>
        {visibleLinks.map((link) => {
          const key = `${link.from}>${link.to}`
          const hot = activeId !== null && (link.from === activeId || link.to === activeId)
          return (
            <g key={key} className={`link move-${link.kind}${hot ? ' hot' : ''}`}>
              <line
                ref={(el) => {
                  if (el) lineEls.current.set(key, el)
                  else lineEls.current.delete(key)
                }}
                markerEnd={`url(#arrow-${link.kind})`}
              />
              <text
                ref={(el) => {
                  if (el) labelEls.current.set(key, el)
                  else labelEls.current.delete(key)
                }}
                y="-6"
                textAnchor="middle"
              >
                {link.label}
              </text>
            </g>
          )
        })}
      </svg>

      {chords.map((c) => {
        const isHome = c.group === 'diatonic' && c.degree === 0
        const cls = [
          'star kind-palette',
          `group-${c.group}`,
          isHome ? 'home' : '',
          selectedId === c.id ? 'focused' : '',
          hotIds.has(c.id) ? 'hot' : '',
        ].join(' ')
        return (
          <button
            key={c.id}
            ref={starRef(c.id)}
            className={cls}
            onClick={(e) => {
              onPlayPalette(c)
              flash(e.currentTarget)
            }}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId((h) => (h === c.id ? null : h))}
            onAnimationEnd={(e) => {
              if (e.animationName === 'flare') e.currentTarget.classList.remove('lit')
            }}
            title={c.fit}
          >
            <span className="halo" />
            <span className="core" />
            <span className="label">
              <span className="name">{c.name}</span>
              <span className="numeral">{c.numeral}</span>
            </span>
          </button>
        )
      })}

      {graph.nodes.map((n) => {
        if (!visibleNodes.has(n.id)) return null
        const cls = [
          'star kind-move',
          QUALITY_CLASS[n.chord.quality] ?? 'q-dom',
          selectedId === n.id ? 'focused' : '',
          hotIds.has(n.id) ? 'hot' : '',
        ].join(' ')
        const targets = visibleLinks.filter((l) => l.from === n.id).map((l) => `${l.label} → ${nameOf(l.to)}`)
        return (
          <button
            key={n.id}
            ref={starRef(n.id)}
            className={cls}
            onClick={(e) => {
              onPlayMove(n)
              flash(e.currentTarget)
            }}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
            onAnimationEnd={(e) => {
              if (e.animationName === 'flare') e.currentTarget.classList.remove('lit')
            }}
            title={targets.join('\n')}
          >
            <span className="halo" />
            <span className="core" />
            <span className="label">
              <span className="name">{chordName(n.chord)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
