// theory.js — pitch classes, chord qualities, spelling, numerals, the skeletal palette,
// common motions, and move recipes. Everything is relative to a home pitch class.
// The content follows "Skeleton and Moves: A Catalogue of Chord Thinking".

export const mod = (n, m) => ((n % m) + m) % m;

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const KEYS = [
  { pc: 0, name: 'C', prefer: 'flat' }, { pc: 1, name: 'D♭', prefer: 'flat' }, { pc: 2, name: 'D', prefer: 'sharp' },
  { pc: 3, name: 'E♭', prefer: 'flat' }, { pc: 4, name: 'E', prefer: 'sharp' }, { pc: 5, name: 'F', prefer: 'flat' },
  { pc: 6, name: 'G♭', prefer: 'flat' }, { pc: 7, name: 'G', prefer: 'sharp' }, { pc: 8, name: 'A♭', prefer: 'flat' },
  { pc: 9, name: 'A', prefer: 'sharp' }, { pc: 10, name: 'B♭', prefer: 'flat' }, { pc: 11, name: 'B', prefer: 'sharp' },
];

export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_OFFSETS = new Set(MAJOR);

// Spell a root against home: natural degrees take the key's own accidentals, altered degrees
// are flats (the borrowed chords: ♭II, ♭III, ♭VI, ♭VII) unless a move asks for a sharp
// (leading-tone diminished chords, the Lydian ♯iv).
export function spellRoot(root, home, forceSharp = false) {
  root = mod(root, 12);
  if (forceSharp) return SHARP[root];
  const off = mod(root - home, 12);
  if (NATURAL_OFFSETS.has(off)) return (KEYS[home].prefer === 'sharp' ? SHARP : FLAT)[root];
  return FLAT[root];
}

// Spell a sounding pitch against the chord it belongs to: the letter comes from the chord's
// root letter plus the interval's degree, the accidental from the difference.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
export function pitchName(midi, chord) {
  const pc = mod(midi, 12);
  const rootLetter = LETTERS.indexOf(chord.name[0]);
  const iv = mod(pc - chord.root, 12);
  let steps = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][iv];
  if (iv === 9 && chord.quality === 'dim7') steps = 6; // the diminished 7th
  const letter = (rootLetter + steps) % 7;
  let acc = pc - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  const name = Math.abs(acc) <= 2 ? LETTERS[letter] + ACC[String(acc)] : FLAT[pc];
  return { name, octave: Math.floor(midi / 12) - 1 };
}

// Chord qualities. `core` is the identity of the chord (used for key distance and near-twins),
// `shape` is the default upper-hand shape per the voice-leading chapter: 3rd and 7th always,
// 9th in place of the root on major and minor chords (the default sound of the style).
export const QUALITIES = {
  maj7: { suffix: 'maj7', core: [0, 4, 7, 11], shape: [4, 7, 11, 14], minor: false, numeralSuffix: 'maj7' },
  m7: { suffix: 'm7', core: [0, 3, 7, 10], shape: [3, 7, 10, 14], minor: true, numeralSuffix: '7' },
  dom7: { suffix: '7', core: [0, 4, 7, 10], shape: [4, 7, 10, 14], minor: false, numeralSuffix: '7' },
  dom7b9: { suffix: '7♭9', core: [0, 1, 4, 7, 10], shape: [4, 7, 10, 13], minor: false, numeralSuffix: '7♭9' },
  hdim7: { suffix: 'ø7', core: [0, 3, 6, 10], shape: [0, 3, 6, 10], minor: true, numeralSuffix: 'ø7' },
  dim7: { suffix: 'dim7', core: [0, 3, 6, 9], shape: [0, 3, 6, 9], minor: true, numeralSuffix: '°7' },
};

