'use strict';
/*
 * Song structure: chord lengths, the order chords are played in, the
 * human-readable text format and a MIDI writer.
 *
 * Lengths are stored in twenty-fourths of a 4/4 bar, so eighths, sixths,
 * quarters, thirds and halves are all whole numbers. One bar = 24. Up to
 * four bars.
 *
 * Each chord has an action for what happens after it:
 *   goto = null            move on to the next chord (the last chord wraps to the first)
 *   goto = k, times = null jump back to chord k, forever
 *   goto = k, times = N    jump back so the stretch k..this is heard N times
 */
const Song = (() => {
  const BAR = 24;
  const MAX_BARS = 4;
  // selectable fractions of a bar, in twenty-fourths
  const FRACTIONS = [
    { tw: 0, label: '–' },
    { tw: 3, label: '1/8' }, { tw: 4, label: '1/6' }, { tw: 6, label: '1/4' }, { tw: 8, label: '1/3' },
    { tw: 9, label: '3/8' }, { tw: 12, label: '1/2' }, { tw: 15, label: '5/8' }, { tw: 16, label: '2/3' },
    { tw: 18, label: '3/4' }, { tw: 20, label: '5/6' }, { tw: 21, label: '7/8' },
  ];
  const TIMES = [null, 2, 3, 4, 8];

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function fractionText(tw) {
    const g = gcd(tw, BAR);
    return `${tw / g}/${BAR / g}`;
  }

  // 24 -> "1 bar", 60 -> "2+1/2 bars", 3 -> "1/8 bar"
  function lengthText(tw) {
    const bars = Math.floor(tw / BAR), rest = tw % BAR;
    if (!rest) return `${bars} bar${bars === 1 ? '' : 's'}`;
    if (!bars) return `${fractionText(rest)} bar`;
    return `${bars}+${fractionText(rest)} bars`;
  }

  // "1 bar" | "1/2 bar" | "2+1/4 bars" | "1 + 1/4 bars" -> twenty-fourths, or null
  function parseLength(text) {
    const m = /(?:(\d+)\s*(?:\+\s*)?)?(?:(\d+)\s*\/\s*(\d+))?\s*bars?/i.exec(text);
    if (!m || (m[1] == null && m[2] == null)) return null;
    const bars = Number(m[1] ?? 0);
    const frac = m[2] != null ? Math.round((BAR * Number(m[2])) / Number(m[3])) : 0;
    const tw = bars * BAR + frac;
    return tw > 0 && tw <= MAX_BARS * BAR ? tw : null;
  }

  // Note name -> pitch class. Accepts ♭ b ♯ #, double accidentals too.
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function notePc(name) {
    const m = /^([A-Ga-g])([♭♯#b]*)$/.exec(name.trim());
    if (!m) return null;
    let pc = LETTER_PC[m[1].toUpperCase()];
    for (const ch of m[2]) pc += ch === '♭' || ch === 'b' ? -1 : 1;
    return ((pc % 12) + 12) % 12;
  }

  // Normalise chord names for matching: unicode accidentals to ascii, no spaces.
  const norm = (s) => s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, '').toLowerCase();

  // ---------- play order ----------
  // steps: [{ len, goto, times }]. Returns the indices played, in order.
  // loop = true wraps the end to the start and treats an unlimited jump as one
  // extra pass (for export); the live player handles the infinite case itself.
  function expand(steps, { maxSteps = 512 } = {}) {
    const n = steps.length;
    const order = [];
    const counts = new Array(n).fill(0);
    let i = 0;
    while (i < n && order.length < maxSteps) {
      order.push(i);
      i = advance(steps, i, counts);
    }
    return order;
  }

  // Where to go after chord i. Mutates counts. Returns n (past the end) when done.
  function advance(steps, i, counts, { unlimitedOnce = true } = {}) {
    const s = steps[i];
    const limit = s.times == null ? (unlimitedOnce ? 2 : Infinity) : s.times;
    if (s.goto != null && s.goto < i && counts[i] < limit - 1) {
      counts[i] += 1;
      for (let j = s.goto; j < i; j++) counts[j] = 0;   // inner repeats start over
      return s.goto;
    }
    return i + 1;
  }

  // ---------- text format ----------
  // song: { key, tempo, chords: [{ name, len, top, goto, times }] } -> text
  function format(song) {
    const lines = [`key: ${song.key}`, `tempo: ${song.tempo}`, ''];
    song.chords.forEach((c, i) => {
      const cols = [String(i + 1).padStart(2), c.name.padEnd(10), lengthText(c.len).padEnd(12)];
      if (c.top) cols.push(`top ${c.top}`);
      if (c.goto != null) cols.push(`then back to ${c.goto + 1}${c.times ? ` x${c.times}` : ' (loop)'}`);
      lines.push(cols.join('  ').trimEnd());
    });
    return lines.join('\n') + '\n';
  }

  // text -> { key, tempo, chords: [{ line, name, len, top, goto, times }] }
  // Throws an Error naming the line that could not be read.
  function parse(text) {
    const out = { key: null, tempo: null, chords: [] };
    text.split(/\r?\n/).forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      let m;
      if ((m = /^key\s*[:=]\s*(.+)$/i.exec(line))) { out.key = m[1].trim(); return; }
      if ((m = /^tempo\s*[:=]\s*(\d+)/i.exec(line))) { out.tempo = Number(m[1]); return; }
      m = /^(?:\d+\s*[.)]?\s+)?(\S+)\s*(.*)$/.exec(line);
      if (!m) throw new Error(`Line ${idx + 1}: can't read "${line}"`);
      const [, name, rest] = m;
      const len = parseLength(rest) ?? (rest.trim() === '' ? BAR : null);
      if (len == null) throw new Error(`Line ${idx + 1}: can't read the length in "${line}"`);
      const top = (/\btop\s+([A-Ga-g][♭♯#b]*)/.exec(rest) || [])[1] ?? null;
      const back = /\bback\s+to\s+(\d+)(?:\s*[x×]\s*(\d+))?/i.exec(rest);
      const n = out.chords.length;
      let goto = null, times = null;
      if (back) {
        goto = Number(back[1]) - 1;
        times = back[2] ? Number(back[2]) : null;
        if (goto < 0 || goto >= n) throw new Error(`Line ${idx + 1}: "back to ${back[1]}" must point at an earlier chord`);
      }
      out.chords.push({ line: idx + 1, name, len, top, goto, times });
    });
    return out;
  }

  // ---------- MIDI ----------
  // events: [{ notes: [midi], len }] in play order; one track, one channel.
  function midi(events, tempo) {
    const TPQ = 480;
    const tpt = (TPQ * 4) / BAR;   // ticks per length unit
    const bytes = [];
    const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7) > 0) b.unshift((n & 0x7f) | 0x80); return b; };
    const ev = (delta, ...data) => bytes.push(...vlq(delta), ...data);
    const uspq = Math.round(60e6 / tempo);
    ev(0, 0xff, 0x51, 0x03, (uspq >> 16) & 0xff, (uspq >> 8) & 0xff, uspq & 0xff);
    ev(0, 0xff, 0x58, 0x04, 4, 2, 24, 8);
    for (const { notes, len } of events) {
      notes.forEach((m, i) => ev(0, 0x90, m, i === 0 ? 92 : 80));
      const dur = Math.round(len * tpt);
      notes.forEach((m, i) => ev(i === 0 ? dur : 0, 0x80, m, 0));
    }
    ev(0, 0xff, 0x2f, 0x00);
    const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff];
    const track = [0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes];
    return new Uint8Array([...header, ...track]);
  }

  return { BAR, MAX_BARS, FRACTIONS, TIMES, lengthText, parseLength, notePc, norm, expand, advance, format, parse, midi };
})();
