// layout.ts — turns the progression and the frontier into columns, rows and wires for the SVG map.

import { type Chord, chordName, chordKey } from '../theory/chords';
import type { Skeletal } from '../theory/palette';
import type { Path, PathKind } from '../theory/moves';
import type { Placed, Scored } from '../theory/scoring';

export const CARD_W = 124, CARD_H = 44, LINE_H = 22, ROW_PAD = 14, GROUP_GAP = 14, LEFT = 96, TOP = 26;
const FAN = 58, JOIN = 46;

export type Chip = { x: number; w: number; text: string };
export type Wire = {
  id: string;
  gap: number;                 // index of the gap this wire sits in
  targetRow: number;
  path: Path;
  scored?: Scored;             // present on the frontier
  d: string;
  chips: Chip[];
  kindLabel: { x: number; text: string; w: number };
  opacity: number;
  cls: string;
  chosen: boolean;
  placedFrom?: number;         // for past gaps: indices into the progression
  placedTo?: number;
};
export type Column = { x: number; kind: 'start' | 'past' | 'frontier'; step: number; chosenRow?: number; placedIndex?: number };
// A row is a palette chord, or a placed chord that the current palette does not contain.
export type Row = {
  top: number; h: number; center: number; chord: Chord; numeral: string; group: string; starting: boolean; id: string;
  inPalette: boolean; groupStart: boolean; groupEnd: boolean;
};
export type MoreToggle = { row: number; x: number; y: number; hidden: number; expanded: boolean };

export type Layout = {
  columns: Column[]; rows: Row[]; wires: Wire[]; width: number; height: number; more: MoreToggle[];
  gapX: { x0: number; x1: number }[];
};

export type FrontierRow = { sk: Skeletal; bare: Scored; moves: Scored[] };

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

