// layout.ts — turns the progression and its frontiers into columns, rows and wires for the SVG map.
//
// Every column holds the palette. The first column keeps the catalogue's order; every later
// column is sorted by the best score of the ways into each chord from the chord chosen before it.

import { type Chord, chordName, chordKey } from '../theory/chords';
import type { Skeletal } from '../theory/palette';
import type { Path, PathKind } from '../theory/moves';
import { type Placed, type Scored, chordScore } from '../theory/scoring';

export const CARD_W = 124, CARD_H = 44, LINE_H = 22, ROW_PAD = 14, GROUP_GAP = 14, LEFT = 96, TOP = 26;
const FAN = 58, JOIN = 46;

export type FrontierRow = { sk: Skeletal; bare: Scored; moves: Scored[] };
export const bestOf = (f: FrontierRow) => chordScore(f.bare, f.moves);

export type Chip = { x: number; w: number; text: string };
export type Wire = {
  id: string;
  gap: number;                 // index of the gap this wire sits in (between column gap and gap+1)
  targetRow: number;           // row index in column gap+1
  path: Path;
  scored?: Scored;             // present on the live frontier
  d: string;
  chips: Chip[];
  kindLabel: { x: number; text: string; w: number };
  opacity: number;
  cls: string;
  chosen: boolean;
  placedFrom?: number;         // for past gaps: indices into the progression
  placedTo?: number;
};
export type Row = {
  top: number; h: number; center: number; chord: Chord; numeral: string; group: string; starting: boolean; id: string;
  inPalette: boolean; frontier?: FrontierRow; shown: Scored[]; best: number;
};
export type Column = {
  x: number; kind: 'start' | 'past' | 'frontier'; step: number; rows: Row[]; ordered: boolean;
  chosenRow?: number; placedIndex?: number;
};
export type MoreToggle = { rowId: string; x: number; y: number; hidden: number; expanded: boolean };

export type Layout = { columns: Column[]; wires: Wire[]; width: number; height: number; more: MoreToggle[]; gapX: { x0: number; x1: number }[] };

const textW = (s: string, px: number) => {
  let w = 0;
  for (const ch of s) w += ch === '♭' || ch === '♯' || ch === 'ø' ? px * 0.55 : /[A-Z]/.test(ch) ? px * 0.68 : ch === '–' ? px * 0.6 : px * 0.56;
  return w;
};

function chipsFor(path: Path, startX: number): { chips: Chip[]; kind: { x: number; text: string; w: number }; end: number } {
  const label = path.deceptive ? `${path.kind} · deceptive` : path.kind;
  const kw = path.kind === 'bare' ? 0 : textW(label.toUpperCase(), 9) * 1.12 + 8;
  let x = startX;
  const kind = { x, text: path.kind === 'bare' ? '' : label, w: kw };
  x += kw + (kw ? 6 : 0);
  const chips: Chip[] = [];
  for (const c of path.chords) {
    const text = chordName(c);
    const w = textW(text, 11) + 12;
    chips.push({ x, w, text });
    x += w + 4;
  }
  return { chips, kind, end: x };
}

function wireD(sx: number, sy: number, fanX: number, y: number, joinX: number, ex: number, ey: number): string {
  return `M${sx},${sy} C${sx + 28},${sy} ${fanX - 26},${y} ${fanX},${y} L${joinX},${y} C${joinX + 22},${y} ${ex - 18},${ey} ${ex},${ey}`;
}

const clsFor = (p: Path) => ['lane', p.kind === 'bare' ? 'bare' : '', p.variation ? 'variation' : '', p.deceptive ? 'deceptive' : ''].filter(Boolean).join(' ');

