import { describe, it, expect } from 'vitest';
import { benchAll, summarize } from '../bench';

// Tendencies, not determinism: the catalogue's repertoire should sit near the top of the map.
describe('repertoire bench', () => {
  const results = benchAll();
  const s = summarize(results);
  it('ranks the chords the songs chose near the top', () => {
    expect(s.chordTop5, JSON.stringify(s)).toBeGreaterThanOrEqual(0.8);
    expect(s.chordMean).toBeLessThanOrEqual(3.5);
  });
  it('ranks the moves the songs used near the top of their chord', () => {
    expect(s.moveMissing).toBe(0);
    expect(s.moveTop3, JSON.stringify(s)).toBeGreaterThanOrEqual(0.6);
    expect(s.moveMean).toBeLessThanOrEqual(3.5);
  });
});
