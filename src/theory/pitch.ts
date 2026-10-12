// pitch.ts — spelled pitches and intervals.
//
// Chords in the catalogue are spelled against a home (♭II in C is D♭, ♯iv is F♯),
// so every root is carried as a letter plus an accidental and moved by spelled
// intervals (letter steps + semitones). Pitch classes fall out of that.

export type SpelledNote = { letter: number; acc: number }; // letter 0..6 = C..B, acc -2..2
export type Interval = { steps: number; semis: number };

const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const pcOf = (n: SpelledNote) => mod(LETTER_PC[n.letter] + n.acc, 12);

export function noteName(n: SpelledNote): string {
  const acc = n.acc === 0 ? '' : n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc);
  return LETTER_NAMES[n.letter] + acc;
}

export function parseNote(s: string): SpelledNote {
  const letter = LETTER_NAMES.indexOf(s[0].toUpperCase());
  if (letter < 0) throw new Error(`bad note ${s}`);
  let acc = 0;
  for (const ch of s.slice(1)) {
    if (ch === '#' || ch === '♯') acc++;
    else if (ch === 'b' || ch === '♭') acc--;
  }
  return { letter, acc };
}

// Named intervals as (letter steps, semitones). Negative intervals are made with `invert`.
export const I = {
  P1: { steps: 0, semis: 0 },
  A1: { steps: 0, semis: 1 },
  m2: { steps: 1, semis: 1 },
  M2: { steps: 1, semis: 2 },
  m3: { steps: 2, semis: 3 },
  M3: { steps: 2, semis: 4 },
  P4: { steps: 3, semis: 5 },
  A4: { steps: 3, semis: 6 },
  d5: { steps: 4, semis: 6 },
  P5: { steps: 4, semis: 7 },
  m6: { steps: 5, semis: 8 },
  M6: { steps: 5, semis: 9 },
  d7: { steps: 6, semis: 9 },
  m7: { steps: 6, semis: 10 },
  M7: { steps: 6, semis: 11 },
} as const satisfies Record<string, Interval>;

export const invert = (iv: Interval): Interval => ({ steps: -iv.steps, semis: -iv.semis });

// Move a spelled note by a spelled interval. Keeps the spelling the interval implies,
// then falls back to a simpler enharmonic if the result needs a double accidental
// or lands on B♯, E♯, C♭ or F♭.
export function transpose(n: SpelledNote, iv: Interval, preferFlats = true): SpelledNote {
  const letter = mod(n.letter + iv.steps, 7);
  const targetPc = mod(pcOf(n) + iv.semis, 12);
  let acc = targetPc - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  const out = { letter, acc };
  return isAwkward(out) ? respell(targetPc, preferFlats) : out;
}

function isAwkward(n: SpelledNote): boolean {
  if (Math.abs(n.acc) >= 2) return true;
  if (n.acc === 1 && (n.letter === 2 || n.letter === 6)) return true; // E♯, B♯
  if (n.acc === -1 && (n.letter === 0 || n.letter === 3)) return true; // C♭, F♭
  return false;
}

// Simplest spelling of a pitch class.
export function respell(pc: number, preferFlats = true): SpelledNote {
  pc = mod(pc, 12);
  const natural = LETTER_PC.indexOf(pc);
  if (natural >= 0) return { letter: natural, acc: 0 };
  if (preferFlats) {
    const upper = LETTER_PC.indexOf(pc + 1);
    return { letter: upper, acc: -1 };
  }
  const lower = LETTER_PC.indexOf(pc - 1);
  return { letter: lower, acc: 1 };
}

export function sameNote(a: SpelledNote, b: SpelledNote): boolean {
  return pcOf(a) === pcOf(b);
}

// The spelled interval from a to b, with the semitone distance taken upward (0..11).
export function intervalBetween(a: SpelledNote, b: SpelledNote): Interval {
  return { steps: mod(b.letter - a.letter, 7), semis: mod(pcOf(b) - pcOf(a), 12) };
}

export function midiName(midi: number, preferFlats = true): string {
  const n = respell(mod(midi, 12), preferFlats);
  return `${noteName(n)}${Math.floor(midi / 12) - 1}`;
}
