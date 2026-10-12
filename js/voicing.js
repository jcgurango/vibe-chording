'use strict';
/*
 * Principle 2: four-part voice leading.
 *  - Left hand plays the root with the chord's 5th above it. A slashed chord
 *    pins the bass to another note; the second left-hand note is then the
 *    root or the 5th, whichever sits at the cleaner interval above the bass.
 *  - The other hand plays three notes: the 3rd and 7th are mandatory, the
 *    third voice is the 5th, root, 9th or 11th - whichever makes the smoothest
 *    move from the previous voicing. 9ths and 11ths are never chosen, they emerge.
 *  - The first chord is in root position: 3rd, 5th, 7th closed above the bass.
 *  - A pinned top note restricts the search to voicings with that note on top.
 *  - Every later chord minimises movement from the previous voicing. Only when
 *    options tie on movement does the pull towards "home" (the closed voicing of
 *    Imaj7 or vi7, whichever is nearer) decide between them.
 */
const Voicing = (() => {
  const UPPER_LO = 55, UPPER_HI = 84;   // G3 .. C6
  const MAX_SPAN = 12;                  // one hand
  const BASS_LO = 36, BASS_HI = 50;     // C2 .. D3
  const HOME_CENTER = 67;
  const TIE_TOLERANCE = 0;   // candidates within this much movement count as tied

  function midisInRange(pc, lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (m % 12 === pc) out.push(m);
    return out;
  }

  // Every legal upper-voice placement for a chord.
  function candidates(chord) {
    const q = Theory.QUALITIES[chord.quality];
    const third = Theory.mod12(chord.rootPc + q.third);
    const seventh = Theory.mod12(chord.rootPc + q.seventh);
    const out = [];
    for (const free of q.free) {
      const freePc = Theory.mod12(chord.rootPc + Theory.freeOffset(chord.quality, free));
      const octs = [third, seventh, freePc].map((pc) => midisInRange(pc, UPPER_LO, UPPER_HI));
      for (const a of octs[0]) for (const b of octs[1]) for (const c of octs[2]) {
        const notes = [a, b, c].sort((x, y) => x - y);
        if (notes[2] - notes[0] > MAX_SPAN) continue;
        out.push({ notes, free });
      }
    }
    return out;
  }

  // Sum of semitone movement between two sorted 3-note voicings.
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

  // Closed 3-5-7 voicing of a chord sitting closest to the middle of the hand.
  function homeVoicing(rootPc, quality) {
    let best = null, bestScore = Infinity;
    for (const v of candidates({ rootPc, quality })) {
      if (v.free !== 'fifth') continue;
      const mean = (v.notes[0] + v.notes[1] + v.notes[2]) / 3;
      const score = Math.abs(mean - HOME_CENTER) + 0.1 * (v.notes[2] - v.notes[0]);
      if (score < bestScore) { bestScore = score; best = v.notes; }
    }
    return best;
  }

  // Preferred intervals (semitones) for the second left-hand note above the bass.
  const LH_PREF = [7, 5, 4, 3, 8, 9, 6, 10, 2, 1, 11];

  function leftHand(chord, bassPc, prevBass) {
    const target = prevBass ?? 43;
    const bass = midisInRange(bassPc, BASS_LO, BASS_HI)
      .reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const q = Theory.QUALITIES[chord.quality];
    const options = [
      { role: 'fifth', pc: Theory.mod12(chord.rootPc + q.fifth) },
      { role: 'root', pc: chord.rootPc },
    ].filter((o) => o.pc !== bassPc)
     .map((o) => ({ ...o, iv: Theory.mod12(o.pc - bassPc) }))
     .sort((a, b) => LH_PREF.indexOf(a.iv) - LH_PREF.indexOf(b.iv));
    const pick = options[0];
    return { bass, bass2: bass + pick.iv, bass2Role: pick.role };
  }

  // Notes that may be pinned on top: whatever the upper voices can contain.
  function topChoices(chord) {
    const q = Theory.QUALITIES[chord.quality];
    return ['third', 'seventh', ...q.free].map((fn) => ({
      fn, pc: Theory.mod12(chord.rootPc + (fn === 'third' ? q.third : fn === 'seventh' ? q.seventh : Theory.freeOffset(chord.quality, fn))),
    }));
  }

  // Voice-lead a whole progression. items: [{ chord, bassPc, topPc }] where
  // bassPc is null for the plain root and topPc null for no pinned top note.
  // Returns one voicing per item:
  // { bass, bass2, bass2Role, upper, free, movement, home }.
  function voiceLead(items, keyPc) {
    const homes = [
      { name: 'I', notes: homeVoicing(keyPc, 'maj7') },
      { name: 'vi', notes: homeVoicing(Theory.mod12(keyPc + 9), 'm7') },
    ];
    const out = [];
    let prev = null;
    for (const { chord, bassPc, topPc } of items) {
      let best = null;
      const pool = topPc == null ? candidates(chord)
        : candidates(chord).filter((v) => v.notes[2] % 12 === topPc);
      if (!prev && topPc == null) {
        // root position: closed 3-5-7 nearest the middle of the hand
        const notes = homeVoicing(chord.rootPc, chord.quality);
        best = { notes, free: 'fifth', move: 0, home: null };
      } else {
        // score = movement first; home distance and small preferences only break ties.
        // A first chord with a pinned top stays as close to root position as it can.
        const ref = prev ? prev.upper : homeVoicing(chord.rootPc, chord.quality);
        const scored = pool.map((v) => {
          const homeD = homes.map((h) => dist(v.notes, h.notes));
          const nearest = homeD[0] <= homeD[1] ? 0 : 1;
          return { ...v, move: dist(v.notes, ref), homeD: homeD[nearest], home: prev ? homes[nearest].name : null };
        });
        const minMove = Math.min(...scored.map((v) => v.move));
        best = scored
          .filter((v) => v.move <= minMove + TIE_TOLERANCE)
          .sort((a, b) => a.move - b.move || a.homeD - b.homeD
            || (a.free === 'fifth' ? 0 : 1) - (b.free === 'fifth' ? 0 : 1)
            || (a.notes[2] - a.notes[0]) - (b.notes[2] - b.notes[0]))[0];
      }
      const lh = leftHand(chord, bassPc ?? chord.rootPc, prev ? prev.bass : null);
      const voicing = { ...lh, upper: best.notes, free: best.free, movement: prev ? best.move : 0, home: best.home };
      out.push(voicing);
      prev = voicing;
    }
    return out;
  }

  return { voiceLead, candidates, homeVoicing, topChoices };
})();