export function makeChord(rootPc, quality, home, opts = {}) {
  const root = mod(rootPc, 12);
  const q = QUALITIES[quality];
  const forceSharp = !!opts.sharp || (mod(root - home, 12) === 6 && (quality === 'hdim7' || quality === 'dim7'));
  const pcs = q.core.map(i => mod(root + i, 12));
  const chord = {
    root, quality, pcs, home, forceSharp,
    key: `${root}:${quality}`,
    name: spellRoot(root, home, forceSharp) + q.suffix,
    shape: q.shape,
    minor: q.minor,
  };
  chord.numeral = numeral(chord, home);
  return chord;
}

export function shared(a, b) { return a.pcs.filter(p => b.pcs.includes(p)).length; }
export function nearTwin(a, b) { return a.key !== b.key && shared(a, b) >= 3; }

const DEGREES = [['I'], ['♭II', '♯I'], ['II'], ['♭III', '♯II'], ['III'], ['IV'], ['♭V', '♯IV'], ['V'], ['♭VI', '♯V'], ['VI'], ['♭VII', '♯VI'], ['VII']];

export function numeral(chord, home) {
  const off = mod(chord.root - home, 12);
  const alts = DEGREES[off];
  let deg = alts.length > 1 && chord.forceSharp ? alts[1] : alts[0];
  const q = QUALITIES[chord.quality];
  if (q.minor) deg = deg.replace(/[IV]+/, s => s.toLowerCase());
  return deg + q.numeralSuffix;
}

// ---- scale helpers ----
export function scaleSet(home) { return new Set(MAJOR.map(i => mod(home + i, 12))); }
export function outsideHome(chord, home) { const s = scaleSet(home); return chord.pcs.filter(p => !s.has(p)).length; }
export function degreeOf(pc, home) { return MAJOR.indexOf(mod(pc - home, 12)); }
const DIATONIC_Q = ['maj7', 'm7', 'm7', 'maj7', 'dom7', 'm7', 'hdim7'];
export function diatonicChord(degree, home) { const d = mod(degree, 7); return makeChord(home + MAJOR[d], DIATONIC_Q[d], home); }

// Planing condition 2: every note belongs to some parallel mode of home, which is the same as
// fitting inside one of the seven major scales that contain the home note.
export function inParallelMode(chord, home) {
  for (let k = 0; k < 12; k++) {
    const s = scaleSet(k);
    if (!s.has(home)) continue;
    if (chord.pcs.every(p => s.has(p))) return true;
  }
  return false;
}
// Planing condition 1: the home note stays alive as a chord tone or a color tone (9th or 13th).
export function keepsHome(chord, home) {
  const colors = [2, 9].map(i => mod(chord.root + i, 12));
  return chord.pcs.includes(home) || colors.includes(home);
}

// Position on the chain of fourths relative to home: +1 is a fifth up (brighter), −1 a fourth up (darker).
const FIFTHS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
export function fifthsIndex(pc, home) { return FIFTHS[mod(pc - home, 12)]; }

// Tension levels from the scoring chapter.
export function tensionLevel(chord, home, opts = {}) {
  if (chord.quality === 'dim7' || opts.tritone) return 3;
  const isDom = chord.quality === 'dom7' || chord.quality === 'dom7b9';
  if (isDom && mod(chord.root - home, 12) !== 7) return 2;
  return outsideHome(chord, home) === 0 ? 0 : 1;
}