export function layoutMap(args: {
  pal: Skeletal[];
  progression: Placed[];
  frontiers: FrontierRow[][];        // one per gap; the last one is live when there is a progression
  perChord: number;
  expanded: Set<string>;
  ghosts: boolean;
  opacityOf: (s: Scored) => number;
}): Layout {
  const { pal, progression, frontiers, perChord, expanded, ghosts, opacityOf } = args;
  const skeletalIdx = progression.map((p, i) => (p.weight === 'skeletal' ? i : -1)).filter(i => i >= 0);
  const steps = skeletalIdx.length;

  // Build one column's rows: palette order, or sorted by the frontier that leads into it.
  const buildRows = (frontier: FrontierRow[] | null, live: boolean, chosen?: Chord): Row[] => {
    const seeds: Omit<Row, 'top' | 'h' | 'center'>[] = pal.map((sk, i) => {
      const f = frontier?.[i];
      const shown = live && f ? f.moves.slice(0, expanded.has(sk.id) ? f.moves.length : Math.min(perChord, f.moves.length)) : [];
      return { chord: sk.chord, numeral: sk.numeral, group: sk.group, starting: !!sk.starting, id: sk.id, inPalette: true, frontier: f, shown, best: f ? bestOf(f) : 0 };
    });
    if (frontier) seeds.sort((a, b) => b.best - a.best);
    if (chosen && !seeds.some(r => chordKey(r.chord) === chordKey(chosen))) {
      seeds.push({ chord: chosen, numeral: '—', group: 'outside', starting: false, id: `x:${chordKey(chosen)}`, inPalette: false, shown: [], best: 0 });
    }
    const rows: Row[] = [];
    let y = TOP;
    seeds.forEach((seed, r) => {
      const lines = live && seed.frontier ? 1 + seed.shown.length : 0;
      const h = Math.max(CARD_H + ROW_PAD, lines * LINE_H + 10);
      const grouped = !frontier && r > 0 && seeds[r - 1].group !== seed.group;
      if (grouped) y += GROUP_GAP;
      rows.push({ top: y, h, center: y + h / 2, ...seed });
      y += h;
    });
    return rows;
  };

  // Past gaps: the chosen path between skeletal chord k and k+1.
  type PastGap = { path: Path; from: number; to: number };
  const pastGaps: PastGap[] = [];
  for (let k = 0; k + 1 < steps; k++) {
    const from = skeletalIdx[k], to = skeletalIdx[k + 1];
    const landing = progression[to];
    pastGaps.push({ from, to, path: { id: `past-${k}`, kind: landing.kind, chords: progression.slice(from + 1, to).map(p => p.chord), landing: landing.chord, note: '' } });
  }

  // Columns.
  const columns: Column[] = [];
  const gapX: { x0: number; x1: number }[] = [];
  let x = LEFT;
  if (steps === 0) {
    columns.push({ x, kind: 'start', step: 0, rows: buildRows(null, false), ordered: false });
  } else {
    for (let k = 0; k < steps; k++) {
      const chosen = progression[skeletalIdx[k]].chord;
      const rows = buildRows(k === 0 ? null : frontiers[k - 1], false, chosen);
      columns.push({ x, kind: 'past', step: k, rows, ordered: k > 0, chosenRow: rows.findIndex(r => chordKey(r.chord) === chordKey(chosen)), placedIndex: skeletalIdx[k] });
      let laneW: number;
      if (k < pastGaps.length) {
        laneW = Math.max(150, chipsFor(pastGaps[k].path, 0).end + FAN + JOIN + 16);
      } else {
        const live = buildRows(frontiers[k], true);
        let maxEnd = 0;
        for (const r of live) for (const s of r.shown) maxEnd = Math.max(maxEnd, chipsFor(s.path, 0).end);
        laneW = Math.max(300, maxEnd + FAN + JOIN + 40);
      }
      gapX.push({ x0: x + CARD_W, x1: x + CARD_W + laneW });
      x += CARD_W + laneW;
    }
    columns.push({ x, kind: 'frontier', step: steps, rows: buildRows(frontiers[steps - 1], true), ordered: true });
  }
  const width = x + CARD_W + (steps === 0 ? 560 : 40);
  const height = Math.max(...columns.map(c => c.rows[c.rows.length - 1].top + c.rows[c.rows.length - 1].h)) + 30;

  // Wires.
  const wires: Wire[] = [];
  const more: MoreToggle[] = [];

  pastGaps.forEach((g, k) => {
    const { x0, x1 } = gapX[k];
    const src = columns[k].rows[columns[k].chosenRow!];
    const next = columns[k + 1];
    const tRow = next.chosenRow!;
    const t = next.rows[tRow];
    const fanX = x0 + FAN, joinX = x1 - JOIN;
    const { chips, kind } = chipsFor(g.path, fanX + 8);
    wires.push({
      id: g.path.id, gap: k, targetRow: tRow, path: g.path, d: wireD(x0, src.center, fanX, t.center, joinX, x1, t.center),
      chips, kindLabel: kind, opacity: 1, cls: clsFor(g.path) + ' chosen', chosen: true, placedFrom: g.from, placedTo: g.to,
    });
    if (ghosts) {
      next.rows.forEach((row, r) => {
        if (r === tRow || !row.inPalette) return;
        const ghost: Path = { id: `ghost-${k}-${row.id}`, kind: 'bare', chords: [], landing: row.chord, note: '' };
        wires.push({
          id: ghost.id, gap: k, targetRow: r, path: ghost, d: wireD(x0, src.center, fanX, row.center, joinX, x1, row.center),
          chips: [], kindLabel: { x: 0, text: '', w: 0 }, opacity: 0.06 + 0.2 * opacityOf(row.frontier!.bare), cls: 'lane bare ghost', chosen: false,
        });
      });
    }
  });

  if (steps > 0) {
    const k = steps - 1;
    const { x0, x1 } = gapX[k];
    const src = columns[k].rows[columns[k].chosenRow!];
    const fanX = x0 + FAN, joinX = x1 - JOIN;
    columns[k + 1].rows.forEach((row, r) => {
      if (!row.frontier) return;
      const lines: Scored[] = [row.frontier.bare, ...row.shown];
      const n = lines.length;
      lines.forEach((s, i) => {
        const yLine = row.center + (i - (n - 1) / 2) * LINE_H;
        const { chips, kind } = chipsFor(s.path, fanX + 8);
        wires.push({
          id: s.path.id, gap: k, targetRow: r, path: s.path, scored: s,
          d: wireD(x0, src.center, fanX, yLine, joinX, x1, row.center),
          chips, kindLabel: kind, opacity: opacityOf(s), cls: clsFor(s.path), chosen: false,
        });
      });
      const hidden = row.frontier.moves.length - row.shown.length;
      const isExpanded = expanded.has(row.id);
      if (hidden > 0 || isExpanded) more.push({ rowId: row.id, x: x1 - 6, y: row.top + row.h - 5, hidden, expanded: isExpanded });
    });
  }

  return { columns, wires, width, height, more, gapX };
}

export type { PathKind };
