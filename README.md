# Chord Sky

A browser tool built on *Skeleton and Moves: A Catalogue of Chord Thinking*.

The sky shows the skeletal palette for a major home: home at the centre, the
diatonic chords on an inner ring, chords borrowed from the parallel minor on the
next ring, and chords from other parallel modes on the outer ring. Angle follows
the root like a clock, so Fm7 sits outside Fmaj7 and Cm7 sits above Cmaj7.

Every landing-framed move from the catalogue is applied to every palette chord,
and the whole web is drawn at once:

- a move chord that already lives in the palette gets an arrow from its star
- a move chord outside the palette materialises as a hollow, italic star,
  shared by every landing it serves and settled among them by a force layout
- a two-chord move (ii–V) is chained, ii into V into the landing

Arrows are coloured by move and materialised stars by chord quality. Hover or
click a chord to light up what points at it and what it points at. The legend
at top right toggles each move's arrows. Click a chord to hear it as a
sine-wave voicing (root in the bass, 3-5-7-9 in a close shape around middle C).
Click the background or press Escape to clear the selection.

## Run

```
npm install
npm run dev
```

`npm test` runs the theory tests. `npm run build` type-checks and bundles.

## Layout

- `src/theory/` — pitch, spelling, chord qualities, the palette, moves, and voicing
- `src/audio/` — the Web Audio sine player
- `src/ui/` — the starfield, the chord sky with its constellations, and the HUD