// ---- the skeletal palette ----
// `off` is the root's offset from home. `row` places it in the space: 'sharp' (Lydian ♯iv and the
// secondary dominants, which add sharps), 'diatonic', 'minor' (parallel minor), 'modes' (Dorian,
// Mixolydian, Phrygian, blues). Secondary dominants are the promoted dominant moves the examples
// use at skeletal weight (V of vi, V of ii, V of V, V of iii, and I7 as V of IV).
export const SKELETAL = [
  { id: 'Imaj7', off: 0, q: 'maj7', row: 'diatonic', start: true, fit: 'Home. It can go anywhere, and it is reached from V7, IV, iv, ♭VI, or ♭VII.' },
  { id: 'ii7', off: 2, q: 'm7', row: 'diatonic', start: true, fit: 'Soft subdominant and a common starting chord. Leads to V7 or steps up to iii. Near-twin of IV.' },
  { id: 'iii7', off: 4, q: 'm7', row: 'diatonic', fit: 'A lighter stand-in for I. Falls to vi, or steps to IV or ii.' },
  { id: 'IVmaj7', off: 5, q: 'maj7', row: 'diatonic', start: true, fit: 'Subdominant and a common starting chord. Goes to V7, back to I, or turns minor (iv).' },
  { id: 'V7', off: 7, q: 'dom7', row: 'diatonic', fit: 'Dominant of home. Resolves to I, or deceptively to vi.' },
  { id: 'vi7', off: 9, q: 'm7', row: 'diatonic', start: true, fit: 'The relative minor and a second possible home. Near-twin of I. A common starting chord.' },
  { id: 'viiø7', off: 11, q: 'hdim7', row: 'diatonic', fit: 'Rarely a resting chord. It works as the ii of vi: viiø7, III7, vi7.' },

  { id: 'i7', off: 0, q: 'm7', row: 'minor', fit: 'Home turned minor for a moment. Opens the way to the other borrowed chords.' },
  { id: 'iiø7', off: 2, q: 'hdim7', row: 'minor', fit: 'The minor-key ii. Pairs with iv and leads to V7.' },
  { id: '♭IIImaj7', off: 3, q: 'maj7', row: 'minor', fit: 'Goes to IV, ♭VI, or iv. The first chord of ♭III, IV, I.' },
  { id: 'iv7', off: 5, q: 'm7', row: 'minor', fit: 'Minor plagal. Usually follows IV and resolves to I, with the ♭6 falling to the 5th.' },
  { id: '♭VImaj7', off: 8, q: 'maj7', row: 'minor', fit: 'Near-twin of iv, and it shares the root and 5th with home. The first chord of ♭VI, ♭VII, I.' },
  { id: '♭VII7', off: 10, q: 'dom7', row: 'minor', fit: 'The backdoor dominant. Resolves up a whole step to I.' },

  { id: 'v7', off: 7, q: 'm7', row: 'modes', source: 'Mixolydian', fit: 'The ii of IV. Pairs with I7 to point at IV.' },
  { id: 'I7', off: 0, q: 'dom7', row: 'modes', source: 'Mixolydian, blues', fit: 'Home turned dominant: the V7 of IV. Follows v7 to point at IV.' },
  { id: '♭VIImaj7', off: 10, q: 'maj7', row: 'modes', source: 'Dorian, Mixolydian', fit: 'The IV of IV. A softer ♭VII with no dominant pull.' },
  { id: '♭IImaj7', off: 1, q: 'maj7', row: 'modes', source: 'Phrygian', fit: 'Sits a half step above home. Slides down to I or slips around ii.' },
  { id: 'IV7', off: 5, q: 'dom7', row: 'modes', source: 'Dorian, blues', fit: 'The blues IV. Returns to I or drops a half step to V7 of vi.' },

  { id: '♯ivø7', off: 6, q: 'hdim7', row: 'sharp', source: 'Lydian', fit: 'Descends by half step to IV, or works as the ii of iii.' },
  { id: 'VII7', off: 11, q: 'dom7', row: 'sharp', fit: 'V7 of iii, promoted. Promises iii and can land deceptively on V or I.' },
  { id: 'III7', off: 4, q: 'dom7', row: 'sharp', fit: 'V7 of vi, promoted. The most common promoted dominant in the examples. Lands on vi, or deceptively on I or IV.' },
  { id: 'VI7', off: 9, q: 'dom7', row: 'sharp', fit: 'V7 of ii, promoted. Lands on ii, or deceptively on IV.' },
  { id: 'II7', off: 2, q: 'dom7', row: 'sharp', fit: 'V7 of V, promoted. Lands on V, or deceptively on iii.' },
];

