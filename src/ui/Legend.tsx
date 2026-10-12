import { MOVE_ORDER, MOVES, type MoveKind } from '../theory/moves'

interface LegendProps {
  hidden: Set<MoveKind>
  onToggle: (kind: MoveKind) => void
}

/** One row per move, click to hide or show its arrows. */
export function Legend({ hidden, onToggle }: LegendProps) {
  return (
    <ul className="legend">
      {MOVE_ORDER.map((kind) => (
        <li key={kind} className={`move-${kind}${hidden.has(kind) ? ' off' : ''}`}>
          <button type="button" onClick={() => onToggle(kind)} title={MOVES[kind].recipe}>
            <span className="swatch" />
            {MOVES[kind].label}
          </button>
        </li>
      ))}
    </ul>
  )
}
