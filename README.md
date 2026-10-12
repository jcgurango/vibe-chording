# Skeleton and Moves — chord space

A browser tool for exploring chords and building loop progressions, built on
*Skeleton and Moves: A Catalogue of Chord Thinking* (the document in this folder).

## Run it

The app is plain HTML, CSS and ES modules with no dependencies. Browsers refuse to
load modules from `file://`, so serve the folder:

```
python3 -m http.server 8765
```

Then open http://localhost:8765/ in Chrome (any modern browser works).

## What it does

- **The space.** Every skeletal chord of the home key sits on a grid. Columns follow
  the chain of fourths (brighter left, darker right, home in the middle); rows are the
  palettes from the catalogue: sharp side (Lydian ♯iv and the promoted secondary
  dominants), diatonic, parallel minor, other modes. Drag or scroll to pan, pinch or
  ctrl-scroll to zoom.
- **Start.** With no chords chosen, ii7, IVmaj7, vi7 and Imaj7 are lit as the usual
  starting places. Click any chord to start.
- **Where could this lead?** The sequence is open-ended. The default focus is the end
  of the sequence (the blue `→ ?` in the bar): every skeletal chord is scored as the
  next step on the catalogue's dimensions, with left fit taking over the weight of right
  fit because no right neighbor is known yet. Brightness and the bar on each node show
  the score; the three dots show tension level. Blue arrows leave the last chord for the
  strongest next chords, and pills on the way show how to get there *by way of* a move
  (dominant, ii–V, tritone sub, diminished, backdoor, plagal, slide, diatonic walk,
  chromatic passing, pre-echo). Hovering a chord shows all of its moves; the panel lists
  the top three under each candidate. Clicking a pill adds the move and the chord it
  lands on, which is the catalogue's promoted move.
- **What goes between?** Click a gap (the arrow between two cards, or a path in the
  space) to work between two chords. Moves into the right chord sit along the path and
  are scored with the recipe strength as right fit; the chords that could sit between
  show their way in (blue) and out (dashed gold). Wrapping back to the first chord is
  just one of the gaps (`↻` in the bar), not a rule. Esc returns to the end.
- **Sound.** Clicking adds a chord and plays it with the voice leading intact: a bass
  on the root and a close-position upper shape chosen by the cost model from the
  voice-leading chapter (movement, pull toward center, top note, bad shapes).
  Shift-click only sounds a chord. Cards in the bar show each chord's frame label,
  name and voiced notes spelled against the chord; click a card to hear it again,
  Backspace removes the last chord.
- **Controls.** Home key (the sequence transposes with it) and a "stay home ↔ wander"
  dial that is the catalogue's distance-from-home taste setting.

## Files

| File | What it holds |
| --- | --- |
| `js/theory.js` | Pitch spelling, chord qualities, numerals, the skeletal palette, the common-motion table, the move recipes |
| `js/voicing.js` | Two-layer voicing: bass register and the upper shape search with its costs |
| `js/scoring.js` | The scoring dimensions and weights for skeletal chords and closing moves |
| `js/audio.js` | A small Web Audio synth |
| `js/space.js` | The SVG space: pan/zoom, nodes, edges, move pills |
| `js/app.js` | State, candidates, the panel and the loop bar |

Numbers in the scoring and voicing modules are the catalogue's starting guesses and
are meant to be tuned by ear.