export const ROWS = {
  sharp: { label: 'Sharp side', sub: 'Lydian ♯iv and promoted secondary dominants' },
  diatonic: { label: 'Diatonic', sub: 'The seven chords of home' },
  minor: { label: 'Parallel minor', sub: 'Borrowed from the minor key on the same root' },
  modes: { label: 'Other modes', sub: 'Dorian, Mixolydian, Phrygian, blues' },
};

export function buildPalette(home) {
  return SKELETAL.map(s => {
    const chord = makeChord(home + s.off, s.q, home);
    return { ...s, chord, tension: tensionLevel(chord, home), start: !!s.start };
  });
}

// ---- common motions between skeletal chords (from the "How it fits" column) ----
// [from, to, strength, note]. Strengths are the catalogue's starting guesses.
const MOTIONS = [
  ['Imaj7', 'ii7', 0.6], ['Imaj7', 'iii7', 0.5], ['Imaj7', 'IVmaj7', 0.7], ['Imaj7', 'V7', 0.6], ['Imaj7', 'vi7', 0.6],
  ['Imaj7', 'III7', 0.6], ['Imaj7', 'I7', 0.5], ['Imaj7', 'i7', 0.5], ['Imaj7', '♭VIImaj7', 0.5], ['Imaj7', '♭IIImaj7', 0.5],

  ['ii7', 'V7', 1.0], ['ii7', 'iii7', 0.6], ['ii7', 'Imaj7', 0.4], ['ii7', 'II7', 0.4, 'quality flip'],
  ['iii7', 'vi7', 0.8], ['iii7', 'IVmaj7', 0.6], ['iii7', 'ii7', 0.6], ['iii7', 'VI7', 0.5],
  ['IVmaj7', 'V7', 0.9], ['IVmaj7', 'Imaj7', 0.7], ['IVmaj7', 'iv7', 0.8, 'quality flip'], ['IVmaj7', 'iii7', 0.5], ['IVmaj7', 'ii7', 0.5], ['IVmaj7', '♭VII7', 0.5],
  ['V7', 'Imaj7', 1.0], ['V7', 'vi7', 0.7, 'deceptive'],
  ['vi7', 'ii7', 0.7], ['vi7', 'IVmaj7', 0.6], ['vi7', 'V7', 0.5], ['vi7', 'iv7', 0.5], ['vi7', 'v7', 0.5], ['vi7', 'iii7', 0.4], ['vi7', 'VI7', 0.5, 'quality flip'],
  ['viiø7', 'III7', 1.0, 'ii of vi'], ['viiø7', 'Imaj7', 0.5], ['viiø7', 'vi7', 0.4],

  ['i7', 'iiø7', 0.6], ['i7', '♭IIImaj7', 0.6], ['i7', 'iv7', 0.6], ['i7', '♭VImaj7', 0.6], ['i7', '♭VII7', 0.6], ['i7', 'IVmaj7', 0.4], ['i7', 'v7', 0.4],
  ['iiø7', 'V7', 1.0], ['iiø7', 'iv7', 0.6], ['iiø7', 'Imaj7', 0.4],
  ['♭IIImaj7', 'IVmaj7', 0.8], ['♭IIImaj7', '♭VImaj7', 0.7], ['♭IIImaj7', 'iv7', 0.6], ['♭IIImaj7', 'ii7', 0.5, 'slide'], ['♭IIImaj7', 'Imaj7', 0.4],
  ['iv7', 'Imaj7', 0.9], ['iv7', 'V7', 0.6], ['iv7', '♭VII7', 0.5], ['iv7', '♭VImaj7', 0.5],
  ['♭VImaj7', '♭VII7', 0.8], ['♭VImaj7', '♭VIImaj7', 0.7], ['♭VImaj7', 'Imaj7', 0.7], ['♭VImaj7', 'V7', 0.5], ['♭VImaj7', 'iv7', 0.4],
  ['♭VII7', 'Imaj7', 0.9, 'backdoor'], ['♭VII7', 'vi7', 0.4],

  ['v7', 'I7', 0.9, 'ii–V into IV'], ['v7', 'IVmaj7', 0.5], ['v7', 'Imaj7', 0.4],
  ['I7', 'IVmaj7', 1.0], ['I7', 'iv7', 0.6], ['I7', 'ii7', 0.6, 'deceptive'], ['I7', 'IV7', 0.6],
  ['♭VIImaj7', 'Imaj7', 0.7], ['♭VIImaj7', 'IVmaj7', 0.6], ['♭VIImaj7', '♭VImaj7', 0.6], ['♭VIImaj7', '♭IIImaj7', 0.5], ['♭VIImaj7', 'vi7', 0.5, 'slide'],
  ['♭IImaj7', 'Imaj7', 0.8], ['♭IImaj7', 'ii7', 0.6], ['♭IImaj7', 'i7', 0.5],
  ['♯ivø7', 'VII7', 1.0, 'ii of iii'], ['♯ivø7', 'IVmaj7', 0.8], ['♯ivø7', 'iii7', 0.5],
  ['IV7', 'Imaj7', 0.8], ['IV7', 'III7', 0.7], ['IV7', 'IVmaj7', 0.5],

  ['III7', 'vi7', 1.0], ['III7', 'Imaj7', 0.6, 'deceptive'], ['III7', 'IVmaj7', 0.6, 'deceptive'], ['III7', 'VI7', 0.7, 'chain'], ['III7', 'iv7', 0.4],
  ['VI7', 'ii7', 1.0], ['VI7', 'IVmaj7', 0.6, 'deceptive'], ['VI7', 'iiø7', 0.6], ['VI7', 'II7', 0.7, 'chain'],
  ['II7', 'V7', 1.0], ['II7', 'iii7', 0.6, 'deceptive'],
  ['VII7', 'iii7', 1.0], ['VII7', 'V7', 0.6, 'deceptive'], ['VII7', 'Imaj7', 0.5, 'deceptive'], ['VII7', 'III7', 0.7, 'chain'],
];
const MOTION_MAP = new Map(MOTIONS.map(([f, t, s, n]) => [`${f}>${t}`, { strength: s, note: n }]));

