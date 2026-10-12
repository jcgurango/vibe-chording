// repertoire.ts — the catalogue's examples, written as what the tool should tend toward:
// a skeleton of chords and, where the document names one, the move into each chord.
//
// `via` is the move kind (or kinds) that the document reads into that chord; no `via` means a
// direct motion. `wrap` is how the loop returns to its first chord. Chords outside the home's
// palette (a promoted VI7, a ♭II in minor) stay in the skeleton but are not ranked.

import type { PathKind } from '../theory/moves';
import type { Mode } from '../theory/palette';

export type Via = PathKind | PathKind[];
export type RepStep = { chord: string; via?: Via };
export type RepExample = { name: string; home: string; mode: Mode; steps: RepStep[]; wrap?: Via | true; note?: string };

export const REPERTOIRE: RepExample[] = [
  {
    name: 'Fall in Love Alone', home: 'B♭', mode: 'major',
    steps: [
      { chord: 'B♭maj7' },
      { chord: 'E♭maj7', via: 'diatonic walk' },
      { chord: 'Gm7', via: 'dominant' },
      { chord: 'Cm7', via: ['flip + bass walk', 'quality flip', 'dominant'] },
    ],
    wrap: ['backdoor', 'plagal'],
  },
  {
    name: 'Scott and Zelda', home: 'F', mode: 'major',
    steps: [{ chord: 'Gm7' }, { chord: 'C7' }, { chord: 'Am7' }],
    wrap: 'dominant', note: 'D7♭9 is VI7, the promoted dominant into Gm7; V to iii is a deceptive landing',
  },
  {
    name: 'Scott and Zelda, bridge', home: 'F', mode: 'major',
    steps: [{ chord: 'B♭maj7' }, { chord: 'Am7' }, { chord: 'Gm7', via: 'chromatic passing' }],
  },
  {
    name: 'Fmaj7, E7, Am7, Gm7 (C7)', home: 'C', mode: 'major',
    steps: [{ chord: 'Fmaj7' }, { chord: 'Am7', via: 'dominant' }, { chord: 'Gm7' }],
    wrap: 'dominant',
  },
  {
    name: 'Horoyoi', home: 'E♭', mode: 'major',
    steps: [{ chord: 'A♭maj7' }, { chord: 'Cm7', via: 'dominant' }],
    wrap: 'dominant',
  },
  {
    name: 'Odoriko', home: 'C', mode: 'major',
    steps: [{ chord: 'Cmaj7' }, { chord: 'Am7', via: 'dominant' }, { chord: 'Fmaj7' }],
    wrap: ['quality flip', 'plagal'],
  },
  {
    name: 'House of Gold', home: 'F', mode: 'major',
    steps: [{ chord: 'Fmaj7' }, { chord: 'Dm7', via: 'dominant' }, { chord: 'B♭m7' }],
    wrap: true,
  },
  {
    name: 'favorite, verse', home: 'F', mode: 'major',
    steps: [{ chord: 'Fmaj7' }, { chord: 'Dm7' }, { chord: 'Gm7' }, { chord: 'Am7' }],
    wrap: true,
  },
  {
    name: 'favorite, prechorus', home: 'F', mode: 'major',
    steps: [{ chord: 'Gm7' }, { chord: 'C7' }, { chord: 'Am7' }, { chord: 'Dm7' }],
    wrap: true,
  },
  {
    name: 'favorite, chorus', home: 'F', mode: 'major',
    steps: [{ chord: 'Gm7' }, { chord: 'Dm7', via: 'dominant' }],
    wrap: true,
  },
  {
    name: 'favorite, side-slip', home: 'F', mode: 'major',
    steps: [{ chord: 'Gm7' }, { chord: 'Gm7', via: 'side-slip' }],
  },
  {
    name: 'Hvnly', home: 'D♭', mode: 'major',
    steps: [{ chord: 'G♭maj7' }, { chord: 'A♭7' }, { chord: 'B♭m7' }, { chord: 'Fm7' }],
    wrap: 'pre-echo',
  },
  {
    name: 'loser', home: 'D', mode: 'major',
    steps: [{ chord: 'Em7' }, { chord: 'A7' }, { chord: 'Dmaj7' }, { chord: 'Bm7' }],
    wrap: true,
  },
  {
    name: 'tourguide', home: 'A', mode: 'major',
    steps: [{ chord: 'Dmaj7' }, { chord: 'E7' }, { chord: 'Amaj7' }],
    wrap: 'dominant', note: 'F♯7 promises Bm and lands on D',
  },
  {
    name: 'Teach Me Slow, chorus', home: 'C', mode: 'major',
    steps: [{ chord: 'Cmaj7' }, { chord: 'Am7', via: 'dominant' }, { chord: 'Fmaj7' }, { chord: 'B♭maj7' }, { chord: 'A♭maj7' }],
    wrap: true,
  },
  {
    name: 'Teach Me Slow, verse', home: 'C', mode: 'major',
    steps: [{ chord: 'Cmaj7' }, { chord: 'B♭maj7' }, { chord: 'Cmaj7' }, { chord: 'E♭maj7' }],
    wrap: 'plagal',
  },
  {
    name: 'Teach Me Slow, prechorus to IV', home: 'C', mode: 'major',
    steps: [{ chord: 'A♭maj7' }, { chord: 'B♭maj7' }, { chord: 'Fmaj7' }],
  },
  {
    name: 'Teach Me Slow, prechorus to I', home: 'C', mode: 'major',
    steps: [{ chord: 'A♭maj7' }, { chord: 'B♭maj7' }, { chord: 'Cmaj7' }],
  },
  {
    name: 'Cmaj7, B7, G, E7♭9', home: 'C', mode: 'major',
    steps: [{ chord: 'Cmaj7' }, { chord: 'G7', via: 'dominant' }],
    wrap: 'dominant', note: 'both dominants land on near-twins',
  },
  {
    name: 'V, vii° of vi, vi', home: 'C', mode: 'major',
    steps: [{ chord: 'G7' }, { chord: 'Am7', via: 'diminished' }],
  },
];
