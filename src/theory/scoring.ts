// scoring.ts — the eight dimensions from the catalogue, scored for one gap: a jumpoff that is
// known and a landing that is being considered. Room is left at full marks until there is rhythm.

import { type Chord, chordKey, sameChord } from './chords';
import { type Home, type Skeletal, identify, pairingStrength, tensionLevel, outsideNotes, keepsHomeNote, onChainOfFourths } from './palette';
import { type Path, type PathKind, pathChords } from './moves';
import { type Voicing, voiceSequence } from './voicing';
import { mod } from './pitch';
import { rootPc } from './chords';

export type Dim = 'right' | 'left' | 'smooth' | 'tension' | 'room' | 'distance' | 'pattern' | 'variety';

export const DIMS: { key: Dim; label: string; question: string }[] = [
  { key: 'right', label: 'Right fit', question: 'How strongly does it point at the next chord?' },
  { key: 'left', label: 'Left fit', question: 'Does it follow naturally from the previous chord?' },
  { key: 'smooth', label: 'Smoothness', question: 'How little do the voices have to move?' },
  { key: 'tension', label: 'Tension fit', question: 'Is it as tense as this slot can take?' },
  { key: 'room', label: 'Room', question: 'Does it fit in the time available? (no rhythm yet)' },
  { key: 'distance', label: 'Distance from home', question: 'How far outside the key does it reach?' },
  { key: 'pattern', label: 'Pattern', question: 'Does it continue a pattern already under way?' },
  { key: 'variety', label: 'Variety', question: 'Has this just been used?' },
];

export const WEIGHTS: Record<Dim, number> = { right: 3, left: 2, smooth: 2, tension: 1, room: 1, distance: 1, pattern: 1, variety: 1 };

// A chord already placed in the progression.
export type Placed = {
  chord: Chord;
  weight: 'skeletal' | 'passing';
  kind: PathKind;            // how it got here: 'bare' for a plain skeletal pick
  voicing: Voicing;
  skeletal?: Skeletal;
};

export type ScoreContext = {
  home: Home;
  pal: Skeletal[];
  history: Placed[];       // everything placed so far; the last one is the jumpoff
  homeDial: number;        // -1 stay home … +1 wander
};