export function pairing(fromId, toId) {
  const m = MOTION_MAP.get(`${fromId}>${toId}`);
  if (m) return m;
  if (fromId === 'Imaj7') return { strength: 0.5, note: 'home can go anywhere' };
  return null;
}

// ---- moves ----
export const MOVE_TYPES = {
  dominant: { name: 'Dominant', strength: 1.0, blurb: 'The V7 of the landing.' },
  iiV: { name: 'ii–V', strength: 1.0, blurb: 'The related ii, then the V7. Into a minor landing: iiø7, then V7♭9.' },
  tritone: { name: 'Tritone sub', strength: 0.8, blurb: 'A dominant 7th a half step above the landing.' },
  dim: { name: 'Diminished', strength: 0.8, blurb: 'A diminished 7th a half step below: the landing\'s V7♭9 without its root.' },
  walk: { name: 'Diatonic walk', strength: 0.7, blurb: 'The scale chords stepping from jumpoff to landing.' },
  passing: { name: 'Chromatic passing', strength: 0.7, blurb: 'The chord between two roots a whole step apart.' },
  backdoor: { name: 'Backdoor', strength: 0.7, blurb: 'A dominant 7th a whole step below. Strongest into a major landing.' },
  plagal: { name: 'Plagal', strength: 0.6, blurb: 'The IV or iv of the landing. The minor form needs a major landing.' },
  slide: { name: 'Slide', strength: 0.6, blurb: 'The same quality, or a major 7th, a half step above or below.' },
  preecho: { name: 'Pre-echo', strength: 0.5, blurb: 'The landing\'s near-twin, played just before it.' },
};

function isMajorLanding(ch) { return ch.quality === 'maj7' || ch.quality === 'dom7' || ch.quality === 'dom7b9'; }

