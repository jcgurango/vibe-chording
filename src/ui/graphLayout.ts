import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import type { MoveGraph } from '../theory/moves'
import type { StarPlacement } from './layout'

/**
 * Settle the materialised move chords among the pinned palette stars.
 * A move chord is pulled toward every chord it points at, pushed away from
 * everything else, and kept from overlapping. The simulation runs in a
 * virtual screen and the result is converted back to unit-disk coordinates.
 */

const W = 1600
const H = 900
const SX = (W / 2) * 0.86
const SY = (H / 2) * 0.74

interface SimNode {
  id: string
  x: number
  y: number
  fx?: number
  fy?: number
}

export function layoutGraph(palette: StarPlacement[], graph: MoveGraph, seed = 3): StarPlacement[] {
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }

  const toPx = (p: { x: number; y: number }) => ({ x: W / 2 + p.x * SX, y: H / 2 + p.y * SY })
  const nodes: SimNode[] = palette.map((p) => {
    const { x, y } = toPx(p)
    return { id: p.id, x, y, fx: x, fy: y }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Start each move chord near the average of what it points at.
  for (const n of graph.nodes) {
    const targets = graph.links.filter((l) => l.from === n.id).map((l) => byId.get(l.to)).filter(Boolean) as SimNode[]
    const ax = targets.length ? targets.reduce((a, t) => a + t.x, 0) / targets.length : W / 2
    const ay = targets.length ? targets.reduce((a, t) => a + t.y, 0) / targets.length : H / 2
    const node = { id: n.id, x: ax + (rand() - 0.5) * 80, y: ay + (rand() - 0.5) * 80 }
    nodes.push(node)
    byId.set(n.id, node)
  }

  const links = graph.links
    .filter((l) => byId.has(l.from) && byId.has(l.to))
    .map((l) => ({ source: l.from, target: l.to }))

  const sim = forceSimulation(nodes)
    .force('link', forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(140).strength(0.4))
    .force('charge', forceManyBody().strength(-420))
    .force('collide', forceCollide(44).strength(0.9))
    .force('x', forceX(W / 2).strength(0.015))
    .force('y', forceY(H / 2).strength(0.03))
    .stop()

  for (let i = 0; i < 400; i++) sim.tick()

  return graph.nodes.map((n, i) => {
    const node = byId.get(n.id)!
    const x = Math.max(-1.08, Math.min(1.08, (node.x - W / 2) / SX))
    const y = Math.max(-1.12, Math.min(1.02, (node.y - H / 2) / SY))
    return {
      id: n.id,
      x,
      y,
      phase: [rand() * Math.PI * 2, rand() * Math.PI * 2],
      speed: [0.15 + rand() * 0.1, 0.11 + rand() * 0.1 + i * 0.0001],
      amp: 0.006 + rand() * 0.006,
    }
  })
}
