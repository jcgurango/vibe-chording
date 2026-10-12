// bench.ts — ranks each repertoire step the way the map orders it: where does the chord the
// song chose sit among all next chords, and where does the move the song used sit among all
// ways into that chord?

import { parseNote } from '../theory/pitch';
import { parseChord, chordKey } from '../theory/chords';
import { type Home, palette, identify } from '../theory/palette';
import { pathsInto } from '../theory/moves';
import { scorePath, chordScore, type Placed, type Scored } from '../theory/scoring';
import { voice } from '../theory/voicing';
import { REPERTOIRE, type RepExample, type Via } from './repertoire';

export type GapResult = {
  example: string;
  from: string;
  to: string;
  via: string;
  chordRank: number | null;    // 1 = the best-scored next chord; null when the landing is outside the palette
  chordOf: number;
  moveRank: number | null;     // rank of the song's move among all ways into the landing
  moveOf: number;
  topChord: string;            // what the map would have put first
  topMove: string;
};

export type BenchOptions = { homeDial?: number };

const kinds = (via: Via | true | undefined): string[] => via === undefined || via === true ? ['bare'] : Array.isArray(via) ? via : [via];

export function benchExample(ex: RepExample, opts: BenchOptions = {}): GapResult[] {
  const home: Home = { root: parseNote(ex.home), mode: ex.mode };
  const pal = palette(home);
  const homeDial = opts.homeDial ?? -0.5;
  const chords = ex.steps.map(s => parseChord(s.chord));
  const history: Placed[] = [];
  const results: GapResult[] = [];

  const gaps: { to: ReturnType<typeof parseChord>; via: Via | true | undefined; label: string }[] = [];
  ex.steps.slice(1).forEach((s, i) => gaps.push({ to: chords[i + 1], via: s.via, label: s.chord }));
  if (ex.wrap !== undefined) gaps.push({ to: chords[0], via: ex.wrap, label: ex.steps[0].chord });

  history.push({ chord: chords[0], weight: 'skeletal', kind: 'bare', voicing: voice(chords[0], null), skeletal: identify(chords[0], pal) });

  gaps.forEach((g, gi) => {
    const jump = history[history.length - 1];
    const ctx = { home, pal, history, homeDial };
    const wanted = kinds(g.via);

    // The frontier as the map sorts it.
    const frontier = pal.map(sk => {
      const scored = pathsInto(jump.chord, sk.chord, home, pal).map(p => scorePath(p, ctx));
      const bare = scored.find(s => s.path.kind === 'bare')!;
      const moves = scored.filter(s => s.path.kind !== 'bare').sort((a, b) => b.total - a.total);
      return { sk, bare, moves, best: chordScore(bare, moves) };
    }).sort((a, b) => b.best - a.best);

    const landingKey = chordKey({ ...g.to, bass: undefined, flat9: undefined });
    const row = frontier.findIndex(f => chordKey(f.sk.chord) === landingKey);
    let chordRank: number | null = null, moveRank: number | null = null, moveOf = 0, topMove = '';
    let chosen: Scored | undefined;
    if (row >= 0) {
      chordRank = row + 1;
      const { bare, moves } = frontier[row];
      topMove = describe(moves[0]);
      if (wanted[0] === 'bare') {
        chosen = bare; // a direct motion is not ranked against moves
      } else {
        moveOf = moves.length;
        const mi = moves.findIndex(s => wanted.includes(s.path.kind));
        moveRank = mi >= 0 ? mi + 1 : null;
        chosen = mi >= 0 ? moves[mi] : undefined;
      }
    }
    results.push({
      example: ex.name, from: history[history.length - 1] ? name(jump) : '', to: g.label, via: wanted.join('|'),
      chordRank, chordOf: pal.length, moveRank, moveOf, topChord: frontier[0].sk.numeral, topMove,
    });

    // Place what the song did, so the next gap is judged with the right history.
    const kind = chosen?.path.kind ?? (wanted[0] as Placed['kind']);
    const passing = chosen?.path.chords ?? [];
    passing.forEach((c, i) => history.push({ chord: c, weight: 'passing', kind, voicing: chosen!.voicings[i] }));
    const v = chosen ? chosen.voicings[chosen.voicings.length - 1] : voice(g.to, jump.voicing);
    if (gi < gaps.length) history.push({ chord: g.to, weight: 'skeletal', kind, voicing: v, skeletal: identify(g.to, pal) });
  });
  return results;
}

const name = (p: Placed) => p.skeletal?.numeral ?? '?';
const describe = (s: Scored) => s.path.kind === 'bare' ? 'direct' : `${s.path.kind}${s.path.deceptive ? '*' : ''}`;

export type Summary = {
  gaps: number; ranked: number;
  chordMean: number; chordTop3: number; chordTop5: number;
  moveMean: number; moveTop1: number; moveTop3: number; moveMissing: number;
};

export function summarize(results: GapResult[]): Summary {
  const ranked = results.filter(r => r.chordRank !== null);
  const cr = ranked.map(r => r.chordRank!);
  const moveGaps = ranked.filter(r => r.via !== 'bare');
  const mr = moveGaps.filter(r => r.moveRank !== null).map(r => r.moveRank!);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const frac = (xs: number[], n: number) => xs.filter(x => x <= n).length / Math.max(1, xs.length);
  return {
    gaps: results.length, ranked: ranked.length,
    chordMean: mean(cr), chordTop3: frac(cr, 3), chordTop5: frac(cr, 5),
    moveMean: mean(mr), moveTop1: frac(mr, 1), moveTop3: frac(mr, 3), moveMissing: moveGaps.length - mr.length,
  };
}

export function benchAll(opts: BenchOptions = {}): GapResult[] {
  return REPERTOIRE.flatMap(ex => benchExample(ex, opts));
}