// Generate every move the catalogue offers into `landing`, optionally from `jumpoff`.
// `palette` supplies near-twins for the pre-echo. Returns [{type, name, strength, chords, labels, landing}].
export function movesInto(landing, jumpoff, home, palette) {
  const r = landing.root;
  const L = landing.name;
  const mk = (root, q, opts) => makeChord(root, q, home, opts);
  const out = [];
  const add = (type, chords, labels, strength, opts = {}) => {
    if (chords.some(c => c.key === landing.key)) return;
    if (jumpoff && chords[0].key === jumpoff.key) return; // the move would start on the chord already there
    out.push({ type, name: MOVE_TYPES[type].name, strength: strength ?? MOVE_TYPES[type].strength, chords, labels, landing, landingKey: landing.key, ...opts });
  };
  const major = isMajorLanding(landing);

  add('dominant', [mk(r + 7, 'dom7')], [`V7 of ${L}`]);
  if (major) add('iiV', [mk(r + 2, 'm7'), mk(r + 7, 'dom7')], [`ii of ${L}`, `V7 of ${L}`]);
  else add('iiV', [mk(r + 2, 'hdim7'), mk(r + 7, 'dom7b9')], [`iiø7 of ${L}`, `V7♭9 of ${L}`]);
  add('tritone', [mk(r + 1, 'dom7')], [`tritone sub into ${L}`], undefined, { tritone: true });
  add('dim', [mk(r - 1, 'dim7', { sharp: true })], [`vii°7 of ${L}`]);
  add('backdoor', [mk(r - 2, 'dom7')], [`backdoor into ${L}`], major ? 0.7 : 0.4);
  if (major) {
    add('plagal', [mk(r + 5, 'maj7')], [`IV of ${L}`]);
    add('plagal', [mk(r + 5, 'm7')], [`iv of ${L}`]);
  } else {
    add('plagal', [mk(r + 5, 'm7')], [`iv of ${L}`]);
  }
  add('slide', [mk(r + 1, landing.quality)], [`slide from above into ${L}`]);
  add('slide', [mk(r - 1, landing.quality)], [`slide from below into ${L}`]);
  if (landing.quality !== 'maj7') add('slide', [mk(r + 1, 'maj7')], [`slide from above into ${L}`]);

  if (jumpoff) {
    const dJ = degreeOf(jumpoff.root, home), dL = degreeOf(r, home);
    if (dJ >= 0 && dL >= 0 && dJ !== dL) {
      const up = mod(dL - dJ, 7), down = mod(dJ - dL, 7);
      let degrees = null;
      if (up === 2 || up === 3) degrees = Array.from({ length: up - 1 }, (_, i) => dJ + 1 + i);
      else if (down === 2 || down === 3) degrees = Array.from({ length: down - 1 }, (_, i) => dJ - 1 - i);
      if (degrees) {
        const chords = degrees.map(d => diatonicChord(d, home));
        add('walk', chords, chords.map(() => `walk from ${jumpoff.name} to ${L}`));
      }
    }
    const diff = mod(r - jumpoff.root, 12);
    if (diff === 2 || diff === 10) {
      const ascending = diff === 2;
      add('passing', [mk(jumpoff.root + (ascending ? 1 : -1), 'dim7', { sharp: ascending })], [`passing between ${jumpoff.name} and ${L}`]);
    }
  }

  if (palette) {
    for (const p of palette) {
      // the near-twins worth pre-echoing are the relative major/minor pairs, not dominants
      if (p.chord.quality !== 'maj7' && p.chord.quality !== 'm7') continue;
      if (!nearTwin(p.chord, landing)) continue;
      if (jumpoff && p.chord.key === jumpoff.key) continue;
      add('preecho', [p.chord], [`pre-echo of ${L}`]);
    }
  }

  // Dedupe by the chords produced, keeping the stronger reading.
  const seen = new Map();
  for (const m of out) {
    const k = m.chords.map(c => c.key).join('|');
    if (!seen.has(k) || seen.get(k).strength < m.strength) seen.set(k, m);
  }
  return [...seen.values()].sort((a, b) => b.strength - a.strength);
}