export type Scored = {
  path: Path;
  total: number;
  dims: Record<Dim, number>;
  voicings: Voicing[];     // for the passing chords then the landing
  explain: Partial<Record<Dim, string>>;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Tuning knobs, so the bench can sweep them. Values are starting guesses tuned against the repertoire.
export const TUNING = {
  tensionPenalty: 0.2,    // per tension level, until rhythm says how long the slot is
  unlistedLeft: 0.8,      // how much an unlisted move's first chord can earn from smoothness alone
  smoothDivisor: 14,      // movement cost at which smoothness reaches zero
  room2: 0.75,            // room for a two-chord move, with no rhythm to say otherwise
  room3: 0.7,             // and for three or more
  distanceScale: 2.5,     // outside notes per chord at which distance from home saturates
};
const smoothFromCost = (c: number) => clamp01(1 - c / TUNING.smoothDivisor);

function lastSkeletal(history: Placed[], n: number): Placed[] {
  return history.filter(p => p.weight === 'skeletal').slice(-n);
}

function lastGapKind(history: Placed[]): PathKind | undefined {
  // The kind of the move that led into the last skeletal chord.
  const last = history[history.length - 1];
  return last?.kind;
}

export function scorePath(path: Path, ctx: ScoreContext): Scored {
  const { home, pal, history, homeDial } = ctx;
  const jump = history[history.length - 1];
  const chords = pathChords(path);
  const { voicings, costs } = voiceSequence(chords, jump.voicing);
  const explain: Partial<Record<Dim, string>> = {};

  // Smoothness: every link from the jumpoff through the path into the landing.
  const smooth = costs.length ? costs.map(smoothFromCost).reduce((a, b) => a + b, 0) / costs.length : 1;
  explain.smooth = `${costs.map(c => c.toFixed(0)).join(' + ')} semitones moved`;

  // Right fit: the recipe's strength, or the listed pairing for a bare connector.
  let right: number;
  if (path.strength !== undefined) {
    right = path.strength;
    explain.right = path.deceptive ? 'recipe, discounted for the deceptive landing' : 'recipe strength';
  } else {
    right = 0.15 + 0.3 * smoothFromCost(costs[0] ?? 0);
    explain.right = 'unlisted pairing, ranked by smoothness';
  }

  // Left fit: how the first chord of the path follows the jumpoff.
  const first = chords[0];
  const listed = pairingStrength(jump.chord, first, home, pal);
  let left: number;
  if (listed !== undefined) { left = listed; explain.left = 'listed common motion'; }
  else if (path.kind === 'bare') { left = 0.5 * smoothFromCost(costs[0] ?? 0); explain.left = 'unlisted, so smoothness'; }
  else { left = TUNING.unlistedLeft * smoothFromCost(costs[0] ?? 0); explain.left = 'unlisted, so smoothness'; }

  // Tension fit: without rhythm every chord is assumed to hold a moderate slot, so lower
  // tension suits each of them a little better. Short slots before a downbeat will change this.
  const levels = chords.map(c => tensionLevel(c, home, pal));
  const tension = 1 - TUNING.tensionPenalty * (levels.reduce((a, b) => a + b, 0) / levels.length);
  explain.tension = `tension ${levels.join(', ')}`;

  // Room: no rhythm yet, so the only thing known is that a longer move needs more space.
  const room = path.chords.length <= 1 ? 1 : path.chords.length === 2 ? TUNING.room2 : TUNING.room3;
  if (path.chords.length > 1) explain.room = `${path.chords.length} chords need space`;

  // Distance from home, bent by the taste dial.
  const outside = chords.map(c => outsideNotes(c, home));
  const frac = Math.min(1, outside.reduce((a, b) => a + b, 0) / chords.length / TUNING.distanceScale);
  const distance = clamp01(0.5 - homeDial * (0.5 - frac));
  explain.distance = `${outside.join(', ')} note${outside.reduce((a, b) => a + b, 0) === 1 ? '' : 's'} outside the scale`;

  // Pattern: the last two skeletal chords share a quality and a root interval that the landing continues.
  let pattern = 0.5;
  const recent = lastSkeletal(history, 2);
  if (recent.length === 2 && recent[0].chord.quality === recent[1].chord.quality) {
    const step = mod(rootPc(recent[1].chord) - rootPc(recent[0].chord), 12);
    const L = path.landing;
    if (L.quality === recent[1].chord.quality && mod(rootPc(L) - rootPc(recent[1].chord), 12) === step) {
      pattern = 1;
      if (!keepsHomeNote(L, home)) pattern -= 0.25;
      if (L.quality === 'maj7' && !onChainOfFourths(L, home)) pattern -= 0.25;
      explain.pattern = 'continues the chain';
    } else if (L.quality === recent[1].chord.quality) { pattern = 0.6; explain.pattern = 'same quality, new interval'; }
    else { pattern = 0.4; explain.pattern = 'breaks the pattern under way'; }
  } else explain.pattern = 'no pattern under way';

  // Variety: immediate repeats only.
  let variety = 1;
  if (sameChord(path.landing, jump.chord)) { variety = path.kind === 'side-slip' || path.kind === 'sus delay' ? 0.7 : 0.4; explain.variety = 'repeats the chord'; }
  else if (path.kind !== 'bare' && lastGapKind(history) === path.kind) { variety = 0.8; explain.variety = 'same move as the last gap'; }

  const dims: Record<Dim, number> = { right, left, smooth, tension, room, distance, pattern, variety };
  const totalW = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const total = (Object.keys(dims) as Dim[]).reduce((s, k) => s + WEIGHTS[k] * dims[k], 0) / totalW;
  return { path, total, dims, voicings, explain };
}

// How a chord ranks as the next skeletal chord: by its direct motion. Moves into it are
// decoration on that choice and are compared among themselves (the catalogue's "within kind").
export const chordScore = (bare: Scored, _moves: Scored[]) => bare.total;

// Map scores to opacity across a set, so the strongest line is solid and the weakest still visible.
export function opacityScale(totals: number[]): (t: number) => number {
  if (!totals.length) return () => 1;
  const sorted = [...totals].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.1)];
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return t => (hi - lo < 1e-6 ? 1 : 0.12 + 0.88 * clamp01((t - lo) / (hi - lo)));
}

export { chordKey, identify };
