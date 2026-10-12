'use strict';
/*
 * Map layout: chords sit on rings by category, at the angle of their root on
 * the circle of fifths (tonic at the top). A little deterministic jitter keeps
 * it looking like a constellation rather than a dial.
 */
const Layout = (() => {
  const RINGS = { diatonic: 125, minor: 207, secondary: 290, tritone: 373, sus: 456, passing: 456 };

  function hash(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  function place(palette, keyPc) {
    const groups = new Map();
    const info = palette.map((c) => {
      const f = Theory.mod12((c.rootPc - keyPc) * 7);     // circle-of-fifths index
      const ring = RINGS[c.cat];
      const key = ring + ':' + f;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c.id);
      return { c, f, ring, key };
    });
    const pos = new Map();
    for (const { c, f, ring, key } of info) {
      const sibs = groups.get(key);
      const i = sibs.indexOf(c.id), n = sibs.length;
      const h = hash(c.id);
      const diatonic = c.cat === 'diatonic';
      const jitterR = diatonic ? 0 : (h % 25) - 12;
      const jitterA = diatonic ? 0 : (((h >> 8) % 9) - 4) * 0.8;
      const angle = -90 + f * 30 + (i - (n - 1) / 2) * 17 + jitterA;
      const r = ring + jitterR;
      const a = (angle * Math.PI) / 180;
      pos.set(c.id, { x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return pos;
  }

  return { place, RINGS };
})();
