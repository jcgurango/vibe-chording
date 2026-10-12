# Skeleton and Moves — a map of chord thinking

A browser tool for building loop progressions on the paradigm in
*Skeleton and Moves: A Catalogue of Chord Thinking* (the document in this folder).

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # theory tests (vitest)
npm run build      # typecheck + production build into dist/
```

## The map

- **Columns are steps, rows are the skeletal chords.** Every column holds the whole palette of
  the home key: seven diatonic chords, six borrowed from the parallel minor, five from other
  parallel modes (a minor home has its short list of seven). The first column lights the usual
  starting places: I, IV, vi and ii.
- **Choosing a chord duplicates the palette to its right.** The chosen chord stays highlighted in
  its column and the next column becomes the frontier: wires fan out from the chosen chord to
  every chord it could lead to.
- **Each wire is a way in.** The plain wire is the direct motion. Wires with chips are moves:
  the chips are the chords that lead there (dominant, ii–V, tritone sub, slide, diminished,
  backdoor, plagal, diatonic walk, chromatic passing, pre-echo). Gold wires are variations of the
  chord being left (quality flip, bass walk, line cliché, side-slip, sus delay). Pink wires are
  deceptive landings: a dominant-type move aimed at the near-twin of the chord it lands on.
- **Opacity is the score.** Every wire is scored on the catalogue's dimensions (right fit, left
  fit, smoothness, tension fit, distance from home, pattern, variety, with Room held at full
  marks until there is rhythm) and the score sets its opacity. Hover a wire for the breakdown.
  Each row shows its best few moves; "+N more" shows the rest.
- **Click hears, shift+click chooses.** Clicking a chord, wire or chip plays it voice-led from the
  last chosen chord: a bass on the root (or the slash note) and a close-position upper shape
  that takes the nearest playable shape, per the voice-leading chapter. Shift+click appends the
  path to the progression. Shift+clicking a chord in an earlier column re-picks that step and
  drops what came after. Backspace undoes the last step, space plays the whole progression.
- **Controls.** Home root (the progression transposes with it) and mode; the "stay home ↔ wander"
  dial is the catalogue's distance-from-home taste setting; moves per chord; "roads not taken"
  draws faint direct wires in earlier gaps; zoom.
- **Sound.** A sampled piano loads on the first click; a small synth covers it until then.

## Code

| File | What it holds |
| --- | --- |
| `src/theory/pitch.ts` | Spelled notes and intervals, so ♭II is D♭ and ♯iv is F♯ |
| `src/theory/chords.ts` | Chord qualities, names, pitch classes, and the upper-shape tones each quality contributes |
| `src/theory/palette.ts` | The skeletal palettes, the common-motion (pairing) tables, tension levels, home scale helpers |
| `src/theory/moves.ts` | The move recipes, variations, deceptive landings; `pathsInto(jumpoff, landing)` |
| `src/theory/voicing.ts` | Two-layer voicing with the movement / center / top-note / bad-shape costs |
| `src/theory/scoring.ts` | The eight dimensions, their weights, and the opacity scale |
| `src/audio/player.ts` | Piano samples (smplr) with a synth fallback |
| `src/ui/layout.ts` | Columns, rows and wires for the SVG map |
| `src/ui/Map.tsx`, `App.tsx`, `Tooltip.tsx` | Rendering, state, interaction |

All strengths, weights and costs are the catalogue's starting guesses and live in plain tables
meant to be tuned by ear.

## Not yet

- Rhythm, slots and a player, so Room and the beat side of tension fit are placeholders.
- Promotion (holding a move for a full slot) and loop-wrap scoring against the first chord.
- Pairing strengths for a minor home are a first sketch; unlisted pairs fall back to smoothness.
