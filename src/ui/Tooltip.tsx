import type { Scored } from '../theory/scoring';
import { DIMS, WEIGHTS } from '../theory/scoring';
import { chordName } from '../theory/chords';
import { midiName } from '../theory/pitch';

export function Tooltip({ scored, x, y, flats }: { scored: Scored; x: number; y: number; flats: boolean }) {
  const p = scored.path;
  const left = Math.min(x + 16, window.innerWidth - 320);
  const top = Math.min(y + 16, window.innerHeight - 330);
  const chords = [...p.chords.map(chordName), chordName(p.landing)];
  const last = scored.voicings[scored.voicings.length - 1];
  return (
    <div className="tooltip" style={{ left, top }}>
      <h3>{p.kind === 'bare' ? 'direct' : p.kind}{p.deceptive ? ' · deceptive landing' : ''}{p.variation ? ' · variation' : ''}</h3>
      <div className="note">{p.note}</div>
      <div className="chords">{chords.join('  →  ')}</div>
      {DIMS.map(d => (
        <div className="dim" key={d.key} title={d.question}>
          <span className="label">{d.label} ×{WEIGHTS[d.key]}</span>
          <div className="bar"><div style={{ width: `${Math.round(scored.dims[d.key] * 100)}%` }} /></div>
          <span className="val">{scored.dims[d.key].toFixed(2)}</span>
        </div>
      ))}
      <div className="total"><span>score</span><b>{scored.total.toFixed(3)}</b></div>
      <div className="why">
        {(['right', 'left', 'smooth', 'distance', 'pattern', 'variety'] as const)
          .filter(k => scored.explain[k]).map(k => `${DIMS.find(d => d.key === k)!.label.toLowerCase()}: ${scored.explain[k]}`).join(' · ')}
      </div>
      <div className="voiced">lands on {midiName(last.bass, flats)} + {last.upper.map(n => midiName(n, flats)).join(' ')}</div>
    </div>
  );
}
