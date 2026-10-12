'use strict';
/*
 * Theory engine.
 *  - Every chord is a 7th chord (Principle 1).
 *  - The palette is built around a key: diatonic, parallel minor, secondary
 *    dominants + related iis, tritone subs, backdoor (iv -> bVII -> I), the
 *    Mixolydian bVIImaj7, sus dominants, chromatic passing chords.
 *  - Principle 3 decides whether chord B may follow chord A:
 *      common tones | chromatic step-wise motion | strong root motion.
 *  - Non-diatonic chords with no Principle-3 entry from a diatonic chord or
 *    no exit into one are trimmed from the palette.
 */
const Theory = (() => {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const SHARP_LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const FLAT_LETTER  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];

  const KEYS = [
    { name: 'C', pc: 0, letter: 0 },  { name: 'D♭', pc: 1, letter: 1 },
    { name: 'D', pc: 2, letter: 1 },  { name: 'E♭', pc: 3, letter: 2 },
    { name: 'E', pc: 4, letter: 2 },  { name: 'F', pc: 5, letter: 3 },
    { name: 'G♭', pc: 6, letter: 4 }, { name: 'G', pc: 7, letter: 4 },
    { name: 'A♭', pc: 8, letter: 5 }, { name: 'A', pc: 9, letter: 5 },
    { name: 'B♭', pc: 10, letter: 6 }, { name: 'B', pc: 11, letter: 6 },
  ];

  // Semitone structure of each quality. `free` lists what may fill the third
  // upper voice (Principle 2): 3rd and 7th are mandatory, the remaining voice
  // is the 5th, the root, the 9th or the 11th - chosen by voice leading.
  const ALL_FREE = ['fifth', 'root', 'ninth', 'eleventh'];
  const QUALITIES = {
    maj7: { label: 'maj7',  third: 4, fifth: 7, seventh: 11, free: ALL_FREE },
    m7:   { label: 'm7',    third: 3, fifth: 7, seventh: 10, free: ALL_FREE },
    dom7: { label: '7',     third: 4, fifth: 7, seventh: 10, free: ALL_FREE },
    m7b5: { label: 'ø7',    third: 3, fifth: 6, seventh: 10, free: ALL_FREE },
    dim7: { label: '°7',    third: 3, fifth: 6, seventh: 9,  free: ALL_FREE },
    // the suspended 4th stands in for the 3rd, so the 11th is not on offer
    sus7: { label: '7sus4', third: 5, fifth: 7, seventh: 10, free: ['fifth', 'root', 'ninth'] },
  };
  const EXT = { ninth: 2, eleventh: 5 };
  // letter steps above the root for spelling
  const STEPS = { root: 0, third: 2, fifth: 4, seventh: 6, ninth: 1, eleventh: 3 };

  function freeOffset(quality, name) {
    if (name === 'root') return 0;
    if (name === 'fifth') return QUALITIES[quality].fifth;
    return EXT[name];
  }

  const CATEGORIES = {
    diatonic:  'Diatonic',
    minor:     'Parallel minor',
    secondary: 'Secondary dominants & related ii',
    tritone:   'Tritone substitutions',
    sus:       'Sus dominants',
    passing:   'Chromatic passing',
  };

  const P = (id, deg, acc, quality, roman, cat, role) => ({ id, deg, acc, quality, roman, cat, role });
  const PALETTE = [
    // diatonic
    P('I',   1, 0, 'maj7', 'Imaj7',  'diatonic', 'tonic'),
    P('ii',  2, 0, 'm7',   'ii7',    'diatonic', 'supertonic'),
    P('iii', 3, 0, 'm7',   'iii7',   'diatonic', 'mediant'),
    P('IV',  4, 0, 'maj7', 'IVmaj7', 'diatonic', 'subdominant'),
    P('V',   5, 0, 'dom7', 'V7',     'diatonic', 'dominant'),
    P('vi',  6, 0, 'm7',   'vi7',    'diatonic', 'submediant · related ii of V7/V'),
    P('vii', 7, 0, 'm7b5', 'viiø7',  'diatonic', 'leading tone · related ii of V7/vi'),
    // parallel minor
    P('i',    1,  0, 'm7',   'i7',       'minor', 'parallel-minor tonic'),
    P('iio',  2,  0, 'm7b5', 'iiø7',     'minor', 'parallel-minor ii'),
    P('bIII', 3, -1, 'maj7', '♭IIImaj7', 'minor', 'parallel-minor mediant'),
    P('iv',   4,  0, 'm7',   'iv7',      'minor', 'minor iv · backdoor entry'),
    P('v',    5,  0, 'm7',   'v7',       'minor', 'minor v · related ii of V7/IV'),
    P('bVI',  6, -1, 'maj7', '♭VImaj7',  'minor', 'parallel-minor submediant'),
    P('bVII', 7, -1, 'dom7', '♭VII7',    'minor', 'backdoor dominant · tritone sub of V7/vi'),
    P('bVIImaj', 7, -1, 'maj7', '♭VIImaj7', 'minor', 'borrowed from Mixolydian'),
    // secondary dominants
    P('V/ii',  6, 0, 'dom7', 'VI7',  'secondary', 'V7 of ii'),
    P('V/iii', 7, 0, 'dom7', 'VII7', 'secondary', 'V7 of iii'),
    P('V/IV',  1, 0, 'dom7', 'I7',   'secondary', 'V7 of IV'),
    P('V/V',   2, 0, 'dom7', 'II7',  'secondary', 'V7 of V'),
    P('V/vi',  3, 0, 'dom7', 'III7', 'secondary', 'V7 of vi'),
    // related iis that are not already diatonic / borrowed
    P('ii/ii',  3, 0, 'm7b5', 'iiiø7', 'secondary', 'related ii of V7/ii'),
    P('ii/iii', 4, 1, 'm7b5', '♯ivø7', 'secondary', 'related ii of V7/iii'),
    // tritone substitutions (sub of V7/vi is ♭VII7, already above)
    P('subV',     2, -1, 'dom7', '♭II7',  'tritone', 'tritone sub of V7'),
    P('subV/ii',  3, -1, 'dom7', '♭III7', 'tritone', 'tritone sub of V7/ii'),
    P('subV/iii', 4,  0, 'dom7', 'IV7',   'tritone', 'tritone sub of V7/iii'),
    P('subV/IV',  5, -1, 'dom7', '♭V7',   'tritone', 'tritone sub of V7/IV'),
    P('subV/V',   6, -1, 'dom7', '♭VI7',  'tritone', 'tritone sub of V7/V'),
    // sus dominants
    P('Vsus',     5, 0, 'sus7', 'V7sus4',   'sus', 'suspended V7'),
    P('V/ii sus', 6, 0, 'sus7', 'VI7sus4',  'sus', 'suspended V7/ii'),
    P('V/iii sus',7, 0, 'sus7', 'VII7sus4', 'sus', 'suspended V7/iii'),
    P('V/IV sus', 1, 0, 'sus7', 'I7sus4',   'sus', 'suspended V7/IV'),
    P('V/V sus',  2, 0, 'sus7', 'II7sus4',  'sus', 'suspended V7/V'),
    P('V/vi sus', 3, 0, 'sus7', 'III7sus4', 'sus', 'suspended V7/vi'),
    // chromatic passing chords
    P('#io',  1, 1, 'dim7', '♯i°7',  'passing', 'passing between I and ii'),
    P('#iio', 2, 1, 'dim7', '♯ii°7', 'passing', 'passing between ii and iii'),
    P('#ivo', 4, 1, 'dim7', '♯iv°7', 'passing', 'passing between IV and V'),
    P('#vo',  5, 1, 'dim7', '♯v°7',  'passing', 'passing between V and vi'),
  ];

  // Named moves: the constellation lines drawn on the map. Each is still
  // subject to Principle 3; a move that fails the active rules is not drawn.
  const MOVES = [
    // diatonic
    ['I', 'ii'], ['I', 'iii'], ['I', 'IV'], ['I', 'V'], ['I', 'vi'],
    ['ii', 'V'], ['ii', 'iii'], ['ii', 'vii'],
    ['iii', 'vi'], ['iii', 'IV'], ['iii', 'ii'],
    ['IV', 'V'], ['IV', 'I'], ['IV', 'ii'], ['IV', 'vii'],
    ['V', 'I'], ['V', 'vi'], ['V', 'IV'],
    ['vi', 'ii'], ['vi', 'IV'], ['vi', 'V'],
    ['vii', 'I'], ['vii', 'iii'],
    // parallel minor
    ['I', 'iv'], ['I', 'bVI'], ['I', 'i'], ['vi', 'iv'],
    ['i', 'iv'], ['i', 'bVI'], ['i', 'iio'], ['i', 'bIII'],
    ['iio', 'V'], ['iio', 'i'],
    ['bIII', 'bVI'], ['bIII', 'iv'],
    ['iv', 'I'], ['iv', 'bVII'], ['iv', 'V'], ['iv', 'i'],
    ['v', 'iv'], ['v', 'V/IV'],
    ['bVI', 'bVII'], ['bVI', 'V'], ['bVI', 'iio'],
    ['bVII', 'I'], ['bVII', 'vi'],
    ['I', 'bVIImaj'], ['bVIImaj', 'IV'], ['IV', 'bVIImaj'], ['bVIImaj', 'I'],
    // secondary dominants and their related iis
    ['V/ii', 'ii'], ['V/iii', 'iii'], ['V/IV', 'IV'], ['V/V', 'V'], ['V/vi', 'vi'],
    ['I', 'V/IV'], ['I', 'V/ii'], ['I', 'V/V'], ['I', 'V/vi'], ['vi', 'V/ii'], ['iii', 'V/ii'],
    ['ii/ii', 'V/ii'], ['ii/iii', 'V/iii'], ['v', 'V/IV'], ['vi', 'V/V'], ['vii', 'V/vi'],
    ['I', 'ii/ii'], ['I', 'ii/iii'], ['I', 'v'], ['IV', 'ii/iii'],
    // tritone subs
    ['subV', 'I'], ['subV/ii', 'ii'], ['subV/iii', 'iii'], ['subV/IV', 'IV'], ['subV/V', 'V'],
    ['ii', 'subV'], ['ii/ii', 'subV/ii'], ['ii/iii', 'subV/iii'], ['v', 'subV/IV'], ['vi', 'subV/V'], ['vii', 'bVII'],
    // sus dominants
    ['Vsus', 'V'], ['Vsus', 'I'], ['ii', 'Vsus'], ['I', 'Vsus'], ['IV', 'Vsus'],
    ['V/ii sus', 'V/ii'], ['V/ii sus', 'ii'], ['ii/ii', 'V/ii sus'],
    ['V/iii sus', 'V/iii'], ['V/iii sus', 'iii'], ['ii/iii', 'V/iii sus'],
    ['V/IV sus', 'V/IV'], ['V/IV sus', 'IV'], ['I', 'V/IV sus'],
    ['V/V sus', 'V/V'], ['V/V sus', 'V'], ['vi', 'V/V sus'],
    ['V/vi sus', 'V/vi'], ['V/vi sus', 'vi'], ['vii', 'V/vi sus'],
    // chromatic passing
    ['I', '#io'], ['#io', 'ii'], ['ii', '#io'], ['#io', 'I'],
    ['ii', '#iio'], ['#iio', 'iii'], ['iii', '#iio'], ['#iio', 'ii'],
    ['IV', '#ivo'], ['#ivo', 'V'], ['#ivo', 'I'], ['V', '#ivo'], ['#ivo', 'IV'],
    ['V', '#vo'], ['#vo', 'vi'], ['vi', '#vo'], ['#vo', 'V'],
  ];

  const mod12 = (n) => ((n % 12) + 12) % 12;

  // Spell a letter + accidental for a pitch class, given the letter it must use.
  function spellLetter(letterIdx, pc) {
    const natural = MAJOR[letterIdx];
    let diff = mod12(pc - natural);
    if (diff > 6) diff -= 12;
    return { name: LETTERS[letterIdx] + (ACC[String(diff)] ?? '?'), letter: letterIdx, acc: diff };
  }

  // Spell a bare pitch class the way the key prefers (sharps in sharp keys).
  function spellInKey(pc, key) {
    const sharp = [7, 2, 9, 4, 11].includes(key.pc);
    return spellLetter((sharp ? SHARP_LETTER : FLAT_LETTER)[pc], pc);
  }

  // Build the concrete palette for a key: names, pitch classes, spellings.
  function buildPalette(key) {
    return PALETTE.map((p) => {
      const q = QUALITIES[p.quality];
      const rootPc = mod12(key.pc + MAJOR[p.deg - 1] + p.acc);
      const rootLetter = (key.letter + p.deg - 1) % 7;
      const root = spellLetter(rootLetter, rootPc);
      const toneName = (fn) => {
        const off = fn === 'third' ? q.third : fn === 'seventh' ? q.seventh : freeOffset(p.quality, fn);
        return spellLetter((rootLetter + STEPS[fn]) % 7, mod12(rootPc + off));
      };
      const tones = { root, third: toneName('third'), fifth: toneName('fifth'), seventh: toneName('seventh'),
        ninth: toneName('ninth'), eleventh: toneName('eleventh') };
      // pitch class -> spelled name, for any note the voice leading may produce
      const spelling = {};
      for (const fn of ['root', 'third', 'fifth', 'seventh', 'ninth', 'eleventh']) {
        const off = fn === 'third' ? q.third : fn === 'seventh' ? q.seventh : freeOffset(p.quality, fn);
        spelling[mod12(rootPc + off)] = tones[fn];
      }
      return {
        ...p,
        rootPc,
        name: root.name + q.label,
        pcs: [rootPc, mod12(rootPc + q.third), mod12(rootPc + q.fifth), mod12(rootPc + q.seventh)],
        tones,
        spelling,
        catLabel: CATEGORIES[p.cat],
      };
    });
  }

  const pcDist = (a, b) => { const d = mod12(a - b); return Math.min(d, 12 - d); };

  // Smallest possible "largest voice displacement" when mapping pc-set A onto
  // pc-set B one-to-one. 1 means every voice holds or moves a half step.
  function minMaxDisplacement(a, b) {
    const n = b.length; let best = Infinity;
    const perm = (used, acc, worst) => {
      if (worst >= best) return;
      if (acc === n) { best = worst; return; }
      for (let j = 0; j < n; j++) {
        if (used & (1 << j)) continue;
        perm(used | (1 << j), acc + 1, Math.max(worst, pcDist(a[acc], b[j])));
      }
    };
    perm(0, 0, 0);
    return best;
  }

  const DEFAULT_RULES = {
    common: true, commonMin: 2,
    chromatic: true,
    root: true, rootStep: true, rootThird: true, rootFifth: true,
  };

  // Principle 3: may `b` follow `a`? Root motion is judged on the actual bass
  // notes, which differ from the roots when a chord is slashed.
  function transition(a, b, rules, bassA = a.rootPc, bassB = b.rootPc) {
    const reasons = []; const kinds = [];
    const common = a.pcs.filter((p) => b.pcs.includes(p)).length;
    if (rules.common && common >= rules.commonMin) {
      reasons.push(`${common} common tone${common === 1 ? '' : 's'}`); kinds.push('common');
    }
    const disp = minMaxDisplacement(a.pcs, b.pcs);
    if (rules.chromatic && disp === 1) { reasons.push('chromatic steps'); kinds.push('chromatic'); }
    const up = mod12(bassB - bassA);
    const iv = Math.min(up, 12 - up);
    if (rules.root) {
      let label = null;
      if ((iv === 1 || iv === 2) && rules.rootStep) label = 'bass by step';
      else if ((iv === 3 || iv === 4) && rules.rootThird) label = 'bass by 3rd';
      else if (iv === 5 && rules.rootFifth) label = 'bass by 5th';
      if (label) { reasons.push(label); kinds.push('root'); }
    }
    return { ok: reasons.length > 0, reasons, kinds, common, disp, interval: iv };
  }

  function transitionTable(palette, rules) {
    const table = new Map();
    for (const a of palette) for (const b of palette) {
      if (a.id === b.id) continue;
      table.set(a.id + '>' + b.id, transition(a, b, rules));
    }
    return table;
  }

  // Drop non-diatonic chords that no diatonic chord can reach, or that cannot
  // reach a diatonic chord, under the active rules.
  function trim(palette, rules) {
    const diatonic = palette.filter((c) => c.cat === 'diatonic');
    const kept = [], trimmed = [];
    for (const c of palette) {
      if (c.cat === 'diatonic') { kept.push(c); continue; }
      const entry = diatonic.some((d) => transition(d, c, rules).ok);
      const exit = diatonic.some((d) => transition(c, d, rules).ok);
      (entry && exit ? kept : trimmed).push(c);
    }
    return { kept, trimmed };
  }

  return { KEYS, QUALITIES, CATEGORIES, MOVES, DEFAULT_RULES, STEPS,
    buildPalette, transition, transitionTable, trim, freeOffset, mod12, spellLetter, spellInKey };
})();
