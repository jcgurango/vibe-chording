// scoring.js — the eight dimensions from the document, minus Room (no rhythm yet).
// A candidate (a skeletal chord or a move) is scored for a gap: a left neighbor that always
// exists, and a right neighbor that may not (the open end of the sequence). When only the left
// neighbor is known, left fit takes over the weight of right fit.

import { outsideHome, nearTwin, tensionLevel, keepsHome, inParallelMode, pairing, mod, MAJOR } from './theory.js';
import { voiceNext, movement } from './voicing.js';

export const WEIGHTS = { right: 3, left: 2, smooth: 2, tension: 1, distance: 1, pattern: 1, variety: 1 };
export const WEIGHTS_OPEN = { left: 3, smooth: 2, tension: 1, distance: 1, pattern: 1, variety: 1 };
export const DIM_LABELS = {
  right: 'Right fit', left: 'Left fit', smooth: 'Smoothness', tension: 'Tension fit',
  distance: 'Distance from home', pattern: 'Pattern', variety: 'Variety',
};
const clamp01 = x => Math.max(0, Math.min(1, x));
const smoothFromCost = c => clamp01(1 - c / 14);
const UNLISTED = 0.75; // cap for fits that only smoothness can vouch for

// Strength of the link from one chord to the next, where the catalogue has an answer.
// Both arguments are instances: { chord, skeletalId?, move? }. Returns {strength, note} or null.
export function link(from, to) {
  if (from.move) {
    if (to.chord.key === from.move.landingKey) return { strength: from.move.strength, note: `${from.move.name} lands` };
    if (nearTwin(to.chord, from.move.landing)) return { strength: from.move.strength * 0.6, note: 'deceptive landing' };
  }
  if (from.skeletalId && to.skeletalId) return pairing(from.skeletalId, to.skeletalId);
  return null;
}

function distanceScore(outside, dial) {
  const frac = Math.min(outside, 4) / 4;
  return 0.5 - dial * (0.5 - frac); // dial −1: 1−frac (stay home); +1: frac (wander); 0: neutral
}

// `before` is the sequence up to and including the left neighbor.
function patternScore(chord, before, home) {
  if (before.length < 2) return 0.5;
  const a = before[before.length - 2].chord, b = before[before.length - 1].chord;
  if (a.quality !== b.quality) return 0.5; // no pattern under way
  if (chord.quality !== a.quality) return 0.4;
  const ivAB = mod(b.root - a.root, 12), ivBC = mod(chord.root - b.root, 12);
  const scale = new Set(MAJOR.map(i => mod(home + i, 12)));
  const penta = new Set([0, 3, 5, 7, 10].map(i => mod(home + i, 12)));
  const roots = [a.root, b.root, chord.root];
  let base;
  if (ivAB === ivBC && ivAB !== 0) base = 1.0; // a chain of one interval
  else if (roots.every(p => scale.has(p)) || roots.every(p => penta.has(p))) base = 0.85;
  else return 0.7;
  const conditions = (keepsHome(chord, home) ? 1 : 0) + (inParallelMode(chord, home) ? 1 : 0);
  return base * (0.6 + 0.2 * conditions);
}

export function weightsFor(hasRight) { return hasRight ? WEIGHTS : WEIGHTS_OPEN; }
function total(dims, hasRight) {
  const w = weightsFor(hasRight);
  let sum = 0, wsum = 0;
  for (const k in w) { sum += dims[k] * w[k]; wsum += w[k]; }
  return sum / wsum;
}

const noteFor = (k, zero) => (zero ? 'a repeat, not a motion' : k ? k.note : 'unlisted pairing, judged by smoothness');

// ctx: { home, left, right|null, before, dial, prevGapMoveType }
export function scoreChord(cand, ctx) {
  const { home, left, right, before, dial } = ctx;
  const vX = voiceNext(cand.chord, left.voicing);
  const costL = movement(left.voicing.upper, vX.upper);
  const smoothL = smoothFromCost(costL);
  const lk = link(left, cand);
  let l = lk ? lk.strength : smoothL * UNLISTED;
  if (cand.chord.key === left.chord.key) l = 0;
  let r = null, rk = null, smoothR = null, costR = null;
  if (right) {
    const vR = voiceNext(right.chord, vX);
    costR = movement(vX.upper, vR.upper);
    smoothR = smoothFromCost(costR);
    rk = link(cand, right);
    r = rk ? rk.strength : smoothR * UNLISTED;
    if (cand.chord.key === right.chord.key) r = 0;
  }
  const level = tensionLevel(cand.chord, home);
  const outside = outsideHome(cand.chord, home);
  let variety = 1;
  if (cand.chord.key === left.chord.key || (right && cand.chord.key === right.chord.key)) variety = 0;
  const dims = {
    left: l,
    smooth: right ? (smoothL + smoothR) / 2 : smoothL,
    tension: 1 - level * 0.25,
    distance: distanceScore(outside, dial),
    pattern: patternScore(cand.chord, before, home),
    variety,
  };
  if (right) dims.right = r;
  return {
    total: total(dims, !!right), dims, voicing: vX, costL, costR, level, outside,
    notes: { left: noteFor(lk, l === 0), right: right ? noteFor(rk, r === 0) : null },
  };
}

// A move into ctx.right from ctx.left. Right fit is the recipe's strength; left fit comes from
// the move's first chord; the links inside the move are guaranteed by the recipe.
export function scoreMove(move, ctx) {
  const { home, left, right, before, dial } = ctx;
  const voicings = [];
  let prev = left.voicing;
  for (const ch of move.chords) { prev = voiceNext(ch, prev); voicings.push(prev); }
  const costL = movement(left.voicing.upper, voicings[0].upper);
  const smoothL = smoothFromCost(costL);
  let smoothR = smoothL, costR = null;
  if (right) {
    const vR = voiceNext(right.chord, prev);
    costR = movement(prev.upper, vR.upper);
    smoothR = smoothFromCost(costR);
  }
  const firstInst = { chord: move.chords[0], skeletalId: ctx.skeletalIdFor(move.chords[0]) };
  const lk = link(left, firstInst);
  const level = Math.max(...move.chords.map(c => tensionLevel(c, home, { tritone: move.tritone })));
  const outside = Math.max(...move.chords.map(c => outsideHome(c, home)));
  let variety = ctx.prevGapMoveType === move.type ? 0.5 : 1;
  if (move.chords[0].key === left.chord.key) variety = 0;
  const dims = {
    right: move.strength,
    left: lk ? lk.strength : smoothL * UNLISTED,
    smooth: (smoothL + smoothR) / 2,
    tension: 1 - level * 0.25,
    distance: distanceScore(outside, dial),
    pattern: patternScore(move.chords[0], before, home),
    variety,
  };
  return { total: total(dims, true), dims, voicings, costL, costR, level, outside, notes: { left: noteFor(lk, false), right: `${move.name} recipe` } };
}
