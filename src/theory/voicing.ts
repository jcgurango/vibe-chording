// voicing.ts — two layers: a bass on the root (or the slash note) and a close-position
// upper shape near middle C that takes the nearest playable shape each time.

import { type Chord, shapePcs, bassPc } from './chords';
import { mod } from './pitch';

export type Voicing = { bass: number; upper: number[] };

export const WINDOW_LOW = 55;   // G3
export const WINDOW_HIGH = 79;  // G5
export const CENTER = 66;       // a home point a little above middle C
const BASS_LOW = 31, BASS_HIGH = 48, BASS_HOME = 40;

export const COSTS = { movement: 1, center: 0.3, topLeap: 0.5, minorNinth: 4, doubled: 10, lowCluster: 2 };

// Every close-position stack of the shape's pitch classes that fits the window.
export function shapeCandidates(rawPcs: number[]): number[][] {
  const out: number[][] = [];
  const pcs = [...new Set(rawPcs)].sort((a, b) => a - b);
  const n = pcs.length;
  for (let r = 0; r < n; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    const rel = [0];
    for (let k = 1; k < n; k++) rel.push(rel[k - 1] + mod(order[k] - order[k - 1], 12) || 12);
    const span = rel[n - 1];
    let base = WINDOW_LOW + mod(order[0] - WINDOW_LOW, 12);
    for (; base + span <= WINDOW_HIGH; base += 12) out.push(rel.map(x => base + x));
  }
  return out;
}

// Total semitones moved, matching voices low to high. Different sizes match each note of the
// larger shape to its nearest in the smaller.
export function movement(a: number[], b: number[]): number {
  if (a.length === b.length) return a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
  const [big, small] = a.length > b.length ? [a, b] : [b, a];
  return big.reduce((s, x) => s + Math.min(...small.map(y => Math.abs(x - y))), 0);
}

function shapeCost(shape: number[], prev: number[] | null): number {
  let cost = 0;
  const mean = shape.reduce((s, x) => s + x, 0) / shape.length;
  cost += COSTS.center * Math.abs(mean - CENTER);
  for (let i = 0; i < shape.length; i++) {
    for (let j = i + 1; j < shape.length; j++) {
      const d = shape[j] - shape[i];
      if (d === 13) cost += COSTS.minorNinth;
      if (d === 0) cost += COSTS.doubled;
      if (d <= 2 && shape[i] < 60) cost += COSTS.lowCluster;
    }
  }
  if (prev) {
    cost += COSTS.movement * movement(shape, prev);
    const leap = Math.abs(shape[shape.length - 1] - prev[prev.length - 1]);
    if (leap > 2) cost += COSTS.topLeap * (leap - 2);
  }
  return cost;
}

export function voiceUpper(c: Chord, prev: number[] | null): number[] {
  const candidates = shapeCandidates(shapePcs(c));
  let best = candidates[0], bestCost = Infinity;
  for (const cand of candidates) {
    const cost = shapeCost(cand, prev);
    if (cost < bestCost) { best = cand; bestCost = cost; }
  }
  return best;
}

export function voiceBass(c: Chord, prevBass: number | null): number {
  const pc = bassPc(c);
  const target = prevBass ?? BASS_HOME;
  let best = -1, bestD = Infinity;
  for (let m = BASS_LOW + mod(pc - BASS_LOW, 12); m <= BASS_HIGH; m += 12) {
    const d = Math.abs(m - target);
    if (d < bestD) { best = m; bestD = d; }
  }
  return best;
}

export function voice(c: Chord, prev: Voicing | null): Voicing {
  return { bass: voiceBass(c, prev?.bass ?? null), upper: voiceUpper(c, prev?.upper ?? null) };
}

// The movement cost between two voicings, which is the smoothness dimension in scoring.
export function voicingDistance(a: Voicing, b: Voicing): number {
  return movement(a.upper, b.upper) + 0.5 * Math.abs(a.bass - b.bass);
}

// Voice a sequence from a starting voicing. Returns each chord's voicing and the cost of each link.
export function voiceSequence(chords: Chord[], start: Voicing | null): { voicings: Voicing[]; costs: number[] } {
  const voicings: Voicing[] = [];
  const costs: number[] = [];
  let prev = start;
  for (const c of chords) {
    const v = voice(c, prev);
    if (prev) costs.push(voicingDistance(prev, v));
    voicings.push(v);
    prev = v;
  }
  return { voicings, costs };
}
