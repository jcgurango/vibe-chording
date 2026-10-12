import { describe, it, expect } from 'vitest';
import { parseNote, transpose, I, invert, noteName, pcOf } from '../pitch';
import { chordName } from '../chords';
import { palette, type Home, pairingStrength } from '../palette';
import { pathsInto, nearTwins } from '../moves';
import { voice, voiceSequence } from '../voicing';
import { scorePath, type Placed } from '../scoring';

const C: Home = { root: parseNote('C'), mode: 'major' };
const pal = palette(C);
const byId = (id: string) => pal.find(s => s.id === id)!.chord;

describe('spelling', () => {
  it('spells the palette against C', () => {
    expect(pal.map(s => chordName(s.chord))).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7',
      'Cm7', 'Dø7', 'E♭maj7', 'Fm7', 'A♭maj7', 'B♭7',
      'Gm7', 'B♭maj7', 'D♭maj7', 'F♯ø7', 'F7',
    ]);
  });
  it('spells the palette against E', () => {
    const E = palette({ root: parseNote('E'), mode: 'major' });
    expect(E.map(s => chordName(s.chord)).slice(7)).toEqual(['Em7', 'F♯ø7', 'Gmaj7', 'Am7', 'Cmaj7', 'D7', 'Bm7', 'Dmaj7', 'Fmaj7', 'A♯ø7', 'A7']);
  });
  it('moves by spelled intervals and simplifies awkward results', () => {
    expect(noteName(transpose(parseNote('A'), invert(I.m2)))).toBe('G♯');
    expect(noteName(transpose(parseNote('A'), invert(I.A1)))).toBe('A♭');
    expect(noteName(transpose(parseNote('B'), I.A1))).toBe('C');
    expect(pcOf(transpose(parseNote('G♭'), I.P5))).toBe(1);
  });
});

describe('moves', () => {
  const names = (J: string, L: string) => pathsInto(byId(J), byId(L), C, pal).map(p => `${p.kind}: ${p.chords.map(chordName).join(' ')}`);

  it('produces the catalogue examples into Am7', () => {
    const n = names('IV', 'vi');
    expect(n).toContain('dominant: E7♭9');
    expect(n).toContain('ii–V: Bø7 E7♭9');
    expect(n).toContain('tritone sub: B♭7');
    expect(n).toContain('slide: B♭maj7');
    expect(n).toContain('diminished: G♯dim7');
    expect(n).toContain('pre-echo: Cmaj7');
  });
  it('walks diatonically from I to IV and passes chromatically from iii to ii', () => {
    expect(names('I', 'IV')).toContain('diatonic walk: Dm7 Em7');
    expect(names('iii', 'ii')).toContain('chromatic passing: E♭dim7');
    expect(names('I', 'IV')).toContain('dominant: C7');
  });
  it('flips quality and walks the bass', () => {
    expect(names('vi', 'ii')).toContain('dominant: A7♭9'); // the flip and the dominant are one chord; the dominant keeps the name
    expect(names('IV', 'I')).toContain('quality flip: Fm7');
    expect(names('v', 'i')).toContain('flip + bass walk: G7♭9 G7♭9/A G7♭9/B');
  });
  it('side-slips on a repeat', () => {
    expect(names('ii', 'ii')).toContain('side-slip: D♭maj7');
  });
  it('finds near-twins', () => {
    expect(nearTwins(byId('vi'), true).map(chordName)).toEqual(['Cmaj7', 'Fmaj7']);
    expect(nearTwins(byId('I'), true).map(chordName)).toEqual(['Am7', 'Em7']);
  });
  it('lists common motions', () => {
    expect(pairingStrength(byId('V'), byId('I'), C, pal)).toBe(1);
    expect(pairingStrength(byId('IV'), byId('V'), C, pal)).toBeGreaterThan(0.5);
  });
});

describe('voicing', () => {
  it('keeps shapes within the window and moves little', () => {
    const { voicings, costs } = voiceSequence(['ii', 'V', 'I'].map(byId), null);
    for (const v of voicings) {
      expect(v.upper[0]).toBeGreaterThanOrEqual(55);
      expect(v.upper[v.upper.length - 1]).toBeLessThanOrEqual(79);
    }
    expect(Math.max(...costs)).toBeLessThan(10);
  });
});

describe('scoring', () => {
  it('ranks the dominant into IV above its bass walk', () => {
    const start: Placed = { chord: byId('I'), weight: 'skeletal', kind: 'bare', voicing: voice(byId('I'), null) };
    const ctx = { home: C, pal, history: [start], homeDial: 0 };
    const scored = pathsInto(byId('I'), byId('IV'), C, pal).map(p => scorePath(p, ctx)).sort((a, b) => b.total - a.total);
    const kinds = scored.map(s => `${s.path.kind} ${s.path.chords.map(chordName).join(' ')} ${s.total.toFixed(3)}`);
    const dom = kinds.findIndex(k => k.startsWith('dominant C7'));
    const walk = kinds.findIndex(k => k.startsWith('bass walk'));
    expect(dom, kinds.join('\n')).toBeLessThan(walk);
  });
});
