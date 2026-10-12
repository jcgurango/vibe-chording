import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Home, HOME_ROOTS, palette, identify, prefersFlats, type Mode } from '../theory/palette';
import { pathsInto, type Path } from '../theory/moves';
import { scorePath, opacityScale, type Placed, type Scored } from '../theory/scoring';
import { voice, voiceSequence, type Voicing } from '../theory/voicing';
import { type Chord, chordName, transposeChord } from '../theory/chords';
import { intervalBetween, midiName, noteName } from '../theory/pitch';
import { player, type Sound } from '../audio/player';
import { layoutMap, type FrontierRow, type Wire } from './layout';
import { Map } from './Map';
import { Tooltip } from './Tooltip';

const PASSING_DUR = 0.55, SKELETAL_DUR = 1.3;

export function App() {
  const [rootIdx, setRootIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('major');
  const [progression, setProgression] = useState<Placed[]>([]);
  const [homeDial, setHomeDial] = useState(-0.5);
  const [perChord, setPerChord] = useState(2);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ghosts, setGhosts] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ wire: Wire; x: number; y: number } | null>(null);
  const [sound, setSound] = useState<Sound>('synth');

  const home: Home = useMemo(() => ({ root: HOME_ROOTS[rootIdx], mode }), [rootIdx, mode]);
  const pal = useMemo(() => palette(home), [home]);
  const flats = prefersFlats(home);

  useEffect(() => player.subscribe(setSound), []);

  // One frontier per gap: every palette chord scored as the next landing from the chord chosen at that step.
  // The last one is live; the earlier ones order the past columns the way they were when they were chosen.
  const frontiers: FrontierRow[][] = useMemo(() => {
    const idx = progression.map((p, i) => (p.weight === 'skeletal' ? i : -1)).filter(i => i >= 0);
    return idx.map(end => {
      const history = progression.slice(0, end + 1);
      const ctx = { home, pal, history, homeDial };
      const jump = history[history.length - 1].chord;
      return pal.map(sk => {
        const scored = pathsInto(jump, sk.chord, home, pal).map(p => scorePath(p, ctx));
        const bare = scored.find(s => s.path.kind === 'bare')!;
        const moves = scored.filter(s => s.path.kind !== 'bare').sort((a, b) => b.total - a.total);
        return { sk, bare, moves };
      });
    });
  }, [progression, home, pal, homeDial]);
  const frontier = frontiers.length ? frontiers[frontiers.length - 1] : null;

  // Two scales, so direct motions are compared with direct motions and moves with moves.
  const opacityOf = useMemo(() => {
    const bare = opacityScale(frontier ? frontier.map(f => f.bare.total) : []);
    const moves = opacityScale(frontier ? frontier.flatMap(f => f.moves.map(m => m.total)) : []);
    return (s: Scored) => (s.path.kind === 'bare' ? bare : moves)(s.total);
  }, [frontier]);

  const layout = useMemo(() => layoutMap({ pal, progression, frontiers, perChord, expanded, ghosts, opacityOf }),
    [pal, progression, frontiers, perChord, expanded, ghosts, opacityOf]);

  // ----- playing -----
  const playVoicings = useCallback((vs: Voicing[], last: 'skeletal' | 'passing' = 'skeletal') => {
    player.play(vs.map((v, i) => ({ voicing: v, duration: i === vs.length - 1 && last === 'skeletal' ? SKELETAL_DUR : PASSING_DUR })));
  }, []);

  const playScored = (s: Scored) => playVoicings(s.voicings);

  const playPlacedRange = (from: number, to: number) => {
    player.play(progression.slice(from, to + 1).map(p => ({ voicing: p.voicing, duration: p.weight === 'skeletal' ? SKELETAL_DUR : PASSING_DUR })));
  };

  // ----- choosing -----
  const placeScored = (s: Scored) => {
    const p = s.path;
    const items: Placed[] = p.chords.map((c, i) => ({ chord: c, weight: 'passing', kind: p.kind, voicing: s.voicings[i] }));
    items.push({ chord: p.landing, weight: 'skeletal', kind: p.kind, voicing: s.voicings[s.voicings.length - 1], skeletal: identify(p.landing, pal) });
    setProgression(prev => [...prev, ...items]);
    setExpanded(new Set());
  };

  const startWith = (chord: Chord) => {
    const v = voice(chord, null);
    setProgression([{ chord, weight: 'skeletal', kind: 'bare', voicing: v, skeletal: identify(chord, pal) }]);
    playVoicings([v]);
  };

  const skeletalIdx = progression.map((p, i) => (p.weight === 'skeletal' ? i : -1)).filter(i => i >= 0);

  const onCard = (col: number, rowIndex: number, select: boolean) => {
    const c = layout.columns[col];
    const row = c.rows[rowIndex];
    if (c.kind === 'start') {
      if (select) startWith(row.chord); else playVoicings([voice(row.chord, null)]);
      return;
    }
    if (c.kind === 'frontier') {
      const s = row.frontier!.bare;
      if (select) placeScored(s);
      playScored(s);
      return;
    }
    // past column
    if (!select) { playVoicings([progression[c.placedIndex!].voicing]); return; }
    if (c.step === 0) { startWith(row.chord); return; }
    // Re-pick at this step: keep everything up to the previous skeletal chord, then place this one as a bare pick.
    const keep = progression.slice(0, skeletalIdx[c.step - 1] + 1);
    const v = voice(row.chord, keep[keep.length - 1].voicing);
    setProgression([...keep, { chord: row.chord, weight: 'skeletal', kind: 'bare', voicing: v, skeletal: identify(row.chord, pal) }]);
    setExpanded(new Set());
    playVoicings([v]);
  };

  const onWire = (w: Wire, select: boolean) => {
    if (w.scored) {
      if (select) placeScored(w.scored);
      playScored(w.scored);
    } else if (w.placedFrom !== undefined) {
      playPlacedRange(w.placedFrom + 1, w.placedTo!);
    }
  };

  const onHoverWire = (w: Wire | null, e?: React.MouseEvent) => {
    if (!w || !w.scored || !e) { setHover(null); return; }
    setHover({ wire: w, x: e.clientX, y: e.clientY });
  };

  const onMore = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const undo = useCallback(() => {
    setProgression(prev => {
      const idx = prev.map((p, i) => (p.weight === 'skeletal' ? i : -1)).filter(i => i >= 0);
      if (idx.length <= 1) return [];
      return prev.slice(0, idx[idx.length - 2] + 1);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      if (e.key === 'Escape') { player.stopAll(); setHover(null); }
      if (e.key === ' ') { e.preventDefault(); playAll(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playAll = () => {
    if (!progression.length) return;
    playPlacedRange(0, progression.length - 1);
  };

  // Changing home transposes what is placed; changing mode keeps the chords and relabels them.
  const changeRoot = (idx: number) => {
    const iv = intervalBetween(HOME_ROOTS[rootIdx], HOME_ROOTS[idx]);
    const newHome: Home = { root: HOME_ROOTS[idx], mode };
    const newPal = palette(newHome);
    const chords = progression.map(p => transposeChord(p.chord, iv, prefersFlats(newHome)));
    const { voicings } = voiceSequence(chords, null);
    setProgression(progression.map((p, i) => ({ ...p, chord: chords[i], voicing: voicings[i], skeletal: p.weight === 'skeletal' ? identify(chords[i], newPal) : undefined })));
    setRootIdx(idx);
  };
  const changeMode = (m: Mode) => {
    const newPal = palette({ root: HOME_ROOTS[rootIdx], mode: m });
    setProgression(progression.map(p => ({ ...p, skeletal: p.weight === 'skeletal' ? identify(p.chord, newPal) : undefined })));
    setMode(m);
  };

  const describeVoicing = (v: Voicing) => `${midiName(v.bass, flats)} · ${v.upper.map(n => midiName(n, flats)).join(' ')}`;

  return (
    <div className="app">
      <header>
        <h1>Skeleton and Moves<span>a map of chord thinking</span></h1>
        <label className="control">home
          <select value={rootIdx} onChange={e => changeRoot(Number(e.target.value))}>
            {HOME_ROOTS.map((r, i) => <option key={i} value={i}>{noteName(r)}</option>)}
          </select>
          <select value={mode} onChange={e => changeMode(e.target.value as Mode)}>
            <option value="major">major</option>
            <option value="minor">minor</option>
          </select>
        </label>
        <label className="control" title="Distance from home is a taste setting: shift the preference toward or away from home.">
          <div>
            <input type="range" min={-1} max={1} step={0.1} value={homeDial} onChange={e => setHomeDial(Number(e.target.value))} />
            <div className="dial-ends"><span>stay home</span><span>wander</span></div>
          </div>
        </label>
        <label className="control">moves per chord
          <input type="number" min={0} max={12} value={perChord} onChange={e => setPerChord(Math.max(0, Math.min(12, Number(e.target.value))))} />
        </label>
        <label className="control"><input type="checkbox" checked={ghosts} onChange={e => setGhosts(e.target.checked)} /> roads not taken</label>
        <label className="control">zoom
          <input type="range" min={0.5} max={1.3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
        </label>
        <div className="status">sound: <b>{sound === 'piano' ? 'piano' : sound === 'loading' ? 'synth (piano loading…)' : 'synth'}</b></div>
      </header>

      <div className="strip">
        {progression.length === 0 ? (
          <span className="hint">Pick a starting chord on the map. <kbd>click</kbd> hears a chord or a move, <kbd>shift</kbd>+<kbd>click</kbd> chooses it. Moves and connectors are voice-led from the last chord.</span>
        ) : progression.map((p, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className="sep">›</span>}
            <div className={`placed ${p.weight}`} onClick={() => playVoicings([p.voicing], p.weight)} title={describeVoicing(p.voicing)}>
              {p.weight === 'skeletal'
                ? <span className="numeral">{p.skeletal?.numeral ?? '—'}</span>
                : <span className="kind">{p.kind}</span>}
              <span className="name">{chordName(p.chord)}</span>
              {p.weight === 'skeletal' && <span className="notes">{describeVoicing(p.voicing)}</span>}
            </div>
          </span>
        ))}
        {progression.length > 0 && (
          <div className="actions">
            <button onClick={playAll} title="space">▶ play</button>
            <button onClick={undo} title="backspace">⌫ undo</button>
            <button onClick={() => setProgression([])}>✕ clear</button>
          </div>
        )}
      </div>

      <div className="map-wrap" onMouseLeave={() => setHover(null)}>
        <Map layout={layout} zoom={zoom} hoverId={hover?.wire.id ?? null}
          onCard={onCard} onWire={onWire} onHoverWire={onHoverWire} onMore={onMore} />
        {hover?.wire.scored && <Tooltip scored={hover.wire.scored} x={hover.x} y={hover.y} flats={flats} />}
      </div>
    </div>
  );
}

export type { Path };