export function layoutMap(args: {
  pal: Skeletal[];
  progression: Placed[];
  frontier: FrontierRow[] | null;     // null when nothing is chosen yet
  perChord: number;
  expanded: Set<string>;
  ghosts: boolean;
  opacityOf: (t: number) => number;
}): Layout {
  const { pal, progression, frontier, perChord, expanded, ghosts, opacityOf } = args;
  const skeletalIdx = progression.map((p, i) => (p.weight === 'skeletal' ? i : -1)).filter(i => i >= 0);

  // Which moves each frontier row shows.
  const shown: Scored[][] = pal.map((sk, r) => {
    if (!frontier) return [];
    const f = frontier[r];
    const n = expanded.has(sk.id) ? f.moves.length : Math.min(perChord, f.moves.length);
    return f.moves.slice(0, n);
  });

  // Rows: the palette, then any placed skeletal chord the palette does not contain.
  type RowSeed = { chord: Chord; numeral: string; group: string; starting: boolean; id: string; inPalette: boolean };
  const seeds: RowSeed[] = pal.map(sk => ({ chord: sk.chord, numeral: sk.numeral, group: sk.group, starting: !!sk.starting, id: sk.id, inPalette: true }));
  for (const i of skeletalIdx) {
    const c = progression[i].chord;
    if (!seeds.some(r => chordKey(r.chord) === chordKey(c))) seeds.push({ chord: c, numeral: '—', group: 'outside', starting: false, id: `x:${chordKey(c)}`, inPalette: false });
  }
  const rowOf = (c: Chord) => seeds.findIndex(r => chordKey(r.chord) === chordKey(c));

  const rows: Row[] = [];
  let y = TOP;
  seeds.forEach((seed, r) => {
    const lines = frontier && seed.inPalette ? 1 + shown[r].length : 0;
    const h = Math.max(CARD_H + ROW_PAD, lines * LINE_H + 10);
    const groupStart = r === 0 || seeds[r - 1].group !== seed.group;
    const groupEnd = r === seeds.length - 1 || seeds[r + 1].group !== seed.group;
    if (groupStart && r > 0) y += GROUP_GAP;
    rows.push({ top: y, h, center: y + h / 2, ...seed, groupStart, groupEnd });
    y += h;
  });
  const height = y + 30;

  // Past gaps: the chosen path between skeletal chord k and k+1.
  type PastGap = { path: Path; from: number; to: number };
  const pastGaps: PastGap[] = [];
  for (let k = 0; k + 1 < skeletalIdx.length; k++) {
    const from = skeletalIdx[k], to = skeletalIdx[k + 1];
    const landing = progression[to];
    pastGaps.push({
      from, to,
      path: { id: `past-${k}`, kind: landing.kind, chords: progression.slice(from + 1, to).map(p => p.chord), landing: landing.chord, note: '' },
    });
  }

  // Columns and gap widths.
  const columns: Column[] = [];
  const gapX: { x0: number; x1: number }[] = [];
  let x = LEFT;
  if (skeletalIdx.length === 0) {
    columns.push({ x, kind: 'start', step: 0 });
  } else {
    skeletalIdx.forEach((pi, k) => {
      columns.push({ x, kind: 'past', step: k, chosenRow: rowOf(progression[pi].chord), placedIndex: pi });
      let laneW: number;
      if (k < pastGaps.length) {
        const { end } = chipsFor(pastGaps[k].path, 0);
        laneW = Math.max(150, end + FAN + JOIN + 16);
      } else {
        let maxEnd = 0;
        pal.forEach((_, r) => {
          for (const s of shown[r]) maxEnd = Math.max(maxEnd, chipsFor(s.path, 0).end);
        });
        laneW = Math.max(300, maxEnd + FAN + JOIN + 40);
      }
      gapX.push({ x0: x + CARD_W, x1: x + CARD_W + laneW });
      x += CARD_W + laneW;
    });
    columns.push({ x, kind: 'frontier', step: skeletalIdx.length });
  }
  const width = x + CARD_W + (skeletalIdx.length === 0 ? 560 : 40);

  // Wires.
  const wires: Wire[] = [];
  const more: MoreToggle[] = [];
  const clsFor = (p: Path) => [
    'lane', p.kind === 'bare' ? 'bare' : '', p.variation ? 'variation' : '', p.deceptive ? 'deceptive' : '',
  ].filter(Boolean).join(' ');

  pastGaps.forEach((g, k) => {
    const { x0, x1 } = gapX[k];
    const src = rows[columns[k].chosenRow!];
    const tRow = rowOf(g.path.landing);
    const t = rows[tRow];
    const fanX = x0 + FAN, joinX = x1 - JOIN;
    const { chips, kind } = chipsFor(g.path, fanX + 8);
    wires.push({
      id: g.path.id, gap: k, targetRow: tRow, path: g.path, d: wireD(x0, src.center, fanX, t.center, joinX, x1, t.center),
      chips, kindLabel: kind, opacity: 1, cls: clsFor(g.path) + ' chosen', chosen: true, placedFrom: g.from, placedTo: g.to,
    });
    if (ghosts) {
      pal.forEach((sk, r) => {
        if (r === tRow) return;
        const row = rows[r];
        const ghost: Path = { id: `ghost-${k}-${sk.id}`, kind: 'bare', chords: [], landing: sk.chord, note: '' };
        wires.push({
          id: ghost.id, gap: k, targetRow: r, path: ghost, d: wireD(x0, src.center, fanX, row.center, joinX, x1, row.center),
          chips: [], kindLabel: { x: 0, text: '', w: 0 }, opacity: 0.08, cls: 'lane bare ghost', chosen: false,
        });
      });
    }
  });

  if (frontier) {
    const k = pastGaps.length;
    const { x0, x1 } = gapX[k];
    const src = rows[columns[k].chosenRow!];
    const fanX = x0 + FAN, joinX = x1 - JOIN;
    pal.forEach((sk, r) => {
      const row = rows[r];
      const lines: Scored[] = [frontier[r].bare, ...shown[r]];
      const n = lines.length;
      lines.forEach((s, i) => {
        const yLine = row.center + (i - (n - 1) / 2) * LINE_H;
        const { chips, kind } = chipsFor(s.path, fanX + 8);
        wires.push({
          id: s.path.id, gap: k, targetRow: r, path: s.path, scored: s,
          d: wireD(x0, src.center, fanX, yLine, joinX, x1, row.center),
          chips, kindLabel: kind, opacity: opacityOf(s.total), cls: clsFor(s.path), chosen: false,
        });
      });
      const hidden = frontier[r].moves.length - shown[r].length;
      const isExpanded = expanded.has(sk.id);
      if (hidden > 0 || isExpanded) more.push({ row: r, x: x1 - 6, y: row.top + row.h - 5, hidden, expanded: isExpanded });
    });
  }

  return { columns, rows, wires, width, height, more, gapX };
}

export type { PathKind };
