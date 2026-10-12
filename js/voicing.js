// voicing.js — the two-layer voicing model from the document: a bass on the root in its own
// register, and an upper shape of three or four close-position notes inside a fixed window.
// The next chord takes the nearest shape, chosen by a cost over whole candidate shapes.

import { mod } from './theory.js';

export const WINDOW = { lo: 55, hi: 79, center: 65 }; // G3..G5, pulled toward F4

// Every rotation of the shape, at every octave that fits the window: roughly 8–12 candidates.
export function shapeCandidates(chord) {
  const pcs = [...new Set(chord.shape.map(i => mod(chord.root + i, 12)))];
  const out = [];
  for (const start of pcs) {
    const rel = pcs.map(p => mod(p - start, 12)).sort((a, b) => a - b);
    for (let base = WINDOW.lo; base <= WINDOW.hi; base++) {
      if (mod(base, 12) !== start) continue;
      const notes = rel.map(x => base + x);
      if (notes[notes.length - 1] <= WINDOW.hi) out.push(notes);
    }
  }
  return out;
}

// Total semitones moved, matching voices low to high.
export function movement(a, b) {
  const n = Math.min(a.length, b.length);
  let c = 0;
  for (let i = 0; i < n; i++) c += Math.abs(a[i] - b[i]);
  return c + Math.abs(a.length - b.length) * 3;
}

function shapeCost(notes, prev) {
  let c = 0;
  if (prev) {
    c += movement(prev, notes);
    const top = Math.abs(notes[notes.length - 1] - prev[prev.length - 1]);
    if (top > 2) c += (top - 2) * 1.5; // the top note is heard as a melody
  }
  const mid = (notes[0] + notes[notes.length - 1]) / 2;
  c += Math.abs(mid - WINDOW.center) * (prev ? 0.3 : 1); // pull toward center stops slow drift
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const iv = notes[j] - notes[i];
      if (iv === 13) c += 4; // minor 9th between two voices
      if (iv === 0) c += 6; // two voices on one note
      if (iv === 1) c += 2.5; // a semitone cluster inside the shape
      if (iv <= 2 && notes[j] < 60) c += 2; // close intervals low in the window
    }
  }
  return c;
}

export function bassFor(rootPc, prevBass) {
  const base = 36 + mod(rootPc, 12); // C2..B2
  if (prevBass == null) return base;
  const opts = [base - 12, base, base + 12].filter(n => n >= 31 && n <= 50);
  return opts.reduce((best, n) => (Math.abs(n - prevBass) < Math.abs(best - prevBass) ? n : best), opts[0]);
}

export function voiceNext(chord, prev) {
  let best = null, bestCost = Infinity;
  for (const notes of shapeCandidates(chord)) {
    const c = shapeCost(notes, prev ? prev.upper : null);
    if (c < bestCost) { bestCost = c; best = notes; }
  }
  return { bass: bassFor(chord.root, prev ? prev.bass : null), upper: best, cost: prev ? movement(prev.upper, best) : 0 };
}

export function voiceAll(chords) {
  const out = [];
  let prev = null;
  for (const ch of chords) { prev = voiceNext(ch, prev); out.push(prev); }
  return out;
}
