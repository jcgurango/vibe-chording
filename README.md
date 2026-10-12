# Vibe Chording

A browser-based chord player and progression builder. Open `index.html` directly
in a browser (no build step, no dependencies).

## Principles

1. **7ths as base.** Every chord in the palette is a 7th chord. No plain triads.
2. **Four-part voice leading.** The left hand plays the root with the 5th above it. The other hand plays
   three notes: the 3rd and 7th are always present, the third voice is the
   5th, root, 9th or 11th, whichever moves least from the previous chord.
   9ths and 11ths are never selected, they emerge. The first chord is in root
   position. When options tie on movement, the one nearer home (the closed
   voicing of Imaj7 or vi7, whichever is nearer) wins.
3. **What can follow what.** Chord B may follow chord A if any of these hold:
   common tones (threshold adjustable), chromatic step-wise motion (every voice
   holds or moves a half step), or strong root motion (by step, third or fifth).
   Each condition can be toggled in the Rules panel.

## Palette

Built around the selected key: the 7 diatonic chords, the 7 chords of the
parallel minor, secondary dominants and their related iis, tritone
substitutions, the backdoor move (iv7 → ♭VII7 → I), sus dominants and
chromatic passing dim7 chords. Non-diatonic chords with no Principle 3 entry
from a diatonic chord, or no exit into one, are trimmed.

## Using it

- The map lays chords out by category ring and circle-of-fifths angle. Faint
  lines are named moves. Bright arrows show everything that may follow the
  last chord, coloured by the rule that permits it.
- Click a chord on the map to hear it pure (root-position sines) and add it.
- Click a chord in the progression list to hear it voice-led. The list shows
  the left hand (root + 5th), the three upper voices, which extension emerged, and why the
  transition is allowed.
- Play runs the whole progression voice-led.
- The piano under the map is a note filter. Click a key to require that note
  (chords without it are greyed out); shift-click to exclude it (chords with
  it are greyed out). Each note sounds when selected; clicking again clears it.
- The `/` button on a progression item pins the bass to any note (slash
  chord). The left hand then plays that note with the root or 5th above it,
  the upper voices are unchanged, and the root-motion rule is judged on the
  actual bass line.
- The `▲` button pins the top note. Choices are the notes the upper voices
  may hold (3rd, 7th, 5th, root, 9th, 11th); the voicing search then only
  considers placements with that note on top.

## Files

- `js/theory.js` palette, spelling, Principle 3 rules, trimming, move catalogue
- `js/voicing.js` Principle 2 voice leading
- `js/layout.js` map positions
- `js/audio.js` Web Audio playback
- `js/app.js` UI
