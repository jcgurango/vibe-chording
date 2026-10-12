import type { Layout, Wire } from './layout';
import { CARD_W, CARD_H } from './layout';
import { chordName } from '../theory/chords';

type Props = {
  layout: Layout;
  zoom: number;
  hoverId: string | null;
  onCard: (col: number, row: number, select: boolean) => void;
  onWire: (w: Wire, select: boolean) => void;
  onHoverWire: (w: Wire | null, e?: React.MouseEvent) => void;
  onMore: (row: number) => void;
};

const GROUP_NAMES: Record<string, string> = { diatonic: 'diatonic', minor: 'parallel minor', modes: 'other modes', outside: 'outside the palette' };

export function Map({ layout, zoom, hoverId, onCard, onWire, onHoverWire, onMore }: Props) {
  const { columns, rows, wires, width, height, more } = layout;
  const started = columns[0].kind !== 'start';

  return (
    <svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`}>
      {/* group labels and separators */}
      {rows.map((r, i) => r.groupStart ? (
        <g key={`g${i}`}>
          <text className="group-label" x={12} y={r.top + 12}>{GROUP_NAMES[r.group]}</text>
          {i > 0 && <line x1={12} x2={width - 20} y1={r.top - 7} y2={r.top - 7} stroke="var(--line)" strokeDasharray="2 4" />}
        </g>
      ) : null)}

      {/* wires under the cards; hovered one drawn last */}
      {[...wires].sort((a, b) => (a.id === hoverId ? 1 : 0) - (b.id === hoverId ? 1 : 0)).map(w => (
        <WireView key={`${w.gap}-${w.id}`} w={w} hovered={w.id === hoverId && !w.chosen}
          onClick={e => onWire(w, e.shiftKey)} onEnter={e => onHoverWire(w, e)} onMove={e => onHoverWire(w, e)} onLeave={() => onHoverWire(null)} />
      ))}

      {/* arrowheads: one per target row per gap */}
      {layout.gapX.map((g, k) => rows.map((r, i) => {
        const has = wires.some(w => w.gap === k && w.targetRow === i);
        if (!has) return null;
        const chosen = wires.some(w => w.gap === k && w.targetRow === i && w.chosen);
        const best = Math.max(...wires.filter(w => w.gap === k && w.targetRow === i).map(w => w.opacity));
        return <path key={`ah${k}-${i}`} d={`M${g.x1 - 7},${r.center - 4} L${g.x1},${r.center} L${g.x1 - 7},${r.center + 4} Z`}
          fill={chosen ? 'var(--accent)' : 'var(--move)'} opacity={chosen ? 1 : best} />;
      }))}

      {/* cards */}
      {columns.map((c, ci) => rows.map((r, ri) => {
        if (!r.inPalette && !(c.kind === 'past' && c.chosenRow === ri)) return null;
        const cls = ['card', `g-${r.group}`];
        if (c.kind === 'start') cls.push(r.starting ? 'start' : 'dim');
        if (c.kind === 'past') cls.push(c.chosenRow === ri ? 'chosen' : 'dim');
        return (
          <g key={`c${ci}-${ri}`} className={cls.join(' ')} transform={`translate(${c.x},${r.center - CARD_H / 2})`}
            onClick={e => onCard(ci, ri, e.shiftKey)}>
            <rect className="body" width={CARD_W} height={CARD_H} />
            <rect className="stripe" x={6} y={8} width={3} height={CARD_H - 16} />
            <text className="numeral" x={16} y={16}>{r.numeral}</text>
            <text className="name" x={16} y={34}>{chordName(r.chord)}</text>
          </g>
        );
      }))}

      {/* "more" toggles */}
      {more.map(m => (
        <g key={`m${m.row}`} className="more" onClick={() => onMore(m.row)}>
          <text x={m.x} y={m.y} textAnchor="end">{m.expanded ? 'fewer' : `+${m.hidden} more`}</text>
        </g>
      ))}

      {!started && (
        <text className="hint" x={columns[0].x + CARD_W + 24} y={rows[0].center + 4}>
          ← lit chords are the usual starting places. click to hear, shift+click to choose.
        </text>
      )}
    </svg>
  );
}

function WireView({ w, hovered, onClick, onEnter, onMove, onLeave }: {
  w: Wire; hovered: boolean;
  onClick: (e: React.MouseEvent) => void; onEnter: (e: React.MouseEvent) => void; onMove: (e: React.MouseEvent) => void; onLeave: () => void;
}) {
  const y = yOfLine(w.d);
  return (
    <g className={`${w.cls}${hovered ? ' hover' : ''}`} opacity={hovered ? 1 : w.opacity}
      onClick={onClick} onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
      <path className="hit" d={w.d} />
      <path className="wire" d={w.d} />
      {w.kindLabel.text && (
        <g>
          <rect className="kind-bg" x={w.kindLabel.x - 2} y={y - 7} width={w.kindLabel.w} height={14} />
          <text className="kind" x={w.kindLabel.x + 2} y={y + 3}>{w.kindLabel.text}</text>
        </g>
      )}
      {w.chips.map((c, i) => (
        <g className="chip" key={i} transform={`translate(${c.x},${y - 8})`}>
          <rect width={c.w} height={16} />
          <text x={c.w / 2} y={12} textAnchor="middle">{c.text}</text>
        </g>
      ))}
    </g>
  );
}

// The y of the straight segment, read back from the path string (the first L command).
function yOfLine(d: string): number {
  const m = /L[-\d.]+,([-\d.]+)/.exec(d);
  return m ? parseFloat(m[1]) : 0;
}
